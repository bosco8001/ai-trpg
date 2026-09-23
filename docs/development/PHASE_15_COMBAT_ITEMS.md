# Phase 15：戰鬥背包與物品使用

> Phase 1–15 已由使用者確認。Phase 16 工程實作完成，等待使用者手動驗收；Phase 17 尚未開始。

## 本階段範圍

本階段只驗證「物品能在合法玩家回合被權威消耗」。依 canonical [combat_system.md](../gameplay/combat_system.md) 與 [combat_ui.md](../gameplay/combat_ui.md)：打開／關閉背包不消耗主要行動；成功使用物品會消耗目前角色的完整主要行動並結束 Turn。

唯一物品是明確的 `TEST-combat-consumable` 工程 fixture，顯示名稱為「TEST 戰鬥消耗品」，初始數量 2、consumable、self-use。它不是 canonical 世界物品，也沒有藥水、草藥或魔法物品設定。效果只有 `quantity - 1`；不產生 HP、MP、治療、傷害、buff、debuff 或 status effect。

正式物品效果與目標規則仍未定，記於 [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)。Phase 15 不呼叫 interpreter、narrator、combat narrator 或 LanguageModel。

## Authoritative inventory 與 compatibility

`GameState.inventory` 保存唯一權威數量，格式為 stack 清單：

~~~ts
[{ itemId: "TEST-combat-consumable", quantity: 2 }]
~~~

物品名稱與 `consumable`／`self` 定義在靜態 catalog，不重複存進每個 GameState snapshot。runtime validation 只接受 catalog 已知 ID、非負 safe integer、沒有重複 stack；quantity 0 保留在 inventory，供背包顯示耗盡狀態。

舊 JSONB GameState 與 Phase 10 Save Format v1 snapshot 可能沒有 inventory。相容 hydration 只對 exact `TEST-character` 加入此工程 fixture inventory。未知角色缺欄位、未知物品、負數、重複 stack 或錯誤 shape 都會 safe reject。這不是正式角色出生自帶物品規則。

Save Format v1 現在包含 inventory，但仍不含 CombatState。戰鬥中的 Save／Load 繼續由 Phase 11 safeguard 回 `combat-not-supported`；沒有新增 migration。

## Options 與 action API

唯讀 options：

~~~http
GET /api/combat/items/options
~~~

Response 提供 `revision`、`currentActorId` 與每件物品的 `itemId`、`displayName`、`quantity`、`usable` 及選擇性的 `unavailableReason`。Options 是依目前 GameState、active combat、actor player-action boundary、catalog 與數量即時計算的 derived data，不保存進 GameState。敵方 Turn 可讀 options，但物品會標為不可使用。

Action：

~~~http
POST /api/combat/items/use
Content-Type: application/json
~~~

Request body 嚴格只接受：

~~~json
{"expectedRevision":2,"itemId":"TEST-combat-consumable"}
~~~

Actor 一律取自 `CombatState.currentActorId`。任何 actor、target、quantity、effect、HP、round、currentActorId 或額外欄位都會拒絕。POST 重新檢查 active combat、revision、玩家操作邊界、item definition、self-use consumable 與正數 inventory stack；不信任之前 GET 的 options。

成功回應包含 authoritative GameState 與使用後 server-derived options。前端只在成功回應後更新數量與 actor；失敗時不做 optimistic decrement。

## 單次 authoritative transition

成功使用會在同一個 domain transition 中：

1. 驗證 request、active combat、expected revision 與 current actor。
2. 驗證 actor 符合既有 player-action boundary。
3. 驗證物品是 catalog 支援的 self-use consumable，且 stack quantity 大於 0。
4. 數量減 1，保留 quantity 0 stack。
5. 寫入 `lastAction = item-use`，記錄 `actorId`、action `round`、`itemId`、`quantityBefore`、`quantityAfter`。
6. 沿用 Phase 11 Turn advancement；最後一名 participant 會正常增加 Round 並 wrap。
7. GameState revision 只增加一次。
8. persist inventory、CombatState、lastAction、Round、actor 與 revision。

Stale、enemy Turn、unknown item、耗盡、額外欄位、no combat 或其他拒絕都不會修改任何狀態，也不會覆寫 `lastAction`。PostgreSQL action 沿用既有 `SELECT ... FOR UPDATE` transaction，因此同版本並行使用最多一個成功。

## UI 行為

- active combat 的「背包」在敵方與玩家 Turn 都可打開。
- 開／關背包只有 UI state 和唯讀 options request，不增加 revision，不改 actor、Round 或 `lastAction`。
- 開背包會關閉攻擊目標與換排 presentation mode；不改 authoritative GameState。
- 敵方 Turn 可看物品數量；「使用」disabled，並顯示「目前不是可操作角色的回合。」
- 玩家 Turn options 標記可用時，「使用」先開最小確認；只有「確認使用」會 POST。
- 取消確認只改 UI，不改 quantity、revision、actor、Round 或 `lastAction`。
- 成功 recent action 只顯示行動者、物品名稱、數量前後與「物品已使用」，不產生戰鬥敘事。
- options／action 服務不可用時顯示安全繁體中文訊息；不得顯示 raw fetch、stack、SQL、credentials 或內部路徑。

## 工程檢查

Phase 15 測試涵蓋 inventory validation、known TEST legacy hydration、unknown legacy reject、read-only options、enemy／player usability、成功轉移、Round wrap、depletion、exact request body、失敗不變、API response validation、舊 lastAction regression 與 PostgreSQL 同 revision concurrency。PostgreSQL integration test 需要隔離的 `TEST_DATABASE_URL`；沒有此環境時會略過。

