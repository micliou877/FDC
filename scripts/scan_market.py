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
commit回去，道理跟其他*_history.json快照檔一樣)。剛開始啟用的頭20～60天，歷史天數不夠，
量能倍數/新高這兩項只能先跳過，純漲跌幅的篩選條件不受影響、第一天就能用。

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
MIN_HISTORY_FOR_SIGNALS = 10   # 歷史天數太少時，量能/新高這兩項先跳過，避免用不足的樣本亂判斷

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
            capture_output=True, text=True, encoding="utf-8",
        )
        if result.returncode != 0 or not result.stdout:
            last_err = f"curl failed (code {result.returncode}): {result.stderr.strip()[:200]}"
            continue
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError as e:
            last_err = f"回應JSON不完整(通常是連線被對方提早關閉): {e}"
    raise RuntimeError(last_err)


def fetch_twse_today():
    """TWSE盤後彙總：回傳 {code: {"name","market","close","volume","pct1"}}"""
    out = {}
    try:
        rows = _curl_json(TWSE_URL)
    except Exception as e:
        print(f"TWSE STOCK_DAY_ALL 抓取失敗: {e}", file=sys.stderr)
        return out
    for row in rows:
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
        }
    return out


def fetch_tpex_today():
    """TPEX盤後彙總：同樣回傳 {code: {...}}，Change欄位TPEX本身就有正負號。"""
    out = {}
    try:
        rows = _curl_json(TPEX_URL)
    except Exception as e:
        print(f"TPEX daily_close_quotes 抓取失敗: {e}", file=sys.stderr)
        return out
    for row in rows:
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
        }
    return out


def load_history():
    if not HISTORY_FILE.exists():
        return {}
    try:
        return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_history(history, today_key, today_snapshot):
    history[today_key] = {
        code: {"close": v["close"], "volume": v["volume"]} for code, v in today_snapshot.items()
    }
    dates = sorted(history.keys())
    while len(dates) > HISTORY_KEEP_DAYS:
        del history[dates.pop(0)]
    HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=1), encoding="utf-8")


def compute_signals(code, today, history_dates, history):
    """回傳這檔股票觸發了哪些訊號(signals)，空list代表沒觸發、不列入清單。
    history_dates已經是排除「今天」、由新到舊排序好的歷史日期列表。"""
    signals = []
    pct1 = today.get("pct1")
    if pct1 is not None and pct1 >= PCT_GAIN_THRESHOLD:
        signals.append("大漲/接近漲停")

    if len(history_dates) >= MIN_HISTORY_FOR_SIGNALS:
        vol_window = history_dates[:VOLUME_AVG_DAYS]
        vols = [history[d][code]["volume"] for d in vol_window if code in history[d]]
        if vols:
            avg_vol = sum(vols) / len(vols)
            if avg_vol > 0 and today["volume"] > avg_vol * VOLUME_RATIO_THRESHOLD:
                signals.append(f"爆量(今量/{len(vols)}日均量={today['volume']/avg_vol:.1f}倍)")

        high_window = history_dates[:NEW_HIGH_DAYS]
        closes = [history[d][code]["close"] for d in high_window if code in history[d]]
        if closes and today["close"] > max(closes):
            signals.append(f"創{len(closes)}日新高")

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

    today_snapshot = {}
    today_snapshot.update(fetch_twse_today())
    today_snapshot.update(fetch_tpex_today())
    if not today_snapshot:
        print("今天兩個市場都抓不到資料，可能是非交易日或API異常，不產生掃描結果。", file=sys.stderr)
        sys.exit(1)
    print(f"今日全市場快照：{len(today_snapshot)} 檔（TWSE+TPEX）")

    history = load_history()
    history_dates_all = sorted(history.keys(), reverse=True)
    tz8 = timezone(timedelta(hours=8))
    today_key = datetime.now(tz8).strftime("%Y-%m-%d")
    # 萬一今天已經存過(重複執行)，排除掉避免跟自己比較
    history_dates = [d for d in history_dates_all if d != today_key]

    movers = []
    for code, today in today_snapshot.items():
        if code in pool_codes:
            continue  # 只看股池「外」的標的——池內的本來就天天在追蹤，不需要另外提醒
        signals = compute_signals(code, today, history_dates, history)
        if signals:
            movers.append({
                "code": code, "name": today["name"], "market": today["market"],
                "close": today["close"], "pct1": today["pct1"], "volume": today["volume"],
                "signals": signals,
            })
    movers.sort(key=lambda m: m.get("pct1") or 0, reverse=True)

    output = {
        "date": today_key,
        "historyDaysAvailable": len(history_dates),
        "criteria": {
            "pctGainThreshold": PCT_GAIN_THRESHOLD,
            "volumeRatioThreshold": VOLUME_RATIO_THRESHOLD,
            "volumeAvgDays": VOLUME_AVG_DAYS,
            "newHighDays": NEW_HIGH_DAYS,
        },
        "poolSize": len(pool_codes),
        "scannedCount": len(today_snapshot),
        "movers": movers,
    }
    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"股池外異動股：{len(movers)} 檔（寫入 {OUTPUT_FILE.name}）")
    if len(history_dates) < MIN_HISTORY_FOR_SIGNALS:
        print(f"注意：本地歷史只累積了 {len(history_dates)} 天（需要至少{MIN_HISTORY_FOR_SIGNALS}天），"
              f"爆量/創新高這兩項訊號目前還沒生效，只有「大漲/接近漲停」在運作，歷史累積足夠後會自動補上。")
    for m in movers[:15]:
        print(f"  {m['code']} {m['name']}（{m['market']}）{m['pct1']}% ・ {'、'.join(m['signals'])}")

    save_history(history, today_key, today_snapshot)


if __name__ == "__main__":
    main()
