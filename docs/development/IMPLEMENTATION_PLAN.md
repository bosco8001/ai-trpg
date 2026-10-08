# 已批准的 Implementation Phase Plan

## 當前小切片（2026-10-08）

**Phase 33 第五切片：角色建立與保存，首版外部工程 FAIL、同切片補修待複驗，使用者待驗收。** 使用者以「對」批准 [完整實作確認稿](PHASE_33_CHARACTER_CREATION_PROPOSAL.md)，並授權限定 35 檔提交及交接；已推送 `30cf31fd3fba1d43c5e0c0428d01af20ac421e3a`。Grok t48u 回報 build exit 2（D1：測試型別）；全套隔離 PG 為 451 pass／2 fail（D2：期望值），新 7 個 PG 測試全部 pass；無 DB 401 pass／2 fail／48 skipped。診斷 dist 的 runtime／Chrome 結果不能代替正式 UI PASS；N2 短螢幕 Low、六項新 Info 與歷史限制保留。D1／D2／N2 補修已準備，使用者已於 2026-10-08 授權限定七檔 commit／push 與正式 build 複驗，提交前尚未推送或送達。Codex 未執行測試；遊戲規則／保存與 API 契約未改。正式版多角色與列表是後續必做，起始技能／裝備／熟練及正式冒險另分切片。完整結果、檔案與手動清單見 [第五切片交付](PHASE_33_CHARACTER_CREATION.md)。

**2026-10-07 第四切片：正式推導模組與唯讀樣本核對，Grok t47u 外部工程 PASS（限 Chrome）、使用者已接受。** 使用者確認裝備／職業提高容量不恢復目前值、降低時只截超出部分後，指示「進入下一切片」，批准 [提案](PHASE_33_DERIVATION_IMPLEMENTATION_PROPOSAL.md) 的完整範圍。新增正式五族 v2／四職業 v1 推導、唯讀計算 API 與系統面板核對 Sheet，新增 8 項測試；已提交／推送並送達 `bb930080ac917a90fc2f6bdf0ecca888ebfcbe87`。Grok 外部回報名冊／推導測試 20／20、無 DB 385 pass／0 fail／41 skipped、隔離 PG 428／428；6 項 Info 與未測限制保留。Codex 沒有執行本輪 build 或測試。正式角色／存檔／戰鬥不改接，原型保留修訂前算法與歷史結果。完整檔案、介面及手動清單見 [第四切片](PHASE_33_CHARACTER_DERIVATION.md)。

**第三切片：獨立角色推導原型，Codex 親測工程 PASS、使用者已接受。** 使用者於 2026-10-07 明確指示本次親測，原型 9／9、五族 × 四職業 20 組與補修後 60 組 Chrome 畫面檢查通過，build 成功，全套無 DB 377 pass／0 fail／41 skipped；原本短螢幕大字操作列超出畫面問題已在 index.html／style.css 修正，歷史失敗與未測限制保留。原型只操作 Lv.1 記憶體樣本，不改正式角色、存檔或 UI；先種族後職業、最終屬性及上限差額規則已記錄，原型接受當時，下降超出合法下限仍待確認；後續曾選 B，未實作；其後已撤回，最新容量政策見上段。正式同步尚未接入；原型接受當時沒有 Grok 結果或 commit／push，其後於 `bb93008` 封存，舊算法未改。本次例外不延伸後續階段。範圍、親測來源與限制見 [第三切片](PHASE_33_CHARACTER_DERIVATION_DISCUSSION.md)。使用者同日明確回覆「接受這原形」，依此記錄本獨立原型已接受；不是正式 R05 或整個 Phase 33 完成，也不授權正式角色整合或提交。以下第二切片紀錄中的「未開始下一切片」為接受當時狀態。

使用者已指定「做四個初階職業的正式名冊與唯讀核對畫面」。[Phase 33 第二切片](PHASE_33_CLASS_CATALOG.md) 收錄劍士、弓箭手、斥候、魔術師的正式 metadata，採獨立職業名冊 v1 與已接受的手機 Sheet 設計方向；不接入轉職、創角、配裝或戰鬥被動。首版 `6dfa95e1d84cb1c7ef0a1aa64be13919f3cf8316` 已按限定 17 檔授權提交／推送並送達；Grok t46u 外部工程 FAIL（Chrome）：D1 High、D2／D3 Medium、D4 Low。使用者其後明確指示本次補修由其親自驗收，回報 build 成功、377 pass／0 fail／41 skipped，並於 2026-10-06 回覆第二切片通過，依此記錄已接受。本次沒有補修 Grok PASS；歷史 FAIL、Info、略過與未測限制保留，Codex 未執行測試。補修接受當時，紀錄仍未 commit／push、新增 main.tsx 的限定 Git 範圍尚未授權，未開始下一切片；其後使用者另授權限定 31 檔，前置補修隨 `bb93008` 提交，t47u 只記錄回歸觀察，不改寫本次驗收。後面的「下一切片尚未開始」為先前第一切片接受時的歷史狀態。

Phase 1–32 已由使用者確認驗收；Phase 26 於 2026-09-30、Phase 27／28／29 於 2026-10-01 回報手動測試通過，Phase 30 於同日確認「R02通過」，Phase 31 於 2026-10-03 回覆「Phase 31通過」。Phase 28 唯讀資料健康檢查的驗收版本為 `d2b400bdc0e22369be4188c05ff7ffa2d9a4720f`。R03 第一階段於 2026-10-02 批准為 Phase 31，持久備份與準備已交付並接受；第二階段 [完整契約](R03_SECOND_STAGE_PROPOSAL.md) 已於 2026-10-04 批准，依使用者選定順序，文件工程審查已完成；使用者另回覆「開始實作」，Phase 32 已於 2026-10-04 由使用者驗收通過。

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
| 28 | 唯讀目前狀態／三槽存檔健康檢查 |
| 29 | 手動下載目前資料／三槽的完整原始備份（已由使用者手動驗收通過） |
| 30 | 活動標記／MP 相容欄位的完整修復候選與唯讀預覽（已由使用者確認驗收通過） |
| 31 | 持久修復前備份、準備識別碼、查詢與下載（已由使用者確認驗收通過） |

