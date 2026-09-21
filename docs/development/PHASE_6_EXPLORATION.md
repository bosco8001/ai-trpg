# Phase 6：第一個文字探索介面

> Phase 6 已由使用者手動確認。本文件描述當時交付的介面基礎；目前 Phase 7 已在其上加入固定候選解析，請參閱 [Phase 7 文件](PHASE_7_INTERPRETATION.md)。

這個階段像先把冒險桌上的故事紙、紀錄欄與筆準備好。玩家可寫下行動並看見它加入畫面，但系統還沒有判斷文字意思。

## 範圍

探索紀錄存在 frontend local UI state。初始訊息與送出後回覆都是清楚標示的 `TEST`／介面測試資料，不是正式世界設定、事件或敘事結果。重新整理頁面會清空本階段新增的紀錄。

目前送出輸入只會：

1. 拒絕空白文字。
2. 把玩家文字加入畫面紀錄。
3. 加入固定的介面測試回覆。
4. 清空輸入框並保留鍵盤焦點。

這個流程不呼叫 LLM、不建立 action candidate、不讀寫 PostgreSQL、不改變 `GameState`，也不會移動角色、改變 HP／MP、背包或戰鬥狀態。自然語言 interpretation 留待 Phase 7；domain validation／state update 留待 Phase 8；探索敘事 LLM integration 留待 Phase 9。

## UI 結構

| 區域 | 用途 |
|---|---|
| 頁首 | 顯示探索模式與低調的 API 連線狀態；可重新檢查服務。 |
| 故事紀錄 | 依文字 label、邊線與字體區分測試場景、玩家行動與系統回覆，不使用聊天泡泡。 |
| 行動輸入 | 原生多行 `textarea`、可見 label、說明文字與送出按鈕。 |

送出時，使用者剛在輸入區操作，因此畫面只把新紀錄捲至容易看到的位置。這不是無限 history、虛擬清單或持久化機制。

## 互動與可及性

- Enter 送出；Shift+Enter 換行。
- 空白輸入的按鈕停用，不會新增紀錄。
- 按鈕與 textarea 使用既有語意 tokens、可見焦點環及 reduced-motion 設定。
- 行動輸入與送出按鈕在手機維持至少 48px 高度，頁面保留安全區間距。
- history 更新不使用 live region；只有簡短的送出結果狀態會禮貌播報，避免重複朗讀整段故事。
- 故事區採自然頁面捲動，不建立互相衝突的巢狀捲動區。

## 手動測試

完整步驟見 [README](../../README.md#phase-6文字探索介面手動測試)。可測試桌面、約 375px 手機寬度、Enter／Shift+Enter、Tab 焦點、200% zoom、減少動態效果，以及 API 離線時仍可進行本機文字紀錄。

## 工程檢查

- `npm run typecheck`：通過。
- `npm test`：28 項中 27 項通過；既有 PostgreSQL integration test 只在明確提供隔離資料庫時執行。
- `npm run build`：通過。

本階段完成後等待使用者手動確認。下一階段是 Phase 7：自然語言 action interpretation。
