# Phase 32：單份原子修復套用、再次確認與持久報告

交付日期：2026-10-04（Asia/Hong_Kong）。**實作交付，待實作工程驗證及使用者驗收。** 本稿記錄送驗前狀態；送驗是否送達及目標完整 SHA 以後續交接訊息為準。 基準為 `3d8df060162163b1fbb60873baf95e95b19ea709`；TARGET 為「待提交後填入完整 SHA」。分支 `codex/phase27-mobile-ui`，repository `https://github.com/bosco8001/ai-trpg`。

使用者已逐項批准八項 A 及 [完整契約](R03_SECOND_STAGE_PROPOSAL.md)，文件送驗後另回覆「開始實作」。Phase 31 的接受與既有 Info／未測限制保留。使用者其後明確回覆「授權」，批准只 commit／push 本輪 Phase 32 改動並送指定 bot；不包含先前未提交的 `AGENTS.md` 與 Phase 31 歷史文字補正。

## 可見結果與範圍

像拿已備份的原稿與修改單到保管員面前再簽一次：只修改選中的目前資料或槽 1–3，留下可查詢與下載的結果。

- 保留完整修復前備份，於原面板顯示來源、差異、時間、識別碼與校驗，使用者另按「確認套用這份修復」。
- 只修 R02 的活動標記及玩家 MP 相容欄位；寫入前重新核對完整來源、變動守衛及候選，完整驗證後整份替換。
- 目前資料成功時 revision 加一並換新 generation；保存的 History、身分帳與 allocator 不變。未完成舊 callback 沿用 Phase 26 丟棄守衛。
- 槽修復保留 savedAt 完整精度與 sourceRevision，不 Load，不改目前資料或其他槽。合法同角色舊 Run／其他 world 可獨立修復。
- 同 ID 只開始一次；確定成功及核對拒絕保存完整報告。不確定、逾時或回應遺失須手動查詢，不自動重做。
- 舊 Phase 31 備份保持原檔，可下載；缺少守衛不能取得套用資格。新程序不能用舊 Memory 準備修改新狀態。

## 變更檔案

| 區域 | 檔案 |
|---|---|
| 契約與重建 | `src/shared/repair-application.ts`、`src/server/repair-application-core.ts`、`repair-application-backend.ts` |
| 兩種保存模式及路由 | `src/server/memory-repair-application.ts`、`postgres-repair-application.ts`、`repair-application-routes.ts` |
| 接線、守衛與容量 | `src/server/app.ts`、`index.ts`、`domain-session.ts`、`repair-preview-reader.ts`、`repair-preparation.ts`、`file-repair-archive.ts`、`postgres-repair-archive.ts`、`save-game/memory-repository.ts` |
| 手動 migration | `migrations/1791100000000_repair_applications.mjs` |
| 原面板確認及報告 | `src/web/RepairApplicationPanel.tsx`、`repair-application.ts`、`RepairPreparationPanel.tsx`、`RepairPreviewPanel.tsx`、`repair-preparation.ts`、`RuntimeSystemPanel.tsx`、`App.tsx` |
| 待執行案例 | `tests/repair-application.test.ts`、`tests/repair-preparation.test.ts`、`tests/helpers/phase32-repair-application.mjs` |
| 文件 | 本文件、R03 第二階段／第一階段／討論文件、CANONICAL_MANIFEST、OPEN_QUESTIONS、IMPLEMENTATION_PLAN、POST_PHASE_27_ROADMAP、PHASE_26_FINAL_SPEC |

沒有新增修復種類、還原、遊戲內容、LLM 呼叫或自動 migration。普通遊戲操作只更新獨立守衛，不更改玩法結果。

## 原子邊界與故障

PG 使用同一 statement 擷取原始列與守衛。先獨立 COMMIT 唯一開始資格，再以 raw row lock 核對來源；不使用 `withStateLocked` 的初始化／hydrate 路徑。完整報告先在記憶體驗證，來源、trigger token 與完成報告同一交易提交。槽只 UPDATE snapshot，未重寫 saved_at／source_revision。任何開始後的意外交易故障保持未知，舊 ID 不接手、不重試。

Memory 在檔案鎖內先持久發布開始紀錄並預留報告容量，然後在沒有 await 的同步邊界內核對和整份替換，再持久發布報告。來源與檔案不是跨資源交易；若替換後停機，可能永久未知。同一仍存活程序可以只補存完成報告；重啟不恢復或重做遊戲來源。歷史已套用只代表當時結果。

