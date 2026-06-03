---
name: design-system
description: claude-branch-map 的視覺設計規範 — 色彩 token、字體、元件 pattern、互動規格。新增或修改任何 src/renderer 下的 UI(component、styles.css、新元件樣式)前必載;改 CSS 變數、新增 hover/selected/pinned 狀態、新增 pill/badge/row 元件、調整 transition 時觸發。
---

你正在改 `claude-branch-map` 的 renderer UI。本 skill 是這個專案的視覺設計規範,寫死可用的色彩 / 字體 / 元件 pattern / 互動規格。**先讀完再動手**,不要憑印象 hardcode 顏色或自行新發明 weight。

對應檔案:[src/renderer/styles.css](../../src/renderer/styles.css)、[src/renderer/main.tsx](../../src/renderer/main.tsx)、[src/renderer/components/](../../src/renderer/components/)。

互動行為規範(列項工具列顯隱、狀態四件套、空狀態、loading、toast、modal、鍵盤可達性)在 [ux-patterns](ux-patterns.md),本 skill 是視覺層,兩者搭配使用。

---

## 1. 色彩 token

全部定義在 [styles.css](../../src/renderer/styles.css) 的 `:root`,基於 GitHub Desktop Dark(Primer)。**禁止在元件裡 hardcode hex / rgba**,一律走 CSS 變數。

### 結構色(三層背景 + 邊框)

| Token | Hex | 用途 |
|---|---|---|
| `--bg` | `#0D1117` | 主背景 — 整個 app 最底層、message-pane 內容區 |
| `--bg-elev` | `#161B22` | 次層 — topbar、sidebar、settings 面板、message-pane-header、pre/code block 背景 |
| `--bg-row` | `#161B22` | 列項背景 — session-row、message-row、tool-payload |
| `--bg-row-hover` | `#21262D` | hover 高亮 — 列項 hover、button hover、skeleton 動畫高位 |
| `--border` | `#30363D` | 全域邊框、分隔線 |

### 文字色(三階對比)

| Token | Hex | 用途 |
|---|---|---|
| `--text` | `#E6EDF3` | 主文字 — body、標題、列項主標 |
| `--text-dim` | `#7D8590` | 次文字 — meta 資訊、label、role-pill 預設 |
| `--text-mute` | `#6E7681` | 弱文字 — path、id、時間戳、placeholder |

### 語意色

| Token | Hex | 用途 |
|---|---|---|
| `--accent` | `#2F81F7` | 強調藍 — primary 按鈕、選取狀態、focus 邊框、連結、pin 標記 |
| `--accent-soft` | `rgba(47,129,247,0.15)` | accent 半透明背景 — selected 列項、role-pill.role-user |
| `--high` | `#3FB950` | 高信心綠 — branch-badge.confidence-high、assistant 訊息邊框、role-pill.role-assistant |
| `--high-soft` | `rgba(63,185,80,0.15)` | high 半透明背景 |
| `--low` | `#D29922` | 低信心黃 — branch-badge.confidence-low、sidechain role-pill |
| `--low-soft` | `rgba(210,153,34,0.12)` | low 半透明背景 |
| `--warm` | `#F0883E` | 暖橙 — ASSISTANT role-pill、assistant 訊息邊框(與藍色 USER 形成對角色相對比) |
| `--warm-soft` | `rgba(240,136,62,0.18)` | warm 半透明背景 |
| `--error` | `#F85149` | 錯誤紅 — error block、tool-error-flag |

### 使用規則(必守)

1. **絕對禁止**新增不在表上的色票。要加新顏色,先新增 `--token` 在 `:root`,再用變數
2. **selected / active 狀態**:背景 `--accent-soft` + 邊框 `--accent`(見 [styles.css `.session-row.selected`](../../src/renderer/styles.css))
3. **pinned 狀態**:左邊 `3px solid var(--accent)` 邊條或 4px 圓點,**不改背景**(背景仍為 `--bg-row`)
4. **錯誤態**:背景 `rgba(248,113,113,0.1)`、邊框 `rgba(248,113,113,0.3)`、文字 `--error`(維持現有 `.error` class 寫法)
5. **不可用色**:`#3b82f6` / `#93c5fd` 等舊版藍 — 已全數遷移到 `--accent` / `--high`,不要回插

---

## 2. 字體

定義在 [styles.css](../../src/renderer/styles.css) 的 `--font-sans` / `--font-mono`,離線打包,由 [main.tsx](../../src/renderer/main.tsx) 載入。

### Sans(UI 主字體)

```
"Noto Sans TC", "Noto Sans", "Microsoft JhengHei", "PingFang TC",
-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
```

中文走 Noto Sans TC,英數走 Noto Sans。系統字體保留作為終極 fallback。

### Mono(等寬,程式碼/id/path)

```
"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo,
"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", monospace
```

### Weight 規則(必守)

**只有 `400` 與 `700` 可用**,中間值已從 bundle 移除以省 installer 體積。

| Weight | 對應使用 |
|---|---|
| `400`(regular) | 內文、meta、label、列項主標(非標題) |
| `700`(bold) | 標題(h1-h4)、primary 按鈕、`.role-pill`、`.tool-name`、強調文字 |

**禁用**:`font-weight: 500` / `600` / `bolder` — browser 會 fall back 到 400 觸發 synthetic bold,字會糊。新元件如果想要 semibold 質感,改用 `letter-spacing: 0.02em` + `font-weight: 700` 替代。

### 載入

新增字體 weight 必須在 [main.tsx](../../src/renderer/main.tsx) `import '@fontsource/<name>/<weight>.css'`,**不可走 CDN**(CSP `style-src` 沒開 `https:`,且要離線)。

---

## 3. 元件 pattern

