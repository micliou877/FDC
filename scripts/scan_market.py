"""
全市場異動掃描：找出「FDC股池之外」當天爆量/大漲/創高的黑馬，避免漏掉沒收錄進股池的標的。

原本規劃用 FinMind 的 TaiwanStockPrice 不帶 data_id（整個市場一次撈），但實測發現
FinMind 免費帳號無法用這種「全市場」查詢方式，會直接回 400「Your level is free」
（需要付費Sponsor方案才能用）。改成跟 index.html 裡 fetchBulkPER() 同一招：改抓
TWSE／TPEX 官方的免費OpenAPI全市場收盤資料，不需要token、沒有限速問題：
  - TWSE: https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL
  - TPEX: https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes
這兩個是「盤後彙總報表」API，跟 fetch_quotes.py 原本想用、但會擋雲端IP的 MIS 即時API
是不同的服務，實測從這台機器直接打是通的；如果之後在 GitHub Actions 上發現也被擋，
就要比照 fetch_quotes.py 當初改用 Yahoo Finance 的做法另外找資料源。

這兩個OpenAPI端點只給「當天」資料，沒有歷史區間可以一次查60天份，所以「20日均量」
「60日新高」這兩個條件沒辦法用一次性查詢算出來，改成每天執行時把當天收盤資料疊進
market_history.json 這個本地累積檔(本repo沒有的話，GitHub Actions跑的時候會自動建立並
commit回去，道理跟其他*_history.json快照檔一樣)。各項訊號需要的歷史天數不同，會陸續
生效：連續上漲天數/近5日漲幅第5天就有、近10日漲幅第10天、單日爆量跟近5日/近10日持續
放量要等滿20天(均量基準)、創新高則是用現有天數比、滿60天後才是真正嚴謹的60日新高。

除了單日的「大漲/爆量/創新高」，也看「連續好幾天都有動能」：連續上漲天數、近5日/10日
累積漲幅、近5日/10日均量相對20日均量是否持續放大（不是只看單一天爆量，而是一段期間
平均下來量能有沒有真的墊高）。

另外這兩個OpenAPI的憑證鏈缺Subject Key Identifier，新版OpenSSL(3.x)驗證會直接擋下來
（實測在Python 3.13 urllib/ssl上重現），但curl走系統內建的憑證驗證可以正常通過，
所以這裡改用subprocess呼叫curl來抓，而不是放寬/略過Python這邊的憑證驗證。
"""
import json
import re
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX_HTML = ROOT / "index.html"
HISTORY_FILE = ROOT / "market_history.json"
OUTPUT_FILE = ROOT / "market_scan.json"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
TWSE_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"
TPEX_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes"

# 篩選門檻：集中寫在這裡，之後要調整不用翻邏輯
PCT_GAIN_THRESHOLD = 8.0       # 當日漲幅（%）達到這個門檻算「大漲／接近漲停」，不另外判斷個股漲停%不同的規則
VOLUME_RATIO_THRESHOLD = 2.0   # 當日量 ÷ 過去N日均量，達到這個倍數算「爆量」
VOLUME_AVG_DAYS = 20           # 均量取樣天數
NEW_HIGH_DAYS = 60             # 新高比較的天數（不含當天）
HISTORY_KEEP_DAYS = 70         # 本地歷史最多保留幾天（留一點緩衝給NEW_HIGH_DAYS=60用）

# 「持續動能」相關門檻：單日大漲/爆量只能看到瞬間噴出，加這幾項抓「連續好幾天都有動能」的標的
CONSECUTIVE_UP_DAYS_THRESHOLD = 5   # 連續收高達到幾天算「連續上漲」
PCT5_GAIN_THRESHOLD = 15.0          # 近5日累積漲幅（%）門檻
PCT10_GAIN_THRESHOLD = 25.0         # 近10日累積漲幅（%）門檻
VOL_RATIO_SUSTAINED_THRESHOLD = 1.5 # 近5日/10日均量 ÷ 近20日均量，達到這個倍數算「持續放量」(非單日爆量)

CODE_RE = re.compile(r"^\d{4,6}$")  # 排除ETF(00開頭常帶英文字母)/債券等非一般股票代碼


def extract_pool_codes():
    """FDC現有股池：直接從index.html的SECTORS抓code，跟fetch_quotes.py的extract_codes()同邏輯。"""
    html = INDEX_HTML.read_text(encoding="utf-8")
    return set(re.findall(r'\{code:"(\d{4,6})"', html))


