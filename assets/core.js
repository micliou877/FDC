// ==================== FDC Core: State, Cloud Sync, Fetchers & Calculations ====================
const APP_VERSION = "2026-11-26.4";

// ==================== 共用工具：跳脫、Toast、主題 ====================
function _dEsc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function _jsStr(s) {
  return JSON.stringify(String(s ?? "")).replace(/"/g, "&quot;");
}

function showToast(msg, type = "info", duration = 2600) {
  const box = document.getElementById("toastContainer");
  if (!box) return;
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .2s, transform .2s";
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
    setTimeout(() => el.remove(), 220);
  }, duration);
}

function getCurrentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}
function updateThemeBtnLabel() {
  const btn = document.getElementById("darkModeBtn");
  const btnMob = document.getElementById("darkModeBtnMobile");
  const isLight = getCurrentTheme() === "light";
  if (btn) btn.textContent = isLight ? "🌙 深色" : "☀️ 淺色";
  if (btnMob) btnMob.textContent = isLight ? "🌙" : "☀️";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isLight ? "#f3f5f9" : "#0f1218");
}
function toggleTheme() {
  const next = getCurrentTheme() === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("fdc_theme", next);
    localStorage.removeItem("fdc_dark_mode");
  } catch (e) {}
  updateThemeBtnLabel();
}
window.toggleDarkMode = toggleTheme;

// ==================== 全域狀態 ====================
let expandedSectors = new Set();
let heatHistory = {};
let stockData = {};
let financialsCache = {};
let watchlists = {
  "⭐ 第一級：純度最高": ["6870", "3081", "6739", "5439", "8033", "3491", "6690", "6667", "4749", "6788"],
  "📈 第二級：基本面驗證": ["2478", "8043", "5289", "6753", "5222", "6285", "7717", "6271", "2455", "4585"],
  "🔥 第三級：高彈性低流性": ["2429", "7719", "4541", "5471", "6116", "2949", "5258", "1514", "3479", "2419"]
};
let currentWatchGroup = "⭐ 第一級：純度最高";
let stockNotes = {};
let stockMeta = {};
let cloudRoomId = "";

let lastUpdateTime = null;
let liveQuoteTime = null;
let vixtwn = null;
let vixRefreshing = false;
const QUOTES_URL = "https://raw.githubusercontent.com/micliou877/FDC/main/quotes.json";
const US_QUOTES_URL = "https://raw.githubusercontent.com/micliou877/FDC/main/us_stocks.json";
const MARKET_SCAN_URL = "https://raw.githubusercontent.com/micliou877/FDC/main/market_scan.json";

let currentSector = null;
let syncInterval = null;
let stockSortKey = "pct10";
let stockSortDir = -1;
let rankingExpandSort = { key: "pct10", dir: -1 };
let stockSearchQ = "";
let stockNewHighOnly = false;
let wlNewHighOnly = false;
let wlSortKey = "custom"; // 'custom' 保留手動拖曳順序；其他值為臨時排序不覆蓋原順序
let wlSortDir = -1;
let wlViewMode = localStorage.getItem("fdc_wl_view_mode") || "all"; // 'all' | 'quote' | 'hold'
let dailyPlan = [];
let selectedPlanCode = null;
let diaryEntries = [];
let diaryFormState = null;
let diarySearchQ = "";
let diarySectorFilter = "";

// Lazy Render 狀態
let activeTab = "strategy";
const dirtyTabs = new Set(["strategy", "ranking", "stocks", "watchlist", "data", "diary"]);
let _cachedSectorStats = null;
let _cachedGain10Snapshot = null;
let _cachedGain10Key = "";

function invalidateSectorCache() {
  _cachedSectorStats = null;
  _cachedGain10Snapshot = null;
  _cachedGain10Key = "";
}
function getSectorStats() {
  if (!_cachedSectorStats) _cachedSectorStats = calcSectorStats();
  return _cachedSectorStats;
}
function markTabsDirty(tabs) {
  (tabs || ["strategy", "ranking", "stocks", "watchlist", "data", "diary", "usstocks", "marketscan"]).forEach(t => dirtyTabs.add(t));
}

// ==================== Firebase 雲端同步（非阻斷式通知條） ====================
const FIREBASE_URL = "https://fdc43-56da5-default-rtdb.firebaseio.com/";

let _pushInFlight = false;
let _pendingPush = false;
let watchlistsTs = 0;
let dailyPlanTs = 0;
let diaryTs = 0;
let stockNotesTs = 0;
let stockMetaTs = 0;
let headerNote = "";
let headerNoteTs = 0;
let headerChecklist = [];
let headerChecklistTs = 0;
let holdingsTs = 0;

let _declinedTs = { watchlists: 0, stockNotes: 0, stockMeta: 0, headerNote: 0, headerChecklist: 0, dailyPlan: 0, diary: 0, holdings: 0 };
let _pendingCloudSync = null; // { cloudData, pending: [{key, label}] }

function updateCloudBadge(text, online) {
  const el = document.getElementById("cloudBadge");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("cloud-online", !!online);
  el.classList.toggle("cloud-offline", !online);
}

