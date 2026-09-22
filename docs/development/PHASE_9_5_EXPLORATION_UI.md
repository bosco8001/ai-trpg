# Phase 9.5：Exploration UI Alignment

> Phase 9 已由使用者手動確認。Phase 9.5 等待使用者手動確認；不得開始 Phase 10。

這一階段像整理冒險桌面：故事放在中間，五張可點選的建議放在下方，旁邊保留幾個未來才會裝內容的抽屜。它只調整 React presentation 與 interaction，不新增遊戲規則。

## 正式探索頁結構

1. 低調頁首與 API 連線狀態。
2. 主要故事紀錄：固定場景、玩家文字、候選解析、權威裁定與探索敘事。
3. 保留的 Phase 8 工程測試狀態摘要。
4. 五個固定測試建議。
5. 緊湊的圓形工具列：行動、背包、裝備、隊伍、系統。
6. 預設收起的自由輸入區。
7. 從右側開啟的 placeholder 工具面板。

## Suggested action contract

`SuggestedAction` 只有：

```ts
{
  id: string;
  text: string;
}
```

沒有 command、target ID、成功旗標、HP、revision、location 或其他 authoritative 欄位。按鈕只把 `text` 送往既有 `POST /api/exploration/actions`：

`text` → Phase 7 candidate → Phase 8 deterministic validation／state transition → Phase 9 narration。

因此系統提供的文字不會取得特權。第一組在 `TEST-forest-edge` 的首項可移動到 `TEST-ruin-entrance`；移動成功後下一組的首項可合法觀察 `TEST-stone-door`。其他固定句用來測試既有的拒絕、澄清與未支援路徑。它們全是 engineering fixture，不是正式探索內容或 gameplay taxonomy。

## 自由輸入

自由輸入預設收起。按「行動」才會展開，並把焦點放到 textarea。

Enter 送出、Shift+Enter 換行。成功送出時只清空文字，**不會收起輸入區**；只有使用者明確按「收起」才會關閉。這讓玩家可以連續輸入，也不改變既有 action pipeline。

## 工具面板

背包、裝備、隊伍與系統從右側以 dialog 形式開啟。桌面維持 compact side panel；手機寬度改為接近全寬。每個面板目前只顯示清楚的 placeholder：

- 背包：沒有 inventory、item use、loot、經濟或 persistence。
- 裝備：只有 placeholder slot，沒有 equip rule、屬性或戰鬥計算。
- 隊伍：沒有代行者、招募、隊友戰術或隊伍 persistence。
- 系統：只保留「Save / Load：尚未接入（Phase 10）」與顯示設定的位置。

面板可由 ×、Escape 或背景遮罩關閉。開啟時焦點移到關閉按鈕，關閉後回到原本的工具按鈕；Tab 保留在面板內。工具面板不呼叫 API，也不讀寫 `GameState` 或 PostgreSQL。

## Responsive 與可及性

- 建議在 desktop 為兩欄，第五項跨欄；約 375px 改成單欄。
- 工具列保留 icon 與繁體中文 label，每個圖示使用同一套 inline SVG stroke style，且圖示對輔助技術隱藏。
- 按鈕保留語意名稱、可見 focus ring、touch feedback 與至少 48px 的圓形圖示觸控區。
- 畫面不靠 hover 或顏色單獨傳達功能；disabled 與 loading 仍有文字與語意提示。
- 只使用 transform／opacity 的 drawer entry motion；`prefers-reduced-motion` 會移除動畫。

本階段參考 `ui-ux-pro-max` 的 touch spacing、icon accessible name、React focus management、modal Escape 與 mobile-first guidance；未採用其不符合既有設計的 SaaS／neon／cyberpunk style 建議。

## 未實作

Phase 10 Save / Load、正式 inventory／equipment／party system、system settings backend、LLM-generated suggestions、conversation persistence、combat、map、NPC、quests、RAG、streaming 與 tool calling 都不在本階段。

完整手動測試步驟見 [README](../../README.md#phase-95探索頁-ui-alignment-手動測試)。
