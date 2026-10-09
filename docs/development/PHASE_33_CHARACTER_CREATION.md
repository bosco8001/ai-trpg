# Phase 33 第五切片：角色建立與保存

## 最新：M1 畫面通過，T1 案例補修待複驗（2026-10-09）

透過 Grok Bot Control 讀取指定 AI TRPG Architecture Critic 2026-10-09 20:06:37／20:06:42 的回覆及 20:28:35／20:28:41 的 PG 補報。對應送驗 TARGET `b7f723fa73d59c018cefd6fe901276226f93aebe`、BASE `efaa63625e46bfa0602699a8f9948bc69f91ac3f`；**外部整體工程仍為 FAIL，唯一阻擋項為 T1**。M1 的產品畫面已通過；本地只閱讀報告與程式，沒有親測外部證據或執行工程命令。

| PG 補報實際執行項目 | 外部結果 |
|---|---|
| TARGET／BASE npm ci、npm run build | exit 0 |
| TARGET／BASE 六支 migration，55426 隔離 PG 17.11 | exit 0 |
| 指定五測試檔，加隔離 PG | exit 0，45／45，0 skip |
| 隔離 PG npm test | exit 0，453／453，0 skip |
| 正式 dist／真 index.ts／production／postgres 的 M1 | 四組尺寸／縮放 × 四次切換，TARGET 16／16 回頂、焦點標題可見；BASE 16／16 FAIL，POST 均 0 |
| 正式保存 UI／焦點捲動 | 62／62、32／32 通過 |
| 真 TCP proxy | 6／6 通過，COMMIT 後斷線查得原紀錄、12 秒晚回覆同 ID 重播／單 row、鎖逾時無 row |

PG 原先因缺套件受阻，首批只在 memory 模式回應空角色、以審查者記憶體 repository 核對 UI，不能當 PG 契約通過；其後使用者直接在 bot 回答同意補裝 PostgreSQL，PG 補報已解除此項受阻。審查者回報安裝 exit 0、設定 create_main_cluster=false，5432 從未有 listener／未連入；套件及該設定保留，只清理本次隔離資源。Codex 沒有在使用者 Mac 安裝或操作 DB。

M1 首批獨立人類／魔術師、鍵盤 Enter 與原腳本重驗：原八項失敗在 BASE 重現、TARGET 消失；正常高畫面正文回頂、footer 固定，144 個可讀高度與前版相同，最小 160px，沒有恢復窄條。真縮放量到 innerWidth 284／DPR 2，與模擬縮放分開。PG 補報再做四組設定：844×390 100%、568×320 真 200%、844×390／320×568 模擬 200%。

**T1，Low–Medium（新增案例）**：`tests/browser/character-creation-scroll.mjs` L49–50 的 getByLabel exact 選不到種族／初始職業下拉選單，Playwright 1.59.1 五組設定均逾時 30000ms，POST 0，尚未進入捲動斷言；PG 模式也重現。Grok 說明 label 包住 select 時包含 option 文字，建議按 combobox 角色與可存取名稱定位。審查者只在隔離副本改這兩行，TARGET 四組 4／4 通過、BASE 四組首步失敗，沒有改 repository；副本結果不能替本次正式新版本宣告 PASS。

本次最小同切片補修只將兩行改為 getByRole("combobox", { name, exact: true })，保持三次 transition、實際 scrollTop>4、回頂／焦點／可見斷言及不按保存。案例未包含「返回分配再前進」第四次；正常高度沒有捲動距離時前置斷言會失敗，兩項限制保留，另交獨立流程核對。不改 TSX／CSS／API／DB／生成或玩法。

PG 補報也核對重啟首個 GET 與原唯讀紀錄、RNG 0，固定 503 的回應／app log 無 marker、密碼、port、SQL。刻意觸發三槽存檔 409 出現兩條既有帶路徑 stack，與創角無關，不擴大「無洩漏」結論；探測新增的隔離測試角色已清理。三槽存讀正常，創角紀錄保持 HP 61／61、MP 52／52，診斷／備份／修復 200，與 BASE 一致。

