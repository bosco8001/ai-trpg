# 已批准的 Implementation Phase Plan

Phase 0–7 已由使用者確認。Phase 8 工程完成，等待使用者手動確認；其餘尚未開始。

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

Phase 8 等待使用者手動確認；不得自動進入 Phase 9。
