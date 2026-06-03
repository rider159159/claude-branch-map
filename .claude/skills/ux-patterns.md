---
name: ux-patterns
description: claude-branch-map 的互動 UX 規範 — 資訊密度、漸進揭露(progressive disclosure)、列項工具列顯隱、hover/focus/active 狀態、空狀態、loading、toast、modal 行為。新增或修改任何 renderer 互動行為前必載;改列項按鈕(icon button)、新增 hover-only 操作、調整工具列預設可見性、新增 loading/空狀態、寫 toast 與彈窗時觸發。
---

你正在改 `claude-branch-map` 的 renderer 互動。本 skill 是這個專案的 UX 規範,寫死可用的互動 pattern。**先讀完再動手**,不要憑印象決定按鈕是否常駐、不要憑感覺挑 transition 時間。

對應檔案:[src/renderer/components/](../../src/renderer/components/)、[src/renderer/styles.css](../../src/renderer/styles.css)、[src/renderer/App.tsx](../../src/renderer/App.tsx)。

視覺規範(顏色 / 字體 / 元件結構)在 [design-system](design-system.md),本 skill 是行為層,兩者搭配使用。

---

## 1. 資訊密度與漸進揭露

### 1.1 列項預設可見的元素(必守)

session 列、project 列、message 列的卡片本體,**預設只顯示「閱讀資訊」**,操作按鈕一律隱藏。

| 類別 | 預設可見 | 預設隱藏 |
|---|---|---|
| 列項主標(title) | ✅ | — |
| meta(時間、路徑、token、分支) | ✅ | — |
| 狀態徽章(badge、pill、自訂標題 ✎ 標記) | ✅ | — |
| 操作 icon button(編輯、釘選、隱藏) | — | ✅ |
| 內聯編輯器(rename、note input) | — | ✅(點編輯才展開) |

**理由**:列表畫面常有 20+ 列,若每張卡都顯示三個按鈕 ×20 = 60 顆按鈕同時搶視覺焦點,使用者眼睛沒得休息,也分不清「現在要看資料」還是「現在要操作」。預設只給資訊、操作藏起來,是這個 app 的核心 UX 語言。

### 1.2 操作要被看見的觸發條件

icon button(`.session-icon-btn` / `.project-icon-btn`)的顯隱規則:

| 條件 | opacity | 理由 |
|---|---|---|
| 列項 hover | 1 | 滑鼠進到卡片 = 使用者正在考慮這列,給他工具 |
| 列項 focus-within(內部有元素 focus) | 1 | 鍵盤操作者進到這列也要看到工具 |
| 按鈕本身為 `.active` 狀態(已 pin、已編輯中) | 1(強制) | 持續狀態必須持續可見,否則使用者忘了自己 pin 過誰 |
| `.session-row.pinned`(整列已釘選) | 1(全工具列) | pinned 列的工具列常駐,讓使用者隨時能取消釘選 |
| 其他 | 0 | 預設隱藏 |

CSS 範例(這是規範本身,不是建議):

```css
.xxx-icon-btn {
  opacity: 0;
  background: transparent;       /* 不可給實體背景,否則 opacity transition 期間會閃 */
  border: 1px solid transparent; /* 同上,邊框要透明 */
  transition: opacity 100ms ease, background 100ms ease, color 100ms ease;
}
.xxx-row:hover .xxx-icon-btn,
.xxx-row:focus-within .xxx-icon-btn { opacity: 1; }
.xxx-icon-btn.active { opacity: 1; }                   /* 已啟用狀態 */
.xxx-row.pinned .xxx-icon-btn { opacity: 1; }          /* 已釘選列 */
.xxx-icon-btn:focus-visible { opacity: 1; }            /* 鍵盤焦點 */
```

**反例(不要這樣寫)**:

