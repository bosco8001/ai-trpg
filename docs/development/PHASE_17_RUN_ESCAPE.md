# Phase 17：逃跑行動

> Phase 1–16 已由使用者確認。Phase 17 工程實作完成，等待使用者手動確認。Phase 18 尚未開始。

## 權威規則與工程邊界

依 canonical [戰鬥規則](../gameplay/combat_system.md)、[種族](../world/races.md)與[戰鬥介面](../gameplay/combat_ui.md)：逃跑消耗一個主要行動。後端擲 D20，計算 `D20 + 敏捷修正 + 種族逃跑修正`；一般 DC 為 8，總值大於或等於 8 成功。一般修正 0，龍裔額外 −2。TEST 玩家沿用 participant 敏捷 +2，種族修正 0；沒有改成龍裔。Domain 測試以相同 D20 7、敏捷 +2 證明一般總值 9 成功、龍裔總值 7 失敗。

成功立即結束戰鬥：`combat.status = ended`、`endReason = escaped`、`currentActorId = null`、`currentTurnIndex = null`，並保存 `lastAction = run`。成功不推進 Turn。失敗保存失敗裁定、消耗 Turn、沿用既有回合推進，`status` 保持 `active`。兩種結果各只增加一次 GameState revision。`run` 裁定保存 actor、行動時 Round、原始 D20、敏捷修正、種族修正、總值、DC 8 與成功／失敗。

逃跑成功後 `activity` 仍為 `in-combat`，不清除 CombatState，不變更探索位置、觀察、背包或角色。這是未結算的終止戰鬥；Phase 26 才處理正式結算與返回探索。Save／Load 的 `combat-not-supported` 防護持續適用。沒有追逐、Boss／包圍／封閉環境特例、敵人逃跑 AI、獎勵或 LLM 敘事。

舊 Phase 11–16 CombatState 沒有 `status`／`endReason` 時，驗證層會讀為 active。新的 ended 狀態必須有 `escaped` 與成功的 `run` 裁定，且沒有目前可行動者。戰鬥結束後所有正式行動與 TEST advance 都由後端拒絕。PostgreSQL 直接以現有 JSONB snapshot 保存 lifecycle、end reason、完整裁定與 revision，不需 migration。

## API 與測試骰

`POST /api/combat/run` request 精確只有：

~~~json
{"expectedRevision":2}
~~~

後端從目前 CombatState 決定 actor，只允許目前可操作的我方角色。任何 `actorId`、`targetId`、`roll`、`dc`、`success`、`dexterityModifier`、`racialModifier` 或其他額外欄位均拒絕。舊 revision 回 `409 stale-revision`。骰值由後端的獨立 injectable D20 來源產生；測試模式 `COMBAT_ESCAPE_ROLL_FIXTURE_MODE=success` 固定 D20 8，`failure` 固定 D20 3。正式服務不啟用 fixture 變數。

## 手動測試：失敗

停止舊服務，啟動記憶體測試：

~~~sh
DOMAIN_STORAGE=memory \
COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal \
COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
COMBAT_ESCAPE_ROLL_FIXTURE_MODE=failure \
NARRATION_FIXTURE_MODE=normal \
npm run dev
~~~

在另一終端機開始測試戰鬥：

~~~sh
curl -s http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":0}'
~~~

刷新瀏覽器，再按「TEST：推進下一回合」到 TEST 玩家／revision 2。確認敵方回合「逃跑」停用，玩家回合啟用。第一次按「逃跑」只開確認，revision 仍為 2。按「取消」後再 GET `/api/game-state`，actor、revision、lastAction 不變，焦點返回逃跑按鈕。

再次按「逃跑」→「確認逃跑」。畫面應顯示 `逃跑判定：3 + 2 = 5`、`目標：8`、`結果：逃跑失敗`。GET `/api/game-state` 應為 `status = active`、revision 3、目前 TEST 敵人 2，最近裁定保存上述數值。不應產生敘事。

## 手動測試：成功與終止

停止記憶體服務，改用 `COMBAT_ESCAPE_ROLL_FIXTURE_MODE=success` 重啟，其餘變數相同。重新 start 並 advance 到 TEST 玩家／revision 2；按「逃跑」→「確認逃跑」。畫面應顯示 `逃跑判定：8 + 2 = 10`、`目標：8`、`結果：逃跑成功`，以及「戰鬥已結束」「戰鬥結算與返回探索尚未接入」。GET `/api/game-state` 應為 `status = ended`、`endReason = escaped`、revision 3、`currentActorId = null`、成功的 `run` lastAction。不能自動看到下一個敵方 Turn，也不能切回探索。所有戰鬥指令與 TEST advance 停用。刷新瀏覽器後這些狀態仍應保持。

成功後用 API 確認後端也拒絕行動：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/defend \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":3}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":3}'
~~~

兩者應回 `409 combat-ended`，revision 保持 3。普通攻擊、移動、物品使用與再次逃跑也應被拒絕。

在新的玩家 Turn／revision 2 測試舊版本與注入：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/run \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":1}'
curl -i http://127.0.0.1:3001/api/combat/run \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":2,"dc":1,"success":true}'
~~~

第一個應回 `409 stale-revision`，第二個應回 `400 invalid-command`；兩次都不擲骰、不修改狀態。

## PostgreSQL 重啟

僅使用沒有重要資料的本機測試狀態。依 Phase 4 設定 `.env` 後：

~~~sh
docker compose up -d db
docker compose ps
npm run db:migrate
~~~

以 `DOMAIN_STORAGE=postgres`、`COMBAT_SANDBOX=1`、`COMBAT_ESCAPE_ROLL_FIXTURE_MODE=success` 及上述其他 fixture 變數啟動 API。先 GET `/api/game-state`，不要假設 revision 0；選用乾淨可測的狀態完成成功逃跑。記下 status、endReason、run 原始骰值、兩個修正、總值、DC、outcome 與 revision。停止 API，但不要刪除 volume；重新啟動後再 GET，全部欄位應保持。

## 手機與鍵盤

約 375px 寬確認逃跑按鈕、確認區、失敗結果與成功終止畫面清楚易讀，無水平捲動。用 Tab／Enter 開啟確認並操作確認或取消；焦點清楚，取消後返回逃跑按鈕。成功後停用的指令不應看似可以操作。

## 工程檢查

工程檢查結果見 [Implementation Phase Plan](IMPLEMENTATION_PLAN.md) 與本階段完成回報。自動化檢查不代表使用者的瀏覽器、手機、鍵盤或 PostgreSQL 重啟驗收。Phase 17 等待使用者確認，Phase 18 尚未開始。
