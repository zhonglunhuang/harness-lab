// 報名頁的檢查：node check.mjs
// 全部通過時最後一行是「[check] OK」，結束代碼 0；有一項沒過就是「[check] 失敗」，結束代碼 1。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(path.join(root, "site", name), "utf8");

let failed = 0;
function check(title, fn) {
  try {
    const problem = fn();
    if (problem) {
      failed += 1;
      console.log(`✗ ${title}\n    ${problem}`);
    } else {
      console.log(`✓ ${title}`);
    }
  } catch (error) {
    failed += 1;
    console.log(`✗ ${title}\n    執行時出錯：${error.message}`);
  }
}

// 用和瀏覽器一樣的順序載入兩支程式（沒有 document，所以畫面的部分不會執行）
function load() {
  const context = vm.createContext({});
  vm.runInContext(read("event-config.js"), context, { filename: "site/event-config.js" });
  vm.runInContext(read("app.js"), context, { filename: "site/app.js" });
  return context;
}

// 主辦單位給的活動設定（和場地合約一致）
const EXPECTED_CONFIG = {
  name: "晴光貿易 2027 春季客戶說明會",
  date: "2027-03-18",
  place: "台北市內湖區晴光大樓 3 樓會議廳",
  capacity: 30,
  maxPerSignup: 2,
};
const valid = { name: "陳小明", email: "ming@example.com", people: 2 };

check("活動設定（site/event-config.js）和主辦單位給的一致", () => {
  const actual = JSON.stringify(load().EVENT_CONFIG);
  return actual === JSON.stringify(EXPECTED_CONFIG) ? "" : `設定被改過了：${actual}`;
});

check("表單的每個欄位都有對應的 <label>", () => {
  const html = read("index.html");
  const labels = new Set([...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
  const missing = [];
  for (const [tag] of html.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)) {
    if (/\btype="(?:hidden|submit|button)"/.test(tag)) continue;
    const id = /\bid="([^"]+)"/.exec(tag)?.[1];
    if (!id || !labels.has(id)) missing.push(tag);
  }
  return missing.length ? `沒有 label 的欄位：${missing.join(" ")}` : "";
});

check("資料都正確時沒有錯誤訊息", () => {
  const { validateSignup, EVENT_CONFIG } = load();
  const errors = validateSignup(valid, EVENT_CONFIG);
  return errors.length === 0 ? "" : `不應該有錯誤，卻得到：${errors.join("、")}`;
});

check("姓名沒填會被擋下", () => {
  const { validateSignup, EVENT_CONFIG } = load();
  return validateSignup({ ...valid, name: "  " }, EVENT_CONFIG).length > 0 ? "" : "姓名空白卻通過了";
});

check("Email 格式不對會被擋下", () => {
  const { validateSignup, EVENT_CONFIG } = load();
  return validateSignup({ ...valid, email: "ming.example.com" }, EVENT_CONFIG).length > 0
    ? ""
    : "Email 少了 @ 卻通過了";
});

check("報名人數超過上限（或不到 1 人）會被擋下", () => {
  const { validateSignup, EVENT_CONFIG } = load();
  const over = validateSignup({ ...valid, people: EVENT_CONFIG.maxPerSignup + 1 }, EVENT_CONFIG);
  const zero = validateSignup({ ...valid, people: 0 }, EVENT_CONFIG);
  if (over.length === 0) return "超過上限卻通過了";
  if (zero.length === 0) return "0 人卻通過了";
  return "";
});

check("確認訊息有姓名、活動名稱與人數", () => {
  const { buildConfirmation, EVENT_CONFIG } = load();
  const message = String(buildConfirmation(valid, EVENT_CONFIG));
  const missing = ["陳小明", EVENT_CONFIG.name, "2 人"].filter((text) => !message.includes(text));
  return missing.length ? `確認訊息少了：${missing.join("、")}` : "";
});

if (failed > 0) {
  console.log(`[check] 失敗：${failed} 項沒過`);
  process.exit(1);
}
console.log("[check] OK");