def _to_float(s):
    try:
        return float(str(s).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def _parse_minguo_date(s):
    """TWSE/TPEX回應裡的Date欄位是民國年(例如'1151002'=民國115年10月02日)，轉成西元'YYYY-MM-DD'。
    實測發現這兩個官方彙總報表不一定同步更新——例如某次TPEX已經是10/05的資料，TWSE卻還停在
    10/02（卡了3天沒更新，不是我們這邊抓取失敗），所以不能用系統時鐘當作「今天」的日期，
    必須照實解析各自回應裡真正的報表日期，才不會把舊資料誤標成最新。"""
    s = str(s).strip()
    if len(s) < 6:
        return None
    try:
        year = int(s[:-4]) + 1911
        month = int(s[-4:-2])
        day = int(s[-2:])
        return f"{year:04d}-{month:02d}-{day:02d}"
    except ValueError:
        return None


def _is_real_stock(code, name):
    """排除權證／ETF這類非個股標的：實測第一次跑出來的結果，1685檔「異動股」裡有1638檔(97%)
    其實是權證(名稱結尾固定是「XX購NN」/「XX售NN」這種格式，槓桿造成漲跌幅動輒上百%~上千%，
    完全蓋掉真正的個股訊號)。ETF代碼固定「00」開頭(0050、0056、00631L...)，也不是黑馬選股
    掃描要找的「個股」，一併排除。"""
    if code.startswith("00"):
        return False
    if "購" in name or "售" in name:
        return False
    return True


def _curl_json(url, attempts=4):
    """用curl抓JSON（原因見檔案開頭說明：這兩個官方OpenAPI的憑證鏈curl驗得過、Python urllib驗不過）。
    實測TPEX那個端點會不定期回傳被截斷的JSON(curl exit 18，連線在資料送完前就被server關掉，
    不是每次都會發生)，所以這裡失敗就重試幾次，而不是只試一次就放棄。"""
    last_err = None
    for _ in range(attempts):
        result = subprocess.run(
            ["curl", "-s", "-A", UA, "--max-time", "30", url],
            capture_output=True,
        )
        if result.returncode != 0 or not result.stdout:
            last_err = f"curl failed (code {result.returncode}): {result.stderr.decode('utf-8', errors='replace').strip()[:200]}"
            continue
        # 截斷若剛好切在多位元組UTF-8字元中間，decode用errors="replace"容忍掉，
        # 讓它正常落入下面json.loads的例外分支去重試，而不是讓UnicodeDecodeError
        # 繞過重試機制直接讓整個函式失敗(之前只試1次就放棄，沒用到底下4次重試)。
        text = result.stdout.decode("utf-8", errors="replace")
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            last_err = f"回應JSON不完整(通常是連線被對方提早關閉): {e}"
    raise RuntimeError(last_err)


def fetch_twse_today():
    """TWSE盤後彙總：回傳 ({code: {"name","market","close","volume","pct1","asOfDate"}}, 報表日期)"""
    out = {}
    try:
        rows = _curl_json(TWSE_URL)
    except Exception as e:
        print(f"TWSE STOCK_DAY_ALL 抓取失敗: {e}", file=sys.stderr)
        return out, None
    report_date = None
    for row in rows:
        if report_date is None:
            report_date = _parse_minguo_date(row.get("Date"))
        code = str(row.get("Code", "")).strip()
        name = str(row.get("Name", "")).strip()
        if not CODE_RE.match(code) or not _is_real_stock(code, name):
            continue
        close = _to_float(row.get("ClosingPrice"))
        volume = _to_float(row.get("TradeVolume"))
        change = _to_float(row.get("Change"))
        if close is None or volume is None:
            continue
        prev_close = (close - change) if change is not None else None
        pct1 = round(change / prev_close * 100, 2) if (change is not None and prev_close) else None
        out[code] = {
            "name": name,
            "market": "TWSE",
            "close": close,
            "volume": volume,
            "pct1": pct1,
            "asOfDate": report_date,
        }
    return out, report_date


def fetch_tpex_today():
    """TPEX盤後彙總：同樣回傳 ({code: {...}}, 報表日期)，Change欄位TPEX本身就有正負號。"""
    out = {}
    try:
        rows = _curl_json(TPEX_URL)
    except Exception as e:
        print(f"TPEX daily_close_quotes 抓取失敗: {e}", file=sys.stderr)
        return out, None
    report_date = None
    for row in rows:
        if report_date is None:
            report_date = _parse_minguo_date(row.get("Date"))
        code = str(row.get("SecuritiesCompanyCode", "")).strip()
        name = str(row.get("CompanyName", "")).strip()
        if not CODE_RE.match(code) or not _is_real_stock(code, name):
            continue
        close = _to_float(row.get("Close"))
        volume = _to_float(row.get("TradingShares"))
        change = _to_float(row.get("Change"))
        if close is None or volume is None:
            continue
        prev_close = (close - change) if change is not None else None
        pct1 = round(change / prev_close * 100, 2) if (change is not None and prev_close) else None
        out[code] = {
            "name": name,
            "market": "TPEX",
            "close": close,
            "volume": volume,
            "pct1": pct1,
            "asOfDate": report_date,
        }
    return out, report_date


def load_history():
    if not HISTORY_FILE.exists():
        return {}
    try:
        return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_history(history, today_snapshot):
    """照各筆資料自己的asOfDate分別存進history，不是全部塞進同一個系統時鐘日期的key——
    否則TWSE卡著沒更新時，每天重跑都會把同一份舊收盤資料蓋寫成一筆「新的一天」，
    history裡會出現好幾天內容一模一樣的假交易日，污染連續上漲/均量這類N日計算。"""
    by_date = {}
    for code, v in today_snapshot.items():
        d = v.get("asOfDate")
        if not d:
            continue
        by_date.setdefault(d, {})[code] = {"close": v["close"], "volume": v["volume"]}
    for d, snap in by_date.items():
        history.setdefault(d, {}).update(snap)
    dates = sorted(history.keys())
    while len(dates) > HISTORY_KEEP_DAYS:
        del history[dates.pop(0)]
    HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=1), encoding="utf-8")


