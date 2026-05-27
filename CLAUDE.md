# CLAUDE.md

本檔案給 Claude Code(claude.ai/code)用,進入此 repo 時請先讀完。所有對話以繁體中文回覆,技術名詞首次出現用「中文(English)」格式。

## 1. 專案總覽與架構

`claude-branch-map` 是 Electron 桌面工具,掃描本機 `~/.claude/projects/` 下的 JSONL 對話檔,將每個對話對應到 Git 分支。目標工作流是「一張票 = 一個 Claude 對話 = 一個 Git 分支」,幾週後仍能回頭找到對應。

### Electron 三程序模型

- **主程序(main process)** — Node.js 環境,有檔案系統與 Git 存取
  - [src/main/index.ts](src/main/index.ts):視窗建立、應用程式生命週期
  - [src/main/ipc.ts](src/main/ipc.ts):全部 `ipcMain.handle` 註冊在 `registerIpcHandlers()`,內含多層 cache(projects / sessions / branches / messages / repo)
  - [src/main/settings.ts](src/main/settings.ts):`electron-store` 包裝
  - [src/main/resume.ts](src/main/resume.ts):剪貼簿寫入 `claude --resume <id>` 指令

- **預載腳本(preload script)** — 受限 Node 環境,經 `contextBridge` 暴露給 renderer
  - [src/preload/index.ts](src/preload/index.ts):定義 `api` 物件並 `exposeInMainWorld('api', api)`,匯出 `Api` 型別

- **渲染程序(renderer process)** — 瀏覽器環境,React + Vite
  - [src/renderer/App.tsx](src/renderer/App.tsx):頂層狀態(projects / sessions / branchState / settings / toast)、所有商業邏輯 callback
  - [src/renderer/api.ts](src/renderer/api.ts):宣告 `RendererApi`、把 `window.api` 強型別化
  - `src/renderer/components/`:UI 元件
  - [src/renderer/main.tsx](src/renderer/main.tsx):ReactDOM mount 點

### 共用模組(`src/shared/`)

main 與 renderer 雙向 import,Vite 已設好 `@shared` alias:

- `types.ts` — 所有 IPC payload 型別、`AppSettings`、`SessionSummary`、`ProjectInfo`、`MappedBranch` 等
- `paths.ts` — `~/.claude/projects/` 的位置與資料夾編碼規則
- `projects.ts` — 掃描 projects 目錄、解出 `displayName` / `actualPath` / `encodedDirName`
- `sessions.ts` — 掃描 project 下的 `*.jsonl` session 檔,取 metadata(title / cwd / model / token / cost / firstTs / lastTs)
- `messages.ts` — 解析 JSONL 內每一筆 message event,輸出 `MessageEvent[]`
- `git.ts` — `simple-git` 包裝(`isGitRepo`、`listBranches`)
- `hook.ts` — 讀取 `~/.claude/branch-hook.jsonl` 並依 `sessionId` 群組
- `matcher.ts` — 分支匹配演算法(下面詳述)

### 資料流(典型互動)

```
使用者點 session
  → SessionRow onClick
  → App.tsx setSelectedSessionId
  → MessageView useEffect 偵測 session 變動
  → api.messagesForSession(id)
  → window.api.messagesForSession  ← preload bridge
  → ipcRenderer.invoke('messages:forSession', id)
  → ipcMain.handle('messages:forSession') in src/main/ipc.ts
  → readSessionMessages(filePath) in src/shared/messages.ts
  → 回傳 MessageEvent[]
  → MessageView 渲染
```

---

## 2. 開發指令與設定

### npm scripts

| 指令 | 說明 |
|---|---|
| `npm run dev` | `electron-vite dev`,啟動 Electron 視窗 + HMR |
| `npm run build` | TypeScript 型別檢查 + 打包 main/preload/renderer 至 `out/` |
| `npm run preview` / `npm run start` | 預覽打包結果 |
| `npm run package:win` | 先 build,再用 `electron-builder` 產生 Windows NSIS 安裝檔 |
| `npm run package:dir` | 產出未打包的 dir 版本(供 smoke test) |

### 新增 IPC 通道(三步驟必須同步)

任何新通道都要在三個檔案出現,缺一不可:

1. **[src/preload/index.ts](src/preload/index.ts)** — 在 `api` 物件加方法,型別由 TypeScript 推導
2. **[src/main/ipc.ts](src/main/ipc.ts)** — 在 `registerIpcHandlers()` 內加 `ipcMain.handle('domain:verb', async (_e, ...args) => ...)`
3. **[src/renderer/api.ts](src/renderer/api.ts)** — 擴充 `RendererApi` interface 補上對應方法簽章

通道命名規則:`domain:verb`,例:`projects:list`、`sessions:forProject`、`branches:forSession`、`messages:forSession`、`settings:get`、`settings:set`、`resume:copy`、`repo:pick`、`shell:openExternal`、`sessions:hidden`。

新增後請呼叫 `ipc-boundary-reviewer` 子代理檢查三層同步。

### electron-store 鍵(`AppSettings`)

定義於 [src/shared/types.ts](src/shared/types.ts),由 [src/main/settings.ts](src/main/settings.ts) 寫入磁碟:

| 鍵 | 型別 | 用途 |
|---|---|---|
| `repoPathOverride` | `string \| null` | 全域覆寫 repo 路徑,優先於 `session.cwd` |
| `branchIconMode` | `'created' \| 'created-with-commits'` | 分支匹配模式 A/B |
| `excludeCwdPatterns` | `string[]` | cwd 子字串黑名單,符合任一即隱藏專案 |
| `hiddenProjects` | `string[]` | 隱藏的 `encodedDirName` 清單 |
| `pinnedProjects` | `string[]` | 釘選順序(最舊在前,IPC 層 reverse 後顯示為「最新釘選在頂端」) |
| `pinnedSessions` | `string[]` | 同上,針對 session |
| `hiddenSessions` | `string[]` | 隱藏的 `sessionId` 清單 |