```css
/* ✗ 按鈕本體有實體背景 — 即使父層 opacity 0,動畫期間仍會閃 */
.xxx-icon-btn {
  background: var(--bg-elev);
  border: 1px solid var(--border);
}

/* ✗ 預設常駐 — 違反列項漸進揭露 */
.xxx-icon-btn { opacity: 1; }

/* ✗ 用 visibility / display 控制顯隱 — 沒有 transition 體驗會很硬 */
.xxx-row:not(:hover) .xxx-icon-btn { display: none; }
```

### 1.3 hover-only 不適用的場合

以下情境**不能**用 hover-only:

- **主要動作(primary action)**:整列存在的唯一目的就是要點它(例如「新增專案」按鈕本身),不可隱藏
- **危險動作的二次確認**:刪除確認按鈕、unsaved changes 警告 — 出現後必須持續可見,否則使用者來不及反應
- **載入中 / 錯誤狀態**:資訊本身已是當下重點,不該隱藏
- **觸控裝置**:本 app 是桌面 Electron,目前不考慮觸控;但若未來支援,hover-only 全部要改成「點卡片任意處展開工具列」

---

## 2. 互動狀態四件套(必守)

任何可互動元件(列項、按鈕、輸入框)四個狀態缺一不可:

| 狀態 | 視覺變化 | 觸發 |
|---|---|---|
| **default** | 基準樣式 | 無互動 |
| **hover** | `background: var(--bg-row-hover)` 或 `color: var(--text)` | 滑鼠進入 |
| **focus-visible** | `border-color: var(--accent)` 或 `outline: 1px solid var(--accent)` | 鍵盤 Tab 進入 |
| **active / selected** | `background: var(--accent-soft)` + `border-color: var(--accent)` | 已選中 / 進行中 |

`:focus-visible` 不可省略,鍵盤操作者完全靠它定位。`:focus`(會被滑鼠點擊觸發)優先順序低於 `:focus-visible`,**不要用 `:focus` 加 outline**,會在滑鼠點擊時殘留難看的方框。

### 2.1 Transition 速度規範

繼承 [design-system](design-system.md) 4.1:

| 用途 | 速度 |
|---|---|
| 列項 hover、icon button 顯隱 | `100ms ease` |
| button 一般 hover、border 顏色變化 | `100-120ms ease` |
| modal / panel 滑入滑出 | `150-180ms ease`(略慢,給使用者反應) |

**禁用**:`transition: all`(會把不該動的也動)、超過 200ms 的 hover、客製 cubic-bezier(目前 app 維持 ease 一致性)。

---

## 3. 空狀態(empty state)

清單為空時必須顯示「為什麼是空的 + 下一步」,不可只有空白區塊。

| 場景 | 訊息範例 |
|---|---|
| 尚未掃描 | 「載入專案中…」(配 skeleton) |
| 掃描完無專案 | 「找不到 ~/.claude/projects/ 下的對話記錄」(配說明連結到設定) |
| session 過濾無結果 | 「沒有符合搜尋的對話。試試清空搜尋或調整過濾條件。」 |
| 分支查詢失敗 | 「分支查詢失敗:{error}」(複用 `.branches-empty` class) |
| 隱藏全部 | 「目前的隱藏規則藏住所有專案。前往設定 → 隱藏管理 取消隱藏。」 |

**反例**:只顯示 `(empty)` 或 `No data`、留白完全沒提示。

---

## 4. 載入狀態(loading)

繼承 [design-system](design-system.md) 4.3 的 skeleton shimmer。**規則**:

1. **能用 skeleton 就用 skeleton**,只在無法估算結構時退回文字(例:不知道會回幾筆)
2. **首次載入 vs 重新整理**:首次用 skeleton,重新整理(已有資料)用「資料保留 + 角落小 spinner」**,不要把已顯示的內容換成 skeleton**(使用者會以為資料消失)
3. **同一視覺區塊不可同時 skeleton 又顯示部分資料**,擇一
4. **禁用**:文字「載入中…」沒配視覺、spinner、轉圈動畫、進度條(除非真的有進度可算)

`.branch-skeleton` 與 `.message-skeleton` 是現成 class,直接複用。

---

## 5. Toast 與 Modal

### 5.1 Toast(輕量回饋)