Info 與限制：首批重測 N9 在 TARGET／BASE 均四項 FAIL，N10 大字錯誤焦點部分在外，t47u I1 五份偽造回應仍被接受。N11 因 CSS 未變仍是推斷、真 inset 未測；PG 補報引用首批這些觀察。名冊 byte、容量及 N8 引用 efaa636；N1／N3／N4／N5／N6、I2–I6、t46u／第一片／原型 Info 保留，N4 的既有歸因仍只推斷。真手機／讀屏器／OS 字體／真 safe-area／全面 mutation 未測，Safari／WebKit 仍受阻。未讀到的首批命令摘要不補寫成這次實測。

外部證據：`/workspace/p33m-evidence/`（首批 158 張 PNG）及 `pg-supplement/`（補報 51 張 PNG）。Grok 回報本次 server／proxy／隔離 DB／role／55426 叢集已清理，舊證據 hash 沒變，沒有改檔、commit／push；Codex 沒有自行驗證這些遠端檔案。

**T1 新補修尚未執行與送驗，使用者待驗收。** 沿用本次已批准七檔內的六檔範圍：瀏覽器案例與五份 Phase 33 文件；產品 TSX 不再改。先提交／推送限定檔案並核對新完整 SHA，再送固定版本複驗；不開始下一切片。

## M1 複驗已送達（2026-10-09，提交後補記）

使用者已授權限定七檔 commit／push 並複驗，已提交及推送 `b7f723fa73d59c018cefd6fe901276226f93aebe`；BASE 為 `efaa63625e46bfa0602699a8f9948bc69f91ac3f`，遠端指定分支完整 SHA 已核對一致。2026-10-09 19:46:27（Asia/Hong_Kong）透過 Grok Bot Control 向 AI TRPG Architecture Critic 送出完整 M1 複驗要求，讀回新增訊息與空白輸入框，只送一次。訊息 SHA-256：`e69310625a2e7f180aa9a6eb539b2404fb04ea75d5cdb69a61508857a5f2589a`。

**工程結果待回覆，使用者待驗收。** Codex 未執行本地測試；既有 FAIL、Info 與未測限制保留。此送達紀錄於 TARGET 提交後補寫，尚未另行提交，不屬受測 TARGET；下面的提交前或待填 TARGET 是當時紀錄。未開始下一切片。

## 最新結果與 M1 補修（2026-10-09）

AI TRPG Architecture Critic 對 `efaa63625e46bfa0602699a8f9948bc69f91ac3f` 的外部複驗結果仍為 **工程 FAIL**。D1／D2 已 PASS、N2 細縫消失，但整張 Sheet 捲動後，步驟切換只重設正文，新增 M1 Medium：標題獲焦點卻在畫面外，最後確認停在底部。M1 同切片補修與瀏覽器回歸案例已準備，尚未執行；使用者已於 2026-10-09 授權限定七檔 commit／push 並複驗，提交前尚未推送或送達新複驗；使用者待驗收。Codex 沒有執行本地工程測試。

下列各版送達及待送紀錄為當時狀態；目前以本節及「第一次補修外部結果與 M1」為準。

## 歷史補修交接（2026-10-08，提交後補記）

使用者已授權限定七檔 commit／push 並複驗；提交及推送成功，新 TARGET 為 `efaa63625e46bfa0602699a8f9948bc69f91ac3f`，BASE 為 `30cf31fd3fba1d43c5e0c0428d01af20ac421e3a`，遠端指定分支與 TARGET 一致。已透過 Grok Bot Control 向 AI TRPG Architecture Critic 送出完整 D1／D2／N2 複驗要求，讀回確認新訊息與空白輸入框。**補修工程結果待回覆，使用者待驗收**；Codex 沒有執行本地工程測試。

本段於補修 TARGET 提交後補寫，尚未另行提交，不屬受測 TARGET；以下「提交前」與「尚未送達複驗」為各版本當時紀錄。首版 t48u FAIL 保留，不沿用診斷 dist 宣告正式 UI PASS。

