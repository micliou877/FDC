// ==================== FDC Views: UI Renderers, Popovers, Modals & Events ====================

// ==================== 頂部狀態列 & Lazy Render 排程 ====================
function renderStatusPills() {
  const box = document.getElementById("statusPills");
  if (!box) return;
  const pills = [];
  if (lastUpdateTime) {
    const t = new Date(lastUpdateTime).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
    pills.push(`<span class="status-pill" title="FinMind 盤後更新時間">盤後 <strong>${_dEsc(t)}</strong></span>`);
  } else {
    pills.push(`<span class="status-pill">尚未匯入盤後資料</span>`);
  }
  if (liveQuoteTime) {
    pills.push(`<span class="status-pill" title="GitHub Actions 盤中報價">盤中 <strong>${_dEsc(liveQuoteTime)}</strong></span>`);
  }
  if (vixtwn) {
    const vSign = vixtwn.pct1 >= 0 ? "+" : "";
    const vCls = vixtwn.pct1 > 0 ? "pos-text" : vixtwn.pct1 < 0 ? "neg-text" : "flat-text";
    pills.push(`<span class="status-pill vix-pill" title="台灣 VIX (${_dEsc(vixtwn.date)} ${_dEsc(vixtwn.time)})">VIX <strong>${vixtwn.price}</strong> <span class="${vCls} num">${vSign}${vixtwn.pct1 ?? "-"}%</span><button class="vix-refresh-mini" id="vixRefreshBtn" onclick="refreshVIX()" ${vixRefreshing ? "disabled" : ""} title="立即更新 VIX">${vixRefreshing ? "⏳" : "🔄"}</button></span>`);
  }
  box.innerHTML = pills.join("");
}

function renderActiveTab(force = false) {
  if (!force && !dirtyTabs.has(activeTab)) return;
  dirtyTabs.delete(activeTab);
  if (activeTab === "strategy") renderStrategy();
  else if (activeTab === "ranking") renderRanking();
  else if (activeTab === "stocks") renderStocks();
  else if (activeTab === "watchlist") renderWatchlist();
  else if (activeTab === "data") renderDataPanel();
  else if (activeTab === "diary") renderDiary();
  else if (activeTab === "usstocks") { if (!usStocksData) loadUsStocks(false); else renderUsStocks(); }
  else if (activeTab === "marketscan") { if (!marketScanData) loadMarketScan(false); else renderMarketScan(); }
  else if (activeTab === "global") { if (document.getElementById("globalStockSelect").options.length === 0) initGlobalPanel(); }
}

function updateUI(dataChanged = false) {
  invalidateSectorCache();
  renderStatusPills();
  renderDataPanel();
  if (dataChanged && Object.keys(stockData).length > 0) {
    recordHeatSnapshot();
    computeGain10Snapshot(true);
  }
  markTabsDirty();
  renderActiveTab(true);
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab[data-tab]").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === tab));
  document.getElementById("navSopBtn")?.classList.toggle("active", tab === "sop");
  document.getElementById("navDataBtn")?.classList.toggle("active", tab === "data");
  const isMoreTab = ["usstocks", "marketscan", "diary", "sop", "data"].includes(tab);
  document.getElementById("mobileMoreBtn")?.classList.toggle("active", isMoreTab);
  document.querySelectorAll("#mobileMoreSheet [data-tab-sheet]").forEach(b => b.classList.toggle("active", b.dataset.tabSheet === tab));
  renderActiveTab(tab === "usstocks" || tab === "marketscan" || tab === "global");
}

function toggleMobileMore(open) {
  const sheet = document.getElementById("mobileMoreSheet");
  if (sheet) sheet.classList.toggle("open", !!open);
}

function renderDataPanel() {
  const el = document.getElementById("dbCount");
  if (el) el.textContent = Object.keys(stockData).length;
}

// ==================== 可折疊頁首備註與限制清單 ====================
let memoOpenState = {
  note: localStorage.getItem("fdc_memo_note_open") === "1",
  checklist: localStorage.getItem("fdc_memo_checklist_open") === "1"
};

function renderMemoDockVisibility() {
  const body = document.getElementById("memoBody");
  const noteBox = document.getElementById("memoNoteBox");
  const chkBox = document.getElementById("memoChecklistBox");
  const nChev = document.getElementById("memoNoteChev");
  const cChev = document.getElementById("memoChecklistChev");
  if (!body || !noteBox || !chkBox) return;

  const anyOpen = memoOpenState.note || memoOpenState.checklist;
  body.style.display = anyOpen ? "grid" : "none";
  body.classList.toggle("single-col", memoOpenState.note !== memoOpenState.checklist);
  noteBox.style.display = memoOpenState.note ? "block" : "none";
  chkBox.style.display = memoOpenState.checklist ? "block" : "none";
  if (nChev) nChev.textContent = memoOpenState.note ? "▾" : "▸";
  if (cChev) cChev.textContent = memoOpenState.checklist ? "▾" : "▸";
  if (memoOpenState.note) autoResizeHeaderNote();
}

function toggleMemoDock(which) {
  memoOpenState[which] = !memoOpenState[which];
  try { localStorage.setItem(`fdc_memo_${which}_open`, memoOpenState[which] ? "1" : "0"); } catch (e) {}
  renderMemoDockVisibility();
}

function autoResizeHeaderNote() {
  const el = document.getElementById("headerNote");
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.max(54, el.scrollHeight) + "px";
}

function syncHeaderNoteUi() {
  const el = document.getElementById("headerNote");
  const prev = document.getElementById("memoNoteChipPreview");
  if (el && el.value !== headerNote) el.value = headerNote;
  if (prev) {
    const firstLine = (headerNote || "").trim().split(/\r?\n/)[0] || "";
    prev.textContent = firstLine ? (firstLine.length > 32 ? firstLine.slice(0, 32) + "…" : firstLine) : "點此展開填寫";
  }
  autoResizeHeaderNote();
}

function renderHeaderChecklist() {
  const el = document.getElementById("headerChecklist");
  const badge = document.getElementById("memoChecklistChipBadge");
  const doneCnt = headerChecklist.filter(i => (i.state != null ? i.state : (i.checked ? 1 : 0)) === 1).length;
  if (badge) badge.textContent = headerChecklist.length ? `${doneCnt}/${headerChecklist.length}` : "尚無項目";
  if (!el) return;
  const rows = headerChecklist.map(item => {
    const state = item.state != null ? item.state : (item.checked ? 1 : 0);
    const icon = state === 1 ? "☑" : state === 2 ? "☒" : "☐";
    const textCls = state === 1 ? "done" : state === 2 ? "crossed" : "";
    return `
      <div class="checklist-item">
        <span class="checklist-state" onclick="cycleHeaderChecklistState('${_dEsc(item.id)}')" title="點擊切換：空白→✓→✗→空白">${icon}</span>
        <span class="checklist-text ${textCls}" onclick="editHeaderChecklistItem(this,'${_dEsc(item.id)}')">${_dEsc(item.text)}</span>
        <span class="checklist-del" onclick="deleteHeaderChecklistItem('${_dEsc(item.id)}')" title="刪除">✕</span>
      </div>`;
  }).join("");
  const atMax = headerChecklist.length >= HEADER_CHECKLIST_MAX;
  const addRow = atMax
    ? `<div class="checklist-add-note">已達上限 ${HEADER_CHECKLIST_MAX} 項，刪掉幾項才能再新增</div>`
    : `<div class="checklist-add">
         <input type="text" id="headerChecklistNewInput" placeholder="輸入自己的限制／提醒，按 Enter 新增..." onkeypress="if(event.key==='Enter') addHeaderChecklistItem()">
         <button class="btn sm" onclick="addHeaderChecklistItem()">+ 新增</button>
       </div>`;
  el.innerHTML = `<div class="checklist-cols">${rows}</div>${addRow}`;
}

window.addHeaderChecklistItem = function() {
  if (headerChecklist.length >= HEADER_CHECKLIST_MAX) { showToast(`最多只能新增 ${HEADER_CHECKLIST_MAX} 項`, "warn"); return; }
  const input = document.getElementById("headerChecklistNewInput");
  const text = input?.value.trim();
  if (!text) return;
  headerChecklist.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, state: 0 });
  saveHeaderChecklist(); renderHeaderChecklist(); _pendingPush = true; pushToCloud();
};
window.cycleHeaderChecklistState = function(id) {
  const item = headerChecklist.find(i => i.id === id);
  if (!item) return;
  const cur = item.state != null ? item.state : (item.checked ? 1 : 0);
  item.state = (cur + 1) % 3;
  saveHeaderChecklist(); renderHeaderChecklist(); _pendingPush = true; pushToCloud();
};
window.deleteHeaderChecklistItem = function(id) {
  headerChecklist = headerChecklist.filter(i => i.id !== id);
  saveHeaderChecklist(); renderHeaderChecklist(); _pendingPush = true; pushToCloud();
};
window.editHeaderChecklistItem = function(spanEl, id) {
  const item = headerChecklist.find(i => i.id === id);
  if (!item) return;
  const input = document.createElement("input");
  input.type = "text"; input.value = item.text; input.className = "checklist-text-input";
  spanEl.replaceWith(input);
  input.focus(); input.select();
  const finishEdit = () => {
    const v = input.value.trim();
    if (v) item.text = v;
    saveHeaderChecklist(); renderHeaderChecklist(); _pendingPush = true; pushToCloud();
  };
  input.onblur = finishEdit;
  input.onkeypress = e => { if (e.key === "Enter") input.blur(); };
};

// ==================== 關注分類多選浮動視窗 (Popover) ====================
let _watchPopCtx = null;

function watchBtnHtml(code, market = "TWSE", extraName = "", extraPrice = null, extraPct1 = null) {
  const groups = getWatchGroupsOf(code);
  const inAny = groups.length > 0;
  const tip = inAny ? `已關注：${groups.join("、")}（點擊管理）` : "點擊加入關注分類";
  const metaAttr = _dEsc(JSON.stringify({ code, market, name: extraName, price: extraPrice, pct1: extraPct1 }));
  return `<button class="watch-btn ${inAny ? "in-watch" : ""}" title="${_dEsc(tip)}" onclick="event.stopPropagation();openWatchPopover(this, JSON.parse(this.dataset.meta))" data-meta="${metaAttr}">${inAny ? "★" : "☆"}${groups.length > 1 ? `<span class="w-cnt">${groups.length}</span>` : ""}</button>`;
}

window.openWatchPopover = function(btnEl, meta) {
  const pop = document.getElementById("watchPopover");
  if (!pop) return;
  if (_watchPopCtx && _watchPopCtx.code === meta.code && pop.classList.contains("open")) {
    closeWatchPopover();
    return;
  }
  _watchPopCtx = meta;
  const code = meta.code;
  const displayName = STOCK_NAMES[code] || US_STOCK_NAMES[code] || meta.name || stockMeta[code]?.name || code;
  const groupKeys = Object.keys(watchlists);
  pop.innerHTML = `
    <div class="wp-title">⭐ 管理關注：${_dEsc(code)} ${_dEsc(displayName)}</div>
    ${groupKeys.map((g, idx) => {
      const checked = (watchlists[g] || []).includes(code);
      return `<label class="wp-item">
        <input type="checkbox" ${checked ? "checked" : ""} onchange="toggleStockInGroupIdx(${idx}, this.checked)">
        <span>${_dEsc(g)}</span>
      </label>`;
    }).join("")}
  `;
  pop.classList.add("open");
  const rect = btnEl.getBoundingClientRect();
  const popW = pop.offsetWidth || 220;
  const popH = pop.offsetHeight || 160;
  let left = rect.left;
  let top = rect.bottom + 4;
  if (left + popW > window.innerWidth - 10) left = Math.max(10, window.innerWidth - popW - 10);
  if (top + popH > window.innerHeight - 10) top = Math.max(10, rect.top - popH - 4);
  pop.style.left = left + "px";
  pop.style.top = top + "px";
};

function closeWatchPopover() {
  const pop = document.getElementById("watchPopover");
  if (pop) pop.classList.remove("open");
  _watchPopCtx = null;
}

window.toggleStockInGroupIdx = function(groupIdx, checked) {
  if (!_watchPopCtx) return;
  const groupName = Object.keys(watchlists)[groupIdx];
  if (!groupName) return;
  const { code, market, name, price, pct1 } = _watchPopCtx;
  if (!watchlists[groupName]) watchlists[groupName] = [];
  if (checked) {
    if (!watchlists[groupName].includes(code)) watchlists[groupName].push(code);
    if (market && market !== "TWSE" && market !== "TPEX") {
      const globalEntry = (GLOBAL_LIST[market] || []).find(g => g.code === code);
      stockMeta[code] = { market, name: US_STOCK_NAMES[code] || globalEntry?.name || name || stockMeta[code]?.name || `自訂標的（${code}）` };
      stockMetaTs = Date.now();
    } else if (name && !STOCK_NAMES[code]) {
      stockMeta[code] = { market: market || "TWSE", name };
      stockMetaTs = Date.now();
      if (price != null) stockData[code] = { ...(stockData[code] || {}), market: market || "TWSE", price, pct1 };
    }
    showToast(`已加入「${groupName}」`, "success", 1800);
  } else {
    watchlists[groupName] = watchlists[groupName].filter(c => c !== code);
    const stillWatched = Object.values(watchlists).some(l => l.includes(code));
    if (!stillWatched) {
      if (code in stockNotes) { delete stockNotes[code]; stockNotesTs = Date.now(); }
      if (window._t4_data && window._t4_data.some(h => h.code === code)) {
        window._t4_data = window._t4_data.filter(h => h.code !== code);
        holdingsTs = Date.now();
        try { localStorage.setItem("fdc_holdings", JSON.stringify(window._t4_data)); localStorage.setItem("fdc_holdings_ts", holdingsTs); } catch (e) {}
      }
    }
    showToast(`已從「${groupName}」移除`, "info", 1800);
  }
  watchlistsTs = Date.now();
  saveData();
  markTabsDirty();
  renderActiveTab(true);
  if (document.getElementById("quickSearchModal")?.classList.contains("open")) renderQuickSearchResults();
  if (document.getElementById("searchInput")?.value) handleSearch();
};

// ==================== 全域快速搜尋彈窗 (Ctrl+K / /) ====================
let _qsActiveIdx = 0;

function collectSearchMatches(rawQ) {
  const q = (rawQ || "").trim().toUpperCase();
  if (!q) return [];
  let matches = [];
  Object.entries(STOCK_NAMES).forEach(([code, name]) => {
    if (code.includes(q) || name.toUpperCase().includes(q)) matches.push({ code, name, market: STOCK_EXCHANGE[code] || "TWSE" });
  });
  Object.entries(US_STOCK_NAMES).forEach(([code, name]) => {
    if (code.includes(q) || name.toUpperCase().includes(q)) matches.push({ code, name, market: "US" });
  });
  ["US", "JP", "KR"].forEach(mkt => (GLOBAL_LIST[mkt] || []).forEach(g => {
    if (g.code.includes(q) || g.name.toUpperCase().includes(q)) matches.push({ code: g.code, name: g.name, market: mkt });
  }));
  matches = matches.filter((v, i, a) => a.findIndex(t => t.code === v.code) === i);
  if (/^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(q) && !matches.some(m => m.code === q)) {
    matches.push({ code: q, name: `自訂美股（${q}）`, market: "US", isCustom: true });
  }
  return matches.slice(0, 18);
}

window.openQuickSearch = function() {
  const modal = document.getElementById("quickSearchModal");
  const inp = document.getElementById("quickSearchInput");
  if (!modal || !inp) return;
  modal.classList.add("open");
  _qsActiveIdx = 0;
  inp.focus();
  inp.select();
  renderQuickSearchResults();
};
window.closeQuickSearch = function() {
  document.getElementById("quickSearchModal")?.classList.remove("open");
};
window.renderQuickSearchResults = function() {
  const inp = document.getElementById("quickSearchInput");
  const box = document.getElementById("quickSearchResults");
  if (!inp || !box) return;
  const q = inp.value.trim();
  if (!q) {
    box.innerHTML = `<div class="empty-state" style="padding:24px 12px;">輸入台股或美股代號／名稱即時查詢<br><span style="font-size:11.5px;color:var(--text-faint);">支援 ↑↓ 選取、Enter 開啟 TradingView、ESC 關閉</span></div>`;
    return;
  }
  const matches = collectSearchMatches(q);
  if (!matches.length) {
    box.innerHTML = `<div class="empty-state" style="padding:24px 12px;">找不到符合「${_dEsc(q)}」的標的</div>`;
    return;
  }
  if (_qsActiveIdx >= matches.length) _qsActiveIdx = 0;
  box.innerHTML = matches.map((m, idx) => {
    const isTW = m.market === "TWSE" || m.market === "TPEX";
    const d = stockData[m.code];
    const groups = getWatchGroupsOf(m.code);
    const mktTag = isTW ? "" : `<span class="tag tag-us" style="margin:0 0 0 6px;">${_dEsc(m.market)}</span>`;
    const priceHtml = d?.price != null ? `<span class="qs-price num">${d.price.toFixed(2)} <span class="${pctClass(d.pct1)}">${fmtPct(d.pct1)}</span></span>` : "";
    const wlTags = groups.length ? `<div style="margin-top:2px;">${groups.map(g => `<span class="tag tag-dajia" style="font-size:10px;">${_dEsc(g)}</span>`).join("")}</div>` : "";
    return `
      <div class="qs-item ${idx === _qsActiveIdx ? "active" : ""}" data-tv="${_dEsc(getTVLink(m.code, m.market))}">
        <div class="qs-main" onclick="${isTW ? `closeQuickSearch();goToStock('${_dEsc(m.code)}')` : `window.open('${_dEsc(getTVLink(m.code, m.market))}','_blank')`}">
          <div><span class="qs-code">${_dEsc(m.code)}</span>${mktTag}<span class="qs-name">${_dEsc(m.name)}</span>${priceHtml}</div>
          ${wlTags}
        </div>
        <div class="qs-actions">
          <a class="tv-btn" href="${getTVLink(m.code, m.market)}" target="_blank">圖↗</a>
          ${watchBtnHtml(m.code, m.market, m.name)}
          <span class="plan-add-btn" onclick="addToDailyPlan('${_dEsc(m.code)}',${_jsStr(m.name)})" title="加入今日作業清單">＋</span>
        </div>
      </div>`;
  }).join("");
};
window.handleQuickSearchKey = function(e) {
  const items = document.querySelectorAll("#quickSearchResults .qs-item");
  if (e.key === "Escape") { closeQuickSearch(); return; }
  if (!items.length) return;
  if (e.key === "ArrowDown") { e.preventDefault(); _qsActiveIdx = (_qsActiveIdx + 1) % items.length; renderQuickSearchResults(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); _qsActiveIdx = (_qsActiveIdx - 1 + items.length) % items.length; renderQuickSearchResults(); }
  else if (e.key === "Enter") {
    e.preventDefault();
    const tv = items[_qsActiveIdx]?.dataset.tv;
    if (tv) window.open(tv, "_blank");
  }
};