async function pushToCloud() {
  if (!cloudRoomId || FIREBASE_URL.includes("請把")) return;
  _pushInFlight = true;
  try {
    await fetch(`${FIREBASE_URL}rooms/${cloudRoomId}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        watchlists, watchlistsTs,
        stockNotes, stockNotesTs,
        stockMeta, stockMetaTs,
        stockData, lastUpdateTime,
        finmindToken: localStorage.getItem("finmind_token") || "",
        dailyPlan, dailyPlanTs,
        diaryEntries, diaryTs,
        headerNote, headerNoteTs,
        headerChecklist, headerChecklistTs,
        holdings: window._t4_data || [], holdingsTs,
        rankHistory: loadGain10History(),
        mailScoreBacktestHistory: loadMailScoreBacktestHistory(),
        adviceBacktestHistory: loadAdviceBacktestHistory()
      })
    });
    _pendingPush = false;
  } catch (e) {
    console.error("雲端同步失敗", e);
    _pendingPush = true;
  } finally {
    _pushInFlight = false;
  }
}

async function connectCloud() {
  const inputId = document.getElementById("cloudRoomInput").value.trim();
  const statusEl = document.getElementById("cloudStatus");
  if (!inputId) { showToast("請輸入同步代碼", "warn"); return; }
  if (FIREBASE_URL.includes("請把")) { showToast("尚未設定 FIREBASE_URL", "error"); return; }

  cloudRoomId = inputId;
  statusEl.textContent = `連線中：${cloudRoomId}...`;
  updateCloudBadge("☁️ 連線中...", false);

  try {
    const res = await fetch(`${FIREBASE_URL}rooms/${cloudRoomId}.json`);
    const cloudData = await res.json();

    if (cloudData) {
      if (cloudData.watchlists && (cloudData.watchlistsTs || 0) > watchlistsTs) {
        watchlists = cloudData.watchlists;
        watchlistsTs = cloudData.watchlistsTs || 0;
        if (!watchlists[currentWatchGroup]) currentWatchGroup = Object.keys(watchlists)[0] || "";
      }
      if (cloudData.stockNotes && (cloudData.stockNotesTs || 0) >= stockNotesTs) {
        stockNotes = cloudData.stockNotes;
        stockNotesTs = cloudData.stockNotesTs || 0;
      }
      if (cloudData.stockMeta && (cloudData.stockMetaTs || 0) >= stockMetaTs) {
        stockMeta = cloudData.stockMeta;
        stockMetaTs = cloudData.stockMetaTs || 0;
      }
      if (cloudData.headerNote != null && (cloudData.headerNoteTs || 0) >= headerNoteTs) {
        headerNote = cloudData.headerNote;
        headerNoteTs = cloudData.headerNoteTs || 0;
        localStorage.setItem(HEADER_NOTE_KEY, headerNote);
        localStorage.setItem("fdc_header_note_ts", headerNoteTs);
        syncHeaderNoteUi();
      }
      if (Array.isArray(cloudData.headerChecklist) && (cloudData.headerChecklistTs || 0) >= headerChecklistTs) {
        headerChecklist = cloudData.headerChecklist;
        headerChecklistTs = cloudData.headerChecklistTs || 0;
        localStorage.setItem(HEADER_CHECKLIST_KEY, JSON.stringify(headerChecklist));
        localStorage.setItem("fdc_header_checklist_ts", headerChecklistTs);
        renderHeaderChecklist();
      }
      if (cloudData.stockData && cloudData.lastUpdateTime && (!lastUpdateTime || cloudData.lastUpdateTime > lastUpdateTime)) {
        stockData = cloudData.stockData;
        lastUpdateTime = cloudData.lastUpdateTime;
      }
      if (cloudData.finmindToken && !localStorage.getItem("finmind_token")) {
        localStorage.setItem("finmind_token", cloudData.finmindToken);
        document.getElementById("apiToken").value = cloudData.finmindToken;
      }
      if (cloudData.dailyPlan && (cloudData.dailyPlanTs || 0) > dailyPlanTs) {
        dailyPlan = cloudData.dailyPlan;
        dailyPlanTs = cloudData.dailyPlanTs || 0;
        persistDailyPlan();
      }
      if (Array.isArray(cloudData.diaryEntries) && (cloudData.diaryTs || 0) > diaryTs) {
        diaryEntries = cloudData.diaryEntries;
        diaryTs = cloudData.diaryTs || 0;
        persistDiary();
      }
      if (Array.isArray(cloudData.holdings) && (cloudData.holdingsTs || 0) > holdingsTs) {
        window._t4_data = cloudData.holdings;
        holdingsTs = cloudData.holdingsTs || 0;
        try { localStorage.setItem("fdc_holdings", JSON.stringify(window._t4_data)); localStorage.setItem("fdc_holdings_ts", holdingsTs); } catch (e) {}
      }
      if (cloudData.rankHistory) {
        const { merged, added } = mergeHistoryUnion(loadGain10History(), cloudData.rankHistory);
        if (added > 0) saveGain10History(merged);
      }
      if (cloudData.mailScoreBacktestHistory) {
        const { merged, added } = mergeHistoryUnion(loadMailScoreBacktestHistory(), cloudData.mailScoreBacktestHistory);
        if (added > 0) saveMailScoreBacktestHistory(merged);
      }
      if (cloudData.adviceBacktestHistory) {
        const { merged, added } = mergeHistoryUnion(loadAdviceBacktestHistory(), cloudData.adviceBacktestHistory);
        if (added > 0) saveAdviceBacktestHistory(merged);
      }
    }
    await pushToCloud();
    saveLocalOnly();
    statusEl.textContent = cloudData ? `已連線同步：${cloudRoomId}` : `已建立新代碼：${cloudRoomId}`;
    updateCloudBadge(`☁️ ${cloudRoomId}`, true);
    localStorage.setItem("cloud_room_id", cloudRoomId);
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(syncPull, 5000);
    updateUI(true);
  } catch (e) {
    statusEl.textContent = "連線失敗，請確認 Firebase 設定與網路。";
    updateCloudBadge("☁️ 連線失敗", false);
  }
}

async function forcePushCloud() {
  const inputId = document.getElementById("cloudRoomInput").value.trim();
  const statusEl = document.getElementById("cloudStatus");
  const previousRoomId = cloudRoomId;
  if (!inputId) { showToast("請先到「設定」頁輸入同步代碼", "warn"); switchTab("data"); return; }

  statusEl.textContent = `檢查雲端現況中：${inputId}...`;
  let cloudPeek = null;
  try {
    const peekRes = await fetch(`${FIREBASE_URL}rooms/${inputId}.json`);
    cloudPeek = await peekRes.json();
  } catch (e) {
    statusEl.textContent = previousRoomId ? `已連線：${previousRoomId}` : "目前為本機模式";
    showToast("檢查雲端現況失敗，請確認網路", "error");
    return;
  }

  let confirmMsg;
  if (!cloudPeek) {
    confirmMsg = `代碼「${inputId}」在雲端目前是空的，確定要用這台裝置建立雲端資料嗎？`;
  } else {
    const stockCount = Object.values(cloudPeek.watchlists || {}).reduce((n, arr) => n + (arr?.length || 0), 0);
    const planCount = (cloudPeek.dailyPlan || []).length;
    const diaryCount = (cloudPeek.diaryEntries || []).length;
    const holdingsCount = (cloudPeek.holdings || []).length;
    const cloudUpdated = cloudPeek.lastUpdateTime ? new Date(cloudPeek.lastUpdateTime).toLocaleString("zh-TW") : "未知";
    confirmMsg = `⚠️ 即將用本機資料「整包覆蓋」代碼「${inputId}」的雲端現有資料：\n\n`
      + `自選股 ${stockCount} 檔／作業清單 ${planCount} 筆／交易日記 ${diaryCount} 筆／持有記錄 ${holdingsCount} 筆\n`
      + `雲端盤後更新：${cloudUpdated}\n\n覆蓋後無法復原，確定上傳嗎？`;
  }
  if (!confirm(confirmMsg)) {
    cloudRoomId = previousRoomId;
    statusEl.textContent = previousRoomId ? `已連線：${previousRoomId}` : "目前為本機模式";
    return;
  }

  cloudRoomId = inputId;
  statusEl.textContent = `上傳中：${cloudRoomId}...`;

  watchlistsTs = Date.now();
  stockNotesTs = Date.now();
  stockMetaTs = Date.now();
  holdingsTs = Date.now();
  try { localStorage.setItem("fdc_holdings_ts", holdingsTs); } catch (e) {}
  saveDailyPlan();
  saveDiary();
  saveHeaderNote();
  saveHeaderChecklist();
  saveLocalOnly();

  try {
    await pushToCloud();
    statusEl.textContent = `已上傳，本機資料已覆蓋雲端（${cloudRoomId}）`;
    updateCloudBadge(`☁️ ${cloudRoomId}`, true);
    localStorage.setItem("cloud_room_id", cloudRoomId);
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(syncPull, 5000);
    showToast("已整包上傳覆蓋雲端", "success");
  } catch (e) {
    statusEl.textContent = "上傳失敗，請確認網路。";
    showToast("上傳失敗，請確認網路", "error");
  }
}

async function forcePullCloud() {
  const inputId = document.getElementById("cloudRoomInput").value.trim();
  const statusEl = document.getElementById("cloudStatus");
  if (!inputId) { showToast("請先到「設定」頁輸入同步代碼", "warn"); switchTab("data"); return; }

  cloudRoomId = inputId;
  statusEl.textContent = `下載中：${cloudRoomId}...`;

  try {
    const res = await fetch(`${FIREBASE_URL}rooms/${cloudRoomId}.json`);
    const cloudData = await res.json();
    if (!cloudData) {
      statusEl.textContent = "這組代碼在雲端還沒有資料，請改用「上傳」建立。";
      showToast("雲端尚無此代碼的資料", "warn");
      return;
    }

    if (cloudData.watchlists) {
      watchlists = cloudData.watchlists;
      watchlistsTs = cloudData.watchlistsTs || Date.now();
      if (!watchlists[currentWatchGroup]) currentWatchGroup = Object.keys(watchlists)[0] || "";
    }
    if (cloudData.stockNotes) { stockNotes = cloudData.stockNotes; stockNotesTs = cloudData.stockNotesTs || Date.now(); }
    if (cloudData.stockMeta) { stockMeta = cloudData.stockMeta; stockMetaTs = cloudData.stockMetaTs || Date.now(); }
    if (cloudData.headerNote != null) {
      headerNote = cloudData.headerNote;
      headerNoteTs = cloudData.headerNoteTs || Date.now();
      localStorage.setItem(HEADER_NOTE_KEY, headerNote);
      localStorage.setItem("fdc_header_note_ts", headerNoteTs);
      syncHeaderNoteUi();
    }
    if (Array.isArray(cloudData.headerChecklist)) {
      headerChecklist = cloudData.headerChecklist;
      headerChecklistTs = cloudData.headerChecklistTs || Date.now();
      localStorage.setItem(HEADER_CHECKLIST_KEY, JSON.stringify(headerChecklist));
      localStorage.setItem("fdc_header_checklist_ts", headerChecklistTs);
      renderHeaderChecklist();
    }
    if (cloudData.stockData) { stockData = cloudData.stockData; lastUpdateTime = cloudData.lastUpdateTime; }
    if (cloudData.finmindToken) {
      localStorage.setItem("finmind_token", cloudData.finmindToken);
      document.getElementById("apiToken").value = cloudData.finmindToken;
    }
    if (cloudData.dailyPlan) { dailyPlan = cloudData.dailyPlan; dailyPlanTs = cloudData.dailyPlanTs || Date.now(); persistDailyPlan(); }
    if (Array.isArray(cloudData.diaryEntries)) { diaryEntries = cloudData.diaryEntries; diaryTs = cloudData.diaryTs || Date.now(); persistDiary(); }
    if (Array.isArray(cloudData.holdings)) {
      window._t4_data = cloudData.holdings;
      holdingsTs = cloudData.holdingsTs || Date.now();
      try { localStorage.setItem("fdc_holdings", JSON.stringify(window._t4_data)); localStorage.setItem("fdc_holdings_ts", holdingsTs); } catch (e) {}
    }
    if (cloudData.rankHistory) saveGain10History(cloudData.rankHistory);
    if (cloudData.mailScoreBacktestHistory) saveMailScoreBacktestHistory(cloudData.mailScoreBacktestHistory);
    if (cloudData.adviceBacktestHistory) saveAdviceBacktestHistory(cloudData.adviceBacktestHistory);

    saveLocalOnly();
    hideCloudSyncBanner();
    statusEl.textContent = `已下載，雲端資料已覆蓋本機（${cloudRoomId}）`;
    updateCloudBadge(`☁️ ${cloudRoomId}`, true);
    localStorage.setItem("cloud_room_id", cloudRoomId);
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(syncPull, 5000);
    updateUI(true);
    showToast("已從雲端下載最新資料", "success");
  } catch (e) {
    statusEl.textContent = "下載失敗，請確認網路。";
    showToast("下載失敗，請確認網路", "error");
  }
}

function showCloudSyncBanner(cloudData, pending) {
  _pendingCloudSync = { cloudData, pending };
  const banner = document.getElementById("cloudSyncBanner");
  const text = document.getElementById("cloudSyncBannerText");
  if (!banner || !text) return;
  text.innerHTML = `<strong>📥 偵測到其他裝置更新：</strong>${pending.map(p => _dEsc(p.label)).join("、")}`;
  banner.classList.add("visible");
}
function hideCloudSyncBanner() {
  _pendingCloudSync = null;
  const banner = document.getElementById("cloudSyncBanner");
  if (banner) banner.classList.remove("visible");
}
window.applyPendingCloudSync = function() {
  if (!_pendingCloudSync) return;
  const { cloudData, pending } = _pendingCloudSync;
  const has = k => pending.some(p => p.key === k);
  if (has("watchlists")) {
    watchlists = cloudData.watchlists;
    watchlistsTs = cloudData.watchlistsTs || 0;
    if (!watchlists[currentWatchGroup]) currentWatchGroup = Object.keys(watchlists)[0] || "";
  }
  if (has("stockNotes")) { stockNotes = cloudData.stockNotes; stockNotesTs = cloudData.stockNotesTs || 0; }
  if (has("stockMeta")) { stockMeta = cloudData.stockMeta; stockMetaTs = cloudData.stockMetaTs || 0; }
  if (has("headerNote")) {
    headerNote = cloudData.headerNote; headerNoteTs = cloudData.headerNoteTs || 0;
    localStorage.setItem(HEADER_NOTE_KEY, headerNote);
    localStorage.setItem("fdc_header_note_ts", headerNoteTs);
    syncHeaderNoteUi();
  }
  if (has("headerChecklist")) {
    headerChecklist = cloudData.headerChecklist; headerChecklistTs = cloudData.headerChecklistTs || 0;
    localStorage.setItem(HEADER_CHECKLIST_KEY, JSON.stringify(headerChecklist));
    localStorage.setItem("fdc_header_checklist_ts", headerChecklistTs);
    renderHeaderChecklist();
  }
  if (has("dailyPlan")) { dailyPlan = cloudData.dailyPlan; dailyPlanTs = cloudData.dailyPlanTs || 0; persistDailyPlan(); }
  if (has("diary")) { diaryEntries = cloudData.diaryEntries; diaryTs = cloudData.diaryTs || 0; persistDiary(); }
  if (has("holdings")) {
    window._t4_data = cloudData.holdings; holdingsTs = cloudData.holdingsTs || 0;
    try { localStorage.setItem("fdc_holdings", JSON.stringify(window._t4_data)); localStorage.setItem("fdc_holdings_ts", holdingsTs); } catch (e) {}
  }
  hideCloudSyncBanner();
  saveLocalOnly();
  updateUI(false);
  showToast("已套用來自其他裝置的更新", "success");
};
window.dismissPendingCloudSync = function() {
  if (!_pendingCloudSync) return;
  const { cloudData, pending } = _pendingCloudSync;
  const map = {
    watchlists: "watchlistsTs", stockNotes: "stockNotesTs", stockMeta: "stockMetaTs",
    headerNote: "headerNoteTs", headerChecklist: "headerChecklistTs",
    dailyPlan: "dailyPlanTs", diary: "diaryTs", holdings: "holdingsTs"
  };
  pending.forEach(p => { _declinedTs[p.key] = cloudData[map[p.key]] || 0; });
  hideCloudSyncBanner();
  showToast("已暫時忽略這次雲端更新", "info");
};

async function syncPull() {
  if (!cloudRoomId || FIREBASE_URL.includes("請把")) return;
  if (_pushInFlight) return;
  try {
    const res = await fetch(`${FIREBASE_URL}rooms/${cloudRoomId}.json`);
    if (_pushInFlight) return;
    const cloudData = await res.json();
    if (cloudData) {
      let bgChanged = false;
      const pending = [];
      if (cloudData.watchlists && (cloudData.watchlistsTs || 0) > watchlistsTs && (cloudData.watchlistsTs || 0) > _declinedTs.watchlists &&
          JSON.stringify(watchlists) !== JSON.stringify(cloudData.watchlists)) {
        const oldCount = Object.values(watchlists).reduce((n, a) => n + (a?.length || 0), 0);
        const newCount = Object.values(cloudData.watchlists).reduce((n, a) => n + (a?.length || 0), 0);
        pending.push({ key: "watchlists", label: `自選股（${oldCount} → ${newCount} 檔）` });
      }
      if (cloudData.stockNotes && (cloudData.stockNotesTs || 0) > stockNotesTs && (cloudData.stockNotesTs || 0) > _declinedTs.stockNotes &&
          JSON.stringify(stockNotes) !== JSON.stringify(cloudData.stockNotes)) {
        pending.push({ key: "stockNotes", label: "個股備註" });
      }
      if (cloudData.stockMeta && (cloudData.stockMetaTs || 0) > stockMetaTs && (cloudData.stockMetaTs || 0) > _declinedTs.stockMeta &&
          JSON.stringify(stockMeta) !== JSON.stringify(cloudData.stockMeta)) {
        pending.push({ key: "stockMeta", label: "自訂標的資訊" });
      }
      if (cloudData.headerNote != null && (cloudData.headerNoteTs || 0) > headerNoteTs && (cloudData.headerNoteTs || 0) > _declinedTs.headerNote &&
          cloudData.headerNote !== headerNote) {
        pending.push({ key: "headerNote", label: "頁首備註" });
      }
      if (Array.isArray(cloudData.headerChecklist) && (cloudData.headerChecklistTs || 0) > headerChecklistTs && (cloudData.headerChecklistTs || 0) > _declinedTs.headerChecklist &&
          JSON.stringify(cloudData.headerChecklist) !== JSON.stringify(headerChecklist)) {
        pending.push({ key: "headerChecklist", label: `限制清單（${cloudData.headerChecklist.length} 項）` });
      }
      if (cloudData.dailyPlan && (cloudData.dailyPlanTs || 0) > dailyPlanTs && (cloudData.dailyPlanTs || 0) > _declinedTs.dailyPlan &&
          JSON.stringify(dailyPlan) !== JSON.stringify(cloudData.dailyPlan)) {
        pending.push({ key: "dailyPlan", label: `作業清單（${cloudData.dailyPlan.length} 筆）` });
      }
      if (Array.isArray(cloudData.diaryEntries) && (cloudData.diaryTs || 0) > diaryTs && (cloudData.diaryTs || 0) > _declinedTs.diary &&
          JSON.stringify(diaryEntries) !== JSON.stringify(cloudData.diaryEntries)) {
        pending.push({ key: "diary", label: `交易日記（${cloudData.diaryEntries.length} 筆）` });
      }
      if (Array.isArray(cloudData.holdings) && (cloudData.holdingsTs || 0) > holdingsTs && (cloudData.holdingsTs || 0) > _declinedTs.holdings &&
          JSON.stringify(window._t4_data || []) !== JSON.stringify(cloudData.holdings)) {
        pending.push({ key: "holdings", label: `持有記錄（${cloudData.holdings.length} 筆）` });
      }

      if (pending.length > 0) showCloudSyncBanner(cloudData, pending);

      // 背景報價／回測快照自動同步
      if (cloudData.stockData && cloudData.lastUpdateTime && (!lastUpdateTime || cloudData.lastUpdateTime > lastUpdateTime)) {
        stockData = cloudData.stockData;
        lastUpdateTime = cloudData.lastUpdateTime;
        bgChanged = true;
      }
      if (cloudData.finmindToken && !localStorage.getItem("finmind_token")) {
        localStorage.setItem("finmind_token", cloudData.finmindToken);
        document.getElementById("apiToken").value = cloudData.finmindToken;
      }
      if (cloudData.rankHistory) {
        const { merged, added } = mergeHistoryUnion(loadGain10History(), cloudData.rankHistory);
        if (added > 0) saveGain10History(merged);
      }
      if (cloudData.mailScoreBacktestHistory) {
        const { merged, added } = mergeHistoryUnion(loadMailScoreBacktestHistory(), cloudData.mailScoreBacktestHistory);
        if (added > 0) saveMailScoreBacktestHistory(merged);
      }
      if (cloudData.adviceBacktestHistory) {
        const { merged, added } = mergeHistoryUnion(loadAdviceBacktestHistory(), cloudData.adviceBacktestHistory);
        if (added > 0) saveAdviceBacktestHistory(merged);
      }
      if (bgChanged) { saveLocalOnly(); updateUI(true); }
    }
    if (_pendingPush) pushToCloud();
  } catch (e) {}
}

window.forceHardRefresh = async function() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) {}
  location.href = location.pathname + "?_r=" + Date.now();
};

// ==================== 本地資料儲存 ====================
function saveLocalOnly() {
  try {
    localStorage.setItem("ai_stocks_data", JSON.stringify({
      data: stockData,
      time: lastUpdateTime,
      watchlists, watchlistsTs,
      stockNotes, stockNotesTs,
      stockMeta, stockMetaTs,
      vixtwn, liveQuoteTime
    }));
    localStorage.setItem("fdc_financials_cache", JSON.stringify(financialsCache));
  } catch (e) {}
}

function saveData() {
  saveLocalOnly();
  _pendingPush = true;
  pushToCloud();
}

const HEADER_NOTE_KEY = "fdc_header_note_v1";
const HEADER_CHECKLIST_KEY = "fdc_header_checklist_v1";
const HEADER_CHECKLIST_MAX = 10;

function saveHeaderNote() {
  headerNoteTs = Date.now();
  try { localStorage.setItem(HEADER_NOTE_KEY, headerNote); localStorage.setItem("fdc_header_note_ts", headerNoteTs); } catch (e) {}
}
function loadHeaderNote() {
  try {
    const r = localStorage.getItem(HEADER_NOTE_KEY); if (r != null) headerNote = r;
    const ts = localStorage.getItem("fdc_header_note_ts"); if (ts) headerNoteTs = Number(ts);
  } catch (e) {}
}
function saveHeaderChecklist() {
  headerChecklistTs = Date.now();
  try { localStorage.setItem(HEADER_CHECKLIST_KEY, JSON.stringify(headerChecklist)); localStorage.setItem("fdc_header_checklist_ts", headerChecklistTs); } catch (e) {}
}
function loadHeaderChecklist() {
  try {
    const r = localStorage.getItem(HEADER_CHECKLIST_KEY); if (r) headerChecklist = JSON.parse(r) || [];
    const ts = localStorage.getItem("fdc_header_checklist_ts"); if (ts) headerChecklistTs = Number(ts);
  } catch (e) {}
}
function saveDailyPlan() { dailyPlanTs = Date.now(); persistDailyPlan(); }
function persistDailyPlan() {
  try { localStorage.setItem("fdc_daily_plan", JSON.stringify(dailyPlan)); localStorage.setItem("fdc_daily_plan_ts", dailyPlanTs); } catch (e) {}
}
function loadDailyPlan() {
  try {
    const r = localStorage.getItem("fdc_daily_plan"); if (r) dailyPlan = JSON.parse(r);
    const ts = localStorage.getItem("fdc_daily_plan_ts"); if (ts) dailyPlanTs = Number(ts);
  } catch (e) {}
}
function loadDiary() {
  try {
    const r = localStorage.getItem("fdc_diary"); if (r) diaryEntries = JSON.parse(r);
    const ts = localStorage.getItem("fdc_diary_ts"); if (ts) diaryTs = Number(ts);
  } catch (e) {}
}
function saveDiary() { diaryTs = Date.now(); persistDiary(); }
function persistDiary() {
  try { localStorage.setItem("fdc_diary", JSON.stringify(diaryEntries)); localStorage.setItem("fdc_diary_ts", diaryTs); } catch (e) {}
}
function loadHeatHistory() {
  try { const r = localStorage.getItem("fdc_heat_history"); if (r) heatHistory = JSON.parse(r); } catch (e) {}
}

function loadData() {
  try {
    const raw = localStorage.getItem("ai_stocks_data");
    if (raw) {
      const obj = JSON.parse(raw);
      stockData = obj.data || {};
      lastUpdateTime = obj.time;
      stockNotes = obj.stockNotes || {};
      stockMeta = obj.stockMeta || {};
      if (obj.stockNotesTs) stockNotesTs = obj.stockNotesTs;
      if (obj.stockMetaTs) stockMetaTs = obj.stockMetaTs;
      if (obj.watchlists && Object.keys(obj.watchlists).length > 0) {
        watchlists = obj.watchlists;
        if (!watchlists[currentWatchGroup]) currentWatchGroup = Object.keys(watchlists)[0];
      }
      if (obj.watchlistsTs) watchlistsTs = obj.watchlistsTs;
      if (obj.vixtwn) vixtwn = obj.vixtwn;
      if (obj.liveQuoteTime) liveQuoteTime = obj.liveQuoteTime;
    }
    const rawFin = localStorage.getItem("fdc_financials_cache");
    if (rawFin) {
      financialsCache = JSON.parse(rawFin);
      Object.entries(financialsCache).forEach(([code, f]) => {
        if (stockData[code]) {
          if (f.per != null) stockData[code].per = f.per;
          if (f.eps != null) stockData[code].eps = f.eps;
          if (f.yoy != null) stockData[code].yoy = f.yoy;
          if (f.grossMargin != null) stockData[code].grossMargin = f.grossMargin;
          if (f.opMargin != null) stockData[code].opMargin = f.opMargin;
          if (f.nonOpRatio != null) stockData[code].nonOpRatio = f.nonOpRatio;
          if (f.rev3moYoy != null) stockData[code].rev3moYoy = f.rev3moYoy;
          const tag = classify_quality(stockData[code].eps ?? null, stockData[code].per ?? null);
          stockData[code].qualityTag = stockData[code].quality_status = tag;
          stockData[code].growthTag = classify_growth_type(stockData[code]);
        }
      });
    }
    const savedToken = localStorage.getItem("finmind_token");
    if (savedToken) document.getElementById("apiToken").value = savedToken;
    const savedGhToken = localStorage.getItem("gh_dispatch_token");
    if (savedGhToken) document.getElementById("ghTriggerToken").value = savedGhToken;
    const savedRoom = localStorage.getItem("cloud_room_id");
    if (savedRoom) {
      document.getElementById("cloudRoomInput").value = savedRoom;
      setTimeout(connectCloud, 800);
    }
    loadHeatHistory();
    loadDiary();
    loadDailyPlan();
    loadHeaderNote();
    loadHeaderChecklist();
    window._t4_data = JSON.parse(localStorage.getItem("fdc_holdings") || "null") || [];
    holdingsTs = parseInt(localStorage.getItem("fdc_holdings_ts") || "0", 10) || 0;
  } catch (e) {}
}

// ==================== TradingView 連結與格式化 ====================
function getTVLink(code, market) {
  if (market === "US") {
    const entry = GLOBAL_LIST.US.find(g => g.code === code);
    const ex = entry?.ex || "NASDAQ";
    return `https://tw.tradingview.com/chart/?symbol=${ex}:${code}`;
  }
  if (market === "JP") return `https://tw.tradingview.com/chart/?symbol=TSE:${code}`;
  if (market === "KR") return `https://tw.tradingview.com/chart/?symbol=KRX:${code}`;
  const liveMkt = stockData[code]?.market;
  const liveEx = (liveMkt === "TWSE" || liveMkt === "TPEX") ? liveMkt : null;
  const twEx = MANUAL_MARKETS[code] || liveEx || STOCK_EXCHANGE[code] || market || (TPEX_CODES.has(code) ? "TPEX" : "TWSE");
  return `https://tw.tradingview.com/chart/?symbol=${twEx}:${code}`;
}

function pctClass(pct) {
  if (pct == null || isNaN(pct)) return "flat-text";
  return pct > 0 ? "pos-text" : (pct < 0 ? "neg-text" : "flat-text");
}
function fmtPct(pct) {
  return (pct == null || isNaN(pct)) ? "-" : (pct > 0 ? "+" : "") + pct.toFixed(2) + "%";
}
function vsMarketPct(code, key) {
  const s = stockData[code], m = stockData["0050"];
  if (!s || !m || s[key] == null || m[key] == null) return null;
  return s[key] - m[key];
}
function wlVsCell(v) {
  return v == null ? '<span class="flat-text">-</span>' : `<span class="${pctClass(v)}">${v > 0 ? "+" : ""}${v.toFixed(1)}%</span>`;
}
function volTrendBadge(vt) {
  if (vt == null) return '<span class="flat-text">-</span>';
  if (vt >= 1.3) return `<span class="pos-text" title="強資金流入 ${vt.toFixed(2)}x">▲</span>`;
  if (vt >= 1.1) return `<span class="pos-text" style="opacity:.8" title="資金流入 ${vt.toFixed(2)}x">↑</span>`;
  if (vt >= 0.9) return `<span class="flat-text" title="量能持平 ${vt.toFixed(2)}x">—</span>`;
  return `<span class="neg-text" title="資金流出 ${vt.toFixed(2)}x">↓</span>`;
}
function sectorFullKeyByShortName(shortName) {
  return Object.keys(SECTORS).find(k => (k.split(". ")[1] || k) === shortName);
}
function getWatchGroupsOf(code) {
  return Object.keys(watchlists).filter(g => (watchlists[g] || []).includes(code));
}

// ==================== 基本面品質與動作建議 ====================
function classify_quality(eps, per) {
  if (eps == null && per == null) return "✖️抓取失敗";
  if (eps != null && eps <= 0) return "⚫虧損";
  if (eps == null || per == null) return "❓缺財報";
  if (per > 100 || eps < 1) return "🔴題材股";
  if (eps > 3 && per >= 10 && per <= 50) return "🟢業績股";
  return "🟡普通";
}
function classify_growth_type(d) {
  if (d.grossMargin == null || d.opMargin == null || d.nonOpRatio == null || d.rev3moYoy == null || d.eps == null) return null;
  if (d.grossMargin >= 50 && d.opMargin >= 15 && d.nonOpRatio < 20 && d.rev3moYoy >= 20 && d.eps > 0) return "🚀騰雲型";
  return null;
}

function getActionAdvice(s, hdRet, hdDays = null) {
  if (s.pct5 == null || s.pct10 == null) {
    return { label: "觀察", cls: "watch", reason: "尚無5日/10日資料，請先更新報價" };
  }
  if (hdRet !== null && hdRet <= -8) {
    return { label: "減碼", cls: "sell", reason: `持有虧損 ${hdRet.toFixed(1)}%，已超過 8% 停損線` };
  }
  const crashToday = s.pct1 != null && s.pct1 <= -5;
  const momentumReversed = s.pct5 < 0 && s.pct10 < 0;
  if (crashToday || momentumReversed) {
    const reason = crashToday ? `當日重挫 ${s.pct1.toFixed(1)}%，訊號轉壞` : "5日與10日動能同步轉弱，趨勢轉空";
    if (hdRet !== null && hdRet > 0) {
      return { label: "獲利了結", cls: "profit", reason: `持有獲利 +${hdRet.toFixed(1)}%，${reason}，建議落袋為安` };
    }
    return { label: "減碼", cls: "sell", reason };
  }
  if (hdDays != null && hdDays >= 21 && hdRet !== null && hdRet < 0) {
    return { label: "過期檢視", cls: "sell", reason: `持有已達 ${hdDays} 天（超過3週原則）且仍虧損 ${hdRet.toFixed(1)}%，建議檢視是否換股` };
  }
  if (hdRet !== null && hdRet >= 15) {
    return { label: "部分停利", cls: "profit", reason: `持有獲利達 +${hdRet.toFixed(1)}%（≥15%），建議考慮分批獲利了結` };
  }
  if ((s.pct1 != null && s.pct1 >= 7) || (s.pct5 != null && s.pct5 >= 20)) {
    const why = s.pct1 >= 7 ? `當日已大漲 +${s.pct1.toFixed(1)}%` : `近5日已急漲 +${s.pct5.toFixed(1)}%`;
    return { label: "不追高", cls: "overheat", reason: `${why}，短線乖離過大（遵守不追高紀律，等拉回確認支撐）` };
  }
  if (s.pct10 >= 3 && s.pct5 > 0 && (s.pct1 ?? 0) > -2 && (s.volTrend ?? 1) >= 1.0) {
    return { label: "加碼", cls: "buy", reason: "10日趨勢強、5日動能延續、量能未萎縮且未過熱" };
  }
  if (s.pct5 < 0) {
    return { label: "觀察", cls: "watch", reason: "5日動能轉負但10日趨勢仍在，等待回穩" };
  }
  return { label: "觀察", cls: "watch", reason: "動能不足或漲幅未達加碼門檻，持續觀察" };
}

function medianOf(arr) {
  const nums = arr.filter(v => typeof v === "number" && !isNaN(v)).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function calcSectorStats() {
  const stats = {};
  const market = stockData["0050"] || { pct1: 0, pct5: 0, pct10: 0 };
  Object.entries(SECTORS).forEach(([sector, stocks]) => {
    const valid = stocks.filter(s => stockData[s.code] && stockData[s.code].price != null);
    if (valid.length === 0) { stats[sector] = null; return; }
    const sum = (key) => valid.reduce((a, s) => a + (stockData[s.code][key] || 0), 0);
    const med = (key) => medianOf(valid.map(s => stockData[s.code][key]).filter(v => v != null));
    // 用中位數取代單純算術平均，避免族群內單一極端飆股拉高整組造成假強勢
    const pct1 = med("pct1"), pct5 = med("pct5"), pct10 = med("pct10");
    const volTrendMed = parseFloat((med("volTrend") || 1).toFixed(3));
    const up5Count = valid.filter(s => (stockData[s.code].pct5 ?? 0) > 0).length;
    stats[sector] = {
      pct1, pct5, pct10,
      vsMarket10: pct10 - (market.pct10 || 0),
      amount: sum("amount"),
      volTrend: volTrendMed,
      up5Count,
      breadth5: up5Count / valid.length,
      count: valid.length,
      total: stocks.length
    };
  });
  return stats;
}

// ==================== 族群熱度歷史走勢 ====================
function recordHeatSnapshot() {
  if (!Object.keys(stockData).length) return;
  const today = new Date().toISOString().slice(0, 10);
  const sectors = Object.entries(SECTORS).map(([name, stocks]) => {
    const wd = stocks.map(st => stockData[st.code]).filter(d => d && d.price != null);
    if (!wd.length) return null;
    const p10 = wd.reduce((s, d) => s + (d.pct10 || 0), 0) / wd.length;
    const p5 = wd.reduce((s, d) => s + (d.pct5 || 0), 0) / wd.length;
    const amt = wd.reduce((s, d) => s + (d.amount || 0), 0);
    return { name, p10, p5, amt };
  }).filter(Boolean);
  if (!sectors.length) return;
  const maxAmt = Math.max(...sectors.map(s => s.amt), 1);
  const scores = {};
  sectors.forEach(s => { scores[s.name] = +(s.p10 * 0.5 + s.p5 * 0.3 + (s.amt / maxAmt * 10) * 0.2).toFixed(2); });
  heatHistory[today] = scores;
  const keys = Object.keys(heatHistory).sort();
  if (keys.length > 15) keys.slice(0, keys.length - 15).forEach(k => delete heatHistory[k]);
  try { localStorage.setItem("fdc_heat_history", JSON.stringify(heatHistory)); } catch (e) {}
}

function renderHeatSparkline(sectorName) {
  const days = Object.keys(heatHistory).sort().slice(-10);
  if (days.length < 2) return "";
  const vals = days.map(d => (heatHistory[d] || {})[sectorName] ?? null);
  const defined = vals.filter(v => v !== null);
  if (defined.length < 2) return "";
  const W = 58, H = 20, pad = 2;
  const min = Math.min(...defined), max = Math.max(...defined);
  const range = max - min || 0.01;
  const toXY = (i, v) => [
    (pad + i / (days.length - 1) * (W - 2 * pad)).toFixed(1),
    (pad + (1 - (v - min) / range) * (H - 2 * pad)).toFixed(1)
  ];
  let d = "";
  vals.forEach((v, i) => { if (v === null) return; const [x, y] = toXY(i, v); d += d ? `L${x},${y}` : `M${x},${y}`; });
  const pts = vals.map((v, i) => ({ v, i })).filter(({ v }) => v !== null);
  const up = pts.length >= 2 && pts[pts.length - 1].v >= pts[pts.length - 2].v;
  const col = up ? "var(--up)" : "var(--down)";
  const [lx, ly] = toXY(pts[pts.length - 1].i, pts[pts.length - 1].v);
  return `<svg width="${W}" height="${H}" style="overflow:visible;vertical-align:middle" title="${_dEsc(sectorName)} 近${days.length}日熱度走勢">
    <path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lx}" cy="${ly}" r="2.5" fill="${col}"/>
  </svg>`;
}

// ==================== 大盤曝險檢查表（凱利公式） ====================
const LEVERAGE_CHECKLIST_KEY = "fdc_leverage_checklist_v1";
const LEVERAGE_CHECKLIST_DEFAULTS = {
  expectedAnnualReturn: 10,
  volatility: 20,
  costOfCapital: 2.5,
  goldenPointRatio: 0.625,
  currentIndexPoint: null,
  note: "",
  checklist: [
    { label: "去槓桿／再平衡", point: 54000, leverage: 1.6 },
    { label: "半凱利區", point: 49000, leverage: 1.6 },
    { label: "黃金點區", point: 45500, leverage: 2 },
    { label: "全凱利區", point: 36500, leverage: 3 }
  ]
};
function loadLeverageChecklist() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEVERAGE_CHECKLIST_KEY) || "{}");
    return {
      ...JSON.parse(JSON.stringify(LEVERAGE_CHECKLIST_DEFAULTS)),
      ...saved,
      checklist: Array.isArray(saved.checklist) && saved.checklist.length ? saved.checklist : JSON.parse(JSON.stringify(LEVERAGE_CHECKLIST_DEFAULTS.checklist))
    };
  } catch (e) { return JSON.parse(JSON.stringify(LEVERAGE_CHECKLIST_DEFAULTS)); }
}
function saveLeverageChecklist() { try { localStorage.setItem(LEVERAGE_CHECKLIST_KEY, JSON.stringify(leverageChecklist)); } catch (e) {} }
let leverageChecklist = loadLeverageChecklist();
let leverageChecklistOpen = false;

