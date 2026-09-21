# Phase 8：Deterministic Validation 與權威探索狀態

這一階段像裁判接過翻譯員的表格。裁判只接受明確、可驗證的工程動作，通過後才更新唯一有效的記分板。翻譯員與玩家文字都不能直接改記分板。

## 權威管線

`player text` → Phase 7 `CandidateAction` → Phase 8 deterministic validation → 已驗證 domain command → `applyCommand` → authoritative `GameState` → structured result。

Phase 7 的 `/api/interpret` 仍只解析。Phase 8 的 `POST /api/exploration/actions` 接受玩家文字與 `expectedRevision`，由後端自行呼叫 interpreter。Frontend 不能提交 candidate、command、成功結果、新位置、HP 或 revision 增量。

## 最小狀態與 TEST fixture

`GameState.exploration` 只新增：

- `locationId`：`TEST-forest-edge` 或 `TEST-ruin-entrance`。
- `lastObservationTargetId`：`TEST-stone-door` 或 `null`。

這些全部是工程 fixture，不是 canonical 地圖、場景或世界設定。沒有座標、完整地圖、時間、NPC、物品、任務或戰鬥狀態。

固定合法流程：

1. 位於 `TEST-forest-edge` 時，candidate `move` 的目標文字必須恰好是「森林裡的廢墟」，deterministic resolver 才會產生 `approach-target / TEST-ruin-entrance`。
2. 位於 `TEST-ruin-entrance` 時，candidate `inspect` 的目標文字必須恰好是「門上的符號」，resolver 才會產生 `inspect-target / TEST-stone-door`。
3. 成功命令使 revision 加一，回傳 `location-changed` 或 `target-inspected`。結果是機械資料，不是敘事。

直接把 `TEST-ruin-entrance`、任意字串或 `final-boss-room` 放進 candidate target 都不會成為 ID。`manner` 和 `originalText` 不參與權威狀態寫入。

## 拒絕規則

| 情況 | 結果 |
|---|---|
| candidate 欄位錯誤或含額外欄位 | `invalid-candidate` |
| `clarification-needed` | `clarification-required` |
| Phase 8 未支援的種類或 Phase 7 `unsupported` | `unsupported-action` |
| 目前位置無法唯一對應目標 | `target-not-found` |
| `expectedRevision` 已過期 | HTTP 409／`stale-revision` |
| `activity` 是戰鬥中 | `action-not-allowed` |
| revision 已達工程上限 | `revision-limit` |

所有拒絕都不增加 revision。Domain command 同樣採 exact-field runtime validation；即使 application 層被繞過，也不能帶入額外 `hp`、`location`、`success` 或 `revision` 欄位。

## API 與 UI

- `GET /api/exploration/state`：只回傳 revision、TEST 位置、最近觀察標記及目前保存方式。
- `POST /api/exploration/actions`：完整執行解析、驗證與 transition，回傳 candidate、權威裁定及更新後摘要。
- 回應使用 `Cache-Control: no-store`。請求與回應均有 runtime validation；錯誤不回傳 SQL、連線資訊、stack、模型 prompt 或供應商內容。
- UI 分別標示「候選解析（固定測試）」與「系統裁定（權威）」，另有小型 Phase 8 工程狀態摘要。它不是正式角色 HUD。

## Persistence

預設 `npm run dev` 使用單一 API 程序內的記憶體 session：瀏覽器重新整理不會重設權威狀態，API 重啟會重設。

設定 `DOMAIN_STORAGE=postgres` 時，沿用 Phase 4 `GameStateRepository`、`game_states` JSONB snapshot 與條件式 revision 更新。無須新增 migration。舊 Phase 4 snapshot 缺少 `exploration` 時，PostgreSQL adapter 會在 hydrate 邊界補上初始 TEST 探索狀態，再交給完整 domain runtime validation；下一次成功更新會保存完整新 snapshot。異常 exploration 欄位仍會拒絕。

## 明確留待後續

- Phase 9：把已確定的 structured result 交給 LLM 產生探索敘述；LLM 仍不能修改結果。
- 正式 LLM provider、完整探索分類、正式地點與目標、地圖、技能檢定、擲骰、背包、NPC、任務、戰鬥及 save/load UI 都不在本階段。

完整手動測試見 [README](../../README.md#phase-8權威探索裁定手動測試)。Phase 8 等待使用者手動確認；不得自動進入 Phase 9。

## 工程檢查

- `npm run typecheck`：通過。
- `npm run build`：通過，包括 Vite frontend 與 TypeScript server build。
- `npm test`：48 項中 47 項通過；需明確提供隔離 `TEST_DATABASE_URL` 的 PostgreSQL integration test 略過。Snapshot hydration、異常 exploration snapshot、optimistic concurrency 契約與安全錯誤仍由不需資料庫的測試涵蓋。
- `git diff --check`：通過。

這些是工程檢查，不代表玩法、介面或手動驗收通過。
