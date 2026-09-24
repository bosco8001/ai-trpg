# AI TRPG

這是 docs-first、從零建立的瀏覽器 AI TRPG。先閱讀 [AGENTS.md](AGENTS.md) 與 [權威文件清單](docs/development/CANONICAL_MANIFEST.md)。遊戲規則以清單中的文件為準；HTML 戰鬥原型不作為正式程式模板。

Phase 1–19 已由使用者確認。Phase 20「AoE 與龍息」工程完成，等待使用者手動確認；Phase 21 尚未開始。階段順序見 [Implementation Phase Plan](docs/development/IMPLEMENTATION_PLAN.md)。

Phase 3 的 domain 範圍與手動測試步驟見 [Phase 3 文件](docs/development/PHASE_3_DOMAIN.md)。目前各階段實作與手動驗收狀態見下方測試指南及 [Implementation Phase Plan](docs/development/IMPLEMENTATION_PLAN.md)。

## Phase 4：本機 PostgreSQL 與手動測試

本階段只保存 Phase 3 的測試角色技能配置。Docker Desktop 由你自行安裝，並須啟動後才能使用以下 `docker compose` 指令。資料庫 image 固定為 `postgres:17.11-bookworm`；本機預設以 `127.0.0.1:5433` 連接，避免與常見的 5432 連接埠衝突。前端頁面沒有新增遊戲操作。

### 1. 建立本機設定

在專案根目錄執行：

```sh
cp .env.example .env
```

用文字編輯器開啟 `.env`，把 `POSTGRES_PASSWORD` 和 `DATABASE_URL` 內的密碼改為**相同的本機測試密碼**。範例密碼只是佔位字串。若密碼含 `@`、`:`、`/` 等網址特殊字元，須在 `DATABASE_URL` 中進行 URL 編碼；最簡單是先使用只含英文字母與數字的本機測試密碼。若更改 `POSTGRES_PORT`，也要同步改 `DATABASE_URL` 的連接埠。

`.env` 已被 `.gitignore` 排除，不要把真實密碼放在 `.env.example`、`VITE_*` 前端變數或文件中。`DATABASE_URL` 只由後端與 migration 讀取。若已建立 volume 後才改 `POSTGRES_PASSWORD`，PostgreSQL 不會因修改 `.env` 自動更改資料庫內原有密碼；此時須使用原密碼，或自行在資料庫內變更密碼。

### 2. 啟動資料庫與執行 migration

```sh
docker compose up -d db
docker compose ps
npm run db:migrate:dry-run
npm run db:migrate
```

在 `docker compose ps` 確認 `db` 變成 `healthy` 後執行 migration。dry-run 只顯示預計執行的 SQL；正式命令會建立 `game_states` 與 migration 紀錄表。再次執行 `npm run db:migrate` 應顯示沒有待執行的 migration。若已有自己的 PostgreSQL，可提供相應 `DATABASE_URL`，但仍須先執行 migration；請勿對含有重要資料的現有資料庫進行本階段測試。

### 3. 測試保存、重啟與版本衝突

終端機 A：

```sh
PORT=3002 DOMAIN_SANDBOX=1 DOMAIN_STORAGE=postgres npm run dev:api
```

終端機 B：

```sh
curl -s http://127.0.0.1:3002/api/dev/domain
```

第一次應見 `sandbox: true`、七個 `TEST-` 已學技能與空的裝備技能。`TEST-` 是工程假資料，並非正式角色／技能。若先前已測試過，會讀出之前保存的版本與配置；以下例子假設版本是 `0`。測試前請先讀回目前 `revision`，並在命令中填入該數字。

```sh
curl -i http://127.0.0.1:3002/api/dev/domain/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","expectedRevision":0,"skillIds":["TEST-skill-1","TEST-skill-2"]}'
```

應回 HTTP 200、`ok: true`、`revision: 1`，裝備兩個技能。接著在終端機 A 按 Ctrl+C，重新執行相同啟動命令，再用 GET 讀取：`revision: 1` 與兩個技能應仍在。這表示資料從 PostgreSQL 讀回。

用舊版本 `0` 再送一次命令：

```sh
curl -i http://127.0.0.1:3002/api/dev/domain/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","expectedRevision":0,"skillIds":[]}'
```