更新：2026-10-08（Asia/Hong_Kong）。使用者以「對」批准 [完整實作確認稿](PHASE_33_CHARACTER_CREATION_PROPOSAL.md)，並授權限定 35 檔 commit／push 及 Grok 交接。已提交及推送 `30cf31fd3fba1d43c5e0c0428d01af20ac421e3a`；AI TRPG Architecture Critic 的 **t48u 外部工程結果為 FAIL**。D1／D2 與 N2 補修已準備，尚未提交、推送或送達複驗；**補修待工程驗證、使用者待驗收**。Codex 僅閱讀程式／文件／Git、實作與撰寫測試，沒有執行 build、typecheck、lint、格式檢查、單元／整合／資料庫或瀏覽器／UI 測試。

本段交接狀態於 TARGET 提交後補記，尚未再次提交，不屬受測 TARGET 的內容。送出的審查訊息明確指定完整 BASE／TARGET；TARGET 中「提交前尚未推送或送達」是當時狀態。

## 單一交付目標

先完成並收好一張角色卡：從正式五族 v2／四初階職業 v1 選擇，分配 12 點與人類另 2 點，在最後確認時生成並保存 Lv.1 出生紀錄，保存成功後才揭曉。此紀錄與正在遊玩的 TEST 狀態、三個存檔槽及修復封存分開。

初始只開放所選職業，資質依種族分布、施法資格獨立 1%、龍裔龍息火／冰／雷各 1／3。資格不代表已學法術，血脈來源固定「尚未揭露」。先加種族、再乘職業並向下取整，第一次目前 HP／MP 等於推導上限。

本切片先保存一名角色，已有角色後只核對原紀錄，不提供覆寫、刪除或重抽。**正式版必須支援多名獨立角色與列表**；數量上限、角色選擇／Run 綁定與刪除政策另訂。起始裝備／技能／熟練、正式冒險、轉職、戰鬥與 Save 升版未接入。

## 保存與故障語義

- 新表 `character_creation_records` 有獨立 UUID、服務端保存範圍、建立識別、請求摘要及完整 JSONB 紀錄。`local-player` 是當前單機服務範圍，不是帳號或角色 ID，HTTP 不能指定其他保存範圍。
- 同一範圍的交易鎖加 UNIQUE 防止雙分頁建立兩名角色；取得鎖、確認空紀錄後才呼叫亂數。相同建立識別與相同輸入讀回原紀錄；同識別異內容及不同識別已有角色均拒絕。後續多角色需另行放寬範圍唯一限制，不改用 TEST 身分。
- 保存名冊／規則版本、完整正式定義快照、原始分配、固定生成結果與初始資源。嚴格驗證格式、計算與正式名冊吻合後才回傳；未知版本／損壞資料拒絕讀取，不偷偷補值、刪除或重抽。
- 目前只支援出生格式／推導 v1、五族 v2、四職業 v1。未來名冊更新需要明確版本支援或升版流程，不能改動舊版定義後自動重算／覆寫原紀錄。這不是凍結未來角色成長。
- 交易提交成功才回傳生成結果。COMMIT 回覆遺失、逾時或斷線保持結果未知，前端查詢／重試同一次建立；已保存結果不再次抽取。
- pending 請求在 POST 前保留到 `sessionStorage`，只存建立識別與玩家輸入，不存秘密生成結果。不能保留識別就不送 POST；重新整理先 GET，再使用原 pending。關閉面板不表示伺服器取消成功，不清除網站資料以換身分重抽。
- 明確拒絕非法輸入時可返回修改原草稿；結果未知或版本／保存狀態受阻時只查詢／沿用原識別，不自動換新請求。重試均由玩家手動觸發。
- HTTP：`GET /api/character-creation` 讀取空／已保存狀態，`POST` 建立或重播。請求上限 4 KiB、前端回應上限 32 KiB、固定錯誤文字、`Cache-Control: no-store`。非法額外欄位、TEST 引用、自帶 RNG 結果／保存範圍、query、未知版本均拒絕。
- 服務／前端操作上限 10 秒；PG 借出連線沿用既有 helper，交易 statement／lock timeout 3 秒、idle transaction timeout 10 秒。固定 PG 日誌回呼不接原始 err；既有 query FATAL 缺少日誌的 Info 不因本次改標已解決。
- 正式 runtime 只在 `DOMAIN_STORAGE=postgres` 提供持久建立；Memory 顯示需要 PostgreSQL，不產生重啟即消失的成功角色。Memory repository 僅作可注入的隔離測試 adapter。
- 新 migration 不自動執行，也不改既有表；一般 down 不刪除已生成角色。開發代理沒有操作任何資料庫或改動憑證。

