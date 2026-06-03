# Claude Branch Map

掃描本機 Claude Code 對話紀錄，把每個對話對應回它所屬的 Git 分支的桌面工具。

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey)
![Electron](https://img.shields.io/badge/Electron-30-47848F)
![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6)

> **隱私(Privacy)**:所有運算都在本機。本工具只讀取機器上既有的檔案(`~/.claude/...` 與你的 Git 儲存庫),並執行本機 `git` 指令。**對話內容、檔案路徑、遙測都不會經由網路傳送** — 沒有後端,沒有 analytics。

## 這個工具跟對話歷史檢視器的差異

多數既有工具屬於**對話歷史檢視器(conversation history viewer)** — 把 `~/.claude` 的 transcript 渲染成漂亮的聊天 UI。Claude Branch Map 反過來:**分支 ↔ session 對應**才是主角,不是聊天紀錄本身。

- 它回答的是「*這個*對話產生了哪個分支?」與「*這個*分支是哪段對話產出的?」 — 你幾週後才會遇上的問題
- 它用兩層比對:**PostToolUse hook** 給高信心配對,沒有 hook 資料時退回 **commit 時間戳對齊**
- 目標是快速還原 + 一鍵 `claude --resume`,不是瀏覽歷史

若你主要想閱讀與搜尋過去對話,[universal-session-viewer](https://github.com/tad-hq/universal-session-viewer) 或 [claude-code-history-viewer](https://github.com/jhlee0409/claude-code-history-viewer)(這個專案的靈感來源)更合適。

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

### 下載安裝檔（macOS，Apple Silicon）

到 [Releases](https://github.com/rider159159/claude-branch-map/releases) 下載 `ClaudeBranchMap-<version>-arm64.dmg`，適用所有 M 系列晶片（M1／M2／M3／M4）。Intel Mac 不支援。

DMG 同樣**未做程式碼簽章與公證（notarization）**，首次開啟會被 Gatekeeper 擋下，可能顯示「無法打開」或「應用程式已損毀」。安裝方式：

1. 掛載 DMG，把 **Claude Branch Map.app** 拖進「應用程式」資料夾。
2. 若被擋，在終端機移除 quarantine 屬性後即可開啟：

   ```bash
   xattr -dr com.apple.quarantine "/Applications/Claude Branch Map.app"
   ```

## 從原始碼建置

需求：Node.js 與 npm。

```bash
git clone https://github.com/rider159159/claude-branch-map.git
cd claude-branch-map
npm install

npm run dev          # 啟動 Electron 視窗 + 熱重載
npm run build        # 型別檢查 + 打包 main / preload / renderer 至 out/
npm run package:win  # 打包並產生 Windows NSIS 安裝檔至 dist/
npm run package:mac  # 打包並產生 macOS arm64 DMG 至 dist/
```

| 指令 | 說明 |
|---|---|
| `npm run dev` | `electron-vite dev`，啟動視窗與 HMR |
| `npm run build` | TypeScript 型別檢查 + 打包至 `out/` |
| `npm run preview` / `npm run start` | 預覽打包結果 |
| `npm run package:win` | build 後用 `electron-builder` 產生 Windows x64 NSIS 安裝檔 |
| `npm run package:mac` | build 後用 `electron-builder` 產生 macOS arm64 DMG |
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

### 移除 hook

```bash
# macOS / Linux
bash scripts/uninstall-hook.sh             # 移除 hook 與腳本，保留紀錄檔
bash scripts/uninstall-hook.sh --purge-log # 連同 branch-hook.jsonl 一併刪除

# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File scripts\uninstall-hook.ps1
powershell -ExecutionPolicy Bypass -File scripts\uninstall-hook.ps1 -PurgeLog
```

反安裝器只移除本工具註冊的那筆 PostToolUse（其他既有設定不動），並刪除 `~/.claude/hooks/branch-hook.*`。重複執行安全。

### 完整移除 app（macOS）

```bash
rm -rf "/Applications/Claude Branch Map.app"
rm -rf ~/Library/Application\ Support/claude-branch-map  # electron-store 設定
```

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
- 安裝檔提供 Windows x64（NSIS）與 macOS arm64（DMG）。Apple Silicon 以外的平台（如 Intel Mac、Linux）需自行從原始碼建置。

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

## 發佈流程

推送版本 tag 會觸發 `.github/workflows/release.yml`,CI 自動建置 Windows 安裝檔並附到 **draft** 狀態的 GitHub Release:

```bash
npm version patch        # 升 package.json 版號並建立 tag
git push --follow-tags   # 推送 commit 與 v* tag
```

在 GitHub 上檢查 draft release 後手動發佈。安裝檔未做程式碼簽章(code signing),會觸發 SmartScreen(見下節)。

## Windows SmartScreen 警告

本 MVP 階段的 Windows 安裝檔**未做程式碼簽章**。Windows 會顯示「Microsoft Defender SmartScreen 已防止無法辨識的應用程式啟動」。安裝步驟:

1. 在 SmartScreen 對話框點「**其他資訊**」
2. 點「**仍要執行**」

工具於實際使用驗證後,簽章已列入 roadmap。

## 貢獻

1. Fork 本 repo。
2. 開功能分支：`git checkout -b feat/your-feature`。
3. 修改後跑 `npm run build` 確認型別檢查與打包通過。
4. 提交 PR，描述變更與動機。

新增 IPC 通道時，需同步改 `src/preload/index.ts`、`src/main/ipc.ts`、`src/renderer/api.ts` 三處，缺一不可（詳見 CLAUDE.md §2）。

## 授權

[MIT](LICENSE)