def compute_signals(code, today, history_dates, history):
    """回傳這檔股票觸發了哪些訊號(signals)，空list代表沒觸發、不列入清單。
    history_dates已經是排除「今天」、由新到舊排序好的歷史日期列表。

    每天的全市場快照(不只異動股)都會存進history，所以只要這檔股票正常交易(沒停牌/下櫃)，
    由今天往回找一定會連續有資料；一旦某天沒有這檔的紀錄就直接跳出，不把不連續的交易日
    誤算進「連續上漲天數」或「近N日」這類需要完整序列的計算裡。"""
    signals = []
    pct1 = today.get("pct1")
    if pct1 is not None and pct1 >= PCT_GAIN_THRESHOLD:
        signals.append("大漲/接近漲停")

    closes = [today["close"]]
    volumes = [today["volume"]]
    for d in history_dates:
        if code not in history[d]:
            break
        closes.append(history[d][code]["close"])
        volumes.append(history[d][code]["volume"])

    # 連續上漲天數：由今天往回比對，收盤一路比前一天高算一天，碰到不是就停
    up_days = 0
    for i in range(len(closes) - 1):
        if closes[i] > closes[i + 1]:
            up_days += 1
        else:
            break
    if up_days >= CONSECUTIVE_UP_DAYS_THRESHOLD:
        signals.append(f"連續上漲{up_days}天")

    # 近5日/近10日累積漲幅
    if len(closes) > 5 and closes[5]:
        pct5 = (closes[0] - closes[5]) / closes[5] * 100
        if pct5 >= PCT5_GAIN_THRESHOLD:
            signals.append(f"近5日漲幅+{pct5:.1f}%")
    if len(closes) > 10 and closes[10]:
        pct10 = (closes[0] - closes[10]) / closes[10] * 100
        if pct10 >= PCT10_GAIN_THRESHOLD:
            signals.append(f"近10日漲幅+{pct10:.1f}%")

    # 量能相關：共用同一組近20日均量當基準，分別檢查「今天單日爆量」跟「近5/10日平均是否持續放量」
    if len(volumes) >= VOLUME_AVG_DAYS:
        baseline_window = volumes[:VOLUME_AVG_DAYS]
        baseline = sum(baseline_window) / len(baseline_window)
        if baseline > 0:
            if today["volume"] > baseline * VOLUME_RATIO_THRESHOLD:
                signals.append(f"爆量(今量/{VOLUME_AVG_DAYS}日均量={today['volume']/baseline:.1f}倍)")
            for n in (5, 10):
                if len(volumes) >= n:
                    avg_n = sum(volumes[:n]) / n
                    ratio = avg_n / baseline
                    if ratio >= VOL_RATIO_SUSTAINED_THRESHOLD:
                        signals.append(f"近{n}日持續放量{ratio:.1f}倍")

    # 創N日新高(N最多到NEW_HIGH_DAYS，歷史不夠60天時先用現有天數比)
    prior_closes = closes[1:NEW_HIGH_DAYS + 1]
    if prior_closes and closes[0] > max(prior_closes):
        signals.append(f"創{len(prior_closes)}日新高")

    return signals


