"""
從 Yahoo Finance 公開的 chart API 抓取台股目前報價（約 15 分鐘延遲），
寫成 quotes.json 給前端讀取（透過 raw.githubusercontent.com，繞過瀏覽器 CORS 限制）。

原本改抓證交所 MIS API，但該 API 會擋掉雲端機房（GitHub Actions/Azure 等）的 IP，
在 Actions 上一律回 502，因此換成 Yahoo Finance（不擋雲端 IP，且免登入免金鑰）。

另外從 wantgoo.com 抓取台灣 VIX（臺指選擇權波動率指數），存入 vixtwn 欄位。
TAIFEX/mis.taifex.com.tw 頁面全為 JS 動態載入，無公開 REST API，
wantgoo.com 的 /index/vixtwn 為 server-rendered HTML，可直接用 regex 解析。
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).resolve().parent.parent
DATA_JS = ROOT / "assets" / "data.js"
INDEX_HTML = ROOT / "index.html"
OUTPUT = ROOT / "quotes.json"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
# 用 range=3mo（約 60 個交易日），同樣每檔只打一次請求就能一次算出精準的
# pct1 / pct5 / pct10 / close5Ref / close10Ref / volTrend(5日/20日) / 60日新高 / 成交金額(億)，
# 避免幾天沒手動按 FinMind 盤後更新時，5日/10日基準日漂移造成漲跌幅失真。
CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=3mo"


def extract_codes():
    src = DATA_JS if DATA_JS.exists() else INDEX_HTML
    text = src.read_text(encoding="utf-8")
    codes = set(re.findall(r'\{code:"(\d{4,6})"', text))
    if not codes and src != INDEX_HTML and INDEX_HTML.exists():
        codes = set(re.findall(r'\{code:"(\d{4,6})"', INDEX_HTML.read_text(encoding="utf-8")))
    codes.add("0050")  # 大盤基準，前端用來算族群 vs 大盤強弱，沒有寫在 SECTORS 清單裡
    return sorted(codes)


def fetch_chart(opener, symbol):
    url = CHART_URL.format(symbol=symbol)
    try:
        with opener.open(url, timeout=15) as res:
            data = json.loads(res.read().decode("utf-8"))
        result = (data.get("chart") or {}).get("result") or []
        return result[0] if result else None
    except Exception:
        return None


def _fetch_market_chart(opener, code):
    # 不依賴靜態交易所分類表，直接對 Yahoo 嘗試 .TW（上市）再嘗試 .TWO（上櫃）
    chart = fetch_chart(opener, f"{code}.TW")
    if chart:
        return "TWSE", chart
    chart = fetch_chart(opener, f"{code}.TWO")
    if chart:
        return "TPEX", chart
    return None, None


def _extract_aligned_series(chart):
    """從 Yahoo 3mo chart 整理出對齊今日報價的 (closes, volumes) 序列（由舊到新）。"""
    meta = chart.get("meta") or {}
    timestamps = chart.get("timestamp") or []
    quote = ((chart.get("indicators") or {}).get("quote") or [{}])[0]
    raw_closes = quote.get("close") or []
    raw_vols = quote.get("volume") or []

    tz8 = timezone(timedelta(hours=8))
    bars = []
    for i, c in enumerate(raw_closes):
        if c is None or c <= 0:
            continue
        ts = timestamps[i] if i < len(timestamps) else None
        v = raw_vols[i] if i < len(raw_vols) else None
        d_str = datetime.fromtimestamp(ts, tz=tz8).strftime("%Y-%m-%d") if ts else None
        bars.append([d_str, float(c), float(v) if (v is not None and v >= 0) else 0.0])

    reg_price = meta.get("regularMarketPrice")
    reg_vol = meta.get("regularMarketVolume")
    reg_time = meta.get("regularMarketTime")
    if reg_price is not None and reg_price > 0:
        reg_date = datetime.fromtimestamp(reg_time, tz=tz8).strftime("%Y-%m-%d") if reg_time else None
        if bars and reg_date and bars[-1][0] == reg_date:
            bars[-1][1] = float(reg_price)
            if reg_vol is not None and reg_vol >= 0:
                bars[-1][2] = float(reg_vol)
        elif not bars or (reg_date and bars[-1][0] != reg_date):
            bars.append([reg_date, float(reg_price), float(reg_vol) if (reg_vol is not None and reg_vol >= 0) else 0.0])

    return bars


def _chart_looks_stale(chart):
    """偵測 Yahoo meta 的 regularMarketPrice 卡在昨收、卻帶非零 regularMarketChangePercent 的矛盾狀態。"""
    meta = chart.get("meta") or {}
    price = meta.get("regularMarketPrice")
    yahoo_pct = meta.get("regularMarketChangePercent")
    bars = _extract_aligned_series(chart)
    prev_close = bars[-2][1] if len(bars) >= 2 else meta.get("previousClose")
    if price is None or prev_close is None or yahoo_pct is None:
        return False
    return abs(price - prev_close) < 1e-6 and abs(yahoo_pct) > 0.05


def fetch_one(opener, code):
    market, chart = _fetch_market_chart(opener, code)
    if chart is None:
        print(f"fetch failed for {code}", file=sys.stderr)
        return None, None
    for _ in range(2):
        if not _chart_looks_stale(chart):
            break
        time.sleep(3)
        retry_market, retry_chart = _fetch_market_chart(opener, code)
        if retry_chart is None:
            break
        market, chart = retry_market, retry_chart
    else:
        print(f"warning: {code} regularMarketPrice looks stale after retries", file=sys.stderr)
    return market, chart


def parse_chart(code, market, chart):
    if not chart:
        return None

    meta = chart.get("meta") or {}
    bars = _extract_aligned_series(chart)
    if not bars:
        price = meta.get("regularMarketPrice")
        if price is None:
            return None
        return {"market": market, "price": round(float(price), 2), "pct1": None, "amount": None}

    closes = [b[1] for b in bars]
    volumes = [b[2] for b in bars]
    price = closes[-1]
    volume = meta.get("regularMarketVolume")
    if volume is None:
        volume = volumes[-1]

    prev_close = closes[-2] if len(closes) >= 2 else meta.get("previousClose")
    pct1 = round((price - prev_close) / prev_close * 100, 2) if prev_close else None

    close5_ref = closes[-6] if len(closes) >= 6 else None
    close10_ref = closes[-11] if len(closes) >= 11 else None
    pct5 = round((price - close5_ref) / close5_ref * 100, 2) if close5_ref else None
    pct10 = round((price - close10_ref) / close10_ref * 100, 2) if close10_ref else None

    # 量能趨勢：近 5 日均量 / 近 20 日均量（與系統指標說明一致）
    # 若目前為台股盤中（09:00-13:30）且今日累積量尚未超過前 5 日均量，改用最近 5 個完整交易日，
    # 避免早盤剛開盤時因累積量偏小而誤判成「量縮／資金流出」。
    tz8 = timezone(timedelta(hours=8))
    now_tpe = datetime.now(tz=tz8)
    is_intraday = (now_tpe.weekday() < 5) and (900 <= now_tpe.hour * 100 + now_tpe.minute < 1330)
    vol_window = volumes[:-1] if (is_intraday and len(volumes) >= 21 and volumes[-1] < (sum(volumes[-6:-1]) / 5)) else volumes
    vol_trend = None
    if len(vol_window) >= 20:
        vol5 = sum(vol_window[-5:]) / 5
        vol20 = sum(vol_window[-20:]) / 20
        if vol20 > 0:
            vol_trend = round(vol5 / vol20, 3)
    elif len(vol_window) >= 10:
        vol5 = sum(vol_window[-5:]) / 5
        vol5p = sum(vol_window[-10:-5]) / 5
        if vol5p > 0:
            vol_trend = round(vol5 / vol5p, 3)

    prior_closes = closes[:-1][-60:]
    prior_high = round(max(prior_closes), 2) if prior_closes else None
    new_high_days = len(prior_closes)
    new_high = bool(prior_high is not None and price > prior_high)

    amount = round(price * volume / 1e8, 2) if volume else None

    return {
        "market": market,
        "price": round(price, 2),
        "pct1": pct1,
        "pct5": pct5,
        "pct10": pct10,
        "amount": amount,
        "volTrend": vol_trend,
        "close5Ref": round(close5_ref, 2) if close5_ref else None,
        "close10Ref": round(close10_ref, 2) if close10_ref else None,
        "priorHigh": prior_high,
        "newHigh": new_high,
        "newHighDays": new_high_days,
        "asOfDate": bars[-1][0],
    }


def fetch_vixtwn(opener):
    """從 TAIFEX getVixData 抓台灣 VIX 分時資料（官方端點，不需登入，不擋雲端 IP）。"""
    tz8 = timezone(timedelta(hours=8))
    today = datetime.now(tz=tz8)

    def parse_vix_file(content):
        """解析 tab-separated VIX 檔，只取時間欄為純數字的列，回傳最後一筆 (price, time_str)。
        TAIFEX 盤中不發布當日檔（返回 HTML），收盤後才有。"""
        if content.lstrip().startswith("<"):  # HTML 錯誤頁，非資料
            return None, None
        last_price, last_time = None, None
        for line in content.split("\n"):
            parts = line.strip().split("\t")
            if len(parts) < 5:
                continue
            time_col = parts[1].strip()
            if not time_col.isdigit():  # 跳過 "Last 1 min AVG" 等非時間列
                continue
            try:
                price = float(parts[-1].strip())
                if price > 0:
                    last_price = price
                    last_time = time_col
            except ValueError:
                pass
        return last_price, last_time

    # 嘗試最近 5 個自然日（跳假日、盤中當日檔未發布等情況）
    for offset in range(5):
        d = today - timedelta(days=offset)
        ds = d.strftime("%Y%m%d")
        url = f"https://www.taifex.com.tw/cht/7/getVixData?filesname={ds}"
        try:
            with opener.open(url, timeout=12) as r:
                content = r.read().decode("big5", errors="ignore")
            price, raw_time = parse_vix_file(content)
            if not price:
                continue

            # 時間：13450000 → "13:45"
            t = int(raw_time)
            hour, minute = t // 1000000, (t % 1000000) // 10000
            time_str = f"{hour:02d}:{minute:02d}"

            # 抓前一交易日最後收盤，算 pct1
            pct1 = None
            for prev_off in range(1, 6):
                pd = d - timedelta(days=prev_off)
                try:
                    with opener.open(
                        f"https://www.taifex.com.tw/cht/7/getVixData?filesname={pd.strftime('%Y%m%d')}",
                        timeout=8
                    ) as r2:
                        prev_content = r2.read().decode("big5", errors="ignore")
                    prev_price, _ = parse_vix_file(prev_content)
                    if prev_price:
                        pct1 = round((price - prev_price) / prev_price * 100, 2)
                        break
                except Exception:
                    pass

            print(f"fetch_vixtwn: TAIFEX {ds} → {price}")
            return {"price": price, "pct1": pct1, "prev_close": None,
                    "date": d.strftime("%Y-%m-%d"), "time": time_str}
        except Exception as e:
            print(f"fetch_vixtwn: {ds} failed: {e}", file=sys.stderr)

    print("fetch_vixtwn: 所有日期均失敗", file=sys.stderr)
    return None


def main():
    codes = extract_codes()
    if not codes:
        print("no codes found in index.html", file=sys.stderr)
        sys.exit(1)

    opener = urllib.request.build_opener()
    opener.addheaders = [("User-Agent", UA)]

    quotes = {}
    for code in codes:
        market, chart = fetch_one(opener, code)
        parsed = parse_chart(code, market, chart)
        if parsed:
            quotes[code] = parsed
        time.sleep(0.15)

    vixtwn = fetch_vixtwn(opener)
    if vixtwn:
        print(f"VIXTWN: {vixtwn['price']} ({vixtwn['date']} {vixtwn['time']})")
    else:
        print("VIXTWN: 抓取失敗", file=sys.stderr)

    tz8 = timezone(timedelta(hours=8))
    output = {
        "updated": datetime.now(tz8).strftime("%Y-%m-%d %H:%M:%S"),
        "quotes": quotes,
        "vixtwn": vixtwn,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {len(quotes)} quotes to {OUTPUT}")


if __name__ == "__main__":
    main()