function computeKellyTiers(cfg) {
  const mu = cfg.expectedAnnualReturn / 100, cost = cfg.costOfCapital / 100, sigma = cfg.volatility / 100;
  const full = sigma > 0 ? (mu - cost) / (sigma * sigma) : 0;
  return { full, half: full / 2, golden: full * cfg.goldenPointRatio };
}
function resolveLeverageZone(cfg) {
  if (cfg.currentIndexPoint == null || !cfg.checklist.length) return { row: null, outOfRange: false };
  const sorted = [...cfg.checklist].sort((a, b) => a.point - b.point);
  const hit = sorted.find(row => cfg.currentIndexPoint <= row.point);
  if (hit) return { row: hit, outOfRange: false };
  return { row: sorted[sorted.length - 1], outOfRange: true };
}
function updateLeverageParam(field, rawVal) {
  const val = rawVal === "" ? null : parseFloat(rawVal);
  if (val !== null && isNaN(val)) return;
  leverageChecklist[field] = val;
  saveLeverageChecklist();
  renderStrategy();
}
function updateLeverageNote(rawVal) { leverageChecklist.note = rawVal; saveLeverageChecklist(); }
function updateLeverageRow(idx, field, rawVal) {
  const row = leverageChecklist.checklist[idx];
  if (!row) return;
  if (field === "label") row.label = rawVal;
  else { const val = parseFloat(rawVal); if (isNaN(val)) return; row[field] = val; }
  saveLeverageChecklist();
  renderStrategy();
}
function addLeverageRow() { leverageChecklist.checklist.push({ label: "新檔位", point: 0, leverage: 1 }); saveLeverageChecklist(); renderStrategy(); }
function removeLeverageRow(idx) { leverageChecklist.checklist.splice(idx, 1); saveLeverageChecklist(); renderStrategy(); }
function resetLeverageChecklist() { leverageChecklist = JSON.parse(JSON.stringify(LEVERAGE_CHECKLIST_DEFAULTS)); saveLeverageChecklist(); renderStrategy(); }