更動 settings 後 main 程序會 `resetBranchCaches()`,因為 mode A/B 與 repo override 直接影響分支結果。

### Windows 打包

- 設定見 [electron-builder.yml](electron-builder.yml),只產 Windows x64 NSIS
- 安裝檔未做 code signing,使用者會看到 SmartScreen 警告(README 有說明)
- hook scripts 放 `scripts/branch-hook.{ps1,sh}`,安裝器位於 `scripts/install-hook.{ps1,sh}`

---

## 3. 領域知識

### `~/.claude/projects/` 目錄結構

```
~/.claude/projects/
├── -Users-foo-repo-a/          ← encodedDirName(cwd 的 / 換成 -)
│   ├── 7a3c....jsonl           ← session 檔,檔名 = sessionId
│   └── b21f....jsonl
└── -Users-foo-repo-b/
    └── ...
```

`encodedDirName` 與 `actualPath` 的對應由 [src/shared/paths.ts](src/shared/paths.ts) 與 [src/shared/projects.ts](src/shared/projects.ts) 處理。Windows 路徑會在比對時 normalize 成 `/`。

### JSONL session 格式

每行一個 JSON 物件,常見欄位:

```json
{
  "type": "user" | "assistant" | "summary",
  "uuid": "...",
  "timestamp": "2026-05-27T08:00:00.000Z",
  "cwd": "C:\\Users\\foo\\repo",
  "isSidechain": false,
  "message": {
    "role": "user" | "assistant",
    "model": "claude-opus-4-7",
    "content": "字串 或 block 陣列",
    "usage": { "input_tokens": 123, "output_tokens": 456 }
  },
  "costUSD": 0.0123
}
```

`content` 可能是字串(舊格式)或 block 陣列(text / thinking / tool_use / tool_result),由 [src/shared/messages.ts](src/shared/messages.ts) 統一成 `MessageEvent.blocks`。

### 分支匹配演算法

定義於 [src/shared/matcher.ts](src/shared/matcher.ts),兩層:

1. **高信心 — `matchByHook(sessionId, branches)`**:從 `~/.claude/branch-hook.jsonl`(由 PostToolUse hook 寫入)取得 session 期間實際 checkout 過的分支名單,直接對應
2. **後備 — `matchByTimestamp(session, branches, mode)`**:若無 hook 記錄,改用時間窗 — 分支的首次 commit 必須落在 `[session.firstTs, session.lastTs]` 內
   - `mode = 'created'`:符合時間窗即可
   - `mode = 'created-with-commits'`:還要至少有一次 commit
   - 1 小時內視為 high confidence,超過為 low

### PostToolUse Hook 整合

- 安裝:`scripts/install-hook.{ps1,sh}` 會把 `scripts/branch-hook.{ps1,sh}` 複製到 `~/.claude/hooks/`,並 merge 一筆 PostToolUse 進 `~/.claude/settings.json`
- 寫入:每次 tool call 後,hook 把 `{sessionId, branch, timestamp}` append 進 `~/.claude/branch-hook.jsonl`
- 讀取:[src/shared/hook.ts](src/shared/hook.ts) 的 `readHookRecords()` 一次讀完,`groupBySession()` 轉成 `Map<sessionId, branchNames[]>`
- main 程序在 `loadProjects()` 一次性載入 hook map,放進 `cache.hookMap`

---

## 4. 編碼規範

### TypeScript

- `tsconfig.json` 已設 strict;不寫 `any`,IPC payload 必須有型別,共用型別放 [src/shared/types.ts](src/shared/types.ts)
- `@shared/*` 是 Vite alias,renderer 與 main 皆可 import
- renderer-only 型別(例:`RowState`、`LoadState`)留在元件檔內,不污染 shared

### React

- 元件檔名 `PascalCase.tsx`,放 [src/renderer/components/](src/renderer/components/)
- hook 命名 `useXxx`(lowercase camelCase),純函式工具放 [src/renderer/format.ts](src/renderer/format.ts)
- 跨非同步邊界用 ref token 防止舊請求覆蓋(見 `App.tsx` 的 `fetchToken` / `sessionsToken`、`MessageView` 的 `fetchToken`)— 改動時保留此 pattern
- 不在 render 中 `setState`;`useEffect` 依賴正確列出(已存在的 `eslint-disable-next-line react-hooks/exhaustive-deps` 都有寫明理由,新增時也請寫)

### Electron 邊界

- renderer 不可 import `node:*`、`electron`、`simple-git` 等
- main 不可碰 DOM
- 凡是要從 renderer 觸發的副作用,都走 IPC

### UI 文字

- 一律繁體中文。新增字串前先看 [src/renderer/components/](src/renderer/components/) 既有翻譯保持口吻一致
- 技術名詞首次出現用「中文(English)」,例:「儲存庫(repo)」、「子代理(sub-agent)」
- 標點:中文語境用全形冒號「:」與全形句號「。」;`{變數}` 前後仍用半形 `:` 較不影響閱讀

### Commit message

- 短、命令式、句首大寫,沿用 git log 既有風格(例:`Add session detail pane with message viewer`、`Fix cwd exclude filter on Windows by normalizing path separators`)

### Sub-agent

- commit 前先呼叫 `code-reviewer`
- 動 IPC 通道時呼叫 `ipc-boundary-reviewer`
- 新功能完成後呼叫 `spec-tester` 產手動驗證清單

定義位於 [.claude/agents/](.claude/agents/)
