# Phase 10：Manual Save / Load

> Phase 1–11 已由使用者手動確認。Phase 12 已完成工程實作並等待使用者手動確認；Phase 10 不再是待驗收項目。

這一階段像拍下正式記分板的照片，再於需要時把照片內容重新寫到現在的記分板。拍照不改變比賽，所以 Save 不增加 revision；Load 是新的正式變更，所以只從目前 live revision 往前增加一次。

## 責任邊界

Save / Load 是 system operation：

```text
System panel
→ Save / Load API
→ SaveGameService
→ GameStateSession + SaveGameRepository
→ authoritative GameState / versioned snapshot
→ UI
```

它不經 Phase 7 interpretation、Phase 8 exploration action validation 或 Phase 9 narration，也不呼叫 LLM。Frontend 只送出 slot ID 與 `expectedRevision`；snapshot、時間及載入後的 state 全由 backend 決定。

## 三個手動存檔槽

第一版固定支援 Slot 1、2、3。空槽可儲存；已佔用的槽可在 UI 明確確認後覆蓋；載入任何已佔用存檔前也要確認。這是目前單一工程 GameState 的最小設計，沒有帳號、campaign 或 character selection。

## Revision 規則

Save 只讀取並保存目前權威內容：

```text
Save：revision 2 → revision 2
```

Load 先以 `expectedRevision` 檢查目前狀態，再用 snapshot 的內容取代目前權威內容：

```text
目前 live revision = 5
存檔 sourceRevision = 2
Load 成功後 live revision = 6
```

`sourceRevision` 只記錄 snapshot 來源。它不會重新成為 live revision。stale Save／Load、空槽、損壞 snapshot、不支援格式、repository failure 或 revision 上限都不修改 current state，也不增加 revision。

## Save Format v1

Application contract：

```ts
{
  formatVersion: 1;
  sourceRevision: number;
  state: {
    activity: GameState["activity"];
    character: GameState["character"];
    exploration: GameState["exploration"];
  };
}
```

Restorable `state` 刻意不含 live `revision`。資料庫讀回的 metadata 與 snapshot 都視為不可信資料；必須檢查 slot、format version、source revision、時間與完整 GameState 結構。未知版本只回安全的「此存檔版本目前無法讀取」，目前沒有虛構 v0／v2 migration。

## PostgreSQL schema

`migrations/002_save_slots.mjs` 新增 `save_slots`：

- `slot_id`：只允許 1–3。
- `format_version`：目前寫入 1。
- `source_revision`：snapshot 來源版本。
- `snapshot`：不含 live revision 的 authoritative GameState 內容，使用 JSONB。
- `saved_at`：由 PostgreSQL `CURRENT_TIMESTAMP` 產生的 `timestamptz`。

舊的 `001_game_states.mjs` 沒有修改。PostgreSQL Save 使用條件式 SQL 確認 `game_states.revision` 仍等於 `expectedRevision` 才寫入；Load 使用既有 `GameStateRepository.saveIfRevision` 條件式更新 current state。

## API

- `GET /api/save-slots`：只列出三槽的安全 metadata，不回傳 snapshot。
- `PUT /api/save-slots/:slotId`：body 必須精確為 `{ "expectedRevision": number }`。
- `POST /api/save-slots/:slotId/load`：body 必須精確為 `{ "expectedRevision": number }`。

所有 route 使用 `Cache-Control: no-store`。Slot 只接受 1、2、3，request body 限制為 1024 bytes。Frontend 不能提交 state、location、HP、snapshot、timestamp 或 new revision。

## UI 與 history

Phase 9.5 的系統 drawer 現在顯示三個存檔槽、metadata、覆蓋確認與載入確認。操作期間會停用其他存檔按鈕，避免重複送出。

Load 成功後，Frontend 直接使用 server 回傳的 authoritative state 更新 location、observation marker、revision 與建議 fixture。舊的 local exploration history 會清除，只保留最小 TEST 場景及 deterministic 系統訊息。Narration、candidate、輸入文字、drawer 狀態與五個建議本身都不在存檔格式內。

## Storage mode

- `DOMAIN_STORAGE=memory`：GameState 與三個存檔槽都在 API 程序記憶體內，重啟後消失。
- `DOMAIN_STORAGE=postgres`：GameState 與三個存檔槽保存至 PostgreSQL，完成 migration 後可跨 API restart 讀回。

PostgreSQL integration test 只在明確提供隔離 `TEST_DATABASE_URL` 且已執行全部 migration 時運行，避免破壞一般本機資料。

## 尚未處理

本階段沒有 autosave、quicksave、刪除、匯出／匯入、cloud save、多 campaign、帳號、縮圖、conversation／narration history persistence、正式 LLM provider、正式 inventory／equipment／party 或 combat。Phase 11 加入 CombatState 後，戰鬥中的 Save／Load 暫時由工程防護拒絕；是否正式允許仍未定案，Save Format v1 的意義沒有改變。

完整手動測試步驟見 [README](../../README.md#phase-10manual-save--load-手動測試)。