// ==================== 收件匣評分、名次歷史與回測引擎 ====================
const STOCK_GAIN10_HISTORY_KEY = "fdc_stock_gain10_rank_history_v1";
const MAIL_SCORE_PARAMS_KEY = "fdc_mail_score_params_v1";
const MAIL_SCORE_BACKTEST_KEY = "fdc_mail_score_backtest_history_v1";
const MAIL_SCORE_BACKTEST_MAX_DAYS = 150;
const ADVICE_BACKTEST_KEY = "fdc_advice_backtest_history_v1";
const ADVICE_BACKTEST_MAX_DAYS = 150;

const MAIL_SCORE_DEFAULTS = {
  elimReturn5dMin: 5.0, elimReturn5dBuffer: 2.0, elimRankDropMax: 5, elimRankDropBuffer: 2,
  rankMaDays: 3, rankLevelBase: 22, rankLevelMult: 2, rankLevelCutoffRank: 10, rankLevelFloorScore: 1,
  rankDeltaWeight: 0.4, rankDeltaCapUp: 4, rankDeltaCapDown: 4,
  accelPriorMinReturn: 5, accelBreaks: [1.2, 0.9, 0.65, 0.4], accelScores: [20, 14, 8, 3, -5],
  accelFreshBreakoutFloor: -3, accelFreshBreakoutMinReturn5d: 8, accelFreshBreakoutScore: 8,
  sectorScoreCap: 10, sectorScoreHalfLife: 1.5, sectorMatchMode: "all",
  normalizeMethod: "minmax", weightRank: 50, weightAccel: 30, weightSector: 20,
  backtestTopK: 5, backtestForwardMinOffset: 3, backtestForwardMaxOffset: 5
};

function loadMailScoreParams() {
  try {
    const saved = JSON.parse(localStorage.getItem(MAIL_SCORE_PARAMS_KEY) || "{}");
    const isOldDefaultBreaks = Array.isArray(saved.accelBreaks) && JSON.stringify(saved.accelBreaks) === JSON.stringify([0.45, 0.35, 0.25, 0.15]);
    return {
      ...MAIL_SCORE_DEFAULTS, ...saved,
      accelBreaks: (!saved.accelBreaks || isOldDefaultBreaks) ? [...MAIL_SCORE_DEFAULTS.accelBreaks] : saved.accelBreaks,
      accelScores: saved.accelScores || [...MAIL_SCORE_DEFAULTS.accelScores]
    };
  } catch (e) { return JSON.parse(JSON.stringify(MAIL_SCORE_DEFAULTS)); }
}
function saveMailScoreParams(params) { localStorage.setItem(MAIL_SCORE_PARAMS_KEY, JSON.stringify(params)); }
let mailScoreParams = loadMailScoreParams();
let mailScorePanelOpen = false;
let backtestPanelOpen = false;
let mailUiState = { inboxOpen: false, scoreSort: "default" };

function loadGain10History() { try { return JSON.parse(localStorage.getItem(STOCK_GAIN10_HISTORY_KEY) || "{}"); } catch (e) { return {}; } }
function saveGain10History(history) {
  const dates = Object.keys(history).sort();
  while (dates.length > 60) delete history[dates.shift()];
  localStorage.setItem(STOCK_GAIN10_HISTORY_KEY, JSON.stringify(history));
}
function mergeHistoryUnion(local, cloud) {
  if (!cloud) return { merged: local, added: 0 };
  const merged = { ...local };
  let added = 0;
  Object.keys(cloud).forEach(date => { if (!(date in merged)) { merged[date] = cloud[date]; added++; } });
  return { merged, added };
}
function loadMailScoreBacktestHistory() { try { return JSON.parse(localStorage.getItem(MAIL_SCORE_BACKTEST_KEY) || "{}"); } catch (e) { return {}; } }
function saveMailScoreBacktestHistory(history) {
  const dates = Object.keys(history).sort();
  while (dates.length > MAIL_SCORE_BACKTEST_MAX_DAYS) delete history[dates.shift()];
  try { localStorage.setItem(MAIL_SCORE_BACKTEST_KEY, JSON.stringify(history)); } catch (e) {}
}
function loadAdviceBacktestHistory() { try { return JSON.parse(localStorage.getItem(ADVICE_BACKTEST_KEY) || "{}"); } catch (e) { return {}; } }
function saveAdviceBacktestHistory(history) {
  const dates = Object.keys(history).sort();
  while (dates.length > ADVICE_BACKTEST_MAX_DAYS) delete history[dates.shift()];
  try { localStorage.setItem(ADVICE_BACKTEST_KEY, JSON.stringify(history)); } catch (e) {}
}
function getPureAdviceLabel(s) {
  if (s.pct5 == null || s.pct10 == null) return null;
  if ((s.pct1 != null && s.pct1 <= -5) || (s.pct5 < 0 && s.pct10 < 0)) return "減碼";
  if ((s.pct1 != null && s.pct1 >= 7) || (s.pct5 != null && s.pct5 >= 20)) return "不追高";
  if (s.pct10 >= 3 && s.pct5 > 0 && (s.pct1 ?? 0) > -2 && (s.volTrend ?? 1) >= 1.0) return "加碼";
  return "觀察";
}
function saveAdviceBacktestSnapshot(date) {
  if (!Object.keys(stockData).length) return;
  const history = loadAdviceBacktestHistory();
  const watchedCodes = new Set(Object.values(watchlists).flat());
  const entries = {};
  Object.entries(stockData).forEach(([code, d]) => {
    if (code === "0050" || !d || typeof d.price !== "number") return;
    const label = getPureAdviceLabel(d);
    if (!label) return;
    entries[code] = { price: d.price, label, watched: watchedCodes.has(code) };
  });
  if (!Object.keys(entries).length) return;
  const benchmark = (stockData["0050"] && typeof stockData["0050"].price === "number") ? stockData["0050"].price : null;
  history[date] = { entries, benchmark };
  saveAdviceBacktestHistory(history);
}
function saveMailScoreBacktestSnapshot(date, scored) {
  const history = loadMailScoreBacktestHistory();
  const top20Entry = {};
  scored.forEach(s => {
    if (!s.inScope || s.incomplete || typeof s.price !== "number") return;
    top20Entry[s.code] = { rank: s.rank, price: s.price, pct5: s.pct5, total: s.total };
  });
  const universe = {};
  Object.entries(stockData).forEach(([code, d]) => {
    if (code === "0050" || !d || d.market === "US" || typeof d.price !== "number") return;
    universe[code] = d.price;
  });
  const benchmark = (stockData["0050"] && typeof stockData["0050"].price === "number") ? stockData["0050"].price : null;
  history[date] = { top20: top20Entry, universe, benchmark };
  saveMailScoreBacktestHistory(history);
}

