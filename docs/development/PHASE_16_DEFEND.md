# Phase 16：防禦行動

> Phase 1–15 已由使用者確認。Phase 16 工程實作完成，等待使用者手動驗收；Phase 17 尚未開始。

## 範圍與權威邊界

防禦是 canonical [combat_system.md](../gameplay/combat_system.md) 已確認的主要行動。這一階段只讓裁判系統正式接收「防禦」：玩家在自己的 Turn 確認後，後端驗證、記錄 `lastAction = defend`、結束 Turn，並推進到下一位參戰者。不擲骰，不需要目標。打開確認或取消只改畫面，不改 GameState。

`POST /api/combat/defend` request 精確只接受：

~~~json
{"expectedRevision":2}
~~~

actor 由 `CombatState.currentActorId` 決定。只有符合現有玩家操作邊界的 party participant 可以執行。成功後 `lastAction` 精確記錄 `type`、`actorId`、行動時的 `round`；沿用 Phase 11 回合推進，revision 只增加一次。敵方回合、舊 revision、無戰鬥、格式錯誤和任何額外欄位都安全拒絕且不改狀態。同版本並行請求沿用 PostgreSQL 鎖定交易與 revision 保護，最多一個成功。

四種 `lastAction`（`normal-attack`、`row-move`、`item-use`、`defend`）持續由 domain 與前端 runtime validation 檢查。`game_states.snapshot` JSONB 直接保存新的 variant、Round、actor 與 revision；沒有新 table 或 migration。Active combat 的 Save／Load 仍回 `combat-not-supported`。

canonical 防禦方向是降低受到的傷害，但目前沒有 HP／damage pipeline。Prototype `-30%` 不是正式規則。減傷量、生效時點、失效／持續時點及傷害類型差異仍列於 [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)。因此沒有減傷欄位、持續中的防禦狀態或卡片 badge；最近行動只說明已完成防禦，實際效果尚未接入。`combat_ui.md` 所列「防禦中」是日後有可判定狀態時的顯示例子，Phase 16 未建立該狀態。

## 手動驗收：記憶體模式

在專案根目錄啟動：

~~~sh
DOMAIN_STORAGE=memory \
COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal \
COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=normal \
npm run dev
~~~

開始 TEST combat：

~~~sh
curl -s http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":0}'
~~~

重新整理瀏覽器。Round 1、`TEST-enemy-1`、revision 1；「防禦」應停用。按「TEST：推進下一回合」後，應為 `TEST-player`、revision 2；「防禦」可點。

點「防禦」一次，只顯示「確定要選擇防禦嗎？」及「確認防禦／取消」。此時 GET `/api/game-state`：revision 2、actor `TEST-player`、`lastAction` 未變。按「取消」後確認相同狀態，鍵盤焦點應回到「防禦」。

重新點「防禦」→「確認防禦」。應見 `lastAction = {type: "defend", actorId: "TEST-player", round: 1}`、revision 3、current actor `TEST-enemy-2`。最近行動顯示 TEST 玩家選擇防禦、實際減傷效果尚未接入；沒有假減傷數值，也沒有「防禦中」持續 badge。刷新瀏覽器後，這些權威欄位應保持。

### API 拒絕

使用 fresh Memory session，在敵方 Turn／revision 1 送：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/defend \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":1}'
~~~

應安全拒絕。GET `/api/game-state`：revision 1、actor `TEST-enemy-1`、`lastAction` 不變。

在玩家 Turn／revision 2，用舊版本與注入比例各送一次：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/defend \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":1}'
curl -i http://127.0.0.1:3001/api/combat/defend \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":2,"defensePercent":30}'
~~~

第一個應回 HTTP 409 `stale-revision`，第二個應回 HTTP 400 `invalid-command`。兩次都不改 revision、Round、actor 或 `lastAction`。`actorId`、`targetId`、`duration` 等額外欄位也應拒絕。

### 互動、手機、鍵盤與服務離線

再推進至下一個玩家 Turn，分別打開普通攻擊→取消、移動→取消、背包→關閉、防禦→取消，確認模式不互相卡住。確認防禦後已離開玩家 Turn，不能在同一 Turn 再攻擊、移動或使用物品。

約 375px 寬度查看防禦按鈕、確認／取消、最近行動是否清楚易點；頁面不應橫向捲動。用 Tab 到「防禦」，Enter 開確認，再用 Tab／Enter 操作確認或取消；焦點須清楚，取消後應回到防禦按鈕。

在確認區開啟後停止 backend，再按「確認防禦」。畫面應顯示安全繁體中文錯誤，不得假裝 revision／actor／`lastAction` 已更新，也不得顯示原始錯誤、SQL 或 stack trace。

## PostgreSQL 重啟

僅使用沒有重要資料的本機測試狀態。先按 Phase 4 設定 `.env`，不要刪除 volume：

~~~sh
docker compose up -d db
docker compose ps
npm run db:migrate
~~~

預期沒有 Phase 16 新 migration。以 `DOMAIN_STORAGE=postgres`、`COMBAT_SANDBOX=1` 與上述 fixture 變數啟動服務，先 GET `/api/game-state`，不要假設 revision 0。在可用的測試狀態完成一次 Defend，記下 `lastAction`、Round、actor、revision。停止 API 後用相同設定重啟，再 GET；全部應保持。不要以 Save／Load 繞過 active-combat safeguard，也不要刪除 database volume。

## 工程檢查與延後項目

工程檢查結果見 [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)；自動化檢查不代表使用者的瀏覽器、手機、鍵盤或 PostgreSQL 重啟驗收。

Phase 16 不加入 HP、damage、真正減傷、比例、duration／expiry、持續狀態、護甲／盾牌／格擋、技能、魔法、AI、戰鬥敘事、死亡、勝敗、結算或戰鬥 Save／Load 政策。Phase 17「逃跑行動」尚未開始。