以下 pattern 是已成形且必須沿用的視覺語言。新增類似元件時,直接複製對應 class 命名與結構。

### 3.1 列項(row)— 用於 sidebar / session list / message list

通用結構:

```css
.xxx-row {
  background: var(--bg-row);
  border: 1px solid var(--border);
  border-radius: 8px;          /* 列項用 8px,小元件用 6px,輸入用 6px,pill 用 10-12px */
  padding: 12px 14px;
  transition: background 100ms ease, border-color 100ms ease;
}
.xxx-row:hover { background: var(--bg-row-hover); }
.xxx-row:focus-visible { border-color: var(--accent); }
.xxx-row.selected {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.xxx-row.pinned {
  border-left: 3px solid var(--accent);
  padding-left: 12px;          /* 補回 border 吃掉的 1px */
}
```

範例:`.session-row`、`.message-row`(後者用 `border-left: 3px solid var(--accent|--high)` 區分 user/assistant)。

### 3.2 Pill(角色標記)— 短文字、強對比、大圓角

```css
.role-pill {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-elev);
  color: var(--text);
}
.role-pill.role-user      { background: var(--accent-soft); color: var(--accent); }
.role-pill.role-assistant { background: var(--warm-soft);   color: var(--warm); }
.role-pill.role-side      { background: var(--low-soft);    color: var(--low); }
```

**規則**:Pill 永遠是「半透明背景色 + 同色相文字」組合,不外加邊框。

### 3.3 Badge(分支標記)— 含邊框、可分信心等級

```css
.branch-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: var(--bg-elev);
  color: var(--text);
}
.branch-badge .branch-name { font-family: var(--font-mono); }
.branch-badge.confidence-high {
  background: var(--high-soft);
  border-color: var(--high);
  color: var(--high);
}
.branch-badge.confidence-low {
  background: var(--low-soft);
  border-color: rgba(250,204,21,0.4);   /* 注意:邊框是降飽和的黃,非 --low 本色 */
  color: var(--low);
}
```

**Badge 與 Pill 差別**:Badge 有邊框、適合多狀態切換(高/低/無);Pill 無邊框、純文字角色標。**不要混用**。

### 3.4 圖示按鈕(icon button)— hover-only 操作

```css
.xxx-icon-btn {
  width: 24-26px; height: 24-26px;       /* 列內小按鈕 24,獨立 26 */
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-mute);
  opacity: 0;                             /* 預設隱藏 */
  transition: opacity 100ms ease, background 100ms ease, color 100ms ease;
}
.parent:hover .xxx-icon-btn,
.parent:focus-within .xxx-icon-btn { opacity: 1; }
.xxx-icon-btn:hover { background: var(--bg-row-hover); color: var(--text); }
.xxx-icon-btn.active { opacity: 1; color: var(--accent); }
.xxx-icon-btn:focus-visible {
  opacity: 1;
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}
```

**規則**:icon button 預設 `opacity: 0`,靠父元件 hover/focus-within 顯示。`.active`(已啟用 — 例如已 pin)時 opacity 強制 1。

### 3.5 輸入元件(input / textarea / select)

```css
.xxx-input {
  background: var(--bg-row);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12-13px;
}
.xxx-input:focus { outline: none; border-color: var(--accent); }
.xxx-input::placeholder { color: var(--text-mute); }
```

**規則**:focus 一律 `border-color: var(--accent)` + `outline: none`,不用瀏覽器預設 outline。等寬欄位(path、code、id)額外加 `font-family: var(--font-mono)`。

---

## 4. 互動規格

### 4.1 Transition

| 速度 | 用途 |
|---|---|
| `100ms ease` | 列項 hover、icon button 顯隱、selected 狀態切換、border-color 變化(快速回饋優先) |
| `120ms ease` | button 一般 hover(略慢以強調可點擊性) |

**禁用**:`transition: all`、`>200ms`、cubic-bezier 客製曲線。維持 `ease` 簡單一致。

### 4.2 Focus ring

兩種寫法,看元件種類:

- **大型互動元件**(row、card):`:focus-visible` 改 `border-color: var(--accent)`,沿用元件邊框
- **小型按鈕、icon**:`:focus-visible` 加 `outline: 1px solid var(--accent); outline-offset: 1px;`

**禁用**:`outline: 2-3px`(過粗)、藍色預設 outline、不加 focus 樣式(無障礙地雷)。

### 4.3 Skeleton(載入動畫)

統一用 `skeleton-shimmer` keyframe + 三色漸層:

```css
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--bg-elev) 0%,
    var(--bg-row-hover) 50%,
    var(--bg-elev) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
}
@keyframes skeleton-shimmer {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
```

**規則**:loading state 一律用 shimmer 漸層,**不要用 spinner、dots 動畫、文字「載入中...」**(專案已建立 skeleton 語言,維持一致)。

### 4.4 Toast

固定底部置中、`var(--bg-elev)` 背景、`box-shadow: 0 4px 14px rgba(0,0,0,0.4)`。**不用顏色區分 success/error**,文字本身已說明 — 與配色語言保持低調。

---

## 5. 動手前 checklist

改 UI 前自問:

- [ ] 我要的顏色是不是現成 token 之一?如果不是,值得進 `:root` 變新 token 嗎(會跨多元件使用嗎)?如果只用一次 — 重新審視,大概率不必加
- [ ] 我要用的 `font-weight` 是 400 或 700 嗎?如果不是,改回 400/700
- [ ] 我要做的元件結構與既有 row / pill / badge / icon-btn 哪個最接近?能否複用 class 而非另起新名?
- [ ] hover / selected / pinned / focus 狀態都寫了嗎?每個互動元件四個狀態缺一不可
- [ ] transition 是 100-120ms `ease` 嗎?

通過再動手。
