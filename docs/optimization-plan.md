# 流程與畫面優化規格

**版本**:2026-06-02 初稿
**作者**:整理自前一輪對 main 分支(commit `12e9cbd` 為頂)的程式掃描
**目的**:把「使用者察覺得到但還沒成案」的優化點轉成可以直接動工的 brief。流程優先、畫面其次。

> **行號註記**:文件內 `[檔名](path#Lxx)` 連結的行號為 commit `12e9cbd` 當下狀態。若該檔案後續被改動,行號需重抓 — 抓不到時請以「函式名 / 區塊內容」為準。

每項 brief 採用 [agents/templates/task.md](../agents/templates/task.md) 或 [agents/templates/change-request.md](../agents/templates/change-request.md) 的欄位結構(Context / Goal / Scope / Acceptance / Non-goals)。動工前要從這份文件抽出對應項目,複製到 [agents/planning/tasks.md](../agents/planning/tasks.md),依 dev-workflow 走完 brief 釐清流程。

---

## 優先順序總覽

**第一輪(流程,影響日常使用)** — 預估 1.5 hr

| 編號 | 標題 | Track | 預估 |
|---|---|---|---|
| #1 | VS Code 失敗訊息分類化 | 🔧 B | 30 min |
| #2 | Claude hook 健康檢查 + 一鍵安裝引導 | A | 45 min |
| #3 | 移除 1500ms 寫死延遲 | 🔧 B | 15 min |

**第二輪(流程,中長期價值)** — 預估 3 hr

| 編號 | 標題 | Track | 預估 |
|---|---|---|---|
| #4 | 全域搜尋(跨專案) | A | 1.5 hr |
| #5 | 快速 checkout / 在終端開分支 | A | 1 hr |
| #6 | Pin / Hide toggle 收成單一 IPC | 🔧 B | 30 min |
| #7 | 「重新整理」改增量,改用 settings 觸發全量 | 🔧 B | 45 min |

**第三輪(畫面)** — 預估 1.5 hr

| 編號 | 標題 | Track | 預估 |
|---|---|---|---|
| #8 | MessageView header primary action 重排 | 🔧 B | 10 min |
| #9 | SessionRow 編輯態改 popover | 🔧 B | 45 min |
| #10 | 「原始:」改 hover-only | 🔧 B | 15 min |
| #11 | 加「未對應分支」過濾 chip | A | 30 min |

---

# 第一輪 — 流程

## #1 🔧 失敗訊息分類化(VS Code 開啟失敗時告知具體原因)

**Context** — 目前 `onOpenInVscode` 失敗時,只回「VS Code 開啟失敗,已改為複製 resume 指令」。使用者看不到失敗原因(spawn / URI / cwd 不存在),無從修。失敗模式至少有四種,得分類給出對應提示。

