# Phase 26 審查缺陷修正

日期：2026-09-30。H1／M1／M2／L1 的工程修正完成；等待使用者手動驗收，Phase 27 未開始。設計仍以 [已接受規格](PHASE_26_FINAL_SPEC.md) 為準。

## 重現與修正

先新增回歸測試，四項在修改前全部失敗，才修改程式。L1 原報告屬靜態推斷，本次已實際重現。

| 項目 | 修改前的實際結果 | 修正後與邊界 |
|---|---|---|
| H1：玩家詠唱中全滅敵人 | 最後一次傷害回 500 combat-failed，卡在 active | 集中生命轉換與逃跑成功的 ended 分支清除詠唱；不退款。勝利回 200，Combat MP 18/24；繼續後 Persistent MP 18/24，下場同樣 18/24 |
| M1：已知舊 TEST ended 快照仍有詠唱 | GET 回 500 state-invalid | 在缺少 Phase 26 資料的版本映射內，先驗證全部舊資料與詠唱進度，再清除詠唱。MP／revision 保留；首次持久化後 CombatId／generation 穩定 |
| M2：單槽映射受阻拖垮清單 | GET save-slots 回 422，UI 無法選健康槽 | 清單回 200，逐槽回報 loadable=false、issue、中文原因；健康槽照常 Load。受阻槽不顯示載入按鈕，原資料不改。直接 Load 該槽仍回 422 |
| L1：v2 注入未知 legacy-unplaced | Load 回 200，新增到身分帳 | Load 的權威替換邊界拒絕身分帳未建立的 legacy 條目，回 422 invalid-save，live state 完全不變。既有合法 legacy 條目仍可 Save／Load |

M1 使用 Phase 25 欄位形狀的測試快照：缺少 phase26／lifecycle／Participant MP，ended victory 仍帶合法詠唱，玩家舊 MP 為 18。測試同時經 PostgreSQL 實際資料列與 API hydrate；沒有聲稱重新運行 Phase 25 舊程式。

沒有放寬新版 ended 驗證，也不替未知角色猜測規則。異常詠唱 MP、失效 actor、未知 roster、混入新版 Participant resource 的舊快照仍拒絕。新版 ended 搭配詠唱仍拒絕。

## 修改範圍

- `src/domain/combat.ts`：ended 時清除 activeCastings，不改已付 MP。
- `src/domain/combat-state.ts`、`src/domain/game.ts`：已知 TEST 的舊詠唱映射與 Load 的 legacy 身分來源檢查。
- `src/server/save-game/service.ts`、`src/shared/save-game.ts`：受阻存檔的逐槽回應與 runtime contract；成功 Save／Load 回應仍只接受健康槽。
- `src/web/SaveSlotsPanel.tsx`：顯示單槽失敗原因，保留其他槽的載入操作；覆蓋仍須確認。
- `tests/phase26-review-regressions.test.ts`：新增 9 項測試，包含 3 項真實 PostgreSQL 測試，每項使用獨立隨機 schema。
- `tests/helpers/phase26-manual-fixture.mjs`：新增 casting-victory，詠唱仍存在時擊殺敵人，停在結果頁。
- `tests/helpers/phase26-casting-restart-check.mjs`：真實 HTTP 與三次 API 程序重啟，涵蓋 MP、Save／Load 與下一場 Start。
- `tests/helpers/phase26-mixed-slots-fixture.mjs`：只在指定隔離 DB 的空槽建立健康 v2／受阻 v1；已有資料時 rollback，不覆蓋。
- README、階段計畫、實作對照、驗證與手動文件：更新證據及重測入口；沒有改動已接受規格或 Canon 索引。

## 實際工程結果

| 檢查 | 結果 |
|---|---|
| 修正前新增四項回歸 | 0 通過、4 失敗；H1 500、M1 500、M2 422、L1 錯誤接受 200 |
| 修正後新增回歸，接隔離 PostgreSQL | 9/9 通過、0 略過 |
| 全套，無 DB | 312 項；288 通過、0 失敗、24 略過 |
| 全套，隔離 PostgreSQL | 312/312 通過、0 失敗、0 略過 |
| npm run typecheck、npm run build | 通過 |
| 隔離 DB 全新 migration／套用後 dry-run | 三份既有 migration 成功；再檢查為 No migrations to run! |
| git diff --check | 通過 |
| 詠唱勝利實際 HTTP／三次重啟 | 通過；MP 不退款，Load 保留 CombatId，下一場 MP 18/24 |
| 原有結果頁／History／Load replay 三次重啟 | 通過；ended revision 17、Settlement 18、replay 20、high-water 4 |
| 混合槽情境產生器 | 空槽建立成功；再次執行安全拒絕，原資料不變 |

使用 PostgreSQL 15.19，專用 cluster `/private/tmp/ai-trpg-phase26-pg`，`phase26_test@127.0.0.1:55426`。全套與重啟使用 `ai_trpg_phase26_review_test`；混合槽產生器使用 `ai_trpg_phase26_review_slots`。沒有使用正式 DATABASE_URL，沒有新增 migration，沒有 commit／push。

詠唱重啟實際輸出：

```json
{"passed":true,"processRestarts":3,"endedRevision":7,"settlementRevision":8,"loadedRevision":9,"nextStartRevision":11,"combatMp":18,"persistentMp":18,"nextCombatMp":18,"refund":false,"combatIdPreservedOnLoad":true}
```

## 舊存檔與手動邊界

已知 TEST v1 Save 保留原列、照常映射。已知 TEST 的舊 ended 詠唱快照現在可讀回並結算，不回滿 MP。正式／未知 v1 Save 仍 migration-blocked，但不再阻擋其他健康槽。v2 不接受新增來源不明的 legacy 身分；既有合法 legacy 保存與載入測試通過。

手機版面、鍵盤／焦點、節奏、按鈕實際連點與敘事體驗仍由使用者判斷。[手動清單第一步](PHASE_26_SETTLEMENT_ACCEPTANCE.md) 現在先測詠唱勝利，再按繼續與確認下一場 MP。

## 證據與重跑

暫存輸出：`/private/tmp/phase26-review-red.log`、`phase26-review-memory-tests.log`、`phase26-review-postgres-tests.log`、`phase26-review-build.log`、`phase26-review-migration-dry.log`、`phase26-review-casting-restart.log`、`phase26-review-original-restart.log`。暫存檔可能由系統清除，實際結論已記錄於本文件。

```sh
npm test
TEST_DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_review_test npm test
npm run typecheck
npm run build
TEST_DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_review_test node tests/helpers/phase26-casting-restart-check.mjs
```

重啟腳本會 Reset 指定 TEST 世界並使用 Slot 1；重跑必須使用專用隔離 DB。工程成功不代表 Phase 26 已被使用者接受。