每個階段開始前先解釋範圍與測試方式，依 [AGENTS 第 4 節](../../AGENTS.md#4-測試交由-grok-bot階段驗收由使用者決定) 將測試與工程驗證交給 Grok Bot，再由使用者確認階段是否接受才繼續。Phase 3 先以記憶體檢查 domain，Phase 4 才驗證重啟後仍能載入。Responsive 從 Phase 2 建立；persistence 從 Phase 4 貫穿後續功能。以下歷史工程紀錄保留其實際來源。

2026-10-01 的後續盤點見 [Phase 27 之後的工作清單與建議順序](POST_PHASE_27_ROADMAP.md)，未定規則與承諾見 [OPEN_QUESTIONS](OPEN_QUESTIONS.md)。R01–R39 是工作索引，不是 phase 編號；R01 的唯讀診斷作為 Phase 28 已驗收，原始備份另拆為 Phase 29 並已驗收。R02 作為 Phase 30 已驗收；R03 第一階段作為 Phase 31 已驗收，其餘小項未自動獲批准。

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

建立後端專用的 `LanguageModel` 介面、文字請求／結果型別、adapter 邊界與可注入的逾時設定。外部回應一律先以 `unknown` 接收，再檢查為非空純文字；格式錯誤、服務不可用與逾時只產生固定的中立錯誤。固定回應 adapter 不連網、不需要金鑰，可供後續 application 測試替換。固定回應模型的工程檢查入口見 [LLM 檢查腳本](../../src/server/llm/check.ts)。

新增 `src/server/llm/contracts.ts`、`language-model.ts`、`fake-adapter.ts`、`check.ts` 與 `tests/llm.test.ts`。修改 `package.json`、`README.md`、`OPEN_QUESTIONS.md` 與本計畫。沒有新增 npm 套件、環境變數或前端 API；實際供應商／模型仍未定。

`npm run build` 通過；`npm test` 共 23 項，其中 22 項通過、需明確提供隔離資料庫的既有整合測試略過。四種 `npm run llm:check` 情境均以本機 fake 執行成功。Phase 5 其後已由使用者手動確認。

## Phase 6 交付紀錄

將 Phase 1／2 的連線頁演進為第一個可操作的文字探索介面。固定測試敘事、玩家輸入與系統測試回覆以 local UI history 顯示；Enter 送出、Shift+Enter 換行，空白輸入不建立紀錄。API 健康狀態保留為頁首輔助資訊。畫面重用既有 semantic tokens、Button、Panel、焦點環與 reduced-motion 設定。當時的交付範圍與測試項目見 [Phase 6 文件](PHASE_6_EXPLORATION.md)。

新增 `src/web/exploration.ts`、`src/web/ExplorationPage.tsx`、`tests/exploration.test.ts`、`docs/development/PHASE_6_EXPLORATION.md`。修改 `src/web/App.tsx`、`src/web/style.css`、`README.md` 與本計畫。沒有修改 domain、PostgreSQL schema、LLM adapter 或 canonical 文件。

`npm run typecheck`、`npm run build` 通過。`npm test` 共 28 項，其中 27 項通過、需隔離資料庫的既有 integration test 略過。Phase 6 其後已由使用者手動確認。

## Phase 7 交付紀錄

加入後端探索文字解析服務：玩家文字經 Phase 5 中立 `LanguageModel` 介面及固定測試 adapter，經嚴格 runtime validation 才形成 candidate action。解析 API 與探索頁顯示「候選解析（固定測試）」、歧義澄清或未支援；沒有執行 domain 命令或保存資料。輸入上限 500 字屬工程限制，不是遊戲規則。當時的交付範圍、固定測試句與預期解析見 [Phase 7 文件](PHASE_7_INTERPRETATION.md)。

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

元素、冷卻及最近逐目標裁定保存於既有 JSONB；已知 TEST 舊角色補固定火元素，未知正式舊角色保持未解決，舊 CombatState 補空冷卻。沒有 migration、傷害、HP、護甲或 LLM。介面新增緊湊「天生能力」及選排操作，開啟／取消不寫權威狀態。詳細規則與手動清單見 [Phase 20 文件](PHASE_20_AOE_DRAGON_BREATH.md)。工程檢查：`npm test` 在獨立 `ai_trpg_phase20_test` PostgreSQL 資料庫共 209 項通過、0 失敗、0 略過；`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run`、`git diff --check` 通過，dry run 無待執行 migration。Phase 20 已由使用者完成 Memory、cooldown、casting guard、refresh、PostgreSQL API restart、mobile 與 keyboard 全部手動驗收。Phase 1–20 已由使用者確認。

## Phase 21 交付紀錄

Phase 21 新增 server-derived Party 讀取與 tactic catalog，以及只接受 `expectedRevision`、`companionId`、`tacticPreferenceId` 的嚴格偏好變更 API。TEST companion 只存在於 Party state，不加入 `CombatState.turnOrder`。TEST A／B 是沒有戰鬥語意的工程 fixture；正式戰術名稱、數量與語意保持未定。隊友缺少權威 level、row、HP、MP 時 UI 明確顯示未接入，不填造數值。

偏好變更在 active combat 的任一 actor 回合都可使用，也允許 active casting 期間修改。成功時 revision 只增加一次，偏好 ID 更新；actor、Turn、Round、`lastAction`、casting、MP、技能／種族冷卻、inventory 與 row 均不變。同一偏好是 no-op、不增加 revision。Ended combat 保留 Party 唯讀，偏好修改安全拒絕。開啟／關閉只作用於前端，不變更狀態或 revision。

GameState snapshot 將 party preference 存入既有 PostgreSQL `game_states.snapshot` JSONB，沒有新增 migration；Save Format v1 與 active-combat Save／Load safeguard 不變。舊 Phase 1–20 TEST snapshot hydrate 後獲得確定性 TEST 隊友／A 偏好；其他角色不會被補入 TEST party 或生產預設偏好。正式 catalog 定義屬靜態 gameplay design/data，玩家當前選擇屬 runtime mutable state。完整 API、Memory、敵方回合、casting、refresh、stale／注入、PostgreSQL、mobile、keyboard 指令見 [Phase 21 文件](PHASE_21_PARTY_TACTICS.md)。

工程檢查：`npm test` 對隔離 `ai_trpg_phase21_test` 執行，共 222 項通過、0 項失敗、0 項略過；包含 Phase 18–20 regression 與新 repository／session 的 PostgreSQL 偏好保存重載測試。`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run` 與 `git diff --check` 通過；dry-run 沒有待執行 migration。Phase 21 其後已由使用者完成手動驗收並 commit。

## Phase 22 交付紀錄

TEST 隊友現在於新戰鬥建立為共用 CombatParticipant，使用 D20 + DEX 擲一次先攻並按既有平手重擲規則加入 turnOrder。玩家可操作指令明確排除隊友；TEST advance 不能略過隊友。`POST /api/combat/companion/act` 僅接受 revision，伺服器每次從最新 GameState 讀偏好、呼叫可替換的 deterministic policy，接著以現有目標限制、物理命中／閃避及 Turn helper 執行，單次保存 action、推進 Turn、revision +1。

Phase 22 工程 policy 暫定 **TEST-tactic-a = 普通攻擊（無合法目標時防禦）、TEST-tactic-b = 防禦**，只供接通驗證，並非正式 canonical tactic semantics。`null`／未知／不支援偏好安全拒絕，不擲骰、不改狀態。攻擊只記 hit／miss，防禦只記主要行動，沒有 HP、傷害、減傷、LLM 決策或 Phase 24 節奏動畫。

CombatState 與 party preference 繼續放在既有 JSONB snapshot，無 migration。舊 active combat hydrate 後保留原名冊，不插入隊友；只有新開戰才加入。Phase 11–21 三人名冊測試明確使用舊 fixture 驗證原規則；新四人測試驗證隊友行動與保存。手動驗收指令見 [Phase 22 文件](PHASE_22_SEMI_AUTO_COMPANION.md)。Phase 22 其後已由使用者手動確認並 commit。

工程檢查：`npm test` 使用獨立 `ai_trpg_phase22_test`，232 項通過、0 失敗、0 略過；`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run`、`git diff --check` 通過，dry-run 無待執行 migration。另以同一隔離資料庫實際停止／重啟 API，重啟後完整讀回隊友先攻、順序、偏好、最近行動、Round、actor 與 revision，並繼續推進戰鬥。瀏覽器、手機、鍵盤其後由使用者完成手動驗收。

## Phase 23 交付紀錄

正式戰鬥 action 的 domain transition 與既有 session/repository 保存先完成，才從成功結果的 `lastAction` 建立最小 `CombatNarrationFacts`。`CombatNarrationService` 沿用 Phase 5 `LanguageModel`、Phase 9 的 fake fixture mode 與逾時方式，要求模型回傳 exact `{ "text": "..." }` JSON。輸出經長度、形狀與基本事實一致性驗證；模型故障或錯誤輸出直接使用由已確認事實組成的 deterministic fallback。成功 action 的 response 同時包含原本權威 `effect`／`state` 與非權威 `narration`。拒絕、讀取、TEST advance、Party 偏好修改及 repository save 失敗不呼叫模型。

支援普通攻擊、換排、物品、防禦、逃跑、物理技能、四種詠唱階段、龍息逐目標結果與隊友攻擊／防禦。敘事 actor 取自 `lastAction.actorId`，不取已推進的 current actor。未實作的傷害、HP、治療、防禦減傷、法術成功與死亡不得敘述。Combat UI 的 AI 區只顯示當次成功回應，與系統機械裁定分開；刷新與 hydrate 不重叫 LLM。AI prose 不進 `CombatState` 或 PostgreSQL `game_states.snapshot`，沒有 migration、額外 revision 或敘事保存 endpoint。正式 provider、歷史保存仍未定；完整命令見 [Phase 23 手動驗收文件](PHASE_23_AI_COMBAT_NARRATION.md)。Phase 23 已由使用者手動確認並 commit。

工程檢查：`npm test` 使用獨立 `ai_trpg_phase23_test` PostgreSQL 資料庫，242 項通過、0 失敗、0 略過；`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run` 與 `git diff --check` 通過，dry-run 無待執行 migration。專門整合測試以新 pool／repository／session 讀回模型故障後已提交的機械狀態，並確認 snapshot 無敘事欄位。Phase 23 其後已由使用者手動驗收並 commit。

## Phase 24 交付紀錄

前端新增獨立 NPC 節奏控制器：從權威 GameState 判斷目前角色，以暫定呈現停頓安排既有 TEST advance 或 companion action。玩家回合、ended combat、非 sandbox 敵人與不支援 NPC 都不自動送 mutation。成功回應先採用伺服器狀態與 Phase 23 敘事，再讓結果停留、輪轉 chip 與戰場高亮；前端不改 `turnOrder`、Round、骰值或 `lastAction`。每個 `revision:actorId` 只送一次、同時只允許一個自動 mutation；StrictMode cleanup、舊 timer／舊回應、stale revision、refresh 與網路故障有獨立處理。動畫、計時與節奏 phase 不保存，無 migration。完整流程及手動指令見 [Phase 24 文件](PHASE_24_TURN_PACING.md)。Phase 24 已由使用者手動確認並 commit。

工程檢查：`npm test` 在隔離 `ai_trpg_phase24_test` PostgreSQL 資料庫執行，254 項通過、0 失敗、0 略過；`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run`、`git diff --check` 通過，migration 後 dry run 無待執行項目。另於隔離 `ai_trpg_phase24_restart` 以實際 API process 停止／重啟驗證 revision 6、Round 2、玩家 actor、turnOrder、lastAction 與戰術偏好讀回一致。Phase 24 其後已由使用者手動驗收。

## Phase 25 交付紀錄

所有戰鬥參與者新增權威 HP／生命狀態。僅已知 TEST 角色可使用明確標示的工程 HP fixture；未知舊參與者若缺 health 會安全拒絕。generic damage transition 負責扣 HP、進入瀕死／死亡、中斷詠唱、勝敗與回合行動者正規化；正式武器、技能、法術與龍息傷害公式仍未定案。瀕死者只在自己的回合倒數並自動跳過；死者保留在名冊與回合順序但不可行動或一般受擊。玩家可手動選擇瀕死隊友救助，隊友在自己的回合按剩餘回合、玩家身分與 turnOrder 固定排序優先救助。每次成功 transition 只增加一個 revision；冷卻與排位保留。勝敗優先序、TEST 傷害入口、Phase 23 已確認事實敘事、Phase 24 自動節奏、React HP／救助畫面與 JSONB 保存均已接通。沒有關聯式 schema 變更或新 migration。完整操作與預期結果見 [Phase 25 手動驗收文件](PHASE_25_DYING_RESCUE_DEATH.md)。Phase 25 已由使用者完成並確認手動驗收；Phase 26 工程交付見下節。

工程檢查：`npm test` 使用隔離 `ai_trpg_phase25_test` PostgreSQL 資料庫，272 項通過、0 失敗、0 略過；`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run` 與 `git diff --check` 通過。Dry-run 顯示沒有待執行 migration。Phase 25 手動驗收其後已由使用者完成並確認全部通過。

## Phase 26 交付紀錄

依 [完整已接受規格](PHASE_26_FINAL_SPEC.md) 與 [Canon 追溯索引](PHASE_26_CANON_INDEX.md)，完成 Persistent Party → Combat → ended → Settlement → Exploration。Participant 明確映射長期 Character；Start 繼承資源，結算集中處理 active／dying／dead、Party order／物品保留、來源 Encounter 與 return context，revision 只加一次。Game Over 不結算；結果頁需明確繼續。永久 capacity 僅保留必要 domain 契約，不新增玩家玩法。

PostgreSQL Gameplay／History／Load／Reset 共用短 row-lock 邊界，持久化 generation、allocator 與 first-write-wins Entry 身分帳；migration 提供 run identity 與敘事去重保障。Save Format v2 保存完整 mutable Gameplay 與已保存 History；Load 同 run、revision 前進、新 generation、CombatId 與 Entry provenance 保留。舊 v1 已知 TEST 映射保留原列，缺必要 world references 則 migration-blocked。前端接通 Continue／blocking recovery／Game Over／系統存檔／探索 History；timeout／conflict 不自動重送 mutation。

工程檢查：審查修正後，隔離 `ai_trpg_phase26_review_test` PostgreSQL 的 `npm test` 312 項通過、0 失敗、0 略過；typecheck、build、全新與已套用 migration dry-run、diff 檢查通過；實際 API 程序三次重啟與四種 Memory TEST 情境產生器通過。完整證據及限制見 [驗證紀錄](PHASE_26_VERIFICATION.md)，逐節對照見 [實作對照](PHASE_26_IMPLEMENTATION_MAPPING.md)。

[審查修正紀錄](PHASE_26_REVIEW_FIXES.md)：H1／M1／M2／L1 已重現及修正；無 DB 為 288 通過、24 略過。詠唱中勝利、結果頁 Save／Load、三次 API 重啟、結算及下一場 MP 18/24 已通過工程檢查。

**Phase 26 已由使用者於 2026-09-30 確認手動測試通過。** 驗收版本：`a52aee0565d95a8c9e04d1f39128dc71e706fec9`。使用者回報「手動測試也通過了」；判定來自使用者，代理沒有代替使用者驗收。[驗收紀錄與重測清單](PHASE_26_SETTLEMENT_ACCEPTANCE.md)。使用者已 commit／push 修正版本，代理未自行 commit／push；Phase 27「完整手機戰鬥介面 polish」的工程交付見下節。FUTURE REQUIRED Repair、Persistent Settlement／Combat History／Statistics／Replay、Reward、Narration delivery／recovery／versioning、Resurrection、Persistent Enemy／Encounter composition、Persistent statuses／Formation 與 world time open commitment 均保留。


## Phase 27 交付紀錄

2026-10-01：手機戰鬥介面調整完成，使用者其後已確認手動測試通過。緊湊 HUD、可橫向捲動順序、戰場／指令捷徑、敵人編號及 HP 條、可收縮角色卡、三欄基本指令與獨立救助列已接通；隊伍彈窗改為單一捲動，補上 viewport safe area、觸控與大文字處理。系統判定在戰場下方，操作欄以敘事、主角／戰況、詠唱、技能、指令排列。沒有變更 domain、API、資料庫或遊戲數值。

檔案、實機啟動與手動驗收清單見 [Phase 27 文件](PHASE_27_MOBILE_COMBAT.md)。`npm run build` 通過；`npm test` 288 通過、24 個 PostgreSQL 項目跳過、0 失敗。靜態 DOM 在 320／375／430px、橫向、桌面、200% 字級、多隊友彈窗與結果頁無橫向溢出。這些工程結果不代表實機觸控、節奏或手動驗收通過。既定計畫到 Phase 27 為止，後續範圍由使用者另行決定。

使用者其後提供 Grok 對 `codex/phase27-mobile-ui` 的 `7e7428cb73e88f2074548ffe8ac2d9287caf06c2` 外部測試報告：以 Chromium／實際 Vite 與 API／隔離 PostgreSQL 17 比較基準 `a52aee0`，未發現阻擋手動驗收的缺陷；該外部報告不代替使用者驗收。外部報告與限制記錄於 [Phase 27 文件](PHASE_27_MOBILE_COMBAT.md)。文件修正補齊 Phase 26 驗收紀錄，舊階段頁面改指向本計畫，交付指南在 manifest 中明列為非 Canon。**Phase 27 已由使用者於 2026-10-01 確認手動測試通過。** 驗收版本為 `7e7428cb73e88f2074548ffe8ac2d9287caf06c2`；使用者原文：「手動測試後phase 27通過」。驗收判定來自使用者，與外部工程檢查分開記錄。此紀錄不代表分支已合併；後續階段狀態以本文件開頭及各階段紀錄為準。

## Phase 28 交付紀錄

新增唯讀資料健康檢查：目前配置角色與三個存檔槽各自顯示正常、空槽、缺資料、不合法、版本不支援或目前無法讀取。入口位於探索／戰鬥／結果／主選單的系統面板，以及初始權威狀態讀取失敗畫面。

獨立 SELECT 路徑避免 session 初始化與舊資料映射寫回；診斷不呼叫 Save／Load／Reset、回合推進或結算。沿用既有 domain 與 Save 驗證器，不備份、不修復、不改玩法。報告不是跨資料原子快照，健康狀態亦不保證能在目前 Run 載入。

`npm run build` 通過；新建隔離 PostgreSQL 15 的完整工程測試 324 項通過、無略過。診斷連線強制唯讀，重複檢查並比較所有原始列；未初始化、寫入或改寫錯誤資料。瀏覽器工程檢查確認正常與失敗入口能讀取獨立報告。

完整檔案清單、工程限制與隔離錯誤樣本見 [Phase 28 手動測試指南](PHASE_28_DATA_DIAGNOSTICS.md)。使用者其後確認手動驗收通過，詳見下方紀錄；該次交付當時尚未開始原始備份或修復，目前狀態見 Phase 29 紀錄。

使用者其後提供 Grok 對 `068ae7cd39a9719aed246de02afb4e88dd26375a` 的外部報告：沒有阻擋驗收、高或中嚴重度缺陷，提出三組低嚴重度事項。已在同一 Phase 28 修正舊文件狀態、診斷查詢逾時與無障礙提示；修正版建置通過，隔離 PostgreSQL 15 的 325 項測試通過。詳見 [Phase 28 外部審查後修正](PHASE_28_REVIEW_FIXES.md)。外部報告與本次工程檢查均不代表使用者已接受 Phase 28。

第二次外部複查 `67d2d87b95eadf0ed58cef5f6868fc39cbd6da6f` 確認 L1–L3 已解決，另提出 N1／N2 低嚴重度問題。已在同一階段保留 `PGOPTIONS` 的既有優先順序，並讓重新檢查按鈕在忙碌時保持鍵盤焦點、阻止重複觸發。建置通過，隔離 PostgreSQL 15 的 326 項測試通過；焦點與重複 Enter 已做瀏覽器工程檢查。修正交付時仍待使用者手動驗收，備份尚未開始。

使用者再提供 Grok 對 `d2b400bdc0e22369be4188c05ff7ffa2d9a4720f` 的外部複查報告：N1／N2 已解決，沒有新缺陷或阻擋手動驗收的問題，隔離 PostgreSQL 17 的 326 項測試通過。外部報告與使用者驗收分開記錄，詳見 [Phase 28 修正紀錄](PHASE_28_REVIEW_FIXES.md)。

**Phase 28 已由使用者於 2026-10-01（Asia/Hong_Kong）確認手動測試通過。** 驗收版本為 `codex/phase27-mobile-ui` 的 `d2b400bdc0e22369be4188c05ff7ffa2d9a4720f`；使用者原文：「Phase 28 手動測試通過」。此處只記錄使用者整體驗收結論，不補寫未提供的逐項結果；不代表分支已合併，也不批准原始備份或修復的後續實作。驗收當時建議下一個討論小項為原始備份；使用者其後已另確認並要求實作，詳見下節。

## Phase 29 規格確認與交付紀錄

2026-10-01（Asia/Hong_Kong），使用者同意以目前配置角色資料與三槽的單一 JSON 下載作為下一小階段，要求先逐項討論再實作。六項選擇依序為 A、A、B、A、A、A：完整原始內容與已保存敘事、10 MiB 完整檔案上限、30 秒整次接收上限、失敗手動重試、檔內 SHA-256 校驗值、備份期間可繼續遊戲。

完整範圍、原始資料保留、一致唯讀快照、失敗處理與待驗收目標見 [Phase 29 規格](PHASE_29_RAW_DATA_BACKUP_SPEC.md)。使用者自訂上限 UI 只列為後續待評估；備份不送給 LLM。該次討論只記錄規格，沒有程式實作或工程測試，也沒有批准還原、修復候選或套用。

使用者其後要求「實作phase 29」。已加入獨立唯讀原始備份路由、單一 SELECT 的 PostgreSQL 一致快照、同步記憶體擷取、原始 JSON 文字保存與有界限的編碼／接收、SHA-256 驗證，以及獨立前端下載／取消入口。不要求一般遊戲狀態、健康檢查或存檔清單成功；不改玩法、migration 或原有寫入路徑。

`npm run build` 通過；無 DB 測試為 341 項、310 通過、31 略過、0 失敗；新建隔離 PostgreSQL 15 的 341 項測試全通過。新增 15 項備份測試包含原始精度、完整拒絕、取消、並行快照及生命週期不變。工程檢查不代替使用者驗收；交付當時等待手動驗收，使用者其後已確認通過，見下方紀錄。格式、限制與步驟見 [Phase 29 交付與測試指南](PHASE_29_RAW_DATA_BACKUP.md)。

使用者其後提供 Grok 對 `e8865532b0702a51880e42beaad97929459451fd` 的外部審查：沒有阻擋手動驗收、高或中嚴重度問題，隔離 PostgreSQL 17 的 341 項測試通過；提出低 L1，取消連線不保證資料庫查詢立即停止。本次只將文件改為自查詢開始計算的兩秒 statement timeout 上限，並記錄其他工程限制，沒有程式變更。外部報告與文件修正不代表使用者驗收；修正交付當時仍待手動驗收，使用者其後確認通過，詳見 [交付指南的外部審查紀錄](PHASE_29_RAW_DATA_BACKUP.md#外部審查與-l1-文件修正)。

**Phase 29 已由使用者於 2026-10-01（Asia/Hong_Kong）確認手動測試通過。** 使用者原文：「Phase 29 手動測試通過」。回報時本地分支 `codex/phase27-mobile-ui` 的 HEAD 為 `7960c9ba33aaa10d8b3ecaee1bfc37fd06e9694f`，包含實作 commit `e8865532b0702a51880e42beaad97929459451fd` 與 L1 文件修正；這是專案版本對照，使用者未另指定其測試 SHA 或逐項平台／環境。本紀錄只記錄整體驗收結論，不補寫未提供的逐項結果，也不代表分支已合併。該次驗收時，下一個建議討論的小項為有限修復候選與唯讀預覽，尚未批准或開始實作。其後已另行批准 Phase 30，見下方紀錄。


## Phase 30 規格確認與交付紀錄

使用者逐項選定：同份原稿證據、既有合法欄位同步、活動標記與玩家 MP 相容欄位、兩項合併成完整候選、目前資料與三槽獨立分析、受阻不提供局部差異、逐欄前後值／規則／證據／整筆驗證、已知變動失效後手動刷新，以及正常系統面板與初始讀取失敗入口。使用者其後選擇同意完整規格並實作。批准範圍見 [Phase 30 規格](PHASE_30_REPAIR_PREVIEW_SPEC.md)。

本階段完成唯讀原始資料讀取、精度及完整候選驗證、指紋、四項獨立報告、取消／逾時與過期守衛。沒有補缺值、套用、寫入、Load 暗中修正或 LLM 猜測。後端專用查詢及前端接收均有界限，舊格式／其他錯誤保留受阻。

`npm run build` 通過；無 DB 的 358 項測試為 324 通過、34 略過、0 失敗；全新隔離 PostgreSQL 15 的 358 項全部通過。正常／失敗入口、手機 DOM 尺寸、焦點、快速重複請求、取消／收起與 Save 指定槽失效已做工程檢查。完整檔案範圍、限制及隔離樣本見 [Phase 30 交付與測試指南](PHASE_30_REPAIR_PREVIEW.md)。

使用者其後提供 Grok 對 `7855ef485013241f7b7f39b991d412f89dd86353` 的獨立工程審查：沒有可證實的缺陷或阻擋手動測試的問題；隔離 PostgreSQL 17 的 358 項測試全部通過，無 DB 為 324 通過、34 略過、0 失敗。本次核對本機 HEAD 與報告目標 SHA 相同；只記錄外部結果，沒有重新執行其測試或修改程式。測試覆蓋缺口、全域槽角色範圍及未驗證項目見 [Phase 30 外部工程審查紀錄](PHASE_30_REPAIR_PREVIEW.md#外部工程審查紀錄)。

外部審查紀錄交付時 Phase 30 仍待使用者驗收。使用者其後於 2026-10-01（Asia/Hong_Kong）回報：「好，R02通過，我們進入R03。記得測試方面永遠交給Grok Bot，你不需要親自測試。」**Phase 30 已由使用者確認驗收通過。** 回報時本機 HEAD 為 `7855ef485013241f7b7f39b991d412f89dd86353`，另有未提交的外部審查文件紀錄；使用者未另指定測試 SHA 或逐項環境，不補寫未提供的結果，也不代表分支已合併。後續測試分工依 AGENTS 第 4 節執行。

## R03 規格討論

使用者已要求進入 R03，十項選擇見 [討論紀錄](R03_REPAIR_APPLY_DISCUSSION.md)。2026-10-02 回覆「A，同意實作，實作後幫我push」，批准第一階段完整範圍，並授權該次實作後 commit／push。當時套用階段未批准；其後於 2026-10-04 另行批准 [第二階段完整寫入契約](R03_SECOND_STAGE_PROPOSAL.md)，文件工程審查已完成；使用者另回覆「開始實作」，Phase 32 已於 2026-10-04 由使用者驗收通過，沒有延伸該次 Git 授權。

## Phase 31 規格確認與交付紀錄

批准範圍見 [完整確認稿](R03_FIRST_STAGE_PROPOSAL.md)：目前資料與三槽每次一份、系統保存完整原稿、PG／Memory 持久保存、保留全部及下載、配置角色核對、同角色合法舊 Run／其他 world、繼續遊戲、唯一識別碼與手動查詢、先備份後套用的分段流程。第一階段只做備份與準備，不做套用。來源 10 MiB、完整封裝 32 MiB、總容量預設 1 GiB、30 秒接收及故障拒絕均在批准範圍。

實作新增版本化備份契約、兩種持久 archive、準備／查詢／列表／下載 API、新備份表 migration、正常及讀取失敗入口、待執行測試及隔離 helper。完整格式、故障語義及變更範圍見 [Phase 31 工程交付](PHASE_31_REPAIR_PREPARATION.md)。沒有 domain、一般 Save／Load 或 LLM 改動。

原交付時待 Grok Bot 工程驗證及使用者接受；後續外部報告、同階段修正與文件核對各自保留來源及版本，見 [Phase 31 工程交付](PHASE_31_REPAIR_PREPARATION.md)。不沿用歷史測試數字作為新執行結果。

**Phase 31 已由使用者於 2026-10-03（Asia/Hong_Kong）明確回覆「Phase 31通過」。** 回報時本地 HEAD 為 `861285030dd8e9dabdff2e21649807073cbe450b`，包含 `e2d4620f8334cf649cf05612b8ebbf2d541c9aeb` 安全日誌補修與外部審查紀錄；使用者未另指定測試 SHA 或逐項環境，不補寫未提供的結果，不代表分支合併或推送。既有 Info、待查觀察與未測限制繼續保留。R03 第二階段在當時仍須另行批准；其後已於 2026-10-04 批准並開始實作，見下方 Phase 32 紀錄。

## Phase 32 已由使用者驗收通過

使用者逐項及整體批准 R03 第二階段後，文件 `3d8df060162163b1fbb60873baf95e95b19ea709` 已送指定 bot 審查；外部回報文件一致性 PASS，提出三項 Low／四項 Info，可行性分析為推斷，沒有 runtime 測試。其後使用者明確回覆「開始實作」。

本輪寫入單份原子套用、原頁面二次確認、來源 token／PG epoch、唯一持久開始 ID、PG／Memory 成功／拒絕報告、未知結果手動查詢及下載。詳見 [Phase 32 交付與驗收](PHASE_32_REPAIR_APPLICATION.md)。首版 `20773e94735e09abbcbe3d0ecd7917006410af18` 的外部工程結果為 FAIL；補修 `ccb34631e2f21433463cea27c9874b131959867f` 經指定 bot 複驗，build 回 0、隔離 PG 四組 65／65 與完整 406／406 通過，H1 與 L-A 錯誤碼修正通過。L-A 部分成功邊界、L-B 保守未知政策、新 Low L-C、Info 與未測限制保留。

**使用者於 2026-10-04（Asia/Hong_Kong）明確回覆「phase 32通過」。** 使用者先回報目前資料保存／取消／套用／恢復畫面、重新整理後查詢及兩種下載、存檔 1 單份修復符合預期；其後另授權開發代理只親自驗證存檔 2 的同值覆寫與舊準備拒絕，這項隔離 UI 驗證 PASS，不能擴大為其他測試授權。驗收時本地 HEAD 為 `ccb34631e2f21433463cea27c9874b131959867f`，只作版本對照，使用者未指定測試 SHA 或完整本機環境，不補寫未提供的結果。沒有新增玩法、自動 migration、合併或部署；原驗收當時下一主要階段尚未開始。接受後容量提示小補修已依使用者限定授權及 `828d520` 外部工程 PASS 判定通過，歷史 FAIL、Info 與未測限制見 [Phase 32](PHASE_32_REPAIR_APPLICATION.md)。

## Phase 33：正式內容名冊第一步（R04 第一切片，2026-10-05 已由使用者接受）

使用者於 2026-10-04 要求「進入下一階段」。首個切片將 Race／Character 已定五種族創角資料放入有版本的正式名冊，與 TEST 目錄分開，加入嚴格未知引用拒絕及系統面板唯讀核對入口。沒有創角、屬性推導、種族能力、職業／物品／技能／法術正式內容、Save 版本遷移或資料庫改動；不是整個 R04 完成。

使用者另以「確認授權」批准首版十一檔限定 commit／push，`641b82f1686d24991e0d1da4ba9095b629995dcc` 已於 2026-10-04 20:49 HKT 送指定 AI TRPG Architecture Critic 並讀回確認。21:00 HKT 外部工程結論為未通過：探索頁名冊入口缺漏（Medium D1）、loader 先驗證後複製（Low D2）。外部 build／新測試 5／5／隔離 PG 全套 413／413 通過，不代表整體工程或使用者驗收通過。

同切片已補探索入口、改成先複製再驗證同份快照，並補 getter 與六項 mutation 缺口的相關案例；補修交付當時尚未執行，開發代理沒有自行執行 build／typecheck／測試／UI。首版授權限定十一檔，本次補修另涉及 ExplorationPage；使用者其後於 2026-10-04 回覆「授權補修 commit／push 並複驗」，另行批准限定七檔提交及送驗。

補修 `8792e15843fbfe02d9f035db27e9ef5e5d784b4a` 已於 21:17 HKT 送達指定 bot；21:27 HKT 外部工程結果為 PASS，D1／D2 修正確認、無新 High／Medium／Low。外部 build 成功、新測試 6／6、隔離 PG 全套 414／414 通過；production 探索頁入口實測通過，戰鬥／主選單 UI 僅非 production 回歸，production 仍受阻。六項指定 mutation 均被捕捉，但首版種族缺欄漏網屬等價 mutant 的判斷已更正；新增小數加成案例缺口與既有 Info／未測限制保留。完整來源與核對清單見 [Phase 33](PHASE_33_CONTENT_CATALOG.md)。本期當時仍待使用者接受，未開始下一切片；其後第一切片已接受，見本節末。

使用者其後在逐步核對中回報本機 build 成功、探索畫面與名冊入口／五族正常；未指定完整測試環境，不擴大為全部數值或階段驗收通過。使用者澄清：「全部角色的資質都是創角完成才揭曉，不用寫玩家可以是普通人或代行者」。依此更新 Character／Race Canon、五族揭曉資料及畫面文案，內容版本升為 2；資料格式版本維持 1，舊內容版本 1 查詢明確拒絕，不暗中回退至新版本或 TEST。固定加成、機率及施法資格規則未變，既有角色／Save 未接入名冊。使用者另於 2026-10-04 回覆「授權此次修正 commit／push 並送驗」，批准限定十一項檔案變更（包含名冊更名）。此修正與相關測試未由開發代理執行；交付當時待指定 bot 驗證，後續版本 2 的獨立結果見下，沒有沿用 `8792e15` 的版本 1 PASS。

版本 2 修正 `940e1f3ac9d6cda82f6c7d52c6e9cd1612ef85f2`（BASE `8792e15843fbfe02d9f035db27e9ef5e5d784b4a`）已於 2026-10-04 22:18:31 HKT 送達指定 bot；22:27:59／22:28:05 外部工程結果為 PASS，無新 High／Medium／Low。外部 build、新測試 6／6、隔離 PG 全套 414／414 通過；正式 production 探索 UI 的版本 2、五條創角後揭曉註記與指定句子移除均實測通過。UI 文案自動化測試缺口及來源物件 V2 未凍結的 Info、新舊限制保留；真手機／讀屏／正式遊玩未測，production 戰鬥／主選單入口仍受阻。詳見 [Phase 33 外部版本 2 結果](PHASE_33_CONTENT_CATALOG.md#內容版本-2-澄清補修外部工程-pass2026-10-04待使用者驗收)。本切片當時仍待使用者重新 build／重啟後繼續手動核對，未開始下一切片。

使用者其後回報重新啟動成功、新版文案正常與五族數值正常；操作核對尚未回報全數通過。使用者要求 apple-design 排版原型並將屬性格縮小，再選定「先用這個設計吧，五族數值正常」。同切片正式整合緊湊六屬性網格、資質分組、共通揭曉說明／短註記與五族跳轉入口；只修改 ContentCatalogPanel.tsx、style.css 及四份 Phase 33 文件，資料／內容版本 2／server／state 未改。獨立原型已停止並移除，不將原型控制器接入正式遊戲。開發代理未執行 build／測試／UI 驗證，使用者其後回覆「接受，交給grok驗收吧」，批准剛才列明的六檔 commit／push 及送驗，新排版待指定 bot 工程驗證；舊 `940e1f3` PASS 不當作新 diff 結果。尚未宣告 Phase 33 通過或開始下一切片，送驗要求與限定指令見 [Phase 33](PHASE_33_CONTENT_CATALOG.md)。

緊湊資料卡限定六檔已依本次授權 commit／push 為 `cd4cbb4294e80c0f06ba4838c98aeb1af94242f0`（BASE `940e1f3ac9d6cda82f6c7d52c6e9cd1612ef85f2`），2026-10-05 00:00:21 HKT 已送指定 AI TRPG Architecture Critic 並讀回確認送達；工程結果待回覆，沒有自行執行驗證或展開下一切片。這段送達紀錄為 TARGET 後未提交文件。

2026-10-05 00:15:55／00:16:01／00:16:03 HKT 指定 bot 對 `cd4cbb4294e80c0f06ba4838c98aeb1af94242f0`（BASE `940e1f3ac9d6cda82f6c7d52c6e9cd1612ef85f2`）回報工程 FAIL：Low D1 在320px／200%文字時數字溢格，相鄰 −1／0 可誤看為 −10。外部 build、新測試6／6、隔離 PG414／414及其他項目通過，不能抵銷 FAIL。新增探索抽屜達不到六欄及 anchor history／hash Info 保留。既有授權六檔內的同切片補修只改 style.css 網格為有最小字體相對格寬的 auto-fit，不足時減欄，不縮字／裁切或改數據；加上四份文件，待固定新版本送 Grok 複驗。開發代理未執行驗證；真手機／讀屏／正式遊玩未測與 production 入口限制保留，未進下一切片。

D1 補修 `9a4471af0bceb8ca401adb9afbbca4e80d5dd810`（BASE `cd4cbb4294e80c0f06ba4838c98aeb1af94242f0`）已依既有六檔授權內的限定五檔範圍 commit／push，2026-10-05 00:24:29 HKT 送達指定 bot 並讀回確認；送達當時待工程複驗，不宣告缺陷已通過或 Phase 33 結案。此送達紀錄為 TARGET 後未提交文件。


2026-10-05 00:38:02／00:38:06／00:38:07 HKT 指定 AI TRPG Architecture Critic 對 `9a4471af0bceb8ca401adb9afbbca4e80d5dd810`（BASE `cd4cbb4294e80c0f06ba4838c98aeb1af94242f0`）回報工程 PASS，D1 修正、無新 High／Medium／Low。外部本輪 build、新測試 6／6、隔離 PG 全套 414／414 通過；無 DB 模式 371 通過／41 略過，略過不算通過。production 探索的 21 組尺寸／放大設定全部零溢格或交疊，BASE 與還原固定三欄 CSS 均重現失敗。正常字體緊湊外觀、六欄邊界及其他面板回歸正常；UI 限 Chrome，Safari／WebKit、系統字體縮放、真手機／讀屏／正式遊玩未測，production 戰鬥／主選單仍受阻。既有 Info 與歷史 FAIL 保留。開發代理僅讀取外部報告及記錄，沒有自行執行驗證；當時仍待使用者核對正式整合與接受 Phase 33，未開始下一切片。完整來源／命令／限制／證據見 [Phase 33](PHASE_33_CONTENT_CATALOG.md)。此紀錄為 TARGET 後未提交純文字。


使用者其後開啟正式新版名冊並回報「負號字體太大了，可以縮小。其他都正常」。同切片只將負加成負號包在文字 span，設為數字字級 75% 並微調垂直對齊，完整負號／數字文字及 nowrap 保留；正號、數字大小、自適應欄數、30 個加成、Canon、資料／讀取／state 路徑不變。範圍是既有批准六檔內的 ContentCatalogPanel、style.css 及四份 Phase 33 文件（含前輪外部結果紀錄）；沿用同切片補修 commit／push／送驗授權。開發代理未執行驗證，待固定新 TARGET 送指定 bot；`9a4471a` PASS 不當作本次結果，Phase 33 尚未接受或開始下一切片。


負號微調限定六檔已 commit／push 為 `8a59cfe82f04c75758a9468abcca75996d1a3eaa`（BASE `9a4471af0bceb8ca401adb9afbbca4e80d5dd810`），2026-10-05 20:18:02 HKT 送指定 bot 並讀回確認；送達當時工程結果待回覆，使用者最終接受仍待定。此送達紀錄為 TARGET 後未提交純文字。


2026-10-05 20:37:39／20:37:45／20:37:46 HKT 指定 AI TRPG Architecture Critic 對負號微調 `8a59cfe82f04c75758a9468abcca75996d1a3eaa`（BASE `9a4471af0bceb8ca401adb9afbbca4e80d5dd810`）回報工程 PASS（Chrome-only），無新 High／Medium／Low。外部 build、名冊測試 6／6、隔離 PG 414／414 通過，無 DB 371 通過／41 略過（略過不算通過）；全部 21 組尺寸／縮放無溢格／交疊／裁切／符號分行，六個負號字級均為數字 75%，30 個完整值與 Canon 一致，必要回歸正常。新增 Info：Chrome 無障礙樹將負號／數字拆成兩段文字（順序正確、沒有隱藏負號；讀屏效果未測），沒有自動化測試覆蓋負號 span。既有 Info、歷史 FAIL、未測限制與 production 入口受阻保留；不把文字完整等同可及名稱或讀屏通過。詳細來源／命令／證據見 [Phase 33](PHASE_33_CONTENT_CATALOG.md)。開發代理僅讀報告及記錄、未執行本機驗證；當時仍待使用者確認負號外觀與名冊操作並接受第一切片，未啟動下一切片；其後接受見下。本紀錄為 TARGET 後未提交純文字。


**使用者於 2026-10-05（Asia/Hong_Kong）明確回覆「Phase 33 第一切片通過」。** 依使用者回覆記錄正式五族創角資料名冊第一切片已接受，包含內容版本 2、唯讀入口、緊湊資料卡、自適應欄數及負號微調。記錄時本地 HEAD `8a59cfe82f04c75758a9468abcca75996d1a3eaa` 僅作版本對照，不冒稱使用者指定的手動測試 SHA 或完整本機環境；最新外部 TARGET／BASE、工程 PASS 與 Info 保留各自來源。歷史 FAIL、新兩項 Info、其他既有 Info、Safari／真手機／讀屏等未測及 production 入口受阻均未改標通過或解決。這項接受只涵蓋第一切片，不代表完整 R04／創角／職業內容／R05 已完成或新規則已批准。詳細驗收見 [Phase 33](PHASE_33_CONTENT_CATALOG.md)。本輪只有四份文件的純文字紀錄，沒有執行測試或新增 commit／push，下一切片尚未開始。
