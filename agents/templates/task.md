# Task 範本(Track A — 新功能)

一個 task = 一個可獨立 commit 的邏輯改動。複製下方骨架貼到 `agents/planning/tasks.md`,當新的 `## <任務名稱>` 區塊。

---

## 使用方式

1. 複製下方「範本骨架」整段
2. 貼到 `tasks.md` 任務列表最上方
3. 填完五個欄位(**Context / Goal / Scope / Acceptance / Non-goals**)後再動工
4. 動工後標題前加 `🚧`,完成後加 `✅` 並附 commit hash

五個欄位都是必填。沒填等於沒想清楚,動工後容易踩雷。

---

## 範本骨架

```markdown
## <動詞開頭的任務名稱,例如:加上「在 Cursor 繼續對話」按鈕>

**Context** — 為什麼要做?目前有什麼問題 / 觸發點?
(一兩句話。寫不出來代表這個 task 可能還不該動工。)

**Goal** — 做完之後,使用者 / 系統會多出什麼能力?
- 1–3 條 bullet,描述「完成後的世界」而不是「要做的步驟」

**Scope** — 影響哪些檔案 / IPC 通道 / 設定鍵?
- main:`src/main/...`
- preload:`src/preload/index.ts`
- renderer:`src/renderer/...`
- shared:`src/shared/types.ts`
- 設定鍵(AppSettings):新增 / 修改的鍵與預設值
- IPC 通道:新增的 `domain:verb` 列表

**Acceptance** — 怎樣算做完?可驗證的勾選項
- [ ] 行為 1(描述使用者能做什麼,不是「程式做了什麼」)
- [ ] 行為 2
- [ ] `npm run build` 全綠
- [ ] 動到 IPC → `ipc-boundary-reviewer` 子代理通過
- [ ] 動到 UI → 在 dev 環境手動驗收 golden path + 邊界

**Non-goals** — 這次明確不做什麼?避免 scope creep
- 不做 X(之後另開 task)
- 不重構 Y(這次只動最小改動)

**References**(選填)— 相關 PR / commit / 文件 / 既有實作可參考
- `src/...` 既有類似功能可參考
- 文件參考:<link>
```

---

## 完整範例

```markdown
## 加上「在 Cursor 繼續對話」按鈕

**Context** — 目前 MessageView 只有「在 VS Code 繼續對話」,Cursor 使用者得退回複製 resume 指令。規格書 `docs/open-in-editor-plan.md` 原本就把 Cursor 列為 v1 範圍。

**Goal**
- 設定面板提供「VS Code / Cursor」下拉
- 按鈕標籤依設定動態變更
- Cursor 路徑使用 `cursor` CLI 與 `cursor://anthropic.claude-code/open?session=...` URI scheme

**Scope**
- shared:`AppSettings.preferredEditor: 'vscode' | 'cursor'` + DEFAULT_SETTINGS
- main:`src/main/resume.ts` 抽編輯器設定查詢、URI template、CLI 名稱
- main:`src/main/settings.ts` getSettings / updateSettings 加 preferredEditor
- renderer:`src/renderer/components/MessageView.tsx` 按鈕標籤動態化
- renderer:`src/renderer/components/SettingsPanel.tsx` 加下拉

**Acceptance**
- [ ] 設定切到 Cursor 後按鈕變「在 Cursor 繼續對話」
- [ ] Cursor 已開 → 點按鈕能 resume 到正確 session
- [ ] Cursor 未開 → 自動 spawn cursor + 開 workspace + resume
- [ ] 既有「在 VS Code 繼續對話」流程不變(backward compat)
- [ ] `npm run build` 全綠
- [ ] `ipc-boundary-reviewer` 通過(因動到 settings IPC payload)

**Non-goals**
- 不做「點按鈕後彈選單同時開兩個編輯器」
- 不做自動偵測使用者裝了哪個編輯器
- 不重構 resume.ts 的整體結構(只擴成支援第二個編輯器)

**References**
- 規格書:`docs/open-in-editor-plan.md`
- 既有實作:commit `7e8f78c`
```
