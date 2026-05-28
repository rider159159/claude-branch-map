# Claude Branch Map

掃描本機 Claude Code 對話紀錄，把每個對話對應回它所屬的 Git 分支的桌面工具。

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey)
![Electron](https://img.shields.io/badge/Electron-30-47848F)
![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6)

> 設計工作流是「一張票 = 一個 Claude 對話 = 一個 Git 分支」。幾週後回頭時，對話與分支的對應關係難以靠記憶還原 — 這個工具把對應重新建起來，並讓你一鍵接續任一段舊對話。

---

## 目錄

- [這個工具解決什麼問題](#這個工具解決什麼問題)
- [功能](#功能)
- [畫面](#畫面)
- [安裝](#安裝)
- [從原始碼建置](#從原始碼建置)
- [Hook 整合（選用，建議）](#hook-整合選用建議)
- [分支匹配原理](#分支匹配原理)
- [資料隱私](#資料隱私)
- [限制](#限制)
- [專案結構](#專案結構)
- [貢獻](#貢獻)
- [授權](#授權)

---

## 這個工具解決什麼問題

Claude Code 把每段對話以 JSONL 存在 `~/.claude/projects/` 下，檔名是 session ID，本身不記錄這段對話對應到哪個 Git 分支。當你同時推進多張票、每張票開一個分支與一段對話時，過幾週要回頭找「上次處理 X 功能的那段對話在哪」，只能靠記憶逐一翻找。

Claude Branch Map 掃描全部本機 session，為每個 session 標出對應的 Git 分支，並提供一鍵複製 `claude --resume <session-id>` 接續對話。

## 功能

| 功能 | 說明 |
|---|---|
| Session 清單 | 掃描 `~/.claude/projects/*/<session-id>.jsonl`，依專案分組列出所有本機對話 |
| 分支對應 | 每個 session 標出對應的一或多個 Git 分支，多個符合就顯示多個徽章，不合併、不截斷 |
| 兩種匹配來源 | Hook 紀錄（高信心）優先，無紀錄時退回時間窗對齊 |
| 一鍵接續 | 列上「複製接續指令」把 `claude --resume <session-id>` 複製到剪貼簿，貼進終端機即可續談 |
| 對話內容檢視 | 點開 session 檢視訊息內容，支援 Markdown、語法高亮、工具呼叫區塊 |
| 釘選與隱藏 | 釘選常用專案/session 至頂端；隱藏不想看到的項目 |
| 兩種分支定義 | 在設定切換「分支建立於 session 期間」與「建立且至少有一次 commit」 |
| Repo 路徑覆寫 | session 的 `cwd` 不存在或想改對應另一個 repo 時，手動指定 repo 路徑 |

### 分支徽章模式

在應用程式內的「設定」面板切換兩種「這段 session 建立的分支」定義：

- **A · session 期間建立的分支**（預設）— 分支的首次 commit 落在 session 時間窗內。
- **B · 建立且至少有一次 commit** — 同 A，但濾掉開了卻從未 commit 的分支。

### Repo 來源

預設把每個 session 的 `cwd` 視為 Git repo 並查詢分支。若 `cwd` 已不存在、不是 Git repo，或想對應到另一個 repo，在「設定」設定**手動 repo 路徑覆寫**。

## 畫面

> 截圖待補。

<!--
![Session 清單](docs/screenshot-sessions.png)
![對話檢視](docs/screenshot-messages.png)
-->

## 安裝

### 下載安裝檔（Windows）

到 [Releases](https://github.com/rider159159/claude-branch-map/releases) 下載 `ClaudeBranchMap-Setup-<version>.exe` 後執行。

安裝檔目前**未做程式碼簽章**，Windows 會跳出「Microsoft Defender SmartScreen 已封鎖無法辨識的應用程式」。安裝方式：

1. 在 SmartScreen 對話框點「**更多資訊**」。
2. 點「**仍要執行**」。

簽章會在工具於實際使用中驗證後納入計畫。

## 從原始碼建置

需求：Node.js 與 npm。

```bash
git clone https://github.com/rider159159/claude-branch-map.git
cd claude-branch-map
npm install

npm run dev          # 啟動 Electron 視窗 + 熱重載
npm run build        # 型別檢查 + 打包 main / preload / renderer 至 out/
npm run package:win  # 打包並產生 Windows NSIS 安裝檔至 dist/
```

| 指令 | 說明 |
|---|---|
| `npm run dev` | `electron-vite dev`，啟動視窗與 HMR |
| `npm run build` | TypeScript 型別檢查 + 打包至 `out/` |
| `npm run preview` / `npm run start` | 預覽打包結果 |
| `npm run package:win` | build 後用 `electron-builder` 產生 Windows x64 NSIS 安裝檔 |
| `npm run package:dir` | 產出未打包的 dir 版本（供 smoke test） |

## Hook 整合（選用，建議）

時間窗對齊是零設定的預設行為。安裝 PostToolUse hook 可得到精確、高信心的對應。

```bash
# macOS / Linux
bash scripts/install-hook.sh

# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File scripts\install-hook.ps1
```

安裝器會把 `scripts/branch-hook.*` 複製到 `~/.claude/hooks/`，並 merge 一筆 PostToolUse 進 `~/.claude/settings.json`。既有設定保持不動，重複執行安全。

安裝後，每次 tool call 結束時 hook 會把 `{sessionId, branch, timestamp}` append 進 `~/.claude/branch-hook.jsonl`，作為高信心對應來源。

## 分支匹配原理

匹配分兩層（定義於 `src/shared/matcher.ts`）：

1. **高信心 — Hook 紀錄**：從 `~/.claude/branch-hook.jsonl` 取得 session 期間實際 checkout 過的分支名單，直接對應。
2. **後備 — 時間窗對齊**：無 hook 紀錄時改用時間窗 — 分支的首次 commit 必須落在 `[session.firstTs, session.lastTs]` 內。
   - 模式 `created`：符合時間窗即可。
   - 模式 `created-with-commits`：還要至少有一次 commit。
   - 對應落在 1 小時內視為高信心，超過為低信心。

## 資料隱私

所有讀取都在本機完成，不對外傳送任何資料：

- 對話內容讀自本機 `~/.claude/projects/`。
- 分支資訊讀自本機 Git repo。
- 接續指令只寫入本機剪貼簿。

工具沒有後端伺服器，也不發出網路請求。

## 限制

- 接續 Claude 對話只適用於同一台機器上的 CLI session。Claude 桌面 / 行動 / 網頁版使用不同的 session 格式，無法用 `claude --resume` 接續。
- 此版本只產 Windows 安裝檔。程式碼與平台無關，但 `electron-builder.yml` 目前只接上 Windows x64 NSIS。

## 專案結構

```
src/
  shared/   # 型別、JSONL parser、Git 包裝、hook reader、matcher
  main/     # Electron 主程序、IPC handler、設定、剪貼簿
  preload/  # contextBridge 暴露型別化的 window.api
  renderer/ # React + Vite UI
scripts/    # hook 腳本與安裝器
```

採 Electron 三程序模型：主程序（Node.js，存取檔案系統與 Git）、預載腳本（`contextBridge` 橋接）、渲染程序（React + Vite）。`src/shared/` 由 main 與 renderer 雙向 import。詳見 [CLAUDE.md](CLAUDE.md)。

## 貢獻

1. Fork 本 repo。
2. 開功能分支：`git checkout -b feat/your-feature`。
3. 修改後跑 `npm run build` 確認型別檢查與打包通過。
4. 提交 PR，描述變更與動機。

新增 IPC 通道時，需同步改 `src/preload/index.ts`、`src/main/ipc.ts`、`src/renderer/api.ts` 三處，缺一不可（詳見 CLAUDE.md §2）。

## 授權

[MIT](LICENSE)
