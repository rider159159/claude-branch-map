# ROADMAP

claude-branch-map 的長期方向與分階段交付。動態文件,每階段結束調整。

每階段交付物的核心要求:**能獨立 demo 出可用功能**,不能是「半成品系統」。

---

## 設計哲學

- AI 容易腦補功能、越界做事 — 明確列「不做的事」比列「要做的事」更重要
- 一個 task = 一個可獨立 commit 的邏輯改動
- 隱形成本(IPC 三層同步、設定向後相容、Windows 路徑分隔符)優先處理,不要被外觀拉走注意力

---

## Phase 0(已完成,2026-05)

**交付**

- ✅ 掃描 `~/.claude/projects/` 並顯示專案 → session 列表
- ✅ Session 對應 Git 分支(hook + 時間窗雙層匹配)
- ✅ 對話內容檢視 (MessageView)
- ✅ 釘選 / 隱藏 / 復原(專案 + session)
- ✅ 在 VS Code 繼續對話(deep link)
- ✅ Session 自訂標題 + tag + 搜尋
- ✅ macOS arm64 打包

---

## Phase 1 — 流程順手(進行中,2026-06)

> 目標:把「找回對應對話的最後一哩」走得不踉蹌。

對應 `docs/optimization-plan.md` 第一輪。

**規劃中**

- 🚧 失敗訊息分類(VS Code 開啟失敗時告知具體原因)
- 🚧 補 Cursor 支援(原規格書 `docs/open-in-editor-plan.md` 要求)
- 🚧 移除「開資料夾後等 1500ms」的硬編碼延遲
- 🚧 全域搜尋(跨所有未隱藏專案)
- 🚧 快速 checkout / 在終端開分支對應的 repo

**明確不做**

- 不做 Cursor / VS Code 同時並存(只能選一個 preferred)
- 不做自動偵測使用者裝了哪個編輯器
- 不做雲端同步 settings

---

## Phase 2 — 維運與長期使用(規劃,2026-07+)

> 目標:幾週後回頭仍可用,不會因為磁碟堆積或設定漂移而崩潰。

**候選**

- 大量 session 下的列表效能(虛擬滾動)
- Session 歸檔 / 匯出(離線備份)
- 設定備份 / 還原(避免重灌後設定丟失)
- 多窗模式(同時看兩個專案)

**明確不做**

- 不做 session 編輯(本工具是讀取/瀏覽,不改寫 ~/.claude/projects/ 內容)
- 不做雲端帳號

---

## Phase 3 — 開放(視 GitHub Issue 而定)

- 視使用者反饋決定