應回 HTTP 409、`stale-revision`；GET 顯示狀態不變。若重做測試，命令中的 `expectedRevision` 請依讀回版本調整。額外加上 `"hp":999` 仍應回 HTTP 400 `invalid-command`，且不改狀態。

### 4. 測試服務離線與資料保留

保持 API 在終端機 A 運行，另在終端機 B 執行：

```sh
docker compose down
curl -i http://127.0.0.1:3002/api/dev/domain
```

`docker compose down` 只停止並移除 Compose 容器／網路，**保留具名資料 volume**。資料庫離線時，測試 API 應回 HTTP 503 與繁體中文提示，不應顯示 SQL、`DATABASE_URL` 或 stack trace。重新啟動資料庫後再讀取，保存的配置應仍在：

```sh
docker compose up -d db
docker compose ps
curl -s http://127.0.0.1:3002/api/dev/domain
```

完成後在 A 按 Ctrl+C，執行 `docker compose down` 停止資料庫並**保留資料**。只有你明確要刪除本專案的本機 PostgreSQL 資料時，才另行執行 `docker compose down --volumes`；**此命令會刪除具名 database volume**，不屬於一般停止流程。不要用它作為普通清理步驟。

這兩個 `/api/dev/domain` 測試路由須明確設定 `DOMAIN_SANDBOX=1` 才開放；`DOMAIN_STORAGE=postgres` 才使用資料庫。未設定時沿用 Phase 3 的記憶體測試模式；production 不開放測試路由。正式登入、多角色與存檔介面尚未建立。

## 安裝與啟動

使用 Node.js 24 與 npm。依賴版本由 `package-lock.json` 鎖定，來源為標準 npm registry。

```sh
cd "/Users/bosco0295/ai trpg"
npm ci --registry=https://registry.npmjs.org --fetch-retries=0 --fetch-timeout=15000
npm run dev
```

開啟 <http://127.0.0.1:5173>。`npm run dev` 同時啟動前後端，Ctrl+C 可停止兩者。已有依賴時直接執行 `npm run dev` 即可。

前端使用 5173，後端使用 3001。開發前端把 `/api` 轉送到後端，瀏覽器只需存取同一個來源。若連接埠被其他程式佔用，先停止該程式。

安裝若因 DNS、網路或沙箱失敗，重試最多兩次；仍失敗則停止，處理必要的單次網路權限或回報限制，不更換來源、不修改全域 npm 設定。

## Phase 1 手動測試

測試後端離線時，使用兩個終端機，均先進入專案根目錄。若已用 `npm run dev` 啟動，先按 Ctrl+C 停止。

終端機 A：

```sh
npm run dev:api
```

終端機 B：

```sh
npm run dev:web
```

1. 開啟 <http://127.0.0.1:5173>。先顯示檢查中，收到正確回覆後顯示「已連線」。本機回覆可能很快。
2. 按「重新檢查連線」，確認可再次取得結果，檢查期間按鈕停用。
3. 在終端機 A 按 Ctrl+C，保留前端，再按重新檢查；應顯示「目前無法連線」。Vite 此時出現代理連線錯誤是預期現象。
4. 在終端機 A 重新執行 `npm run dev:api`，再按重新檢查；應恢復「已連線」。
5. 用 Tab 移到按鈕，確認焦點可見，並以 Enter 操作。

連線狀態代表最近一次檢查結果，不會背景輪詢。請求最多等待 5 秒，逾時後可重試。使用者手動確認前，不視為介面驗收通過。

## Phase 2 手動測試

啟動方式與 Phase 1 相同。Phase 2 只更新共用視覺與響應式基礎；目前仍是連線頁。

1. 在桌面瀏覽器開啟 <http://127.0.0.1:5173>，查看暗色頁面、標題、細邊面板、文字與按鈕是否清楚。
2. 將視窗縮到約 375px 寬，或以手機 Safari／Chrome 開啟；標題與面板應上下排列，頁面不應出現整頁橫向捲動，文字與按鈕不應被裁切。
3. 放大瀏覽器文字／頁面至 200%，確認內容仍可捲動閱讀與操作。
4. 用 Tab 將焦點移到「重新檢查連線」，確認焦點輪廓清楚；按 Enter 重試，檢查中按鈕顯示文字並停用。
5. 按 Phase 1 的方式停用再重啟後端，確認成功與錯誤狀態都同時有文字提示，且錯誤提示說明如何重試。
6. 在裝置或瀏覽器啟用「減少動態效果」後重試，確認檢查中的圓點不再脈動；其他狀態仍然可辨認。