**既有行為**
- 目前:[src/main/resume.ts:35-58](../src/main/resume.ts#L35-L58) `openInVscode` 回 `{ ok: boolean; error?: string }`,error 是原始 Error message
- 目前:[src/renderer/App.tsx:330-338](../src/renderer/App.tsx#L330-L338) 失敗就一律 fallback 複製指令,Toast 文字寫死
- 目前:四種失敗(cwd 不存在 / cwd 已刪 / `code` CLI 不在 PATH / URI handler 沒接到)都看起來一樣

**變更內容**
- `OpenInVscodeResult` 加 `reason` 欄位,enum:`'no-cwd' | 'cwd-missing' | 'editor-cli-missing' | 'uri-failed' | 'unknown'`
- main 端 `openInVscode` 依錯誤 code 填 reason(`ENOENT` 區分是 cwd 還是 CLI;`cwd` 用 `fs.existsSync` 預檢)
- renderer 端 `onOpenInVscode` 依 reason 給對應 Toast 文案 + 行動提示
- `code` CLI 不在 PATH 時,Toast 提示「請在 VS Code 中執行 `Shell Command: Install 'code' command in PATH`」(macOS 必要步驟)

**影響範圍**
- shared:`src/shared/types.ts` 的 `OpenInVscodeResult` 加欄位
- main:`src/main/resume.ts` `openInVscode` 與 `openWorkspaceFolder`
- renderer:`src/renderer/App.tsx` `onOpenInVscode` 對應 reason 分支
- IPC:無新通道(payload 擴充,向後相容)

**Backward compat 評估**
| 既有行為 | 變更後 | 性質 |
|---|---|---|
| 成功路徑回 `{ ok: true }` | 不變 | ✅ 保留 |
| 失敗後 fallback 複製指令 | 移除自動 fallback,改成 Toast 內含「複製指令」按鈕讓使用者主動點 | ⚠ 改變但無破壞 |
| `error: string` | 保留(原樣回傳),新增 reason | ✅ 保留 |

**新 Acceptance**
- [ ] cwd 為空 → Toast「找不到此對話的工作目錄」
- [ ] cwd 不存在於檔案系統 → Toast「工作目錄 {path} 不存在(可能已刪除或外接磁碟未掛載)」
- [ ] `code` CLI 不在 PATH → Toast「找不到 `code` 指令,請在 VS Code 執行 'Shell Command: Install code command in PATH'」+ 「改用複製指令」按鈕
- [ ] URI 開啟失敗(IDE 未裝 Claude 擴充) → Toast「VS Code 未能接到 deep link,請確認已安裝 Claude Code 擴充」
- [ ] `npm run build` 全綠
- [ ] `ipc-boundary-reviewer` 通過

**Non-goals**
- 不偵測「Claude Code 擴充是否已安裝」(無 API 可問)
- 不重構 resume.ts 整體
- 不改 settings UI

---

## #2 Claude hook 健康檢查 + 一鍵安裝引導

**Context** — 本 app 的分支匹配信心度直接取決於 `~/.claude/hooks/branch-hook.{ps1,sh}` 是否安裝、`~/.claude/settings.json` 的 PostToolUse 是否註冊。沒裝 hook 時只能用「session 時間窗 + 分支首次 commit」做後備匹配,精準度落差大。但目前 app **完全不告知使用者 hook 狀態**,使用者不知道自己缺了什麼,也找不到 `scripts/install-hook.{ps1,sh}` 安裝腳本。這是「branch-map」這個名字最核心的工作流缺口。

**Goal**
- App 啟動時偵測 hook 安裝狀態,在頂部 banner 或設定面板顯示健康度
- 未安裝 / 部分安裝 / 完整安裝 三種狀態各有對應提示與動作
- 提供「一鍵執行 install-hook 腳本」按鈕(內部呼叫既有 `scripts/install-hook.{ps1,sh}`)
- 完整安裝後,SessionRow 的分支匹配信心度可顯著提升(原本只能靠時間窗的會升級為 high-confidence)

**Scope**
- shared:`src/shared/hook.ts` 加 `getHookHealth()` 回 `{ scriptInstalled, settingsRegistered, jsonlExists, jsonlRecordCount }`
- main:`src/main/ipc.ts` 加 `hook:health` 與 `hook:install` 兩個 IPC handler
- main:`hook:install` 在主程序 spawn 對應平台的 install 腳本(Windows: `powershell -ExecutionPolicy Bypass -File scripts/install-hook.ps1`,macOS/Linux: `bash scripts/install-hook.sh`),回 `{ ok, stderr? }`
- preload:暴露 `hookHealth()` 與 `installHook()`
- renderer:`src/renderer/api.ts` 對應型別
- renderer:`src/renderer/App.tsx` 啟動後呼叫 `hookHealth()`,將狀態傳給 banner / 設定面板
- renderer:`src/renderer/components/SettingsPanel.tsx` 新增「Claude hook 整合」區塊,顯示三個指標 + 安裝按鈕
- renderer:若 `scriptInstalled = false` 且 `jsonlRecordCount = 0`,在頂部顯示 dismissable banner「分支匹配精準度受限,點我啟用 Claude hook」

**Acceptance**
- [ ] 從未安裝過 hook 的環境啟動 app,看到 banner 提示與「啟用」按鈕
- [ ] 點「啟用」→ 跑 install 腳本 → 成功訊息 + banner 消失 + `~/.claude/hooks/branch-hook.*` 與 `~/.claude/settings.json` PostToolUse 都正確寫入
- [ ] 安裝失敗(權限不足、PowerShell 執行原則被擋)→ Toast 顯示具體錯誤,並提示手動指令 fallback
- [ ] 設定面板「Claude hook 整合」區塊顯示三狀態真實值,可手動點「重新檢查」
- [ ] 安裝後新建的 session 在 SessionRow 顯示 high-confidence 分支標籤(對照 [src/shared/matcher.ts](../src/shared/matcher.ts) 的 `matchByHook` 路徑)
- [ ] banner 可手動關閉(寫進 `AppSettings.hookBannerDismissed: boolean`),關閉後不再彈
- [ ] `npm run build` 全綠
- [ ] `ipc-boundary-reviewer` 通過(新增 2 個 IPC 通道)

**Non-goals**
- 不做 hook 移除按鈕(已有 `scripts/uninstall-hook.{ps1,sh}` 命令列腳本,使用者刪除是稀有動作)
- 不偵測 hook 腳本本身的內容版本(只看「檔案存在 + settings.json 有註冊」)
- 不在 macOS 上處理 Gatekeeper 警告(install-hook.sh 本來就是純 bash,無簽章問題)
- 不做 hook log 即時查看(如要看 `branch-hook.jsonl` 內容,使用者用編輯器開即可)

**References**
- 既有實作:[src/shared/hook.ts](../src/shared/hook.ts) `readHookRecords()`、`groupBySession()`
- 安裝腳本:[scripts/install-hook.ps1](../scripts/install-hook.ps1)、[scripts/install-hook.sh](../scripts/install-hook.sh)
- 移除腳本:[scripts/uninstall-hook.ps1](../scripts/uninstall-hook.ps1)、[scripts/uninstall-hook.sh](../scripts/uninstall-hook.sh)
- 匹配邏輯:[src/shared/matcher.ts](../src/shared/matcher.ts) — 解釋為什麼 hook 影響精準度

---

## #3 🔧 移除 1500ms 寫死延遲(改並發)

**Context** — [src/shared/types.ts:127](../src/shared/types.ts#L127) `vscodeOpenDelayMs: 1500` 是經驗值。對「VS Code 已開」的情況純粹是白等 1.5 秒。改成 URI + spawn 並發,URI handler 若接不到,spawn 補上 workspace 之後 IDE 本身會再撈一次。

**既有行為**
- 目前:`openInVscode` 先 spawn workspace,sleep `vscodeOpenDelayMs`,再丟 URI
- 目前:settings 暴露 `vscodeOpenDelayMs`(預設 1500)與 `openWorkspaceBeforeResume`(預設 true)

**變更內容**
- 移除「先 spawn → 等 → 再 URI」的串列流程
- 改成:先 `shell.openExternal(uri)`,**同時**(不 await)spawn workspace
- 移除 settings 中 `vscodeOpenDelayMs` 設定鍵與對應 UI(進階設定也不留)
- `openWorkspaceBeforeResume` 保留(使用者可選關掉 spawn,只丟 URI)

**影響範圍**
- shared:`AppSettings` 移除 `vscodeOpenDelayMs`、`DEFAULT_SETTINGS` 同步
- main:`src/main/settings.ts` getSettings 對舊 settings 的容錯(讀到舊鍵忽略即可)
- main:`src/main/resume.ts` 改流程
- renderer:`src/renderer/components/SettingsPanel.tsx` 移除延遲 ms 輸入

**Backward compat 評估**
| 既有行為 | 變更後 | 性質 |
|---|---|---|
| 既有設定檔有 `vscodeOpenDelayMs` | 讀進來忽略,下次寫入時消失 | ⚠ 改變但無破壞 |
| 體感速度 | 快 1.5 秒 | ⚠ 改變但無破壞 |
| 「先開 workspace 再 resume」順序 | 改成並發 | ⚠ 改變但無破壞(URI handler 接到時就會載入正確 workspace 內的 session) |
| 預設行為 | 仍開 workspace | ✅ 保留 |

> 結論:無破壞性。若有人依賴「workspace 先開好」的順序,行為一致(URI 由 IDE 排隊處理)。

**新 Acceptance**
- [ ] VS Code 已開 → 點按鈕後 < 500ms 內看到 session resume
- [ ] VS Code 未開 → 自動啟動 + 載入 workspace + resume(順序由 IDE 決定)
- [ ] 設定面板看不到「延遲 ms」欄位
- [ ] 舊設定檔(含 `vscodeOpenDelayMs`)能正常啟動
- [ ] `npm run build` 全綠

**Non-goals**
- 不為 IDE 是否載入完成做輪詢
- 不改 `openWorkspaceBeforeResume` 預設值

---

# 第二輪 — 流程(中長期價值)

## #4 全域搜尋(跨所有未隱藏專案)

**Context** — [src/renderer/components/SessionList.tsx:42-97](../src/renderer/components/SessionList.tsx#L42-L97) 的搜尋是 component-local state,只搜當前選中專案內的 session。使用者「幾週後回頭找」往往不記得在哪個專案,得逐專案點開搜。

**Goal**
- 頂部新增全域搜尋列(與「重新整理 / 設定」並排)
- 輸入字串即時跨所有未隱藏專案搜 session(title / customTitle / cwd / sessionId / tag)
- 搜尋結果格式:project displayName + session title,點擊跳到對應 project + 選中對應 session

**Scope**
- shared:`src/shared/sessions.ts` 加 `listAllSessions(opts)`,回傳跨專案的 SessionSummary[](附 encodedDirName)
- main:`src/main/ipc.ts` 加 `sessions:searchAll` IPC
- preload:`src/preload/index.ts` 暴露
- renderer:`src/renderer/api.ts` 加型別
- renderer:`src/renderer/App.tsx` 頂部加 GlobalSearch component,搜到結果點擊呼叫既有 `onSelectProject` + 設定 `selectedSessionId`

**Acceptance**
- [ ] 頂部搜尋列輸入即時顯示跨專案結果(debounce 200ms)
- [ ] 結果項目顯示「專案名 / session 標題 / cwd 簡寫 / 最後修改時間」
- [ ] 點結果 → 左側自動切到對應專案、右側中段選中對應 session
- [ ] `#tag` 前綴只搜標籤(沿用 SessionList 的語法)
- [ ] 隱藏的專案 / session 不出現在結果
- [ ] 1000+ session 時搜尋 < 500ms
- [ ] `npm run build` 全綠
- [ ] `ipc-boundary-reviewer` 通過

**Non-goals**
- 不搜對話內容(只搜 metadata)
- 不做進階查詢語法(`AND / OR` 等)
- 不保留搜尋歷史

**References**
- 既有 per-project 搜尋:`src/renderer/components/SessionList.tsx`

---

## #5 快速 checkout / 在終端開分支對應 repo

**Context** — App 名為 branch-map,但目前點到 session 後只能複製 resume 指令或在 VS Code 開對話,**對分支本身不做任何事**。使用者真正的需求是「找回當時的工作目錄狀態」 — 需要一鍵「在終端開該 repo 並切到對應分支」。

**Goal**
- 在 BranchBadge / SessionRow 的 branch 區塊加「終端開啟」按鈕
- 點擊 → 開系統終端(Windows PowerShell / macOS Terminal / Linux 預設),cd 到 repoPath,執行 `git checkout <branch>`

**Scope**
- main:`src/main/terminal.ts`(新檔)封裝跨平台「開終端執行指令」
- main:`src/main/ipc.ts` 加 `terminal:openInRepo` IPC(payload:`{ repoPath, branch }`)
- preload + renderer api 對應暴露
- renderer:`src/renderer/components/BranchBadge.tsx` 加按鈕(只在 mapped 到 repoPath 時顯示)
- 安全:`repoPath` 與 `branch` 不直接拼進 shell 字串,用 argv 傳給終端 emulator
- Windows:`start cmd /K "cd /d {path} && git checkout {branch}"`
- macOS:`osascript -e 'tell app "Terminal" to do script ...'`
- Linux:嘗試 `x-terminal-emulator` / `gnome-terminal` / `konsole`,找不到回 Toast 提示

**Acceptance**
- [ ] Windows / macOS 主流環境能開啟終端並切到對應分支
- [ ] Linux 未偵測到終端 → Toast「無法偵測終端,請複製指令:`cd <path> && git checkout <branch>`」並自動複製
- [ ] repoPath 或 branch 含空白 / 特殊字元不被注入(argv 傳遞)
- [ ] 切錯分支不會破壞使用者未提交變更(`git checkout` 預設會擋,我們不加 `-f`)
- [ ] `npm run build` 全綠
- [ ] `ipc-boundary-reviewer` 通過
- [ ] `code-reviewer` 通過(命令注入是 security review 重點)

**Non-goals**
- 不做 stash / pop(留給使用者自己處理 dirty tree)
- 不做「在 VS Code 內開終端」(獨立按鈕)
- 不偵測「分支是否存在於 remote」

---

## #6 🔧 Pin / Hide toggle 收成單一 IPC

**Context** — [src/renderer/App.tsx:213-281](../src/renderer/App.tsx#L213-L281) 四種 toggle(專案釘選/隱藏、對話釘選/隱藏)各自呼叫 `api.setSettings`,每次「讀 settings → 改陣列 → 寫回」。快速連點會發生 race:舊請求的 setSettings 可能覆蓋新請求。同時 renderer 端有四份近乎重複的 add/remove 邏輯。

**既有行為**
- 目前:`onTogglePinProject` / `onHideProject` / `onTogglePinSession` / `onHideSession` 各自先讀 `settings.pinnedProjects` / `hiddenProjects` 等,改陣列,呼叫 `api.setSettings(patch)`
- 目前:四份邏輯各自管 race 不嚴謹

**變更內容**
- main 端加四個 IPC:`projects:togglePin`、`projects:setHidden`、`sessions:togglePin`、`sessions:setHidden`,payload `{ id, value? }`
- main 端在 handler 內以「讀寫設定鎖」確保原子性
- renderer 端 onTogglePin* / onHide* 改呼叫對應 IPC,不再自己改 settings 陣列

**影響範圍**
- main:`src/main/ipc.ts` 加 4 個 handler
- main:`src/main/settings.ts` 加 `togglePinned(key, id)` / `setHidden(key, id, value)` helper
- preload + renderer api:對應暴露
- renderer:`src/renderer/App.tsx` 四個 callback 改實作
- shared 型別:無變動

**Backward compat 評估**
| 既有行為 | 變更後 | 性質 |
|---|---|---|
| `settings:set` IPC 仍能改 hiddenProjects / pinnedProjects | 仍可用(同時並存) | ✅ 保留 |
| `settings:set` 後的 onChange 副作用(skipReload 判斷) | 仍有效 | ✅ 保留 |
| 快速連點同一按鈕的結果 | 不再 race | ⚠ 改變但無破壞 |

**新 Acceptance**
- [ ] 0.5 秒內連點同一個釘選按鈕 5 次,最終狀態與點 5 次的奇偶性吻合
- [ ] 同時釘選多個專案不會丟失任何一筆
- [ ] 既有 settings.json 結構不變
- [ ] `npm run build` 全綠
- [ ] `ipc-boundary-reviewer` 通過

**Non-goals**
- 不重構 SettingsPanel 內的 hidden 列表復原邏輯(沿用)
- 不做樂觀 UI(回應之前不改 UI)

---

## #7 🔧 「重新整理」改增量

**Context** — [src/renderer/App.tsx:355](../src/renderer/App.tsx#L355) 重新整理按鈕呼叫 `loadProjects({ refresh: true })`,會重掃整個 `~/.claude/projects/`。檔案多時(歷史 100+ 專案、上千 session)會卡頓。日常使用者按重新整理多半只想看「當前選中專案有沒有新對話」。

**既有行為**
- 目前:按「重新整理」→ 重掃所有專案的 metadata + sessions
- 目前:`loadProjects(refresh: true)` 會清 cache 重來

**變更內容**
- 「重新整理」改成只重掃當前選中專案的 sessions(走既有 `sessionsForProject`)
- 加新動作「重新掃描全部專案」放在設定面板,明確需要時才執行
- 切換不同專案時自動觸發單專案重掃(沿用既有行為)

**影響範圍**
- renderer:`src/renderer/App.tsx` 改 `onClick` 行為,加 `onRefreshAll` callback
- renderer:`src/renderer/components/SettingsPanel.tsx` 加「重新掃描全部專案」按鈕
- main:`src/main/ipc.ts` 已有 `sessions:forProject`,無需新增

**Backward compat 評估**
| 既有行為 | 變更後 | 性質 |
|---|---|---|
| 「重新整理」會發現新專案 | 移到設定的「重新掃描全部」 | ⛔ 破壞性(使用者習慣) |
| 看到新對話 | 仍可(單專案重掃) | ✅ 保留 |
| `loadProjects({ refresh: true })` 對 cache 的清空 | 仍存在(僅入口改變) | ✅ 保留 |

> 結論:含破壞性變更(使用者習慣)。遷移指引:在 Toast 或 tooltip 明示「想找新專案?到設定點重新掃描全部」。

**新 Acceptance**
- [ ] 按「重新整理」只觸發單專案重掃,< 200ms
- [ ] 設定內「重新掃描全部」可發現新建立的專案
- [ ] 按鈕 tooltip 標示行為差異
- [ ] `npm run build` 全綠

**Non-goals**
- 不做檔案系統 watcher 自動偵測新對話(留 Phase 2)
- 不做「上次掃描時間」顯示

---

# 第三輪 — 畫面

## #8 🔧 MessageView header primary action 重排

**Context** — [src/renderer/components/MessageView.tsx:118-139](../src/renderer/components/MessageView.tsx#L118-L139) 目前 primary style 給「複製 resume 指令」,但對 VS Code / Cursor 使用者來說 primary action 應該是「在 IDE 繼續對話」。複製只是 fallback。

**既有行為**
- 目前:三按鈕從左到右 — 子代理切換(ghost)/ 在 VS Code 繼續(ghost)/ 複製 resume(primary)
- 目前:primary 視覺對主流程的引導反了

**變更內容**
- 「在 VS Code 繼續對話」改 primary style
- 「複製 resume 指令」改 ghost style
- 順序維持(左→右:子代理 / 繼續對話 / 複製)

**影響範圍**
- renderer:`src/renderer/components/MessageView.tsx` 兩個 button className 互換

**Backward compat 評估**
| 既有行為 | 變更後 | 性質 |
|---|---|---|
| 兩按鈕的功能 | 不變 | ✅ 保留 |
| 視覺權重 | 主次互換 | ⚠ 改變但無破壞 |
| 鍵盤可達性 | 不變 | ✅ 保留 |

**新 Acceptance**
- [ ] 「在 VS Code 繼續對話」是視覺最強的按鈕(primary)
- [ ] 「複製 resume 指令」仍能點(ghost)
- [ ] `npm run build` 全綠

**Non-goals**
- 不重新排版整個 header
- 不改顏色 token

---

## #9 🔧 SessionRow 編輯態改 popover

**Context** — [src/renderer/components/SessionRow.tsx:185-222](../src/renderer/components/SessionRow.tsx#L185-L222) 編輯態的 input 直接內嵌在卡片裡,沒有強的視覺隔離,快速瀏覽時容易誤觸 ✎ 進入編輯造成 list 跳動。

**既有行為**
- 目前:點 ✎ 後 row 內展開兩個 input(自訂標題 + 標籤)+ 取消 / 儲存按鈕
- 目前:展開使其他 row 位置往下擠

**變更內容**
- 點 ✎ 後改用 popover 覆蓋在 row 上方(absolute / portal),不影響其他 row 高度
- Esc 關閉、Enter 儲存(沿用既有 key handler)
- 點 popover 外關閉(取消變更)

**影響範圍**
- renderer:`src/renderer/components/SessionRow.tsx` 重構 editing 區塊
- renderer:`src/renderer/styles.css` 加 popover 樣式
- 可能需要小型 hook `useClickOutside`(放 `src/renderer/format.ts` 或新檔)

**Backward compat 評估**
| 既有行為 | 變更後 | 性質 |
|---|---|---|
| 點 ✎ 進入編輯 | 不變 | ✅ 保留 |
| 編輯期間其他 row 位置不變 | 改為不變(原本會跳) | ⚠ 改變但無破壞 |
| Esc / Enter 鍵盤行為 | 不變 | ✅ 保留 |
| 點別處 | 改為自動取消(原本要點取消) | ⚠ 改變但無破壞 |

**新 Acceptance**
- [ ] 點 ✎ 後 popover 出現,其他 row 位置不動
- [ ] popover 外點擊自動取消,內變更未存
- [ ] Esc / Enter 行為不變
- [ ] 視覺上 popover 與 row 邊界清晰可辨
- [ ] `npm run build` 全綠

**Non-goals**
- 不改編輯欄位本身的內容(標題 / 標籤兩欄)
- 不加標籤自動完成
- 不做動畫進場

---

## #10 🔧 「原始:」改 hover-only

**Context** — [src/renderer/components/SessionRow.tsx:171-175](../src/renderer/components/SessionRow.tsx#L171-L175) 每筆有自訂標題的 session 都會多一行「原始:...」。列表密集時造成視覺噪音,但偶爾需要看原始標題以回想。

**既有行為**
- 目前:有自訂標題 → 永遠多顯示一行「原始:xxx」

**變更內容**
- 預設不顯示「原始:」
- hover 自訂標題的 ✎ mark(或整個 session-title)→ 在 tooltip 或下方薄帶顯示原始
- 編輯態下仍顯示(編輯時要對照)

**影響範圍**
- renderer:`src/renderer/components/SessionRow.tsx` 改顯示條件
- renderer:`src/renderer/styles.css` `.session-original-title` 改 hover 顯示

**Backward compat 評估**
| 既有行為 | 變更後 | 性質 |
|---|---|---|
| 有自訂標題的 row 高度 | 變矮(少一行) | ⚠ 改變但無破壞 |
| 看到原始標題的方法 | 改為 hover ✎ mark | ⚠ 改變但無破壞 |
| 編輯態下顯示原始 | 不變 | ✅ 保留 |

**新 Acceptance**
- [ ] 列表瀏覽時不顯示「原始:」
- [ ] hover ✎ mark → 看到原始(tooltip 或薄帶)
- [ ] 編輯態下仍顯示
- [ ] `npm run build` 全綠

**Non-goals**
- 不重排 session-meta
- 不改 ✎ icon

---

## #11 加「未對應分支」過濾 chip

**Context** — session 可能因為 hook 沒裝、超時、repo 路徑不對而落到「找不到對應分支」。使用者無法快速找到這批 session 來補救(裝 hook / 設 repoPathOverride)。

**Goal**
- SessionList 搜尋列旁加兩顆 chip-style filter:
  - `僅顯示已對應分支`
  - `僅顯示找不到分支`
- 點 chip 變 active,再點關閉

**Scope**
- renderer:`src/renderer/components/SessionList.tsx` 加 filter state + UI
- renderer:過濾邏輯讀 `branchState`(已 loaded 的 result.branches 長度)
- 因 branchState 是 async,filter 對 status='loading' 的 row 暫不過濾(避免閃爍)
- renderer:`src/renderer/styles.css` chip 樣式

**Acceptance**
- [ ] 兩顆 chip 顯示在搜尋列下方
- [ ] 「僅顯示已對應分支」開啟 → 只顯示 `branches.length > 0`
- [ ] 「僅顯示找不到分支」開啟 → 只顯示 `branches.length === 0` 且非 loading
- [ ] 兩顆同時開 = 互斥(後點的覆蓋前者)
- [ ] 搜尋字串與 filter 同時生效(AND)
- [ ] 切換專案後 filter 不重置(per-list,不持久化到 settings)
- [ ] `npm run build` 全綠

**Non-goals**
- 不持久化 filter 狀態到 settings
- 不加更多 filter chip(state / loaded 等)
- 不在全域搜尋(#4)套用相同 filter
