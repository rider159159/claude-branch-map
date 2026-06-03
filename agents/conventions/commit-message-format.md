# Commit Message 撰寫格式

採 Conventional Commits 衍生規約,標題列含 emoji。直接搬自上游模板 [hsiangfeng/agent-template](https://github.com/hsiangfeng/agent-template) 的 `commit-message-format.md`,僅補上 claude-branch-map 的 scope 範例。

> **適用範圍**:本格式自 `agents/` 知識庫導入之 commit 起套用(2026-06-02 之後)。先前 git log 的命令式英文短句(例:`Add session detail pane with message viewer`、`Fix cwd exclude filter on Windows by normalizing path separators`)維持原貌,不回溯改寫。讀歷史 commit 時不必對齊本格式。

## 標題格式

```text
{type}({scope}): {emoji} {subject}
```

- `scope` 可省略(沒範圍時整段 `(...)` 也省略)
- `emoji` 由 `type` 決定,見下方對照表
- 整行 3–64 字元
- 中文 / 英文皆可,動詞開頭,不加句號

### claude-branch-map 常用 scope

| scope | 對應 |
|---|---|
| `main` | `src/main/*`(主程序) |
| `preload` | `src/preload/*` |
| `renderer` | `src/renderer/*` |
| `shared` | `src/shared/*` |
| `ipc` | 跨 main + preload + renderer 三層的通道改動 |
| `hook` | `scripts/` 內的 PostToolUse hook 相關 |
| `pkg` | 打包 / electron-builder 相關 |
| `docs` | 文件 |
| `agents` | `agents/` 知識庫本身 |

### 範例

```text
feat(renderer): 🎸 加上對話搜尋與標籤過濾
fix(main): 🐛 修正 Windows cwd 過濾路徑分隔符
docs(agents): ✏️ 補上 dev-log 寫法
refactor(ipc): 💡 把 pin/hide toggle 收成單一 IPC
chore(pkg): 🤖 升級 electron-builder
```

## Type 對照表

| Type | Emoji | 用途 |
|---|---|---|
| `feat` | 🎸 | 新增 / 修改功能 |
| `fix` | 🐛 | 修正 bug |
| `refactor` | 💡 | 重構 / 優化,非新功能也非 bug |
| `perf` | ⚡️ | 提升效能 |
| `style` | 💄 | 程式碼格式(lint / 空白 / 分號),不影響運作 |
| `test` | 💍 | 新增 / 補測試 |
| `docs` | ✏️ | 新增 / 修改文件 |
| `chore` | 🤖 | 第三方套件、設定、輔助工具維護 |
| `ci` | 🎡 | CI / CD 相關 |
| `release` | 🏹 | 正式 release commit |

> 找不到合適的 type → 想想是不是把多件事塞同一個 commit。一個邏輯改動一個 commit。

## 完整 Commit Message 結構

```text
{type}({scope}): {emoji} {subject}

{body}

BREAKING CHANGE: {breaking}

Closes #{issue}
```

| 區塊 | 必填 | 說明 |
|---|---|---|
| 標題列 | ✅ | 上述格式,64 字元內 |
| body | 條件 | 解釋「為什麼」而不是「做了什麼」(diff 已經說明 what) |
| BREAKING CHANGE | 條件 | 破壞性變更一定要寫,列出影響範圍與遷移指引 |
| Closes #N | 條件 | 關聯 GitHub Issue |

### 範例(含 body)

```text
feat(renderer): 🎸 加上「在 Cursor 繼續對話」

設定面板提供「VS Code / Cursor」下拉,行為與既有
「在 VS Code 繼續」一致 — 啟動 workspace、丟對應
URI scheme 的 deep link。預設 vscode。

Closes #12
```

### 範例(BREAKING CHANGE)

```text
refactor(shared): 💡 AppSettings.vscodeResumeUriTemplate 改名 resumeUriTemplate

把 VS Code / Cursor 共用的 URI 模板抽到通用鍵,
原 vscodeResumeUriTemplate 保留向後讀取以做平滑遷移。

BREAKING CHANGE: 直接讀 settings.json 的腳本要改抓
新鍵名 resumeUriTemplate。getSettings() 仍會將舊鍵
轉成新鍵,但下次 setSettings() 會把舊鍵移除。
```

## 反例

- ❌ `update code` — 沒 type、沒 emoji、subject 沒資訊
- ❌ `feat: add stuff` — subject 太模糊
- ❌ `feat(renderer): 🎸 加搜尋、修分支、改 token` — 一次塞太多邏輯
- ❌ `fix: 修 bug` — 沒講修了什麼 bug
- ❌ 把 emoji 換成不在對照表的 — emoji 必須對應 type

## 提交前 checklist

1. `npm run build` 通過(typecheck 在 build 內)
2. 動到的 IPC 通道有經過 `ipc-boundary-reviewer` 子代理檢查
3. 有手動驗證(claude-branch-map 沒有自動測試框架,以人工驗收為主)
4. commit 訊息符合本文件格式