字體只參考本機 `Noto Serif TC`／`Noto Sans TC`，並設有繁體中文系統字體後備。網站不請求外部字體服務；就算本機沒有 Noto 字體，仍可正常顯示文字。

## 工程指令

```sh
npm run typecheck
npm test
npm run build
```

建置後可由後端同時提供靜態頁面與 API：

```sh
npm start
```

開啟 <http://127.0.0.1:3001>。建置版可用 `PORT=3002 npm start` 改變連接埠；開發代理固定使用後端 3001。目前服務僅監聽本機 `127.0.0.1`。

## 程式位置與 API 契約

| 位置 | 責任 |
|---|---|
| `src/web/` | React 前端、連線狀態與 API 呼叫 |
| `src/server/` | Fastify API、啟動與建置版靜態網頁服務 |
| `src/shared/health.ts` | 共用 API 型別與執行期回應驗證 |
| `tests/health.test.ts` | API 與前端連線邊界的工程測試 |

`GET /api/health` 不需要參數或 request body，回傳 HTTP 200 與 `Cache-Control: no-store`：

```json
{ "status": "ok", "service": "ai-trpg-api" }
```

後端宣告 response schema；前端將 JSON 視為 `unknown`，通過 runtime validation 才顯示已連線。HTTP 錯誤、非預期格式、連線中斷與逾時都顯示無法連線。

此端點只確認 API 服務可回應，尚不檢查資料庫或 LLM。

## Phase 13：普通攻擊與合法目標手動驗收

Phase 1–13 已由使用者確認。詳細狀態資料、API 與相容規則見 [Phase 13 文件](docs/development/PHASE_13_NORMAL_ATTACK.md)。戰鬥判定仍以 canonical [combat_system.md](docs/gameplay/combat_system.md) 為準。

本階段的攻擊只判定命中或未命中，不計傷害、不建立 HP，也不呼叫 LLM。TEST 玩家修正值只供工程測試使用。

### HIT 與合法目標

停止舊服務，在專案根目錄啟動：

~~~sh
DOMAIN_STORAGE=memory \
COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal \
COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=normal \
npm run dev
~~~

開啟 http://127.0.0.1:5173。另一個終端機開始 TEST combat：

~~~sh
curl -s http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":0}'
~~~

重新整理瀏覽器，確認 Round 1、目前行動 TEST 敵人 1、revision 1。按「TEST：推進下一回合」，應變成 TEST 玩家、revision 2。

先測試取消：按「普通攻擊」，等待目標清單載入，再按「取消」。確認 current actor 仍是 TEST 玩家、revision 仍為 2，沒有送出普通攻擊裁定。

重新按「普通攻擊」，確認提示「請選擇攻擊目標」：

- TEST 敵人 1 在敵方前排，可選。
- TEST 敵人 2 在敵方後排，不可選，並顯示「前排敵人阻擋」。
- 尚未選目標時不會送出普通攻擊 action，也不增加 revision。

選 TEST 敵人 1。預期機械結果：

~~~text
攻擊檢定：10 + 1 + 2 + 1 = 14
閃避檢定：8 + 1 = 9
結果：命中
~~~

確認 revision 只從 2 變 3，current actor 自動前進至 TEST 敵人 2；命中後不顯示 HP、傷害或敘事。重新整理瀏覽器，最近裁定、兩組骰值、結果、actor 與 revision 應保持。

可用唯讀 API 查看 server-derived target options：

~~~sh
curl -s http://127.0.0.1:3001/api/combat/normal-attack/options
~~~

回應應包含 currentActorId、revision、legalTargetIds，以及 TEST 敵人 2 的 front-row-blocked reason。這份 options 不會寫進 GameState。

### MISS

停止服務並重新啟動。Memory state 會回到初始值；只把 action fixture 改成 miss：

~~~sh
DOMAIN_STORAGE=memory \
COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal \
COMBAT_ACTION_ROLL_FIXTURE_MODE=miss \
NARRATION_FIXTURE_MODE=normal \
npm run dev
~~~

