"""
從 yfinance 抓取美股 FDC 股池的報價、5日/10日漲跌幅與基本面資料，
是台股 FDC（FinMind/quotes.json）的美股姊妹版，對應同一套 31 大族群分類。
股池與分類依據見 美股FDC股池_完整整合版.md（整合原本對應台股族群的38檔＋Mic實際持有的
23檔＋各題材補充股，約63檔），held欄位標記是否為Mic目前實際持有。

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

# ~63 檔美股池：對應台股31大族群的原38檔 + Mic實際持有23檔 + 各題材補充股（見美股FDC股池_完整整合版.md）
# 值為 (sector, held)；held=True 是Mic目前實際持有的部位（見文件第〇節「先對帳」）。
# 注意：文件「先對帳」清單裡的INTC從未出現在後續任何股池表格中（文件本身的遺漏），
# 這裡補上，歸類到跟AMD/GOOGL同一個「AI晶片設計與IP」大分類（CPU/晶圓代工）。
US_STOCKS = {
    # ── 對應台股族群（原38檔骨架）──
    "NVDA": ("1 AI晶片設計與IP", True), "AMD": ("1 AI晶片設計與IP", True),
    "AVGO": ("1 AI晶片設計與IP", True), "MRVL": ("1 AI晶片設計與IP", False),
    "INTC": ("1 AI晶片設計與IP", True),  # 文件「先對帳」清單裡有但股池表格漏列，這裡補上
    "GOOGL": ("1 AI晶片設計與IP", True),  # TPU鏈
    "MU": ("5 記憶體循環", True), "WDC": ("5 記憶體循環", False), "SNDK": ("5 記憶體循環", False),
    "AMKR": ("2 先進封裝與封測", False),
    "KLAC": ("13 半導體設備", False), "LRCX": ("13 半導體設備", False),
    "AMAT": ("13 半導體設備", False), "KEYS": ("13 半導體設備", False),
    "COHR": ("9 CPO與光通訊", True), "LITE": ("9 CPO與光通訊", True),
    "GLW": ("9 CPO與光通訊", False), "ANET": ("9 CPO與光通訊", False),
    "DELL": ("3 AI伺服器ODM", False), "SMCI": ("3 AI伺服器ODM", False),
    "FLEX": ("3 AI伺服器ODM", True),  # EMS，對應鴻海/廣達
    "VRT": ("4 散熱與液冷", False), "ETN": ("24 重電電網", False), "GEV": ("24 重電電網", False),
    "STM": ("27 功率半導體", True), "ON": ("27 功率半導體", True),
    "MPWR": ("27 功率半導體", False), "WOLF": ("27 功率半導體", False),
    "MCHP": ("31 MCU", False), "TXN": ("27 功率半導體", False), "ADI": ("29 類比IDM", False),
    "AMBA": ("28 邊緣AI", False), "MBLY": ("22 車用自駕", False),
    "TSLA": ("19 機器人", True), "NXPI": ("22 車用自駕", False), "QCOM": ("20 AI手機", False),
    "AAPL": ("20 AI手機", True),  # 果鏈
    "PLTR": ("16 AI軟體", True), "PANW": ("15 資安", False), "CRWD": ("15 資安", False),
    "MSFT": ("16 AI軟體", True), "NOW": ("16 AI軟體", True), "NET": ("15 資安", True),
    "AVAV": ("18 軍工無人機", False), "LMT": ("18 軍工無人機", False),

    # ── 純美股獨立題材（台股沒有對應）──
    "ASTS": ("🚀太空衛星", True), "RKLB": ("🚀太空衛星", True), "SPCX": ("🚀太空衛星", True),
    "PL": ("🚀太空衛星", False), "LUNR": ("🚀太空衛星", False),
    "RDW": ("🚀太空衛星", False), "KTOS": ("🚀太空衛星", False),
    "LILMF": ("✈️eVTOL飛行載具", True), "JOBY": ("✈️eVTOL飛行載具", False),
    "ACHR": ("✈️eVTOL飛行載具", False), "EH": ("✈️eVTOL飛行載具", False),
    "PLUG": ("⚡氫能燃料電池", True), "BE": ("⚡氫能燃料電池", False), "BLDP": ("⚡氫能燃料電池", False),
    "SE": ("🌏東南亞電商", True), "GRAB": ("🌏東南亞電商", False), "MELI": ("🌏東南亞電商", False),
    "SNOW": ("☁️SaaS軟體", False), "DDOG": ("☁️SaaS軟體", False),
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
    for symbol, (sector, held) in US_STOCKS.items():
        data = fetch_one(symbol)
        if data:
            stocks[symbol] = {"sector": sector, "held": held, **data}
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
