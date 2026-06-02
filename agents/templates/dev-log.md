# Dev-log 範本

每日開發日誌。檔名格式:`YYYY-MM-DD.md`,例如 `2026-06-02.md`。

用途:未來 session(AI 或人)接手時,30 秒內看懂「昨天做到哪、為什麼、下一步」。

---

## 使用方式

- 一天一檔,commit / push 前更新
- **6 個固定區塊**,沒事可寫的區塊寫「無」不要刪欄位(格式穩定方便快速掃讀)
- 寫的是「為什麼這樣決定」與「卡在哪」,不是 commit log 的逐字翻譯
- **AI 與使用者的 Q&A 一定要記** — 未來 session 才能回推「為什麼當時選 B 而不選 A 或 C」

---

## 範本骨架

```markdown
# YYYY-MM-DD

## 完成
- 做了什麼(一行描述 + 對應 commit hash 或 task 連結)
- 重點放「使用者 / 系統現在多了什麼能力」,不是「改了哪幾行」

## 進行中
- 開了頭但今天沒做完的事,含「卡在哪個步驟」
- 若無,寫「無」

## 詢問與裁決(AI ↔ 使用者)
- 記錄 AI 主動諮詢使用者的決策點,回推用
- 格式:
  - **Q**:AI 提出的問題 + 列出的選項 / 取捨
  - **A**:使用者的選擇 + 理由(理由比選擇本身更重要)
- 若無,寫「無」

## 決策 / 取捨
- 開發者自行做的非顯而易見選擇 + 為什麼(沒問 AI 也沒被 AI 問)
- 例:「為了避開 X 改用 Y,理由是 Z」
- 若無,寫「無」

## 卡點 / 待解
- 還沒想通、要查資料、要問人的事
- 若無,寫「無」

## 下一步
- 明天 / 下個 session 第一件事該做什麼
- 寫得越具體越好(「修 useOrderList 裡的 race condition」勝過「繼續做訂單模組」)
```

---

## 完整範例(claude-branch-map 情境)

```markdown
# 2026-06-02

## 完成
- 補上 agents/ 知識庫(README、conventions、templates、planning、dev-logs)(commit `__待補__`)
- CLAUDE.md 開頭加一段「先讀 agents/README.md」
- 寫 docs/optimization-plan.md,把前一輪列的 11 個流程/畫面優化點轉成可動工的 brief

## 進行中
- 流程優化第一輪(錯誤訊息分類 / Cursor 支援 / 移除 1500ms 寫死延遲)還沒動工
  - 卡在:要等 brief 對齊後才開實作

## 詢問與裁決(AI ↔ 使用者)
- **Q**:agent-template 全套搬還是精選?(精選 / 完整 / 最小三選一)
- **A**:精選版。理由:claude-branch-map 是 Electron 三層架構,跟模板的 Vue + Firebase 多 domain 風格差距大,完整搬會多出用不到的 architecture / barrel file 規範,反而干擾。
- **Q**:CLAUDE.md 怎麼整合 agents/?(保留 / 重寫 / 不動)
- **A**:保留現有 CLAUDE.md + 開頭加引導。理由:既有 Electron 三層細節都在 CLAUDE.md,重寫一份等於同步成本翻倍。
- **Q**:優化規格寫多細?(完整 / 簡版 / Top 3)
- **A**:完整規格。理由:這份本來就是要當 task brief 用,簡版到時候還要再展開。

## 決策 / 取捨
- 不照搬 architecture.md(上游模板的 Vue + Firebase 模組化架構)— 改在 CLAUDE.md 的「1. 專案總覽與架構」一節提到 Electron 三層即可
- 不照搬 jsdoc-format / ui-design.md — 專案沒到需要強制 JSDoc 與 design token 的規模

## 卡點 / 待解
- 是否要把 .claude/agents/ 內三個子代理的呼叫時機寫進 dev-workflow.md?目前只有摘要

## 下一步
- 對 docs/optimization-plan.md 跟使用者對齊 Top 3 優先
- 動工第一個 task:錯誤訊息分類(對應 plan 中 #1)
```
