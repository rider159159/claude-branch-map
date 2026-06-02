# agents — AI 員工知識庫

此資料夾是 AI 助理(Claude Code / Cursor / Codex 等)與人類開發者共用的中央知識庫。動筆前先讀完本檔與 `conventions/dev-workflow.md`,讓 AI 與你走同一套流程。

主要參考來源:[hsiangfeng/agent-template](https://github.com/hsiangfeng/agent-template)(以下簡稱「上游模板」)。本專案為 Electron + React 桌面工具,僅搬入立即適用的部分,其餘等專案規模到達時再補。

---

## 目錄結構

```
agents/
├── README.md                          ← 你正在讀的這份
├── conventions/                       ← 不變的規範(commit / dev workflow)
│   ├── dev-workflow.md                ← 三軌任務 SOP(新功能 / 修改 / 除錯)
│   └── commit-message-format.md       ← Conventional Commits + emoji
├── templates/                         ← 任務 brief 範本
│   ├── task.md                        ← Track A(新功能)
│   ├── change-request.md              ← Track B(修改需求)
│   ├── bug-report.md                  ← Track C(除錯)
│   └── dev-log.md                     ← 每日開發日誌
├── planning/                          ← 會動的東西
│   ├── ROADMAP.md                     ← 大方向
│   └── tasks.md                       ← 進行中 / 待辦 task brief
└── dev-logs/                          ← 每日紀錄(YYYY-MM-DD.md)
    └── README.md
```

---

## 三軌任務分類(動筆前先判)

| 觸發訊號 | Track | 走範本 |
|---|---|---|
| 「想做 X」「新增 X」「加上 X」 | A 新功能 | `templates/task.md` |
| 「把 X 改成 Y」「X 換成 Z」 | B 修改需求 | `templates/change-request.md` |
| 「X 壞了」「點 X 沒反應」「報錯:」 | C 除錯 | `templates/bug-report.md` |

詳細子流程見 `conventions/dev-workflow.md`。

---

## 鐵則(摘錄,完整版見 dev-workflow.md)

1. **不確定不能往前** — 模糊處先用 `AskUserQuestion`(Claude Code)或對話釐清,不腦補
2. **產出文件不只是回覆** — 釐清完寫到 `planning/tasks.md`,不只是聊一聊
3. **記下 Q&A** — 對使用者諮詢的問題與裁決寫進當日 `dev-logs/YYYY-MM-DD.md` 的「詢問與裁決」區塊
4. **一個邏輯改動一個 commit** — 格式見 `conventions/commit-message-format.md`
5. **commit / push 前先更新當日 dev-log** — 沒事可寫的欄位寫「無」,不要刪欄位

---

## 與既有 `.claude/agents/` 的關係

專案根目錄 `.claude/agents/` 已有三個 Claude Code 子代理:

| 子代理 | 何時呼叫 |
|---|---|
| `code-reviewer` | commit 前 |
| `ipc-boundary-reviewer` | 新增 / 修改 IPC 通道後(對應 preload + main + renderer 三層) |
| `spec-tester` | 新功能完成後產手動驗證清單 |

`agents/`(本資料夾)與 `.claude/agents/`(子代理定義)互補:

- `.claude/agents/` 給 Claude Code runtime 用,定義「在 sub-agent context 裡執行什麼」
- `agents/` 給人類與 AI 共讀,定義「整個專案怎麼做事、怎麼留紀錄」

---

## 起手式(每次接到新需求)

1. 用 dev-workflow.md 的 Step 0 判斷 Track
2. 套對應 brief 範本,寫到 `planning/tasks.md`
3. 動工後 brief 標題前加 `🚧`
4. 寫程式時遵守 `conventions/commit-message-format.md` 的 commit 格式
5. 當日結束前更新 `dev-logs/YYYY-MM-DD.md`
6. commit / push
7. brief 完成後標題加 `✅` 並附 commit hash