出生紀錄中的初始 HP／MP 是固定的出生資料，不是即時遊戲資源。讀取它不修改目前角色，也不對受傷的遊戲角色補血。之後的正式狀態與裝備容量政策仍依 Character Canon，另作切片。

## 手機流程與共同設計

探索 → 系統 →「角色建立與核對」，採已接受 Design System 02 的高對比按鈕、黑藍材質、青綠狀態、繁中文字體與短動畫。game-ui-ux 處理分步流程、原請求同步與焦點；ui-ux-pro-max 處理資料層級、響應式、標籤／錯誤／鍵盤；apple-design 處理字體、間距、按壓回饋與短過場。規則及已確認設計優先，沒有另造三套風格。

選擇 → 分配 → 最後確認置於 Full-screen Sheet；只有當步操作，詳細名冊／計算放展開區。最後確認前不產生個別資質、資格、龍息或可反推資質的最終 MP。保存中阻止連按，未知結果提供查詢／重試；結果畫面唯讀。N2 補修在可用高度不超過 28rem 時壓縮標題／操作列留白，改由整張 Sheet 內部捲動，標題、正文及操作列依正常順序流動；正常高度維持固定操作列，不縮小觸控目標或封鎖文字放大。此調整待 Grok 實測。

原生 dialog 保持焦點在面板，步驟轉換聚焦標題，錯誤聚焦摘要並連到分配欄位；Esc 只關閉內層，返回入口。標籤、48px 操作區、安全邊距及 reduced-motion 延續共用規格。這些是實作目標，**沒有 Codex 瀏覽器測試結果**，仍由 Grok 核對實際行為與限制。

## 限定本次 35 檔

此清單包含第五切片，以及此前第四切片尚未提交的外部報告／使用者接受／原型封存文字紀錄；後者沒有新增程式或重判舊驗收。AGENTS、Phase 31、mobile-redesign 與 profession-loadout 既有改動不在此清單。

| 範圍 | 確切檔案 |
|---|---|
| 共用／領域 | `src/shared/character-creation.ts`、`src/domain/character-creation.ts` |
| 保存與路由 | `src/server/character-creation/contracts.ts`、`memory-repository.ts`、`postgres-repository.ts`、`service.ts`、`routes.ts`（均在同目錄） |
| 接線 | `src/server/app.ts`、`src/server/index.ts`、`src/web/ExplorationPage.tsx`、`src/web/main.tsx` |
| 畫面／client／草稿／樣式 | `src/web/CharacterCreationPanel.tsx`、`src/web/character-creation-client.ts`、`src/web/character-creation-ui.ts`、`src/web/character-creation.css` |
| Migration | `migrations/1791300000000_character_creation_records.mjs` |
| 測試／隔離 helper | `tests/character-creation.test.ts`、`tests/character-creation-postgres.test.ts`、`tests/helpers/character-creation.ts` |
| Canon | `docs/gameplay/character_system.md`、`docs/gameplay/classes.md`、`docs/gameplay/magic.md`、`docs/world/races.md` |
| 當前計畫 | `docs/development/CANONICAL_MANIFEST.md`、`docs/development/IMPLEMENTATION_PLAN.md`、`docs/development/OPEN_QUESTIONS.md` |
| 第五切片文件 | `docs/development/PHASE_33_CHARACTER_CREATION_DISCUSSION.md`、`PHASE_33_CHARACTER_CREATION_PROPOSAL.md`、`PHASE_33_CHARACTER_CREATION.md`、`PHASE_33_CHARACTER_CREATION_GROK_REVIEW.md`（均在同目錄） |
| 前切片純文字紀錄 | `docs/development/PHASE_33_CHARACTER_DERIVATION.md`、`PHASE_33_CHARACTER_DERIVATION_DISCUSSION.md`、`PHASE_33_CHARACTER_DERIVATION_GROK_REVIEW.md`、`PHASE_33_DERIVATION_IMPLEMENTATION_PROPOSAL.md`（均在同目錄）、`prototypes/phase33-character-derivation/README.md` |

