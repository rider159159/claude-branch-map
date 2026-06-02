# Tasks

正在跑的 task brief。

**狀態圖示**:`🚧` 進行中 · `✅` 完成 · `🚫` 暫緩 / 等待澄清 · `🅿️` 暫停(動到一半遇 blocker,詳情移至 [backlog.md](backlog.md))

**前綴**:`🔧` Track B 變更 · `🐛` Track C 除錯 · 無前綴 = Track A 新功能

完整 brief 規格見 `agents/templates/{task,change-request,bug-report}.md`。
暫停 / 已知 bug / 構想未動工的條目見 [backlog.md](backlog.md)。

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

---

## 🅿️ Claude hook 一鍵啟用 / 移除按鈕(#2 簡化版)

> **2026-06-02 暫停**:腳本 PS 5.1 相容性問題(`ConvertFrom-Json -AsHashtable` PS 7+ 才有)。本 task code 已 revert,詳情與重啟條件見 [backlog.md](backlog.md) 同名條目。

**Context** — 本 app 的分支匹配高信心路徑需要 `~/.claude/hooks/branch-hook.{ps1,sh}` 與 `~/.claude/settings.json` 的 PostToolUse 註冊。目前已有 `scripts/install-hook.{ps1,sh}` 可裝、且本身是 idempotent + append-only 不破壞既有 hook,但使用者得自己去 repo 跑命令列。本 task 補兩顆按鈕讓 app 替使用者跑 install / uninstall 腳本,**不做狀態偵測、不做 banner、不做精確的成敗判斷**。能裝就裝,不能就 Toast。**加移除按鈕的理由**:使用者若日後刪 app,寫進 `~/.claude/settings.json` 的 PostToolUse 與 `~/.claude/hooks/branch-hook.*` 不會自動消失,Claude Code 仍會每次 tool call 跑那支孤兒腳本。提供移除按鈕讓使用者卸載前可清乾淨。

**Goal**
- 設定面板加「啟用 Claude hook」與「移除 Claude hook」兩顆按鈕
- 按下後 app 在主程序 spawn 對應平台的 install / uninstall 腳本
- 成功 → Toast 提示「已嘗試啟用 / 已移除,請重開 Claude Code 對話才會生效」
- 失敗 → Toast 顯示錯誤訊息(stderr 第一行或 exit code)
- 移除**不刪** `~/.claude/branch-hook.jsonl` 歷史紀錄(留給使用者自己 CLI `--purge-log` 處理)

**Scope**
- shared:[src/shared/types.ts](../../src/shared/types.ts) 加 `InstallHookResult = { ok: boolean; message?: string }` 型別(install / uninstall 共用)
- main:[src/main/ipc.ts](../../src/main/ipc.ts) 加 `hook:install` 與 `hook:uninstall` 兩個 IPC handler,共用 `runHookScript('install-hook' | 'uninstall-hook')` 函式
- main:`runHookScript` 用 `execFile` 跑對應平台腳本:
  - Windows:`execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', <script absolute path>])`
  - macOS/Linux:`execFile('bash', [<script absolute path>])`
  - 腳本路徑:`app.isPackaged ? path.join(process.resourcesPath, 'scripts', name) : path.join(app.getAppPath(), 'scripts', name)`
  - 成功(exit 0)→ 回 `{ ok: true }`
  - 失敗 → 回 `{ ok: false, message: stderr.split('\n')[0] || `exit ${code}` }`
  - timeout 30s,避免互動式提示卡住 UI
- preload:[src/preload/index.ts](../../src/preload/index.ts) 暴露 `installHook()` 與 `uninstallHook()`
- renderer:[src/renderer/api.ts](../../src/renderer/api.ts) 補對應型別
- renderer:[src/renderer/components/SettingsPanel.tsx](../../src/renderer/components/SettingsPanel.tsx) 加「Claude hook 整合」區塊,內含兩顆按鈕(啟用 / 移除)
- renderer:`SettingsPanel` 需要 `onToast` callback;App.tsx 把 setToast 傳下來
- 打包:[electron-builder.yml](../../electron-builder.yml) 加 `extraResources`,filter 含 `install-hook.*` / `uninstall-hook.*` / `branch-hook.*`

**Acceptance**
- [ ] 設定面板能看到「啟用 Claude hook」與「移除 Claude hook」兩顆按鈕
- [ ] 點啟用按鈕(dev 模式)→ install 腳本被執行 → 成功 Toast 出現,`~/.claude/settings.json` 多一筆 PostToolUse、`~/.claude/hooks/branch-hook.*` 存在
- [ ] 點移除按鈕(dev 模式)→ uninstall 腳本被執行 → 成功 Toast 出現,`~/.claude/settings.json` 中的 branch-hook PostToolUse 消失、`~/.claude/hooks/branch-hook.*` 被刪
- [ ] 移除按鈕**不刪** `~/.claude/branch-hook.jsonl`(歷史紀錄保留)
- [ ] 點按鈕(腳本 stderr / exit code 非零)→ 失敗 Toast 顯示錯誤摘要
- [ ] 重複按按鈕不會壞(腳本本身 idempotent)
- [ ] 打包後(`npm run package:dir`)兩顆按鈕仍能找到腳本執行
- [ ] `npm run build` 全綠
- [ ] `ipc-boundary-reviewer` 通過(新增 2 個 IPC 通道)

