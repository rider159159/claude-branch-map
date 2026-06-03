# 雙軌架構規格：Web App + Electron exe

> 狀態：草案 (draft) · 目標：讓同一套核心同時以「本地 Web App」與「Electron 桌面 exe」交付。

## 1. 目標

從單一 codebase 產出兩種交付物，共用全部業務邏輯：

| 交付物 | 啟動方式 | 主要對象 |
|--------|----------|----------|
| **Web App**（主力） | `npx claude-branch-map` → 起本地 server → 自動開瀏覽器 | 開發者（有 Node 環境） |
| **Electron exe**（選配） | 雙擊安裝 | 非技術同事 / 想要獨立桌面視窗的人 |

非目標：CLI 純文字介面（已排除，使用者要圖形介面）；雲端 / 多人版本；任何網路傳輸。

## 2. 現況架構（已經很適合雙軌）

```
src/
  shared/    # 純 Node 邏輯，零 Electron 依賴 —— 兩條路 100% 共用
    git.ts          listBranches / isGitRepo (simple-git)
    hook.ts         讀 ~/.claude/branch-hook.jsonl
    matcher.ts      matchByHook / matchByTimestamp
    paths.ts        getProjectsDir 等路徑
    projects.ts     scanProjects
    sessions.ts     scanSessionsInProject
    types.ts        所有型別 + DEFAULT_SETTINGS
  main/      # Electron 專屬 —— web 版要替換的部分
    index.ts        BrowserWindow 建立
    ipc.ts          8 個 IPC handler + 快取層（業務邏輯都在這）
    settings.ts     electron-store 持久化
    resume.ts       electron clipboard 寫入
  preload/
    index.ts        contextBridge 暴露 window.api（8 個方法的介面定義）
  renderer/  # React UI —— 兩條路 100% 共用
    api.ts          讀 window.api
    App.tsx, components/*, styles.css
```

**關鍵觀察：renderer 與後端之間只有一個接縫——`window.api` 的 8 個方法。** 換掉這層的傳輸方式，UI 與 shared 邏輯都不用動。

### 後端 API 介面（要在兩種環境各實作一次）

| 方法 | 輸入 | 輸出 | 平台敏感度 |
|------|------|------|-----------|
| `listProjects` | `{refresh?}` | `ProjectInfo[]` | 無（純 shared） |
| `sessionsForProject` | `encodedDirName` | `SessionSummary[]` | 無 |
| `branchesForSession` | `sessionId` | `SessionBranchResult` | 無 |
| `getSettings` | — | `AppSettings` | **持久化方式不同** |
| `setSettings` | `Partial<AppSettings>` | `AppSettings` | **持久化方式不同** |
| `copyResume` | `sessionId` | `string` (指令字串) | **剪貼簿能力不同** |
| `pickRepo` | — | `string \| null` | **原生資料夾選擇器** |
| `openExternal` | `url` | `void` | 開啟外部連結方式不同 |

前 3 個是純邏輯（直接呼叫 shared），後 5 個需要各平台適配。

## 3. 目標架構

引入「傳輸層適配器」模式。把 `ipc.ts` 內的業務邏輯（快取 + 8 個 handler 的內容）抽成一個與平台無關的 **service 模組**，由兩個 adapter 包裝：

```
src/
  shared/                         # 不變
  core/                           # 【新增】平台無關的服務層
    service.ts                    # 從 ipc.ts 抽出：快取 + 8 個操作的純函式
    settings-store.ts            # 抽象介面：read()/write()，由各平台注入實作
    ports.ts                     # 定義 clipboard / dialog / shell 的抽象介面
  main/                           # Electron adapter（保留）
    index.ts                     # BrowserWindow
    ipc.ts                       # 變薄：ipcMain.handle → 呼叫 core/service
    adapters/
      settings.electron.ts       # electron-store 實作 settings-store
      platform.electron.ts       # clipboard / dialog / shell 實作
  server/                         # 【新增】Web adapter
    index.ts                     # 起 HTTP server（建議 Fastify 或 Node 原生 http）
    routes.ts                    # 8 條 REST/RPC 路由 → 呼叫 core/service
    adapters/
      settings.file.ts           # 純 JSON 檔持久化
      platform.web.ts            # clipboard/dialog/shell 的 no-op / 字串回傳
  preload/
    index.ts                     # 不變（Electron 用）
  renderer/
    api.ts                       # 【改】依環境選 transport：window.api 或 HTTP fetch
    api.http.ts                  # 【新增】用 fetch 打 server 路由，實作同一個 RendererApi 介面
```

**核心原則**：`RendererApi`（api.ts 既有的 8 方法介面）是契約。Electron 用 IPC 實作它，Web 用 fetch 實作它，UI 完全不知道差別。

## 4. 各模組去留

