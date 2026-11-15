# Harness 實驗室（harness-lab）

海豹學院 FDE Bootcamp Day 9 下午的練習 Repo：同一個小任務做五輪，從「沒有任何規矩的 Agent」開始，親手一層一層加上 Harness，每加一層就重做一次，看 Agent 的行為哪裡變了。

**五輪的步驟與每一輪要看什麼，在 [`lab/GUIDE.md`](lab/GUIDE.md)。** 這份 README 只說明這個 Repo 有什麼、指令怎麼用。

- 專案本身很小：`site/` 是一個靜態的「活動報名頁」，`check.mjs` 是它的檢查。
- 不用 `npm install`、不用 Docker、不用 Python。只要 Git、Node.js（24 以上）與 Claude Code。
- Mac、Windows 的 PowerShell 與 Git Bash，指令的寫法都一樣。

## 裡面有什麼

| 位置 | 內容 |
|---|---|
| `site/index.html`、`site/app.js`、`site/style.css` | 活動報名頁：表單、檢查報名資料、送出後的確認訊息 |
| `site/event-config.js` | 活動設定（名額、每筆報名的人數上限），由主辦單位維護 |
| `check.mjs` | 報名頁的檢查，執行 `node check.mjs` |
| `TASK.md` | 五輪都做的同一個任務，原樣貼給 AI |
| `lab.mjs` | 切換指令：啟用或關掉一層、重來、看狀態 |
| `lab/GUIDE.md` | 五輪實驗的步驟與每一輪看什麼（給學員看的，不要貼給 AI） |
| `lab/` 的其他檔案 | 還沒啟用的三層素材（Rules 的骨架、開票 Skill、閘門的程式） |
| `docs/對照表.md` | 這個迷你版的四層，對應到正式 Harness 模板的哪些檔案 |

剛 Clone 下來時，根目錄沒有 `CLAUDE.md`、`AGENTS.md`，也沒有 `.claude/`：Agent 在這裡沒有任何規矩。

## 開始之前

```bash
git clone 這個 Repo 的網址
cd harness-lab
node -v
node check.mjs
node lab.mjs status
```

- `node -v` 印出 v24 以上。
- `node check.mjs` 最後一行是 `[check] OK`。
- `node lab.mjs status` 顯示三層都是［關］、沒有票、`site/` 沒有修改。
- 用瀏覽器打開 `site/index.html`（在檔案總管或 Finder 對它按兩下），看得到報名表單；填好送出，下方出現確認訊息。

## 切換指令

都在 `harness-lab` 資料夾裡執行。

| 指令 | 做什麼 |
|---|---|
| `node lab.mjs status` | 列出現在啟用了哪幾層、`tickets/` 有哪些票、`site/` 和起點比改了哪些檔案 |
| `node lab.mjs on rules` | 啟用 Rules：建立 `CLAUDE.md`（只有一行 `@AGENTS.md`）與 `AGENTS.md`（三個空格讓你寫規則） |
| `node lab.mjs on skill` | 啟用 Skill：把開票 Skill 放到 `.claude/skills/new-ticket/SKILL.md` |
| `node lab.mjs on gate` | 啟用閘門：在 `.claude/settings.json` 加一個 PreToolUse hook，Agent 改檔之前先執行 `lab/gate.mjs` |
| `node lab.mjs off rules`（或 `skill`、`gate`） | 關掉那一層。關掉 Rules 時，你寫的 `AGENTS.md` 會先收在 `lab/.saved/`，下次 `on rules` 放回來 |
| `node lab.mjs reset` | 把 `site/` 還原成起點、清掉 `site/` 底下新增的檔案；已啟用的層與 `tickets/` 都保留。每一輪開始前執行 |
| `node lab.mjs reset --all` | 全部回到起點：三層都關掉，你寫的 `AGENTS.md` 與 `tickets/` 也清掉 |

- 啟用或關掉任何一層之後，Claude Code 要重新開始才會生效：輸入 `/exit` 離開，再執行 `claude`。
- 每一輪都用新的對話：上一輪的對話內容會影響 Agent，比較就不準了。
- `reset` 用的是 Git：它把檔案還原成最新一次 Commit 的樣子。做實驗的過程不要 Commit。

## 五輪各做什麼

| 輪 | 做什麼 | 開始前的指令 |
|---|---|---|
| 第 1 輪 | 聊天式 AI（一問一答）：把任務貼給聊天式的 AI，自己動手把它的回答放進 `site/` | 不用 |
| 第 2 輪 | Agent，沒有任何規矩：在 Claude Code 貼上任務 | `node lab.mjs reset` |
| 第 3 輪 | 加上 Rules：在 `AGENTS.md` 寫三條自己的規則，再做一次 | `node lab.mjs reset`、`node lab.mjs on rules` |
| 第 4 輪 | 加上 Skill：用 `/new-ticket` 加任務的文字，先開票再做 | `node lab.mjs reset`、`node lab.mjs on skill` |
| 第 5 輪 | 打開閘門：沒有票直接做一次，再開票做一次 | `node lab.mjs reset`、`node lab.mjs on gate` |

任務的文字在 `TASK.md`，五輪都原樣貼上。每一輪的詳細步驟與「看什麼」在 `lab/GUIDE.md`。

## 常見問題

- **`node lab.mjs` 印出「這個資料夾不是 Git Repo」**：這個 Repo 要用 `git clone` 取得，不要下載 ZIP。
- **啟用了閘門，Agent 還是改得動 `site/`**：先看 `node lab.mjs status`，確認閘門是［開］、沒有「開發中」的票；再確認啟用之後有重新執行 `claude`。資料夾搬過位置的話，再執行一次 `node lab.mjs on gate`。
- **輸入 `/new-ticket` 沒有反應**：確認 `node lab.mjs status` 的 Skill 是［開］，而且啟用之後有重新執行 `claude`。
- **第 3 輪 Agent 好像沒有讀到規則**：確認 `AGENTS.md` 有存檔，而且是在 `harness-lab` 資料夾裡執行 `claude`；在 Claude Code 輸入 `/memory` 可以看到它載入了哪些規則檔。