// ==================== 每日作業清單操作 ====================
window.addToDailyPlan = function(code, name) {
  if (dailyPlan.find(p => p.code === code)) { showToast(`${code} 已在作業清單中`, "warn"); return; }
  dailyPlan.push({ code, name, note: "" });
  saveDailyPlan(); _pendingPush = true; pushToCloud();
  dirtyTabs.add("strategy");
  if (activeTab === "strategy") renderStrategy();
  showToast(`已加入今日作業清單：${code} ${name}`, "success", 1800);
};
window.removePlan = function(code) {
  if (selectedPlanCode === code) selectedPlanCode = null;
  dailyPlan = dailyPlan.filter(p => p.code !== code);
  saveDailyPlan(); _pendingPush = true; pushToCloud();
  renderStrategy();
};
window.editPlanNote = function(tdElement, code) {
  const item = dailyPlan.find(p => p.code === code);
  const currentText = item?.note || "";
  tdElement.innerHTML = `<input type="text" class="note-input" value="${_dEsc(currentText)}" placeholder="打字後點外面儲存..." onclick="event.stopPropagation();">`;
  const input = tdElement.querySelector(".note-input");
  input.focus();
  const saveAction = () => {
    const it = dailyPlan.find(p => p.code === code);
    if (it) it.note = input.value.trim();
    saveDailyPlan(); _pendingPush = true; pushToCloud();
    renderStrategy();
  };
  input.onblur = saveAction;
  input.onkeypress = e => { if (e.key === "Enter") saveAction(); };
};
window.togglePlanSelect = function(code, event) {
  if (event.target.closest("span[onclick], button, select, a, input")) return;
  selectedPlanCode = selectedPlanCode === code ? null : code;
  renderStrategy();
};

// ==================== 「今日精選」渲染（含子分頁＋大盤曝險檢查表） ====================
const MAIL_AVATAR_COLORS = ["#4d7dc9", "#9b7ede", "#3ea8c7", "#38a982", "#c8953c", "#d6686e", "#5b8def", "#2ea99e"];
function mailAvatarColor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return MAIL_AVATAR_COLORS[h % MAIL_AVATAR_COLORS.length];
}
function mailTimeLabel() {
  const d = lastUpdateTime ? new Date(lastUpdateTime) : new Date();
  return d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });
}
function mailRankChangeText(code, rank, prevRanks) {
  if (!(code in prevRanks)) return "🆕 新進榜";
  const diff = prevRanks[code] - rank;
  if (diff > 0) return `名次▲${diff}`;
  if (diff < 0) return `名次▼${-diff}`;
  return "名次持平";
}
function mailActionsHtml(code, name) {
  return `<span class="mail-actions" onclick="event.stopPropagation()">
    ${watchBtnHtml(code, stockData[code]?.market || "TWSE", name)}
    <span class="plan-add-btn" onclick="addToDailyPlan('${_dEsc(code)}',${_jsStr(name)})" title="加入今日作業清單">＋</span>
  </span>`;
}

function toggleMailScoreSort() {
  mailUiState.scoreSort = mailUiState.scoreSort === "default" ? "desc" : mailUiState.scoreSort === "desc" ? "asc" : "default";
  renderStrategy();
}
function updateMailScoreParam(path, rawVal) {
  const val = parseFloat(rawVal);
  if (isNaN(val)) return;
  const keys = path.split(".");
  let obj = mailScoreParams;
  for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
  obj[keys[keys.length - 1]] = val;
  saveMailScoreParams(mailScoreParams);
  invalidateSectorCache();
  renderStrategy();
}
function updateMailScoreParamStr(path, rawVal) {
  const keys = path.split(".");
  let obj = mailScoreParams;
  for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
  obj[keys[keys.length - 1]] = rawVal;
  saveMailScoreParams(mailScoreParams);
  invalidateSectorCache();
  renderStrategy();
}
function resetMailScoreParams() {
  mailScoreParams = JSON.parse(JSON.stringify(MAIL_SCORE_DEFAULTS));
  saveMailScoreParams(mailScoreParams);
  invalidateSectorCache();
  renderStrategy();
  showToast("已還原收件匣加權預設參數", "info");
}
function toggleMailScorePanel() { mailScorePanelOpen = !mailScorePanelOpen; if (mailScorePanelOpen) mailUiState.inboxOpen = true; renderStrategy(); }
function toggleBacktestPanel() { backtestPanelOpen = !backtestPanelOpen; if (backtestPanelOpen) mailUiState.inboxOpen = true; renderStrategy(); }

function buildLeverageChecklistHtml() {
  const cfg = leverageChecklist;
  const kelly = computeKellyTiers(cfg);
  const { row: activeRow, outOfRange } = resolveLeverageZone(cfg);
  const inp = (field, val, step = 0.1) => `<input type="number" step="${step}" value="${val ?? ""}" onchange="updateLeverageParam('${field}', this.value)" style="width:70px;font-size:11.5px;padding:3px 5px;">`;
  const fmtX = v => (isFinite(v) ? v.toFixed(2) : "-") + "x";

  const rowsHtml = cfg.checklist.map((row, idx) => `
    <tr style="${activeRow === row ? "background:var(--amber-bg);font-weight:700;" : ""}">
      <td><input type="text" value="${_dEsc(row.label)}" onchange="updateLeverageRow(${idx},'label',this.value)" style="width:110px;font-size:11.5px;padding:3px 5px;"></td>
      <td><input type="number" step="100" value="${row.point}" onchange="updateLeverageRow(${idx},'point',this.value)" style="width:82px;font-size:11.5px;padding:3px 5px;text-align:right;"></td>
      <td><input type="number" step="0.1" value="${row.leverage}" onchange="updateLeverageRow(${idx},'leverage',this.value)" style="width:60px;font-size:11.5px;padding:3px 5px;text-align:right;">x</td>
      <td style="text-align:center;"><span class="msp-reset" style="padding:1px 6px;" onclick="removeLeverageRow(${idx})">✕</span></td>
    </tr>`).join("");

  const statusHtml = cfg.currentIndexPoint == null
    ? `<div style="color:var(--text-muted);">尚未輸入目前大盤點位，填入後會自動對照檔位。</div>`
    : activeRow
      ? `<div>目前 <strong>${cfg.currentIndexPoint}</strong> 點 → <strong style="color:var(--amber);">${_dEsc(activeRow.label)}（${activeRow.leverage}x）</strong>${outOfRange ? "　⚠️ 已超出檢查表最高門檻，建議依最新估值重算" : ""}</div>`
      : "";
  const headBadge = activeRow ? `<span class="mb-count" style="color:var(--amber);">${_dEsc(activeRow.label)} ${activeRow.leverage}x</span>` : "";

  return `
    <details class="mailbox" ${leverageChecklistOpen ? "open" : ""} ontoggle="leverageChecklistOpen=this.open">
      <summary class="mailbox-head">
        <span class="mb-title">🎯 大盤曝險檢查表（凱利公式動態槓桿）</span>
        ${headBadge}
        <span class="mb-chev">▸</span>
      </summary>
      <div class="mail-score-panel backtest-panel" onclick="event.stopPropagation()">
        <div class="msp-note">
          <strong>這是什麼</strong>
          <div>用凱利公式計算參考槓桿檔位（全凱利／黃金點／半凱利），並手動維護大盤點位對應的曝險檢查表（每季依估值更新一次）。</div>
        </div>
        <div class="msp-row">
          <strong>凱利參數</strong>
          <label>長期年化報酬 ${inp("expectedAnnualReturn", cfg.expectedAnnualReturn, 0.5)}%</label>
          <label>年化波動度 ${inp("volatility", cfg.volatility, 0.5)}%</label>
          <label>資金成本 ${inp("costOfCapital", cfg.costOfCapital, 0.1)}%</label>
          <label>黃金點比例 ${inp("goldenPointRatio", cfg.goldenPointRatio, 0.025)}</label>
        </div>
        <div class="msp-note">參考槓桿：全凱利 <strong>${fmtX(kelly.full)}</strong> ／ 黃金點 <strong>${fmtX(kelly.golden)}</strong> ／ 半凱利 <strong>${fmtX(kelly.half)}</strong></div>
        <div class="msp-row">
          <strong>目前點位</strong>
          <label>加權指數目前點位 ${inp("currentIndexPoint", cfg.currentIndexPoint ?? "", 10)}</label>
        </div>
        <div style="overflow-x:auto;">
          <table>
            <thead><tr><th>檔位名稱</th><th>點位門檻</th><th>槓桿倍數</th><th></th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <div class="msp-row">
          <span class="msp-reset" style="margin-left:0;" onclick="addLeverageRow()">＋新增檔位</span>
          <span class="msp-reset" onclick="resetLeverageChecklist()">↺ 還原預設值</span>
        </div>
        <div class="msp-note">${statusHtml}</div>
        <div class="msp-row">
          <input type="text" placeholder="備註：這組點位依什麼 EPS／本益比／哪一季設定..." value="${_dEsc(cfg.note || "")}" onchange="updateLeverageNote(this.value)" style="flex:1;font-size:12px;">
        </div>
      </div>
    </details>`;
}

function buildMailScorePanelHtml(p) {
  const inp = (path, val, step = 0.5) => `<input type="number" step="${step}" value="${val}" onchange="updateMailScoreParam('${path}', this.value)">`;
  const sel = (path, val, options) => `<select onchange="updateMailScoreParamStr('${path}', this.value)">${options.map(o => `<option value="${o}" ${o === val ? "selected" : ""}>${o}</option>`).join("")}</select>`;
  return `
    <div class="mail-score-panel" onclick="event.stopPropagation()">
      <div class="msp-note">
        <strong>分數怎麼算（前20名都算，純規則、不綁個股）</strong>
        <div>總分 = 正規化(名次分)×權重 + 正規化(加速度分)×權重 + 正規化(族群分)×權重。①名次分看近${p.rankMaDays}日名次移動平均＋名次變化微調；②加速度分比較近5日與前一個5日報酬；③族群分看合格池同族群密度；④低於淘汰門檻會經緩衝帶打折或歸零。</div>
      </div>
      <div class="msp-row">
        <strong>淘汰門檻</strong>
        <label>5日漲幅下限 ${inp("elimReturn5dMin", p.elimReturn5dMin)}%（緩衝 ${inp("elimReturn5dBuffer", p.elimReturn5dBuffer, 0.5)}%）</label>
        <label>退步淘汰名數 ${inp("elimRankDropMax", p.elimRankDropMax, 1)}（緩衝 ${inp("elimRankDropBuffer", p.elimRankDropBuffer, 1)}名）</label>
      </div>
      <div class="msp-row">
        <strong>名次分</strong>
        <label>移動平均天數 ${inp("rankMaDays", p.rankMaDays, 1)}</label>
        <label>位階 ${inp("rankLevelBase", p.rankLevelBase, 1)}−${inp("rankLevelMult", p.rankLevelMult, 1)}×均名（>${inp("rankLevelCutoffRank", p.rankLevelCutoffRank, 1)}名→${inp("rankLevelFloorScore", p.rankLevelFloorScore, 1)}分）</label>
        <label>delta 權重 ${inp("rankDeltaWeight", p.rankDeltaWeight, 0.1)}／進上限${inp("rankDeltaCapUp", p.rankDeltaCapUp, 1)}／退上限${inp("rankDeltaCapDown", p.rankDeltaCapDown, 1)}</label>
      </div>
      <div class="msp-row">
        <strong>加速度分</strong>
        <label>前段下限 ${inp("accelPriorMinReturn", p.accelPriorMinReturn, 0.5)}%</label>
        <label>≥${inp("accelBreaks.0", p.accelBreaks[0], 0.01)}→${inp("accelScores.0", p.accelScores[0], 1)}</label>
        <label>≥${inp("accelBreaks.1", p.accelBreaks[1], 0.01)}→${inp("accelScores.1", p.accelScores[1], 1)}</label>
        <label>≥${inp("accelBreaks.2", p.accelBreaks[2], 0.01)}→${inp("accelScores.2", p.accelScores[2], 1)}</label>
        <label>≥${inp("accelBreaks.3", p.accelBreaks[3], 0.01)}→${inp("accelScores.3", p.accelScores[3], 1)}</label>
        <label>其餘→${inp("accelScores.4", p.accelScores[4], 1)}</label>
      </div>
      <div class="msp-row">
        <strong>族群＆權重</strong>
        <label>上限 ${inp("sectorScoreCap", p.sectorScoreCap, 0.5)}／半飽和 ${inp("sectorScoreHalfLife", p.sectorScoreHalfLife, 0.1)}</label>
        <label>粒度 ${sel("sectorMatchMode", p.sectorMatchMode, ["all", "primary"])}</label>
        <label>正規化 ${sel("normalizeMethod", p.normalizeMethod, ["minmax", "zscore"])}</label>
        <label>名次 ${inp("weightRank", p.weightRank, 1)}</label>
        <label>加速 ${inp("weightAccel", p.weightAccel, 1)}</label>
        <label>族群 ${inp("weightSector", p.weightSector, 1)}</label>
        <span class="msp-reset" onclick="resetMailScoreParams()">↺ 還原預設</span>
      </div>
    </div>`;
}

const btImportInputHtml = `
  <input type="file" id="btImportInput" accept=".json,application/json" style="display:none" onchange="importBacktestHistoryFile(this)">
  <span class="msp-reset" onclick="document.getElementById('btImportInput').click()">📥 匯入歷史快照 JSON</span>`;

function buildBacktestPanelHtml(report, p) {
  if (!report.ready) {
    return `<div class="mail-score-panel backtest-panel" onclick="event.stopPropagation()">
      <div class="msp-note"><strong>回測結果</strong><div>${_dEsc(report.note)}</div></div>
      <div class="msp-row">${btImportInputHtml}</div>
    </div>`;
  }
  const fp = v => v == null ? "-" : `<span class="${v >= 0 ? "bt-pos" : "bt-neg"}">${v >= 0 ? "+" : ""}${v.toFixed(2)}%</span>`;
  const s = report.summary;
  const dayRows = report.days.slice(-15).reverse().map(d => `
    <tr>
      <td>${d.date}→${d.futureDate}</td>
      <td>${fp(d.avgFwdReturnWeightedTopK)}</td><td>${fp(d.avgFwdReturnPct5TopK)}</td>
      <td>${fp(d.avgFwdReturnAllTop20)}</td><td>${fp(d.avgFwdReturnRestOfMarket)}</td><td>${fp(d.avgFwdReturnBenchmark)}</td>
    </tr>`).join("");
  return `
    <div class="mail-score-panel backtest-panel" onclick="event.stopPropagation()">
      <div class="msp-note">
        <strong>回測結果（樣本 ${report.sampleDays} 天・未來第${p.backtestForwardMinOffset}~${p.backtestForwardMaxOffset}筆快照・前K=${p.backtestTopK}）</strong>
        <div>加權前K均報 ${fp(s.avgFwdReturnWeightedTopK)}（贏近5日勝率 ${s.weightedVsPct5WinRate ?? "-"}%）／ 近5日前K ${fp(s.avgFwdReturnPct5TopK)}</div>
        <div>前20整體 ${fp(s.avgFwdReturnAllTop20)}（贏前20外勝率 ${s.top20VsRestWinRate ?? "-"}%）／ 前20外 ${fp(s.avgFwdReturnRestOfMarket)} ／ 大盤(0050) ${fp(s.avgFwdReturnBenchmark)}</div>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>日期→未來</th><th>加權前K</th><th>近5日前K</th><th>前20整體</th><th>前20以外</th><th>大盤(0050)</th></tr></thead>
          <tbody>${dayRows}</tbody>
        </table>
      </div>
      <div class="msp-row">
        <span class="msp-reset" style="margin-left:0;" onclick="downloadBacktestJson()">⬇ 下載完整 JSON</span>
        ${btImportInputHtml}
      </div>
    </div>`;
}

function importBacktestHistoryFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      const rankHistory = loadGain10History();
      let rankAdded = 0;
      Object.entries(imported.rankHistory || {}).forEach(([date, ranks]) => { if (!(date in rankHistory)) { rankHistory[date] = ranks; rankAdded++; } });
      saveGain10History(rankHistory);

      const backtestHistory = loadMailScoreBacktestHistory();
      let backtestAdded = 0, benchmarkPatched = 0;
      Object.entries(imported.backtestHistory || {}).forEach(([date, snap]) => {
        if (!(date in backtestHistory)) { backtestHistory[date] = snap; backtestAdded++; }
        else if (backtestHistory[date].benchmark == null && snap.benchmark != null) { backtestHistory[date].benchmark = snap.benchmark; benchmarkPatched++; }
      });
      saveMailScoreBacktestHistory(backtestHistory);

      const adviceHistory = loadAdviceBacktestHistory();
      let adviceAdded = 0;
      Object.entries(imported.adviceHistory || {}).forEach(([date, snap]) => { if (!(date in adviceHistory)) { adviceHistory[date] = snap; adviceAdded++; } });
      saveAdviceBacktestHistory(adviceHistory);

      showToast(`匯入完成：名次+${rankAdded}、回測+${backtestAdded}、大盤補齊+${benchmarkPatched}、建議+${adviceAdded}`, "success", 4500);
      renderStrategy();
    } catch (e) { showToast("匯入失敗：JSON 格式不正確", "error"); }
    input.value = "";
  };
  reader.readAsText(file);
}

function downloadMailScoreJson() {
  const { scored } = computeGain10Snapshot(false);
  const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), params: mailScoreParams, stocks: scored }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `mail-score-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("已匯出當日分數 JSON", "success");
}
function downloadBacktestJson() {
  const report = computeBacktestReport(mailScoreParams);
  const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), params: mailScoreParams, ...report }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `mail-score-backtest-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(report.ready ? `已下載回測 JSON（樣本 ${report.sampleDays} 天）` : report.note, report.ready ? "success" : "warn", 4000);
}

