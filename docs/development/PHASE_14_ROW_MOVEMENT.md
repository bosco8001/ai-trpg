# Phase 14：前後排換位

> Phase 1–15 已由使用者確認。Phase 16 工程實作完成，等待使用者手動驗收；Phase 17 尚未開始。

## Canonical 規則

本階段依照 [combat_system.md](../gameplay/combat_system.md) 與 [combat_ui.md](../gameplay/combat_ui.md)。Phase 13 已把 `participant.side + participant.row` 建為權威位置；Phase 14 直接更新同一個 `participant.row`。

換排是確定行動，不擲骰。成功後消耗完整主要行動並結束目前 Turn。只打開選擇介面或取消，不改狀態。主角在後排不會因此失去 melee 攻擊資格；Phase 13 的 legal-target calculation 繼續只根據敵方前排判斷。

目前沒有 row capacity、擁擠、攔截、區域控制或 opportunity attack 規則。Phase 14 不新增這些限制；未來規則仍待確認，見 [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)。

## Authoritative row 與玩家操作邊界

唯一位置資料仍是 `side: party | enemy` 與 `row: front | back`。UI 卡片直接依 `side + row` 排列；前端不先移動卡片，只有成功 action 回傳完整權威 GameState 後才換排。

Move action 使用 Phase 13 已有的 player-action boundary：current actor 必須是帶玩家普通攻擊 profile 的 party participant。實作不比對 `TEST-player` ID。敵方回合的「移動」停用，domain mutation 仍會再次拒絕敵方 actor。

## Server-derived options

唯讀 route：`GET /api/combat/row-move/options`。

Response 包含 `revision`、`currentActorId`、`currentRow`、`canPlayerAct` 與 `legalTargetRows`。前排玩家範例：

~~~json
{"revision":2,"currentActorId":"TEST-player","currentRow":"front","canPlayerAct":true,"legalTargetRows":["back"]}
~~~

Options 每次依最新 CombatState 計算，不保存進 GameState 或 PostgreSQL。敵方 actor 會回傳 `canPlayerAct: false` 與空的 `legalTargetRows`。前端只有讀到目前 revision、actor、row 都一致的玩家 options 後，才啟用「移動」。

## Move action 與 transition

Mutation route：`POST /api/combat/row-move`。Request body 精確為：

~~~json
{"expectedRevision":2,"targetRow":"back"}
~~~

Actor 一律由 `combat.currentActorId` 決定。多傳 `actorId`、`fromRow`、`round`、`currentActorId` 或其他欄位都會拒絕。Mutation 會重新讀取目前狀態並重算 legal row，不信任先前 GET 的結果。

成功 transition 會驗證 active combat、revision、玩家操作邊界與 target row，記錄 from/to row，更新 participant，保存 `lastAction`，再重用 Phase 11 回合推進 helper。最後一名 participant 行動時由同一 helper 增加 Round 並 wrap。整體 GameState revision 只增加一次。

- `front` 唯一合法目標是 `back`；`back` 唯一合法目標是 `front`。
- 同排、無效 row、stale revision、敵方回合與 no combat 都拒絕，不改 row、Turn、actor、revision 或 `lastAction`。
- 換排沒有 roller、DEX 檢定或失敗機率。
- PostgreSQL 沿用既有鎖定交易與 revision 保護；同版本競爭只會有一個 Move 成功。
- 沿用 `game_states.snapshot` JSONB，不新增 table 或 migration。

## `lastAction` union 與 UI

`CombatState.lastAction` 現在 runtime validate 兩種 discriminator：Phase 13 的 `normal-attack` 與 Phase 14 的 `row-move`。舊 attack snapshot 保留原本 D20、修正值與 hit／miss 格式；row move 只保存 `actorId`、action Round、`fromRow`、`toRow`。PostgreSQL hydration 仍接受既有 normal-attack snapshot。

最近換排行動顯示「TEST 玩家」、「我方前排 → 我方後排」與「結果：換排完成」，不產生 combat narration。攻擊最近裁定仍顯示 Attack Check、Evasion Check 與 hit／miss。

- 玩家回合且 row options 已成功讀取時，「移動」才啟用；敵方回合停用。
- 點「移動」只開啟選擇／確認模式，不送 mutation、不增加 revision。
- front 顯示「移至後排」；back 顯示「移至前排」。取消不送 mutation並還原鍵盤焦點。
- Move mode 與 attack target mode 互斥；選擇或 mutation 進行中會停用其他主要指令與 TEST advance，並防止重複送出。
- 成功時只採用 backend response 的 GameState；失敗不做 optimistic move。
- 不可用的 options／action endpoint 顯示安全繁體中文訊息，不顯示 fetch detail、stack、SQL 或內部路徑。

換排不重擲 initiative、不改 turnOrder、不改其他 participant、不影響 Phase 13 melee targeting、不呼叫 LLM 或 combat narration。active combat 的 Save／Load safeguard 保持原狀。

## 工程檢查

實際執行結果：