用於:複製成功、設定已儲存、操作成功等不需阻斷流程的提示。

規格(繼承 design-system 4.4):

- 固定底部置中、`var(--bg-elev)` 背景、不分顏色
- **顯示時間**:成功類 2.5 秒、警告類 4 秒、錯誤類 6 秒(使用者要時間看)
- **同時最多 1 個**,新 toast 蓋掉舊的(維持 App.tsx 既有 `toast` state 單一 slot 設計)
- **不可用於確認危險操作**,toast 不能等使用者反應就消失

### 5.2 Modal(阻斷流程的對話)

用於:刪除確認、設定面板、note 編輯展開區。

規格:

- **背後一律加 backdrop**(`rgba(0,0,0,0.4)` + `backdrop-filter: blur(2px)` 可選)
- **Esc 必須關閉**,焦點被 trap 在 modal 內(目前 settings panel 已實作,新 modal 沿用 pattern)
- **危險操作預設焦點落在「取消」**,不是「確認」(避免 enter 鍵誤觸)
- **不可堆疊 modal**(modal 開 modal 開 modal),若需流程改用 wizard 或多步驟分頁

### 5.3 不要用什麼

- 瀏覽器原生 `alert()` / `confirm()` / `prompt()`:外觀與 app 不一致,且 Electron 在 main process 有 `dialog` 但這裡幾乎不該用(會阻塞)
- 整頁覆蓋 loading overlay:看起來像 app 卡住,改用區域 skeleton

---

## 6. 鍵盤可達性(keyboard a11y)

桌面 app,鍵盤操作者要能跑完全部流程。

### 6.1 列項可聚焦

`role="button"` + `tabIndex={0}` + `onKeyDown` 處理 Enter / Space — `.session-row` 與 `.project-item` 已照這寫,新列項沿用。

```tsx
<article
  role="button"
  tabIndex={0}
  onClick={...}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  }}
>
```

### 6.2 內聯編輯器的鍵盤行為

打開編輯器(例:rename input)後:

- **Enter** = 提交
- **Esc** = 取消並還原 draft
- **input focus 時不可被外層 row 的 Enter/Space 攔截** — 用 `e.stopPropagation()` 在 input 的 keydown 上,或 row 的 handler 先檢查 `editing` state(SessionRow 走的是後者)

### 6.3 icon button 的 aria-label

icon button 沒有文字 label,**必須**寫 `aria-label`,且 `title` 寫人類可讀的提示。aria-label 簡短(「釘選對話」),title 可帶條件(「取消釘選」)。狀態切換時兩者都要對應切換。

---

## 7. 內聯編輯 vs 彈窗編輯

| 情境 | 用哪個 |
|---|---|
| 改單一短欄位(標題、tag) | 內聯展開 input |
| 改多欄位 / 結構化資料(設定、preferences) | 彈窗 / 側邊面板 |
| 預覽 / 唯讀詳細資料 | 不需編輯器,直接點開導向 detail view |

**規則**:內聯編輯展開時整列 cursor 改成 `default`(`.session-row.editing` 已實作),避免使用者誤點到 row 外層收起編輯器。

---

## 8. 動手前 checklist

改互動行為前自問:

- [ ] 我要加的按鈕是「操作」還是「資訊」?操作必須預設隱藏、列項 hover 才顯示
- [ ] 我有寫四個狀態嗎?default / hover / focus-visible / active 缺一不可
- [ ] focus-visible 的樣式跟 hover 一樣明顯嗎?鍵盤使用者要看得到
- [ ] 空狀態有告訴使用者「為什麼空 + 下一步」嗎?
- [ ] loading 是 skeleton 還是 spinner?有資料的重新整理是否誤換成 skeleton?
- [ ] toast 還是 modal?危險操作千萬不要用 toast 確認
- [ ] icon button 有 aria-label 嗎?狀態切換時 label 也跟著切?
- [ ] hover-only 元件本體是不是 `background: transparent` + `border: 1px solid transparent`?有實體背景會在 transition 期間閃爍

通過再動手。