function buildMailInboxHtml(snapshot) {
  const { top20, prevRanks, scored } = snapshot;
  if (!top20.length) return "";
  const timeLabel = mailTimeLabel();
  const scoreChip = s => {
    if (!s.inScope) return "";
    if (s.incomplete) return `<span class="score-chip na" title="資料不全，不計分">資料不全</span>`;
    const cls = s.total > 0 ? "pos" : s.total < 0 ? "neg" : "";
    const tapered = s.qualifiedWeight < 1;
    const tip = `名次分 ${s.rankScore.toFixed(1)}｜加速度分 ${s.accelNA ? "N/A" : s.accelScore}｜族群分 +${s.sectorScore.toFixed(1)}${tapered ? `\n緩衝帶打折 ×${s.qualifiedWeight.toFixed(2)}\n${s.eliminatedReasons.join("\n")}` : ""}`;
    return `<span class="score-chip ${cls}" style="${tapered ? "box-shadow:inset 0 0 0 1px var(--amber);" : ""}" title="${_dEsc(tip)}">${s.total >= 0 ? "+" : ""}${s.total}${tapered ? "⚡" : ""}</span>`;
  };
  let displayList = scored;
  if (mailUiState.scoreSort === "desc") displayList = [...scored].sort((a, b) => b.total - a.total);
  else if (mailUiState.scoreSort === "asc") displayList = [...scored].sort((a, b) => a.total - b.total);

  const rows = displayList.map(s => {
    const isHot = s.isNew || (s.rankChange != null && s.rankChange >= 100);
    const isUnread = s.isNew || (s.rankChange != null && s.rankChange > 0);
    const sectors = s.sectors.slice(0, 2).join("、");
    const tvLink = getTVLink(s.code, s.market || "TWSE");
    const newHighBadge = s.newHigh ? `<span class="tag tag-newhigh" title="收盤創近${s.newHighDays}日新高">🆕新高</span>`
      : s.newHighLive ? `<span class="tag tag-newhigh-live" title="盤中突破近期高點">⚡盤中新高</span>` : "";
    const growthBadge = s.growthTag ? `<span class="tag tag-growth" title="毛利${s.grossMargin}%・營益${s.opMargin}%・近3月營收YoY ${s.rev3moYoy}%">🚀騰雲型</span>` : "";
    return `
      <div class="mail-row">
        <span class="mail-star ${isHot ? "active" : ""}">${isHot ? "★" : "☆"}</span>
        <a class="mail-avatar rank-plain" href="${tvLink}" target="_blank" title="10日漲幅榜第${s.rank}名">${s.rank}</a>
        <a class="mail-sender-link" href="${tvLink}" target="_blank">
          <span class="mail-sender ${isUnread ? "unread" : ""}">${_dEsc(s.name)}<span class="mail-code">${_dEsc(s.code)}</span></span>
        </a>
        ${newHighBadge}${growthBadge}
        <span class="mail-subject ${isUnread ? "unread" : ""}">近10日 ${mailPct(s.pct10)}（5日 ${mailPct(s.pct5)}） <span class="mail-snippet">— ${mailRankChangeText(s.code, s.rank, prevRanks)}${sectors ? "・" + _dEsc(sectors) : ""}</span></span>
        ${scoreChip(s)}
        ${mailActionsHtml(s.code, s.name)}
        <span class="mail-time">${timeLabel}</span>
      </div>`;
  }).join("");

  const sortIcon = mailUiState.scoreSort === "desc" ? "🔽" : mailUiState.scoreSort === "asc" ? "🔼" : "⇅";
  return `
    <details class="mailbox" ${mailUiState.inboxOpen ? "open" : ""} ontoggle="mailUiState.inboxOpen=this.open">
      <summary class="mailbox-head">
        <span class="mb-title">📥 收件匣（10日強勢動能榜）</span>
        <span class="score-gear" title="說明／調整加權分數參數" onclick="event.preventDefault();event.stopPropagation();toggleMailScorePanel();">ⓘ</span>
        <span class="score-gear" title="切換分數排序" onclick="event.preventDefault();event.stopPropagation();toggleMailScoreSort();">${sortIcon}</span>
        <span class="score-gear" title="匯出當日分數 JSON" onclick="event.preventDefault();event.stopPropagation();downloadMailScoreJson();">⬇</span>
        <span class="score-gear" title="檢視回測結果" onclick="event.preventDefault();event.stopPropagation();toggleBacktestPanel();">🧪</span>
        <span class="mb-chev">▸</span><span class="mb-count">${top20.length}</span>
      </summary>
      ${mailScorePanelOpen ? buildMailScorePanelHtml(mailScoreParams) : ""}
      ${backtestPanelOpen ? buildBacktestPanelHtml(computeBacktestReport(mailScoreParams), mailScoreParams) : ""}
      ${rows}
    </details>`;
}

function buildMailThreadsHtml(snapshot) {
  const { top20, prevRanks } = snapshot;
  if (!top20.length) return "";
  const top20Codes = new Set(top20.map(s => s.code));
  const groups = {};
  top20.forEach((s, i) => {
    (STOCK_SECTORS_MAP[s.code] || []).forEach(sector => {
      if (!groups[sector]) groups[sector] = [];
      groups[sector].push({ ...s, rank: i + 1 });
    });
  });
  const themes = Object.entries(groups)
    .filter(([, m]) => m.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || Math.min(...a[1].map(m => m.rank)) - Math.min(...b[1].map(m => m.rank)))
    .slice(0, 6);
  if (!themes.length) return "";
  const timeLabel = mailTimeLabel();

  const threadRows = themes.map(([sector, membersRaw]) => {
    const members = membersRaw.sort((a, b) => a.rank - b.rank);
    const fullKey = sectorFullKeyByShortName(sector);
    const candidates = (fullKey ? (SECTORS[fullKey] || []) : [])
      .filter(st => !top20Codes.has(st.code) && stockData[st.code] && typeof stockData[st.code].pct10 === "number")
      .map(st => ({ code: st.code, name: STOCK_NAMES[st.code] || st.name, ...stockData[st.code] }))
      .sort((a, b) => (b.pct5 ?? -999) - (a.pct5 ?? -999))
      .slice(0, 3);
    const avatarStack = members.slice(0, 4).map(m => `<span class="mail-avatar" style="background:${mailAvatarColor(m.code)}">${m.rank}</span>`).join("");
    const memberReplies = members.map(m => `
      <div class="thread-reply">
        <a class="thread-reply-link" href="${getTVLink(m.code, stockData[m.code]?.market || "TWSE")}" target="_blank">
          <span class="mail-avatar" style="background:${mailAvatarColor(m.code)};width:20px;height:20px;font-size:9.5px;">${m.rank}</span>
          <strong>${_dEsc(m.name)}</strong><span class="mail-code">${_dEsc(m.code)}</span>
        </a>
        <span class="thread-figs num">10日 ${mailPct(m.pct10)} ・5日 ${mailPct(m.pct5)} ・${mailRankChangeText(m.code, m.rank, prevRanks)}</span>
        ${mailActionsHtml(m.code, m.name)}
      </div>`).join("");
    const candReplies = candidates.length ? `<div class="thread-label">草稿・尚未進榜</div>${candidates.map(c => `
      <div class="thread-reply">
        <a class="thread-reply-link" href="${getTVLink(c.code, c.market || "TWSE")}" target="_blank">
          <span class="mail-avatar" style="background:var(--text-faint);width:20px;height:20px;font-size:9.5px;">·</span>
          <strong>${_dEsc(c.name)}</strong><span class="mail-code">${_dEsc(c.code)}</span>
        </a>
        <span class="thread-figs num">10日 ${mailPct(c.pct10)} ・5日 ${mailPct(c.pct5)} ・今日 ${mailPct(c.pct1)}</span>
        ${mailActionsHtml(c.code, c.name)}
      </div>`).join("")}` : "";
    return `
      <details class="mail-thread">
        <summary class="mail-row">
          <span class="mail-star">☆</span>
          <span class="mail-avatar-stack">${avatarStack}</span>
          <span class="mail-sender unread">${_dEsc(sector)}</span>
          <span class="mail-subject unread">共 ${members.length + candidates.length} 封 <span class="mail-snippet">— 最高名次第 ${members[0].rank} 名</span></span>
          <span class="mail-time">${timeLabel}</span>
        </summary>
        <div class="thread-body">${memberReplies}${candReplies}</div>
      </details>`;
  }).join("");
  return `<details class="mailbox"><summary class="mailbox-head"><span class="mb-title">🔔 更新（族群題材串）</span><span class="mb-chev">▸</span><span class="mb-count">${themes.length}</span></summary>${threadRows}</details>`;
}

window._ss = { lk: "vsMarket10", ld: -1, rk: "pct1", rd: -1, tk: "pct10", td: -1, vk: "pct10", vd: -1, pk: "pct10", pd: -1, bk: "pct5", bd: -1, zk: "pct5", zd: -1, wk: "pct10", wd: -1, qk: "pct10", qd: -1 };
let stratSubTab = "longs"; // 'longs' | 'top' | 'pullback' | 'reversal' | 'rotation' | 'breakout' | 'quality' | 'tv'
window.setStratSubTab = function(t) { stratSubTab = t; renderStrategy(); };
window.sortStrat = function(t, k) {
  if (window._ss[t + "k"] === k) window._ss[t + "d"] *= -1;
  else { window._ss[t + "k"] = k; window._ss[t + "d"] = -1; }
  renderStrategy();
};

