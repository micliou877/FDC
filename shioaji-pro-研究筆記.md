# Shioaji Pro 交易終端 — 研究筆記

來源：<https://github.com/Sinotrade/shioaji-pro-app>
永豐金證券官方的專業交易終端，台股 / 上櫃 / 期貨（TWSE / TPEX / TAIFEX）。

---

## 核心架構

最關鍵的一點：**零後端程式碼**。前端直接打本機跑的 `shioaji server`（HTTP API + SSE 串流），不需要自己寫伺服器。

```
React 前端  ──HTTP API──▶  本機 shioaji server  ──▶  永豐金行情/交易
           ◀────SSE──────  (127.0.0.1:8080)
```

dev server 把 `/api` 代理到 `localhost:8080`。`shioaji server` 預設跑 simulation 模式（紙上交易），下單不動真錢。

---

## 技術棧

- React 19 + TypeScript + Vite 8
- vanilla-extract — zero-runtime、可換主題的 CSS
- lightweight-charts v5 — TradingView 那套 K 線
- react-grid-layout v2 — 拖拉版面
- 資料層：Shioaji HTTP API + Server-Sent Events

---

## 資料流設計重點

- **單一 SSE 連線**串流所有 tick / 五檔，自選清單只在**真實成交時閃動**（試撮不閃）— 這是行情顯示的關鍵判斷。
- K 線即時用 tick **更新「當根」K 棒**，不重抓整段。
- Hover 十字線價位即時同步到下單面板。

---

## 互動下單的做法

- **圖表點價下單**：點圖表價位直接限價買賣（one-shot 模式）。
- **拖曳委託線即改價**：未成交委託顯示為實線、overlay 有 CANCEL 按鈕，直接拖線改價。
- **停損 / 停利**：客戶端觸價單（觸價送市價單），圖上虛線顯示、可取消，**只在頁面開啟時監控**。
- **閃電下單梯**：價格梯點擊即下單（左欄買 / 右欄賣），預設**鎖定**需手動啟用。
- **五檔報價**：量能條視覺化，點價帶入下單面板。
- **下單面板**：整股/零股、ROD/IOC/FOK、期貨倉別，兩段式確認防誤觸。

---

## 其他功能

- 持倉 / 委託 / 帳務：即時損益、刪單、權益數與保證金。
- 排行榜 scanner：漲幅 / 量 / 額，點擊即加入追蹤。
- 自訂版面：react-grid-layout 拖拉移動/縮放，面板可任意新增（多開 K 線圖），每個面板可「連動自選」或「鎖定商品」，版面可命名儲存/載入。
- 主題：深色 / 純黑 / 淺色 × 紅漲綠跌(台式) / 綠漲紅跌(美式)。

---

## 部署巧思

可 build 後直接上傳到 shioaji server 代管成內建 app：

```bash
VITE_BASE=/apps/shioaji-pro-app/ pnpm build
cd dist
curl -X POST http://localhost:8080/api/v1/apps/shioaji-pro-app \
  -F "files=@index.html" \
  -F "files=@$(ls *.css)" \
  -F "files=@$(ls *.js)" \
  -F "files=@shioaji-logo.png"
```

開啟 `http://localhost:8080/apps/shioaji-pro-app/index.html`。
注意：上傳的 app 存在 server 記憶體，**server 重啟後需重新上傳**。

---

## 安全機制

- 預設 simulation 模式，頂部徽章區分模擬/正式（正式環境紅色標示）。
- 閃電下單預設鎖定；圖表點價為 one-shot。
- 停損/停利為客戶端觸價單，僅頁面開啟時監控。
- 切正式：`shioaji server start --production`（需先設定 CA 憑證）。

---

## 待研究 / 可借鏡到自己工具的點

- [ ] SSE 訂閱邏輯：單一連線如何分流 tick / 五檔，如何判斷真實成交 vs 試撮。
- [ ] tick 即時更新「當根 K 棒」的實作（可用於自己的期貨圖表）。
- [ ] 拖曳委託線改價怎麼接 API。
- [ ] 客戶端觸價單監控機制（停損停利穩定器邏輯，可對照 TX 大波段槓桿穩定器）。
