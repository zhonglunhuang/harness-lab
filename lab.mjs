// Harness 實驗室的切換指令（只用 Node.js 內建功能；Mac、Windows 的 PowerShell 與 Git Bash 都用同樣的寫法）
//   node lab.mjs status          現在啟用了哪幾層、有沒有開發中的票、site/ 有沒有改過
//   node lab.mjs on <層>         啟用一層：rules、skill、gate
//   node lab.mjs off <層>        關掉一層
//   node lab.mjs reset           把 site/ 還原成起點（保留已啟用的層與 tickets/），同一個任務可以重做
//   node lab.mjs reset --all     全部回到起點（各層都關掉、tickets/ 清空）
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const at = (...parts) => path.join(root, ...parts);
const say = (text = "") => console.log(text);

const FILES = {
  claudeMd: at("CLAUDE.md"),
  agentsMd: at("AGENTS.md"),
  savedAgentsMd: at("lab", ".saved", "AGENTS.md"),
  skill: at(".claude", "skills", "new-ticket", "SKILL.md"),
  settings: at(".claude", "settings.json"),
  tickets: at("tickets"),
};
const LAYERS = {
  rules: "Rules（規則）",
  skill: "Skill（開票）",
  gate: "閘門（無票不開發）",
};
const MATCHER = "Edit|Write|MultiEdit|NotebookEdit";
// 閘門的指令用完整路徑（斜線寫法，三種 Terminal 都看得懂）：Agent 換到別的資料夾工作時，閘門一樣找得到
const gateCommand = () => `node "${at("lab", "gate.mjs").replace(/\\/g, "/")}"`;
const isGateHook = (hook) => typeof hook?.command === "string" && /lab[\\/]gate\.mjs/.test(hook.command);

function git(...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.error) {
    say("找不到 git 指令：先安裝 Git，再執行一次。");
    process.exit(1);
  }
  return result;
}

// 資料夾空了就刪掉（不是空的就留著）
function removeIfEmpty(dir) {
  try {
    rmdirSync(dir);
  } catch {
    // 裡面還有東西，或本來就不存在
  }
}

function readSettings() {
  if (!existsSync(FILES.settings)) return {};
  try {
    const data = JSON.parse(readFileSync(FILES.settings, "utf8").replace(/^﻿/, ""));
    if (data && typeof data === "object" && !Array.isArray(data)) return data;
  } catch {
    // 往下處理
  }
  say("讀不懂 .claude/settings.json（不是正確的 JSON）。請先修好或刪掉這個檔案，再執行一次。");
  process.exit(1);
}

function writeSettings(data) {
  if (Object.keys(data).length === 0) {
    rmSync(FILES.settings, { force: true });
    removeIfEmpty(at(".claude"));
    return;
  }
  mkdirSync(path.dirname(FILES.settings), { recursive: true });
  writeFileSync(FILES.settings, `${JSON.stringify(data, null, 2)}\n`);
}

// 拿掉設定裡我們的閘門，其他的 hook 與設定原樣留著
function withoutGate(data) {
  const groups = Array.isArray(data.hooks?.PreToolUse) ? data.hooks.PreToolUse : [];
  const kept = groups
    .map((group) =>
      Array.isArray(group?.hooks) && group.hooks.some(isGateHook)
        ? { ...group, hooks: group.hooks.filter((hook) => !isGateHook(hook)) }
        : group,
    )
    .filter((group) => !Array.isArray(group?.hooks) || group.hooks.length > 0);
  const next = { ...data };
  if (data.hooks) {
    next.hooks = { ...data.hooks };
    if (kept.length > 0) next.hooks.PreToolUse = kept;
    else delete next.hooks.PreToolUse;
    if (Object.keys(next.hooks).length === 0) delete next.hooks;
  }
  return next;
}

// 設定裡的閘門：沒有回傳 null；有就回傳它的指令
function gateInSettings() {
  if (!existsSync(FILES.settings)) return null;
  const groups = readSettings().hooks?.PreToolUse;
  if (!Array.isArray(groups)) return null;
  for (const group of groups) {
    const hook = Array.isArray(group?.hooks) ? group.hooks.find(isGateHook) : null;
    if (hook) return hook.command;
  }
  return null;
}

const isOn = {
  rules: () => existsSync(FILES.claudeMd) && existsSync(FILES.agentsMd),
  skill: () => existsSync(FILES.skill),
  gate: () => gateInSettings() !== null,
};

