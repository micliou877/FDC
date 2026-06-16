"""
從證交所/櫃買中心公開的 MIS 即時報價 API 抓取台股目前報價，
寫成 quotes.json 給前端讀取（透過 raw.githubusercontent.com，繞過瀏覽器 CORS 限制）。

MIS API 的「成交價」(z) 只有「剛好這一瞬間有成交」才會回傳數字，多數時候是 "-"，
所以改用「最佳買賣價中間值」當報價，幾乎每次盤中查詢都拿得到值，更適合做報價快照。
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import http.cookiejar
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).resolve().parent.parent
INDEX_HTML = ROOT / "index.html"
OUTPUT = ROOT / "quotes.json"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
MIS_BASE = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp"
WARMUP_URL = "https://mis.twse.com.tw/stock/"
BATCH_SIZE = 25  # 每批幾個代號（會各帶 tse_/otc_ 兩種，所以實際 ex_ch 數量是 2 倍）


def extract_codes():
    html = INDEX_HTML.read_text(encoding="utf-8")
    codes = set(re.findall(r'\{code:"(\d{4,6})"', html))
    return sorted(codes)


def build_opener():
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.addheaders = [("User-Agent", UA), ("Referer", WARMUP_URL)]
    return opener


def warmup(opener):
    try:
        opener.open(WARMUP_URL, timeout=10).read()
    except Exception as e:
        print(f"warmup failed: {e}", file=sys.stderr)


def fetch_batch(opener, codes):
    ex_ch = "|".join(f"{pfx}_{c}.tw" for c in codes for pfx in ("tse", "otc"))
    url = f"{MIS_BASE}?ex_ch={urllib.parse.quote(ex_ch, safe='|_.')}"
    try:
        with opener.open(url, timeout=15) as res:
            data = json.loads(res.read().decode("utf-8"))
        return data.get("msgArray", [])
    except Exception as e:
        print(f"fetch failed for batch starting {codes[0]}: {e}", file=sys.stderr)
        return []


def parse_entry(entry):
    code = entry.get("c")
    name = entry.get("n")
    if not code or not name:
        return None  # 該交易所沒有這個代號（tse/otc 猜錯的那一筆）

    z = entry.get("z")
    y = entry.get("y")

    def to_f(v):
        try:
            f = float(v)
            return f if f > 0 else None
        except (TypeError, ValueError):
            return None

    price = to_f(z)
    if price is None:
        a0 = (entry.get("a") or "").split("_")[0]
        b0 = (entry.get("b") or "").split("_")[0]
        ask, bid = to_f(a0), to_f(b0)
        if ask and bid:
            price = round((ask + bid) / 2, 4)
    prev_close = to_f(y)
    if price is None:
        price = prev_close
    if price is None:
        return None

    pct1 = round((price - prev_close) / prev_close * 100, 2) if prev_close else None
    vol_lots = to_f(entry.get("v")) or 0
    amount = round(price * vol_lots * 1000 / 1e8, 2)  # 億

    return {
        "code": code,
        "market": "TWSE" if entry.get("ex") == "tse" else "TPEX",
        "price": price,
        "pct1": pct1,
        "amount": amount,
    }


def main():
    codes = extract_codes()
    if not codes:
        print("no codes found in index.html", file=sys.stderr)
        sys.exit(1)

    opener = build_opener()
    warmup(opener)
    time.sleep(1)

    quotes = {}
    for i in range(0, len(codes), BATCH_SIZE):
        batch = codes[i:i + BATCH_SIZE]
        for entry in fetch_batch(opener, batch):
            parsed = parse_entry(entry)
            if parsed:
                quotes[parsed["code"]] = {
                    "market": parsed["market"],
                    "price": parsed["price"],
                    "pct1": parsed["pct1"],
                    "amount": parsed["amount"],
                }
        time.sleep(0.5)

    tz8 = timezone(timedelta(hours=8))
    output = {
        "updated": datetime.now(tz8).strftime("%Y-%m-%d %H:%M:%S"),
        "quotes": quotes,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {len(quotes)} quotes to {OUTPUT}")


if __name__ == "__main__":
    main()