function renderStrategy() {
  const panel = document.getElementById("strategy");
  if (!panel) return;
  const stats = getSectorStats();
  const validStats = Object.entries(stats).filter(([, s]) => s);
  if (validStats.length === 0) {
    panel.innerHTML = `<div class="data-panel empty-state">尚未載入股價資料，請點擊上方「盤後更新」或至「設定」載入範例資料。</div>`;
    return;
  }

  const market = stockData["0050"] || { pct1: 0, pct5: 0, pct10: 0 };
  const beatCount = validStats.filter(([, s]) => s.vsMarket10 > 0).length;
  const dotColor = beatCount >= 13 ? "var(--down)" : beatCount >= 8 ? "var(--amber)" : "var(--up)";
  const statusLabel = beatCount >= 13 ? "強勢" : beatCount >= 8 ? "震盪" : "弱勢";

  const sortBy = (arr, t) => [...arr].sort((a, b) => {
    const k = window._ss[t + "k"], d = window._ss[t + "d"];
    if (k === "code" || k === "name") return d * String(a[k] || "").localeCompare(String(b[k] || ""));
    return d * ((b[k] || 0) - (a[k] || 0));
  });
  const th = (t, k, label, align = "right") => {
    const on = window._ss[t + "k"] === k;
    const arr = on ? (window._ss[t + "d"] > 0 ? " ↑" : " ↓") : "";
    return `<th class="${on ? "sort-active" : ""}" onclick="sortStrat('${t}','${k}')" style="text-align:${align};">${label}${arr}</th>`;
  };

  const longs = [...validStats.filter(([, s]) => s.vsMarket10 > 2 && s.pct5 > 0 && s.volTrend >= 1.1)].sort((a, b) => (b[1].vsMarket10 || 0) - (a[1].vsMarket10 || 0));
  const reversals = [...validStats.filter(([, s]) => s.pct10 < -5 && s.pct1 > 0)].sort((a, b) => (b[1].pct1 || 0) - (a[1].pct1 || 0));
  const hasPct5 = Object.values(stockData).filter(d => d.pct5 != null).length;

  let rawTop = [];
  longs.slice(0, 3).forEach(([sector]) => {
    (SECTORS[sector] || []).filter(s => stockData[s.code])
      .map(s => ({ ...s, ...stockData[s.code], sectorLabel: sector.split(". ")[1] || sector }))
      .filter(s => (s.pct5 || 0) > 0 && (s.amount || 0) >= 1)
      .sort((a, b) => (b.pct10 || 0) - (a.pct10 || 0))
      .slice(0, 3).forEach(s => rawTop.push(s));
  });
  const topStocks = sortBy(rawTop, "t");

  const uniqByCode = arr => arr.filter((v, i, a) => a.findIndex(t => t.code === v.code) === i);
  const allSectorStocks = Object.entries(SECTORS).flatMap(([sector, list]) =>
    list.filter(s => stockData[s.code]).map(s => ({ ...s, ...stockData[s.code], sectorLabel: sector.split(". ")[1] || sector }))
  );

  const tvStocks = sortBy(uniqByCode(allSectorStocks.filter(d => (d.pct10 || 0) >= 3 && (d.pct5 || 0) >= 0 && (d.pct1 || 0) >= -2 && (d.amount || 0) >= 1 && (d.volTrend || 0) >= 1.0)), "v").slice(0, 20);
  const breakouts = sortBy(uniqByCode(allSectorStocks.filter(s => (s.pct10 ?? 999) < 6 && (s.pct5 ?? -999) > 0 && (s.pct1 ?? -999) >= -1 && (s.volTrend ?? 0) >= 1.1 && (s.amount ?? 0) >= 0.5)), "b").slice(0, 25);
  const pullbacks = sortBy(uniqByCode(allSectorStocks.filter(s => (s.pct10 ?? -999) >= 5 && (s.pct5 ?? 999) >= -4 && (s.pct5 ?? 999) <= 1 && (s.pct1 ?? -999) >= -0.5 && (s.volTrend ?? 99) < 1.0 && (s.amount ?? 0) >= 1)), "w").slice(0, 20);
  const qualityMomentum = sortBy(uniqByCode(allSectorStocks.filter(s => (s.eps ?? 0) > 0 && s.per != null && s.per <= 25 && (s.pct10 ?? -999) >= 3 && (s.pct5 ?? -999) > 0 && (s.volTrend ?? 0) >= 1.0 && (s.amount ?? 0) >= 1)), "q").slice(0, 20);
  const hasFundamentals = Object.values(stockData).filter(d => d.per != null).length >= 5;

  const rotationSectors = validStats.filter(([, s]) => s.vsMarket10 < 0 && s.pct5 > 1 && s.volTrend >= 1.15);
  let rotationRaw = [];
  rotationSectors.forEach(([sector]) => {
    (SECTORS[sector] || []).filter(s => stockData[s.code])
      .map(s => ({ ...s, ...stockData[s.code], sectorLabel: sector.split(". ")[1] || sector }))
      .filter(s => (s.pct5 || 0) > 0 && (s.amount || 0) >= 1)
      .sort((a, b) => (b.pct5 || 0) - (a.pct5 || 0))
      .slice(0, 3).forEach(s => rotationRaw.push(s));
  });
  const rotations = sortBy(uniqByCode(rotationRaw), "z");

  // 今日作業清單
  const sortedPlan = sortBy(dailyPlan.map(p => ({ ...p, ...stockData[p.code] })), "p");
  const planHtml = `
    <div class="data-panel" style="padding:12px 14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${dailyPlan.length ? "10" : "4"}px;">
        <span style="font-size:13.5px;font-weight:700;color:var(--text-primary);">📌 今日作業清單 <span class="app-version" style="margin-left:4px;">${dailyPlan.length}</span></span>
        ${dailyPlan.length ? `<button class="btn xs" onclick="if(confirm('清空今日作業清單？')){dailyPlan=[];saveDailyPlan();_pendingPush=true;pushToCloud();renderStrategy();}">清空</button>` : ""}
      </div>
      ${dailyPlan.length === 0
        ? `<div style="font-size:12px;color:var(--text-muted);">從下方清單或快速搜尋（Ctrl+K）點「＋」加入候選標的</div>`
        : `<div class="table-wrap"><table class="stocks-table">
            <thead><tr>
              ${th("p", "code", "標的", "left")}${th("p", "price", "股價")}${th("p", "pct10", "10日%")}${th("p", "pct5", "5日%")}${th("p", "pct1", "今日%")}
              <th style="text-align:left;cursor:default;">備註</th>
              <th style="text-align:center;cursor:default;">關注</th>
              <th style="width:28px;cursor:default;"></th>
            </tr></thead><tbody>
              ${sortedPlan.map(p => `<tr class="${selectedPlanCode === p.code ? "row-selected" : ""}" onclick="togglePlanSelect('${_dEsc(p.code)}', event)" style="cursor:pointer;">
                <td><a href="${getTVLink(p.code, p.market)}" target="_blank" style="font-weight:700;">${_dEsc(p.code)}</a> <a href="${getTVLink(p.code, p.market)}" target="_blank" style="color:var(--text-secondary);">${_dEsc(p.name)}</a>${(STOCK_SECTORS_MAP[p.code] || []).length ? `<br>${(STOCK_SECTORS_MAP[p.code] || []).map(t => `<span class="tag" onclick="goToSector(${_jsStr(t)},event)">${_dEsc(t)}</span>`).join("")}` : ""}</td>
                <td class="num" style="text-align:right;">${p.price?.toFixed(2) ?? "-"}</td>
                <td class="num ${pctClass(p.pct10)}" style="text-align:right;">${fmtPct(p.pct10)}</td>
                <td class="num ${pctClass(p.pct5)}" style="text-align:right;">${fmtPct(p.pct5)}</td>
                <td class="num ${pctClass(p.pct1)}" style="text-align:right;">${fmtPct(p.pct1)}</td>
                <td style="max-width:180px;"><span class="note-display" onclick="event.stopPropagation();editPlanNote(this.parentElement,'${_dEsc(p.code)}')">${p.note ? _dEsc(p.note) : ""}</span></td>
                <td style="text-align:center;">${watchBtnHtml(p.code, p.market || "TWSE", p.name)}</td>
                <td style="text-align:center;"><span style="cursor:pointer;color:var(--text-muted);" onclick="removePlan('${_dEsc(p.code)}')">✕</span></td>
              </tr>`).join("")}
            </tbody></table></div>`}
    </div>`;

  // 進階篩選：統一表格渲染器（子分頁切換）
  const renderStockSubTable = (rows, tKey, opts = {}) => {
    if (!rows.length) return `<div class="empty-state">${_dEsc(opts.emptyText || "目前無符合條件的個股")}</div>`;
    return `<div class="table-wrap"><table class="stocks-table"><thead><tr>
      <th style="width:44px;text-align:center;cursor:default;">自選</th>
      ${th(tKey, "code", "代號", "left")}${th(tKey, "name", "名稱", "left")}<th style="cursor:default;">族群</th>
      ${opts.showSignal ? `<th style="text-align:right;cursor:default;">訊號</th>` : ""}
      ${th(tKey, "price", "股價")}
      ${opts.showFund ? `${th(tKey, "per", "PER")}${th(tKey, "eps", "EPS")}` : ""}
      ${th(tKey, "pct10", "10日%")}${th(tKey, "pct5", "5日%")}${th(tKey, "pct1", "今日%")}
      ${opts.showAmount ? th(tKey, "amount", "成交(億)") : th(tKey, "volTrend", "量能")}
      ${!opts.showFund ? `<th style="text-align:center;cursor:default;">品質</th>` : ""}
      <th style="text-align:center;cursor:default;">操作</th>
    </tr></thead><tbody>
      ${rows.map(s => {
        const sig = (s.pct10 >= 7 && s.pct5 >= 2 && s.pct1 >= 0) ? `<span class="neg-text">🟢強多</span>` : `<span style="color:var(--accent);">🔵趨勢</span>`;
        return `<tr>
          <td style="text-align:center;">${watchBtnHtml(s.code, s.market || "TWSE", s.name)}</td>
          <td style="font-weight:700;"><a href="${getTVLink(s.code, s.market)}" target="_blank">${_dEsc(s.code)}</a></td>
          <td><a href="${getTVLink(s.code, s.market)}" target="_blank" style="color:var(--text-primary);">${_dEsc(s.name)}</a></td>
          <td><span class="tag tag-muted" onclick="goToSector(${_jsStr(s.sectorLabel)},event)">${_dEsc(s.sectorLabel)}</span></td>
          ${opts.showSignal ? `<td style="text-align:right;">${sig}</td>` : ""}
          <td class="num" style="text-align:right;">${s.price?.toFixed(2) ?? "-"}</td>
          ${opts.showFund ? `<td class="num" style="text-align:right;color:var(--text-secondary);">${s.per?.toFixed(1) ?? "-"}</td><td class="num" style="text-align:right;color:var(--text-secondary);">${s.eps?.toFixed(2) ?? "-"}</td>` : ""}
          <td class="num ${pctClass(s.pct10)}" style="text-align:right;">${fmtPct(s.pct10)}</td>
          <td class="num ${pctClass(s.pct5)}" style="text-align:right;">${fmtPct(s.pct5)}</td>
          <td class="num ${pctClass(s.pct1)}" style="text-align:right;">${fmtPct(s.pct1)}</td>
          <td class="num" style="text-align:right;">${opts.showAmount ? (s.amount?.toFixed(1) ?? "-") : volTrendBadge(s.volTrend)}</td>
          ${!opts.showFund ? `<td style="text-align:center;" title="${stockData[s.code]?.yoy != null ? "YoY: " + stockData[s.code].yoy + "%" : ""}">${stockData[s.code]?.qualityTag ?? "-"}</td>` : ""}
          <td style="text-align:center;white-space:nowrap;">
            <a class="tv-btn" href="${getTVLink(s.code, s.market)}" target="_blank">圖↗</a>
            <span class="plan-add-btn" onclick="addToDailyPlan('${_dEsc(s.code)}',${_jsStr(s.name)})" title="加入今日作業清單">＋</span>
          </td>
        </tr>`;
      }).join("")}
    </tbody></table></div>`;
  };

  const subTabDefs = [
    { id: "longs", label: "🚀 推薦族群", cnt: longs.length, hint: "vs大盤>+2%・5日↑・量能≥1.1x" },
    { id: "top", label: "⭐ 精選個股", cnt: Math.min(topStocks.length, 9), hint: "前3強勢族群・10日排序・5日仍正・成交≥1億" },
    { id: "pullback", label: "🎯 拉回承接", cnt: pullbacks.length, hint: "10日≥+5%・5日-4%~+1%・量縮<1.0x・成交≥1億" },
    { id: "rotation", label: "⚡ 族群輪動", cnt: rotations.length, hint: "族群10日落後但5日轉強>+1%・量能≥1.15x" },
    { id: "breakout", label: "🌱 起漲候選", cnt: breakouts.length, hint: "5日轉正・10日<6%・量能≥1.1x・成交≥0.5億" },
    { id: "quality", label: "💎 質優動能", cnt: hasFundamentals ? qualityMomentum.length : 0, hint: "EPS>0・PER≤25・10日≥+3%・5日>0・量能≥1.0x" },
    { id: "tv", label: "📈 TV觀察", cnt: tvStocks.length, hint: "10日≥+3%・5日≥0・量能≥1.0x｜確認 EMA20/60" },
    { id: "reversal", label: "🔄 翻轉觀察", cnt: reversals.length, hint: "族群10日跌>5%・今日轉正" }
  ];

  const activeDef = subTabDefs.find(x => x.id === stratSubTab) || subTabDefs[0];
  let subBodyHtml = "";
  if (stratSubTab === "longs") {
    subBodyHtml = longs.length === 0
      ? `<div class="empty-state">目前無符合條件的強勢族群${hasPct5 < 5 ? "<br>⚠️ 尚無5日/10日資料，請先點「盤後更新」" : ""}</div>`
      : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;">
          ${longs.slice(0, 8).map(([sec2, s]) => `
            <div class="data-panel" style="margin:0;padding:12px;cursor:pointer;" onclick="currentSector=${_jsStr(sec2)};switchTab('stocks')">
              <div style="font-size:12.5px;font-weight:700;color:var(--text-primary);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_dEsc(sec2.split(". ")[1] || sec2)}</div>
              <div class="num ${pctClass(s.pct10)}" style="font-size:22px;font-weight:700;line-height:1.1;">${fmtPct(s.pct10)}</div>
              <div style="font-size:11.5px;margin-top:6px;color:var(--text-secondary);">vs大盤 <span class="num ${pctClass(s.vsMarket10)}">${fmtPct(s.vsMarket10)}</span></div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${volTrendBadge(s.volTrend)} ${s.amount.toFixed(0)}億 · ${s.count}/${s.total}檔</div>
            </div>`).join("")}
        </div>`;
  } else if (stratSubTab === "top") {
    subBodyHtml = renderStockSubTable(topStocks.slice(0, 9), "t", { showAmount: true });
  } else if (stratSubTab === "pullback") {
    subBodyHtml = renderStockSubTable(pullbacks, "w", { emptyText: "目前無「強勢股健康拉回」的個股" });
  } else if (stratSubTab === "rotation") {
    const chips = rotationSectors.length ? `<div class="chip-row" style="margin-bottom:10px;">${rotationSectors.map(([sec2, s]) => `
      <span class="filter-chip" style="background:var(--amber-bg);border-color:var(--amber-border);" onclick="currentSector=${_jsStr(sec2)};switchTab('stocks')">
        <strong style="color:var(--amber);">${_dEsc(sec2.split(". ")[1] || sec2)}</strong>
        <span class="num ${pctClass(s.pct10)}">${fmtPct(s.pct10)}</span> → <span class="num ${pctClass(s.pct5)}">${fmtPct(s.pct5)}</span> ${volTrendBadge(s.volTrend)}
      </span>`).join("")}</div>` : "";
    subBodyHtml = chips + renderStockSubTable(rotations, "z", { emptyText: "目前無族群輪動起漲訊號" });
  } else if (stratSubTab === "breakout") {
    subBodyHtml = renderStockSubTable(breakouts, "b");
  } else if (stratSubTab === "quality") {
    subBodyHtml = !hasFundamentals
      ? `<div class="callout callout-amber">⚠️ 尚無本益比/EPS 資料，請先到「設定」點「更新基本面」或「免費更新基本面」。</div>`
      : renderStockSubTable(qualityMomentum, "q", { showFund: true });
  } else if (stratSubTab === "tv") {
    subBodyHtml = renderStockSubTable(tvStocks, "v", { showSignal: true });
  } else if (stratSubTab === "reversal") {
    subBodyHtml = reversals.length === 0
      ? `<div class="empty-state">目前無翻轉觀察族群</div>`
      : `<div class="chip-row">${reversals.map(([sec2, s]) => `
          <span class="filter-chip" onclick="currentSector=${_jsStr(sec2)};switchTab('stocks')">
            <strong>${_dEsc(sec2.split(". ")[1] || sec2)}</strong>
            <span class="num ${pctClass(s.pct10)}">${fmtPct(s.pct10)}</span> → <span class="num ${pctClass(s.pct1)}">${fmtPct(s.pct1)}</span>
          </span>`).join("")}</div>`;
  }

  const gain10Snapshot = computeGain10Snapshot(false);

  panel.innerHTML = `
    <div class="market-temp-bar">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="width:9px;height:9px;border-radius:50%;background:${dotColor};display:inline-block;"></span>
        <strong style="font-size:13.5px;">大盤體溫：${statusLabel}</strong>
        <span style="color:var(--text-muted);">${beatCount}/${validStats.length} 族群跑贏大盤</span>
      </div>
      <div style="margin-left:auto;display:flex;gap:14px;flex-wrap:wrap;" class="num">
        <span>0050 10日 <span class="${pctClass(market.pct10)}">${fmtPct(market.pct10)}</span></span>
        <span>5日 <span class="${pctClass(market.pct5)}">${fmtPct(market.pct5)}</span></span>
        <span>今日 <span class="${pctClass(market.pct1)}">${fmtPct(market.pct1)}</span></span>
      </div>
    </div>

    ${planHtml}
    ${buildMailInboxHtml(gain10Snapshot)}
    ${buildMailThreadsHtml(gain10Snapshot)}
    ${buildLeverageChecklistHtml()}

    <div class="data-panel">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
        <h3 style="margin:0;">📎 進階篩選清單</h3>
        <span style="font-size:11.5px;color:var(--text-muted);">${_dEsc(activeDef.hint)}</span>
      </div>
      <div class="strat-subtabs">
        ${subTabDefs.map(t => `<button class="filter-chip ${stratSubTab === t.id ? "active" : ""}" onclick="setStratSubTab('${t.id}')">${t.label}<span class="cnt">${t.cnt}</span></button>`).join("")}
      </div>
      ${subBodyHtml}
    </div>
  `;
}

// ==================== 族群排行（不裁切長條圖＋全部展開/收合） ====================
window.toggleAllRankingSectors = function() {
  const stats = getSectorStats();
  const validKeys = Object.entries(stats).filter(([, s]) => s).map(([k]) => k);
  if (expandedSectors.size > 0) expandedSectors.clear();
  else validKeys.slice(0, 5).forEach(k => expandedSectors.add(k));
  renderRanking();
};

function renderRanking() {
  const vixCard = document.getElementById("vixCard");
  if (vixCard && vixtwn) {
    const sign = vixtwn.pct1 >= 0 ? "+" : "";
    const cls = vixtwn.pct1 > 0 ? "pos-text" : vixtwn.pct1 < 0 ? "neg-text" : "flat-text";
    vixCard.style.display = "flex";
    vixCard.style.borderLeft = `4px solid ${vixtwn.price >= 40 ? "var(--up)" : vixtwn.price >= 30 ? "var(--amber)" : "var(--down)"}`;
    document.getElementById("vixPrice").textContent = vixtwn.price;
    const pctEl = document.getElementById("vixPct");
    pctEl.textContent = `${sign}${vixtwn.pct1 ?? "-"}%`;
    pctEl.className = `num ${cls}`;
    document.getElementById("vixTime").textContent = `${vixtwn.date} ${vixtwn.time}`;
  }

  const toggleBtn = document.getElementById("rankingExpandToggleBtn");
  if (toggleBtn) toggleBtn.textContent = expandedSectors.size > 0 ? `全部收合 (${expandedSectors.size})` : "展開前 5 族群";

  const stats = getSectorStats();
  const sortKey = document.getElementById("rankingSort").value;
  const sorted = Object.entries(stats).filter(([, s]) => s).sort((a, b) => (b[1][sortKey] || 0) - (a[1][sortKey] || 0));
  const container = document.getElementById("rankingBars");
  container.innerHTML = "";
  if (sorted.length === 0) {
    container.innerHTML = `<div class="data-panel empty-state">尚未載入資料，請先點上方「盤後更新」或至「設定」載入範例。</div>`;
    return;
  }

  const isPct = sortKey.startsWith("pct"), isVol = sortKey === "volTrend";
  const maxAbs = Math.max(...sorted.map(([, s]) => Math.abs(s[sortKey] || 0)), 1);

  // 複合熱度分數
  const heatList = Object.entries(SECTORS).map(([name, stocks]) => {
    const wd = stocks.map(st => stockData[st.code]).filter(d => d && d.price != null);
    if (!wd.length) return null;
    const p10 = wd.reduce((s, d) => s + (d.pct10 || 0), 0) / wd.length;
    const p5 = wd.reduce((s, d) => s + (d.pct5 || 0), 0) / wd.length;
    const amt = wd.reduce((s, d) => s + (d.amount || 0), 0);
    return { name, p10, p5, amt, score: 0 };
  }).filter(Boolean);
  const heatMap = {};
  if (heatList.length) {
    const maxAmt = Math.max(...heatList.map(h => h.amt), 1);
    heatList.forEach(h => { h.score = h.p10 * 0.5 + h.p5 * 0.3 + (h.amt / maxAmt * 10) * 0.2; heatMap[h.name] = h.score; });
    const top3 = [...heatList].sort((a, b) => b.score - a.score).slice(0, 3);
    const hb = document.getElementById("rk_heatBody");
    if (hb) {
      const medals = ["🥇 主力倉", "🥈 次要倉", "🥉 觀察倉"], allocs = ["35-40%", "20-25%", "10-15%"];
      hb.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:4px;">${
        top3.map((h, i) => `<div style="background:var(--surface-2);border:1px solid var(--amber-border);border-radius:8px;padding:10px 12px;cursor:pointer;" onclick="event.stopPropagation();currentSector=${_jsStr(h.name)};switchTab('stocks')">
          <div style="font-size:11px;color:var(--text-muted);">${medals[i]}</div>
          <div style="font-weight:700;font-size:13.5px;margin:3px 0;color:var(--amber);">${_dEsc(h.name)}</div>
          <div style="font-size:11.5px;color:var(--text-secondary);" class="num">熱度 <strong style="color:var(--text-primary);">${h.score.toFixed(1)}</strong>　建議 <strong>${allocs[i]}</strong></div>
        </div>`).join("")
      }</div><div style="margin-top:6px;font-size:11px;color:var(--text-muted);">公式：10日漲幅×0.5 + 5日漲幅×0.3 + 成交金額標準化×0.2</div>`;
    }
  }

  sorted.forEach(([sector, s], idx) => {
    const rank = idx + 1;
    const val = s[sortKey] || 0;
    const isExpanded = expandedSectors.has(sector);
    const fillLabel = isPct ? fmtPct(val) : isVol ? val.toFixed(2) + "x" : val.toFixed(0) + "億";
    const valCls = isPct ? pctClass(val) : "pos-text";
    const tierCls = rank <= 5 ? "tier-1" : rank <= 10 ? "tier-2" : rank <= 15 ? "tier-3" : "";
    const row = document.createElement("div");
    row.className = `bar-row ${isExpanded ? "expanded" : tierCls}`;
    const hs = heatMap[sector];
    const hsBadge = hs != null ? `<span class="num" style="font-size:11px;color:var(--amber);font-weight:700;white-space:nowrap;">🔥${hs.toFixed(1)}</span>` : "";
    const barW = Math.max(2, Math.min(100, (Math.abs(val) / maxAbs * 100))).toFixed(1);
    const isNegBar = isPct && val < 0;

    row.innerHTML = `
      <div class="bar-name" title="${_dEsc(sector)}">
        <span class="bar-rank">${rank}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;">${_dEsc(sector)}</span>
        <span style="font-size:9px;color:var(--text-muted);flex-shrink:0;">${isExpanded ? "▲" : "▼"}</span>
      </div>
      <div class="bar-track ${isNegBar ? "is-neg" : ""}">
        <div class="bar-fill ${isNegBar ? "neg" : "pos"}" style="width:${barW}%"></div>
      </div>
      <div class="bar-val ${valCls}">${fillLabel}</div>
      <div class="bar-pct">${s.count}/${s.total}</div>
      <div style="text-align:center;">${volTrendBadge(s.volTrend)}</div>
      <div style="text-align:right;">${hsBadge}</div>
      <div class="bar-sparkline" style="display:flex;align-items:center;justify-content:center;">${renderHeatSparkline(sector)}</div>
    `;
    row.onclick = () => {
      if (expandedSectors.has(sector)) expandedSectors.delete(sector);
      else expandedSectors.add(sector);
      renderRanking();
    };
    container.appendChild(row);

    if (isExpanded) {
      const sectorStocks = (SECTORS[sector] || [])
        .filter(st => stockData[st.code])
        .map(st => ({ ...st, ...stockData[st.code] }))
        .sort((a, b) => rankingExpandSort.dir * ((b[rankingExpandSort.key] || 0) - (a[rankingExpandSort.key] || 0)));
      const panel = document.createElement("div");
      panel.className = "expand-panel";
      if (sectorStocks.length === 0) {
        panel.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">尚無報價資料</div>`;
      } else {
        const rk = rankingExpandSort;
        const sortTh = (key, label, align = "right") => `<th class="${rk.key === key ? "sort-active" : ""}" style="text-align:${align};" onclick="event.stopPropagation();rankingExpandSort={key:'${key}',dir:rankingExpandSort.key==='${key}'?-rankingExpandSort.dir:-1};renderRanking()">${label}${rk.key === key ? (rk.dir === -1 ? " ▼" : " ▲") : ""}</th>`;
        const usLine = SECTOR_US[sector] ? `<div class="callout callout-info" style="margin:0 0 8px;padding:6px 10px;"><strong>核心美股：</strong>${_dEsc(SECTOR_US[sector])}<span style="color:var(--text-muted);margin-left:8px;font-size:11px;">★=NVIDIA點名</span></div>` : "";
        const tableRows = sectorStocks.map(st => {
          const dajiaBadge = STOCK_DAJIA[st.code] ? `<span class="tag tag-dajia" title="${_dEsc(STOCK_DAJIA[st.code])}">🏆大甲型</span>` : "";
          return `<tr>
            <td style="text-align:center;">${watchBtnHtml(st.code, st.market || "TWSE", st.name)}</td>
            <td><a href="${getTVLink(st.code, st.market)}" target="_blank" style="font-weight:700;" onclick="event.stopPropagation()">${_dEsc(st.code)}</a></td>
            <td>${_dEsc(st.name)} ${dajiaBadge}</td>
            <td class="num" style="text-align:right;">${st.price?.toFixed(2) ?? "-"}</td>
            <td class="num ${pctClass(st.pct10)}" style="text-align:right;">${fmtPct(st.pct10)}</td>
            <td class="num ${pctClass(st.pct5)}" style="text-align:right;">${fmtPct(st.pct5)}</td>
            <td class="num ${pctClass(st.pct1)}" style="text-align:right;">${fmtPct(st.pct1)}</td>
            <td class="num" style="text-align:right;color:var(--text-secondary);">${st.amount?.toFixed(1) ?? "-"}</td>
            <td class="num" style="text-align:right;color:var(--text-secondary);">${st.per != null ? st.per.toFixed(1) : "-"}</td>
            <td class="num" style="text-align:right;color:var(--text-secondary);">${st.eps != null ? st.eps.toFixed(2) : "-"}</td>
            <td style="text-align:center;" title="${st.yoy != null ? "月營收YoY: " + st.yoy + "%" : ""}">${st.qualityTag ?? "-"}</td>
            <td style="text-align:center;"><span class="plan-add-btn" onclick="event.stopPropagation();addToDailyPlan('${_dEsc(st.code)}',${_jsStr(st.name)})" title="加入今日作業清單">＋</span></td>
          </tr>`;
        }).join("");
        panel.innerHTML = `${usLine}<div class="table-wrap"><table class="stocks-table">
          <thead><tr>
            <th style="width:44px;text-align:center;cursor:default;">自選</th><th style="cursor:default;">代號</th><th style="cursor:default;">名稱</th>
            ${sortTh("price", "股價")}${sortTh("pct10", "10日%")}${sortTh("pct5", "5日%")}${sortTh("pct1", "今日%")}${sortTh("amount", "成交(億)")}${sortTh("per", "PER")}${sortTh("eps", "EPS")}
            <th style="text-align:center;cursor:default;">品質</th><th style="width:40px;text-align:center;cursor:default;">作業</th>
          </tr></thead><tbody>${tableRows}</tbody></table></div>
          <div style="text-align:right;margin-top:8px;"><button class="btn sm" onclick="event.stopPropagation();currentSector=${_jsStr(sector)};switchTab('stocks')">查看完整明細 →</button></div>`;
      }
      container.appendChild(panel);
    }
  });
}

// ==================== 族群明細 ====================
window.goToSector = function(shortName, event) {
  if (event) event.stopPropagation();
  const fullName = Object.keys(SECTORS).find(k => (k.split(". ")[1] || k) === shortName);
  if (!fullName) return;
  currentSector = fullName;
  switchTab("stocks");
};

window.goToStock = function(code) {
  const si = document.getElementById("searchInput");
  const sr = document.getElementById("searchResults");
  if (si) si.value = "";
  if (sr) sr.innerHTML = "";
  currentSector = null;
  stockSearchQ = code;
  const ssi = document.getElementById("stockSearchInput");
  if (ssi) ssi.value = code;
  dirtyTabs.add("stocks");
  switchTab("stocks");
};