明確開始前拒絕與開始後終態／未知的完整表見 R03 契約「狀態與拒絕邊界」。任意無效請求、內容衝突、無資格及容量故障不能覆寫原紀錄，也不能偽造持久拒絕報告。已開始沒有完成結果時，保留原 ID 手動查詢；可以手動用新 ID 重新預覽準備，不自動接手舊 ID。

來源上限 10 MiB；完整備份 32 MiB；報告封裝 64 KiB，只含有限差異及 metadata，低於原提案的 32 MiB 上限。每次開始預留 64 KiB 報告容量；總容量預設 1 GiB，合併備份、資格、開始、報告及預留。Memory 完成後仍保留這個保守預留；不清理歷史或死程序暫存檔。一般 JSON 64 KiB、備份每頁 20 筆；PG 取得連線 1 秒／query 2 秒，前端整次等待 30 秒。這些是工程值，沒有玩法數值或設定 UI。

API：POST／GET `/api/repair-applications/:id`、GET `/api/repair-applications/:id/report`。POST 只接受既有準備綁定欄位及 `confirm:true`，不接受任意角色、路徑、SQL 或候選資料。歷次結果經既有備份列表選取同 ID 再查詢。一般結果沒有完整故事或原稿；報告下載獨立 SHA-256 封裝，伺服器及前端校驗，不提供部分檔案。

## 手動 migration 與維運條件

開發代理沒有連資料庫或執行 migration。Grok 在隔離 DB 驗證後，再按既有手動部署流程執行：

```sh
npm run db:migrate
```

本 migration 加入修復結果表、來源版本表、全域 epoch 與來源表 trigger；不重寫遊戲 snapshot／槽時間。`down=false` 保留歷史，不能把普通 rollback 當成刪除備份或結果。未 migrate 的 PG 服務不會自動補表；新準備／套用安全失敗，既有唯讀預覽與備份讀取不依賴新資格。

一般 SQL INSERT／UPDATE／DELETE 及同值 UPDATE 更新來源 token；TRUNCATE 更新全域 epoch。若整庫還原、關閉 trigger 或繞過守衛，管理員須停所有 API 程序，完成作業後，在同一目標 DB 手動執行以下 SQL，確認提交後才重啟：

```sql
UPDATE repair_apply_epoch SET token = gen_random_uuid() WHERE singleton;
```

必須確認影響恰好一列；找不到表或列時不可開放套用。輪換使舊未開始資格無效，保留歷史已開始／終態報告。程式不會自動辨認完整 DB restore；關閉 trigger 而沒有輪換不在安全保證內。Memory 限單一權威遊戲程序，不宣稱多程序共享不同記憶體的遊戲狀態一致。

## 外部文件審查來源

