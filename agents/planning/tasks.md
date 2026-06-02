# Tasks

正在跑的 task brief。

**狀態圖示**:`🚧` 進行中 · `✅` 完成 · `🚫` 暫緩 / 等待澄清

**前綴**:`🔧` Track B 變更 · `🐛` Track C 除錯 · 無前綴 = Track A 新功能

完整 brief 規格見 `agents/templates/{task,change-request,bug-report}.md`。

---

## 🔧 砍掉 session tag 系統,搜尋只搜自訂標題

**Context** — 既有 SessionRow 編輯態有「自訂標題 + 標籤」兩欄,SessionList 搜尋支援 `#tag` 前綴。實際用下來標籤只是干擾(對話本就有 cwd / branch / customTitle 三層分類,tag 重複了),且 placeholder「搜尋對話:標題、自訂標題、cwd、#tag、sessionId」字串長到塞滿搜尋框。本 task 把 tag 系統整段砍掉,讓 SessionNote 只剩 title。

**既有行為**
- SessionRow 點 ✎ 進編輯態 → 兩個 input(自訂標題 + 標籤,空白或逗號分隔)+ 取消 / 儲存
- SessionRow row 上(非編輯態)`session.tags.length > 0` 時顯示 `.session-tags` chip 區塊
- SessionList 搜尋框 placeholder「搜尋對話:標題、自訂標題、cwd、#tag、sessionId」
- SessionList 搜尋邏輯:`#` 開頭 → 只比對 tag;否則 title / customTitle / cwd / sessionId / tags 全文比對
- `SessionNote = { title, tags }`;`SessionNotesMap` IPC 寫入接受 `{ title?, tags? }`
- `settings.json` 的 `sessionNotes[sessionId]` 儲存 `{ title, tags }`,既有使用者已有 tag 資料

**變更內容**
- `SessionSummary.tags`、`SessionNote.tags` 移除
- SessionRow 編輯態只剩自訂標題一欄
- SessionRow 非編輯態移除 `.session-tags` 渲染
- SessionList 搜尋邏輯移除 `#` 前綴分支,haystack 移除 `...session.tags`;placeholder 改「搜尋對話:標題、自訂標題、cwd、sessionId」
- IPC payload `{ title?: string }` 移除 `tags?: string[]`
- `readSessionNotes()` 讀 settings.json 時,**舊鍵 `tags` 讀進來直接丟掉**(不報錯、不警告),只保留 `title`;若舊 entry `title` 為空但 `tags` 非空,該 entry 整個丟棄
- `updateSessionNote()` 移除 tags 處理

**影響範圍**
- shared:`src/shared/types.ts`(SessionSummary、SessionNote)
- shared:`src/shared/sessions.ts`(scanSessionsInProject 預設值)
- main:`src/main/settings.ts`(readSessionNotes、updateSessionNote)
- main:`src/main/ipc.ts`(sessions:forProject、sessions:hidden、sessionNotes:set 三處)
- preload:`src/preload/index.ts`(setSessionNote payload 型別)
- renderer:`src/renderer/api.ts`(setSessionNote payload 型別)
- renderer:`src/renderer/App.tsx`(onSaveNote 簽章與 in-place 更新)
- renderer:`src/renderer/components/SessionList.tsx`(matchesQuery、placeholder)
- renderer:`src/renderer/components/SessionRow.tsx`(editing state、JSX、render)
- renderer:`src/renderer/styles.css`(`.session-tags` 與 `.session-tag` class 移除)— **本 PR 暫不含**,延後到色票工作合進 main 後另開小 PR 補。React 已不再渲染對應節點,留下 dead CSS 不影響功能
- IPC 通道:無新增,僅 payload 型別瘦身

**Backward compat 評估**
| 既有行為 | 變更後 | 性質 |
| --- | --- | --- |
| 已存在的 `sessionNotes[id].tags` | 讀取時 silently 丟掉,下次 setSessionNote 時 settings.json 該鍵也消失 | ⚠ 改變但無破壞(使用者看不到 tag UI 也搜不到,等同被砍) |
| `sessionNotes[id].title` | 不變 | ✅ 保留 |
| `#xxx` 搜尋語法 | 不再特殊處理,當一般字串搜 title/customTitle/cwd/sessionId(會搜不到任何結果) | ⛔ 破壞性(搜尋習慣) |
| IPC `setSessionNote` 傳 `{ tags }` | TypeScript 編譯期擋下;舊執行檔 IPC call 含 tags 會被忽略 | ⚠ 改變但無破壞 |

> 結論:含破壞性變更(`#tag` 搜尋語法)。使用者已決定砍 tag,該語法本來就只服務 tag,連動消失符合預期。已存的 tag 資料 silently 丟棄,不做 migration 提示。

**新 Acceptance**
- [ ] SessionRow 編輯態只有「自訂標題」一個 input,無標籤欄
- [ ] SessionRow row 上不再顯示 tag chip
- [ ] SessionList 搜尋框 placeholder 不再含 `#tag`
- [ ] 搜尋「abc」可比對 title / customTitle / cwd / sessionId
- [ ] 搜尋「#abc」不再特殊處理(等同搜不到,因 # 不會出現在這些欄位)
- [ ] 既有 settings.json 內含 tag 資料的環境,啟動 app 不會報錯,tag 被靜默丟棄
- [ ] 新存 SessionNote 後 settings.json 該 entry 不含 `tags` 鍵
- [ ] `npm run build` 全綠
- [ ] `code-reviewer` 通過

**Non-goals**
- 不做 tag 資料 migration 提示(無預警丟掉)
- 不重構 SessionNote 型別命名(仍叫 SessionNote / SessionNotesMap,只是欄位變少)
- 不動 SessionRow 編輯態的 popover 化(那是 optimization-plan #9 另案)
- 不順手做其他畫面細節優化(下一輪再開新 task)

**References**
- 既有實作:`src/renderer/components/SessionRow.tsx:60-110`、`src/renderer/components/SessionList.tsx:23-40`
- 既有 SessionNote 型別:`src/shared/types.ts:25-30`