function renderStocks() {
  const select = document.getElementById("sectorSelect");
  if (select && select.options.length === 0) {
    select.innerHTML = '<option value="__all__">— 全部族群 —</option>' + Object.keys(SECTORS).map(s => `<option value="${_dEsc(s)}">${_dEsc(s)}</option>`).join("");
  }
  if (select) select.value = currentSector || "__all__";

  let stocks = currentSector && currentSector !== "__all__"
    ? (SECTORS[currentSector] || [])
    : Object.values(SECTORS).flat().filter((v, i, a) => a.findIndex(t => t.code === v.code) === i);
  let rows = stocks.map(s => ({ ...s, ...stockData[s.code] }));
  if (stockSearchQ) rows = rows.filter(s => s.code.includes(stockSearchQ) || (s.name || "").toUpperCase().includes(stockSearchQ));
  else rows = rows.filter(s => s.price != null);
  if (stockNewHighOnly) rows = rows.filter(s => s.newHigh || s.newHighLive);
  rows.sort((a, b) => {
    if (stockSortKey === "code" || stockSortKey === "name") return stockSortDir * String(b[stockSortKey] || "").localeCompare(String(a[stockSortKey] || ""));
    return stockSortDir * (((b[stockSortKey] ?? -999) - (a[stockSortKey] ?? -999)));
  });

  const banner = document.getElementById("sectorUSBanner");
  if (banner) {
    const isSector = currentSector && currentSector !== "__all__";
    const usInfo = isSector ? SECTOR_US[currentSector] : null;
    const ss = isSector ? (getSectorStats()[currentSector] || null) : null;
    const spark = isSector ? renderHeatSparkline(currentSector) : "";
    const sparkRow = ss ? `
      <div class="market-temp-bar" style="margin-bottom:8px;">
        ${spark ? `<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:11.5px;color:var(--text-muted);">近期走勢</span>${spark}</div>` : ""}
        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;" class="num">
          <span>10日 <span class="${pctClass(ss.pct10)}">${fmtPct(ss.pct10)}</span></span>
          <span>5日 <span class="${pctClass(ss.pct5)}">${fmtPct(ss.pct5)}</span></span>
          <span>今日 <span class="${pctClass(ss.pct1)}">${fmtPct(ss.pct1)}</span></span>
          <span>量能 ${volTrendBadge(ss.volTrend)}</span>
          <span style="color:var(--text-muted);font-size:11.5px;">${ss.count}/${ss.total}檔</span>
        </div>
      </div>` : "";
    const usRow = usInfo ? `<div class="callout callout-info" style="margin:0 0 8px;padding:7px 12px;"><strong>核心美股參考：</strong>${_dEsc(usInfo)} <span style="color:var(--text-muted);margin-left:8px;font-size:11px;">★=NVIDIA點名</span></div>` : "";
    banner.innerHTML = sparkRow + usRow;
  }

  document.querySelectorAll("#stocksTable th[data-sort]").forEach(th => {
    const base = th.textContent.replace(/\s*[↕↑↓]$/, "");
    const active = th.dataset.sort === stockSortKey;
    th.classList.toggle("sort-active", active);
    th.textContent = base + " " + (active ? (stockSortDir === -1 ? "↓" : "↑") : "↕");
  });

  const tbody = document.getElementById("stocksTbody");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="12" class="empty-state">找不到符合條件的標的</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(s => {
    const usTags = STOCK_US[s.code] ? `<span class="tag tag-us">🇺🇸 ${_dEsc(STOCK_US[s.code])}</span>` : "";
    const pwrTag = STOCK_POWER_LAYER[s.code] ? `<span class="tag tag-pwr">${_dEsc(STOCK_POWER_LAYER[s.code])}</span>` : "";
    const dajiaTag = STOCK_DAJIA[s.code] ? `<span class="tag tag-dajia" title="${_dEsc(STOCK_DAJIA[s.code])}">🏆大甲型</span>` : "";
    const newHighTag = s.newHigh ? `<span class="tag tag-newhigh" title="收盤價創近${s.newHighDays}日新高">🆕新高</span>`
      : s.newHighLive ? `<span class="tag tag-newhigh-live" title="盤中突破近期高點">⚡盤中新高</span>` : "";
    const growthTag = s.growthTag ? `<span class="tag tag-growth" title="毛利率${s.grossMargin}%・營益率${s.opMargin}%・近3月YoY ${s.rev3moYoy}%">🚀騰雲型</span>` : "";
    return `<tr>
      <td style="text-align:center;">${watchBtnHtml(s.code, s.market || "TWSE", s.name)}</td>
      <td><a href="${getTVLink(s.code, s.market)}" target="_blank" style="font-weight:700;">${_dEsc(s.code)}</a></td>
      <td class="wrap-cell"><a href="${getTVLink(s.code, s.market)}" target="_blank" style="font-weight:700;color:var(--text-primary);">${_dEsc(s.name)}</a><br>${(STOCK_SECTORS_MAP[s.code] || []).map(t => `<span class="tag" onclick="goToSector(${_jsStr(t)},event)">${_dEsc(t)}</span>`).join("")}${usTags}${pwrTag}${dajiaTag}${newHighTag}${growthTag}</td>
      <td class="num" style="text-align:right;">${s.price?.toFixed(2) ?? "-"}</td>
      <td class="num ${pctClass(s.pct1)}" style="text-align:right;">${fmtPct(s.pct1)}</td>
      <td class="num ${pctClass(s.pct5)}" style="text-align:right;">${fmtPct(s.pct5)}</td>
      <td class="num ${pctClass(s.pct10)}" style="text-align:right;">${fmtPct(s.pct10)}</td>
      <td class="num" style="text-align:right;">${s.amount?.toFixed(1) ?? "-"}</td>
      <td class="num" style="text-align:right;color:var(--text-secondary);">${s.per != null ? s.per.toFixed(1) : "-"}</td>
      <td class="num" style="text-align:right;color:var(--text-secondary);">${s.eps != null ? s.eps.toFixed(2) : "-"}</td>
      <td style="text-align:center;" title="${s.yoy != null ? "月營收YoY: " + s.yoy + "%" : ""}">${s.qualityTag ?? "-"}</td>
      <td style="text-align:center;"><span class="plan-add-btn" onclick="addToDailyPlan('${_dEsc(s.code)}',${_jsStr(s.name)})" title="加入今日作業清單">＋</span></td>
    </tr>`;
  }).join("");
}

// ==================== 關注頁：搜尋、分類管理、凍結窗格、檢視切換與非破壞性排序 ====================
window.handleSearch = function() {
  const q = document.getElementById("searchInput").value.trim();
  const resDiv = document.getElementById("searchResults");
  if (!q) { resDiv.innerHTML = ""; return; }
  const matches = collectSearchMatches(q);
  if (!matches.length) { resDiv.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:6px 0;">查無「${_dEsc(q)}」</div>`; return; }

  resDiv.innerHTML = matches.slice(0, 12).map(m => {
    const isTW = m.market === "TWSE" || m.market === "TPEX";
    const marketTag = isTW ? "" : `<span class="tag tag-us" style="margin:0 0 0 6px;">${_dEsc(m.market)}</span>`;
    const priceHtml = stockData[m.code]?.price != null ? `<span class="qs-price num">${stockData[m.code].price.toFixed(2)}</span>` : "";
    return `
      <div class="qs-item" style="margin-bottom:6px;">
        <div class="qs-main" onclick="${isTW ? `goToStock('${_dEsc(m.code)}')` : ""}">
          <span class="qs-code">${_dEsc(m.code)}</span>${marketTag}
          <span class="qs-name">${_dEsc(m.name)}</span>${priceHtml}
        </div>
        <div class="qs-actions">
          <a class="tv-btn" href="${getTVLink(m.code, m.market)}" target="_blank">圖↗</a>
          ${watchBtnHtml(m.code, m.market, m.name)}
          <span class="plan-add-btn" onclick="addToDailyPlan('${_dEsc(m.code)}',${_jsStr(m.name)})" title="加入作業清單">＋</span>
        </div>
      </div>`;
  }).join("");
};

window.toggleWatchlist = function(code) {
  if (!watchlists[currentWatchGroup]) watchlists[currentWatchGroup] = [];
  const list = watchlists[currentWatchGroup];
  if (list.includes(code)) {
    watchlists[currentWatchGroup] = list.filter(c => c !== code);
    const stillWatched = Object.values(watchlists).some(l => l.includes(code));
    if (!stillWatched) {
      if (code in stockNotes) { delete stockNotes[code]; stockNotesTs = Date.now(); }
      if (window._t4_data && window._t4_data.some(h => h.code === code)) {
        window._t4_data = window._t4_data.filter(h => h.code !== code);
        holdingsTs = Date.now();
        try { localStorage.setItem("fdc_holdings", JSON.stringify(window._t4_data)); localStorage.setItem("fdc_holdings_ts", holdingsTs); } catch (e) {}
      }
    }
    showToast(`已從「${currentWatchGroup}」移除 ${code}`, "info", 1800);
  } else {
    watchlists[currentWatchGroup].push(code);
    showToast(`已加入「${currentWatchGroup}」：${code}`, "success", 1800);
  }
  watchlistsTs = Date.now();
  saveData();
  markTabsDirty();
  renderActiveTab(true);
  if (document.getElementById("searchInput")?.value) handleSearch();
};

window.updateWatchGroupOptions = function() {
  const sel = document.getElementById("watchGroupSelect");
  if (!sel) return;
  sel.innerHTML = Object.keys(watchlists).map(k => `<option value="${_dEsc(k)}">${_dEsc(k)} (${(watchlists[k] || []).length})</option>`).join("");
  sel.value = currentWatchGroup;
};
window.changeWatchGroup = function() {
  currentWatchGroup = document.getElementById("watchGroupSelect").value;
  renderWatchlist();
  if (document.getElementById("searchInput").value) handleSearch();
};

let _watchGroupInputMode = "add";
window.showAddGroupInput = function() {
  _watchGroupInputMode = "add";
  const row = document.getElementById("watchGroupInputRow"), inp = document.getElementById("watchGroupNameInput");
  row.style.display = "flex"; inp.value = ""; inp.placeholder = "輸入新分類名稱"; inp.focus();
  inp.onkeydown = e => { if (e.key === "Enter") confirmWatchGroupInput(); if (e.key === "Escape") cancelWatchGroupInput(); };
};
window.showRenameGroupInput = function() {
  _watchGroupInputMode = "rename";
  const row = document.getElementById("watchGroupInputRow"), inp = document.getElementById("watchGroupNameInput");
  row.style.display = "flex"; inp.value = currentWatchGroup; inp.placeholder = "輸入新名稱"; inp.focus(); inp.select();
  inp.onkeydown = e => { if (e.key === "Enter") confirmWatchGroupInput(); if (e.key === "Escape") cancelWatchGroupInput(); };
};
window.confirmWatchGroupInput = function() {
  const inp = document.getElementById("watchGroupNameInput");
  const name = inp.value.trim();
  if (!name) return;
  if (_watchGroupInputMode === "add") {
    if (watchlists[name]) { showToast("分類名稱已存在", "warn"); return; }
    watchlists[name] = [];
    currentWatchGroup = name;
  } else {
    if (name === currentWatchGroup) { cancelWatchGroupInput(); return; }
    if (watchlists[name]) { showToast("分類名稱已存在", "warn"); return; }
    watchlists[name] = watchlists[currentWatchGroup];
    delete watchlists[currentWatchGroup];
    currentWatchGroup = name;
  }
  watchlistsTs = Date.now();
  cancelWatchGroupInput();
  saveData(); updateUI(false); handleSearch();
  showToast(_watchGroupInputMode === "add" ? `已新增分類「${name}」` : `已改名為「${name}」`, "success");
};
window.cancelWatchGroupInput = function() { document.getElementById("watchGroupInputRow").style.display = "none"; };
window.deleteWatchGroup = function() {
  if (Object.keys(watchlists).length <= 1) { showToast("系統必須保留至少一個自選分類", "warn"); return; }
  if (confirm(`確定要刪除「${currentWatchGroup}」群組嗎？`)) {
    const old = currentWatchGroup;
    delete watchlists[currentWatchGroup];
    currentWatchGroup = Object.keys(watchlists)[0];
    watchlistsTs = Date.now();
    saveData(); updateUI(false); handleSearch();
    showToast(`已刪除分類「${old}」`, "info");
  }
};

window.setWlViewMode = function(mode) {
  wlViewMode = mode;
  try { localStorage.setItem("fdc_wl_view_mode", mode); } catch (e) {}
  const tbl = document.getElementById("watchlistTable");
  if (tbl) {
    tbl.classList.remove("wl-view-quote", "wl-view-hold");
    if (mode === "quote") tbl.classList.add("wl-view-quote");
    else if (mode === "hold") tbl.classList.add("wl-view-hold");
  }
  document.querySelectorAll("#wlViewSeg .seg-btn").forEach(b => b.classList.toggle("active", b.dataset.view === mode));
};

window.resetWlSort = function() { wlSortKey = "custom"; renderWatchlist(); };
window.applyWlSortToCustom = function() {
  if (wlSortKey === "custom") return;
  const sortedCodes = getSortedWatchlistCodes();
  watchlists[currentWatchGroup] = sortedCodes;
  watchlistsTs = Date.now();
  wlSortKey = "custom";
  saveData();
  renderWatchlist();
  showToast("已將目前排序儲存為自訂順序", "success");
};

const WL_QUALITY_RANK = { "🟢業績股": 3, "🟡普通": 2, "🔴題材股": 1, "⚫虧損": 0 };
const WL_SORT_LABELS = { code: "代號", price: "收盤價", pct1: "當日%", pct5: "5日%", pct10: "10日%", advice: "今日建議", amount: "成交金額", vsMarket10: "10日對比大盤", quality: "品質", days: "持有天數", entry: "成本", shares: "股數", pct: "市值占比", ret: "損益%" };

function wlAdviceRank(code) {
  const s = stockData[code] || {}, hd = (window._t4_data || []).find(h => h.code === code);
  const hdRet = hd ? ((s.price ?? hd.entry) - hd.entry) / hd.entry * 100 : null;
  const label = getActionAdvice(s, hdRet).label;
  return label === "加碼" ? 3 : label === "獲利了結" ? 2 : label === "觀察" ? 1 : 0;
}
function wlSortValue(code, key) {
  const s = stockData[code] || {};
  if (key === "advice") return wlAdviceRank(code);
  if (key === "vsMarket10") return vsMarketPct(code, "pct10");
  if (key === "quality") return WL_QUALITY_RANK[s.qualityTag] ?? -1;
  const hd = (window._t4_data || []).find(h => h.code === code);
  if (key === "days") return hd ? Math.floor((Date.now() - new Date(hd.date)) / 86400000) : null;
  if (key === "entry") return hd ? hd.entry : null;
  if (key === "shares") return hd && hd.shares ? hd.shares : null;
  if (key === "pct") {
    if (!hd || !hd.shares) return null;
    const total = holdingsTotalValue(watchlists[currentWatchGroup] || []);
    return total ? ((s.price ?? hd.entry) * hd.shares) / total * 100 : null;
  }
  if (key === "ret") return hd ? ((s.price ?? hd.entry) - hd.entry) / hd.entry * 100 : null;
  return s[key];
}
function getSortedWatchlistCodes() {
  const list = [...(watchlists[currentWatchGroup] || [])];
  if (wlSortKey === "custom") return list;
  const k = wlSortKey, d = wlSortDir;
  if (k === "code") return list.sort((a, b) => d * b.localeCompare(a));
  return list.sort((a, b) => d * ((wlSortValue(b, k) ?? -99999) - (wlSortValue(a, k) ?? -99999)));
}

// 持股統計
const SECTOR_BAR_COLORS = ["#5b8def", "#e2b45a", "#52c48c", "#f07178", "#b598f2", "#5cc8e6", "#d96aa7"];
let wlWeightMode = localStorage.getItem("fdc_wl_weight_mode") === "equal" ? "equal" : "value";
function primarySector(code) { return (STOCK_SECTORS_MAP[code] && STOCK_SECTORS_MAP[code][0]) || "其他"; }
function holdingsWithValue(codes) {
  const list = codes ? (window._t4_data || []).filter(h => codes.includes(h.code)) : (window._t4_data || []);
  return list.map(h => { const price = stockData[h.code]?.price ?? h.entry; return { ...h, price, value: h.shares ? price * h.shares : null }; });
}
function holdingsTotalValue(codes) { return holdingsWithValue(codes).reduce((a, h) => a + (h.value || 0), 0); }
function holdingsGroupBreakdown(codes, mode) {
  mode = mode || wlWeightMode;
  if (mode === "equal") {
    const all = codes ? (window._t4_data || []).filter(h => codes.includes(h.code)) : (window._t4_data || []);
    if (!all.length) return [];
    const sums = {};
    all.forEach(h => { const g = primarySector(h.code); sums[g] = (sums[g] || 0) + 1; });
    return Object.entries(sums).map(([name, value]) => ({ name, value, pct: value / all.length * 100 })).sort((a, b) => b.value - a.value);
  }
  const list = holdingsWithValue(codes).filter(h => h.value != null);
  if (!list.length) return [];
  const total = list.reduce((a, h) => a + h.value, 0), sums = {};
  list.forEach(h => { const g = primarySector(h.code); sums[g] = (sums[g] || 0) + h.value; });
  return Object.entries(sums).map(([name, value]) => ({ name, value, pct: value / total * 100 })).sort((a, b) => b.value - a.value);
}
function getHoldingsSectorColorMap(codes) {
  const map = {};
  holdingsGroupBreakdown(codes).forEach((g, gi) => { map[g.name] = SECTOR_BAR_COLORS[gi % SECTOR_BAR_COLORS.length]; });
  return map;
}
function sectorTagHtml(t, colorMap) {
  const c = colorMap && colorMap[t];
  const style = c ? ` style="background:${c}22;color:${c};border-color:${c}66;"` : "";
  return `<span class="tag"${style} onclick="goToSector(${_jsStr(t)},event)">${_dEsc(t)}</span>`;
}
function holdingsDailyPct(codes, mode) {
  mode = mode || wlWeightMode;
  if (mode === "equal") {
    const all = codes ? (window._t4_data || []).filter(h => codes.includes(h.code)) : (window._t4_data || []);
    const list = all.filter(h => stockData[h.code]?.pct1 != null);
    if (!list.length) return null;
    return { pct: list.reduce((a, h) => a + stockData[h.code].pct1, 0) / list.length, count: list.length };
  }
  const list = holdingsWithValue(codes).filter(h => h.value != null && stockData[h.code]?.pct1 != null);
  if (!list.length) return null;
  const total = list.reduce((a, h) => a + h.value, 0);
  return { pct: list.reduce((a, h) => a + stockData[h.code].pct1 * h.value, 0) / total, count: list.length };
}
window.setWlWeightMode = function(mode) {
  if (wlWeightMode === mode) return;
  wlWeightMode = mode;
  try { localStorage.setItem("fdc_wl_weight_mode", mode); } catch (e) {}
  renderWatchlist();
};