## 工程準備與限制

18 項一般測試：正式 RNG 邊界／獨立資格／龍息、20 組出生推導、非法輸入、一次生成／讀回與競爭、保存後遺失回覆、失敗後手動重試、輸入快照、保存後取消、損壞／假名冊拒絕、Memory／取消、HTTP 有界與隔離、前端回應綁定、pending 儲存及 Node SSR。

7 項隔離 PG 測試：完整 migration、新池持久讀回、不同／相同識別競爭、異內容拒絕、真 COMMIT 後模擬遺失回覆、INSERT trigger 故障回滾、保存列損壞及等待鎖時取消。每例獨立 schema，清理自己資源，核對既有遊戲／槽位／修復資料保持不變。

**Codex 沒有執行上述測試。** 首版由 Grok t48u 執行，結果與限制見下節；本次補修尚未執行。PG 未提供隔離 `TEST_DATABASE_URL` 時會略過，略過不算通過。新池重讀或合成遺失回覆不冒稱真故障已通過；診斷 dist 的 UI 結果不等於正式 build 的 UI PASS。完整複驗 prompt 見 [Grok 要求](PHASE_33_CHARACTER_CREATION_GROK_REVIEW.md)。

第四切片 t47u 是外部回報、受測版本 `bb930080ac917a90fc2f6bdf0ecca888ebfcbe87`，不是第五切片結果。既有前端推導名冊核對、hash history、重複 JSON／BOM、極短畫面、測試缺口及未測平台等 Info 保留；新建立回應的名冊比對不代表舊工具 Info 已解決。

## 首輪外部工程報告與同切片補修

來源：AI TRPG Architecture Critic **t48u**，TARGET `30cf31fd3fba1d43c5e0c0428d01af20ac421e3a`，BASE `bb930080ac917a90fc2f6bdf0ecca888ebfcbe87`。以下為 Codex 從指定 Bot 介面讀取的外部回報，沒有取得或親自執行其證據檔。Grok 核對 35 檔、+1536／−29 與範圍一致。

| 外部命令／範圍 | Exit／結果 |
|---|---|
| TARGET／BASE npm ci | 0／0 |
| TARGET npm run build | 2，測試檔 7 個 TS 錯誤，Vite 未執行 |
| BASE npm run build | 0 |
| 指定五測試檔，無 DB | 1；36 pass／2 fail／7 skipped（45 項） |
| 指定五測試檔，隔離 PG | 1；43 pass／2 fail（45 項）；新 7 個 PG 測試全部 pass |
| TARGET npm test，無 DB | 1；401 pass／2 fail／48 skipped（451 項） |
| TARGET npm test，隔離 PG | 1；451 pass／2 fail（453 項） |
| BASE npm test，無 DB／隔離 PG | 0／0；385 pass／41 skipped；428／428 |
| 完整 migration／完整 SHA diff --check | 0／0 |

外部環境為 Node 24.21.0、PostgreSQL 17.11 的隔離叢集。因正式 build 失敗，Grok 另用跳過 typecheck、只執行 Vite 與 server tsc 的**診斷 dist**測 runtime；不能算正式 UI PASS。它回報 RNG 邊界與抽樣、20 組推導、冪等／雙 process 競爭、真 INSERT 失敗、真 TCP COMMIT 回覆遺失、延遲／鎖／取消、重啟與新池讀回、安全拒絕／固定回應及 LLM 隔離符合預期；HTTP 51／52 中一項是審查者預期誤寫，實際固定 400 可接受。Chrome 154 的 390×844 流程 62／62、版面 120 次及回歸資料核對為診斷結果。正式 dist UI 受阻，需補修後重做。

