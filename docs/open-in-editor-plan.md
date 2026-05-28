# Open in VS Code / Cursor 功能 — 計畫書

## 一、背景與目標

目前 app 已能讀取 `~/.claude/projects/*.jsonl` 並提供 **Copy resume** 將 CLI 指令複製到剪貼簿。使用者希望能**直接點擊跳到 VS Code Claude Code 擴充並 resume 該 session**，省去切回 terminal 貼指令的步驟。

經官方文件確認，Claude Code VS Code 擴充有註冊 URI handler：

```
vscode://anthropic.claude-code/open?session=<sessionId>
```

Cursor 沿用相同 protocol（`cursor://anthropic.claude-code/open?...`），可一併支援。

---

## 二、需求範圍

| 項目 | 決議 |
|---|---|
| 支援編輯器 | VS Code + Cursor，在 Settings 提供選擇 |
| 編輯器不在正確 workspace 時 | 先自動 spawn `code <cwd>` / `cursor <cwd>` 帶 workspace，再丟 URI |
| 按鈕位置 | MessageView header（與 Copy resume 並列） |

---

## 三、實作項目

### 3.1 設定層（`src/shared/types.ts` / `src/main/settings.ts`）

- 新增 type：`PreferredEditor = 'vscode' | 'cursor'`
- `AppSettings` 加 `preferredEditor: PreferredEditor`，預設 `'vscode'`
- `DEFAULT_SETTINGS`、`getSettings()`、`updateSettings()` 同步加上對應讀寫

### 3.2 Main process（`src/main/ipc.ts`）

新增 IPC handler `editor:openSession`，參數 `{ sessionId, cwd }`：

1. 從 settings 讀 `preferredEditor`
2. 依照編輯器決定 CLI 名稱與 URI scheme：

   | editor | CLI | URI scheme |
   |---|---|---|
   | vscode | `code` | `vscode://anthropic.claude-code/open` |
   | cursor | `cursor` | `cursor://anthropic.claude-code/open` |

3. 若 `cwd` 存在：用 `child_process.spawn(cli, [cwd], { detached: true, shell: process.platform === 'win32' })` 開啟/聚焦 workspace。Windows 必須 `shell: true` 才認得 `code.cmd` / `cursor.cmd`
4. 等 ~300ms 給 IDE 啟動緩衝（剛啟動時 URI handler 還沒就緒），然後：

   ```ts
   await shell.openExternal(`${scheme}?session=${encodeURIComponent(sessionId)}`);
   ```

5. 回傳結果 `{ ok: boolean, launchedEditor: boolean, error?: string }`：
   - spawn ENOENT（找不到 `code` / `cursor` CLI）→ `launchedEditor: false`，但仍嘗試丟 URI（IDE 若已開就還是會接到）
   - URI 開啟成功 → `ok: true`

### 3.3 Preload + Renderer API

- `src/preload/index.ts` 暴露 `openInEditor(payload): Promise<EditorOpenResult>`
- `src/renderer/api.ts` 加對應型別

### 3.4 UI（`src/renderer/components/MessageView.tsx`）

- Header 在 Copy resume 旁加 **Open in VS Code**（標籤依 `settings.preferredEditor` 動態變成 `Open in VS Code` 或 `Open in Cursor`）
- 點擊 → 呼叫 `api.openInEditor({ sessionId, cwd })`
- 成功 → Toast「Opening session in VS Code…」
- 失敗（找不到 CLI 也找不到 IDE）→ Toast「Couldn't reach VS Code — make sure the `code` CLI is on PATH」
- 為了讓 App.tsx 能彈 Toast，這個按鈕點擊回到 App 層的 `onOpenInEditor` callback（與現有 `onCopy` 同模式）

### 3.5 Settings UI（`src/renderer/components/SettingsPanel.tsx`）

- 新增一列「Open conversations in」下拉：`VS Code` / `Cursor`
- 變更時走現有 `onSettingsChange({ preferredEditor })` 流程，不需 reload projects

---

## 四、邊緣情況處理

