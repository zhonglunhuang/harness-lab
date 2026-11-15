// 「無票不開發」閘門（迷你版）：Claude Code 的 PreToolUse hook。
// Agent 每次要用 Edit、Write、MultiEdit、NotebookEdit 改檔之前，Claude Code 會先執行這支程式，
// 並把「它要改哪個檔案」用 JSON 從 stdin 傳進來（tool_input.file_path）。
//   結束代碼 0：放行。
//   結束代碼 2：擋下。stderr 的文字會交給 Agent，讓它知道為什麼被擋、該怎麼辦。
// 規則只有一條：tickets/ 裡沒有 status 是「開發中」的票時，不可以改 site/ 底下的檔案。
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// 這個 Repo 的根目錄（gate.mjs 在 lab/ 底下）。LAB_ROOT 只給測試用：在 Mac 上模擬 Windows 的路徑。
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = process.env.LAB_ROOT || here;

// 把各種寫法的路徑變成同一種，才能比較：
// 反斜線換成斜線、Git Bash 的 /c/… 換成 c:/…、去掉重複的斜線與 . 和 ..、全部轉小寫（Windows 與 Mac 的檔名不分大小寫）。
function normalize(input) {
  let text = String(input).replace(/\\/g, "/");
  text = text.replace(/^\/([a-zA-Z])\//, "$1:/");
  const drive = /^[a-zA-Z]:/.exec(text)?.[0] ?? "";
  const absolute = text.slice(drive.length).startsWith("/");
  const parts = [];
  for (const part of text.slice(drive.length).split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return (drive + (absolute ? "/" : "") + parts.join("/")).toLowerCase();
}

const isAbsolute = (text) => /^([a-zA-Z]:)?[\\/]/.test(text);

// 同一個資料夾可能有兩種寫法（例如 Mac 的 /tmp 其實是 /private/tmp）：兩種都算。
function variants(target) {
  const list = [normalize(target)];
  let existing = target;
  let rest = "";
  // 往上找到真的存在的那一層，換成它真正的位置，再把後半段接回去
  for (let i = 0; i < 64 && !existsSync(existing); i += 1) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    rest = rest ? `${path.basename(existing)}/${rest}` : path.basename(existing);
    existing = parent;
  }
  try {
    const real = realpathSync.native(existing);
    list.push(normalize(rest ? `${real}/${rest}` : real));
  } catch {
    // 找不到就只用原本的寫法
  }
  return list;
}

function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

// 讀 stdin 的 JSON
let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  block("[lab-gate] 讀不到 Claude Code 傳來的內容，為了安全先擋下這次修改。請告訴使用者閘門出錯了，不要改用其他方法修改檔案。");
}

const toolInput = input.tool_input ?? {};
const target = toolInput.file_path ?? toolInput.notebook_path ?? "";
if (typeof target !== "string" || target === "") process.exit(0);

// 相對路徑：從 Agent 目前所在的資料夾算起
const full = isAbsolute(target) ? target : `${input.cwd || root}/${target}`;
const roots = variants(root);
const inSite = variants(full).some((file) => roots.some((dir) => file.startsWith(`${dir}/site/`)));
if (!inSite) process.exit(0);

// tickets/ 裡有沒有「開發中」的票（看每張票最上面 --- 之間的 status 那一行）
function activeTickets() {
  const dir = path.join(here, "tickets");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => {
    if (!name.toLowerCase().endsWith(".md") || name.toLowerCase() === "readme.md") return false;
    const text = readFileSync(path.join(dir, name), "utf8").replace(/^\uFEFF/, "");
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
    const status = /^status:\s*["']?([^"'#\r\n]*)/m.exec(frontmatter)?.[1].trim() ?? "";
    return status === "開發中";
  });
}

if (activeTickets().length > 0) process.exit(0);

block(
  [
    "[lab-gate] 無票不開發：tickets/ 裡沒有 status 是「開發中」的票，site/ 底下的修改已經被擋下。",
    `被擋下的檔案：${target}`,
    "該怎麼辦：",
    "1. 先停下來，告訴使用者這次修改被閘門擋下了，原因是還沒有票。",
    "2. 請使用者決定要不要開票。要開的話，在 tickets/ 建立一張票（寫清楚目的、驗收條件、邊界），",
    "   使用者同意開始之後，把票的 status 改成「開發中」，再重新修改。",
    "不要改用 Terminal 指令或其他方法繞過這個閘門。",
  ].join("\n"),
);
