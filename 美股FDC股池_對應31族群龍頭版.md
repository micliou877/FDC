# 美股 FDC 股池 — 對應 31 族群龍頭版（2026/09 重製）

> 建立日期：2026/09/23（取代 7 月舊版）
> 用途：台股 FDC（FinMind）的美股姊妹版，用 **yfinance** 抓取
> 選股原則：每族群挑美股龍頭 1-2 檔，精簡約 38 檔，好管理
> 品質標記邏輯沿用台股版（EPS/PER/營益率/獲利來源），只換資料源
> ★ = NVIDIA 直接點名供應鏈
> ※ 僅供研究參考，非投資建議

---

# 一、為什麼美股要用 yfinance（不是 FinMind）

**FinMind 沒有美股資料** — 這是你台股 FDC 無法直接搬過來的原因。

好消息：**判斷邏輯完全沿用**，只換資料源。yfinance 一個套件就能給你台股 FDC 現有的所有欄位：

| 你台股 FDC 的欄位 | yfinance 對應 |
|------|------|
| 收盤價、漲跌幅 | `history()` |
| PER（本益比）| `info['trailingPE']` |
| EPS | `info['trailingEps']` |
| 毛利率 | `info['grossMargins']` |
| **營益率（本業體質）** | `info['operatingMargins']` ⭐ |
| 淨利率 | `info['profitMargins']` |
| 殖利率 | `info['dividendYield']` |
| **營收年增率（成長股判斷用）** | `info['revenueGrowth']` ⭐ |

**營益率 + 營收年增率都能直接抓** → 你的「業績股 vs 題材股」「本業 vs 業外」「高成長股」三種標籤在美股全部能跑。

---

# 二、美股股池清單（38 檔，對應 31 族群）

## 晶片設計 / AI 運算核心

| 代號 | 公司 | 對應台股族群 | 台股對應 |
|------|------|------|------|
| **NVDA** | NVIDIA | 1 AI晶片 / 19 機器人 / 28 邊緣AI | 台積電、聯發科 |
| **AMD** | AMD | 1 AI晶片 | 世芯-KY |
| **AVGO** ★ | Broadcom | 1 AI晶片(ASIC) | 世芯-KY、智原 |
| **MRVL** | Marvell | 1 AI晶片(ASIC) | 創意、智原 |

## 記憶體 / 儲存

| 代號 | 公司 | 對應族群 | 台股對應 |
|------|------|------|------|
| **MU** ★ | Micron 美光 | 5 記憶體 / 29 IDM | 南亞科、華邦電 |
| **WDC** ★ | Western Digital | 5 記憶體 | 群聯、威剛 |
| **SNDK** ★ | SanDisk | 5 記憶體 | 群聯、旺宏 |

## 封裝 / 設備

| 代號 | 公司 | 對應族群 | 台股對應 |
|------|------|------|------|
| **AMKR** ★ | Amkor | 2 先進封裝 | 日月光、力成 |
| **KLAC** ★ | KLA | 13 半導體設備 | 弘塑、旺矽 |
| **LRCX** ★ | Lam Research | 13 半導體設備 | 辛耘、家登 |
| **AMAT** | Applied Materials | 13 半導體設備 | 京鼎、辛耘 |
| **KEYS** ★ | Keysight | 13 半導體設備 | 鴻勁、致茂 |

## 矽光子 / 光通訊（NVIDIA 入股重鎮）

| 代號 | 公司 | 對應族群 | 台股對應 |
|------|------|------|------|
| **COHR** ★ | Coherent | 9/23 CPO矽光子 | 聯亞、全新 |
| **LITE** ★ | Lumentum | 9/23 CPO矽光子 | 聯亞、上詮 |
| **GLW** ★ | Corning 康寧 | 8 PCB/CCL / 9 光纖 | 聯亞、光聖 |
| **ANET** | Arista Networks | 9 交換器 | 智邦 |

## 伺服器 / 電源 / 散熱

| 代號 | 公司 | 對應族群 | 台股對應 |
|------|------|------|------|
| **DELL** ★ | Dell | 3 AI伺服器ODM | 緯創（獨家）、廣達 |
| **SMCI** | Super Micro | 3 AI伺服器ODM | 緯穎、技嘉 |
| **VRT** ★ | Vertiv | 4 散熱 / 10 電源 / 24 重電 | 台達電、奇鋐 |
| **ETN** | Eaton | 24 重電電網 | 華城、亞力 |
| **GEV** | GE Vernova | 24 重電電網 | 華城、中興電 |

## 功率半導體 / MCU（NVIDIA 點名電力電子）