| 模組 | Web App | Electron | 動作 |
|------|---------|----------|------|
| `src/shared/*` | ✅ 共用 | ✅ 共用 | 不動 |
| `src/renderer/*`（UI） | ✅ 共用 | ✅ 共用 | 僅 `api.ts` 改成可切換 transport |
| `ipc.ts` 的業務邏輯 | ✅ 抽到 core | ✅ 抽到 core | 重構：邏輯移到 `core/service.ts` |
| `settings.ts`(electron-store) | ❌ | ✅ | 改用注入式 store；web 用 JSON 檔 |
| `resume.ts`(clipboard) | 部分 | ✅ | web 版改由瀏覽器端 `navigator.clipboard` 寫入 |
| `main/index.ts` | ❌ | ✅ | 不動 |
| `preload/index.ts` | ❌ | ✅ | 不動 |

## 5. 平台能力差異與處理方式

| 能力 | Electron | Web 版做法 |
|------|----------|-----------|
| **設定持久化** | electron-store（自動找 app data 路徑） | 寫純 JSON 至 `~/.claude/branch-map-settings.json`（與既有 hook 檔同目錄，符合「本地」精神） |
| **複製 resume 指令** | main 端 `clipboard.writeText` | `copyResume` server 端僅回傳指令字串；**實際寫入由瀏覽器端 `navigator.clipboard.writeText` 完成**（HTTPS/localhost 允許） |
| **選擇 repo 資料夾** | 原生 `dialog.showOpenDialog` | 瀏覽器無法取得本機路徑。**降級為文字輸入框**（`repoPathOverride` 本來就是字串路徑）；進階可做 server 端目錄瀏覽 API（階段二） |
| **開啟外部連結** | `shell.openExternal` | 瀏覽器端 `window.open(url, '_blank')` |

## 6. 建置與發佈

### Web App
- 後端：`server/` 用 esbuild/tsup 打成單一 JS；不引入 Electron。
- 前端：`renderer/` 用既有 Vite build 成靜態檔，由 server 一起 serve。
- 散布：發佈到 npm，使用者 `npx claude-branch-map`；server 起在 `127.0.0.1:<port>`，啟動後自動開預設瀏覽器。
- **安全**：只綁 `127.0.0.1`，不對外監聽；維持零網路傳輸的承諾。

### Electron exe
- 維持現有 `electron-vite` + `electron-builder` + `.github/workflows/release.yml`（unsigned）。
- 唯一變動：`ipc.ts` 改呼叫 `core/service`，行為不變。

## 7. 分階段實作計畫

**階段 0 — 重構（不改行為）**
1. 把 `ipc.ts` 的快取與 8 個操作邏輯抽到 `core/service.ts`。
2. 定義 `SettingsStore` / `Platform` 抽象介面（`core/ports.ts`）。
3. Electron 端用既有實作注入，跑 `npm run dev` 確認行為完全一致。

**階段 1 — Web App 最小可用**
4. 新增 `server/`：Fastify 起 server，8 條路由轉呼叫 `core/service`，注入 file-based settings store + web platform adapter。
5. 新增 `renderer/api.http.ts`，`api.ts` 依 `window.api` 是否存在自動切換。
6. `copyResume` 改瀏覽器端寫剪貼簿；`pickRepo` 降級為文字輸入。
7. 加 npm script `dev:web` / `start:web`，serve 靜態前端 + 自動開瀏覽器。

**階段 2 — 打磨**
8. server 端目錄瀏覽 API（取代文字輸入選 repo，可選）。
9. 自動挑空閒 port、啟動 log、`--port` 參數。
10. 發佈到 npm（`bin` 欄位 + `npx` 入口）。

**階段 3 — 雙軌發佈**
11. CI 同時產出：npm publish（web）+ Release 掛 exe（既有 workflow）。
12. README 提供兩種安裝方式。

## 8. 風險與待決策

- **選 repo 的 UX**：web 版無原生資料夾選擇器。先用文字輸入（最快），階段二再補目錄瀏覽？→ **建議先文字輸入**。
- **HTTP server 框架**：Fastify（輕、型別好）vs Node 原生 http（零依賴）。→ **建議 Fastify**，省去手刻路由/解析。
- **port 衝突**：固定 port vs 自動挑空閒 port。→ **建議自動挑 + 印出網址**。
- **單一封裝指令**：是否要 `npm run build:all` 一次出 web bundle + exe？→ 階段三再做。

## 9. 驗收標準

- [ ] `npm run dev`（Electron）行為與重構前一致。
- [ ] `npx`（或 `npm run dev:web`）能起 server、自動開瀏覽器，看到與桌面版相同的 UI 與資料。
- [ ] Web 版可：列 project、列 session、顯示 branch badge、複製 resume 指令、改設定並持久化。
- [ ] Web 版全程無任何對外網路請求（只連 127.0.0.1）。
- [ ] exe 仍可由既有 release workflow 產出。
