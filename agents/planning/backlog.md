# Backlog

暫停 / 已知 bug / 構想未動工的條目。**動工前(新 session 起手 Step 0.5)必看**,避免另開重疊新題。

**狀態圖示**:`🅿️` 暫停(動了一半,有外部 blocker) · `🐛` 已知 bug(未排修) · `💡` 構想(未釐清成 brief)

**前綴**:`🔧` Track B 變更 · `🐛` Track C 除錯 · 無前綴 = Track A 新功能

---

## 與其他檔案的分工

| 檔案 | 內容 |
|---|---|
| [tasks.md](tasks.md) | 進行中 🚧 / 已完成 ✅ / 等使用者澄清 🚫 |
| **backlog.md(本檔)** | 動了一半暫停 🅿️ / 已知 bug 🐛 / 構想 💡 |
| [../../docs/optimization-plan.md](../../docs/optimization-plan.md) | 規格初稿(brief 來源池) |
| [../dev-logs/](../dev-logs/) | 每日紀錄(時間軸視角) |

**搬動規則**

- 動工卡住 → tasks.md 條目 → 移到 backlog.md(加 🅿️)。**tasks.md 保留摘要 + blocker 一句 + 連結到 backlog.md**;backlog.md 為**詳情主檔**(Blocker / 重啟條件 / 已 revert 的檔案以此為準)。修改一處要同步另一處
- blocker 解除 → backlog.md 條目刪除 → 內容搬回 tasks.md(加 🚧)
- 發現新 bug 但不立即修 → 直接寫進 backlog.md(🐛)
- 沒釐清成完整 brief 的構想 → 寫進 optimization-plan.md(不來 backlog)

---

## 條目骨架(複製用)

```markdown
## 🅿️ <標題,沿用 tasks.md 內名稱>

**Last touched** — YYYY-MM-DD([dev-log](../dev-logs/YYYY-MM-DD.md))
**Blocker** — 一兩句話講為什麼卡住
**Root cause 狀態** — 已定位 / 待調查;若已定位,寫在哪、是 app 還是外部
**重啟條件** — 什麼狀況下可以撿起來(blocker 怎麼解 / 等什麼決策)
**已動但 revert 的 code**(若有)— 列出涉及檔案
**相關** — 對應 docs / tasks.md / dev-log 連結
```

---

## 🅿️ Claude hook 一鍵啟用 / 移除按鈕

**Last touched** — 2026-06-02([dev-log](../dev-logs/2026-06-02.md))

**Blocker** — `scripts/install-hook.ps1` 與 `scripts/uninstall-hook.ps1` 使用 `ConvertFrom-Json -AsHashtable`,該參數僅 PowerShell 7+ 支援。多數 Windows 環境預設是 PowerShell 5.1 → 腳本本身會在 `Get-Content -Raw -Path $settingsPath | ConvertFrom-Json -AsHashtable` 這行噴 `Failed to read existing settings.json`,abort 退出。App 端的按鈕無論做不做,只要呼叫到這兩個腳本就會踩到。

**Root cause 狀態** — 已定位,在 `scripts/install-hook.ps1:21` 與 `scripts/uninstall-hook.ps1:24`,**不在 app**。

**重啟條件**(滿足其一即可)
- A:install / uninstall 腳本改用 PS 5.1 相容寫法。例:
  ```powershell
  $json = Get-Content -Raw -Path $settingsPath | ConvertFrom-Json
  # 手動把 PSCustomObject 轉成可變的 hashtable / 或全程用 PSCustomObject 操作
  ```
- B:在 README 與 install 文件明列「需要 PowerShell 7+」,並在 app 按鈕按下前先檢查 `$PSVersionTable.PSVersion.Major -ge 7`,不符就 Toast 提示升級
- C:腳本改用 Python(已存在 macOS 路徑的依賴),Windows 也走 Python 路徑;但會多一個 Windows 需裝 Python 的前提

**已動但 revert 的 code**(本輪 2026-06-02)
- `src/shared/types.ts`(新增 InstallHookResult 型別)
- `src/main/ipc.ts`(新增 runHookScript helper、hook:install / hook:uninstall handler)
- `src/preload/index.ts`(暴露 installHook / uninstallHook)
- `src/renderer/api.ts`(RendererApi 補對應)
- `src/renderer/components/SettingsPanel.tsx`(Claude hook 整合區塊 + 兩顆按鈕)
- `src/renderer/App.tsx`(SettingsPanel 加 onToast prop)
- `electron-builder.yml`(extraResources 帶 scripts/)

**相關**
- 規格:[docs/optimization-plan.md](../../docs/optimization-plan.md) #2
- 對應 brief:[tasks.md](tasks.md)「Claude hook 一鍵啟用 / 移除按鈕(#2 簡化版)」(也標 🅿️)
- 觸發 bug 的提交實驗:本日工作期內未 commit,直接 revert
