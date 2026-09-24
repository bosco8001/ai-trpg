# 已批准的 Implementation Phase Plan

Phase 1–19 已由使用者確認。Phase 20「AoE 與龍息」工程完成，等待使用者手動確認；Phase 21 尚未開始。

依使用者修訂，先以 Phase 3 定義 domain、權威狀態與合法命令，再由 Phase 4 實作 domain 所需的保存介面。

| Phase | 單一目標 |
|---|---|
| 1 | Web application／frontend／backend 基礎、health API 與重試 |
| 2 | Responsive dark-fantasy design foundation |
| 3 | Authoritative game state／domain layer |
| 4 | PostgreSQL／migration／persistence foundation |
| 5 | AI／LLM model abstraction |
| 6 | 第一個可操作文字探索介面 |
| 7 | 自然語言 action interpretation |
| 8 | Validation → authoritative state update |
| 9 | 文字探索 narration integration |
| 9.5 | 已確認探索頁 layout／interaction 的 React alignment |
| 10 | 探索流程 save/load |
| 11 | 戰鬥回合與先攻引擎 |
| 12 | Responsive Combat UI 骨架 |
| 13 | 普通攻擊與合法目標 |
| 14 | 前後排換位 |
| 15 | 背包與戰鬥物品 |
| 16 | 防禦行動 |
| 17 | 逃跑行動 |
| 18 | 物理主動技能 |
| 19 | 多回合施法 |
| 20 | AoE 與龍息接入 |
| 21 | 隊伍資訊與戰術偏好介面 |
| 22 | 半自動隊友戰鬥行為 |
| 23 | AI Combat Narration integration |
| 24 | 行動順序動畫與非主角節奏 |
| 25 | 瀕死、救助與死亡 |
| 26 | 戰鬥結算與返回探索 |
| 27 | 完整手機戰鬥介面 polish |

每個階段開始前先解釋範圍與手動測試方式；完成工程檢查後停下，由使用者手動確認才繼續。Phase 3 先以記憶體檢查 domain，Phase 4 才驗證重啟後仍能載入。Responsive 從 Phase 2 建立；persistence 從 Phase 4 貫穿後續功能。

Canonical documents 與 `OPEN_QUESTIONS.md` 是設計來源。未定規則不自行定案，暫時測試資料與設定必須標記。這份工程計畫不新增正式世界觀或遊戲規則。

## Phase 1 交付紀錄

新增 React／TypeScript／Vite 前端、Node.js／Fastify 後端與共用 health API 型別。連線頁顯示檢查中、已連線、無法連線，提供重試及 5 秒逾時。前端驗證實際 JSON 格式，並拒絕 HTTP 錯誤與非預期回應。

### 檔案範圍

- 新增：`package.json`、`package-lock.json`、`.gitignore`、`.nvmrc`。
- 新增：`tsconfig.json`、`tsconfig.server.json`、`vite.config.ts`、`index.html`。
- 新增：`src/web/App.tsx`、`src/web/main.tsx`、`src/web/api.ts`、`src/web/style.css`。
- 新增：`src/server/app.ts`、`src/server/index.ts`、`src/shared/health.ts`。
- 新增：`tests/health.test.ts`、本階段計畫文件。
- 修改：`README.md`，補上安裝、啟動、手動測試與 API 契約。

### 已執行的工程檢查

- `npm run build`：通過，其中包含 TypeScript 型別檢查、Vite 前端建置與後端編譯。
- `npm test`：5 項通過，涵蓋 API／前端契約、404、HTTP 錯誤、格式錯誤及網路錯誤傳遞。
- 啟動 `npm run dev` 後，以 HTTP 驗證頁面、代理後的 health API、快取標頭與未知 API 404：通過。
- 啟動 `PORT=3002 npm start` 後，以 HTTP 驗證建置版頁面、JavaScript 資產、health API 與未知 API 404：通過。
- 核對 lockfile：所有下載來源均為 `registry.npmjs.org`。

安裝使用標準 npm registry 的單次網路權限，成功完成。初次使用 tsx CLI 的測試啟動受沙箱 IPC 限制，已改用 `node --import tsx` 執行並通過；開發監看使用 Node.js 的 `--watch`。開發與建置版 HTTP 檢查使用本機服務單次權限，完成後均已停止。第一次接續啟動建置版前的連接埠檢查遭阻，後續改用獨立的 3002 完成檢查。

