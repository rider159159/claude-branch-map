# Change-Request 範本(Track B — 修改需求)

修改既有功能用。跟 `task.md` 不同的是多了「既有行為」與「Backward compat」兩個強制欄位。

複製下方骨架,貼到 `agents/planning/tasks.md`,標題加 `🔧` 前綴。

---

## 使用方式

1. 複製下方「範本骨架」整段
2. 貼到 `tasks.md` 任務列表最上方,標題加 `🔧` 前綴
3. 填完六個欄位(**Context / 既有行為 / 變更內容 / 影響範圍 / Backward compat / Acceptance / Non-goals**)後再動工
4. 動工後標題加 `🚧`,完成後加 `✅` 並附 commit hash

Track B 最大盲點是 **backward compat** — 改了 X,使用者習慣的 Y 還在嗎?這欄漏掉會收到「以前可以為什麼現在不行」的回報。

claude-branch-map 特別注意:`AppSettings` 結構變動要在 `getSettings()` 提供從舊鍵讀的 fallback,以免使用者升級後設定檔開不起來。

---

## 範本骨架

```markdown
## 🔧 <動詞開頭的變更名稱>

**Context** — 為什麼要改?目前哪裡不夠用?
(一兩句話。「想換樣子」沒有實質痛點,先回去釐清。)

**既有行為**(Track B 核心)
從**使用者觀點**寫,不是程式碼描述:
- 目前:...
- 目前:...

**變更內容**
新的行為要長怎樣:
- ...
- ...

**影響範圍**
- 檔案:`src/main/...`、`src/renderer/...`
- IPC 通道:...(若有)
- 設定鍵:...(若有)
- 既有 brief:`tasks.md` 中 ✅ 的相關項
- 文件:dev-log 紀錄變更原因

**Backward compat 評估**(Track B 核心)
| 既有行為 | 變更後 | 性質 |
| --- | --- | --- |
| 行為 A | 不變 | ✅ 保留 |
| 行為 B | 加新選項 | ⚠ 改變但無破壞 |
| 行為 C | 移除 | ⛔ 破壞性 |

> 結論:無 / 含破壞性變更。
> 若有 ⛔ → 明寫遷移指引(對應 settings 從舊鍵讀 fallback、舊 IPC 通道回 deprecated 警告等)。

**新 Acceptance**
- [ ] 新行為 1 ...
- [ ] 既有行為(無破壞性那幾項)仍正常運作
- [ ] Backward compat 表中 ⛔ 項的遷移指引在 dev-log 與 commit body 內留紀錄
- [ ] `npm run build` 全綠

**Non-goals**
- 不做 X
- 不重構 Y

**References**(選填)
- 既有實作:`src/...`
- 相關 task:`tasks.md` 中「✅ ...」
```

---

## 完整範例(含破壞性變更)

```markdown
## 🔧 把 AppSettings.vscodeResumeUriTemplate 改名為 resumeUriTemplate

**Context** — 為了支援 Cursor,VS Code / Cursor 共用同一個 URI 模板鍵比較合理,vscodeXxx 命名跟新功能對不上。

**既有行為**
- 目前:`AppSettings.vscodeResumeUriTemplate` 寫死 `vscode://...` 開頭
- 目前:`openWorkspaceBeforeResume` 與 `vscodeOpenDelayMs` 三鍵獨立呈現
- 目前:設定面板暴露 URI template / 開資料夾切換 / 延遲 ms 三項

**變更內容**
- 新增 `preferredEditor: 'vscode' | 'cursor'`,預設 vscode
- 改名 `vscodeResumeUriTemplate` → `resumeUriTemplate`,但實際模板由 preferredEditor 決定預設
- 設定面板把編輯器選擇放到一級,URI template / 延遲 ms 收進「進階」

**影響範圍**
- shared:`src/shared/types.ts` AppSettings、DEFAULT_SETTINGS
- main:`src/main/settings.ts` getSettings 加舊鍵 → 新鍵 fallback
- main:`src/main/resume.ts` 依 preferredEditor 選 CLI 與 URI scheme
- renderer:`src/renderer/components/SettingsPanel.tsx` 重排
- renderer:`src/renderer/components/MessageView.tsx` 按鈕標籤動態
- IPC:無新通道(全走 settings:get / settings:set)

**Backward compat 評估**
| 既有行為 | 變更後 | 性質 |
| --- | --- | --- |
| 既有 `vscodeResumeUriTemplate` 設定 | getSettings 讀到舊鍵 → 複製到新鍵 | ✅ 保留 |
| 點「在 VS Code 繼續對話」 | preferredEditor 預設 vscode → 行為不變 | ✅ 保留 |
| 設定面板上「URI template」位置 | 移到「進階」摺疊區 | ⚠ 改變但無破壞 |
| 直接從 setting.json 讀 `vscodeResumeUriTemplate` 的外部腳本 | 鍵會在下次 setSettings 時被移除 | ⛔ 破壞性 |

> 結論:含破壞性變更。遷移指引:外部腳本請改讀 `resumeUriTemplate`。getSettings 一次性轉移保留向後讀取。

**新 Acceptance**
- [ ] 既有使用者升級後設定不會壞、行為不變
- [ ] 設定切到 cursor 後按鈕標籤變更、CLI / URI scheme 切換
- [ ] 舊鍵 vscodeResumeUriTemplate 在下次寫入後消失,新鍵存在
- [ ] dev-log 與 commit body 標 BREAKING CHANGE
- [ ] `npm run build` 全綠

**Non-goals**
- 不做「同時支援多個編輯器」(只能選一個 preferred)
- 不重構 SettingsPanel 整體佈局
```