| 代號 | 公司 | 對應族群 | 台股對應 |
|------|------|------|------|
| **STM** ★ | STMicroelectronics | 27 功率半導體 / 31 MCU | 世界先進、漢磊 |
| **ON** ★ | ON Semiconductor | 27 功率半導體 / 22 車用 | 朋程、強茂 |
| **MPWR** | Monolithic Power | 27 功率(PMIC) | 矽力-KY、立錡 |
| **WOLF** | Wolfspeed | 27 第三代半導體(SiC) | 漢磊、嘉晶 |
| **MCHP** | Microchip | 31 MCU | 新唐、盛群 |
| **TXN** ★ | Texas Instruments | 27/29 類比IDM | 茂達、應廣 |
| **ADI** ★ | Analog Devices | 29 類比IDM | 矽力-KY |

## 邊緣 AI / 車用 / 自駕

| 代號 | 公司 | 對應族群 | 台股對應 |
|------|------|------|------|
| **AMBA** | Ambarella | 28 邊緣AI | 晶相光、聯詠 |
| **MBLY** | Mobileye | 22 車用自駕 | 為升、大立光 |
| **TSLA** | Tesla | 19 機器人 / 22 EV | 上銀、和大 |
| **NXPI** | NXP | 22 車用 / 31 MCU | 新唐、朋程 |
| **QCOM** | Qualcomm | 20 AI手機 / 28 邊緣AI | 聯發科 |

## 軟體 / 資安 / 雲端 / Physical AI

| 代號 | 公司 | 對應族群 | 台股對應 |
|------|------|------|------|
| **PLTR** | Palantir | 16 AI軟體 / Physical AI | 騰雲、所羅門 |
| **PANW** | Palo Alto | 15 資安 | 安碁資訊、立端 |
| **CRWD** | CrowdStrike | 15 資安 | 安碁資訊 |
| **MSFT** | Microsoft | 16 AI軟體雲端 | 宏碁資訊、伊雲谷 |

## 軍工 / 無人機 / 低軌衛星

| 代號 | 公司 | 對應族群 | 台股對應 |
|------|------|------|------|
| **AVAV** | AeroVironment | 18 軍工無人機 | 雷虎、龍德造船 |
| **LMT** | Lockheed Martin | 18 軍工 | 漢翔、千附精密 |

---

# 三、盤前觀察用「10 大領先指標」

每天早上（台股開盤前）掃這 10 檔美股，就能預判台股早盤族群輪動：

| 看這檔美股盤後 | 預判台股 |
|------|------|
| **NVDA** | AI 整體族群 |
| **MU** | 記憶體（南亞科、華邦電）|
| **VRT** | 散熱+電源（台達電、奇鋐、雙鴻）|
| **DELL** | ODM（緯創、廣達）|
| **TSLA** | 機器人+EV（上銀、達明、和大）|
| **COHR / LITE** | 矽光子（聯亞、全新）|
| **AVGO** | ASIC（世芯、緯穎）|
| **MPWR** | PMIC（矽力-KY、立錡）|
| **WOLF** | SiC 轉單（漢磊、嘉晶）|
| **PANW** | 資安（安碁、立端）|

---

# 四、美股品質標記邏輯（已修正成長股誤判問題）

美股跟台股最大的差異：**一堆高成長股 PER 天生破百（PLTR、AVAV、成長期軟體股），用台股「PER>100=題材股」會整批誤殺。** 所以美股版要用「三層判斷」，多一道成長股的救援。

```python
def classify_us_quality(eps, per, rev_growth, op_margin):
    """
    美股品質標記（三維判斷）
    eps: trailingEps
    per: trailingPE
    rev_growth: revenueGrowth（0.30 = 年增30%）
    op_margin: operatingMargins（0.10 = 營益率10%）
    """
    # 第一層：先判斷有沒有抓到
    if eps is None and per is None:
        return "✖️抓取失敗"
    if per is None:
        return "❓缺財報"

    # 第二層：虧損（本業或整體）
    if eps is not None and eps <= 0:
        # 虧損股再細分：是燒錢成長還是純虧
        if rev_growth is not None and rev_growth > 0.30:
            return "🚀高成長(未獲利)"   # 如成長期軟體/機器人股
        return "⚫虧損"

    # 第三層：PER 高，但要分「題材」還是「高成長」
    if per > 100 or (eps is not None and eps < 1):
        if rev_growth is not None and rev_growth > 0.30:
            return "🚀高成長"          # PLTR 這型：貴但有成長撐
        return "🔴題材股"             # 貴又沒成長 = 純題材

    # 正常區間
    if eps is not None and eps > 3 and 10 <= per <= 50:
        return "🟢業績股"
    return "🟡普通"


def check_earnings_source_us(op_margin):
    """本業體質判斷（跨市場通用）"""
    if op_margin is None:
        return "❓資料不足"
    if op_margin <= 0:
        return "🔺本業虧損"
    if op_margin < 0.10:
        return "🔸營益率偏低"
    return "✅本業紮實"
```