上述工程檢查不代表介面手感或使用者驗收通過。Phase 1 其後已由使用者手動確認；當時的測試步驟見 [README](../../README.md#phase-1-手動測試)。

## Phase 2 交付紀錄

依使用者批准的 design checkpoint，以語意化 tokens 建立暗色表面、字色、舊金操作色、狀態色、間距、繁體中文字體後備與低動態設定。建立可重用按鈕與面板，套用於 Phase 1 連線頁。手機採單欄，較寬畫面採雙欄；載入、成功、失敗均有文字與語意提示。

### 檔案範圍

- 新增：`src/web/design-tokens.css`、`src/web/ui/Button.tsx`、`src/web/ui/Panel.tsx`。
- 修改：`src/web/App.tsx`、`src/web/style.css`、`README.md`、本階段計畫文件。
- 未修改：canonical gameplay／world 文件、後端 API、domain 與資料保存實作。

### 已執行的工程檢查

- `npm run build`：通過，包含 TypeScript 型別檢查、Vite 前端建置與後端編譯。
- `npm test`：既有 5 項 API／連線工程測試通過。
- 以腳本檢查選定的 token 配色：正常文字對背景達 4.5:1，互動邊界與焦點環對相鄰背景達 3:1；通過。
- 檢查 token 與前端程式沒有外部字體服務、`@font-face` 或外部 URL 依賴；通過。

以上是工程結果；Phase 2 其後已由使用者手動確認。手動測試見 [README](../../README.md#phase-2-手動測試)。

## Phase 3 交付紀錄

以技能配置建立最小權威狀態切片：獨立 domain 驗證命令，通過才更新記憶體狀態。裝備至多六個已學主動技能，禁止重複選取與戰鬥中換裝；拒絕多餘欄位、未知命令及過期版本。測試 API 預設關閉，正式環境不開放。

新增 `CONTEXT.md`、`src/domain/game.ts`、`src/server/domain-session.ts`、`src/server/domain-sandbox.ts`、`tests/domain.test.ts` 與 `docs/development/PHASE_3_DOMAIN.md`。修改 `src/server/app.ts`、`src/server/index.ts`、`README.md` 與本文件。

`npm run build` 通過；`npm test` 共 13 項通過。當時未加入資料庫、完整角色數值、LLM、探索或戰鬥實作。測試角色與技能均為工程資料。詳見 [Phase 3 手動測試與契約](PHASE_3_DOMAIN.md)。Phase 3 其後已由使用者手動確認。

## Phase 4 交付紀錄

依 Phase 3 的 domain 狀態建立 `GameStateRepository` 契約與 PostgreSQL adapter。migration 僅建立 `game_states`，保存角色識別碼、工程 revision 與目前的 domain 快照。寫入採 revision 條件式更新；從資料庫讀回時重新通過 domain runtime validation。測試 API 可明確切換記憶體或 PostgreSQL，錯誤只回傳安全訊息。設定、啟動、停止與手動測試見 [README](../../README.md#phase-4本機-postgresql-與手動測試)。

新增 `compose.yaml`、`.env.example`、`migrations/001_game_states.mjs`、`src/domain/game-state-repository.ts`、`src/server/postgres-game-state-repository.ts`、`tests/persistence.test.ts`。修改 domain 驗證、domain session、測試 API、伺服器設定、套件及型別設定、README 與本計畫。

`npm run build` 通過。`npm test` 在隔離 PostgreSQL 上 17 項通過，包括資料庫保存、衝突、重讀與異常快照檢查。暫存 PostgreSQL 上 `npm run db:migrate:dry-run` 與 `npm run db:migrate` 通過；Docker Compose 本機操作需待使用者安裝 Docker Desktop 後手動測試。Phase 4 其後已由使用者手動確認；下一階段為 Phase 5。

## Phase 5 交付紀錄

建立後端專用的 `LanguageModel` 介面、文字請求／結果型別、adapter 邊界與可注入的逾時設定。外部回應一律先以 `unknown` 接收，再檢查為非空純文字；格式錯誤、服務不可用與逾時只產生固定的中立錯誤。固定回應 adapter 不連網、不需要金鑰，可供後續 application 測試替換。詳細手動測試見 [README](../../README.md#phase-5文字模型介面手動檢查)。

新增 `src/server/llm/contracts.ts`、`language-model.ts`、`fake-adapter.ts`、`check.ts` 與 `tests/llm.test.ts`。修改 `package.json`、`README.md`、`OPEN_QUESTIONS.md` 與本計畫。沒有新增 npm 套件、環境變數或前端 API；實際供應商／模型仍未定。

`npm run build` 通過；`npm test` 共 23 項，其中 22 項通過、需明確提供隔離資料庫的既有整合測試略過。四種 `npm run llm:check` 情境均以本機 fake 執行成功。Phase 5 其後已由使用者手動確認。

## Phase 6 交付紀錄

將 Phase 1／2 的連線頁演進為第一個可操作的文字探索介面。固定測試敘事、玩家輸入與系統測試回覆以 local UI history 顯示；Enter 送出、Shift+Enter 換行，空白輸入不建立紀錄。API 健康狀態保留為頁首輔助資訊。畫面重用既有 semantic tokens、Button、Panel、焦點環與 reduced-motion 設定。詳見 [Phase 6 文件](PHASE_6_EXPLORATION.md) 與 [README 手動測試](../../README.md#phase-6文字探索介面手動測試)。

新增 `src/web/exploration.ts`、`src/web/ExplorationPage.tsx`、`tests/exploration.test.ts`、`docs/development/PHASE_6_EXPLORATION.md`。修改 `src/web/App.tsx`、`src/web/style.css`、`README.md` 與本計畫。沒有修改 domain、PostgreSQL schema、LLM adapter 或 canonical 文件。

`npm run typecheck`、`npm run build` 通過。`npm test` 共 28 項，其中 27 項通過、需隔離資料庫的既有 integration test 略過。Phase 6 其後已由使用者手動確認。

## Phase 7 交付紀錄

加入後端探索文字解析服務：玩家文字經 Phase 5 中立 `LanguageModel` 介面及固定測試 adapter，經嚴格 runtime validation 才形成 candidate action。解析 API 與探索頁顯示「候選解析（固定測試）」、歧義澄清或未支援；沒有執行 domain 命令或保存資料。輸入上限 500 字屬工程限制，不是遊戲規則。詳見 [Phase 7 文件](PHASE_7_INTERPRETATION.md) 與 [README 手動測試](../../README.md#phase-7自然語言候選解析手動測試)。

修改 `src/server/llm/` 的請求契約，新增 `src/server/interpretation/` 與 `src/shared/interpretation.ts`，接入 `src/server/app.ts`、`index.ts`、`src/web/`，新增 `tests/interpretation.test.ts` 並更新相關文件。正式模型仍未決定；Phase 8 才驗證與更新狀態，Phase 9 才敘述已確定結果。

`npm run typecheck` 與 `npm run build` 通過；`npm test` 共 37 項，其中 36 項通過、需要隔離資料庫的既有 PostgreSQL integration test 略過。工程檢查涵蓋有效解析、歧義、未知句子、不可信輸出、逾時、安全錯誤、API 格式與解析前後權威測試狀態一致。

Phase 7 其後已由使用者手動確認。

## Phase 8 交付紀錄

將最小探索狀態加入 authoritative `GameState`，只包含工程位置 ID 與最近觀察目標。固定文字候選必須先經 deterministic resolver，才能形成 `approach-target` 或 `inspect-target` domain command；自由文字不會直接寫成 ID。成功命令沿用既有 revision 與 repository optimistic concurrency，並回傳機械式 effect。歧義、未支援、未知目標、舊版本與不合法欄位不修改狀態。

新增 `src/server/exploration/`、`src/shared/exploration-action.ts`、`src/server/test-game-state.ts`、`tests/exploration-action.test.ts` 與 [Phase 8 文件](PHASE_8_AUTHORITATIVE_EXPLORATION.md)。修改 domain、session、Fastify routes、PostgreSQL snapshot hydration、探索頁及相關測試／文件。既有 JSONB snapshot 可保存新增狀態，所以沒有新增 migration 或 table；舊 Phase 4 snapshot 由 persistence 邊界安全補上初始 TEST 探索資料。

`npm run typecheck`、`npm run build` 與 `git diff --check` 通過。`npm test` 共 48 項，其中 47 項通過；需明確提供隔離 `TEST_DATABASE_URL` 的既有 PostgreSQL integration test 略過。其餘測試涵蓋完整 API 管線、位置與觀察 transition、revision、所有拒絕不改狀態、request／candidate／command／response runtime validation、舊 snapshot 相容與異常 exploration snapshot 拒絕，以及安全 repository 錯誤。

Phase 8 其後已由使用者手動確認，包括 PostgreSQL persistence 驗收。

## Phase 9 交付紀錄

在 Phase 8 transition 成功並提交後，才把最小 authoritative facts 交給 `ExplorationNarrator`。Narrator 重用 Phase 5 `LanguageModel`，固定 adapter 不連網、不需金鑰。模型輸出必須是 exact `{ text }` JSON，並通過長度、段落、必要 TEST 目標與保守事實 guard。被拒絕的 action 不呼叫 narrator；timeout、unavailable 或 malformed response 只產生安全 fallback，不 rollback 或重做已成功命令。

新增 `src/server/narration/`、`tests/narration.test.ts` 與 [Phase 9 文件](PHASE_9_EXPLORATION_NARRATION.md)。修改 action service、共用 response contract、server composition、固定模式設定、探索 UI 與相關文件。沒有修改 authoritative domain rules、PostgreSQL schema 或 migration，也沒有保存 narration。

`npm run typecheck`、`npm run build` 與 `git diff --check` 通過。`npm test` 共 61 項，其中 60 項通過；需明確提供隔離 `TEST_DATABASE_URL` 的既有 PostgreSQL integration test 略過。Narration 測試涵蓋移動、觀察、authoritative-only input、prompt injection 隔離、exact response、consistency guard、rejection 不呼叫、三種失敗、commit 後 fallback、無 double execution、repository 已保存狀態與安全錯誤。

Phase 9 其後已由使用者手動確認，包括正常敘事、拒絕、prompt injection、unavailable、timeout、malformed，以及 PostgreSQL 下敘事失敗不影響 authoritative state。

## Phase 9.5 交付紀錄

只重整正式 React exploration UI：故事紀錄下方新增五個可點選的固定測試建議、緊湊圓形工具列、預設收起且可連續送出的自由輸入，以及右側 placeholder 工具面板。建議 contract 只有 `id` 與自然語言 `text`；按鈕仍使用原本 action API，因此完整經過 Phase 7 candidate、Phase 8 deterministic validation／revision 與 Phase 9 narration。建議與工具面板都沒有 command、成功結果或 state mutation 能力。

新增 `src/web/exploration-ui.ts`、`src/web/ui/Icon.tsx`、`tests/exploration-ui.test.ts` 與 [Phase 9.5 文件](PHASE_9_5_EXPLORATION_UI.md)。修改探索頁、探索樣式、既有探索測試與 README。沒有修改 domain、server action service、shared API contract、PostgreSQL schema／repository、narration adapter 或 canonical rules。

`npm run typecheck` 通過。`npm test` 共 65 項，其中 64 項通過、既有需隔離 `TEST_DATABASE_URL` 的 PostgreSQL integration test 略過。新增測試涵蓋五項 presentation-only 建議、建議仍經 action API、自由輸入送出後保持展開、工具面板開關與 Escape、以及 placeholder 沒有權威 state 欄位。其餘 Phase 1–9 測試均無 regression。Phase 9.5 其後已由使用者手動確認。

## Phase 10 交付紀錄

建立三個手動存檔槽與 Save Format v1。Save 只保存目前 authoritative GameState 內容並記錄 `sourceRevision`，不增加 live revision；Load 以 snapshot 內容取代目前 state，但 live revision 只從載入前版本增加一次，永不恢復舊版本。Save／Load 都要求 `expectedRevision`，stale、空槽、損壞資料、不支援版本與 repository failure 均不修改權威狀態。

新增 `src/server/save-game/`、`src/shared/save-game.ts`、`src/web/SaveSlotsPanel.tsx`、`migrations/002_save_slots.mjs`、`tests/save-game.test.ts` 與 [Phase 10 文件](PHASE_10_SAVE_LOAD.md)。修改 domain state replacement 邊界、session、server composition、frontend API／探索頁／樣式及相關文件。System drawer 現在可列出、保存、確認覆蓋及確認載入；Load 後以前端收到的 authoritative state 更新工程摘要與建議，並清除不在存檔格式內的 local exploration history。

Memory repository 供不連資料庫的測試與開發；API restart 後其存檔消失。PostgreSQL repository 使用新增的 `save_slots` table 保存 slot、format version、source revision、JSONB snapshot 與 backend timestamp；條件式 SQL 與既有 `GameStateRepository` 共同維持 optimistic concurrency。正式 provider、conversation／narration persistence、autosave、刪除、多 campaign 與 combat 均未加入。

`npm run typecheck` 與 `npm run build` 通過；Vite 與 server TypeScript 均成功建置。`npm test` 共 79 項，其中 77 項通過；兩項需要明確提供隔離 `TEST_DATABASE_URL` 的 PostgreSQL integration test 依既有安全策略略過。`npm run db:migrate:dry-run` 成功產生 `002_save_slots` 的預期 SQL；`node --check migrations/002_save_slots.mjs` 與 `git diff --check` 通過。沒有對一般本機資料庫執行會寫入或清除資料的整合測試。

Phase 10 其後已由使用者手動確認，包括 Memory／PostgreSQL 保存、載入、restart persistence 與 monotonic revision。

## Phase 11 交付紀錄

將最小 `CombatState` 加入 authoritative `GameState`：保存三名 TEST participant、初始 D20、DEX modifier、initiative total、所有 tie-break rolls、final order、Round、current turn index 與 current actor。Start Combat 依 canonical `D20 + DEX modifier` 排序，同 total 者只在平手小組內重擲；再次平手只讓仍同點者繼續。Start 與每次 Advance 各自只增加一次 revision，敵人 Turn 不會自動執行或跳過。

新增 `src/domain/combat-state.ts`、`src/domain/combat.ts`、`src/server/combat/`、`tests/combat-turns.test.ts` 與 [Phase 11 文件](PHASE_11_COMBAT_TURNS.md)。修改 GameState runtime validation、domain session、server composition、PostgreSQL snapshot hydration、Phase 10 Save／Load safeguard、README、OPEN_QUESTIONS 與本計畫。`COMBAT_SANDBOX=1` 才在非 production 開放 TEST combat routes；`COMBAT_ROLL_FIXTURE_MODE=normal|tie` 提供可重現的手動測試。

CombatState 沿用 `game_states` JSONB，不新增 migration；舊 snapshot 缺少 combat 時安全補為 `null`。Save Format v1 不升版且不包含 CombatState。戰鬥中的 Save／Load 暫時回 `combat-not-supported`，只是避免遺失狀態的工程防護；正式政策仍列在 OPEN_QUESTIONS。

工程檢查結果：`npm test` 共 94 項，91 項通過、3 項因未提供隔離的 `TEST_DATABASE_URL` 而安全略過；`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run` 與 `git diff --check` 均通過。Dry run 顯示沒有新 migration。Phase 11 其後已由使用者手動確認。

## Phase 12 交付紀錄

新增前端唯讀權威狀態 contract 與 `GET /api/game-state`，讓 application 層依 `activity` 切換 Exploration UI 或 Combat UI；所有 API JSON 都先經 shared runtime validation。新增 CombatPage，直接顯示 Phase 11 的 Round、current actor、turn order、participants 與 initiative，不由 React 重算排序。四排戰場使用明確 TEST presentation fixture，沒有寫回 GameState、PostgreSQL 或 revision。

右側提供戰況、無 LLM 的戰鬥敘事 placeholder、唯讀已裝備技能與六個 native disabled 指令。`COMBAT_SANDBOX=1` 才顯示「TEST：推進下一回合」，它只呼叫既有 dev route 並採用 backend 回傳 state。沒有攻擊、HP／MP、target、row movement、combat narration 或任何新 domain rule。桌面使用 battlefield + right rail；窄螢幕改為單欄。Phase 2 tokens、focus ring、safe-area、touch target 與 reduced-motion 設定繼續沿用。

新增 `src/shared/game-state.ts`、`src/server/game-state-route.ts`、`src/web/CombatPage.tsx`、`src/web/combat-ui.ts`、`tests/combat-ui.test.ts` 與 [Phase 12 文件](PHASE_12_COMBAT_UI.md)。修改 App、frontend API、server composition、樣式、README 與本計畫。沒有 migration、table 或 authoritative state schema 變更。

工程檢查結果：`npm test` 共 103 項，100 項通過、3 項因未提供隔離的 `TEST_DATABASE_URL` 而安全略過；`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run` 與 `git diff --check` 均通過。Dry run 顯示沒有新 migration。Phase 12 已由使用者確認。

## Phase 13 交付紀錄

Combat participant 現在將 `side + row` 作為權威位置，TEST 初始位置與普通攻擊 profile 僅是工程 fixture。已知 Phase 11／12 TEST snapshot 會依 exact shape 安全 hydration；未知 participant 缺少 row 時拒絕讀取。Combat UI 從 server state 排列參戰者，移除原有前端 TEST row placement。沒有 row movement。

新增 domain legal-target calculation 與正式 read/action routes。玩家回合可讀取伺服器推導的合法目標；普通攻擊 request 僅接受 `expectedRevision` 與 `targetId`，攻擊者、骰值、結果及回合資訊均由 authoritative state／backend 決定。melee 受敵方前排阻擋，敵方前排空時可攻擊後排；ranged 可攻擊前後排。

攻擊與閃避由注入的 D20 roller 擲骰，依 canonical Physical Attack、Evasion 公式與「攻擊總值大於或等於閃避總值即命中」判定。成功 action 將最近一次 mechanical resolution 寫入 CombatState.lastAction、消耗目前 Turn 並前進行動順序，整體 revision 只增加一次。PostgreSQL 在鎖定交易內檢查版本、擲骰並提交，因此同版本競爭請求的失敗者會在擲骰前拒絕。沒有 HP、傷害、critical multiplier、敘事或 LLM。JSONB snapshot 沿用既有 `game_states`，沒有新增 migration 或 gameplay table；active combat 的 Save／Load safeguard 保持不變。

新增 `src/domain/combat-targeting.ts`、`tests/combat-actions.test.ts` 與 [Phase 13 文件](PHASE_13_NORMAL_ATTACK.md)，並修改 combat domain/state、server action routes/session/dice fixtures、shared runtime validation、Combat UI、README 與本計畫。

工程檢查結果：`npm test` 共 129 項，125 項通過、4 項 PostgreSQL integration test 因未提供隔離的 `TEST_DATABASE_URL` 而略過；`npm run build` 與 `git diff --check` 通過。工程實作階段沒有執行真實 PostgreSQL restart 或使用者手動 UI 驗收。使用者其後完成 Phase 13 手動驗收，涵蓋 HIT、MISS、raw D20 1 命中、melee 前排阻擋、非法後排目標、stale revision、取消、browser refresh、mobile／keyboard 與 PostgreSQL persistence。Phase 13 已由使用者確認。

## Phase 14 交付紀錄

完成 authoritative front／back row movement。伺服器依目前 CombatState 即時計算合法換排行；Mutation 嚴格只接收 `expectedRevision` 與 `targetRow`，重新驗證目前玩家操作邊界及合法目標，再更新既有 `participant.row`。換排 deterministic、不擲骰，消耗完整 Turn，沿用 Phase 11 回合推進 helper，GameState revision 只增加一次。前端只採用成功 response 的權威狀態，不做 optimistic movement；取消選擇不送 mutation。`lastAction` runtime union 保留既有 normal-attack snapshot，新增 row-move facts。沒有新增 migration、table、row capacity、opportunity attack 或後排近戰限制。

新增 `tests/combat-row-movement.test.ts` 與 [Phase 14 手動驗收文件](PHASE_14_ROW_MOVEMENT.md)。修改 combat domain/state、session 與 routes、PostgreSQL repository 註解、shared GameState contract、CombatPage／API／UI helpers／style、Phase 13 測試與 README。更新 canonical combat system／UI、未解問題，以及 Phase 10–13 與本計畫的階段狀態。沒有資料庫 schema 或 migration 變更。

工程檢查：`npm test` 共 144 項，139 項通過、0 項失敗、5 項 PostgreSQL 整合測試因未提供隔離 `TEST_DATABASE_URL` 而略過；`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run` 與 `git diff --check` 均通過，dry-run 顯示沒有待執行 migration。工程階段未執行瀏覽器／mobile／keyboard 手動驗收或 PostgreSQL restart。使用者其後確認 Phase 14 手動驗收完成；Phase 1–14 已由使用者確認。

## Phase 15 交付紀錄

GameState 加入最小 authoritative inventory stacks，TEST 工程角色有 `TEST-combat-consumable × 2`。靜態 catalog 只定義 TEST 名稱、可消耗與 self-use；沒有 item lore 或效果。runtime validation 僅接受已知 fixture、唯一 stack 與非負安全整數。舊 JSONB 與 Save Format v1 snapshot 只對 exact `TEST-character` 補上工程 fixture inventory；其他角色舊資料缺欄位會 safe reject。

新增 server-derived `GET /api/combat/items/options` 與 exact-body `POST /api/combat/items/use`。GET options 不寫狀態；敵方回合可查看但不可使用。POST 會重新驗證 active combat、expectedRevision、player-action boundary、catalog、self-use consumable 及正數 quantity。成功在單一 transition 扣一件、保存 `item-use` lastAction、沿用 Phase 11 Turn advance，revision 只增加一次。PostgreSQL 使用既有 `withStateLocked` row transaction；GameState／inventory／combat action 繼續放在 JSONB。

Combat UI 啟用背包入口，開關背包會關閉攻擊／換排 presentation mode，但不改 authoritative state。使用需第二步確認；取消不提交；前端沒有 optimistic decrement。最近行動只顯示 actor、TEST 物品名稱、數量前後與固定結果。沒有呼叫 LLM，也沒有加入 HP、MP、治療、傷害、buff、debuff 或 status effect。Save／Load 在 active combat 的 safeguard 保持原狀。

新增 `src/shared/combat-items.ts`、`src/domain/combat-items.ts`、`tests/combat-items.test.ts` 與 [Phase 15 手動驗收文件](PHASE_15_COMBAT_ITEMS.md)。修改 GameState／CombatState、combat transition、session、service、routes、PostgreSQL／Save snapshot hydration、shared runtime contracts、CombatPage、API、UI helper／樣式，以及 README、OPEN_QUESTIONS 與 Phase 10–14 文件狀態。沒有新增 migration、table 或 item-history table。

工程檢查：`npm test` 共 155 項，149 項通過、0 項失敗、6 項 PostgreSQL 整合測試因未提供隔離的 `TEST_DATABASE_URL` 而略過；`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run` 與 `git diff --check` 均通過。Dry run 顯示沒有待執行 migration。工程階段未執行瀏覽器／手機／鍵盤手動驗收或 PostgreSQL restart；由使用者依 Phase 15 清單測試。

Phase 1–15 已由使用者確認。

## Phase 16 交付紀錄

新增 `POST /api/combat/defend`，request 只接受 `expectedRevision`。後端從目前 CombatState 取得 actor，驗證玩家操作邊界與 revision，記錄 `defend` lastAction，沿用 Phase 11 回合推進，於單一 transition 增加一次 revision。敵方回合、stale、無戰鬥、格式錯誤與額外欄位都不改狀態；防禦不擲骰。

Combat UI 啟用「防禦」與確認／取消，只有確認才送 POST。最近行動只呈現機械事實。四種 lastAction 均維持 runtime validation 與既有 JSONB 保存。沒有傷害、減傷比例、持續狀態、到期欄位或 migration。未決的減傷量、生效與失效 timing 繼續列於 [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)。

新增 `tests/combat-defend.test.ts` 與 [Phase 16 手動驗收文件](PHASE_16_DEFEND.md)。修改 combat domain/state、session、service、routes、shared response contract、前端 API／CombatPage／UI helper，以及 README、OPEN_QUESTIONS 和本計畫。

工程檢查：`npm test` 共 163 項，156 項通過、0 項失敗、7 項 PostgreSQL 整合測試因未提供隔離的 `TEST_DATABASE_URL` 而略過；`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run` 與 `git diff --check` 通過。Dry run 顯示沒有待執行 migration。瀏覽器／手機／鍵盤與 PostgreSQL restart 仍由使用者手動驗收。

Phase 16 已由使用者手動確認。

## Phase 17 交付紀錄

新增 `POST /api/combat/run`，request 只接受 `expectedRevision`。後端使用獨立的可注入 D20 擲骰、既有 participant 敏捷修正與種族修正，依 canonical DC 8 裁定。TEST 玩家種族修正 0；domain 支援龍裔 −2，測試使用同骰值驗證差異。成功在同一次 transition 將 CombatState 設為 `ended`／`escaped`，移除目前可行動 actor，不推進 Turn；失敗保留 `active` 並推進 Turn。兩者都只增加一次 revision，保存完整 `run` lastAction。

舊 CombatState 缺少 lifecycle 欄位時安全 hydrate 為 `active`；PostgreSQL JSONB 保存 lifecycle、end reason、裁定及 revision，無新 migration。戰鬥已結束後攻擊、換排、物品、防禦、再次逃跑及 TEST advance 都由後端拒絕。Save／Load 防護維持。Combat UI 啟用逃跑確認與取消，成功呈現終止畫面並停用所有指令；失敗顯示機械結果與下一位行動者。沒有追逐、結算獎勵、探索改動或 LLM 敘事。

新增 `tests/combat-run.test.ts` 與 [Phase 17 手動驗收文件](PHASE_17_RUN_ESCAPE.md)。工程檢查：`npm test` 共 174 項，166 項通過、0 項失敗、8 項 PostgreSQL 整合測試因未提供隔離的 `TEST_DATABASE_URL` 而略過；`npm run typecheck`、`npm run build` 與 `git diff --check` 通過。使用者其後完成手動驗收，包括 PostgreSQL 重啟後維持 `ended / escaped` 終止戰鬥畫面。Phase 1–17 已由使用者確認。

## Phase 18 交付紀錄

沿用 Phase 3 的已學與已裝備技能欄位，加入最小 TEST 技能定義。`TEST-skill-1` 是物理主動、單一敵方、近戰的工程 fixture。`GET /api/combat/physical-skills/options` 從權威角色與戰鬥狀態推導可用性及目標；`POST /api/combat/physical-skills/use` 在擲骰前重新驗證 revision、玩家 Turn、已學、已裝備、類別、冷卻與目標。攻擊和閃避共用 Phase 13 判定，命中與未命中都消耗 Turn、保存 `physical-skill` lastAction 與 `actorId + skillId + readyRound` 冷卻，revision 只加一次。R1 使用後 R3 可再使用。

舊 CombatState 缺冷卻欄位時補空陣列。runtime 繼續放入 `game_states.snapshot` JSONB，沒有新 migration。前端已裝備技能區支援選技能、選合法目標、取消與回合式冷卻文字；失敗不 optimistic 更新。TEST 技能不建立傷害、HP、SP、狀態效果或 LLM 敘事。詳細手動驗收見 [Phase 18 文件](PHASE_18_PHYSICAL_ACTIVE_SKILLS.md)。Phase 18 已由使用者手動確認，包括重複骰 fixture 修復、R1／R2／R3、MISS、非法操作、刷新、終止戰鬥及 PostgreSQL 重啟。

## Phase 19 交付紀錄

已加入 `TEST-skill-2` 多回合直接施法工程定義（18 MP／3 回合／每回合 6 MP），角色權威 `currentMp` 與 CombatState 依 `actorId` 持有的詠唱進度。開始先檢查完整 18 MP 與已學／已裝備，再扣 6 MP；繼續各扣 6 MP；最後一次只記錄「詠唱完成」。開始／繼續／完成均沿用 Phase 11 回合推進，revision 各加一次。取消清除詠唱、不退 MP、不扣新 MP，暫時不推進 Turn；此點明確列為 **Provisional engineering behavior（NOT locked canonical gameplay rule）**，見 [未解問題](OPEN_QUESTIONS.md)。施法中其他主要行動由後端拒絕；敵方回合不改 MP 或進度。

`game_states.snapshot` JSONB 保存 MP、詠唱、最近機械行動、Round／actor 與 revision；靜態 TEST 法術定義留在程式目錄，沒有 migration。已知 `TEST-character` 舊快照可補 24 MP 與空詠唱；正式角色的 MP／Save 格式升級需另訂版本政策。UI 顯示 MP、已裝備法術、完整成本門檻、開始確認、詠唱進度、繼續／取消及完成結果。沒有命中、傷害、成功率、反噬或 LLM。實作與手動測試見 [Phase 19 文件](PHASE_19_MULTI_TURN_CASTING.md)。工程檢查：`npm run build`、`git diff --check` 通過；`npm test` 在獨立 `ai_trpg_phase19_test` PostgreSQL 資料庫共 197 項通過、0 失敗、0 略過。實際停止並重啟 API 後，MP、詠唱 1/3、已投入 6、revision／actor／Round 保持，且 R2 可繼續至 2/3。瀏覽器、手機與鍵盤其後已由使用者手動驗收；Phase 19 已確認。

## Phase 20 交付紀錄

新增通用的逐目標 row-based AoE 解析：後端由玩家所選敵方排取得全體目標，每位目標分別擲攻擊／閃避，單一行動一次保存結果、一次推進 Turn 與增加 revision。首個使用者可操作能力只有龍裔天生能力「龍息」。龍息依角色權威種族與固定元素判定資格，使用 D20 + PER，命中後才判 raw 19／20 暴擊；R1 用後 R4 可再用。獨立 `racialAbilityCooldowns` 不與物理技能冷卻混用，也不佔六格、不扣 MP、不詠唱。空排、冷卻、進行中詠唱、舊 revision、額外欄位及終止戰鬥均安全拒絕。擲骰失敗不提交部分結果。

元素、冷卻及最近逐目標裁定保存於既有 JSONB；已知 TEST 舊角色補固定火元素，未知正式舊角色保持未解決，舊 CombatState 補空冷卻。沒有 migration、傷害、HP、護甲或 LLM。介面新增緊湊「天生能力」及選排操作，開啟／取消不寫權威狀態。詳細規則與手動清單見 [Phase 20 文件](PHASE_20_AOE_DRAGON_BREATH.md)。工程檢查：`npm test` 在獨立 `ai_trpg_phase20_test` PostgreSQL 資料庫共 209 項通過、0 失敗、0 略過；`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run`、`git diff --check` 通過，dry run 無待執行 migration。手機、鍵盤、遊戲操作與 API 重啟仍待使用者手動確認。Phase 21 尚未開始。