function renderWlHoldingsSummary() {
  const el = document.getElementById("wlHoldingsSummary");
  if (!el) return;
  const codes = watchlists[currentWatchGroup] || [];
  const all = (window._t4_data || []).filter(h => codes.includes(h.code));
  if (!all.length) { el.innerHTML = ""; return; }

  const withShares = holdingsWithValue(codes).filter(h => h.value != null);
  const groups = holdingsGroupBreakdown(codes);
  const daily = holdingsDailyPct(codes);
  const dailyHtml = daily ? `<span style="font-size:12.5px;">📈 持股今日綜合：<span class="num ${pctClass(daily.pct)}" style="font-weight:700;">${fmtPct(daily.pct)}</span> <span style="color:var(--text-muted);font-size:11.5px;">（${daily.count}檔）</span></span>` : "";

  const headerRow = `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
    ${dailyHtml}
    <div class="seg-group">
      <button class="seg-btn ${wlWeightMode === "value" ? "active" : ""}" onclick="setWlWeightMode('value')">市值加權</button>
      <button class="seg-btn ${wlWeightMode === "equal" ? "active" : ""}" onclick="setWlWeightMode('equal')">等權重</button>
    </div>
  </div>`;

  if (!groups.length) {
    el.innerHTML = `<div class="data-panel" style="padding:10px 14px;">${headerRow}<div style="font-size:12px;color:var(--text-muted);">已有 ${all.length} 檔持有記錄，在表格填入「股數」或切到等權重即可計算族群占比。</div></div>`;
    return;
  }
  const totalValText = wlWeightMode === "value" ? `・總市值約 ${Math.round(withShares.reduce((a, h) => a + h.value, 0)).toLocaleString()} 元` : "";
  el.innerHTML = `<div class="data-panel" style="padding:10px 14px;">
    ${headerRow}
    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:6px;">族群持股比例（${wlWeightMode === "equal" ? "等權重" : "依市值"}${totalValText}）</div>
    <div style="display:flex;height:8px;border-radius:999px;overflow:hidden;margin-bottom:8px;">
      ${groups.map((g, gi) => `<div style="width:${g.pct}%;background:${SECTOR_BAR_COLORS[gi % SECTOR_BAR_COLORS.length]};" title="${_dEsc(g.name)} ${g.pct.toFixed(0)}%"></div>`).join("")}
    </div>
    <div class="chip-row">
      ${groups.map((g, gi) => `<span class="status-pill"><span style="width:7px;height:7px;border-radius:50%;background:${SECTOR_BAR_COLORS[gi % SECTOR_BAR_COLORS.length]};display:inline-block;"></span>${_dEsc(g.name)} <strong>${g.pct.toFixed(0)}%</strong></span>`).join("")}
    </div>
  </div>`;
}

function renderWatchlist() {
  updateWatchGroupOptions();
  setWlViewMode(wlViewMode);
  renderWlHoldingsSummary();

  const sortBar = document.getElementById("wlSortBar");
  if (sortBar) {
    if (wlSortKey !== "custom") {
      sortBar.innerHTML = `<div class="wl-sort-bar">
        <span>目前為臨時排序：依 <strong>${WL_SORT_LABELS[wlSortKey] || wlSortKey}</strong>（${wlSortDir === -1 ? "高→低" : "低→高"}），不會覆蓋原本手動拖曳順序</span>
        <div style="display:flex;gap:6px;">
          <button class="btn xs" onclick="resetWlSort()">恢復自訂順序</button>
          <button class="btn primary xs" onclick="applyWlSortToCustom()">套用為自訂順序</button>
        </div>
      </div>`;
    } else {
      sortBar.innerHTML = "";
    }
  }

  const tbody = document.getElementById("watchlistTbody");
  if (!tbody) return;
  const currentList = watchlists[currentWatchGroup] || [];
  if (currentList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="19" class="empty-state">分類【${_dEsc(currentWatchGroup)}】目前是空的</td></tr>`;
    return;
  }
  const totalHoldingsValue = holdingsTotalValue(currentList);
  const sectorColorMap = getHoldingsSectorColorMap(currentList);
  const orderedCodes = getSortedWatchlistCodes();
  const isCustomOrder = wlSortKey === "custom";

  let rows = orderedCodes.map(code => {
    const d = stockData[code] || {};
    let globalEntry = null;
    for (const [mkt, list] of Object.entries(GLOBAL_LIST)) {
      const found = list.find(g => g.code === code);
      if (found) { globalEntry = { ...found, market: mkt }; break; }
    }
    const name = STOCK_NAMES[code] || stockMeta[code]?.name || US_STOCK_NAMES[code] || globalEntry?.name || "自訂標的";
    const market = d.market || stockMeta[code]?.market || globalEntry?.market || "TWSE";
    return { code, name, market, ...d };
  });

  if (wlNewHighOnly) rows = rows.filter(s => s.newHigh || s.newHighLive);
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="19" class="empty-state">分類【${_dEsc(currentWatchGroup)}】裡目前沒有創新高的標的</td></tr>`;
    return;
  }

  const otherGroups = Object.keys(watchlists).filter(k => k !== currentWatchGroup);

  tbody.innerHTML = rows.map((s, idx) => {
    const wlUsTag = STOCK_US[s.code] ? `<span class="tag tag-us">🇺🇸 ${_dEsc(STOCK_US[s.code])}</span>` : "";
    const wlPwrTag = STOCK_POWER_LAYER[s.code] ? `<span class="tag tag-pwr">${_dEsc(STOCK_POWER_LAYER[s.code])}</span>` : "";
    const wlNewHighTag = s.newHigh ? `<span class="tag tag-newhigh" title="收盤價創近${s.newHighDays}日新高">🆕新高</span>`
      : s.newHighLive ? `<span class="tag tag-newhigh-live" title="盤中突破近期高點">⚡盤中新高</span>` : "";
    const wlGrowthTag = s.growthTag ? `<span class="tag tag-growth">🚀騰雲型</span>` : "";
    const hd = (window._t4_data || []).find(h => h.code === s.code);
    const hdDays = hd ? Math.floor((Date.now() - new Date(hd.date)) / 86400000) : null;
    const hdRet = hd ? ((s.price ?? hd.entry) - hd.entry) / hd.entry * 100 : null;
    const hdValue = hd && hd.shares ? (s.price ?? hd.entry) * hd.shares : null;
    const hdPct = hdValue != null && totalHoldingsValue > 0 ? hdValue / totalHoldingsValue * 100 : null;
    const adv = getActionAdvice(s, hdRet);

    const dragControls = isCustomOrder
      ? `<div style="cursor:grab;font-size:15px;line-height:1;" onmousedown="document.getElementById('wlr_${idx}').draggable=true" onmouseup="document.getElementById('wlr_${idx}').draggable=false" title="拖曳調整順序">≡</div>
         <div style="display:flex;justify-content:center;gap:2px;margin-top:2px;">
           <span style="cursor:pointer;font-size:9px;padding:1px 3px;background:var(--surface-2);border-radius:3px;" onmousedown="event.stopPropagation()" onclick="wlMove(${idx},-1)">▲</span>
           <span style="cursor:pointer;font-size:9px;padding:1px 3px;background:var(--surface-2);border-radius:3px;" onmousedown="event.stopPropagation()" onclick="wlMove(${idx},1)">▼</span>
         </div>`
      : `<span style="font-size:11px;color:var(--text-faint);" title="恢復自訂順序後可拖曳">${idx + 1}</span>`;

    return `
    <tr id="wlr_${idx}" ${isCustomOrder ? `ondragover="wlDragOver(event,${idx})" ondrop="wlDrop(event,${idx})" ondragend="wlDragEnd(event)" ondragstart="wlDragStart(event,${idx})"` : ""}>
      <td class="wl-col-order" style="text-align:center;color:var(--text-muted);user-select:none;">${dragControls}</td>
      <td style="text-align:center;"><span style="cursor:pointer;color:var(--text-muted);font-size:13px;" onclick="toggleWatchlist('${_dEsc(s.code)}')" title="從此分類移除">✕</span></td>
      <td class="col-sticky wrap-cell">
        <a href="${getTVLink(s.code, s.market)}" target="_blank" style="font-weight:700;">${_dEsc(s.code)}</a>
        <a href="${getTVLink(s.code, s.market)}" target="_blank" style="font-weight:600;color:var(--text-primary);margin-left:5px;">${_dEsc(s.name)}</a><br>
        ${(STOCK_SECTORS_MAP[s.code] || []).map(t => sectorTagHtml(t, sectorColorMap)).join("")}${wlUsTag}${wlPwrTag}${wlNewHighTag}${wlGrowthTag}
      </td>
      <td class="num" style="text-align:right;">${s.price?.toFixed(2) ?? "-"}</td>
      <td class="num ${pctClass(s.pct1)}" style="text-align:right;">${fmtPct(s.pct1)}</td>
      <td class="wl-col-quote-ext num ${pctClass(s.pct5)}" style="text-align:right;">${fmtPct(s.pct5)}</td>
      <td class="wl-col-quote-ext num ${pctClass(s.pct10)}" style="text-align:right;">${fmtPct(s.pct10)}</td>
      <td style="text-align:center;"><span class="advice-badge advice-${adv.cls}" title="${_dEsc(adv.reason)}">${adv.label}</span></td>
      <td class="wl-col-quote-ext num" style="text-align:right;">${s.amount?.toFixed(1) ?? "-"}</td>
      <td class="wl-col-quote-ext num" style="text-align:right;font-size:11.5px;" title="5日 / 10日 對比大盤(0050)">${wlVsCell(vsMarketPct(s.code, "pct5"))} <span style="color:var(--text-faint);">/</span> ${wlVsCell(vsMarketPct(s.code, "pct10"))}</td>
      <td class="wl-col-quote-ext" style="text-align:center;" title="${s.yoy != null ? "YoY: " + s.yoy + "%" : ""}">${s.qualityTag ?? "-"}</td>
      <td class="wl-col-quote-ext" style="text-align:center;"><span class="plan-add-btn" onclick="addToDailyPlan('${_dEsc(s.code)}',${_jsStr(s.name)})" title="加入今日作業清單">＋</span></td>
      <td class="wl-col-hold num" onclick="editHoldingDays(this,'${_dEsc(s.code)}',${_jsStr(s.name)},${s.price ?? null})" style="text-align:right;cursor:pointer;" title="點擊填持有天數">${hdDays !== null ? `<span class="note-display">${hdDays}天</span>` : '<span class="note-display">&nbsp;</span>'}</td>
      <td class="wl-col-hold num" onclick="editHoldingCost(this,'${_dEsc(s.code)}',${_jsStr(s.name)},${s.price ?? null})" style="text-align:right;cursor:pointer;" title="點擊填成本價">${hd ? `<span class="note-display">${hd.entry}</span>` : '<span class="note-display">&nbsp;</span>'}</td>
      <td class="wl-col-hold num" onclick="editHoldingShares(this,'${_dEsc(s.code)}',${_jsStr(s.name)},${s.price ?? null})" style="text-align:right;cursor:pointer;" title="點擊填股數">${hd && hd.shares ? `<span class="note-display">${hd.shares.toLocaleString()}</span>` : '<span class="note-display">&nbsp;</span>'}</td>
      <td class="wl-col-hold num" style="text-align:right;color:var(--text-secondary);">${hdPct != null ? hdPct.toFixed(1) + "%" : "-"}</td>
      <td class="wl-col-hold num" style="text-align:right;">${hdRet !== null ? `<span class="${pctClass(hdRet)}" style="font-weight:700;">${fmtPct(hdRet)}</span> <span style="cursor:pointer;font-size:10px;color:var(--text-muted);" onclick="removeHolding('${_dEsc(s.code)}')" title="移除持有">✕</span>` : '<span class="flat-text">-</span>'}</td>
      <td class="wl-col-hold">
        <select id="cpy_${_dEsc(s.code)}" onchange="copyToGroup('${_dEsc(s.code)}',this.value)" style="font-size:11.5px;padding:3px 5px;max-width:105px;">
          <option value="">複製到…</option>
          ${otherGroups.map(k => `<option value="${_dEsc(k)}">${_dEsc(k)}</option>`).join("")}
        </select>
      </td>
      <td class="wl-col-note wrap-cell" onclick="editNote(this, '${_dEsc(s.code)}')"><span class="note-display">${_dEsc(stockNotes[s.code] || "")}</span></td>
    </tr>`;
  }).join("");

  document.querySelectorAll("#watchlistTable th[data-sort]").forEach(th => {
    const base = th.textContent.replace(/\s*[↕↑↓]$/, "");
    const active = th.dataset.sort === wlSortKey;
    th.classList.toggle("sort-active", active);
    th.textContent = base + " " + (active ? (wlSortDir === -1 ? "↓" : "↑") : "↕");
  });
}

// 持股內嵌編輯與拖曳排序
function upsertHolding(code, name, date, entry, shares) {
  if (entry == null || isNaN(entry) || entry <= 0) return false;
  window._t4_data = window._t4_data || [];
  const idx = window._t4_data.findIndex(h => h.code === code);
  const existingShares = idx !== -1 ? window._t4_data[idx].shares : undefined;
  const rec = { code, name, date, entry, shares: shares !== undefined ? shares : existingShares };
  if (idx !== -1) window._t4_data[idx] = rec;
  else window._t4_data.push(rec);
  holdingsTs = Date.now();
  try { localStorage.setItem("fdc_holdings", JSON.stringify(window._t4_data)); localStorage.setItem("fdc_holdings_ts", holdingsTs); } catch (e) {}
  _pendingPush = true; pushToCloud();
  return true;
}
window.removeHolding = function(code) {
  if (!window._t4_data) return;
  if (!confirm("移除持有記錄？")) return;
  window._t4_data = window._t4_data.filter(h => h.code !== code);
  holdingsTs = Date.now();
  try { localStorage.setItem("fdc_holdings", JSON.stringify(window._t4_data)); localStorage.setItem("fdc_holdings_ts", holdingsTs); } catch (e) {}
  _pendingPush = true; pushToCloud();
  renderWatchlist();
};
window.editHoldingDays = function(td, code, name, price) {
  const hd = (window._t4_data || []).find(h => h.code === code);
  const cur = hd ? Math.floor((Date.now() - new Date(hd.date)) / 86400000) : "";
  td.onclick = null;
  td.innerHTML = `<input type="number" class="note-input" value="${cur}" placeholder="天數" min="0" style="width:56px;text-align:right;">`;
  const inp = td.querySelector("input"); inp.focus(); inp.select();
  const save = () => {
    const raw = inp.value.trim();
    if (raw !== "") {
      const days = parseInt(raw, 10);
      if (!isNaN(days) && days >= 0) {
        const date = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
        const entry = hd ? hd.entry : price;
        if (entry == null) { showToast("請先在「成本」欄填入成本價", "warn"); renderWatchlist(); return; }
        upsertHolding(code, name, date, entry);
      }
    }
    renderWatchlist();
  };
  inp.onblur = save; inp.onkeypress = e => { if (e.key === "Enter") save(); };
};
window.editHoldingCost = function(td, code, name, price) {
  const hd = (window._t4_data || []).find(h => h.code === code);
  td.onclick = null;
  td.innerHTML = `<input type="number" class="note-input" value="${hd ? hd.entry : ""}" placeholder="成本" step="0.01" style="width:68px;text-align:right;">`;
  const inp = td.querySelector("input"); inp.focus(); inp.select();
  const save = () => {
    const raw = inp.value.trim();
    if (raw !== "") {
      const entry = parseFloat(raw);
      if (!isNaN(entry) && entry > 0) upsertHolding(code, name, hd ? hd.date : new Date().toISOString().slice(0, 10), entry);
    }
    renderWatchlist();
  };
  inp.onblur = save; inp.onkeypress = e => { if (e.key === "Enter") save(); };
};
window.editHoldingShares = function(td, code, name) {
  const hd = (window._t4_data || []).find(h => h.code === code);
  td.onclick = null;
  td.innerHTML = `<input type="number" class="note-input" value="${hd && hd.shares ? hd.shares : ""}" placeholder="股數" min="0" step="1" style="width:68px;text-align:right;">`;
  const inp = td.querySelector("input"); inp.focus(); inp.select();
  const save = () => {
    const raw = inp.value.trim();
    if (raw !== "") {
      if (!hd) { showToast("請先填入「成本」才能設定股數", "warn"); renderWatchlist(); return; }
      const shares = parseInt(raw, 10);
      if (!isNaN(shares) && shares >= 0) upsertHolding(code, name, hd.date, hd.entry, shares);
    }
    renderWatchlist();
  };
  inp.onblur = save; inp.onkeypress = e => { if (e.key === "Enter") save(); };
};
window.editNote = function(td, code) {
  const currentText = stockNotes[code] || "";
  td.onclick = null;
  td.innerHTML = `<input type="text" class="note-input" value="${_dEsc(currentText)}" placeholder="打字後按 Enter 儲存...">`;
  const inp = td.querySelector("input"); inp.focus();
  const save = () => {
    const nextText = inp.value.trim();
    if (nextText) stockNotes[code] = nextText; else delete stockNotes[code];
    stockNotesTs = Date.now();
    saveData();
    td.innerHTML = `<span class="note-display">${_dEsc(stockNotes[code] || "")}</span>`;
    td.onclick = () => editNote(td, code);
  };
  inp.onblur = save; inp.onkeypress = e => { if (e.key === "Enter") save(); };
};
window.copyToGroup = function(code, targetGroup) {
  if (!targetGroup || !watchlists[targetGroup]) return;
  const sel = document.getElementById(`cpy_${code}`);
  if (watchlists[targetGroup].includes(code)) {
    showToast(`${code} 已在「${targetGroup}」中`, "warn");
    if (sel) sel.value = "";
    return;
  }
  watchlists[targetGroup].push(code);
  watchlistsTs = Date.now();
  saveData();
  if (sel) sel.value = "";
  showToast(`已複製 ${code} 到「${targetGroup}」`, "success", 1800);
};
window.manualAddGlobalStock = function() {
  const raw = prompt("請輸入海外標的代號（例如 SE、BRK.B）：");
  if (!raw || !raw.trim()) return;
  const code = raw.trim().toUpperCase();
  if (watchlists[currentWatchGroup].includes(code)) { showToast(`${code} 已在「${currentWatchGroup}」中`, "warn"); return; }
  const name = prompt("標的名稱（選填，方便辨識）：", code) || code;
  watchlists[currentWatchGroup].push(code);
  stockMeta[code] = { market: "US", name };
  stockMetaTs = Date.now();
  watchlistsTs = Date.now();
  saveData(); renderWatchlist();
  showToast(`已加入 ${code} 到「${currentWatchGroup}」`, "success");
};

let _wlDragIdx = null;
window.wlDragStart = function(e, idx) { _wlDragIdx = idx; e.dataTransfer.effectAllowed = "move"; e.currentTarget.style.opacity = "0.4"; };
window.wlDragEnd = function(e) { e.currentTarget.style.opacity = ""; e.currentTarget.draggable = false; _wlDragIdx = null; };
window.wlDragOver = function(e) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
window.wlDrop = function(e, idx) {
  e.preventDefault();
  if (_wlDragIdx === null || _wlDragIdx === idx) return;
  const list = [...(watchlists[currentWatchGroup] || [])];
  const [moved] = list.splice(_wlDragIdx, 1);
  list.splice(idx, 0, moved);
  watchlists[currentWatchGroup] = list;
  _wlDragIdx = null; watchlistsTs = Date.now(); saveData(); renderWatchlist();
};
window.wlMove = function(idx, dir) {
  const list = [...(watchlists[currentWatchGroup] || [])];
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= list.length) return;
  [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
  watchlists[currentWatchGroup] = list;
  watchlistsTs = Date.now(); saveData(); renderWatchlist();
};

