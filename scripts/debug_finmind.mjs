// debug_finmind.mjs — 印出 10 檔股票的 TaiwanStockPER 和 TaiwanStockFinancialStatements 原始回傳
// 用法: node scripts/debug_finmind.mjs [YOUR_TOKEN]

const TOKEN = process.argv[2] || "";
const CODES = ["8261","5347","2329","8048","8086","6573","2401","8255","3707","3016"];
const API   = "https://api.finmindtrade.com/api/v4/data";

// 抓最近 90 天，確保涵蓋最新交易日
const startDate = new Date();
startDate.setDate(startDate.getDate() - 90);
const START = startDate.toISOString().slice(0,10);

const tok = TOKEN ? `&token=${TOKEN}` : "";

async function fetchRaw(dataset, code) {
  const url = `${API}?dataset=${dataset}&data_id=${code}&start_date=${START}${tok}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return { url, status: res.status, msg: json.msg, rowCount: json.data?.length ?? 0, last3: json.data?.slice(-3) ?? [] };
  } catch(e) {
    return { url, error: e.message };
  }
}

console.log(`\n抓取日期範圍: ${START} ~ 今天`);
console.log(TOKEN ? `使用 token: ${TOKEN.slice(0,6)}...` : "⚠️ 未提供 token（免費模式，有速率限制）");
console.log("=".repeat(70));

for (const code of CODES) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`▶ ${code}`);

  // ── TaiwanStockPER ──
  const per = await fetchRaw("TaiwanStockPER", code);
  console.log(`  [TaiwanStockPER]`);
  console.log(`  URL : ${per.url}`);
  if (per.error) {
    console.log(`  ERROR: ${per.error}`);
  } else {
    console.log(`  msg : ${per.msg}`);
    console.log(`  rows: ${per.rowCount}`);
    if (per.last3.length) {
      console.log(`  最後 3 筆:`);
      per.last3.forEach(r => console.log(`    ${JSON.stringify(r)}`));
    } else {
      console.log(`  (無資料)`);
    }
  }

  if (!TOKEN) await new Promise(r => setTimeout(r, 600));

  // ── TaiwanStockFinancialStatements ──
  const fin = await fetchRaw("TaiwanStockFinancialStatements", code);
  console.log(`  [TaiwanStockFinancialStatements]`);
  console.log(`  URL : ${fin.url}`);
  if (fin.error) {
    console.log(`  ERROR: ${fin.error}`);
  } else {
    console.log(`  msg : ${fin.msg}`);
    console.log(`  rows: ${fin.rowCount}`);
    // 找所有 type=EPS 的行
    const epsRows = fin.last3.filter ? [] : [];
    // 重新從 last3 找 EPS（last3 只有末 3 筆，可能看不到 EPS type）
    // 改印「所有出現的 type 清單」和「最後 3 筆原始資料」
    if (fin.last3.length) {
      console.log(`  最後 3 筆:`);
      fin.last3.forEach(r => console.log(`    ${JSON.stringify(r)}`));
    } else {
      console.log(`  (無資料)`);
    }
  }

  if (!TOKEN) await new Promise(r => setTimeout(r, 600));
}

// ── 補充：針對 TaiwanStockFinancialStatements 抓完整資料，列出所有 type ──
console.log(`\n${"=".repeat(70)}`);
console.log("補充：各股 FinancialStatements 所有 type 清單（最近 90 天）");
console.log("=".repeat(70));

for (const code of CODES) {
  const url = `${API}?dataset=TaiwanStockFinancialStatements&data_id=${code}&start_date=${START}${tok}`;
  try {
    const res  = await fetch(url);
    const json = await res.json();
    if (json.msg === "success" && json.data?.length > 0) {
      const types = [...new Set(json.data.map(r => r.type))];
      const epsRows = json.data.filter(r => r.type === "EPS").slice(-2);
      console.log(`  ${code}: types=[${types.join(", ")}]`);
      if (epsRows.length) console.log(`       EPS rows: ${JSON.stringify(epsRows)}`);
      else console.log(`       ⚠️ 無 type="EPS" 的資料列`);
    } else {
      console.log(`  ${code}: msg="${json.msg}", rows=0`);
    }
  } catch(e) {
    console.log(`  ${code}: ERROR ${e.message}`);
  }
  if (!TOKEN) await new Promise(r => setTimeout(r, 600));
}