重新 Start Combat、刷新瀏覽器、TEST advance 至玩家回合，再攻擊 TEST 敵人 1。預期：

~~~text
攻擊檢定：3 + 1 + 2 + 1 = 7
閃避檢定：15 + 1 = 16
結果：未命中
~~~

未命中仍消耗 Turn：current actor 變成 TEST 敵人 2，revision 變成 3。

### RAW 1 仍可能命中

重新啟動服務並使用 raw-one-hit fixture：

~~~sh
DOMAIN_STORAGE=memory \
COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal \
COMBAT_ACTION_ROLL_FIXTURE_MODE=raw-one-hit \
NARRATION_FIXTURE_MODE=normal \
npm run dev
~~~

重做 Start、TEST advance 與攻擊。預期：

~~~text
攻擊檢定：1 + 1 + 2 + 1 = 5
閃避檢定：1 + 1 = 2
結果：命中
~~~

這確認 raw D20 1 不會自動失敗。

### Backend illegal target 與 stale revision

Memory mode 在玩家回合、revision 2 時，直接提交被阻擋的後排敵人：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/normal-attack \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":2,"targetId":"TEST-enemy-2"}'
~~~

應回 HTTP 409、illegal-target 或等價安全錯誤。再用舊 revision 測試：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/normal-attack \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":1,"targetId":"TEST-enemy-1"}'
~~~

應回 HTTP 409、stale-revision。兩次失敗都不能擲骰、消耗 Turn 或更改 revision；current actor 仍是 TEST 玩家。request 若加入 actorId、attackRoll、evasionRoll、hit、damage 或 round 等欄位，也應被拒絕。

### PostgreSQL 保存與重啟

使用沒有重要資料的本機測試資料庫。既有資料庫可能已保存 Phase 11／12 combat snapshot；先讀狀態，不要假設 revision 是 0：

~~~sh
docker compose up -d db
docker compose ps
npm run db:migrate
~~~

確認資料庫 healthy 後啟動：

~~~sh
DOMAIN_STORAGE=postgres \
COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal \
COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=normal \
npm run dev
~~~

先查看目前狀態：

~~~sh
curl -s http://127.0.0.1:3001/api/game-state
~~~

只有 outside-combat 時才用讀到的 revision 開始 TEST combat。若資料庫已有 active combat 且無法開始，沿用 Phase 11 安全測試流程，改用隔離且沒有重要資料的測試資料庫；不要用 Save／Load 繞過，也不要刪除 volume。

進行一次 HIT，記下 row、lastAction、attack／evasion 骰值、outcome、Round、current actor 與 revision。停止服務再用相同設定重啟，讀取 game-state，確認資料一致。Phase 13 不新增 migration 或 table；一般停止不要使用 docker compose down --volumes。

### 手機、鍵盤與錯誤訊息

在約 375px 寬度確認：

- 普通攻擊按鈕與目標按鈕容易點按。
- 前排阻擋原因清楚可讀。
- Cancel 容易操作，結果欄不溢出。
- 整頁沒有水平捲動，participant card 不溢位。

用鍵盤確認：

- Tab 到「普通攻擊」，Enter 開啟目標模式。
- Tab 到合法目標，Enter 執行攻擊。
- 被阻擋目標為 disabled，不能送出。
- Tab 到「取消」，Enter 可取消且 revision 不變。
- 操作時焦點清楚可見。

停止 backend 後重試讀取或攻擊，畫面應顯示繁體中文安全訊息；不得顯示 stack trace、SQL、內部路徑或資料庫細節。

## Phase 14：前後排換位手動驗收

Phase 1–14 已由使用者確認。Phase 14 前後排換位已驗收。詳細步驟見 [Phase 14 文件](docs/development/PHASE_14_ROW_MOVEMENT.md)。

記憶體模式啟動：

~~~sh
DOMAIN_STORAGE=memory COMBAT_SANDBOX=1 COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit NARRATION_FIXTURE_MODE=normal npm run dev
~~~

開始 TEST combat 並重新整理瀏覽器後，使用「TEST：推進下一回合」到 TEST 玩家回合。先開啟「移動」確認前排只提供「移至後排」，取消後 state 不變；再次確認換排，應增加一次 revision、結束玩家 Turn，並把玩家卡片移到我方後排。之後再推進到 Round 2 玩家回合，確認「移至前排」可以將卡片移回我方前排。

