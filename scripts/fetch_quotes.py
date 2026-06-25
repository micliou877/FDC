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
INDEX_HTML = ROOT / "index.html"
OUTPUT = ROOT / "quotes.json"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d"


def extract_codes():
    html = INDEX_HTML.read_text(encoding="utf-8")
    codes = set(re.findall(r'\{code:"(\d{4,6})"', html))
    codes.add("0050")  # 大盤基準，前端用來算族群 vs 大盤強弱，沒有寫在 SECTORS 清單裡
    return sorted(codes)


def fetch_chart(opener, symbol):
    url = CHART_URL.format(symbol=symbol)
    try:
        with opener.open(url, timeout=15) as res:
            data = json.loads(res.read().decode("utf-8"))
        result = (data.get("chart") or {}).get("result") or []
        return result[0].get("meta") if result else None
    except Exception:
        return None


def fetch_one(opener, code):
    # 不依賴 index.html 內的交易所分類表（該表有零星錯誤），改成直接
    # 對 Yahoo 嘗試 .TW（上市）再嘗試 .TWO（上櫃），用回應結果判定市場。
    meta = fetch_chart(opener, f"{code}.TW")
    if meta:
        return "TWSE", meta
    meta = fetch_chart(opener, f"{code}.TWO")
    if meta:
        return "TPEX", meta
    print(f"fetch failed for {code}", file=sys.stderr)
    return None, None


def parse_meta(code, market, meta):
    if not meta:
        return None

    price = meta.get("regularMarketPrice")
    prev_close = meta.get("previousClose") or meta.get("chartPreviousClose")
    volume = meta.get("regularMarketVolume")
    if price is None:
        return None

    pct1 = round((price - prev_close) / prev_close * 100, 2) if prev_close else None
    amount = round(price * volume / 1e8, 2) if volume else None

    return {
        "market": market,
        "price": round(price, 2),
        "pct1": pct1,
        "amount": amount,
    }


def fetch_vixtwn(opener):
    """從 wantgoo.com 抓取台灣 VIX（server-rendered HTML，regex 解析）"""
    url = "https://www.wantgoo.com/index/vixtwn"
    try:
        with opener.open(url, timeout=15) as res:
            html = res.read().decode("utf-8", errors="ignore")

        # 找日期與時間：VIXTWN 2026-06-24 13:45
        m_dt = re.search(r'VIXTWN\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})', html)
        if not m_dt:
            print("fetch_vixtwn: 找不到日期時間標記", file=sys.stderr)
            return None

        # 在日期時間之後，找第一個浮點數（VIX 通常在 10~100 之間）
        after_dt = html[m_dt.end():]
        m_price = re.search(r'\b(\d{1,3}\.\d{2})\b', after_dt)
        if not m_price:
            print("fetch_vixtwn: 找不到主數值", file=sys.stderr)
            return None
        price = float(m_price.group(1))

        # 昨收（前日收盤），用來算漲跌幅
        m_prev = re.search(r'昨收[_>\s]*(\d+\.\d+)', html)
        prev_close = float(m_prev.group(1)) if m_prev else None
        pct1 = round((price - prev_close) / prev_close * 100, 2) if prev_close else None

        return {
            "price": price,
            "pct1": pct1,
            "prev_close": prev_close,
            "date": m_dt.group(1),
            "time": m_dt.group(2),
        }
    except Exception as e:
        print(f"fetch_vixtwn failed: {e}", file=sys.stderr)
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
        market, meta = fetch_one(opener, code)
        parsed = parse_meta(code, market, meta)
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
