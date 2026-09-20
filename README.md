# AI TRPG

這是 docs-first、從零建立的瀏覽器 AI TRPG。先閱讀 [AGENTS.md](AGENTS.md) 與 [權威文件清單](docs/development/CANONICAL_MANIFEST.md)。遊戲規則以清單中的文件為準；HTML 戰鬥原型不作為正式程式模板。

Phase 1、2、3、4 已由使用者確認。Phase 5 建立後端文字模型中立介面，等待手動確認。階段順序見 [Implementation Phase Plan](docs/development/IMPLEMENTATION_PLAN.md)。

Phase 3 的範圍、契約與終端機操作步驟見 [Phase 3 手動測試](docs/development/PHASE_3_DOMAIN.md)。前端仍是已確認的連線頁。

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

## Phase 5：文字模型介面手動檢查

這階段只有後端的模型插座與固定回應測試模型；不用啟動 Docker、API 服務或瀏覽器，也不需要 API key、Internet 或付費請求。網站仍顯示原本的連線頁。

在專案根目錄開啟終端機。已有 Phase 1–4 的 npm 依賴時，直接依序執行：

```sh
npm run llm:check
npm run llm:check -- malformed
npm run llm:check -- unavailable
npm run llm:check -- timeout
```

第一行應顯示 `成功：TEST：文字模型介面已連通。`，每次結果相同。後三行應各自顯示 `已安全處理` 與 `malformed-response`、`unavailable`、`timeout`，附繁體中文說明；不應出現供應商內部細節或任何金鑰。這些都是本機假資料與模擬失敗，不會聯絡外部模型。

若尚未安裝專案 npm 依賴，先依下方「安裝與啟動」的 `npm ci` 指令安裝。Phase 5 不新增套件或金鑰設定，也不要求修改 `.env`。手動驗證後請回報結果；工程測試不能代替你的階段驗收。

後端程式位置：`src/server/llm/contracts.ts` 定義中立型別與安全錯誤；`language-model.ts` 檢查請求／回應、處理逾時；`fake-adapter.ts` 提供固定回應；`check.ts` 只供終端機檢查。正式供應商與模型仍列在 `OPEN_QUESTIONS.md`。權威狀態仍由 `src/domain/` 決定，模型結果沒有直接修改狀態的路徑。

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