換排選項是唯讀 API：`GET /api/combat/row-move/options`。成功 action 使用 `POST /api/combat/row-move`，body 只有 `expectedRevision` 與 `targetRow`；同排選擇和舊 revision 應安全拒絕。Phase 14 不新增 database table 或 migration。

## Phase 15：戰鬥背包與物品使用手動驗收

Phase 1–15 已由使用者確認。完整記憶體、取消、耗盡、錯誤狀態、PostgreSQL、手機與鍵盤步驟見 [Phase 15 文件](docs/development/PHASE_15_COMBAT_ITEMS.md)。

本階段只提供 `TEST-combat-consumable × 2` 工程 fixture，沒有 HP、MP、治療、傷害或狀態效果。打開／關閉背包不改狀態；確認使用會扣一件、記錄 `item-use`，並結束目前 Turn。數量、recent action 和 combat state 保存在既有 `game_states.snapshot` JSONB，沒有新增 migration。

唯讀選項 API：`GET /api/combat/items/options`。成功使用 API：`POST /api/combat/items/use`，request body 精確為 `expectedRevision` 與 `itemId`。後端每次重新驗證玩家行動者與數量；前端只採用成功回應中的權威狀態與 options。

## Phase 16：防禦行動手動驗收

Phase 16 已由使用者手動確認。完整紀錄見 [Phase 16 文件](docs/development/PHASE_16_DEFEND.md)。

玩家回合的「防禦」先開確認；確認後呼叫 `POST /api/combat/defend`，body 精確只有 `expectedRevision`。後端決定 actor，記錄 `lastAction = defend`，消耗完整 Turn，revision 只增加一次。最近行動只顯示已發生的防禦，不顯示持續中的防禦狀態或減傷數值。既有 JSONB snapshot 保存行動、Round、actor 與 revision；沒有新 migration。

## Phase 17：逃跑行動手動驗收

Phase 17 已由使用者完成手動驗收，包括 PostgreSQL 重啟後保留 `ended / escaped` 終止戰鬥畫面。完整步驟見 [Phase 17 文件](docs/development/PHASE_17_RUN_ESCAPE.md)。

## Phase 18：物理主動技能手動驗收

已裝備的 `TEST-skill-1` 現在可在玩家 Turn 選擇合法敵方目標，由後端沿用 Phase 13 物理攻擊判定，記錄 hit／miss 與每位 actor 的技能冷卻。R1 用後 R2 不可用，R3 恢復；沒有 HP 或傷害。裝備、HIT、MISS、R2／R3、非法提交、刷新、PostgreSQL 重啟、手機及鍵盤的詳細步驟見 [Phase 18 文件](docs/development/PHASE_18_PHYSICAL_ACTIVE_SKILLS.md)。

## Phase 19：多回合施法手動驗收

已裝備的 `TEST-skill-2` 現在可開始三回合詠唱。TEST 角色有 24 MP；開始前須有完整 18 MP，每次開始／繼續只扣 6 MP。進度、已花 MP 與最近行動保存在權威狀態；R3 完成只代表「詠唱完成」，不判定施法成功、命中或傷害。取消不退已花 MP；取消不推進 Turn 只是暫定工程行為，並非正式規則。Memory、隔離 PostgreSQL、刷新、手機、鍵盤及拒絕情境見 [Phase 19 手動測試文件](docs/development/PHASE_19_MULTI_TURN_CASTING.md)。Phase 19 已由使用者手動確認，包括 PostgreSQL API 重啟後從詠唱 1/3 繼續至 2/3。

## Phase 20：AoE 與龍息手動驗收

龍裔 TEST 角色的天生能力「龍息」可選敵方前排或後排。系統逐一對該排敵人擲攻擊與閃避，記錄命中、未命中和暴擊；目前沒有傷害或 HP。龍息不佔技能格、不扣 MP，R1 使用後 R4 才能再用。完整 Memory、冷卻、詠唱、隔離 PostgreSQL、手機與鍵盤步驟見 [Phase 20 文件](docs/development/PHASE_20_AOE_DRAGON_BREATH.md)。Phase 20 工程完成，等待使用者手動驗收；Phase 21 尚未開始。