- `npm test`：144 項中 139 項通過、0 項失敗；5 項 PostgreSQL 整合測試因未提供隔離的 `TEST_DATABASE_URL` 而略過。
- `npm run typecheck`：通過。
- `npm run build`：通過，包含前端 Vite build 與 server TypeScript build。
- `npm run db:migrate:dry-run`：通過，顯示沒有待執行 migration。
- `git diff --check`：通過。

未執行瀏覽器／手機／鍵盤手動驗收，也未執行 PostgreSQL restart；這些步驟留給使用者確認。

## 手動測試

### Memory：Front → Back、options 與 Cancel

啟動：

~~~sh
DOMAIN_STORAGE=memory COMBAT_SANDBOX=1 COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit NARRATION_FIXTURE_MODE=normal npm run dev
~~~

開始 TEST combat：

~~~sh
curl -s http://127.0.0.1:3001/api/dev/combat/start -H 'Content-Type: application/json' -d '{"expectedRevision":0}'
~~~

刷新瀏覽器。預期 Round 1、current actor `TEST-enemy-1`、revision 1。按「TEST：推進下一回合」到 `TEST-player`，revision 2、row front。讀取 options：

~~~sh
curl -s http://127.0.0.1:3001/api/combat/row-move/options
~~~

應看到 current actor `TEST-player`、current row `front`、合法目標 `[back]`。按「移動」，應看到目前位置與「移至後排／取消」；revision 仍為 2。按「取消」後確認 row、revision、current actor 與 `lastAction` 都不變。

再次按「移動」並確認「移至後排」。預期 `TEST-player.row = back`、revision 3、current actor `TEST-enemy-2`；卡片由我方前排 lane 移至我方後排 lane。最近行動顯示「我方前排 → 我方後排」與「結果：換排完成」。刷新後確認 row、lastAction、Round、actor 與 revision 保持。

### Same-row 與 stale rejection

在 fresh Memory session、玩家 front row、revision 2 時測同排：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/row-move -H 'Content-Type: application/json' -d '{"expectedRevision":2,"targetRow":"front"}'
~~~

應回 HTTP 409、`illegal-row-move` 或等價安全錯誤，且仍是 revision 2、front row、玩家 Turn。再測 stale revision：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/row-move -H 'Content-Type: application/json' -d '{"expectedRevision":1,"targetRow":"back"}'
~~~

應回 HTTP 409、`stale-revision`，狀態仍不變。額外傳 `actorId` 或無效 `targetRow` 應以 HTTP 400 拒絕。

### Back → Front 與 back-row attack regression

從 front → back 的成功狀態開始，按 TEST advance：

1. revision 4：Round 2 / `TEST-enemy-1`。
2. 再按一次，revision 5：Round 2 / `TEST-player`，row 仍是 back。
3. 按「移動」應顯示「移至前排」。確認後預期 row front、revision 6、current actor `TEST-enemy-2`。

另開一個 fresh Memory combat，完成 front → back，再 advance 到下一個玩家 Turn。此時 `GET /api/combat/normal-attack/options` 應維持 Phase 13 結果：TEST 敵人 1 front 合法、TEST 敵人 2 back 因敵方 front occupied 而受阻。玩家自己的 back row 不增加攻擊限制。以 TEST 敵人 1 攻擊，確認 normal-attack 最近裁定仍顯示 attack／evasion 與 hit／miss。

### PostgreSQL restart

只用沒有重要資料的本機測試資料庫；有既有 snapshot 時先讀 activity 與 revision，不要假設 revision 為 0，也不要刪除 volume。

~~~sh
docker compose up -d db
docker compose ps
npm run db:migrate
~~~

使用 `DOMAIN_STORAGE=postgres`、`COMBAT_SANDBOX=1` 與前述 fixture 變數啟動 API。在可開始 combat 的測試狀態完成一次 front → back，記下 row、lastAction、Round、current actor 與 revision。停止 API，再用相同設定重啟；重新 GET 後全部欄位應保持。預期沒有新 migration。

### Mobile、keyboard 與 backend unavailable

約 375px 寬度：移動／確認／取消容易點；卡片換排後不 overflow；最近行動可讀；整頁沒有水平捲動。

鍵盤：Tab 到「移動」並按 Enter；Tab 到「移至後排」並按 Enter。另一次進入選擇後 Tab 到「取消」並按 Enter，確認焦點返回移動按鈕、revision 不變。所有焦點都清楚可見。

可先開啟 Move mode 再停止 backend，之後確認移動。請確認畫面顯示安全繁體中文錯誤，卡片仍在原排，revision／actor 沒有被 UI 假裝更新；不得顯示 raw fetch、stack、SQL 或內部路徑。若 options 載入失敗，「移動」保持停用並可重新載入選項。

## Intentionally deferred

本階段不做 damage、HP、技能、AI、距離、opportunity attack、攔截、row capacity、movement check、後排近戰限制、攻擊 bonus／penalty、敵人／隊友 AI、敘事、動畫、死亡、勝敗、結算、戰鬥 Save／Load 政策或 LLM provider。下一階段是 Phase 15「背包與戰鬥物品」，須等使用者手動驗收 Phase 14 後才開始。