def main():
    # Windows主控台預設用cp950(Big5)編碼，印某些Unicode標點(如全形間隔號)會直接crash；
    # GitHub Actions的Linux runner預設是UTF-8不受影響，這裡強制UTF-8純粹是為了本機也能正常測試。
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    pool_codes = extract_pool_codes()
    print(f"FDC現有股池：{len(pool_codes)} 檔")

    twse_snapshot, twse_date = fetch_twse_today()
    tpex_snapshot, tpex_date = fetch_tpex_today()
    today_snapshot = {**twse_snapshot, **tpex_snapshot}
    if not today_snapshot:
        print("今天兩個市場都抓不到資料，可能是非交易日或API異常，不產生掃描結果。", file=sys.stderr)
        sys.exit(1)
    print(f"今日全市場快照：{len(today_snapshot)} 檔（TWSE+TPEX）")
    print(f"TWSE報表日期：{twse_date}・TPEX報表日期：{tpex_date}")
    if twse_date and tpex_date and twse_date != tpex_date:
        print("警告：兩個交易所的官方報表日期不一致，其中一邊還沒更新到最新交易日（不是我們抓取失敗，是對方資料本身還沒換日）。", file=sys.stderr)

    history = load_history()
    history_dates_all = sorted(history.keys(), reverse=True)

    movers = []
    for code, today in today_snapshot.items():
        if code in pool_codes:
            continue  # 只看股池「外」的標的——池內的本來就天天在追蹤，不需要另外提醒
        # 排除這支股票「自己」所屬市場的報表日期，避免跟剛抓到的今天資料重複比較
        own_history_dates = [d for d in history_dates_all if d != today.get("asOfDate")]
        signals = compute_signals(code, today, own_history_dates, history)
        if signals:
            movers.append({
                "code": code, "name": today["name"], "market": today["market"],
                "close": today["close"], "pct1": today["pct1"], "volume": today["volume"],
                "signals": signals,
            })
    movers.sort(key=lambda m: m.get("pct1") or 0, reverse=True)

    # 兩邊報表日期不一致時(常見：其中一邊還沒換日)，誠實標出各自的日期，不要假裝兩邊都是「今天」
    if twse_date and tpex_date and twse_date != tpex_date:
        display_date = f"TWSE {twse_date}／TPEX {tpex_date}"
    else:
        display_date = twse_date or tpex_date

    n = len(history_dates_all)
    output = {
        "date": display_date,  # TWSE/TPEX官方彙總報表「本身」標示的交易日，照實解析、不是系統時鐘日期
        # 腳本實際執行完成的時間戳：TWSE/TPEX資料沒有新交易日之前，同一天內重跑date/movers
        # 內容都會是一樣的，前端靠「有沒有新資料」來判斷觸發有沒有成功的話，重跑結果沒變
        # 時會誤判成「一直沒完成」，所以另外存一個每次執行一定會變的時間戳給前端比對用。
        "scannedAt": datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S"),
        "historyDaysAvailable": n,
        "criteria": {
            "pctGainThreshold": PCT_GAIN_THRESHOLD,
            "volumeRatioThreshold": VOLUME_RATIO_THRESHOLD,
            "volumeAvgDays": VOLUME_AVG_DAYS,
            "newHighDays": NEW_HIGH_DAYS,
            "consecutiveUpDaysThreshold": CONSECUTIVE_UP_DAYS_THRESHOLD,
            "pct5GainThreshold": PCT5_GAIN_THRESHOLD,
            "pct10GainThreshold": PCT10_GAIN_THRESHOLD,
            "volRatioSustainedThreshold": VOL_RATIO_SUSTAINED_THRESHOLD,
        },
        # 每項訊號各自需要的最少歷史天數不同，分開列出來，前端才能分別顯示「還差幾天」
        "signalReadiness": {
            "近5日漲幅/連續上漲": n >= 5,
            "近10日漲幅": n >= 10,
            "單日爆量/近5日近10日持續放量": n >= VOLUME_AVG_DAYS,
            "創新高(天數隨歷史增加到60天封頂)": n >= 1,
        },
        "poolSize": len(pool_codes),
        "scannedCount": len(today_snapshot),
        "movers": movers,
    }
    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"股池外異動股：{len(movers)} 檔（寫入 {OUTPUT_FILE.name}）・本地歷史 {n} 天")
    for label, ready in output["signalReadiness"].items():
        if not ready:
            print(f"  尚未生效：{label}")
    for m in movers[:15]:
        print(f"  {m['code']} {m['name']}（{m['market']}）{m['pct1']}% ・ {'、'.join(m['signals'])}")

    save_history(history, today_snapshot)


if __name__ == "__main__":
    main()