// ==================== 美股 FDC（含搜尋＋一鍵跳轉對應台股族群） ====================
function setUsFilter(mode) { usFilterMode = usFilterMode === mode ? "all" : mode; renderUsStocks(); }
function setUsSectorSort(key) { usSectorSortKey = key; renderUsStocks(); }
function toggleUsSectorExpand(sector) {
  if (usExpandedSectors.has(sector)) usExpandedSectors.delete(sector);
  else usExpandedSectors.add(sector);
  renderUsStocks();
}
function sortUsRanking(key) {
  if (usRankSortKey === key) usRankSortDir *= -1;
  else { usRankSortKey = key; usRankSortDir = (key === "code" || key === "name") ? -1 : 1; }
  renderUsRanking();
}
function filterUsStockEntries(entries) {
  let out = entries;
  if (usFilterMode === "held") out = out.filter(([, s]) => s.held);
  else if (usFilterMode === "dream") out = out.filter(([, s]) => s.quality === "⚫虧損" || s.quality === "🚀高成長(未獲利)");
  if (usSearchQ) {
    out = out.filter(([code, s]) =>
      code.toUpperCase().includes(usSearchQ) ||
      (US_STOCK_NAMES[code] || "").toUpperCase().includes(usSearchQ) ||
      (s.sector || "").toUpperCase().includes(usSearchQ)
    );
  }
  return out;
}
function matchTwSectorForUs(usSector) {
  const numMatch = String(usSector || "").match(/^(\d+)\./);
  if (numMatch) {
    const found = Object.keys(SECTORS).find(k => k.startsWith(numMatch[1] + "."));
    if (found) return found;
  }
  const clean = String(usSector || "").replace(/^\d+\.\s*/, "");
  return Object.keys(SECTORS).find(k => k.includes(clean.slice(0, 3))) || null;
}