function mailPct(v) { return (v == null || isNaN(v)) ? "-" : (v >= 0 ? "+" : "") + v.toFixed(1) + "%"; }
function mailEliminationWeight(s, params) {
  if (s.incomplete) return { weight: 0, reasons: [] };
  const reasons = [];
  const safe5d = params.elimReturn5dMin + params.elimReturn5dBuffer;
  let w5d = 1;
  if (s.pct5 <= params.elimReturn5dMin) { w5d = 0; reasons.push(`5日漲幅 ${mailPct(s.pct5)} ≤ ${params.elimReturn5dMin}%（完全淘汰）`); }
  else if (s.pct5 < safe5d) {
    w5d = (s.pct5 - params.elimReturn5dMin) / params.elimReturn5dBuffer;
    reasons.push(`5日漲幅 ${mailPct(s.pct5)} 接近門檻 ${params.elimReturn5dMin}%，打折 ×${w5d.toFixed(2)}`);
  }
  let wRank = 1;
  if (!s.isNew && s.rankChange != null && s.rankChange < 0) {
    const drop = Math.abs(s.rankChange);
    const softStart = params.elimRankDropMax - params.elimRankDropBuffer;
    if (drop >= params.elimRankDropMax) { wRank = 0; reasons.push(`名次退步 ${drop} ≥ ${params.elimRankDropMax}名（完全淘汰）`); }
    else if (drop > softStart) {
      wRank = (params.elimRankDropMax - drop) / params.elimRankDropBuffer;
      reasons.push(`名次退步 ${drop} 接近門檻 ${params.elimRankDropMax}名，打折 ×${wRank.toFixed(2)}`);
    }
  }
  return { weight: Math.min(w5d, wRank), reasons };
}
function computeRankMovingAverages(top20, history, snapshotDate, rankMaDays) {
  const sortedDates = Object.keys(history).sort();
  const todayIdx = sortedDates.indexOf(snapshotDate);
  const result = {};
  top20.forEach(s => {
    const vals = [];
    for (let i = todayIdx; i >= 0 && vals.length < rankMaDays; i--) {
      const r = history[sortedDates[i]] && history[sortedDates[i]][s.code];
      if (r == null) break;
      vals.push(r);
    }
    result[s.code] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
  return result;
}
function makeMailScoreNormalizer(values, method) {
  if (!values.length) return () => 0.5;
  if (method === "zscore") {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length);
    return v => std > 1e-9 ? (v - mean) / std : 0;
  }
  const min = Math.min(...values), max = Math.max(...values), range = max - min;
  return v => range > 1e-9 ? (v - min) / range : 0.5;
}
function computeWeightedScores(top20, prevRanks, params, scopeLimit, rankMaLookup) {
  params = params || mailScoreParams;
  scopeLimit = scopeLimit == null ? 20 : scopeLimit;
  rankMaLookup = rankMaLookup || {};
  const base = top20.map((s, i) => {
    const rank = i + 1;
    const inScope = rank <= scopeLimit;
    const isNew = !(s.code in prevRanks);
    const rankChange = isNew ? null : (prevRanks[s.code] - rank);
    const sectors = STOCK_SECTORS_MAP[s.code] || [];
    const incomplete = s.pct5 == null || isNaN(s.pct5);
    const rankMa = rankMaLookup[s.code] != null ? rankMaLookup[s.code] : rank;
    const { weight, reasons } = (inScope && !incomplete) ? mailEliminationWeight({ ...s, isNew, rankChange, incomplete }, params) : { weight: 0, reasons: [] };
    return { ...s, rank, inScope, isNew, rankChange, sectors, incomplete, rankMa, eliminatedReasons: reasons, qualifiedWeight: weight, isEliminated: inScope && weight <= 0 };
  });
  const pool = base.filter(s => s.inScope && !s.incomplete && s.qualifiedWeight > 0);
  const groupSectors = s => params.sectorMatchMode === "primary" ? (s.sectors.length ? [s.sectors[0]] : []) : s.sectors;
  const sectorCount = {};
  pool.forEach(s => groupSectors(s).forEach(sec => { sectorCount[sec] = (sectorCount[sec] || 0) + 1; }));

  const raw = pool.map(s => {
    const rankLevelScore = s.rankMa <= params.rankLevelCutoffRank ? (params.rankLevelBase - params.rankLevelMult * s.rankMa) : params.rankLevelFloorScore;
    let rankDeltaScore = 0;
    if (!s.isNew && s.rankChange) {
      rankDeltaScore = s.rankChange > 0
        ? Math.min(params.rankDeltaWeight * s.rankChange, params.rankDeltaCapUp)
        : -Math.min(params.rankDeltaWeight * Math.abs(s.rankChange), params.rankDeltaCapDown);
    }
    const rankScore = rankLevelScore + rankDeltaScore;

    let accelScore = 0, accelNA = false, accelNote = "";
    if (s.close5Ref == null || !s.close10Ref) {
      accelNA = true; accelNote = "缺少前一個5日參考價，資料不全";
    } else {
      const prior5 = ((s.close5Ref - s.close10Ref) / s.close10Ref) * 100;
      const recent5 = s.pct5;
      if (prior5 <= params.accelPriorMinReturn) {
        accelNA = true;
        if (prior5 > params.accelFreshBreakoutFloor && recent5 != null && recent5 >= params.accelFreshBreakoutMinReturn5d) {
          accelScore = params.accelFreshBreakoutScore;
          accelNote = `前一個5日報酬 ${prior5.toFixed(1)}%（盤整未破底）＋近5日 ${recent5.toFixed(1)}%（噴出）→ 新鮮起漲基本分`;
        } else {
          accelNote = `前一個5日報酬 ${prior5.toFixed(1)}% 太小或為負，加速度不適用`;
        }
      } else {
        const ratio = recent5 / prior5;
        const [b1, b2, b3, b4] = params.accelBreaks;
        const [v1, v2, v3, v4, v5] = params.accelScores;
        accelScore = ratio >= b1 ? v1 : ratio >= b2 ? v2 : ratio >= b3 ? v3 : ratio >= b4 ? v4 : v5;
      }
    }
    const density = groupSectors(s).length ? Math.max(...groupSectors(s).map(sec => sectorCount[sec] || 0)) : 0;
    const sectorScore = density <= 1 ? 0 : params.sectorScoreCap * (density - 1) / (density - 1 + params.sectorScoreHalfLife);
    return { code: s.code, rankLevelScore, rankDeltaScore, rankScore, accelScore, accelNA, accelNote, sectorScore, sectorDensity: density };
  });

  const normRank = makeMailScoreNormalizer(raw.map(r => r.rankScore), params.normalizeMethod);
  const normAccel = makeMailScoreNormalizer(raw.map(r => r.accelScore), params.normalizeMethod);
  const normSector = makeMailScoreNormalizer(raw.map(r => r.sectorScore), params.normalizeMethod);
  const rawByCode = {};
  raw.forEach(r => { rawByCode[r.code] = r; });

  return base.map(s => {
    const r = rawByCode[s.code];
    if (!s.inScope || s.incomplete || s.isEliminated || !r) {
      return { ...s, rankScore: 0, rankLevelScore: 0, rankDeltaScore: 0, accelScore: 0, accelNA: true, accelNote: "", sectorScore: 0, sectorDensity: 0, normRankScore: 0, normAccelScore: 0, normSectorScore: 0, rawTotal: 0, total: 0 };
    }
    const nRank = normRank(r.rankScore), nAccel = normAccel(r.accelScore), nSector = normSector(r.sectorScore);
    const rawTotal = nRank * params.weightRank + nAccel * params.weightAccel + nSector * params.weightSector;
    const total = Math.round(rawTotal * s.qualifiedWeight * 10) / 10;
    return { ...s, ...r, normRankScore: nRank, normAccelScore: nAccel, normSectorScore: nSector, rawTotal: Math.round(rawTotal * 10) / 10, total };
  });
}

function mailScoreAvg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
function computeBacktestReport(params) {
  params = params || mailScoreParams;
  const history = loadMailScoreBacktestHistory();
  const dates = Object.keys(history).sort();
  const days = [];
  dates.forEach((date, idx) => {
    const today = history[date];
    const top20Codes = Object.keys(today.top20 || {});
    if (!top20Codes.length) return;
    let futureIdx = null;
    for (let off = params.backtestForwardMinOffset; off <= params.backtestForwardMaxOffset; off++) {
      if (idx + off < dates.length) { futureIdx = idx + off; break; }
    }
    if (futureIdx == null) return;
    const future = history[dates[futureIdx]];
    if (!future.universe) return;
    const top20Rows = top20Codes
      .filter(code => today.top20[code].price > 0 && future.universe[code] != null)
      .map(code => ({ code, total: today.top20[code].total, pct5: today.top20[code].pct5, fwdReturn: ((future.universe[code] - today.top20[code].price) / today.top20[code].price) * 100 }));
    if (top20Rows.length < 3) return;
    const restReturns = Object.keys(today.universe || {})
      .filter(code => !today.top20[code] && today.universe[code] > 0 && future.universe[code] != null)
      .map(code => ((future.universe[code] - today.universe[code]) / today.universe[code]) * 100);
    const avgWeighted = mailScoreAvg([...top20Rows].sort((a, b) => b.total - a.total).slice(0, params.backtestTopK).map(r => r.fwdReturn));
    const avgPct5 = mailScoreAvg([...top20Rows].sort((a, b) => b.pct5 - a.pct5).slice(0, params.backtestTopK).map(r => r.fwdReturn));
    const avgAllTop20 = mailScoreAvg(top20Rows.map(r => r.fwdReturn));
    const avgRest = restReturns.length ? mailScoreAvg(restReturns) : null;
    let benchmarkFwd = null;
    if (typeof today.benchmark === "number" && today.benchmark > 0 && typeof future.benchmark === "number") {
      benchmarkFwd = ((future.benchmark - today.benchmark) / today.benchmark) * 100;
    }
    days.push({
      date, futureDate: dates[futureIdx], top20Sample: top20Rows.length, restSample: restReturns.length,
      avgFwdReturnWeightedTopK: +avgWeighted.toFixed(2), avgFwdReturnPct5TopK: +avgPct5.toFixed(2),
      avgFwdReturnAllTop20: +avgAllTop20.toFixed(2), avgFwdReturnRestOfMarket: avgRest != null ? +avgRest.toFixed(2) : null,
      avgFwdReturnBenchmark: benchmarkFwd != null ? +benchmarkFwd.toFixed(2) : null,
      weightedBeatsPct5: avgWeighted > avgPct5, top20BeatsRest: avgRest != null ? avgAllTop20 > avgRest : null,
      weightedBeatsBenchmark: benchmarkFwd != null ? avgWeighted > benchmarkFwd : null,
      top20BeatsBenchmark: benchmarkFwd != null ? avgAllTop20 > benchmarkFwd : null
    });
  });
  if (!days.length) {
    return { ready: false, note: `快照資料還不足以回測：需要累積到「未來第${params.backtestForwardMinOffset}~${params.backtestForwardMaxOffset}筆快照」才能算未來報酬。`, days: [] };
  }
  const rateOf = key => { const known = days.filter(d => d[key] != null); return known.length ? +((known.filter(d => d[key] === true).length / known.length) * 100).toFixed(1) : null; };
  const meanOf = key => { const vals = days.map(d => d[key]).filter(v => v != null); return vals.length ? +mailScoreAvg(vals).toFixed(2) : null; };
  return {
    ready: true, sampleDays: days.length,
    summary: {
      avgFwdReturnWeightedTopK: meanOf("avgFwdReturnWeightedTopK"), avgFwdReturnPct5TopK: meanOf("avgFwdReturnPct5TopK"),
      avgFwdReturnAllTop20: meanOf("avgFwdReturnAllTop20"), avgFwdReturnRestOfMarket: meanOf("avgFwdReturnRestOfMarket"),
      avgFwdReturnBenchmark: meanOf("avgFwdReturnBenchmark"), weightedVsPct5WinRate: rateOf("weightedBeatsPct5"),
      top20VsRestWinRate: rateOf("top20BeatsRest"), weightedVsBenchmarkWinRate: rateOf("weightedBeatsBenchmark"),
      top20VsBenchmarkWinRate: rateOf("top20BeatsBenchmark")
    },
    note: "基準1＝近5日報酬排序前K名；基準2＝前20整體 vs 其餘個股；大盤基準＝0050。",
    days
  };
}

// 解耦版 computeGain10Snapshot：快取計算結果，只有 persist=true 時才寫快照到 localStorage
function computeGain10Snapshot(persist = false) {
  const cacheKey = `${lastUpdateTime}|${liveQuoteTime}|${JSON.stringify(mailScoreParams)}`;
  if (!persist && _cachedGain10Snapshot && _cachedGain10Key === cacheKey) return _cachedGain10Snapshot;

  const trackedCodes = new Set(Object.keys(STOCK_NAMES));
  Object.values(watchlists).forEach(list => list.forEach(c => trackedCodes.add(c)));
  const top20 = Object.entries(stockData)
    .filter(([code, d]) => code !== "0050" && d && d.market !== "US" && typeof d.pct10 === "number" && trackedCodes.has(code))
    .map(([code, d]) => ({
      code, name: STOCK_NAMES[code] || stockMeta[code]?.name || code,
      price: d.price, pct10: d.pct10, pct5: d.pct5, pct1: d.pct1, market: d.market,
      close5Ref: d.close5Ref, close10Ref: d.close10Ref, newHigh: d.newHigh, newHighDays: d.newHighDays,
      newHighLive: d.newHighLive, growthTag: d.growthTag, grossMargin: d.grossMargin, opMargin: d.opMargin,
      nonOpRatio: d.nonOpRatio, rev3moYoy: d.rev3moYoy, eps: d.eps
    }))
    .sort((a, b) => b.pct10 - a.pct10)
    .slice(0, 20);

  if (!top20.length) return { top20: [], prevRanks: {}, scored: [] };

  const snapshotDate = (lastUpdateTime ? new Date(lastUpdateTime) : new Date()).toISOString().slice(0, 10);
  const history = loadGain10History();
  const isNewSnapshotDay = !(snapshotDate in history);
  const priorDates = Object.keys(history).filter(d => d < snapshotDate).sort();
  const prevRanks = priorDates.length ? history[priorDates[priorDates.length - 1]] : {};

  const currentRanks = {};
  top20.forEach((s, i) => { currentRanks[s.code] = i + 1; });
  history[snapshotDate] = currentRanks;
  if (persist || isNewSnapshotDay) saveGain10History(history);

  const rankMaLookup = computeRankMovingAverages(top20, history, snapshotDate, mailScoreParams.rankMaDays);
  const scored = computeWeightedScores(top20, prevRanks, mailScoreParams, 20, rankMaLookup);

  if (persist || isNewSnapshotDay) {
    saveMailScoreBacktestSnapshot(snapshotDate, scored);
    saveAdviceBacktestSnapshot(snapshotDate);
    if (isNewSnapshotDay) { _pendingPush = true; pushToCloud(); }
  }

  _cachedGain10Snapshot = { top20, prevRanks, scored, rankMaLookup };
  _cachedGain10Key = cacheKey;
  return _cachedGain10Snapshot;
}

// ==================== FinMind / TWSE / TPEX / Quotes 抓取邏輯 ====================
async function fetchFinMindData() {
  const token = document.getElementById("apiToken").value.trim();
  const btn = document.getElementById("fetchFinMindBtn");
  const btnTop = document.getElementById("fetchFinMindBtnTop");
  const statusEl = document.getElementById("fetchStatus");
  const progContainer = document.getElementById("progressContainer");
  const progBar = document.getElementById("progressBar");

  const twCodes = Object.keys(STOCK_NAMES);
  if (!twCodes.includes("0050")) twCodes.unshift("0050");
  const allWatchlistCodes = Object.values(watchlists).flat();
  const fetchList = [...new Set([...twCodes, ...allWatchlistCodes])];

  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 100);
  const start_date = pastDate.toISOString().split("T")[0];

  if (btn) btn.disabled = true;
  if (btnTop) btnTop.disabled = true;
  progContainer.style.display = "block";

  let successCount = 0;
  let rateLimitHit = false;
  for (let i = 0; i < fetchList.length; i++) {
    const code = fetchList[i];
    const isUS = /^[A-Z]+$/.test(code);
    statusEl.textContent = `抓取中: ${code} (${i + 1}/${fetchList.length})...`;
    progBar.style.width = `${((i + 1) / fetchList.length) * 100}%`;

    let market = isUS ? "US" : (MANUAL_MARKETS[code] || STOCK_EXCHANGE[code] || null);
    if (!isUS && !market) {
      try {
        const infoUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&data_id=${code}${token ? "&token=" + token : ""}`;
        const infoJson = await (await fetch(infoUrl)).json();
        const infoType = infoJson?.data?.[0]?.type;
        if (infoType === "tpex") market = "TPEX";
        else if (infoType === "twse") market = "TWSE";
        const infoName = infoJson?.data?.[0]?.stock_name;
        if (infoName && !STOCK_NAMES[code]) {
          stockMeta[code] = { ...(stockMeta[code] || {}), name: infoName };
          stockMetaTs = Date.now();
        }
      } catch (e) {}
    }
    if (!isUS && !market) market = "TWSE";

    const dataset = isUS ? "USStockPrice" : "TaiwanStockPrice";
    let url = `https://api.finmindtrade.com/api/v4/data?dataset=${dataset}&data_id=${code}&start_date=${start_date}`;
    if (token) url += `&token=${token}`;

    try {
      const json = await (await fetch(url)).json();
      if (json.status === 402 || json.status === 429 || (json.msg && json.msg !== "success" && /limit|over|too.?many|exceed/i.test(json.msg))) {
        rateLimitHit = true;
      }
      if (json.msg === "success" && json.data && json.data.length > 0) {
        const data = json.data, latest = data[data.length - 1];
        const getClose = off => { const idx = data.length - 1 - off; return idx >= 0 ? data[idx].close : latest.close; };
        const price = latest.close;
        const pct1 = getClose(1) ? ((price - getClose(1)) / getClose(1)) * 100 : 0;
        const pct5 = getClose(5) ? ((price - getClose(5)) / getClose(5)) * 100 : 0;
        const pct10 = getClose(10) ? ((price - getClose(10)) / getClose(10)) * 100 : 0;
        const getVol = off => { const idx = data.length - 1 - off; return idx >= 0 ? (data[idx].Trading_Volume || 0) : 0; };
        const vol5 = (getVol(0) + getVol(1) + getVol(2) + getVol(3) + getVol(4)) / 5;
        let volBase = 0;
        if (data.length >= 20) {
          for (let k = 0; k < 20; k++) volBase += getVol(k);
          volBase /= 20;
        } else {
          volBase = (getVol(5) + getVol(6) + getVol(7) + getVol(8) + getVol(9)) / 5;
        }
        const volTrend = volBase > 0 ? parseFloat((vol5 / volBase).toFixed(3)) : 1;
        const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
        const latestIsToday = latest.date === todayStr;
        const close5Ref = latestIsToday ? getClose(5) : getClose(4);
        const close10Ref = latestIsToday ? getClose(10) : getClose(9);
        const priorCloses = data.slice(0, -1).map(d => d.close).filter(c => typeof c === "number");
        const newHighDays = priorCloses.length;
        const priorHigh = newHighDays > 0 ? Math.max(...priorCloses) : null;
        const newHigh = priorHigh != null && price > priorHigh;
        // 成交金額（億元）：優先用 FinMind 官方 Trading_money(元)/1e8，無則用 price * 成交股數 / 1e8（修正原本多 10 倍的單位錯誤）
        const rawMoney = (typeof latest.Trading_money === "number" && latest.Trading_money > 0)
          ? latest.Trading_money
          : (price * (latest.Trading_Volume || 0));

        stockData[code] = {
          ...(stockData[code] || {}),
          price, pct1: parseFloat(pct1.toFixed(2)), pct5: parseFloat(pct5.toFixed(2)), pct10: parseFloat(pct10.toFixed(2)),
          amount: parseFloat((rawMoney / 1e8).toFixed(2)),
          volTrend, market, close5Ref: close5Ref || null, close10Ref: close10Ref || null,
          newHigh, newHighDays, priorHigh, newHighLive: false
        };
        successCount++;
      }
    } catch (e) {}
    if (!token) await new Promise(r => setTimeout(r, 250));
  }
  lastUpdateTime = new Date().toISOString();
  saveData();
  updateUI(true);
  if (successCount === 0 && rateLimitHit) {
    statusEl.textContent = "⚠️ FinMind 超出免費限額（每日約600次），請明天再試或在設定填入 token";
    showToast("FinMind 超出免費限額", "warn");
  } else if (successCount === 0) {
    statusEl.textContent = "⚠️ 更新完成，共 0 檔（API 無回應，請確認網路或 token）";
    showToast("盤後更新未取得資料", "error");
  } else {
    statusEl.textContent = `盤後更新完成，共 ${successCount} 檔`;
    showToast(`盤後更新完成（${successCount} 檔）`, "success");
  }
  if (btn) btn.disabled = false;
  if (btnTop) btnTop.disabled = false;
  setTimeout(() => { progContainer.style.display = "none"; statusEl.textContent = ""; }, 5000);
}

async function fetchLiveQuotes() {
  try {
    const res = await fetch(`${QUOTES_URL}?t=${Date.now()}`);
    if (!res.ok) return;
    const json = await res.json();
    if (!json.quotes) return;
    Object.entries(json.quotes).forEach(([code, q]) => {
      const prev = stockData[code] || {};
      const close5Ref = q.close5Ref ?? prev.close5Ref ?? null;
      const close10Ref = q.close10Ref ?? prev.close10Ref ?? null;
      const pct5 = q.pct5 != null ? q.pct5 : (close5Ref ? parseFloat((((q.price - close5Ref) / close5Ref) * 100).toFixed(2)) : prev.pct5);
      const pct10 = q.pct10 != null ? q.pct10 : (close10Ref ? parseFloat((((q.price - close10Ref) / close10Ref) * 100).toFixed(2)) : prev.pct10);
      const priorHigh = q.priorHigh ?? prev.priorHigh ?? null;
      const newHighDays = q.newHighDays ?? prev.newHighDays ?? null;
      const newHighLive = q.newHigh != null ? Boolean(q.newHigh) : (priorHigh != null && q.price > priorHigh);
      stockData[code] = {
        ...prev,
        price: q.price,
        pct1: q.pct1,
        pct5,
        pct10,
        amount: q.amount,
        market: q.market,
        volTrend: q.volTrend ?? prev.volTrend,
        close5Ref,
        close10Ref,
        priorHigh,
        newHighDays,
        newHigh: q.newHigh != null ? Boolean(q.newHigh) : prev.newHigh,
        newHighLive
      };
    });
    if (json.vixtwn) vixtwn = json.vixtwn;
    liveQuoteTime = json.updated;
    updateUI(true);
  } catch (e) { console.error("即時報價更新失敗", e); }
}

async function fetchBulkPER(statusEl) {
  const today = new Date();
  const pad = n => String(n).padStart(2, "0");
  const priceMap = {}, perMap = {}, result = {};

  const tryTWSEPrice = async () => {
    const urls = [
      "https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json",
      ...Array.from({ length: 5 }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() - i);
        return `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json&date=${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      })
    ];
    for (const url of urls) {
      try {
        const j = await fetch(url).then(r => r.json());
        if (j.stat === "OK" && Array.isArray(j.data) && j.data.length > 0) {
          j.data.forEach(row => {
            const code = String(row[0]).trim(), price = parseFloat(String(row[8]).replace(/,/g, ""));
            if (!isNaN(price) && price > 0) priceMap[code] = price;
          });
          return true;
        }
      } catch (e) {}
    }
    return false;
  };
  const tryTPEXPrice = async () => {
    for (let offset = 0; offset < 5; offset++) {
      const d = new Date(today); d.setDate(d.getDate() - offset);
      const ds = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
      try {
        const j = await fetch(`https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&o=json&d=${ds}`).then(r => r.json());
        if (j.iTotalRecords > 0 && Array.isArray(j.aaData) && j.aaData.length > 0) {
          j.aaData.forEach(row => {
            const code = String(row[0]).trim(), price = parseFloat(String(row[2]).replace(/,/g, ""));
            if (!isNaN(price) && price > 0) priceMap[code] = price;
          });
          return true;
        }
      } catch (e) {}
    }
    return false;
  };
  if (statusEl) statusEl.textContent = "🆓 抓取全市場收盤價...";
  await Promise.all([tryTWSEPrice(), tryTPEXPrice()]);
  Object.entries(priceMap).forEach(([code, price]) => { if (!stockData[code]) stockData[code] = {}; stockData[code].price = price; });

  const tryTWSEPER = async () => {
    for (let offset = 0; offset < 5; offset++) {
      const d = new Date(today); d.setDate(d.getDate() - offset);
      const ds = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      try {
        if (statusEl) statusEl.textContent = `🆓 TWSE 本益比（${ds}）...`;
        const j = await fetch(`https://www.twse.com.tw/rwd/zh/afterTrading/BWIBBU_d?date=${ds}&stockNo=&response=json`).then(r => r.json());
        if (j.stat === "OK" && Array.isArray(j.data) && j.data.length > 0) {
          j.data.forEach(row => { const code = String(row[0]).trim(), per = parseFloat(row[4]); if (!isNaN(per) && per > 0) perMap[code] = per; });
          return true;
        }
      } catch (e) {}
    }
    return false;
  };
  const tryTPEXPER = async () => {
    for (let offset = 0; offset < 5; offset++) {
      const d = new Date(today); d.setDate(d.getDate() - offset);
      const ds = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
      try {
        const j = await fetch(`https://www.tpex.org.tw/web/stock/aftertrading/peratio_listed/peListed_result.php?l=zh-tw&o=json&d=${ds}`).then(r => r.json());
        if (j.iTotalRecords > 0 && Array.isArray(j.aaData) && j.aaData.length > 0) {
          j.aaData.forEach(row => { const code = String(row[0]).trim(), per = parseFloat(row[4]); if (!isNaN(per) && per > 0) perMap[code] = per; });
          return true;
        }
      } catch (e) {}
    }
    return false;
  };
  await Promise.all([tryTWSEPER(), tryTPEXPER()]);
  Object.keys(perMap).forEach(code => {
    const per = perMap[code], price = priceMap[code] ?? stockData[code]?.price;
    result[code] = { per, eps: price ? parseFloat((price / per).toFixed(2)) : null };
  });
  return result;
}

async function applyBulkPER(bulkData, statusEl) {
  const today = new Date().toISOString().slice(0, 10);
  let count = 0;
  Object.entries(bulkData).forEach(([code, d]) => {
    if (!financialsCache[code]) financialsCache[code] = {};
    financialsCache[code].per = d.per; financialsCache[code].perDate = today;
    if (d.eps !== null) { financialsCache[code].eps = d.eps; financialsCache[code].epsDate = today; }
    if (!stockData[code]) stockData[code] = {};
    stockData[code].per = d.per;
    if (d.eps !== null) stockData[code].eps = d.eps;
    let tag = classify_quality(d.eps, d.per);
    if (tag === "✖️抓取失敗") tag = "❓缺財報";
    stockData[code].qualityTag = stockData[code].quality_status = tag;
    count++;
  });
  if (statusEl) statusEl.textContent = `🆓 完成：取得 ${count} 檔本益比（TWSE/TPEX）`;
  return count;
}

async function fetchFundamentalsFree() {
  const btn = document.getElementById("fetchFundamentalsFreeBtn");
  const statusEl = document.getElementById("fetchStatus");
  btn.disabled = true;
  const bulk = await fetchBulkPER(statusEl);
  const n = await applyBulkPER(bulk, statusEl);
  saveLocalOnly(); updateUI(false);
  const statsEl = document.getElementById("fundStats");
  if (statsEl) {
    const today = new Date().toISOString().slice(0, 10);
    const tagOrder = ["🟢業績股", "🟡普通", "⚫虧損", "🔴題材股", "❓缺財報", "❓ETF", "✖️抓取失敗"];
    const sectorsSet = new Set(Object.values(SECTORS).flat().map(s => s.code));
    const counts = Object.fromEntries(tagOrder.map(t => [t, 0]));
    Object.entries(stockData).forEach(([code, s]) => { if (sectorsSet.has(code) && counts[s.quality_status] != null) counts[s.quality_status]++; });
    const line = tagOrder.filter(t => counts[t] > 0).map(t => `${t} ${counts[t]}`).join("　");
    statsEl.innerHTML = `<strong>免費批次更新</strong>（${today}，TWSE/TPEX）共 ${n} 檔<br>${line}<br><span style="color:var(--amber);font-size:11px">⚠️ 月營收YOY需 FinMind 才能更新；EPS = 收盤 ÷ PER 反推</span>`;
  }
  btn.disabled = false;
  showToast(`免費更新基本面完成（${n} 檔）`, "success");
  setTimeout(() => { statusEl.textContent = ""; }, 5000);
}

async function fetchFundamentals() {
  const token = document.getElementById("apiToken").value.trim();
  const btn = document.getElementById("fetchFundamentalsBtn");
  const statusEl = document.getElementById("fetchStatus");
  const progContainer = document.getElementById("progressContainer");
  const progBar = document.getElementById("progressBar");

  const today = new Date().toISOString().slice(0, 10);
  const oneYearAgo = new Date(); oneYearAgo.setDate(1); oneYearAgo.setMonth(oneYearAgo.getMonth() - 16);
  const startDate = oneYearAgo.toISOString().slice(0, 10);
  const apiBase = "https://api.finmindtrade.com/api/v4/data";
  const isPaid = document.getElementById("finmindPaidPlan")?.checked;
  let activeTok = token ? `&token=${token}` : "";
  let currentDelay = isPaid ? 0 : 6000;
  let fallbackMode = !token;
  const delay = () => currentDelay ? new Promise(r => setTimeout(r, currentDelay)) : Promise.resolve();

  progContainer.style.display = "block";
  if (!token) {
    statusEl.textContent = "🆓 無 Token，先用 TWSE/TPEX 批次取得本益比...";
    const bulkPre = await fetchBulkPER(statusEl);
    await applyBulkPER(bulkPre, null);
  }

  let bulkFallbackDone = false;
  const finmindFetch = async (baseUrl) => {
    const res = await fetch(baseUrl + activeTok);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const isOverLimit = json.status === 402 || json.status === 429 || (typeof json.msg === "string" && /limit|over|too.?many|exceed/i.test(json.msg) && json.msg !== "success");
    if (isOverLimit && !fallbackMode) {
      fallbackMode = true; activeTok = ""; currentDelay = 6000;
      if (!bulkFallbackDone) {
        bulkFallbackDone = true;
        statusEl.textContent = "⚠️ FinMind 超限，切換 TWSE/TPEX 批次備援 PER/EPS...";
        const fallbackBulk = await fetchBulkPER(statusEl);
        await applyBulkPER(fallbackBulk, null);
      }
      return { msg: "success", data: [] };
    }
    return json;
  };
  const cacheAge = (code, key) => { const d = financialsCache[code]?.[key]; return d ? (Date.now() - new Date(d)) / 86400000 : 999; };
  const isTW = c => !/^[A-Z]/.test(c);
  const wlCodes = [...new Set(Object.values(watchlists).flat())].filter(isTW);
  const sStats = calcSectorStats();
  const sortedSectors = Object.keys(SECTORS).sort((a, b) => ((sStats[b]?.pct10 || 0) - (sStats[a]?.pct10 || 0)));
  const hotCodes = [];
  sortedSectors.forEach(sec => (SECTORS[sec] || []).forEach(s => { if (!hotCodes.includes(s.code)) hotCodes.push(s.code); }));
  const fullQueue = [...wlCodes];
  hotCodes.forEach(c => { if (!fullQueue.includes(c)) fullQueue.push(c); });
  const wlSet = new Set(wlCodes);
  const needFetch = fullQueue.filter(c => token ? (cacheAge(c, "perDateFM") > 1 || cacheAge(c, "epsDateFM") > 90 || cacheAge(c, "yoyDate") > 32) : (cacheAge(c, "perDate") > 1 || cacheAge(c, "epsDate") > 90 || cacheAge(c, "yoyDate") > 32));
  const skipped = fullQueue.length - needFetch.length;

  if (needFetch.length === 0) {
    statusEl.textContent = `所有 ${fullQueue.length} 檔基本面皆為最新`;
    progContainer.style.display = "none";
    showToast("所有基本面資料皆為最新", "info");
    setTimeout(() => { statusEl.textContent = ""; }, 4000);
    return;
  }

  btn.disabled = true;
  for (let i = 0; i < needFetch.length; i++) {
    const code = needFetch[i];
    const group = wlSet.has(code) ? "⭐關注" : "🔥族群";
    const remainSecs = Math.ceil((needFetch.length - i) * 2 * currentDelay / 1000);
    const etaTxt = currentDelay && remainSecs > 10 ? `，約剩 ${remainSecs >= 60 ? Math.ceil(remainSecs / 60) + " 分鐘" : remainSecs + " 秒"}` : "";
    statusEl.textContent = `${group} ${code}（${i + 1}/${needFetch.length}${etaTxt}）`;
    progBar.style.width = `${((i + 1) / needFetch.length) * 100}%`;

    const fc = financialsCache[code] || {};
    const safeFloat = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const isEtf = /^00[0-9]/.test(code);

    let per = fc.per ?? null, perApiOk = false;
    if (!isEtf && (token ? cacheAge(code, "perDateFM") > 1 : cacheAge(code, "perDate") > 1)) {
      try {
        const json = await finmindFetch(`${apiBase}?dataset=TaiwanStockPER&data_id=${code}&start_date=${startDate}`);
        if (json.msg === "success") {
          perApiOk = true;
          if (json.data?.length > 0) per = safeFloat(json.data[json.data.length - 1].PER);
          financialsCache[code] = { ...(financialsCache[code] || fc), per, perDate: today, perDateFM: today };
        }
      } catch (e) {}
      await delay();
    } else if (isEtf) perApiOk = true;

    let eps = fc.eps ?? null, grossMargin = fc.grossMargin ?? null, opMargin = fc.opMargin ?? null, nonOpRatio = fc.nonOpRatio ?? null, epsApiOk = false;
    if (!isEtf && (token ? cacheAge(code, "epsDateFM") > 90 : cacheAge(code, "epsDate") > 90)) {
      try {
        const json = await finmindFetch(`${apiBase}?dataset=TaiwanStockFinancialStatements&data_id=${code}&start_date=${startDate}`);
        if (json.msg === "success") {
          epsApiOk = true;
          const rows = json.data || [], epsRows = rows.filter(d => d.type === "EPS");
          if (epsRows.length > 0) {
            // 加總近 4 季 EPS（TTM 年化），與 TWSE/TPEX price÷PER 反推的 TTM EPS 口徑一致
            const ttmRows = epsRows.slice(-4);
            const ttmSum = ttmRows.reduce((acc, r) => acc + (safeFloat(r.value) ?? 0), 0);
            eps = parseFloat(ttmSum.toFixed(2));
            const latestDate = epsRows[epsRows.length - 1].date;
            const byType = t => { const r = rows.filter(d => d.type === t && d.date === latestDate); return r.length ? safeFloat(r[r.length - 1].value) : null; };
            const revenue = byType("Revenue"), grossProfit = byType("GrossProfit"), operatingIncome = byType("OperatingIncome"), preTaxIncome = byType("PreTaxIncome"), nonOp = byType("TotalNonoperatingIncomeAndExpense");
            if (revenue) {
              if (grossProfit != null) grossMargin = safeFloat((grossProfit / revenue * 100).toFixed(1));
              if (operatingIncome != null) opMargin = safeFloat((operatingIncome / revenue * 100).toFixed(1));
            }
            if (preTaxIncome && nonOp != null) nonOpRatio = safeFloat((nonOp / preTaxIncome * 100).toFixed(1));
            financialsCache[code] = { ...(financialsCache[code] || fc), eps, epsDate: today, epsDateFM: today, grossMargin, opMargin, nonOpRatio };
          }
        }
      } catch (e) {}
      await delay();
    } else if (isEtf) epsApiOk = true;

    let yoy = fc.yoy ?? null, rev3moYoy = fc.rev3moYoy ?? null;
    if (cacheAge(code, "yoyDate") > 32) {
      try {
        const json = await finmindFetch(`${apiBase}?dataset=TaiwanStockMonthRevenue&data_id=${code}&start_date=${startDate}`);
        if (json.msg === "success" && json.data?.length > 0) {
          const data = json.data, revMap = {};
          data.forEach(r => { revMap[`${r.revenue_year}-${r.revenue_month}`] = r.revenue; });
          const row = data[data.length - 1], priorYearRev = revMap[`${row.revenue_year - 1}-${row.revenue_month}`];
          if (priorYearRev > 0) yoy = safeFloat(((row.revenue - priorYearRev) / priorYearRev * 100).toFixed(1));
          const last3 = data.slice(-3), priorRevs = last3.map(r => revMap[`${r.revenue_year - 1}-${r.revenue_month}`]);
          if (last3.length === 3 && priorRevs.every(v => v > 0)) {
            const sumRev = last3.reduce((s, r) => s + r.revenue, 0), sumLastYear = priorRevs.reduce((s, v) => s + v, 0);
            rev3moYoy = safeFloat(((sumRev - sumLastYear) / sumLastYear * 100).toFixed(1));
          }
          financialsCache[code] = { ...(financialsCache[code] || fc), yoy, rev3moYoy, yoyDate: today };
        }
      } catch (e) {}
      await delay();
    }

    if (!stockData[code]) stockData[code] = {};
    if (isEtf) { stockData[code].qualityTag = stockData[code].quality_status = "❓ETF"; stockData[code].per = stockData[code].eps = null; continue; }
    if (per !== null) stockData[code].per = per;
    if (eps !== null) stockData[code].eps = eps;
    if (yoy !== null) stockData[code].yoy = yoy;
    if (grossMargin !== null) stockData[code].grossMargin = grossMargin;
    if (opMargin !== null) stockData[code].opMargin = opMargin;
    if (nonOpRatio !== null) stockData[code].nonOpRatio = nonOpRatio;
    if (rev3moYoy !== null) stockData[code].rev3moYoy = rev3moYoy;
    let tag = classify_quality(stockData[code].eps, stockData[code].per);
    if (tag === "✖️抓取失敗" && perApiOk && epsApiOk) tag = "❓缺財報";
    stockData[code].qualityTag = stockData[code].quality_status = tag;
    stockData[code].growthTag = classify_growth_type(stockData[code]);
  }

  saveLocalOnly(); updateUI(false);
  const tagOrder = ["🟢業績股", "🟡普通", "⚫虧損", "🔴題材股", "❓缺財報", "❓ETF", "✖️抓取失敗"];
  const counts = Object.fromEntries(tagOrder.map(t => [t, 0]));
  fullQueue.forEach(c => { const t = stockData[c]?.quality_status; if (counts[t] != null) counts[t]++; });
  const failedCodes = fullQueue.filter(c => stockData[c]?.quality_status === "✖️抓取失敗");
  const statsLine = tagOrder.filter(t => counts[t] > 0).map(t => `${t} ${counts[t]}`).join("　");
  const statsEl = document.getElementById("fundStats");
  if (statsEl) {
    statsEl.innerHTML = `<strong>最近一次基本面更新</strong>（${today}）抓取 ${needFetch.length} 檔，跳過 ${skipped} 快取<br>${statsLine}${failedCodes.length ? `<br><span style="color:var(--up);">✖️失敗代號：${failedCodes.join(", ")}</span>` : ""}`;
  }
  statusEl.textContent = `基本面更新完成（抓取 ${needFetch.length} 檔，跳過 ${skipped} 快取）`;
  showToast(`基本面更新完成（${needFetch.length} 檔）`, "success");
  btn.disabled = false;
  progContainer.style.display = "none";
  setTimeout(() => { statusEl.textContent = ""; }, 5000);
}

async function triggerQuoteUpdate() {
  const token = document.getElementById("ghTriggerToken").value.trim();
  const statusEl = document.getElementById("triggerQuoteStatus");
  const btn = document.getElementById("triggerQuoteBtn");
  const btnTop = document.getElementById("triggerQuoteBtnTop");
  if (!token) {
    showToast("請先在「設定」頁輸入 GitHub Token", "warn");
    switchTab("data");
    return;
  }
  if (btn) btn.disabled = true;
  if (btnTop) btnTop.disabled = true;
  statusEl.style.color = "var(--text-secondary)";
  statusEl.textContent = "觸發 GitHub Actions 盤中更新中...";
  try {
    const res = await fetch("https://api.github.com/repos/micliou877/FDC/actions/workflows/update-quotes.yml/dispatches", {
      method: "POST",
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main" })
    });
    if (res.status === 204) {
      const beforeTime = liveQuoteTime, startTime = Date.now(), ESTIMATE_MS = 120000;
      statusEl.innerHTML = `
        <div style="font-size:12px;color:var(--down);font-weight:600;margin-bottom:4px;">✅ 已觸發 GitHub Actions，抓取中...</div>
        <div style="background:var(--surface-2);border-radius:4px;height:6px;overflow:hidden;margin-bottom:4px;">
          <div id="ghProgBar" style="height:100%;width:0%;border-radius:4px;background:linear-gradient(90deg,var(--accent),var(--cyan));transition:width 0.8s linear;"></div>
        </div>
        <div id="ghProgTxt" style="font-size:11.5px;color:var(--text-secondary);">已等候 0 秒，預計約 2 分鐘...</div>`;
      const tickInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const bar = document.getElementById("ghProgBar"), txt = document.getElementById("ghProgTxt");
        if (bar) bar.style.width = Math.min(95, (elapsed / (ESTIMATE_MS / 1000)) * 100) + "%";
        if (txt) txt.textContent = `已等候 ${elapsed} 秒，預計約 2 分鐘，GitHub 較忙時可能到 4~5 分鐘...`;
      }, 1000);
      const NORMAL_ATTEMPTS = 14, HARD_ATTEMPTS = 22;
      let attempts = 0;
      const poll = async () => {
        attempts++;
        await fetchLiveQuotes();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (liveQuoteTime && liveQuoteTime !== beforeTime) {
          clearInterval(tickInterval);
          const doneMsg = `🎉 盤中更新完成（${elapsed} 秒）｜${liveQuoteTime}`;
          statusEl.style.color = "var(--down)";
          statusEl.textContent = doneMsg;
          showToast(doneMsg, "success", 4000);
          if (btn) btn.disabled = false;
          if (btnTop) btnTop.disabled = false;
          setTimeout(() => { statusEl.textContent = ""; }, 6000);
          return;
        }
        if (attempts < NORMAL_ATTEMPTS) setTimeout(poll, 15000);
        else if (attempts < HARD_ATTEMPTS) {
          clearInterval(tickInterval);
          statusEl.style.color = "var(--amber)";
          statusEl.textContent = `比預期久一點（已 ${elapsed} 秒），背景持續確認 CDN 中...`;
          setTimeout(poll, 30000);
        } else {
          statusEl.style.color = "var(--up)";
          statusEl.textContent = "等待逾時，請稍後重新整理或到 GitHub Actions 查看。";
          if (btn) btn.disabled = false;
          if (btnTop) btnTop.disabled = false;
        }
      };
      setTimeout(poll, 80000);
      return;
    } else {
      const body = await res.text();
      statusEl.style.color = "var(--up)";
      statusEl.textContent = `觸發失敗（${res.status}）：${body.slice(0, 150)}`;
    }
  } catch (e) {
    statusEl.style.color = "var(--up)";
    statusEl.textContent = "觸發失敗，請檢查網路或 Token 是否正確。";
  }
  if (btn) btn.disabled = false;
  if (btnTop) btnTop.disabled = false;
}