**關鍵改進**：`revenueGrowth > 30%` 是救援閥門。PLTR 這種 PER 破百但營收高速成長的，會標成 🚀高成長 而不是被冤枉成 🔴題材股。真正該被抓出來的是「PER 貴 + 沒成長」的那種。

---

# 五、給 Claude Code 的 yfinance 抓取指令

```
我要做一個「美股 FDC 系統」，是我台股 FinMind 系統的美股姊妹版。
資料源用 yfinance（FinMind 沒有美股）。判斷邏輯沿用台股版但針對美股微調。

【安裝】
pip install yfinance pandas

【股池】建立 us_stocks.json，38 檔（代號+名稱+對應台股族群）：
NVDA, AMD, AVGO, MRVL, MU, WDC, SNDK, AMKR, KLAC, LRCX, AMAT, KEYS,
COHR, LITE, GLW, ANET, DELL, SMCI, VRT, ETN, GEV, STM, ON, MPWR, WOLF,
MCHP, TXN, ADI, AMBA, MBLY, TSLA, NXPI, QCOM, PLTR, PANW, CRWD, MSFT,
AVAV, LMT
（美股代號直接用，不需後綴）

【抓取欄位】每檔抓：
- 收盤價、當日/5日/10日漲幅、成交量（history 算）
- trailingPE、trailingEps、grossMargins、operatingMargins、
  profitMargins、dividendYield、revenueGrowth

【品質標記】用「三維判斷」（重點：避免高成長股被誤判成題材股）：
classify_us_quality(eps, per, rev_growth, op_margin):
  - eps 和 per 都 None → "✖️抓取失敗"
  - per None → "❓缺財報"
  - eps <= 0 且 rev_growth > 0.30 → "🚀高成長(未獲利)"
  - eps <= 0 → "⚫虧損"
  - (per > 100 或 eps < 1) 且 rev_growth > 0.30 → "🚀高成長"
  - per > 100 或 eps < 1 → "🔴題材股"
  - eps > 3 且 10 <= per <= 50 → "🟢業績股"
  - 其餘 → "🟡普通"

【第二標籤：本業體質】check_earnings_source_us(op_margin):
  - op_margin <= 0 → "🔺本業虧損"
  - op_margin < 0.10 → "🔸營益率偏低"
  - 否則 → "✅本業紮實"

【輸出】
CSV：代號,名稱,族群,收盤,當日%,5日%,10日%,PER,EPS,營益率,營收年增,品質,本業體質
同時輸出 latest_us.json 供前端讀取

【注意】
- yfinance 的 info 用 .get() 取值，避免 KeyError
- 美股是台灣半夜交易，台灣早上 6:00 後跑（美股收盤後）
- 加 time.sleep(0.5) 避免 Yahoo 限流
- 繁體中文註解，CLAUDE.md 記錄這是台股 FDC 的美股版

【先測 5 檔驗證】NVDA, MU, VRT, WOLF, PLTR，檢查：
- NVDA → 🟢業績股 + ✅本業紮實
- MU   → 🟢業績股 + ✅本業紮實
- WOLF → ⚫虧損 + 🔺本業虧損（SiC 龍頭重整中）
- PLTR → 🚀高成長 + ✅本業紮實（不能標成🔴題材，這是驗證重點）
確認對了再跑全部 38 檔。
```

---

# 六、跟你台股 FDC 的整合建議

**兩套併行，共用前端**：

```
台股 FDC（FinMind）→ latest_tw.json ┐
                                      ├→ 同一個 HTML 介面，加「市場」切換
美股 FDC（yfinance）→ latest_us.json ┘
```

**跨市場觀察的最大價值**：早上先看美股 latest_us.json 的族群強弱，再對照台股開盤，等於用美股當台股的「領先指標」。這正好接你之前研究的「美股盤後 → 台股早盤」聯動邏輯。

**驗證案例（跑完檢查這幾檔）**：

| 代號 | 預期品質 | 預期本業體質 | 為什麼 |
|------|------|------|------|
| NVDA | 🟢業績股 | ✅本業紮實 | 高獲利、高營益率 |
| WOLF | ⚫虧損 | 🔺本業虧損 | SiC 龍頭重整中，燒錢 |
| MU | 🟢業績股 | ✅本業紮實 | HBM 循環獲利爆發 |
| PLTR | 🚀高成長 | ✅本業紮實 | PER 破百但營收高成長 — 不可誤判成題材 |
| SMCI | 🟡普通 | ✅本業紮實 | 毛利低但有獲利 |

---

*本文件為公開資訊整理，所有對應關係為研究參考。美股投資有匯率、時差、稅務等額外風險，請審慎評估。*