const turnOn = {
  rules() {
    if (existsSync(FILES.agentsMd)) {
      say("AGENTS.md 已經存在，保留你寫的內容。");
    } else if (existsSync(FILES.savedAgentsMd)) {
      copyFileSync(FILES.savedAgentsMd, FILES.agentsMd);
      rmSync(at("lab", ".saved"), { recursive: true, force: true });
      say("已放回你上次寫的 AGENTS.md。");
    } else {
      copyFileSync(at("lab", "layers", "rules", "AGENTS.md"), FILES.agentsMd);
      say("已建立 AGENTS.md：打開它，把三個空格換成你自己的規則。");
    }
    copyFileSync(at("lab", "layers", "rules", "CLAUDE.md"), FILES.claudeMd);
    say("已建立 CLAUDE.md（只有一行 @AGENTS.md，把 AGENTS.md 匯入）。");
    say("Rules 已啟用。Claude Code 要開新的對話（重新執行 claude，或輸入 /clear）才會讀到。");
  },
  skill() {
    mkdirSync(path.dirname(FILES.skill), { recursive: true });
    copyFileSync(at("lab", "layers", "skill", "new-ticket", "SKILL.md"), FILES.skill);
    say("已放好開票 Skill：.claude/skills/new-ticket/SKILL.md");
    say("Skill 已啟用。重新執行 claude 之後，輸入 /new-ticket 加上任務內容就會用到它。");
  },
  gate() {
    const data = withoutGate(readSettings());
    data.hooks = data.hooks ?? {};
    data.hooks.PreToolUse = [
      ...(data.hooks.PreToolUse ?? []),
      { matcher: MATCHER, hooks: [{ type: "command", command: gateCommand(), timeout: 15 }] },
    ];
    writeSettings(data);
    say("已把閘門寫進 .claude/settings.json（PreToolUse hook，執行 lab/gate.mjs）。");
    say("閘門已啟用：tickets/ 沒有「開發中」的票時，Agent 改 site/ 底下的檔案會被擋下。");
    say("Claude Code 要重新執行（先輸入 /exit 離開，再執行 claude）才會載入閘門。");
  },
};

const turnOff = {
  rules() {
    if (existsSync(FILES.agentsMd)) {
      const template = readFileSync(at("lab", "layers", "rules", "AGENTS.md"), "utf8");
      if (readFileSync(FILES.agentsMd, "utf8") !== template) {
        mkdirSync(path.dirname(FILES.savedAgentsMd), { recursive: true });
        copyFileSync(FILES.agentsMd, FILES.savedAgentsMd);
        say("你寫的 AGENTS.md 先收在 lab/.saved/，下次 on rules 會放回來。");
      }
    }
    rmSync(FILES.agentsMd, { force: true });
    rmSync(FILES.claudeMd, { force: true });
    say("Rules 已關閉（CLAUDE.md、AGENTS.md 已移除）。");
  },
  skill() {
    rmSync(at(".claude", "skills", "new-ticket"), { recursive: true, force: true });
    removeIfEmpty(at(".claude", "skills"));
    removeIfEmpty(at(".claude"));
    say("Skill 已關閉（.claude/skills/new-ticket 已移除）。");
  },
  gate() {
    if (existsSync(FILES.settings)) writeSettings(withoutGate(readSettings()));
    say("閘門已關閉（.claude/settings.json 裡的閘門已移除）。Claude Code 要重新執行才會生效。");
  },
};

// tickets/ 裡的票：[{ name, status }]
function tickets() {
  if (!existsSync(FILES.tickets)) return [];
  return readdirSync(FILES.tickets)
    .filter((name) => name.toLowerCase().endsWith(".md") && name.toLowerCase() !== "readme.md")
    .sort()
    .map((name) => {
      const text = readFileSync(path.join(FILES.tickets, name), "utf8").replace(/^﻿/, "");
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
      const status = /^status:\s*["']?([^"'#\r\n]*)/m.exec(frontmatter)?.[1].trim() ?? "";
      return { name, status: status || "（沒有寫 status）" };
    });
}

// 和起點（最新的 Commit）比，哪些檔案不一樣：[{ mark, file }]
function changes(...paths) {
  const result = git("-c", "core.quotePath=false", "status", "--porcelain", "--untracked-files=all", "--", ...paths);
  if (result.status !== 0) {
    say("這個資料夾不是 Git Repo：請用 git clone 取得這個專案，不要下載 ZIP。");
    process.exit(1);
  }
  const words = { "??": "新增", D: "刪除", A: "新增", R: "改名" };
  return result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const code = line.slice(0, 2);
      return { mark: words[code] ?? words[code.trim()[0]] ?? "修改", file: line.slice(3).replace(/^"|"$/g, "") };
    });
}

