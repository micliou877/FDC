"""
從 yfinance 抓取美股 FDC 股池的報價、5日/10日漲跌幅與基本面資料，
是台股 FDC（FinMind/quotes.json）的美股姊妹版，對應同一套 31 大族群分類。
股池與分類依據見 美股FDC股池_對應31族群龍頭版.md。

品質標記邏輯沿用台股版精神，但美股高成長股 PER 天生偏高（PLTR 這類），
額外用 revenueGrowth 當救援閥門，避免被整批誤判成純題材股。
"""
import json
import sys
import time
from pathlib import Path
from datetime import datetime, timezone, timedelta

import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "us_stocks.json"

# 38 檔美股池，對應台股 FDC 的 31 大族群（見美股FDC股池_對應31族群龍頭版.md 第二節）
US_STOCKS = {
    "NVDA": "1 AI晶片設計與IP", "AMD": "1 AI晶片設計與IP", "AVGO": "1 AI晶片設計與IP", "MRVL": "1 AI晶片設計與IP",
    "MU": "5 記憶體循環", "WDC": "5 記憶體循環", "SNDK": "5 記憶體循環",
    "AMKR": "2 先進封裝與封測", "KLAC": "13 半導體設備", "LRCX": "13 半導體設備", "AMAT": "13 半導體設備", "KEYS": "13 半導體設備",
    "COHR": "9 CPO與光通訊", "LITE": "9 CPO與光通訊", "GLW": "9 CPO與光通訊", "ANET": "9 CPO與光通訊",
    "DELL": "3 AI伺服器ODM", "SMCI": "3 AI伺服器ODM",
    "VRT": "4 散熱與液冷", "ETN": "24 重電電網", "GEV": "24 重電電網",
    "STM": "27 功率半導體", "ON": "27 功率半導體", "MPWR": "27 功率半導體", "WOLF": "27 功率半導體",
    "MCHP": "31 MCU", "TXN": "27 功率半導體", "ADI": "29 類比IDM",
    "AMBA": "28 邊緣AI", "MBLY": "22 車用自駕", "TSLA": "19 機器人", "NXPI": "22 車用自駕", "QCOM": "20 AI手機",
    "PLTR": "16 AI軟體", "PANW": "15 資安", "CRWD": "15 資安", "MSFT": "16 AI軟體",
    "AVAV": "18 軍工無人機", "LMT": "18 軍工無人機",
}

# 盤前觀察用「10大領先指標」：看這幾檔美股盤後表現，預判台股隔天早盤族群輪動（見文件第三節）
LEADING_INDICATORS = {
    "NVDA": "AI整體族群", "MU": "記憶體(南亞科、華邦電)", "VRT": "散熱+電源(台達電、奇鋐、雙鴻)",
    "DELL": "ODM(緯創、廣達)", "TSLA": "機器人+EV(上銀、達明、和大)", "COHR": "矽光子(聯亞、全新)",
    "AVGO": "ASIC(世芯、緯穎)", "MPWR": "PMIC(矽力-KY、立錡)", "WOLF": "SiC轉單(漢磊、嘉晶)", "PANW": "資安(安碁、立端)",
}


def classify_us_quality(eps, per, rev_growth, op_margin):
    """
    美股品質標記（三維判斷）。
    虧損判斷刻意放在「per is None」檢查之前：真正虧損股(eps<=0)常常沒有
    trailingPE（P/E對負獲利沒有意義），若照原始順序判斷會被誤判成「缺財報」
    而非「虧損」——這點已用 WOLF（近期虧損重整中）實測資料驗證過。
    """
    if eps is None and per is None:
        return "✖️抓取失敗"
    if eps is not None and eps <= 0:
        if rev_growth is not None and rev_growth > 0.30:
            return "🚀高成長(未獲利)"
        return "⚫虧損"
    if per is None:
        return "❓缺財報"
    if per > 100 or eps < 1:
        if rev_growth is not None and rev_growth > 0.30:
            return "🚀高成長"
        return "🔴題材股"
    if eps > 3 and 10 <= per <= 50:
        return "🟢業績股"
    return "🟡普通"


def check_earnings_source_us(op_margin):
    """本業體質判斷（跨市場通用邏輯，沿用台股版）"""
    if op_margin is None:
        return "❓資料不足"
    if op_margin <= 0:
        return "🔺本業虧損"
    if op_margin < 0.10:
        return "🔸營益率偏低"
    return "✅本業紮實"


def r2(v, digits=2):
    return round(v, digits) if isinstance(v, (int, float)) else None


def fetch_one(symbol):
    try:
        t = yf.Ticker(symbol)
        hist = t.history(period="1mo")
        closes = hist["Close"].dropna()
        if len(closes) < 2:
            print(f"fetch failed for {symbol} (insufficient history)", file=sys.stderr)
            return None

        price = float(closes.iloc[-1])
        pct1 = round((price - float(closes.iloc[-2])) / float(closes.iloc[-2]) * 100, 2)
        pct5 = round((price - float(closes.iloc[-6])) / float(closes.iloc[-6]) * 100, 2) if len(closes) >= 6 else None
        pct10 = round((price - float(closes.iloc[-11])) / float(closes.iloc[-11]) * 100, 2) if len(closes) >= 11 else None
        # close5Ref/close10Ref：5日/10日前的收盤價，前端拿來算「加速度分」(近5日 vs 前一個5日報酬)，
        # 跟台股FDC同一套公式，欄位命名也刻意一致方便前端共用邏輯。
        close5_ref = float(closes.iloc[-6]) if len(closes) >= 6 else None
        close10_ref = float(closes.iloc[-11]) if len(closes) >= 11 else None

        info = t.info or {}
        per = info.get("trailingPE")
        eps = info.get("trailingEps")
        op_margin = info.get("operatingMargins")
        rev_growth = info.get("revenueGrowth")

        return {
            "price": r2(price), "pct1": pct1, "pct5": pct5, "pct10": pct10,
            "close5Ref": r2(close5_ref), "close10Ref": r2(close10_ref),
            "per": r2(per), "eps": r2(eps),
            "grossMargin": r2(info.get("grossMargins"), 4),
            "opMargin": r2(op_margin, 4),
            "profitMargin": r2(info.get("profitMargins"), 4),
            "dividendYield": r2(info.get("dividendYield"), 4),
            "revenueGrowth": r2(rev_growth, 4),
            "quality": classify_us_quality(eps, per, rev_growth, op_margin),
            "earningsSource": check_earnings_source_us(op_margin),
        }
    except Exception as e:
        print(f"fetch failed for {symbol}: {e}", file=sys.stderr)
        return None


def main():
    stocks = {}
    for symbol, sector in US_STOCKS.items():
        data = fetch_one(symbol)
        if data:
            stocks[symbol] = {"sector": sector, **data}
        time.sleep(0.8)  # 避免觸發 Yahoo 限流

    leading = {}
    for symbol, note in LEADING_INDICATORS.items():
        if symbol in stocks:
            leading[symbol] = {"note": note, "pct1": stocks[symbol]["pct1"]}

    tz8 = timezone(timedelta(hours=8))
    output = {
        "updated": datetime.now(tz8).strftime("%Y-%m-%d %H:%M:%S"),
        "stocks": stocks,
        "leadingIndicators": leading,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {len(stocks)} / {len(US_STOCKS)} US stocks to {OUTPUT}")


if __name__ == "__main__":
    main()