| 問題 | t48u 外部觀察 | 本次補修／保留 |
|---|---|---|
| D1 High | `tests/character-creation.test.ts` L54、57、171、230、235、247、250：種族 fixture 的 aptitudeReveal 與 state 的 schemaVersion 等字面型別不符，build 失敗 | 測試改讀服務端已驗證的正式名冊快照；state 明確採 CreationState，沒有以斷言繞過型別。待複驗 |
| D2 Medium | L59 的矮人／龍裔弓箭手感知錯寫 10；L214 的 /SQL/ 誤中 PostgreSQL，兩個測試提前失敗 | 兩組預期改為 floor(10×1.25)=12；SQL 使用單詞邊界，另核對完整固定 code／message。未刪除測試或放寬產品規則。待複驗 |
| N2 Low | 矮橫屏配模擬 200% zoom 時，568×320／844×390 的正文只剩 32／59px；320×568 確認步驟為 107px；可捲至尾且按鈕可見 | 短螢幕壓縮留白並讓整張 Sheet 內部捲動，解除固定正文高度被標題／操作列擠壓。待複驗，不能只以能捲到底判通過 |
| N1 Info | 未知種族／職業回 invalid-request；invalid-allocation 被前置驗證擋住，無法到達 | 保留，本次不改 API 語義 |
| N3 Info | 等鎖時最多佔用共享池 5 條連線 3 秒，game-state 約等 2.7 秒 | 保留，本次不改 pool／交易 |
| N4 Info | PG 不可用或角色不存在時連線失敗沒有日誌；推斷既有，未做 BASE 重現 | 保留推斷，未確認歸因；舊 FATAL query 缺日誌本輪未觸發 |
| N5 Info | 首次與重播 JSON key 次序不同，內容一致 | 保留 |
| N6 Info | 原生 modal Tab 先經 BODY，背景控制項無法到達 | 保留既有觀察，本次不改焦點程式 |
| N7 Info | 文件描述提交前狀態 | 本次補寫目前／歷史狀態及固定版本，不宣告已經外部複驗 |

Grok 重驗第四切片工具的 5 個偽造回應仍被接受，t47u I1–I6 全部保留；t46u、第一切片與原型 02 的歷史 Info 也保留。真瀏覽器縮放、真手機、讀屏器、OS 字體大小及 mutation testing 未測；Safari／WebKit 受阻。本輪診斷 UI 沒有取代這些限制。

Grok 回報 server／proxy／Chrome、六個隔離 DB 與測試角色已清理、隔離叢集已停，沒有改檔／commit／push；證據保留於外部 `/workspace/p33k-evidence/`（SUMMARY.md、logs/exits.txt、json、scripts），合成 marker 已遮蔽，舊證據未改。外部 clone 停在 `771e7de` 是工作目錄描述，受測 TARGET 仍以報告核對的完整 SHA 為準。

### 本次限定七檔補修

- 程式／測試：`tests/character-creation.test.ts`、`src/web/character-creation.css`。
- 狀態／外部結果／複驗要求：本文件、`PHASE_33_CHARACTER_CREATION_GROK_REVIEW.md`、`CANONICAL_MANIFEST.md`、`IMPLEMENTATION_PLAN.md`、`OPEN_QUESTIONS.md`（均在 docs/development）。

使用者已於 2026-10-08 以「授權」批准本次限定七檔 commit／push 並送 Grok 複驗；本段為提交前紀錄，尚未推送或送達複驗。前次 35 檔授權不自動視為新補修版本的提交授權。其他既有工作目錄改動不納入；本次沒有執行本地測試、資料庫操作或遊戲瀏覽器驗證。

## 第一次補修外部結果與 M1

來源：2026-10-09 從指定 AI TRPG Architecture Critic 介面讀取的複驗回覆，TARGET `efaa63625e46bfa0602699a8f9948bc69f91ac3f`，BASE `30cf31fd3fba1d43c5e0c0428d01af20ac421e3a`。以下仍是外部回報，Codex 沒有取得或親測其證據檔；未另替報告編造審查識別。Grok 核對七檔限定範圍、父版本與祖先關係正確，沒有混入其他系統改動。