// 這個實驗自己產生的檔案，不算「被改到的其他檔案」
const OWN = ["CLAUDE.md", "AGENTS.md", ".claude/", "tickets/", "lab/.saved/"];
const isOwn = (file) => OWN.some((own) => file === own || file.startsWith(own));

function status() {
  say("== 現在啟用了哪幾層 ==");
  for (const [key, label] of Object.entries(LAYERS)) {
    say(`  ${isOn[key]() ? "［開］" : "［關］"} ${label}　node lab.mjs ${isOn[key]() ? "off" : "on"} ${key}`);
  }
  const command = gateInSettings();
  if (command !== null && command !== gateCommand()) {
    say("  注意：閘門設定的路徑和這個資料夾不一樣（資料夾搬過？）：執行 node lab.mjs on gate 重新寫入。");
  }

  say("== tickets/ 的票 ==");
  const list = tickets();
  if (list.length === 0) say("  沒有票");
  for (const ticket of list) say(`  ${ticket.status}　${ticket.name}`);
  const active = list.filter((ticket) => ticket.status === "開發中").length;
  say(active > 0 ? `  有 ${active} 張「開發中」的票` : "  沒有「開發中」的票");
  if (isOn.gate()) say(active > 0 ? "  → 閘門會放行 site/ 的修改" : "  → 閘門會擋下 site/ 的修改");

  say("== site/ 有沒有改過（和起點比）==");
  const site = changes("site");
  if (site.length === 0) say("  沒有修改");
  for (const change of site) say(`  ${change.mark}　${change.file}`);

  const others = changes(".").filter((change) => !change.file.startsWith("site/") && !isOwn(change.file));
  if (others.length > 0) {
    say("== site/ 以外被動到的檔案 ==");
    for (const change of others) say(`  ${change.mark}　${change.file}`);
  }
}

function reset(all) {
  changes("site"); // 先確認是 Git Repo
  // 有版本紀錄的檔案全部還原（site/、check.mjs、TASK.md…），再清掉 site/ 底下新增的檔案
  git("restore", "--source=HEAD", "--staged", "--worktree", "--", ".");
  git("clean", "-fd", "--", "site");
  say("site/ 已還原成起點（check.mjs 等原本的檔案如果被改過，也一起還原了）。");
  if (!all) {
    const left = changes(".").filter((change) => !isOwn(change.file));
    if (left.length > 0) {
      say("site/ 以外新增的檔案沒有刪，要不要留由你決定：");
      for (const change of left) say(`  ${change.file}`);
    }
    say("已啟用的層與 tickets/ 都保留。要全部回到起點：node lab.mjs reset --all");
    return;
  }
  turnOff.gate();
  rmSync(at(".claude", "skills", "new-ticket"), { recursive: true, force: true });
  removeIfEmpty(at(".claude", "skills"));
  removeIfEmpty(at(".claude"));
  rmSync(FILES.agentsMd, { force: true });
  rmSync(FILES.claudeMd, { force: true });
  rmSync(at("lab", ".saved"), { recursive: true, force: true });
  rmSync(FILES.tickets, { recursive: true, force: true });
  say("全部回到起點：Rules、Skill、閘門都關掉了，你寫的 AGENTS.md 與 tickets/ 也清掉了。");
}

function usage() {
  say("用法：");
  say("  node lab.mjs status          看現在的狀態");
  say("  node lab.mjs on <層>         啟用一層：rules、skill、gate");
  say("  node lab.mjs off <層>        關掉一層");
  say("  node lab.mjs reset           把 site/ 還原成起點，重做同一個任務");
  say("  node lab.mjs reset --all     全部回到起點");
}

const [command, argument, ...rest] = process.argv.slice(2);
if (command === "status" && argument === undefined) {
  status();
} else if ((command === "on" || command === "off") && Object.hasOwn(LAYERS, argument ?? "") && rest.length === 0) {
  (command === "on" ? turnOn : turnOff)[argument]();
} else if (command === "reset" && (argument === undefined || (argument === "--all" && rest.length === 0))) {
  reset(argument === "--all");
} else {
  if (command === "on" || command === "off") say(`沒有「${argument ?? ""}」這一層。可以用的是：rules、skill、gate`);
  usage();
  process.exit(command === undefined ? 0 : 1);
}