2026-10-04，開發代理透過 [Grok Bot Control](../../AGENTS.md#4-測試交由-grok-bot階段驗收由使用者決定) 技能在已核對的 **AI TRPG Architecture Critic** 對話送出並讀回確認。BASE `66e926c3ee55ad47890588b5ff18ab153be0a680`、TARGET `3d8df060162163b1fbb60873baf95e95b19ea709`。

外部回報：七份文件一致性 PASS，沒有需要使用者另選條件的實作阻擋；三項 Low 為直接 SQL／還原守衛邊界、PG 未決 ID 的永久未知處理、開始前拒絕與持久終態狀態表。四項 Info 為提交時「尚未送達」字眼、遠端 AGENTS 尚為舊政策、Phase 26 generation 延伸交叉引用，以及 raw 路徑／槽時間精度提醒。

本輪依上述建議補足契約、epoch 維運說明、保守未知政策及 raw 整筆替換；**這些是本輪實作處理，尚未由 bot 驗證，不能改寫成 Low 已驗證解決。** 外部報告的可行性分析全部是推斷，沒有 runtime／build／測試／UI PASS。測試分工以使用者最新指示與本機 AGENTS 第 4 節為準；先前未提交的 AGENTS 不混入這次提交。

## 待 Grok 執行的驗證

開發代理只閱讀程式／Git 差異及寫入案例，沒有執行 build、typecheck、lint、diff-check、自動化分析、單元、整合、資料庫或 UI 驗證。新增與修改的測試均尚未執行；需真 PG 環境的案例沒有 `TEST_DATABASE_URL` 會 skip，交接要求不得以 skip 當 PASS。

```sh
npm ci
npm run build
node --import tsx --test tests/repair-application.test.ts tests/repair-preparation.test.ts tests/repair-preview.test.ts tests/pg-client-operation.test.ts
npm test
git diff --check 3d8df060162163b1fbb60873baf95e95b19ea709 TARGET_FULL_SHA
```

以上命令由 bot 執行，必須使用隔離 PostgreSQL／角色與 `TEST_DATABASE_URL`，不可碰使用者正常 DB 或 5432。整體測試如發現舊問題須分開歸因，不把歷史報告當本輪執行。

隔離瀏覽器樣本（同樣尚未執行，先由 bot build）：

```sh
node --import tsx tests/helpers/phase32-repair-application.mjs normal
```

在 `127.0.0.1:3032` 開原頁面；正常樣本初始 current 故意有兩個 R02 差異，因此可由讀取失敗入口修復，成功後讀取新狀態。槽 1／2 可修復；槽 3 故意有其他非法資料，不能修復。樣本只連本機、寫獨立暫存目錄，不載入 .env，不連 DB、不自動刪證據。模式另有 `lost-response`、`timeout`、`report-failure`、`capacity`。

- `/api/dev/phase32-count` 查看實際套用 POST 次數；停止等待／離頁／查詢不得增加 POST。
- POST `/api/dev/phase32-change/current`（或 1–3）只在隔離樣本做同內容覆寫，舊準備須失效。
- `report-failure` 模式先保存開始及修改來源，但報告發布故障；POST `/api/dev/phase32-report-recover` 後手動查詢，只補報告、不再修改來源。
- 重啟樣本保留備份與報告；舊 Memory 未決請求不重做，新程序來源不從備份恢復。

上述 dev endpoint 只存在 helper，沒有加入正式 API。真 PG 還需對實際 index.ts 做兩種提交順序、來源／結果交易故障、COMMIT 回應遺失、兩程序同 ID、容量競爭、觸發器 ABA／TRUNCATE／維運 epoch、原 saved_at 微秒及多角色隔離。

## 使用者手動驗收

- 預覽有效候選並保存原稿，核對二次確認；取消確認後來源不變且備份仍可下載。
- 每次只套用一份來源；目前資料版本加一、新 generation；槽原時間／版本保留，其他來源不變。
- 準備後繼續遊戲或同值覆寫，舊準備拒絕，提示手動重新預覽；不換成新候選。
- 模擬逾時或遺失回應，保留 ID 手動查詢，確認沒有第二次套用 POST。
- 完成或明確拒絕都有完整報告下載；舊備份與歷史結果可取回，舊 Memory 資格不能套用。
- 手機窄螢幕可捲動核對，鍵盤能操作確認／取消／查詢／下載，結果提示可辨識且不搶焦點。

本階段未驗收；工程報告不能替使用者接受。完成此階段後才討論下一項，沒有自動開始新增修復類型或下一個主要系統。

## 限定本輪的手動提交與送驗

下列指令僅列本輪檔案，排除先前未提交的 AGENTS／Phase 31 文字。使用者已授權本輪限定提交與送驗，下列為限定檔案的操作紀錄模板：

```sh
git add -- migrations/1791100000000_repair_applications.mjs src/shared/repair-application.ts src/server/repair-application-backend.ts src/server/repair-application-core.ts src/server/memory-repair-application.ts src/server/postgres-repair-application.ts src/server/repair-application-routes.ts src/server/app.ts src/server/index.ts src/server/domain-session.ts src/server/repair-preview-reader.ts src/server/repair-preparation.ts src/server/file-repair-archive.ts src/server/postgres-repair-archive.ts src/server/save-game/memory-repository.ts src/web/repair-application.ts src/web/RepairApplicationPanel.tsx src/web/RepairPreparationPanel.tsx src/web/RepairPreviewPanel.tsx src/web/repair-preparation.ts src/web/RuntimeSystemPanel.tsx src/web/App.tsx tests/repair-application.test.ts tests/repair-preparation.test.ts tests/helpers/phase32-repair-application.mjs docs/development/PHASE_32_REPAIR_APPLICATION.md docs/development/R03_SECOND_STAGE_PROPOSAL.md docs/development/R03_FIRST_STAGE_PROPOSAL.md docs/development/R03_REPAIR_APPLY_DISCUSSION.md docs/development/CANONICAL_MANIFEST.md docs/development/OPEN_QUESTIONS.md docs/development/IMPLEMENTATION_PLAN.md docs/development/POST_PHASE_27_ROADMAP.md docs/development/PHASE_26_FINAL_SPEC.md
git diff --cached --name-only
git commit -m "feat: add single-source atomic repair apply and durable reports"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
```

取得遠端可讀 TARGET 後主動送指定 bot，送出前依技能重核對目標、讀回確認送達。現在實作尚未送達，不能宣稱已送驗。可直接使用完整 prompt，將 TARGET 待填欄位換成實際完整 SHA：

```text
請以 AI TRPG Architecture Critic 做 Phase 32 工程驗證；不代替使用者最終驗收。
Repository: https://github.com/bosco8001/ai-trpg
Branch: codex/phase27-mobile-ui
BASE: 3d8df060162163b1fbb60873baf95e95b19ea709
TARGET: 待提交後填入完整 SHA，請先確認遠端可讀版本與祖先關係。

本輪：R03 第二階段單份原子套用、原頁面二次確認、唯一持久開始 ID、PG/Memory 結果及完整報告、來源 token/epoch migration。只沿用 R02 活動標記及玩家 MP 相容欄位。沒有新增玩法、修復類型、LLM、還原或自動 migration。Phase 31 已由使用者接受；歷史 Info/未測限制不得改標解決。
必要文件：AGENTS（測試政策以本 prompt 的最新使用者授權為準：開發代理沒有執行驗證；由指定 bot 執行）、CANONICAL_MANIFEST、OPEN_QUESTIONS、R03_SECOND_STAGE_PROPOSAL、PHASE_32_REPAIR_APPLICATION、PHASE_26_FINAL_SPEC、PHASE_30_REPAIR_PREVIEW_SPEC、PHASE_31_REPAIR_PREPARATION。
依 Phase 32 文件列出的完整變更檔案與命令，在隔離 Node 24/PG 環境 npm ci、build、指定四組測試、完整 npm test 與 BASE..TARGET diff-check；PG 提供隔離 TEST_DATABASE_URL，不得把 skip 當通過，不碰正常 DB/5432。測試及 helper 由開發代理準備但未執行。

檢查 current 與三槽兩種修復、單來源、原稿持久/校驗、全部來源及候選指紋與角色/版本、ABA/同值Save/SQL/刪重建/TRUNCATE、舊 Phase31/Memruntime/epoch 資格；對直接SQL/整庫restore邊界，依文件停服務+人工epoch，勿宣稱自動restore偵測。
檢查 gameplay/Save/Load/Reset/敘事 callback 在修復前後兩種順序。current revision exactly +1、新 generation、舊回覆不保存/不顯示/不fallback；History/ledger/allocator/run/world保留。槽 saved_at 微秒/source_revision 原值、不隱式 Load；current不可讀仍能修合法同角色舊Run/其他world槽。
檢查 PG 跨程序同ID/內容衝突、開始持久claim與來源交易分離、來源+report同commit、提交前/後故障、COMMIT回應遺失、永久unknown不接手舊ID；Memory開始/整份swap/report各故障點，同程序只補報告、重啟不重做/不恢復來源。容量合併/並行/預留、權限/磁碟/讀回錯誤、備份與報告損壞、固定安全錯誤/日誌、未知不得誤標拒絕。核對三項前輪Low與四項Info的本輪處理。
以Phase32隔離helper或真服務確認兩個入口、原頁面二次確認完整資訊、確認前取消、送出後停止/離頁/timeout、舊回應/重複點擊、手動查詢/無自動輪詢或POST重試、下載SHA校驗、手機/鍵盤/提示/焦點；相關Phase26–31回歸。

請回報：完整SHA/環境/每條命令exit code、真做/引用/未測/受阻、逐項結果、缺陷嚴重度與檔案行號、確切重現步驟與影響；推斷不得當實測PASS。區分本次新增與既有問題。資料庫/程序/代理/fixture清理及證據保留位置。只做審查，勿修改檔案、commit、push或自行宣告使用者驗收。
```