| 外部命令／範圍 | 結果 |
|---|---|
| npm ci／npm run build／npx tsc --noEmit | 均 exit 0，官方 Vite／server 產物可用 |
| 指定五測試檔，無 DB | exit 0，38 pass／0 fail／7 skipped（45 項） |
| 指定五測試檔，隔離 PG | 45／45 pass |
| 無 DB npm test | exit 0，403 pass／0 fail／48 skipped（451 項） |
| 隔離 PG npm test | 453／453 pass |
| 六支 migration／完整 SHA diff --check | 均 exit 0 |
| BASE build 重現 | exit 2，原七個 TS 錯誤仍在 |

外部環境為 Node 24.21.0、PG 17.11 隔離叢集（55426）。453 個測試名稱與 BASE 相同，沒有刪測試；略過不算 PASS。D1 七個 TS 錯誤已消失。D2 的 20 組獨立公式／期望／產品輸出吻合；審查者在隔離副本以最後一組改值、產品修正改值、迴圈及分支計數等定點改動證明覆蓋有效，兩模式 GET／POST 均執行，固定 PostgreSQL 字眼可接受，原始 err／額外欄位被完整 body 比對攔住。

N2 已用**官方 dist**、真 index.ts／production／postgres 重做：144 個畫面量測與 headed 真縮放 36 個；BASE 用診斷 dist 對照 144 個，其中 34 個有問題。真縮放經 Chrome profile 設定並核對 innerWidth／DPR，與模擬縮放分開；沒有將頁面收到 Ctrl+Plus 當成真縮放。

| 確認畫面 | BASE → TARGET 可讀高度 |
|---|---|
| 568×320，200% 真／模擬縮放 | 33 → 160px |
| 844×390，200% 縮放 | 61 → 195px |
| 320×568，200% 縮放 | 109 → 284px |
| 568×320／844×390，100% | 186 → 320px／256 → 390px |

整張 Sheet 捲動沒有雙捲動、橫向溢出、藏文字；控制項至少 48px，關閉／底部操作可達。正常高度仍固定操作列；縮放進入短螢幕模式時隨內容流動。錯誤連結、details、Tab／Shift+Tab／Esc、pressed／disabled／reduced-motion 通過。但**步驟切換仍有 M1，不能宣告整體工程 PASS**。

M1 Medium（本次補修引入）：844×390、100% 字，捲到底後前進，frame 保持約 396／199px 的原位置；最後確認的身分與屬性在畫面外。568×320 真縮放、844×390 及 320×568 模擬縮放合計 8 項 FAIL，BASE 同方法 PASS。位置為受測版 `CharacterCreationPanel.tsx` L47–51：只重設 body.scrollTop，CSS 卻讓 frame 成為捲動區。

本次最小補修：為 `.derivation-frame` 增加 ref，在既有 `[open, step, ready]` layout effect 中同時重設 frame／body 的 scrollTop，再保持既有標題焦點。不改 CSS、旋轉事件、生成、保存、API 或 pending 契約，也不為 Info 自動擴大修補。

新增 `tests/browser/character-creation-scroll.mjs`，匯出 `checkCreationStepScroll(page)`，交 Grok 使用其現有 Playwright Page 執行；不新增套件或本地瀏覽器。先以隔離、空創角 Sheet 開在「種族與職業」，案例選精靈／弓箭手、六項各 2 點，從真的有捲動距離的底部前進到分配、再到確認、返回分配，共三次檢查 frame／body 回頂及標題焦點／完整可見。沒有按確認保存、建立或刪除角色；呼叫方另核對 POST 為零並清理。這是獨立瀏覽器案例，不在現有 npm test glob 內，尚未執行；不能把假 DOM 或只讀碼當實測。短螢幕依 M1 三組設定執行，正常高畫面另核對；若畫面沒有捲動距離，不能當 M1 重現成功。

| 新 Info | 外部結果與本次界線 |
|---|---|
| N8，本次測試補修 | SQL regex 本身未涵蓋 SELECT、SQLSTATE、MySQL、無 stack 字眼的 stack 行／路徑；完整固定 body 的 deepEqual 仍守住，風險低。本次保留，不宣稱 regex 已完整涵蓋 |
| N9，既有及新增觀察 | 旋轉／縮放／字體改變後焦點 input 不保持可見；BASE 三項 FAIL，TARGET 新增一項轉回直向 FAIL。保留混合歸因，M1 補修不代表 N9 已修 |
| N10，兩版相同 | 320×568、CSS root 200% 的確認畫面可讀區約 198px；錯誤摘要可能高過視窗，焦點框部分在外。保留 |
| N11，首版 | header／footer 左右留白未使用 safe-area-inset-left/right，真瀏海 inset 未測。保留 |