| 情境 | 處理 |
|---|---|
| 使用者尚未安裝該編輯器 | spawn 失敗（ENOENT）→ 仍嘗試 `shell.openExternal(uri)`，OS 會跳「沒有 app 能開這個連結」對話框 |
| CLI 沒在 PATH 但 IDE 已開 | spawn 失敗但 URI 仍能被已開的 IDE 接到，主要 happy path 不受影響 |
| Session cwd 在外接硬碟、目前沒掛載 | spawn `code <cwd>` 會啟動 VS Code 顯示空 workspace；URI 觸發後 Claude 擴充會找不到 session → 開新對話。我們在 Toast 提示「workspace 路徑不存在」 |
| 不同 OS 的 CLI 安裝路徑 | macOS：`code` 預設要先在 VS Code 執行 Shell Command: Install 'code' command in PATH。Windows：安裝時內建。Linux：deb/snap 內建。CLI 名稱跨平台統一 |
| URI handler 還沒註冊（VS Code 版本太舊或沒裝 Claude 擴充） | OS 會跳「沒有應用程式關聯」對話框 — 文件首發加註：需 Claude Code 擴充 ≥ 某版本 |

---

## 五、驗證步驟

1. **基本流**：VS Code 已在某 workspace 開著，點按鈕 → 該 session 在 Claude 面板裡 resume
2. **VS Code 沒開**：完全關閉 VS Code，點按鈕 → VS Code 自動啟動 + 開 workspace + resume session
3. **VS Code 在錯誤 workspace**：點按鈕 → VS Code 跳到正確 workspace 後 resume
4. **Cursor 切換**：Settings 切到 Cursor，按鈕標籤變更，行為複製到 Cursor
5. **CLI 不在 PATH**：把 `code` rename 模擬找不到 → Toast 顯示提示，但 URI 仍能命中已開的 IDE
6. **沒裝 Claude 擴充**：URI 觸發後 OS 彈關聯對話框 → 不 crash
7. `npm run build` 與 `npm run dev` 都通過

---

## 六、檔案異動清單

**修改**
- `src/shared/types.ts` — `PreferredEditor` type、`AppSettings.preferredEditor`、`DEFAULT_SETTINGS`
- `src/main/settings.ts` — getSettings/updateSettings 加 preferredEditor
- `src/main/ipc.ts` — 新 IPC handler `editor:openSession`
- `src/preload/index.ts` — 暴露 `openInEditor`
- `src/renderer/api.ts` — 加 API 型別
- `src/renderer/App.tsx` — `onOpenInEditor` callback + 串到 MessageView
- `src/renderer/components/MessageView.tsx` — 新按鈕
- `src/renderer/components/SettingsPanel.tsx` — 編輯器下拉

**新增**：無

---

## 七、風險與權衡

| 風險 | 對策 |
|---|---|
| URI 開啟前的 300ms 等待是經驗值，不同機器可能不夠 | 改成「先丟 URI，若 cwd 也提供就同時 spawn」並列；URI handler 自己會等 extension 載入 |
| `child_process.spawn` 的 detached 行為在 Windows 上偶有殘留進程 | 加 `stdio: 'ignore'` + `unref()`，避免 main process 被 hold 住 |
| 未來 Anthropic 改 URI 格式 | 把 scheme + path 抽成常數，方便集中維護 |
| 使用者可能裝多個 IDE 且都想用 | 目前只支援一個預設值；若日後有需求可改成「點按鈕後出選單讓使用者選」 |

---

## 八、預估工作量

- Settings + IPC + preload + types：約 80 行
- UI（按鈕 + Settings 下拉）：約 40 行
- 文件與 Toast 文案：約 10 行
- **總計約 130 行新增 / 修改，預估 30 分鐘完成**

---

## 九、技術依據

- [Use Claude Code in VS Code — Claude Code Docs](https://code.claude.com/docs/en/vs-code)
- URI handler 格式：`vscode://anthropic.claude-code/open?session=<sessionId>&prompt=<text>`
  - `session`（選填）：要 resume 的 session ID，須屬於目前 VS Code 開啟的 workspace；找不到則開新對話
  - `prompt`（選填）：URL-encoded 文字，預填到輸入框但不自動送出