**Non-goals**
- 不做 hook 狀態偵測(不查 settings.json、不查 branch-hook.jsonl)
- 不做頂部 banner、不加 AppSettings 任何鍵
- 不做按鈕的 disabled / 「已裝」標記
- 不做「重開 Claude Code 對話才生效」之外的精細提示
- 不做使用者已有 PostToolUse hook 的特別處理(腳本已 idempotent + append)
- 不做 cache reset
- 不暴露 uninstall 的 `--purge-log` 選項(jsonl 是使用者歷史資料,不預設刪)
- 不在 NSIS / DMG 安裝器層做卸載清理(scope 太大,留待未來)

**References**
- 安裝腳本:[scripts/install-hook.ps1](../../scripts/install-hook.ps1)、[scripts/install-hook.sh](../../scripts/install-hook.sh)
- 移除腳本:[scripts/uninstall-hook.ps1](../../scripts/uninstall-hook.ps1)、[scripts/uninstall-hook.sh](../../scripts/uninstall-hook.sh)
- 規格出處:[docs/optimization-plan.md](../../docs/optimization-plan.md) #2(已大幅縮小範圍)

---

## 🔧 VS Code 失敗訊息分類化(#1)

**Context** — 目前 `onOpenInVscode` 失敗時,只回「VS Code 開啟失敗,已改為複製 resume 指令」。使用者看不到失敗原因(spawn / URI / cwd 不存在),無從修。失敗模式至少四種,得分類給出對應提示。

**既有行為**
- 目前:[src/main/resume.ts:38-59](../../src/main/resume.ts#L38-L59) `openInVscode` 回 `{ ok: boolean; error?: string }`,error 是原始 Error message
- 目前:[src/renderer/App.tsx:330-338](../../src/renderer/App.tsx#L330-L338) 失敗就 fallback 複製指令,Toast 文字寫死「VS Code 開啟失敗,已改為複製 resume 指令:{cmd}」
- 目前:四種失敗(cwd 不存在 / cwd 已刪 / `code` CLI 不在 PATH / URI handler 沒接到)都看起來一樣

**變更內容**
- `OpenInVscodeResult` 加 `reason` 欄位,enum:`'no-cwd' | 'cwd-missing' | 'editor-cli-missing' | 'uri-failed' | 'unknown'`
- main 端 `openInVscode` 依錯誤 code 填 reason:
  - `cwd == null || trim == ''` → `no-cwd`
  - `cwd` 用 `fs.existsSync` 預檢失敗 → `cwd-missing`
  - `openWorkspaceFolder` 兩次 ENOENT(`code` 與 `code.cmd` 皆失敗)→ `editor-cli-missing`
  - `shell.openExternal` 失敗 → `uri-failed`
  - 其他 → `unknown`
- renderer 端 `onOpenInVscode` 依 reason 給對應 Toast 文案,**仍自動複製 resume 指令**(沿用既有 fallback 行為),Toast 在文案末尾附加「原因:{reason 對應提示}」

**影響範圍**
- shared:[src/shared/types.ts](../../src/shared/types.ts) `OpenInVscodeResult` 加 `reason` 欄位
- main:[src/main/resume.ts](../../src/main/resume.ts) `openInVscode` 與 `openWorkspaceFolder` 改寫(預檢 cwd、區分兩種 ENOENT)
- renderer:[src/renderer/App.tsx](../../src/renderer/App.tsx) `onOpenInVscode` 依 reason 分支文案
- IPC:無新通道(payload 擴充,向後相容)

**Backward compat 評估**
| 既有行為 | 變更後 | 性質 |
| --- | --- | --- |
| 成功路徑回 `{ ok: true }` | 不變 | ✅ 保留 |
| 失敗後自動複製 resume 指令 | 仍自動複製,Toast 加原因說明 | ✅ 保留 |
| `error: string` 欄位 | 保留(原樣回傳原始 Error message),新增 `reason` | ✅ 保留 |
| Toast 文案 | 加入原因區分四種失敗模式 | ⚠ 改變但無破壞 |

> 結論:無破壞性。`reason` 是擴充欄位,舊 renderer code 即使忽略也不會壞。

**新 Acceptance**
- [ ] cwd 為空 → Toast「找不到此對話的工作目錄,已改為複製 resume 指令:{cmd}」
- [ ] cwd 不存在於檔案系統 → Toast「工作目錄 {path} 不存在(可能已刪除或外接磁碟未掛載),已改為複製 resume 指令:{cmd}」
- [ ] `code` CLI 不在 PATH → Toast「找不到 `code` 指令(macOS 請在 VS Code 執行 `Shell Command: Install 'code' command in PATH`),已改為複製 resume 指令:{cmd}」
- [ ] URI 開啟失敗(workspace 開了但 deep link 失敗)→ Toast「VS Code 未能接到 deep link,請確認已安裝 Claude Code 擴充,已改為複製 resume 指令:{cmd}」
- [ ] 其他未知錯誤 → Toast「VS Code 開啟失敗:{error},已改為複製 resume 指令:{cmd}」
- [ ] `npm run build` 全綠
- [ ] `code-reviewer` 通過
- [ ] 動到 payload 結構 → `ipc-boundary-reviewer` 通過(`OpenInVscodeResult` 三層同步)

**Non-goals**
- 不偵測「Claude Code 擴充是否已安裝」(無 API 可問)
- 不重構 resume.ts 整體結構
- 不改 settings UI
- 不改 fallback 機制(仍自動複製)
- 不加「不再 fallback」設定

**References**
- 規格出處:[docs/optimization-plan.md](../../docs/optimization-plan.md) #1