官方 dist 重做流程 62／62、真 TCP proxy 6／6：COMMIT 後斷線已保存但 UI 顯示未知、12 秒延遲後約 10.4 秒未知／同 ID 重播、鎖逾時不寫 row，三次建立只生成三次；服務重啟唯讀且新 process RNG 零次。回歸 computed style、兩名冊 byte、第四切片樣本、容量規則、三槽存讀檔、診斷／備份／修復與 SSR 符合預期。以上通過沒有蓋過 M1。

N1／N3／N4／N5／N6 為引用保留，N4 既有歸因仍只有推斷，未做 BASE 重現；舊 FATAL 缺日誌未觸發。N7 文件的目前／歷史狀態核對正確。第四切片 t47u I1 五個偽造回應重驗仍被接受；t47u I2–I6、t46u、第一切片與原型 02 的 Info 保留。真手機、讀屏器、OS 字體、真 safe-area 與全面 mutation testing 未測；Safari／WebKit 受阻。

外部證據 `/workspace/p33l-evidence/` 包含 SUMMARY、exit codes、定點改動／獨立計算／版面／無障礙紀錄、95 張 PNG 與 scripts，marker 已遮蔽。Grok 回報 server／proxy／五個隔離 DB／測試角色／55426 叢集與工作目錄已清理，沒有改檔／commit／push，未碰 5432 或舊證據；受測 SHA 以上述版本為準。

### M1 限定七檔（2026-10-09 已獲本次授權）

- `src/web/CharacterCreationPanel.tsx`、`tests/browser/character-creation-scroll.mjs`。
- 本文件、`PHASE_33_CHARACTER_CREATION_GROK_REVIEW.md`、`CANONICAL_MANIFEST.md`、`IMPLEMENTATION_PLAN.md`、`OPEN_QUESTIONS.md`（均在 docs/development）。

前次七檔授權的提交已完成；本次新增 TSX 與瀏覽器案例，使用者已於 2026-10-09 明確授權下列限定七檔 commit／push 並複驗。此為提交前紀錄，尚未推送／送達 M1 複驗，沒有執行本地 build／測試／UI／資料庫驗證。Grok 工程通過後再由使用者核對；尚未開始下一切片。

## 工程通過後的手動核對

先使用隔離驗收 PostgreSQL 與完整 migration，由 Grok 提供實際版本／啟動環境；本文件不要求清除既有角色或存檔。

1. 探索 → 系統 → 角色建立與核對。選一族／一職業，下一步只見分配，尚未揭曉個別結果。取消再開沒有保存角色。
2. 六項各分 2 點（合計 12）；人類另選一項加 2 點。不足／超出／小數不能進入最後確認；返回修改保持原分配。
3. 最後確認並保存。成功後有同一角色 ID、固定資質／資格／龍息、所選職業及滿初始 HP／MP；血脈「尚未揭露」。打開明細核對先種族後職業。
4. 關閉、重開、重新整理及服務重啟後，角色 ID、結果、版本及初始資源相同；只能核對，沒有建立第二名或覆寫操作。
5. 手機直向／橫向與放大字體可操作，主要按鈕可見，內容在 Sheet 內捲動；Esc／關閉返回入口，外層系統面板保持開啟。既有探索／三槽存檔仍可使用。

保存中故障、雙分頁建立及資料損壞交由 Grok 隔離樣本核對，不要求使用者破壞保存紀錄。Grok PASS 後仍由使用者決定第五切片是否接受。

## 下一個邊界

先完成本切片工程驗證與使用者驗收，再討論起始技能／裝備／武器熟練的正式內容及出生角色接入。正式版多角色仍必做；不在本切片順便加入 Run、轉職配裝或戰鬥系統。