async function refreshVIX() {
  if (vixRefreshing) return;
  vixRefreshing = true;
  renderStatusPills();
  const ghToken = localStorage.getItem("gh_dispatch_token");
  if (!ghToken) {
    await fetchLiveQuotes();
    saveLocalOnly();
    vixRefreshing = false;
    renderStatusPills();
    showToast(vixtwn ? `VIX ${vixtwn.price}（${vixtwn.date} ${vixtwn.time}）` : "無 VIX 資料", "info");
    return;
  }
  showToast("已觸發 GitHub Actions 更新 VIX，約需 90 秒...", "info");
  try {
    const res = await fetch("https://api.github.com/repos/micliou877/FDC/actions/workflows/update-quotes.yml/dispatches", {
      method: "POST",
      headers: { "Authorization": `token ${ghToken}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main" })
    });
    if (res.status !== 204) { vixRefreshing = false; renderStatusPills(); showToast(`VIX 觸發失敗 (HTTP ${res.status})`, "error"); return; }
  } catch (e) { vixRefreshing = false; renderStatusPills(); showToast("VIX 觸發失敗（網路錯誤）", "error"); return; }

  const beforeTime = liveQuoteTime;
  let attempts = 0;
  const pollVix = async () => {
    attempts++;
    await fetchLiveQuotes();
    if (liveQuoteTime !== beforeTime) {
      saveLocalOnly(); vixRefreshing = false; renderStatusPills();
      showToast(vixtwn ? `VIX 更新完成：${vixtwn.price}` : "報價更新完成", "success");
      return;
    }
    if (attempts < 10) setTimeout(pollVix, 15000);
    else { vixRefreshing = false; renderStatusPills(); showToast("VIX 更新等待逾時", "warn"); }
  };
  setTimeout(pollVix, 80000);
}

// ==================== 美股 FDC 與黑馬掃描資料載入 ====================
let usStocksData = null;
let usFilterMode = "all";
let usSearchQ = "";
let usExpandedSectors = new Set();
let usSectorSortKey = "pct10";
let usRankSortKey = "total";
let usRankSortDir = 1;

const US_GAIN_HISTORY_KEY = "fdc_us_gain10_rank_history_v1";
const US_SCORE_PARAMS = {
  rankMaDays: 3, rankLevelBase: 22, rankLevelMult: 2, rankLevelCutoffRank: 10, rankLevelFloorScore: 1,
  rankDeltaWeight: 0.4, rankDeltaCapUp: 4, rankDeltaCapDown: 4,
  accelPriorMinReturn: 5, accelBreaks: [1.2, 0.9, 0.65, 0.4], accelScores: [20, 14, 8, 3, -5],
  accelFreshBreakoutFloor: -3, accelFreshBreakoutMinReturn5d: 8, accelFreshBreakoutScore: 8,
  weightRank: 60, weightAccel: 40
};
function loadUsGainHistory() { try { return JSON.parse(localStorage.getItem(US_GAIN_HISTORY_KEY) || "{}"); } catch (e) { return {}; } }
function saveUsGainHistory(h) {
  const dates = Object.keys(h).sort();
  while (dates.length > 60) delete h[dates.shift()];
  try { localStorage.setItem(US_GAIN_HISTORY_KEY, JSON.stringify(h)); } catch (e) {}
}
function applyUsDataToStockData() {
  if (!usStocksData || !usStocksData.stocks) return;
  Object.entries(usStocksData.stocks).forEach(([code, s]) => {
    stockData[code] = {
      ...(stockData[code] || {}), market: "US",
      price: s.price, pct1: s.pct1, pct5: s.pct5, pct10: s.pct10,
      close5Ref: s.close5Ref, close10Ref: s.close10Ref,
      per: s.per, eps: s.eps, qualityTag: s.quality, quality_status: s.quality
    };
  });
}
async function loadUsStocks(forceRefresh) {
  const tableEl = document.getElementById("usStocksTable");
  if (tableEl && activeTab === "usstocks") tableEl.innerHTML = `<div class="empty-state">載入中...</div>`;
  try {
    const res = await fetch(`${US_QUOTES_URL}?t=${forceRefresh ? Date.now() : Math.floor(Date.now() / 600000)}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    usStocksData = await res.json();
  } catch (e) {
    if (tableEl && activeTab === "usstocks") tableEl.innerHTML = `<div class="empty-state" style="color:var(--up);">載入失敗：${_dEsc(e.message)}</div>`;
    return;
  }
  applyUsDataToStockData();
  markTabsDirty(["usstocks", "watchlist", "stocks"]);
  if (activeTab === "usstocks") renderUsStocks();
  else if (activeTab === "watchlist") renderWatchlist();
  else if (activeTab === "stocks") renderStocks();
}
async function triggerUsQuoteUpdate() {
  const token = localStorage.getItem("gh_dispatch_token");
  const statusEl = document.getElementById("triggerUsQuoteStatus");
  const btn = document.getElementById("triggerUsQuoteBtn");
  const showMsg = (msg, color) => { if (statusEl) { statusEl.style.color = color || ""; statusEl.textContent = msg; } };
  if (!token) { showToast("請先到「設定」頁輸入 GitHub Token", "warn"); switchTab("data"); return; }
  btn.disabled = true;
  showMsg("觸發 GitHub Actions 中...", "var(--text-secondary)");
  try {
    const res = await fetch("https://api.github.com/repos/micliou877/FDC/actions/workflows/update-us-quotes.yml/dispatches", {
      method: "POST",
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main" })
    });
    if (res.status !== 204) { showMsg(`觸發失敗（HTTP ${res.status}）`, "var(--up)"); btn.disabled = false; return; }
  } catch (e) { showMsg("觸發失敗（網路錯誤）", "var(--up)"); btn.disabled = false; return; }
  const beforeUpdated = usStocksData?.updated, startTime = Date.now();
  showMsg("✅ 已觸發！美股報價抓取中，約需 2-5 分鐘...", "var(--down)");
  let attempts = 0;
  const poll = async () => {
    attempts++;
    await loadUsStocks(true);
    if (usStocksData?.updated && usStocksData.updated !== beforeUpdated) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      showMsg(`🎉 完成！（${elapsed} 秒）最後更新：${usStocksData.updated}`, "var(--down)");
      showToast("美股最新報價更新完成", "success");
      btn.disabled = false;
      return;
    }
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    showMsg(`等候中，已 ${elapsed} 秒（第 ${attempts} 次確認）...`, "var(--text-secondary)");
    if (attempts < 12) setTimeout(poll, 20000);
    else { showMsg("等待逾時，請稍後按「重新整理」", "var(--up)"); btn.disabled = false; }
  };
  setTimeout(poll, 90000);
}

let marketScanData = null;
let marketScanSortKey = "pct1";
let marketScanSortDir = 1;
let marketScanSearchQ = "";
let marketScanMarketFilter = "ALL"; // ALL | TWSE | TPEX
let marketScanSignalFilter = "ALL";

async function loadMarketScan(forceRefresh) {
  const tableEl = document.getElementById("marketScanTable");
  if (tableEl && activeTab === "marketscan") tableEl.innerHTML = `<div class="empty-state">載入中...</div>`;
  try {
    const res = await fetch(`${MARKET_SCAN_URL}?t=${forceRefresh ? Date.now() : Math.floor(Date.now() / 600000)}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    marketScanData = await res.json();
  } catch (e) {
    if (tableEl && activeTab === "marketscan") tableEl.innerHTML = `<div class="empty-state" style="color:var(--up);">載入失敗：${_dEsc(e.message)}</div>`;
    return;
  }
  dirtyTabs.add("marketscan");
  if (activeTab === "marketscan") renderMarketScan();
}
async function triggerMarketScan() {
  const token = localStorage.getItem("gh_dispatch_token");
  const statusEl = document.getElementById("triggerScanStatus");
  const btn = document.getElementById("triggerScanBtn");
  const showMsg = (msg, color) => { if (statusEl) { statusEl.style.color = color || ""; statusEl.textContent = msg; } };
  if (!token) { showToast("請先到「設定」頁輸入 GitHub Token", "warn"); switchTab("data"); return; }
  btn.disabled = true;
  showMsg("觸發 GitHub Actions 掃描中...", "var(--text-secondary)");
  try {
    const res = await fetch("https://api.github.com/repos/micliou877/FDC/actions/workflows/scan-market.yml/dispatches", {
      method: "POST",
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main" })
    });
    if (res.status !== 204) { showMsg(`觸發失敗（HTTP ${res.status}）`, "var(--up)"); btn.disabled = false; return; }
  } catch (e) { showMsg("觸發失敗（網路錯誤）", "var(--up)"); btn.disabled = false; return; }
  const before = marketScanData ? marketScanData.scannedAt : null, startTime = Date.now();
  showMsg("✅ 已觸發！掃描中，約需 1 分鐘...", "var(--down)");
  let attempts = 0;
  const poll = async () => {
    attempts++;
    await loadMarketScan(true);
    if (marketScanData?.scannedAt && marketScanData.scannedAt !== before) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      showMsg(`🎉 完成！（${elapsed} 秒）資料日期：${marketScanData.date}`, "var(--down)");
      showToast("黑馬掃描完成", "success");
      btn.disabled = false;
      return;
    }
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    showMsg(`等候中，已 ${elapsed} 秒（第 ${attempts} 次確認）...`, "var(--text-secondary)");
    if (attempts < 10) setTimeout(poll, 10000);
    else { showMsg("等待逾時，請稍後按「重新整理」", "var(--up)"); btn.disabled = false; }
  };
  setTimeout(poll, 20000);
}
