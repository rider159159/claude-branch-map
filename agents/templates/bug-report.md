# Bug-Report 範本(Track C — 除錯)

修 bug 用。複製下方骨架,貼到 `agents/planning/tasks.md`,標題加 `🐛` 前綴。

---

## 使用方式

1. 複製下方「範本骨架」整段
2. 貼到 `tasks.md` 任務列表最上方,標題加 `🐛` 前綴
3. 填完七個欄位(**症狀 / 重現步驟 / 期望行為 / Root cause / 影響範圍 / 修法策略 / Regression case**)後再動工
4. 動工後標題加 `🚧`,完成後加 `✅` 並附 commit hash

三大盲點(動筆前自我提醒):

1. **修了症狀不是 root cause** — bug 換個地方爆
2. **沒掃影響範圍** — 同樣的肇因在別處也存在
3. **沒寫 Regression case** — 一週後同 bug 復發

---

## 範本骨架

```markdown
## 🐛 <症狀為主的標題,例如:點 session 後右側偶爾空白>

**症狀** — 使用者觀察到什麼?
- 動作:...
- 預期:...
- 實際:...

**重現步驟**(編號清單,讓任何人能跟著做)
1. ...
2. ...
3. ...
- 復現率:每次 / 有時候(描述觸發條件)/ 一次性無法復現

**期望行為**
- ...

**Root cause**(Track C 核心)
從 Grep / Read / git log 定位的真正肇因。寫到「為什麼」這層,不只「哪一行」。
若定位不出來 → 老實寫「root cause 待動工階段進一步調查」。

**影響範圍**(同 root cause 在別處有沒有?)
| 位置 | 狀態 |
| --- | --- |
| `src/main/ipc.ts:XX` | ✅ 已定位 |
| `src/renderer/components/SessionList.tsx:YY` | ⚠ 疑似(同 pattern,待驗) |
| `src/shared/messages.ts` | ✅ 不受影響 |

**修法策略**
- 改 root cause 而非症狀
- ...

**Regression case**(避免同 bug 復發)
- 手動驗收清單:
  - [ ] 原症狀步驟跑過確認修好
  - [ ] 影響範圍表中 ⚠ 疑似那幾處也驗
  - [ ] 對應的反向操作不會引入新症狀

**References**(選填)
- 原始回報:Discord / Issue link
- 相關 commit:hash
```

---

## 完整範例

```markdown
## 🐛 點 session 後右側偶爾空白(快速切換時)

**症狀**
- 動作:在 SessionList 快速連點不同 session
- 預期:右側 MessageView 顯示對應對話
- 實際:有時固定停在前一筆,有時整個空白

**重現步驟**
1. 開啟 app,選一個有 10+ 對話的專案
2. 用方向鍵或滑鼠在 1 秒內連續切換 3–5 個 session
3. 觀察右側 MessageView
- 復現率:約 1/3 機率,session 數越多越容易發生

**期望行為**
- 右側永遠顯示目前 selectedSessionId 對應的對話內容

**Root cause**
`MessageView.tsx` 用 `fetchToken` ref 防舊請求覆蓋,但檢查時機是「請求回來時比對」。若快速切換時 A → B → A,B 的 setState 會被 A 的回應蓋掉,因為 token 數值相同。需要把 token 改成「每次 useEffect 都遞增,並用 closure 捕捉當下 token 值」。

**影響範圍**
| 位置 | 狀態 |
| --- | --- |
| `src/renderer/components/MessageView.tsx:25-46` | ✅ 已定位(fetchToken 用法) |
| `src/renderer/App.tsx:32-61` fetchBranchesFor | ⚠ 疑似(同 sessionsToken pattern,但有遞增,可能 OK) |
| `src/renderer/App.tsx:88` loadProjects fetchToken | ✅ 不受影響(有正確遞增) |

**修法策略**
- 改 `MessageView.tsx` useEffect 內 token 比對:把 token 捕捉到 closure,回應到時比對「捕捉的值是否仍等於 ref.current」
- 不動 App.tsx 的 sessionsToken(已是正確 pattern)

**Regression case**
- 手動驗收清單:
  - [ ] 1 秒內連點 5 個 session,每次都看到對應內容
  - [ ] 切到不存在的 session id(刪掉檔案後)不會 crash
  - [ ] 切換期間按「重新整理」也不會卡在 loading

**References**
- 原始回報:Discord 訊息 2026-05-XX
```
