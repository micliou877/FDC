"""
從 Yahoo Finance 公開的 chart API 抓取台股目前報價（約 15 分鐘延遲），
寫成 quotes.json 給前端讀取（透過 raw.githubusercontent.com，繞過瀏覽器 CORS 限制）。

原本改抓證交所 MIS API，但該 API 會擋掉雲端機房（GitHub Actions/Azure 等）的 IP，
在 Actions 上一律回 502，因此換成 Yahoo Finance（不擋雲端 IP，且免登入免金鑰）。
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
    return sorted(set(re.findall(r'\{code:"(\d{4,6})"', html)))


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

    tz8 = timezone(timedelta(hours=8))
    output = {
        "updated": datetime.now(tz8).strftime("%Y-%m-%d %H:%M:%S"),
        "quotes": quotes,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {len(quotes)} quotes to {OUTPUT}")


if __name__ == "__main__":
    main()
