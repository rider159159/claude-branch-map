# 開發流程 SOP — 三軌任務分類

本文件改寫自上游模板 [hsiangfeng/agent-template](https://github.com/hsiangfeng/agent-template) 的 `dev-workflow.md` 與 `needs-analysis SKILL.md`,並針對 claude-branch-map 的 Electron + React 三層架構做調整。

## 邊界

**本流程做的**

- 判斷任務類型(新功能 / 修改需求 / 除錯),走對應子流程
- 釐清模糊、衝突、邊界
- 套對應範本產出 brief,寫進 `agents/planning/tasks.md`
- 記錄詢問與裁決(Q&A)到當日 dev-log

**本流程不做的**

- 不做設計細節 — 那是動工階段的事
- 不開始寫 code — 寫 brief 完成才動工
- 不審查既有 code — 那是 `code-reviewer` 子代理的事(commit 前)

---

## Step 0 — 判斷任務類型(永遠最先做)

| 類型 | 觸發訊號 | 子流程 |
|---|---|---|
| 新功能(Track A) | 「想做 X」「加上 X」「新增 X」「需求是 X」 | A:需求分析 |
| 修改需求(Track B) | 「把 X 改成 Y」「X 加上 Y」「X 換成 Y」「X 太...,改成...」 | B:變更分析 |
| 除錯(Track C) | 「X 壞了」「X 不動」「點 X 沒反應」「報錯:」「應該 X 結果變 Y」 | C:bug triage |
| 不確定 | — | 先用 `AskUserQuestion` 釐清類型 |

同時含「修改 + 新增」→ 拆兩個 task 分別走 B 與 A。

---

## 三條共通紀律

1. **不確定不能往前** — 模糊處先 `AskUserQuestion`,不腦補
2. **產出文件不只是回覆** — 釐清完一定要寫到 `agents/planning/tasks.md`
3. **記下 Q&A** — 諮詢使用者的問題與裁決寫進當日 dev-log 的「詢問與裁決」區塊

---

## 子流程 A — 新功能(Track A)

### A.1 對齊既有架構(claude-branch-map 專用)

讀過 `CLAUDE.md`「1. 專案總覽與架構」一節,確認:

- 影響哪些程序?(main / preload / renderer / shared)
- 需不需要新 IPC 通道?(需要 → A.2 必須列出三層改動點)
- 是否動到 `electron-store` 的 `AppSettings`?(動到 → 注意 cache 是否要 reset)
- 是否動到 `~/.claude/projects/` 的掃描邏輯或分支匹配?

### A.2 列出模糊處 / 邊界 / 衝突

- **語意模糊**:「快一點」「好用」「乾淨」這類沒驗收門檻的詞
- **邊界未定**:誰能用?什麼狀態下能用?失敗時怎麼處理?
- **與既有規範衝突**:是否違反 CLAUDE.md 的編碼規範?renderer 是否誤碰 node:* / electron / simple-git?
- **缺失資訊**:欄位定義、驗證規則、UX 流程

### A.3 IPC 三層影響評估(若涉及 IPC)

| 層 | 檔案 | 改動內容 |
|---|---|---|
| preload | `src/preload/index.ts` | 新方法、確認 contextBridge 暴露 |
| main | `src/main/ipc.ts` | 新 `ipcMain.handle('domain:verb', ...)` |
| renderer | `src/renderer/api.ts` | 擴充 `RendererApi` 型別 |
| shared | `src/shared/types.ts` | 新 payload 型別 |

任一缺項 → brief 標 `⚠ 含 IPC 改動`,動工後呼叫 `ipc-boundary-reviewer` 子代理檢查。

### A.4 套 `templates/task.md` 範本

填五個必填欄位(Context / Goal / Scope / Acceptance / Non-goals)寫到 `tasks.md`。

### A.5 完成判定

`tasks.md` 新增 `## <任務名稱>` 區塊、五欄位填齊、使用者確認 brief 無誤。

---

## 子流程 B — 修改需求(Track B)

### B.1 先讀既有實作(Track B 核心)

不要憑想像規劃,動筆前先:

- Grep / Glob 找出所有相關檔案
- 讀既有 brief(在 `tasks.md` 找已標 ✅ 的相關項)
- 確認既有行為的入口 / 觸發路徑

### B.2 列出影響範圍

- 哪些檔案 / 模組 / IPC 通道會被動到
- 既有的相關文件(dev-log、commit message)哪些需要回頭看

### B.3 Backward compat 評估(Track B 核心,最常漏)

針對每個既有行為,逐項判定:

| 性質 | 含義 |
|---|---|
| ✅ 保留 | 變更後行為不變 |
| ⚠ 改變但無破壞 | 行為改了但使用者不會踩雷(純擴充) |
| ⛔ 破壞性 | 既有使用者習慣 / 設定 / IPC payload 會壞掉 |

⛔ 任一項 → brief 內明寫遷移指引(對 claude-branch-map 特別注意:`AppSettings` 的鍵新增 / 改名要在 `DEFAULT_SETTINGS` 與 `getSettings()` 提供 fallback)。

### B.4 套 `templates/change-request.md` 範本

填六個必填欄位(Context / 既有行為 / 變更內容 / 影響範圍 / Backward compat / 新 Acceptance / Non-goals)寫到 `tasks.md`,標題前綴 `🔧`。

### B.5 完成判定

change-request brief 六欄位填齊、Backward compat 表格逐項標、使用者確認。

---

## 子流程 C — 除錯(Track C)

### C.1 重現確認(Track C 第一步)

跟使用者確認重現步驟。模糊就 `AskUserQuestion`:

- 哪個專案 / 哪個 session 觸發?
- 怎麼點到那一步?前面有哪些動作?
- 是否每次都復現?或「有時候」?
- 是否與 hook 安裝狀態相關?

無法重現 → 標 `🚫 cannot reproduce` 並回問使用者,不要硬猜。

### C.2 找 Root Cause

用 Grep / Glob / Read 定位真正肇因,不只是症狀位置。

claude-branch-map 常見 root cause 類別:

| 表面症狀 | 可能 root cause |
|---|---|
| 「點 session 後右側空白」 | renderer 端 `fetchToken` 賽局,舊請求把新的 setState 蓋掉 |
| 「分支沒顯示」 | hook 沒裝 / `branch-hook.jsonl` 不存在 / `repoPathOverride` 指向錯 |
| 「重新整理後選擇被重置」 | `loadProjects` 的 `preferDir` 沒帶到 / `visibleProjects` 過濾後不在列表內 |
| 「Windows 下 cwd 過濾失效」 | 路徑分隔符未 normalize(`\` vs `/`) |
| 「設定改了沒生效」 | main 程序的 cache 沒 reset(`resetBranchCaches()`) |

定位不出來 → 老實在 brief 裡寫「root cause 待動工階段進一步調查」,不要強行歸因。

### C.3 影響範圍掃描(Track C 最易漏的盲點)

同一個 root cause 在別處也有嗎?同樣的 pattern、同樣的 cache、同樣的 hook 呼叫:

- Grep 找相同 pattern
- 逐處標記「✅ 已定位 / ⚠ 疑似 / ✅ 不受影響」

### C.4 套 `templates/bug-report.md` 範本

填七個必填欄位(症狀 / 重現步驟 / 期望行為 / Root cause / 影響範圍 / 修法策略 / Regression case)寫到 `tasks.md`,標題前綴 `🐛`。

### C.5 完成判定

bug-report 七欄位填齊、Root cause 明確(或誠實標「待調查」)、影響範圍逐處標、Regression case 列出。

---

## 反例(三 track 共通)

- ❌ 沒判斷類型就直接動筆 — 三類 brief 欄位不同、走錯範本要重做
- ❌ 使用者說「session 點不到」就直接動 renderer — 沒先確認是不是 main 程序 IPC handler 拋例外
- ❌ Acceptance 寫「功能正常運作」 — 沒有可驗證行為
- ❌ Non-goals 空著 — 一定有什麼是「這次不做」的,沒寫出來就會 scope creep
- ❌ Track C bug 只寫症狀沒寫 root cause — 修了表面,bug 換個地方爆
- ❌ Track B 沒做 Backward compat 評估 — `AppSettings` 改了既有使用者的設定檔開不起來
- ❌ 諮詢使用者後沒記 dev-log — 未來 session 無法回推當時的決策脈絡

---

## 銜接其他角色

- 完成 brief → 動工(實作 + 同輪補測試 / 手動驗證)
- 動工前若 brief 標 `⚠ 含 UI 工作` → 對照既有 `src/renderer/styles.css` 的命名與色票
- brief 標 `⚠ 含 IPC 改動` → 動工後呼叫 `ipc-boundary-reviewer` 子代理
- commit 前 → 呼叫 `code-reviewer` 子代理
- 新功能完成 → 呼叫 `spec-tester` 子代理產手動驗證清單
- 使用者半路打槍 → brief 留在 `tasks.md` 但加註 `🚫 等待澄清 / 暫緩`