實際工程檢查結果記錄在 [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)。自動化檢查不代表瀏覽器、手機、鍵盤或 PostgreSQL restart 的使用者手動驗收。

## 手動驗收

### 記憶體模式：啟動與 enemy Turn 查看

在專案根目錄啟動：

~~~sh
DOMAIN_STORAGE=memory \
COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal \
COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=normal \
npm run dev
~~~

另一個終端機開始測試戰鬥：

~~~sh
curl -s http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":0}'
~~~

重新整理瀏覽器。預期 Round 1、`TEST-enemy-1`、revision 1。打開「背包」：應看到 TEST 戰鬥消耗品 × 2，使用 disabled 並說明目前不是可操作角色的回合。開、關後再 GET：revision 仍是 1、actor 仍是 `TEST-enemy-1`、Round 仍是 1、`lastAction` 仍是 `null`。

~~~sh
curl -s http://127.0.0.1:3001/api/game-state
curl -s http://127.0.0.1:3001/api/combat/items/options
~~~

Options 是唯讀 endpoint；每次 GET 前後狀態都應一致。

### 玩家 Turn：取消確認與第一次使用

按「TEST：推進下一回合」，預期 TEST 玩家、revision 2。打開背包，quantity 為 2、使用 enabled。只開／關背包仍是 revision 2。

點「使用」後，在確認區按「取消」。再 GET `/api/game-state`：quantity 仍為 2、revision 仍為 2、actor 仍為 TEST 玩家、`lastAction` 不變。

再按「使用」→「確認使用」。預期：quantity 2 → 1、revision 2 → 3、current actor → `TEST-enemy-2`；Round 維持 1。最近行動顯示 TEST 玩家、TEST 戰鬥消耗品、數量 2 → 1、結果：物品已使用。不得出現 HP、MP、治療、傷害或敘事。

重新整理瀏覽器，quantity、`lastAction.type = item-use`、actor 與 revision 應維持。

### 第二次使用與耗盡

按 TEST advance 到 revision 4／Round 2／TEST 敵人 1，再按一次到 revision 5／TEST 玩家。使用一次後預期 quantity 1 → 0、revision 5 → 6、current actor → TEST 敵人 2。

之後再推進到玩家 Turn。背包可顯示 quantity 0，但「使用」必須 disabled。直接 POST 也必須拒絕，quantity 不得成為負數，revision、actor 與 `lastAction` 不得改變。

### Stale revision

在 TEST 玩家 Turn／revision 2、quantity 2 時送舊 revision：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/items/use \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":1,"itemId":"TEST-combat-consumable"}'
~~~

應回 HTTP 409、`stale-revision`；quantity 仍為 2，actor 仍是 TEST 玩家、revision 仍是 2。

### Unknown item 與 extra fields

在 TEST 玩家 Turn／revision 2 測試未知物品：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/items/use \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":2,"itemId":"TEST-does-not-exist"}'
~~~

應 safe reject，quantity、revision、actor 與 `lastAction` 不變。另在 request 加 `actorId`、`targetId`、`quantity`、`effect`、`hp` 或其他欄位，應以 HTTP 400 拒絕且不改狀態。

### Enemy Turn API rejection

以 fresh Memory session 開始 combat；在 enemy Turn／revision 1 直接送：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/items/use \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":1,"itemId":"TEST-combat-consumable"}'
~~~

應拒絕。GET `/api/game-state` 確認 quantity 2、revision 1、actor `TEST-enemy-1`，沒有 item-use lastAction。

### Attack／Move mode regression

在玩家回合分別開啟普通攻擊目標模式與移動模式，再按「背包」。應關閉原模式並顯示背包。關閉背包後普通攻擊、移動與背包都可再次操作；同時間不應同時看到兩種 action presentation 或物品確認。

### PostgreSQL persistence 與 restart

僅使用沒有重要資料的本機測試狀態。沿用 Phase 4 `.env` 設定，不要刪除 volume：

~~~sh
docker compose up -d db
docker compose ps
npm run db:migrate
~~~

預期沒有 Phase 15 新 migration。使用 `DOMAIN_STORAGE=postgres`、`COMBAT_SANDBOX=1` 與上述 fixture 設定啟動服務。先讀取目前 `/api/game-state` revision；不要假設是 0，也不要覆蓋重要狀態。開始或沿用合適的 TEST combat，完成一次 item use。記下 inventory quantity、`lastAction` 欄位、Round、current actor 與 revision。

停止 API 再以相同設定重啟，重新 GET `/api/game-state`。inventory、item-use action、Round、actor 與 revision 應保持。不要執行 `docker compose down --volumes`。

### 手機、鍵盤與 backend unavailable

約 375px 寬度確認：背包容易打開；物品名、數量、使用／取消與 disabled 原因清楚可讀；recent action 不 overflow；頁面沒有水平捲動。

鍵盤確認：Tab 到「背包」並按 Enter；焦點移到「戰鬥背包」標題。Tab 到「使用」並按 Enter；Tab 到「確認使用」或「取消」並操作。取消後焦點回到「使用」；關閉背包後焦點回到背包按鈕。焦點輪廓清楚。

打開背包後停止 backend，再確認物品。畫面只顯示安全繁體中文錯誤；不得顯示 raw fetch error、stack trace、SQL、credentials 或 internal path。確認前端 quantity、revision、actor 不會假裝更新。

## 延後項目

Phase 15 不加入 HP、MP、healing、damage、status effects、buff／debuff、targeted items、ally／enemy item targeting、AoE／thrown items、equipment、weight、capacity、rarity、loot、economy、shop、crafting、durability、defend、run、skills、magic、Dragon Breath、AI、combat narration、death、victory／defeat、settlement、combat Save／Load policy 或正式 LLM provider。