function computeUsRanking() {
  if (!usStocksData || !usStocksData.stocks) return { ranked: [] };
  const p = US_SCORE_PARAMS;
  const list = filterUsStockEntries(Object.entries(usStocksData.stocks))
    .filter(([, s]) => typeof s.pct10 === "number")
    .map(([code, s]) => ({ code, name: US_STOCK_NAMES[code] || code, ...s }))
    .sort((a, b) => b.pct10 - a.pct10);
  if (!list.length) return { ranked: [] };
  const snapshotDate = (usStocksData.updated || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const history = loadUsGainHistory();
  const priorDates = Object.keys(history).filter(d => d < snapshotDate).sort();
  const prevRanks = priorDates.length ? history[priorDates[priorDates.length - 1]] : {};
  const currentRanks = {};
  list.forEach((s, i) => { currentRanks[s.code] = i + 1; });
  history[snapshotDate] = currentRanks;
  saveUsGainHistory(history);
  const rankMaLookup = computeRankMovingAverages(list, history, snapshotDate, p.rankMaDays);
  const raw = list.map((s, i) => {
    const rank = i + 1, isNew = !(s.code in prevRanks), rankChange = isNew ? null : (prevRanks[s.code] - rank);
    const rankMa = rankMaLookup[s.code] != null ? rankMaLookup[s.code] : rank;
    const rankLevelScore = rankMa <= p.rankLevelCutoffRank ? (p.rankLevelBase - p.rankLevelMult * rankMa) : p.rankLevelFloorScore;
    let rankDeltaScore = 0;
    if (!isNew && rankChange) rankDeltaScore = rankChange > 0 ? Math.min(p.rankDeltaWeight * rankChange, p.rankDeltaCapUp) : -Math.min(p.rankDeltaWeight * Math.abs(rankChange), p.rankDeltaCapDown);
    const rankScore = rankLevelScore + rankDeltaScore;
    let accelScore = 0;
    if (s.close5Ref != null && s.close10Ref) {
      const prior5 = ((s.close5Ref - s.close10Ref) / s.close10Ref) * 100, recent5 = s.pct5;
      if (prior5 <= p.accelPriorMinReturn) {
        if (prior5 > p.accelFreshBreakoutFloor && recent5 != null && recent5 >= p.accelFreshBreakoutMinReturn5d) accelScore = p.accelFreshBreakoutScore;
      } else {
        const ratio = recent5 / prior5, [b1, b2, b3, b4] = p.accelBreaks, [v1, v2, v3, v4, v5] = p.accelScores;
        accelScore = ratio >= b1 ? v1 : ratio >= b2 ? v2 : ratio >= b3 ? v3 : ratio >= b4 ? v4 : v5;
      }
    }
    return { ...s, rank, isNew, rankChange, rankMa, rankScore, accelScore };
  });
  const normRank = makeMailScoreNormalizer(raw.map(r => r.rankScore), "minmax");
  const normAccel = makeMailScoreNormalizer(raw.map(r => r.accelScore), "minmax");
  return { ranked: raw.map(r => ({ ...r, total: Math.round((normRank(r.rankScore) * p.weightRank + normAccel(r.accelScore) * p.weightAccel) * 10) / 10 })) };
}

function renderUsRanking() {
  const el = document.getElementById("usRankingTable");
  if (!el) return;
  const { ranked } = computeUsRanking();
  if (!ranked.length) { el.innerHTML = ""; return; }
  const k = usRankSortKey, d = usRankSortDir;
  const sorted = [...ranked].sort((a, b) => {
    if (k === "code" || k === "name") return d === 1 ? String(b[k] || "").localeCompare(String(a[k] || "")) : String(a[k] || "").localeCompare(String(b[k] || ""));
    return d === 1 ? (b[k] ?? -Infinity) - (a[k] ?? -Infinity) : (a[k] ?? -Infinity) - (b[k] ?? -Infinity);
  });
  const th = (key, label, align = "right") => `<th class="${usRankSortKey === key ? "sort-active" : ""}" onclick="sortUsRanking('${key}')" style="text-align:${align};">${label}${usRankSortKey === key ? (usRankSortDir === 1 ? " ▼" : " ▲") : ""}</th>`;
  el.innerHTML = `
    <div class="data-panel">
      <h3 style="margin-bottom:4px;">📊 美股漲幅排行＋評分</h3>
      <p style="font-size:11.5px;margin-bottom:8px;">名次分(位階+MA)＋加速度分，點擊欄位標題切換排序。</p>
      <div class="table-wrap"><table class="stocks-table">
        <thead><tr>
          ${th("rank", "排名", "left")}${th("code", "代號", "left")}${th("name", "名稱", "left")}
          ${th("price", "收盤")}${th("pct1", "今日%")}${th("pct5", "5日%")}${th("pct10", "10日%")}
          ${th("rankMa", "名次(MA)")}${th("accelScore", "加速度")}${th("total", "總分")}
          <th style="text-align:center;cursor:default;">自選</th>
        </tr></thead>
        <tbody>${sorted.map(s => `<tr>
          <td class="num">${s.rank}</td>
          <td style="font-weight:700;">${s.held ? "⭐" : ""}<a href="https://tw.tradingview.com/chart/?symbol=${_dEsc(s.code)}" target="_blank">${_dEsc(s.code)}</a></td>
          <td>${_dEsc(s.name)}</td>
          <td class="num" style="text-align:right;">${s.price ?? "-"}</td>
          <td class="num ${pctClass(s.pct1)}" style="text-align:right;">${fmtPct(s.pct1)}</td>
          <td class="num ${pctClass(s.pct5)}" style="text-align:right;">${fmtPct(s.pct5)}</td>
          <td class="num ${pctClass(s.pct10)}" style="text-align:right;">${fmtPct(s.pct10)}</td>
          <td class="num" style="text-align:right;">${s.rankMa != null ? s.rankMa.toFixed(1) : "-"}</td>
          <td class="num" style="text-align:right;">${s.accelScore.toFixed(1)}</td>
          <td class="num" style="text-align:right;font-weight:700;">${s.total.toFixed(1)}</td>
          <td style="text-align:center;">${watchBtnHtml(s.code, "US", s.name)}</td>
        </tr>`).join("")}</tbody>
      </table></div>
    </div>`;
}

function renderUsStocks() {
  const tableEl = document.getElementById("usStocksTable");
  const leadingEl = document.getElementById("usStocksLeading");
  const updatedEl = document.getElementById("usStocksUpdated");
  if (!usStocksData || !tableEl) return;
  if (updatedEl) updatedEl.textContent = usStocksData.updated ? `（最後更新：${usStocksData.updated}）` : "";

  const filterEl = document.getElementById("usFilterButtons");
  if (filterEl) {
    filterEl.innerHTML = `
      <button class="filter-chip ${usFilterMode === "all" ? "active" : ""}" onclick="setUsFilter('all')">全部</button>
      <button class="filter-chip ${usFilterMode === "held" ? "active" : ""}" onclick="setUsFilter('held')">⭐ 只看持有</button>
      <button class="filter-chip ${usFilterMode === "dream" ? "active" : ""}" onclick="setUsFilter('dream')">🌙 只看夢想股</button>`;
  }

  const leading = usStocksData.leadingIndicators || {};
  if (leadingEl) {
    leadingEl.innerHTML = `
      <div class="data-panel">
        <h3>🌅 盤前領先指標</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
          ${Object.entries(leading).map(([code, v]) => `
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;">
              <div style="font-size:12.5px;font-weight:700;">${_dEsc(code)} <span class="num ${pctClass(v.pct1)}">${fmtPct(v.pct1)}</span></div>
              <div style="font-size:11.5px;color:var(--text-secondary);margin-top:2px;">${_dEsc(v.note)}</div>
            </div>`).join("")}
        </div>
      </div>`;
  }

  renderUsRanking();

  const stocks = filterUsStockEntries(Object.entries(usStocksData.stocks || {})).map(([code, s]) => ({ code, name: US_STOCK_NAMES[code] || code, ...s }));
  const bySector = {};
  stocks.forEach(s => { (bySector[s.sector] = bySector[s.sector] || []).push(s); });
  if (!Object.keys(bySector).length) { tableEl.innerHTML = `<div class="data-panel empty-state">目前篩選條件下沒有符合的美股標的。</div>`; return; }

  const usAvg = (arr, k) => { const v = arr.map(s => s[k]).filter(x => typeof x === "number"); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const key = usSectorSortKey;
  const sortedSectors = Object.entries(bySector)
    .map(([sector, arr]) => ({ sector, stocks: arr, count: arr.length, pct1: usAvg(arr, "pct1"), pct5: usAvg(arr, "pct5"), pct10: usAvg(arr, "pct10") }))
    .sort((a, b) => (b[key] ?? -999) - (a[key] ?? -999));
  const maxAbs = Math.max(...sortedSectors.map(s => Math.abs(s[key] ?? 0)), 1);

  const rowsHtml = sortedSectors.map((s, idx) => {
    const rank = idx + 1, val = s[key] ?? 0, expanded = usExpandedSectors.has(s.sector);
    const tierCls = rank <= 3 ? "tier-1" : rank <= 6 ? "tier-2" : rank <= 10 ? "tier-3" : "";
    const barW = Math.max(2, Math.min(100, (Math.abs(val) / maxAbs * 100))).toFixed(1);
    const twSector = matchTwSectorForUs(s.sector);
    let html = `
      <div class="bar-row ${expanded ? "expanded" : tierCls}" style="grid-template-columns:185px 1fr 66px 46px;" onclick="toggleUsSectorExpand(${_jsStr(s.sector)})">
        <div class="bar-name"><span class="bar-rank">${rank}</span><span style="overflow:hidden;text-overflow:ellipsis;">${_dEsc(s.sector)}</span><span style="font-size:9px;color:var(--text-muted);">${expanded ? "▲" : "▼"}</span></div>
        <div class="bar-track ${val < 0 ? "is-neg" : ""}"><div class="bar-fill ${val < 0 ? "neg" : "pos"}" style="width:${barW}%"></div></div>
        <div class="bar-val ${pctClass(val)}">${fmtPct(val)}</div>
        <div class="bar-pct">${s.count}檔</div>
      </div>`;
    if (expanded) {
      const memberRows = [...s.stocks].sort((a, b) => (b[key] ?? -999) - (a[key] ?? -999)).map(st => `<tr>
        <td style="font-weight:700;">${st.held ? "⭐" : ""}<a href="https://tw.tradingview.com/chart/?symbol=${_dEsc(st.code)}" target="_blank" onclick="event.stopPropagation()">${_dEsc(st.code)}</a></td>
        <td>${_dEsc(st.name)}</td>
        <td class="num" style="text-align:right;">${st.price ?? "-"}</td>
        <td class="num ${pctClass(st.pct1)}" style="text-align:right;">${fmtPct(st.pct1)}</td>
        <td class="num ${pctClass(st.pct5)}" style="text-align:right;">${fmtPct(st.pct5)}</td>
        <td class="num ${pctClass(st.pct10)}" style="text-align:right;">${fmtPct(st.pct10)}</td>
        <td style="text-align:center;">${st.quality ?? "-"}</td>
        <td style="text-align:center;">${st.earningsSource ?? "-"}</td>
        <td style="text-align:center;">${watchBtnHtml(st.code, "US", st.name)}</td>
      </tr>`).join("");
      html += `<div class="expand-panel">
        <div class="table-wrap"><table class="stocks-table">
          <thead><tr><th>代號</th><th>名稱</th><th style="text-align:right;">收盤</th><th style="text-align:right;">今日%</th><th style="text-align:right;">5日%</th><th style="text-align:right;">10日%</th><th style="text-align:center;">品質</th><th style="text-align:center;">本業體質</th><th style="text-align:center;">自選</th></tr></thead>
          <tbody>${memberRows}</tbody>
        </table></div>
        ${twSector ? `<div style="text-align:right;margin-top:8px;"><button class="btn sm" onclick="event.stopPropagation();currentSector=${_jsStr(twSector)};switchTab('stocks')">查看對應台股：${_dEsc(twSector)} →</button></div>` : ""}
      </div>`;
    }
    return html;
  }).join("");

  tableEl.innerHTML = `<div class="data-panel">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <h3 style="margin:0;">🏆 美股族群排行榜</h3>
      <select onchange="setUsSectorSort(this.value)">
        <option value="pct1" ${key === "pct1" ? "selected" : ""}>今日漲跌幅</option>
        <option value="pct5" ${key === "pct5" ? "selected" : ""}>近5日漲跌幅</option>
        <option value="pct10" ${key === "pct10" ? "selected" : ""}>近10日漲跌幅</option>
      </select>
    </div>
    <div class="ranking-bars">${rowsHtml}</div>
  </div>`;
}

// ==================== 黑馬掃描（含關鍵字、市場與訊號篩選） ====================
function sortMarketScan(key) {
  if (marketScanSortKey === key) marketScanSortDir *= -1;
  else { marketScanSortKey = key; marketScanSortDir = (key === "code" || key === "name" || key === "market") ? -1 : 1; }
  renderMarketScan();
}
function setMarketScanMarket(m) { marketScanMarketFilter = m; renderMarketScan(); }
function setMarketScanSignal(s) { marketScanSignalFilter = marketScanSignalFilter === s ? "ALL" : s; renderMarketScan(); }

function renderMarketScan() {
  const tableEl = document.getElementById("marketScanTable");
  const metaEl = document.getElementById("marketScanMeta");
  const headerDateEl = document.getElementById("marketScanHeaderDate");
  const filtersEl = document.getElementById("marketScanFilters");
  if (!marketScanData || !tableEl) return;

  if (headerDateEl) headerDateEl.textContent = ` ・股價日期：${marketScanData.date || "-"}`;
  if (metaEl) {
    const d = marketScanData;
    const pending = Object.entries(d.signalReadiness || {}).filter(([, r]) => !r).map(([l]) => l);
    const histNote = pending.length ? `・歷史累積 ${d.historyDaysAvailable} 天，尚未生效：${pending.join("、")}` : `・歷史累積 ${d.historyDaysAvailable} 天（訊號全部生效）`;
    metaEl.textContent = `（資料日期：${d.date}・最後執行：${d.scannedAt || "-"}・全市場 ${d.scannedCount} 檔・股池 ${d.poolSize} 檔${histNote}）`;
  }

  const allMovers = marketScanData.movers || [];
  // 統計訊號分類（取每個訊號前綴如「大漲」「爆量」「創60日新高」「連漲」「近5日」「近10日」「持續放量」）
  const signalKeyOf = sig => sig.split(/[(:（\s+\d]/)[0] || sig;
  const sigCounts = {};
  allMovers.forEach(m => {
    const seen = new Set();
    (m.signals || []).forEach(sig => { const k = signalKeyOf(sig); if (!seen.has(k)) { seen.add(k); sigCounts[k] = (sigCounts[k] || 0) + 1; } });
  });

  if (filtersEl) {
    filtersEl.innerHTML = `
      <div class="controls" style="margin-bottom:8px;">
        <input type="text" id="msSearchIn" value="${_dEsc(marketScanSearchQ)}" placeholder="搜尋黑馬代號或名稱..." style="min-width:180px;" oninput="marketScanSearchQ=this.value.trim().toUpperCase();renderMarketScan()">
        <div class="seg-group">
          <button class="seg-btn ${marketScanMarketFilter === "ALL" ? "active" : ""}" onclick="setMarketScanMarket('ALL')">全部 (${allMovers.length})</button>
          <button class="seg-btn ${marketScanMarketFilter === "TWSE" ? "active" : ""}" onclick="setMarketScanMarket('TWSE')">上市</button>
          <button class="seg-btn ${marketScanMarketFilter === "TPEX" ? "active" : ""}" onclick="setMarketScanMarket('TPEX')">上櫃</button>
        </div>
      </div>
      <div class="chip-row">
        <button class="filter-chip ${marketScanSignalFilter === "ALL" ? "active" : ""}" onclick="setMarketScanSignal('ALL')">全部訊號</button>
        ${Object.entries(sigCounts).sort((a, b) => b[1] - a[1]).map(([k, cnt]) =>
          `<button class="filter-chip ${marketScanSignalFilter === k ? "active" : ""}" onclick="setMarketScanSignal(${_jsStr(k)})">${_dEsc(k)}<span class="cnt">${cnt}</span></button>`
        ).join("")}
      </div>`;
  }

  let filtered = allMovers;
  if (marketScanMarketFilter !== "ALL") filtered = filtered.filter(m => m.market === marketScanMarketFilter);
  if (marketScanSignalFilter !== "ALL") filtered = filtered.filter(m => (m.signals || []).some(sig => signalKeyOf(sig) === marketScanSignalFilter));
  if (marketScanSearchQ) filtered = filtered.filter(m => m.code.includes(marketScanSearchQ) || (m.name || "").toUpperCase().includes(marketScanSearchQ));

  if (!filtered.length) {
    tableEl.innerHTML = `<div class="data-panel empty-state">目前篩選條件下沒有符合的股池外異動股。</div>`;
    return;
  }

  const k = marketScanSortKey, d = marketScanSortDir;
  const sorted = [...filtered].sort((a, b) => {
    if (k === "code" || k === "name" || k === "market") return d === 1 ? String(b[k] || "").localeCompare(String(a[k] || "")) : String(a[k] || "").localeCompare(String(b[k] || ""));
    return d === 1 ? (b[k] ?? -Infinity) - (a[k] ?? -Infinity) : (a[k] ?? -Infinity) - (b[k] ?? -Infinity);
  });
  const th = (key, label, align = "left") => `<th class="${marketScanSortKey === key ? "sort-active" : ""}" onclick="sortMarketScan('${key}')" style="text-align:${align};">${label}${marketScanSortKey === key ? (marketScanSortDir === 1 ? " ▼" : " ▲") : ""}</th>`;

  tableEl.innerHTML = `<div class="table-wrap"><table class="stocks-table">
    <thead><tr><th style="width:46px;text-align:center;cursor:default;">自選</th>${th("code", "代號")}${th("name", "名稱 / 市場")}${th("close", "收盤", "right")}${th("pct1", "漲跌幅", "right")}<th style="cursor:default;">異動訊號</th></tr></thead>
    <tbody>${sorted.map(m => `<tr>
      <td style="text-align:center;">${watchBtnHtml(m.code, m.market, m.name, m.close, m.pct1)}</td>
      <td><a href="${getTVLink(m.code, m.market)}" target="_blank" style="font-weight:700;">${_dEsc(m.code)}</a></td>
      <td class="wrap-cell"><strong style="color:var(--text-primary);">${_dEsc(m.name)}</strong> <span class="tag tag-muted">${_dEsc(m.market)}</span></td>
      <td class="num" style="text-align:right;">${m.close?.toFixed(2) ?? "-"}</td>
      <td class="num ${pctClass(m.pct1)}" style="text-align:right;">${fmtPct(m.pct1)}</td>
      <td class="wrap-cell">${(m.signals || []).map(sig => `<span class="tag tag-dajia">${_dEsc(sig)}</span>`).join("")}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

// ==================== 交易日記（含關鍵字／族群篩選） ====================
function _diaryStockName(code) { return STOCK_NAMES[code] || US_STOCK_NAMES[code] || stockMeta[code]?.name || ""; }
function _diaryTvUrl(code) { return getTVLink(code, stockData[code]?.market || "TWSE"); }
function _syncDiaryForm() {
  const d = document.getElementById("diaryDateIn"), c = document.getElementById("diaryContentIn");
  if (d && diaryFormState) diaryFormState.date = d.value;
  if (c && diaryFormState) diaryFormState.content = c.value;
}
function _diaryAllStocks() {
  const seen = new Set(), list = [];
  for (const stocks of Object.values(SECTORS)) for (const s of stocks) if (!seen.has(s.code)) { seen.add(s.code); list.push(s); }
  return list;
}

function renderDiary() {
  const panel = document.getElementById("diary");
  if (!panel) return;
  const fs = diaryFormState;
  let formHtml = "";
  if (fs) {
    const secOpts = Object.keys(SECTORS).filter(s => !fs.sectors.includes(s)).map(s => `<option value="${_dEsc(s)}">${_dEsc(s)}</option>`).join("");
    formHtml = `
      <div class="data-panel accent-blue">
        <div class="controls" style="margin-bottom:10px;">
          <label style="font-size:13px;font-weight:600;">日期</label>
          <input type="date" id="diaryDateIn" value="${_dEsc(fs.date)}">
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">內容</label>
          <textarea id="diaryContentIn" rows="4" placeholder="今天的觀察、交易筆記..." style="width:100%;resize:vertical;">${_dEsc(fs.content)}</textarea>
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">標的</label>
          <div class="controls">
            <div style="position:relative;display:inline-block;">
              <input type="text" id="diaryStockIn" placeholder="代號或名稱 如 2330" style="width:200px;"
                oninput="diarySearchStock(this.value)"
                onkeydown="if(event.key==='Enter'){event.preventDefault();diarySelectTopResult();}if(event.key==='Escape'){closeDiaryStockDropdown();}">
              <div id="diaryStockDropdown" style="display:none;position:absolute;top:calc(100% + 2px);left:0;z-index:300;background:var(--surface);border:1px solid var(--border-strong);border-radius:8px;max-height:200px;overflow-y:auto;min-width:220px;box-shadow:var(--shadow-md);"></div>
            </div>
            <button class="btn primary sm" onclick="diarySelectTopResult()">+ 加入</button>
            ${fs.stocks.map(code => `<span class="tag" style="padding:3px 9px;font-size:12px;">📈 ${_dEsc(code)} ${_dEsc(_diaryStockName(code))} <span onclick="diaryFormRemoveStock('${_dEsc(code)}')" style="cursor:pointer;margin-left:4px;">×</span></span>`).join("")}
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">族群</label>
          <div class="controls">
            <select id="diarySecIn" style="max-width:230px;"><option value="">選擇族群…</option>${secOpts}</select>
            <button class="btn primary sm" onclick="diaryFormAddSector()">+ 加入</button>
            ${fs.sectors.map(sec => `<span class="tag tag-us" style="padding:3px 9px;font-size:12px;">🏷️ ${_dEsc(sec.replace(/^\d+\.\s*/, ""))} <span onclick="diaryFormRemoveSector(${_jsStr(sec)})" style="cursor:pointer;margin-left:4px;">×</span></span>`).join("")}
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn success sm" onclick="diarySave()">儲存</button>
          <button class="btn sm" onclick="diaryCancel()">取消</button>
        </div>
      </div>`;
  }

  let filtered = [...diaryEntries].sort((a, b) => b.date.localeCompare(a.date));
  if (diarySectorFilter) filtered = filtered.filter(e => (e.sectors || []).includes(diarySectorFilter));
  if (diarySearchQ) {
    const q = diarySearchQ.toUpperCase();
    filtered = filtered.filter(e =>
      (e.content || "").toUpperCase().includes(q) ||
      (e.date || "").includes(q) ||
      (e.stocks || []).some(c => c.includes(q) || _diaryStockName(c).toUpperCase().includes(q))
    );
  }

  const usedSectors = [...new Set(diaryEntries.flatMap(e => e.sectors || []))];
  const listHtml = filtered.length === 0
    ? `<div class="data-panel empty-state">${diaryEntries.length ? "找不到符合篩選條件的日記記錄" : "尚無日記記錄，點「+ 新增記錄」開始吧"}</div>`
    : filtered.map(e => `
        <div class="data-panel" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="font-size:14.5px;color:var(--text-primary);">${_dEsc(e.date)}</strong>
            <div style="display:flex;gap:6px;">
              <button class="btn xs" onclick="diaryStartEdit('${_dEsc(e.id)}')">編輯</button>
              <button class="btn danger xs" onclick="diaryDelete('${_dEsc(e.id)}')">刪除</button>
            </div>
          </div>
          ${e.content ? `<div style="color:var(--text-primary);font-size:13px;white-space:pre-wrap;margin-bottom:10px;line-height:1.75;">${_dEsc(e.content)}</div>` : ""}
          ${(e.stocks || []).length ? `<div class="chip-row" style="margin-bottom:${(e.sectors || []).length ? "6px" : "0"};">
            ${e.stocks.map(code => `<a class="tag" style="padding:3px 10px;font-size:12px;" href="${_diaryTvUrl(code)}" target="_blank">📈 ${_dEsc(code)}${_diaryStockName(code) ? " " + _dEsc(_diaryStockName(code)) : ""}</a>`).join("")}
          </div>` : ""}
          ${(e.sectors || []).length ? `<div class="chip-row">
            ${e.sectors.map(sec => `<span class="tag tag-us" style="padding:3px 10px;font-size:12px;" onclick="currentSector=${_jsStr(sec)};switchTab('stocks')">🏷️ ${_dEsc(sec.replace(/^\d+\.\s*/, ""))} →</span>`).join("")}
          </div>` : ""}
        </div>`).join("");

  panel.innerHTML = `
    <div class="section-header" style="margin-top:0;">
      <div class="section-title">📓 交易日記 <span class="app-version">${filtered.length}/${diaryEntries.length}</span></div>
      <div class="controls">
        <input type="text" placeholder="搜尋日記內容、代號或日期..." value="${_dEsc(diarySearchQ)}" style="min-width:190px;" oninput="diarySearchQ=this.value.trim();renderDiary()">
        ${usedSectors.length ? `<select onchange="diarySectorFilter=this.value;renderDiary()">
          <option value="">全部族群</option>
          ${usedSectors.map(s => `<option value="${_dEsc(s)}" ${diarySectorFilter === s ? "selected" : ""}>${_dEsc(s.replace(/^\d+\.\s*/, ""))}</option>`).join("")}
        </select>` : ""}
        <button class="btn primary sm" onclick="diaryNew()">＋ 新增記錄</button>
      </div>
    </div>
    ${formHtml}${listHtml}`;
}

function diaryNew() { _syncDiaryForm(); diaryFormState = { id: null, date: new Date().toISOString().slice(0, 10), content: "", stocks: [], sectors: [] }; renderDiary(); }
function diaryStartEdit(id) {
  _syncDiaryForm();
  const e = diaryEntries.find(e => e.id === id);
  if (!e) return;
  diaryFormState = { id: e.id, date: e.date, content: e.content || "", stocks: [...(e.stocks || [])], sectors: [...(e.sectors || [])] };
  renderDiary();
}
function diaryDelete(id) {
  if (!confirm("確定刪除這筆記錄？")) return;
  diaryEntries = diaryEntries.filter(e => e.id !== id);
  saveDiary(); _pendingPush = true; pushToCloud(); renderDiary();
  showToast("已刪除交易日記", "info");
}
function diarySearchStock(query) {
  const dd = document.getElementById("diaryStockDropdown");
  if (!dd) return;
  const q = query.trim();
  if (!q) { dd.style.display = "none"; return; }
  const isCode = /^\d+$/.test(q);
  const results = _diaryAllStocks().filter(s => isCode ? s.code.startsWith(q) : (s.code.startsWith(q) || s.name.includes(q))).slice(0, 12);
  if (!results.length) { dd.style.display = "none"; return; }
  dd.innerHTML = results.map(s => `<div onclick="diarySelectStock('${_dEsc(s.code)}')" style="padding:7px 12px;cursor:pointer;font-size:12.5px;border-bottom:1px solid var(--border-subtle);display:flex;gap:8px;"><span style="color:var(--text-muted);font-family:monospace;">${_dEsc(s.code)}</span><span>${_dEsc(s.name)}</span></div>`).join("");
  dd.style.display = "block";
}
function diarySelectStock(code) {
  closeDiaryStockDropdown(); _syncDiaryForm();
  if (!diaryFormState || diaryFormState.stocks.includes(code)) return;
  diaryFormState.stocks.push(code); renderDiary();
  setTimeout(() => document.getElementById("diaryStockIn")?.focus(), 30);
}
function diarySelectTopResult() {
  const dd = document.getElementById("diaryStockDropdown");
  if (dd && dd.style.display !== "none") { const first = dd.querySelector("div"); if (first) { first.click(); return; } }
  const inp = document.getElementById("diaryStockIn");
  if (!inp || !diaryFormState) return;
  const code = inp.value.trim().replace(/\D/g, "");
  if (!code || diaryFormState.stocks.includes(code)) { inp.value = ""; return; }
  _syncDiaryForm(); diaryFormState.stocks.push(code); renderDiary();
  setTimeout(() => document.getElementById("diaryStockIn")?.focus(), 30);
}
function closeDiaryStockDropdown() { const dd = document.getElementById("diaryStockDropdown"); if (dd) dd.style.display = "none"; }
function diaryFormAddStock() { diarySelectTopResult(); }
function diaryFormRemoveStock(code) { _syncDiaryForm(); if (!diaryFormState) return; diaryFormState.stocks = diaryFormState.stocks.filter(c => c !== code); renderDiary(); }
function diaryFormAddSector() {
  _syncDiaryForm(); const sel = document.getElementById("diarySecIn");
  if (!sel || !diaryFormState || !sel.value || diaryFormState.sectors.includes(sel.value)) return;
  diaryFormState.sectors.push(sel.value); renderDiary();
}
function diaryFormRemoveSector(sec) { _syncDiaryForm(); if (!diaryFormState) return; diaryFormState.sectors = diaryFormState.sectors.filter(s => s !== sec); renderDiary(); }
function diarySave() {
  _syncDiaryForm();
  if (!diaryFormState) return;
  if (!diaryFormState.date) { showToast("請填入日期", "warn"); return; }
  if (diaryFormState.id) {
    const idx = diaryEntries.findIndex(e => e.id === diaryFormState.id);
    if (idx >= 0) diaryEntries[idx] = { ...diaryEntries[idx], ...diaryFormState };
  } else {
    diaryEntries.push({ ...diaryFormState, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
  }
  diaryFormState = null; saveDiary(); _pendingPush = true; pushToCloud(); renderDiary();
  showToast("已儲存交易日記", "success");
}
function diaryCancel() { diaryFormState = null; renderDiary(); }

// ==================== 國際圖表備用頁 ====================
function initGlobalPanel() {
  const marketSel = document.getElementById("globalMarketSelect"), stockSel = document.getElementById("globalStockSelect");
  marketSel.onchange = () => {
    const list = GLOBAL_LIST[marketSel.value];
    stockSel.innerHTML = list.map(item => `<option value="${item.ex ? `${item.ex}:${item.code}` : `${marketSel.value === "JP" ? "TSE" : "KRX"}:${item.code}`}">${_dEsc(item.name)}</option>`).join("");
    updateGlobalChart();
  };
  stockSel.onchange = updateGlobalChart;
  marketSel.dispatchEvent(new Event("change"));
}
function updateGlobalChart() {
  const symbol = document.getElementById("globalStockSelect").value, container = document.getElementById("tvChartContainer");
  container.innerHTML = "";
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.async = true;
  script.innerHTML = JSON.stringify({ autosize: true, symbol, interval: "D", timezone: "Asia/Taipei", theme: getCurrentTheme(), style: "1", locale: "zh_TW", enable_publishing: false, hide_top_toolbar: false, hide_legend: false, save_image: false, details: true });
  container.appendChild(script);
  document.getElementById("openTvAppBtn").onclick = () => window.open(`https://tw.tradingview.com/chart/?symbol=${symbol}`, "_blank");
}

// ==================== 事件綁定與系統初始化 ====================
document.getElementById("appVersion").textContent = `v${APP_VERSION}`;
document.querySelectorAll(".tab[data-tab]").forEach(t => t.onclick = () => switchTab(t.dataset.tab));
document.getElementById("rankingSort").onchange = renderRanking;
document.getElementById("stockSort").onchange = e => { stockSortKey = e.target.value; renderStocks(); };
document.getElementById("sectorSelect").onchange = e => { currentSector = e.target.value === "__all__" ? null : e.target.value; renderStocks(); };

document.querySelectorAll("#stocksTable th[data-sort]").forEach(th => {
  th.onclick = () => {
    if (stockSortKey === th.dataset.sort) stockSortDir *= -1;
    else { stockSortKey = th.dataset.sort; stockSortDir = -1; }
    renderStocks();
  };
});
document.querySelectorAll("#watchlistTable th[data-sort]").forEach(th => {
  th.onclick = () => {
    if (wlSortKey === th.dataset.sort) wlSortDir *= -1;
    else { wlSortKey = th.dataset.sort; wlSortDir = -1; }
    renderWatchlist();
  };
});

document.getElementById("fetchFinMindBtn").onclick = fetchFinMindData;
document.getElementById("triggerQuoteBtn").onclick = triggerQuoteUpdate;
document.getElementById("fetchFundamentalsBtn").onclick = fetchFundamentals;
document.getElementById("fetchFundamentalsFreeBtn").onclick = fetchFundamentalsFree;
document.getElementById("fetchLiveQuotesBtn").onclick = async () => {
  const btn = document.getElementById("fetchLiveQuotesBtn"), statusEl = document.getElementById("fetchStatus");
  btn.disabled = true;
  const bulk = await fetchBulkPER(statusEl);
  const n = await applyBulkPER(bulk, statusEl);
  await fetchLiveQuotes();
  saveLocalOnly(); updateUI(true);
  const priceCount = Object.values(stockData).filter(s => s.price != null).length;
  statusEl.textContent = `🆓 刷新完成：${priceCount} 檔有收盤，${n} 檔品質標籤已更新`;
  showToast(`刷新完成（${priceCount} 檔）`, "success");
  btn.disabled = false;
  setTimeout(() => { statusEl.textContent = ""; }, 6000);
};
document.getElementById("loadDemoBtn").onclick = () => {
  const allCodes = [...new Set(Object.values(SECTORS).flat().map(s => s.code)), "0050"];
  stockData = {};
  allCodes.forEach(code => {
    const seed = parseInt(code.replace(/\D/g, "") || "1000", 10);
    const price = +(20 + (seed % 300) + (seed % 9) * 20).toFixed(1);
    const pct10 = +(((seed % 31) - 15) * 0.9).toFixed(2);
    const pct5 = +(pct10 * 0.55 + ((seed % 7) - 3) * 0.4).toFixed(2);
    const pct1 = +(((seed % 13) - 6) * 0.35).toFixed(2);
    const amount = +((seed % 60) + 1).toFixed(1);
    const volTrend = parseFloat((0.85 + (seed % 60) / 100).toFixed(3));
    stockData[code] = { price, pct1, pct5, pct10, amount, volTrend, market: TPEX_CODES.has(code) ? "TPEX" : "TWSE" };
  });
  lastUpdateTime = new Date().toISOString();
  saveData(); updateUI(true);
  showToast("已載入範例股價資料", "success");
};
document.getElementById("clearDataBtn").onclick = () => {
  if (confirm("確定清空本機股價資料？")) { stockData = {}; lastUpdateTime = null; saveData(); updateUI(false); showToast("已清空報價資料", "info"); }
};
document.getElementById("apiToken").addEventListener("input", e => {
  const t = e.target.value.trim();
  if (t) localStorage.setItem("finmind_token", t); else localStorage.removeItem("finmind_token");
});
document.getElementById("ghTriggerToken").addEventListener("input", e => {
  const t = e.target.value.trim();
  if (t) localStorage.setItem("gh_dispatch_token", t); else localStorage.removeItem("gh_dispatch_token");
});

// 頁首備註輸入監聽
let _headerNoteDebounce = null;
document.getElementById("headerNote").addEventListener("input", e => {
  headerNote = e.target.value;
  saveHeaderNote();
  syncHeaderNoteUi();
  clearTimeout(_headerNoteDebounce);
  _headerNoteDebounce = setTimeout(() => { _pendingPush = true; pushToCloud(); }, 800);
});

// 全域快捷鍵：Ctrl+K / / 快速搜尋，Ctrl+Alt+U 盤後更新，Ctrl+Alt+Q 盤中更新，ESC 關閉浮層
document.addEventListener("keydown", e => {
  const tag = document.activeElement?.tagName;
  const inInput = tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault(); openQuickSearch(); return;
  }
  if (!inInput && e.key === "/") {
    e.preventDefault(); openQuickSearch(); return;
  }
  if (e.key === "Escape") {
    closeQuickSearch(); closeWatchPopover(); closeDiaryStockDropdown(); toggleMobileMore(false); return;
  }
  if (!e.ctrlKey || !e.altKey || inInput) return;
  const key = e.key.toLowerCase();
  if (key === "u") { e.preventDefault(); fetchFinMindData(); }
  else if (key === "q") { e.preventDefault(); triggerQuoteUpdate(); }
});

// 點擊外部關閉 Popover 與日記下拉、以及表格列選取高亮
document.addEventListener("click", e => {
  if (!e.target.closest("#watchPopover") && !e.target.closest(".watch-btn")) closeWatchPopover();
  if (!e.target.closest("#diaryStockIn") && !e.target.closest("#diaryStockDropdown")) closeDiaryStockDropdown();

  const tr = e.target.closest(".stocks-table tbody tr");
  if (!tr || e.target.closest("button, select, input, a, .watch-btn, .plan-add-btn")) return;
  const wasSelected = tr.classList.contains("row-selected");
  tr.closest("tbody").querySelectorAll("tr.row-selected").forEach(r => r.classList.remove("row-selected"));
  if (!wasSelected) tr.classList.add("row-selected");
});

window.addEventListener("scroll", () => {
  const b = document.getElementById("backToTop");
  if (b) b.style.display = window.scrollY > 500 ? "block" : "none";
}, { passive: true });

// 啟動流程
loadData();
syncHeaderNoteUi();
renderHeaderChecklist();
renderMemoDockVisibility();
updateThemeBtnLabel();
updateUI(false);
fetchLiveQuotes();
setInterval(fetchLiveQuotes, 5 * 60 * 1000);
loadUsStocks(false);
