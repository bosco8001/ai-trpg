# Phase 31：持久備份與修復準備

日期：2026-10-02（Asia/Hong_Kong）。使用者批准 [第一階段完整範圍](R03_FIRST_STAGE_PROPOSAL.md)，並授權實作後 push。**工程交付待 Grok Bot 驗證；開發代理沒有執行 build、typecheck、格式、測試、資料庫或瀏覽器驗證。階段待使用者接受。** Phase 1–30 已接受，R03 套用仍未實作。

## 可見結果與變更範圍

像把原稿放進保管箱：候選預覽旁新增「修復前備份與紀錄」，可以從有效候選保存一份完整原稿、以識別碼查詢及下載歷次備份。顯示「備份就緒，尚未套用」。遊戲可繼續；沒有套用、還原或刪除入口。

- 共用契約：`src/shared/repair-preparation.ts`。
- 後端：`src/server/repair-archive.ts`、`file-repair-archive.ts`、`postgres-repair-archive.ts`、`repair-preparation.ts`；`app.ts`／`index.ts` 接線。
- 前端：`src/web/RepairPreparationPanel.tsx`、`repair-preparation.ts`，既有 `RepairPreviewPanel.tsx` 接入及 `style.css`。
- 保存結構：`migrations/1790900000000_repair_preparations.mjs`；`.env.example`／`.gitignore`。
- 待執行測試：`tests/repair-preparation.test.ts`；隔離 UI 樣本：`tests/helpers/phase31-repair-preparation.mjs`。
- 文件：本頁、第一階段批准稿、R03 討論及 README／Manifest／Plan／Roadmap／OPEN_QUESTIONS 狀態同步。沒有 domain、一般 Save／Load、LLM 或玩法 Canon 變更。

## 保存與故障契約

準備請求固定配置角色及四種來源，一次一份。重新讀取原稿，以 R02 純分析器重建候選，核對來源／候選指紋及規則版本；同角色的合法舊 Run／其他 world 可準備，其他角色槽拒絕。R02 唯讀分析仍保留原來的全域槽行為。

唯一 UUID 在請求前建立，綁定角色、儲存模式、來源、指紋及版本。已保存的同 ID／同內容請求回原紀錄，即使來源後來改變也不新增；改變綁定則拒絕。準備失敗若未能持久保存紀錄，查不到時只回「目前沒有可確認的紀錄」，不能據此認定請求已撤銷。停止等待不保證撤回已發布的檔案或 COMMIT。

Memory 使用專用私有目錄（預設 `.repair-backups`、0700），檔案 0600。完整暫存檔同步磁碟後，以同目錄 hard-link 原子發布且不覆寫 ID，再同步目錄、移除本次暫存檔及讀回校驗。跨程序鎖序列化容量判定與發布；可確認已停止的同主機擁有者才回收鎖。鎖的擁有者不完整／無法確認時，25 秒後拒絕新增，既有查詢及下載仍可用；部署者可在所有相關程序停止後人工處理鎖。崩潰遺留的 `.tmp` 不視為有效備份，計入容量且不自動清理。檔案系統不支援同步／hard-link 或權限不足時不回報成功。

PG 只新增 `repair_preparations` 表，不寫遊戲表。專用池取得連線 1 秒，每條 statement 2 秒，交易強制同步提交，以 advisory transaction lock 序列化容量判定與新增；提交前後讀回驗證。斷線或 abort 時丟棄連線，不宣稱查詢立即停止；COMMIT 回應不確定時先查識別碼。備份表 migration 必須由部署者手動執行，啟動不建立或讀取備份資料。

兩種模式重啟後可取回備份。Memory 以獨立 runtime UUID 標示舊程序紀錄；保留備份不代表 Memory 遊戲狀態持久化，舊紀錄不是新程序的套用授權。任何未來套用仍須獨立核對。

來源 10 MiB、完整封裝最多 32 MiB、摘要 64 KiB、整次接收 30 秒。`REPAIR_BACKUP_MAX_BYTES` 可調低至正整數；`REPAIR_ARCHIVE_MAX_BYTES` 預設 1 GiB。總容量按未壓縮邏輯內容計算：PG 包含封裝文字、重複角色欄位 UTF-8 及 UUID 的 16 bytes；Memory 包含目錄中檔案大小（包括遺留暫存檔），並保留 4096 bytes 鎖資訊額度。資料庫／檔案系統的配置頁、索引、日誌等實體空間不納入此工程額度。超限拒絕新增，不截斷或刪舊備份。

列表每頁 20 筆，按 UUID 降序作穩定游標，**不是按建立時間排序**；每筆顯示擷取時間。只回摘要、不含原稿；逐份校驗並丟棄原稿，避免同時保留 20 份大型檔案。下載完整封裝且兩端校驗後才發起瀏覽器下載。伺服器不可宣稱已確認使用者磁碟保存。

本瀏覽器記住最近準備的識別碼與本頁建立的識別碼清單，不保存原稿；停用本機儲存時仍顯示 ID，使用者須自行保留。回應未知時先手動查詢；可明確選擇保留 ID 並結束本次等待，之後仍須再次手動觸發才建立新準備。沒有自動 POST 重試或輪詢。舊回應不能覆蓋新操作，等待／成功／失敗不搶焦點。

## 備份格式與獨立校驗

這是獨立的修復備份格式，不冒充 Phase 29 的四來源備份，也不是可載入的 Save。

外層 JSON 只有 `backupVersion: 1`、`payload` 字串與 `checksum: { algorithm: "SHA-256", value: <64位小寫hex> }`。SHA-256 只計算 **payload 字串的精確 UTF-8 bytes**，不包含外層校驗欄位。解析 payload 只為讀取中繼資料；校驗時不能重排鍵或重新序列化 payload。

payload 保存 `repairId`、`source`、`storage`、`previewVersion: 1`、`rulesVersion: 1`、`fingerprint`、`candidateFingerprint`、`characterId`、`runtimeId`（PG 為 null）、`capturedAt`、`preparedAt`、`revision`、`formatVersion: 2`、`changes` 與 **raw 原始文字**。原稿不經數字／日期轉換或重新序列化；PG 原稿為 R02 同一條 SELECT 的 `row_to_json` 表示，包含微秒保存時間。

來源指紋沿用 R02：`SHA256(UTF8(JSON.stringify([1, storage, characterId, source]) + "\n" + raw))`。候選指紋由 R02 完整候選分析器重建；下載者可先獨立重算封裝與來源校驗，再以分析器核對候選。校驗不是簽章或來源認證，不保證目前來源未變動，也不批准套用。

## API

| 方法／路徑 | 行為 |
|---|---|
| POST `/api/repair-preparations` | body 僅含 UUID、source、storage、previewVersion、rulesVersion、fingerprint、candidateFingerprint；最大 4 KiB，不接受 query |
| GET `/api/repair-preparations` | 列表，只接受可選 UUID cursor |
| GET `/api/repair-preparations/:id` | 完整校驗後回安全摘要，不接受 query |
| GET `/api/repair-preparations/:id/backup` | 完整校驗後下載，不接受 query |

全部 no-store。錯誤類別：400 invalid-request；409 stale／blocked／identity-conflict／conflict；413 too-large；507 capacity；404 not-found；503 unavailable。格式或體積超過 Fastify 的請求接收限制，也可由框架先拒絕；前端保留識別碼，不依賴此錯誤推定取消。

## Grok 執行步驟（開發代理未執行）

1. 核對固定 BASE／TARGET 完整 SHA、完整差異、新檔及批准範圍，讀 AGENTS 第 4 節。本頁不是通過報告。
2. Node 24 執行 `npm ci`、`npm run typecheck`、`npm run build`、`npm test`、`git diff --check BASE TARGET`。無 DB 的略過項必須明列。
3. 新建隔離 PG（建議 17，另標示版本），明確設定 `TEST_DATABASE_URL`，跑全部測試。新測試在 UUID 隔離 schema 跑實際 migration；另外做 migration 舊資料前後不變與第二次無待執行項目檢查。不得連真實 DB。
4. 獨立故障／動態驗證：真正程序重啟與突然停止、兩個 API 程序共用目錄、並行重複／不同 ID 容量邊界、磁碟／權限／校驗／鎖／停機、PG 只許備份表寫入的角色、來源數字與保存時間精度、正常遊戲六種狀態零變動、不同角色及舊世界、失敗查詢不冒稱撤銷。新測試不能取代這些動態證據。
5. `npm run build` 後，以 `node --import tsx tests/helpers/phase31-repair-preparation.mjs normal` 開樣本（預設 3031）。依次試 state-failure、capacity、lost-response、delayed、timeout、unavailable；只使用 tmp 下 `ai-trpg-phase31-review`，重啟保留備份。需要新空目錄時，停止樣本且確認路徑後由 Grok 清理；勿清理正式目錄。
6. Playwright／真實 Vite+API 驗證雙入口、角色拒絕、反覆觸發、停止等待／收起／離開、遲到回應、查詢、重啟、下載完整性、30 秒及 64 KiB／32 MiB 接收邊界、焦點、320／375／430px 無溢出。helper 的 `/api/dev/phase31-count` 可讀 POST 次數；`POST /api/dev/phase31-change/current` 或槽 1–3 可模擬來源變動，這些路由不在正式 app。
7. 回歸 Phase 26 的兩支重啟腳本、Phase 29 備份校驗（Memory／PG）及 Phase 30 預覽；不得把未執行項標為通過。測完停止隔離服務，回報新增／保留的環境狀態。

## 使用者手動驗收

- 從有效候選每次只保存一份，看到「備份就緒，尚未套用」及完整差異。
- 繼續遊戲後，備份仍是擷取時刻；目前資料與三槽沒有被修復。
- 回應遺失或停止等待後，用同一 ID 查詢，沒有自動重送。
- 重啟後查詢、下載原稿；Memory 舊程序提示清楚。
- 手機上的按鈕、識別碼、提示及下載體驗可用。

## I5 外部回報與本次修正

2026-10-02（Asia/Hong_Kong），使用者轉交 Grok 對 `939d53392df92f34855b35e687fc71e75ffef1d1` 的 Memory 補驗結果，確認 **I5，Low**：owner 檔先建立再寫入，競爭請求讀到空或殘缺內容時，`JSON.parse` 例外造成即時 503，未遵守原有 25 秒等待期限。這是外部工程回報，不是開發代理執行的結果，也不代表 Phase 31 已驗收。

外部環境為 Node v24.21.0、Debian 13，兩個真實 API 程序共用隔離目錄。注入 owner 寫入延遲的 3 輪共 21 個請求中，18 個在 19–24 ms 回 503；log 確認讀到 0 bytes 後解析失敗。原版程式預置空／殘缺 owner 的四種情境也在 12–17 ms 拒絕，owner 不存在的對照組則正常等待。外部回報確認備份校驗正確，沒有搶鎖、刪鎖或寫壞資料。

未注入延遲的自然壓測沒有命中 I5，不能記為 I5 通過；其 300 個請求中的 11 個 503，外部歸因於 I4 的 `lstat` ENOENT。此次沒有建立資料庫；外部回報測試服務已停止、`/workspace/p31w` 已刪除、原 repo 工作目錄乾淨。沒有據此補寫 PG 或其他 Phase 31 檢查通過。

本次只修 I5：在 `src/server/file-repair-archive.ts` 捕捉 owner JSON 的 `SyntaxError`，將該次擁有者視為無法確認，沿用現有等待、取消及 25 秒期限。其他檔案／權限錯誤仍拒絕；不藉解析失敗回收鎖，不變更備份格式、PG、遊戲來源或套用範圍。

`tests/repair-preparation.test.ts` 新增空／殘缺 owner 稍後補完整、活程序鎖不得回收、取消後鎖保留，以及永久殘缺 owner 到期限才拒絕且舊備份可下載的回歸案例。永久殘缺案例使用真實 25 秒等待。**上述修正與新增測試均待 Grok 複查；開發代理沒有執行任何測試或驗證命令。**

使用者回報提到 `c5a011e`，但本次開始時本機不存在此 commit，唯讀遠端查詢也顯示分支仍在 `939d53392df92f34855b35e687fc71e75ffef1d1`。因此本次修正以該完整 SHA 為基準，沒有宣稱包含 `c5a011e` 或 I4 修正；與另一份修正版的整合及 I4 狀態仍須另行核對。

## I5 複查外部回報及 I1／I2／I4 修正交付

2026-10-02（Asia/Hong_Kong），使用者轉交 Grok 的 I5 複查：BASE 為 `939d53392df92f34855b35e687fc71e75ffef1d1`，TARGET 為 `6e450d5ea4fbdac545211dd97241b26f92707255`。外部環境為 Node v24.21.0、npm 9.2.0、Debian 13。**I5 獨立動態驗證全部通過，未發現新缺陷；Phase 31 整體仍為 BLOCKING，未經使用者驗收。** 這些是外部回報，不是開發代理執行的結果。

| 外部命令 | 回報結果 |
|---|---|
| `npm ci` | exit 0 |
| `npm run typecheck` | exit 2；測試資料 TS2322，I1 |
| `npm run build` | exit 2；被 typecheck 阻擋 |
| `env -u TEST_DATABASE_URL npm test` | exit 1；376 項，339 通過、I2 一項失敗、36 項 PG 測試略過 |
| BASE 到 TARGET 的 `git diff --check` | exit 0 |

外部確認兩個新增 I5 測試實際通過，永久殘缺案例等待 25013.9 ms；把新測試放回 BASE 執行時，四個子測試失敗，證實覆蓋原有失敗路徑。兩個真實 Memory API 程序的獨立動態驗證涵蓋命中空 owner 窗口、空／殘缺內容稍後補完整、永久殘缺到期限才拒絕、中途取消、同 ID 去重與完整性，均回報通過。備份 SHA-256／來源指紋正確，遊戲來源前後雜湊相同，活程序鎖沒有被搶走。

自然壓測三輪各 300 個請求，共 23 個 503：17 個歸因於 I4 的 `lstat` ENOENT，另外 6 個因統計 regex 錯誤沒有錯誤路徑，維持待驗證，不歸因於 I4 或 I5。PG、Phase 26 重啟腳本、UI、Playwright、PG 回歸及 I3 均未驗證。外部回報測試程序已停止，`/workspace/i5` 與 log 已刪除，沒有建立 DB 或容器；repo 停在上述 TARGET 且工作目錄乾淨。

本次在 `6e450d5ea4fbdac545211dd97241b26f92707255` 上直接補上可定位的三個問題，保留 I5 修正：

- **I1**：測試中的外角色 snapshot 明確使用原存檔型別，避免 `activity` 推成一般字串。不用型別斷言掩蓋錯誤，不改正式遊戲型別。
- **I2**：Memory 備份解析／格式失敗轉為 `PreparationFailure("unavailable")`，查詢、下載及列表遵循既有故障契約。加強空／殘缺 JSON、錯誤結構及內容變動案例；不提供損壞原稿。
- **I4**：只在等待鎖的 `lstat` 遇到 ENOENT 時等待再重試，避免持鎖者正常釋放造成立即拒絕。其他權限／檔案型別錯誤不被吞掉，仍沿用期限與取消機制。新增不同 ID 並行的回歸案例；該案例不保證每次命中競爭窗口，Grok 仍須另做精確故障注入及雙程序驗證。

變更只在 `src/server/file-repair-archive.ts`、`tests/repair-preparation.test.ts` 及本頁。**本次修正與案例尚未執行測試或工程驗證，待 Grok 複查。** `c5a011e` 本機仍不可讀取，沒有宣稱合併該 commit 或完成 I3；I3 原始描述／diff 尚待提供，不能自行猜測問題內容。整體狀態維持待驗證及使用者接受，不開始原子套用。

## I1／I2／I4 複查及 I2 無效 UTF-8 修正

2026-10-02（Asia/Hong_Kong），使用者轉交 Grok 複查，BASE 為 `6e450d5ea4fbdac545211dd97241b26f92707255`，TARGET 為 `a11084c031c6b365566acfe9acf68172cfd14500`。外部環境為 Node v24.21.0、npm 9.2.0、Debian 13。**外部確認 I1／I4 通過，I5 回歸通過；I2 主要情境通過，但無效 UTF-8 仍為 Low 級殘留。I3 尚未修正，Phase 31 未結案，未經使用者驗收。**

| 外部命令／檢查 | 回報結果 |
|---|---|
| `npm ci`、`npm run typecheck`、`npm run build` | 各 exit 0 |
| `env -u TEST_DATABASE_URL npm test` | exit 0；377 項，341 通過、0 失敗、36 項 PG 測試略過，不算通過 |
| 隔離 PG 17.11 的 `npm test` | exit 0；377 項全數通過，0 略過 |
| BASE 到 TARGET 的 `git diff --check` | exit 0 |
| 四個 migration 與再次執行 | 首次成功；第二次無待執行項目 |
| 兩個 Phase 26 restart 腳本 | 分別使用獨立 DB，均 exit 0、`passed:true` |

以上是 Grok 外部回報，不是開發代理執行的結果。I1 以 BASE／TARGET 的 typecheck 對照確認。I4 靠實際命中鎖釋放窗口的故障注入、雙程序、容量及取消驗證；TARGET 自然壓測 600 個請求沒有 503，BASE 的 300 個請求有 10 個 503，全部歸因於 `lstat` ENOENT。新增 I4 並行測試在 BASE 也通過，不能當作失敗路徑覆蓋證據。I5 的空／殘缺 owner、期限及取消驗證回報通過。

I2 的 JSON／格式／校驗故障、HTTP 503 與 no-store、不洩露原稿及缺失／其他角色紀錄區分已獲外部確認；殘留是 `TextDecoder({fatal:true})` 在無效 UTF-8 拋出 TypeError，使直接呼叫的錯誤類別不一致。HTTP 已回安全 503，但原測試沒有覆蓋此位元組故障。

本次只補 I2 殘留：在 `src/server/file-repair-archive.ts` 的 UTF-8 解碼邊界捕捉失敗，轉成 `PreparationFailure("unavailable")`，仍使用嚴格解碼，不替換、截斷或改寫損壞原稿。`tests/repair-preparation.test.ts` 新增有效備份中間位元組改為 `0xFF 0xFE` 的案例，核對直接 archive 呼叫、查詢／下載／列表錯誤類別、三個 HTTP 入口的安全 503 與 no-store、磁碟損壞內容未變，以及隔離樣本恢復原位元組後可正常下載。變更仍只在該程式、測試及本頁。

**本次 UTF-8 修正及新增案例未執行，待 Grok 複查。** 上一輪無法歸因的六個 503 不能事後補證，維持待驗證。I3、UI／Playwright（含雙入口、焦點、手機、接收期限與大小邊界）、Phase 27–30 動態回歸、PG Phase 31 故障驗證，以及 migration 前後舊資料 md5 比對仍待處理，不以 PG 單元／整合測試通過取代這些項目。

外部回報隔離 PG port 55426 的三個 DB 與角色已刪除，叢集、`/workspace/pg31r`、副本及 log 已清理，程序已停止，沒有容器；保留 postgresql-17 套件與 `/workspace/node24`。原 repo 停在上述 TARGET 且工作目錄乾淨。本次修正以該完整 SHA 為基準，沒有宣稱包含 `c5a011e`。

## I2 無效 UTF-8 外部複查通過

2026-10-02（Asia/Hong_Kong），使用者轉交 Grok 複查，BASE 為 `a11084c031c6b365566acfe9acf68172cfd14500`，TARGET 為 `883d01f9bac82032a0c91d0403ba15dbf769cefe`。外部環境為 Node v24.21.0、npm 9.2.0、Debian 13。**I2 無效 UTF-8 殘留獨立驗證通過，未發現新缺陷；Phase 31 尚未結案，I3 未處理。** 以下均為外部回報，不是開發代理執行的結果，不代替使用者驗收。

- `npm ci`、typecheck、build 及 BASE 到 TARGET 的差異格式檢查均 exit 0。Memory 測試 378 項，342 通過、0 失敗、36 項 PG 測試略過；略過項不算通過。新建隔離 PG 17.11 執行同套測試，378 項全部通過、0 略過。四個 migration 首次成功，第二次無待執行項目。
- 有效備份中間兩個位元組改為 `0xFF 0xFE`：BASE 的 archive.get 及 service 查詢／下載／列表拋 TypeError；TARGET 四項均拋 `PreparationFailure("unavailable")`。新增測試放回 BASE 時也因原有 TypeError 失敗，證實涵蓋缺陷路徑。
- 真實 `index.ts` API 的三個入口均回安全 503、no-store，不洩露原稿、路徑或 stack；失敗下載沒有 Content-Disposition 或部分內容，API 程序測後仍存活。損壞檔測前後 SHA-256 相同。
- 有效備份下載 200 且位元組完全一致，獨立重算 checksum 與來源指紋正確。不存在 ID 及其他角色紀錄查詢／下載均 404，列表只列配置角色紀錄。
- I1／I4／I5 本輪依套件回歸通過；I5 永久殘缺案例實際等待 25067 ms。本輪未重跑雙程序鎖故障注入，不把套件結果改寫成新的故障注入證據。

本輪仍未執行／待處理：I3、UI／Playwright、Phase 27–30 動態回歸、PG Phase 31 故障測試、migration 前後舊資料 md5 比對及兩個 Phase 26 restart 腳本。上一輪 Phase 26 腳本的外部通過紀錄仍只代表其當時版本；先前未歸因的六個 503 維持待驗證。TARGET 歷史不包含 `c5a011e`。

外部回報隔離 PG DB 與角色已刪除，叢集及 `/workspace/pg31u`、副本與 log 已清理，API 程序已停止，沒有容器；原 repo 停在上述 TARGET 且工作目錄乾淨。本次只補記此份報告，沒有程式變更、沒有把待驗證項目改寫為通過。使用者另回覆「I3未處理」，維持其待處理狀態，原始問題描述仍待提供。

## I3 原始回報及借出 PG client 的錯誤處理

2026-10-02（Asia/Hong_Kong），使用者轉交 Grok 對文件 commit `3233538d89033ab8d4c4866386b7177afdcd2318` 的審查：相對 `883d01f9bac82032a0c91d0403ba15dbf769cefe` 只改本頁，內容核對無問題，差異格式檢查 exit 0；本輪未執行 build、DB 或 UI。這是外部文件審查，不代表 Phase 31 驗收。

同份回報重建 I3 原始問題（Medium-High）：在 `939d53392df92f34855b35e687fc71e75ffef1d1`，借出中的 PG client 遇到沒有 ErrorResponse 的斷線，會發出未被接住的 `error` 事件，使 API 程序結束。pool 層 listener 只處理閒置連線，不能代替借出期間的處理。外部回報 Phase 31 備份操作及 Phase 30 reader 曾動態重現；Phase 29 reader 僅依相同程式模式推論，沒有動態重現證據。三處到文件 TARGET 仍未改動。

外部重現使用隔離 PG 17（55426）與 TCP proxy（55427）：偵測指定 SQL，轉送至 PG、丟棄回應，5 ms 後關閉雙向 socket，不發 ErrorResponse。曾使用 `COMMIT`、`SELECT repair_id FROM` 與 `row_to_json` 標記。保存的 log 記錄 PID 359387／360871 以 `Unhandled 'error' event`、`Connection terminated unexpectedly` 結束；`pg_terminate_backend` 發送 FATAL 的對照組則約 501 ms 回 503，程序存活。個別 PID 對應哪個 SQL、crash 時 COMMIT 是否保存、部分輸出與完整啟動命令沒有保留，不能補寫確定結果。

本次以 `3233538d89033ab8d4c4866386b7177afdcd2318` 為基準處理 I3：

- 新增 `src/server/pg-client-operation.ts`，取得連線後為本次操作掛 client `error` 及 abort listener；斷線／取消時，以呼叫端的安全 unavailable 錯誤結束等待，並且只 `release(true)` 一次。仍觀察稍後才結束／拒絕的操作 promise，避免遲到結果變成成功或未處理 rejection。
- 正常歸還先由 pg-pool 接管閒置錯誤，再移除本次 listener；不移除 pool 或其他既有 listener。取得連線期間取消時，連線抵達後丟棄，不開始資料操作。取得連線失敗轉為 unavailable；原有容量／超限等業務拒絕不改類別。
- `postgres-repair-archive.ts`、`repair-preview-reader.ts`、`postgres-raw-data-backup.ts` 三處使用同一處理。沒有更動 SQL、交易／容量／指紋／版本規則、migration、池的上限或 timeout 設定，也不改一般遊戲連線。
- Phase 31 準備／查詢／下載故障與 Phase 29 下載仍由既有 API 回安全 503。Phase 30 保留四來源各自 unavailable 的預覽契約，能回完整報告時仍為 200，不因 I3 改成全部失敗或改寫來源。
- COMMIT 回應遺失只表示結果無法確認，不宣稱撤銷成功，不重送 INSERT／COMMIT；使用者仍用原識別碼手動查詢持久紀錄。

新增 `tests/pg-client-operation.test.ts`，以實際 pg Client 的 EventEmitter 配合隔離的模擬 pool／query，涵蓋三個入口的借出錯誤、取得連線失敗、正常 listener 交接、無 active query 時斷線、重複 error／取消競爭、遲到 query rejection、取得連線期間取消、既有業務拒絕及 COMMIT 結果未知後以新連線查 ID。這些是程序內事件案例，不是實際 TCP／PG 故障證據。**新增測試及本次修正均未執行，待 Grok 驗證。**

Grok 須在隔離環境重做三入口的真實 TCP proxy 故障，包括 Phase 29 原先只推論的情況；記錄每輪 SQL 標記、PID、完整命令、HTTP／reader 結果及程序存活，核對 COMMIT 後持久紀錄實際有／無的兩種結果、無重送、後續查詢、單次 release、遲到事件、取消與連線回收。錯誤不能洩露故事／SQL／連線資訊；原遊戲資料與三槽須保持不變。套件通過不能取代這些動態證據。

本機仍無法讀取 `c5a011e`，也沒有可重用的 `pg-client-operation.ts`；本次是當前基準上的修正，沒有宣稱合併該 commit。I3 狀態改為修正已交付、待 Grok 複查，Phase 31 未結案，其他待驗證項目及使用者驗收邊界不變。

## I3 外部工程複查通過，Phase 31 尚未結案

2026-10-02（Asia/Hong_Kong），使用者轉交 Grok 複查，BASE 為 `3233538d89033ab8d4c4866386b7177afdcd2318`，TARGET 為 `9ff93db9d3a24f1202708590d3e75461c34c1e71`。**I3 工程複查通過，沒有 Medium 或以上缺陷；有一項 Low 與兩項 Info 觀察。Phase 31 尚未結案，未獲使用者驗收。** 以下均為外部回報，不是開發代理執行的結果；本次只更新文件。

外部核對 BASE 是 TARGET 祖先，中間一個 commit，只改指定六檔，未改 `index.ts`、route、SQL 或 migration；TARGET 不包含 `c5a011e`，`src` 沒有全域 `uncaughtException`／`unhandledRejection` handler。環境為 Node v24.21.0、npm 9.2.0、PostgreSQL 17.11、Debian 13.7。

| 外部命令／項目 | 回報結果 |
|---|---|
| `npm ci`、typecheck、build、BASE 到 TARGET 的差異格式檢查 | 各 exit 0 |
| `node --import tsx --test tests/pg-client-operation.test.ts` | exit 0；11 項全部通過 |
| `env -u TEST_DATABASE_URL npm test` | exit 0；389 項，353 通過、0 失敗、36 項 PG 測試略過；略過不算通過 |
| 全新隔離 PG migration、再次 migration | 四個 migration 成功；第二次無待執行項目 |
| 隔離 PG 全套測試 | exit 0；389 項全部通過，0 略過 |

I1／I2／I4／I5 本輪依套件回歸通過，I5 永久殘缺案例實際等待 25026 ms；本輪沒有重做 Memory 雙程序故障注入，不把套件通過當成該故障注入的結果。

### 真實 TCP 故障的 BASE／TARGET 對照

外部使用真實 `index.ts`、postgres 模式與最小權限角色，經 TCP proxy（55427）連隔離 PG（55426）。proxy 偵測指定 SQL 後停止轉回應，5 ms 後關閉雙向 socket，不送 ErrorResponse；另安排 COMMIT／INSERT 不轉送的情境。每輪 TARGET proxy 只命中一次。

BASE 五條路徑全部在 20:49 HKT 以 `Unhandled 'error' event / Connection terminated unexpectedly` 結束，exit 1：Phase 31 COMMIT（PID 85294；DB 該 ID 已有一列）、列表（85459）、下載（85761）、Phase 30 current（85502）、Phase 29 `WITH records AS MATERIALIZED`（85554）。**Phase 29 本輪首次取得動態 crash 證據。** 這些是本輪 BASE 的新紀錄，沒有回填舊報告缺失的 PID 對應或 COMMIT 結果。

TARGET 共十一輪故障，程序均存活，後續 `/api/health` 為 200、stderr 為空、遊戲表 md5 未變：

- COMMIT 已送到 PG（PID 85819）：prepare 回安全 503、no-store，沒有 Content-Disposition；之後新連線查同一 ID，查詢／下載均 200。psql 確認一列，下載與 DB 逐位元組相同，獨立重算 SHA-256 與來源指紋正確。INSERT／COMMIT 各一次，沒有自動重送。
- COMMIT 未送到（86001）及 INSERT 未送到（86055）：回 503，後續查詢 404，DB 零列；文案仍說明不代表已撤銷。
- 列表（86283）及下載（86333）：回 503、no-store，沒有部分內容，之後再次請求 200。
- Phase 30 current 與槽 1／2／3（86546／86599／86741／86795）：完整報告 200，只有被切斷的來源為 unavailable，其餘正常，符合逐來源契約。
- Phase 29（86383）：回 503、no-store，沒有 Content-Disposition；之後重新下載 200。

所有回應沒有洩露 SQL、路徑、stack 或原稿。`pg_terminate_backend` FATAL 對照（PID 87084）中 prepare／list／raw backup 約 0.5 秒回 503，preview 回 200，程序存活。statement timeout 實測約兩秒；archive pool 的 max 2、連線逾時一秒、statement timeout 兩秒及 synchronous_commit on 未退化；容量、ID 衝突及 SQLSTATE 分類程式未改。

### 生命週期證據、測試限制及觀察

真實 pg Pool 配合斷線 proxy 的七個生命週期案例全部通過，零 unhandledRejection，程序存活：無 query 時斷線只 release(true) 一次，後續取得不同 backend；重複 error／error 與 abort 競爭均單次 release；取得連線期間取消不執行 work 並丟棄抵達的連線；遲到 query rejection 被觀察。正常借還五十次 listener 數固定為一，沒有累積，歸還後閒置斷線由 pool 接住。

新 helper／測試放回 BASE 副本、保留三入口舊實作：十一項中四過、七失敗，四個通過項只測 helper。COMMIT 案例直接顯示原有未處理 error；三個入口 error 案例雖失敗，runner 顯示次要的 late query rejection，訊息不夠直接；另三個取得連線失敗案例因錯誤分類不同而失敗，不能當作 crash 證據。**真正 I3 缺陷路徑及修正證據依上述 TCP 對照，不只依套件失敗。**

- **Low，尚未修正：** `pg-client-operation.ts` 的斷線處理完全沒有 log；外部故障輪次查不到 level 50 紀錄。Grok 建議增加不帶敏感資訊的 log callback。本次僅記錄，沒有加入日誌或宣稱已接受此殘留。
- **Info：** 容量／超限等業務拒絕也 release(true)，會丟棄健康連線；只影響效能，不影響正確性。本次未改。
- **Info：** 入口測試在 BASE 的失敗訊息不夠直接，限制如上。本次未改測試。

仍待驗證：UI／Playwright、完整 Phase 27–30 動態回歸、migration 舊資料前後 md5 比對、Phase 26 restart 腳本、先前未歸因的六個 503，以及本輪沒有重做的 Memory 雙程序故障注入。上述遊戲表故障前後 md5 不變，不能取代 migration 前後舊資料比對。舊 I3 報告缺失資料維持缺失。

外部回報 API／proxy 已停止，隔離 DB／角色已刪除，`/workspace/i3r` 已清理，沒有動到 5432。保留 `/workspace/i3r-evidence`（每輪 log 與腳本，416K）及 `/workspace/p31`；原 repo 停在上述 TARGET 且工作目錄乾淨。本輪文件更新不代表重跑任何工程驗證。

## 結案前外部工程驗證與使用者分項手動結果

使用者轉交 Grok 對 `771e7de3d5e4facfd08f883f261026582dd43bc1` 的結案前工程回報，BASE 為 `9ff93db9d3a24f1202708590d3e75461c34c1e71`，分支為 `codex/phase27-mobile-ui`；外部核對遠端 HEAD 與 TARGET 相同，BASE 到 TARGET 只有本頁更新。**外部回報 Phase 31 範圍沒有新缺陷，可執行案例均通過，但仍有未執行及證據缺口；Phase 31 尚未獲使用者整體接受。** 以下工程結果均由 Grok 執行；開發代理本輪只更新文件，沒有執行驗證。

外部環境：Node v24.21.0、npm 9.2.0、Debian 13.7、PostgreSQL 17.11、Chrome 154.0.8037.57、Playwright 1.63.0。使用本輪新建的隔離 PG（`127.0.0.1:55426`、角色 `phase26_test`、DB 前綴 `ai_trpg_phase26_p31f_`），沒有動到 5432，也沒有設定 LLM key。

| 外部命令／項目 | 本輪回報 |
|---|---|
| `npm ci`、build、typecheck、差異格式檢查 | 各 exit 0 |
| `env -u TEST_DATABASE_URL npm test` | exit 0；389 項，353 通過、0 失敗、36 項 PG 測試略過；略過不算通過 |
| 隔離 PG `npm test` | exit 0；389 項全部通過，0 略過 |
| `phase26-restart-check` | exit 0、`passed:true`；重啟三次，combatId 與 history 保留 |
| `phase26-casting-restart-check` | exit 0、`passed:true`；重啟三次，MP 一直為 18，沒有退還 |

**migration 舊資料比對：`771e7de` 外部回報通過，當輪樣本未含其他世界。** 在全新 DB 先套用前三個 migration，建立 current 與三槽樣本，包含微秒保存時間、其他角色及含大數字的 v1 舊格式。Phase 31 migration 前後，`game_states` 兩列、`save_slots` 三列及舊表結構 md5 未變；新增備份表與 migration 追蹤紀錄分開判斷，再執行 migration 無待執行項目。其他世界情境其後在 `77125f4` 補驗通過，詳見下節；不能回填成 `771e7de` 當輪已涵蓋。這些 migration 前後證據與較早故障前後遊戲表 md5 不變分開記錄。

### 使用者已回覆的手動項目

以下為使用者在本機隔離樣本的回覆，不是 Grok 自動化結果，也不是整個階段接受：

- 保存後查詢與下載成功；已提供識別碼 `29009b8e-a444-405a-9c58-194c482ee613`。
- 重啟後查詢／下載及舊 Memory 程序提示符合預期。
- 停止等待後識別碼保留，手動查詢成功。
- 初始遊戲載入失敗時，仍可找到備份入口、查詢及下載。
- 窄視窗排版沒有問題，依該次驗收清單完成查詢／下載。
- 鍵盤操作及焦點正常。

使用者最初看不到保存入口，開發代理讀取當時頁面及檔案發現載入的舊前端產物沒有 Phase 31 備份面板；交由使用者重新 build／啟動後，使用者提供截圖確認保存按鈕出現。之後的手動結果不等同真實手機觸控、手機下載或正式遊玩驗收。

### 前輪缺口與最新補驗狀態

- 前輪「第 3 項的 Memory 部分」指同角色舊 Run／其他世界可準備、其他角色拒絕；已在 `77125f4` 補驗通過，不是全部 Memory 或雙程序故障未測。
- 前輪 PG Phase 30 UI 腳本曾執行至第 23 行逾時，不能寫成完全未執行；在 `77125f4` 換用符合腳本空槽前提的新隔離 DB 後通過。本輪未涵蓋 PG UI 有候選的情境，相關證據仍引用舊輪。migration 其他世界樣本也在 `77125f4` 補驗通過。
- 沒有真實手機或真實 LLM；真手機觸控／下載、背景切換／離線及手機讀屏仍未驗收。Phase 31 備份本身不呼叫 LLM；正常遊玩與敘事體驗另由使用者確認。
- 前輪摘要未逐項附案例矩陣，其後 `77125f4` 回報已補齊：UI／Playwright、Phase 27–30 動態回歸及 Memory 雙程序故障的既有證據標示引用 `771e7de`，只有本輪實際補驗項目標為 `77125f4` 通過；詳見下節。
- 舊六個未歸因的 503 維持資料缺失，不能以本輪結果回填舊原因。
- 原先待查的 404 已在 `77125f4` 確認為 `GET /favicon.ico`，評為 Info，不影響功能，尚未修正。
- 探索頁觀察已在 `77125f4` 完整記錄為 Low：放大字造成橫向溢出；屬 Phase 31 以外，未修正。系統面板仍能以可見位置觸控或鍵盤 Enter 開啟，不能寫成完全無法操作。
- I3 斷線日誌缺失 Low、健康連線被業務拒絕丟棄及 BASE 測試訊息的兩項 Info，本輪沒有修正或使用者接受的回報，維持原狀。

本輪引用而未重跑的既有結果：`9ff93db9d3a24f1202708590d3e75461c34c1e71` 的 I3 TCP 故障及 `tests/pg-client-operation.test.ts` 11／11，以及 `771e7de3d5e4facfd08f883f261026582dd43bc1` 的文件審查。原稱「helper 11／11」來自外部報告用詞錯誤，這十一項是上述測試檔，不是 UI helper。不改寫成新的故障注入結果。

後續真機／正常遊玩驗收，依外部建議確認 320–430 寬及最大系統字體、探索／戰鬥／結果／繼續中的備份操作、背景切換或離線後識別碼保留與手動查詢、手機下載及重啟取回，以及 VoiceOver／TalkBack 或外接鍵盤。**正常遊玩可以依規則更新進度；驗收重點是備份操作沒有額外改寫進度或三槽，不要求整輪遊玩狀態完全不變。**

外部回報本輪程序均已停止，七個隔離 DB 及角色已刪除，叢集與 `/workspace/p31f` 已清理，沒有動到 5432；原 repo 在 TARGET 且乾淨。保留 `/workspace/p31f-evidence`（29M，log、JSON、migration、sec7、截圖及腳本）、`/workspace/i3r-evidence`、`/workspace/p31`。`/tmp/phase31-0Gg7bC` 是本輪之前的殘留，外部沒有刪除；開發代理未存取或清理這些外部路徑。

## 文件更正、五項補缺結果與證據矩陣

使用者轉交 Grok 對 `77125f4fae372e121a4a8aa5770099c9f8a79837` 的文件核對與補缺回報，BASE 為 `771e7de3d5e4facfd08f883f261026582dd43bc1`；外部確認遠端 HEAD 等於 TARGET、BASE 是祖先、只改本頁，產品程式相同，差異格式檢查 exit 0。**本輪沒有新產品缺陷；文件的十一項測試名稱誤標已在本次更正。這是外部工程審查，不是使用者驗收；Phase 31 未結案。**

外部環境與前輪相同（Node v24.21.0、npm 9.2.0、Debian 13.7、PG 17.11、Chrome 154、Playwright 1.63.0），使用新隔離叢集 `127.0.0.1:55426`、DB 前綴 `ai_trpg_phase26_p31g_`，沒有 LLM key。`npm ci`、build、三個 migration 步驟、Memory 第三項 A／B、PG `p30-ui.mjs`、放大字與 404 量度腳本均 exit 0。本輪未重跑 typecheck、`npm test`、restart 或雙程序故障，不把前輪結果改寫成本輪執行。

為捕捉 404 順帶執行的 Phase 27 interact／p27-extra 均 exit 1；外部歸因於共用同一 Memory API 導致初始狀態不符合腳本前提，該兩次執行不當作有效回歸結果，也不算通過。較早的有效 Phase 27 證據仍只標引用，不能用這兩次無效執行替代。

### 五項補缺結果

1. **Memory 第三項：本輪通過。** 原缺口是同角色舊 Run／其他世界合法存檔可準備，而其他角色拒絕。真實 Memory API 存檔會重建合法快照、沒有預載入口，既有 helper 也沒有舊 Run／其他世界樣本。外部另建隔離程序，以 TARGET 的 `buildApp()` 執行真實 Memory 路由，先經 PUT 建立三槽，再於測試程序內部注入舊紀錄，未改產品程式。舊 Run、舊 Run 加其他世界、同 Run 換世界均 ready；其他角色回 409 及身分不符提示。四份下載逐位元組核對，checksum／來源指紋吻合；樣本的允許修復差異只涉及 activity，備份操作前後遊戲與三槽 hash 不變，沒有觸發 Load、Reset 或額外 PUT。0755 備份目錄正確回 503；只改 `phase26.worldId` 的不完整世界變更正確受阻。
2. **PG Phase 30 UI：本輪通過，候選情境仍只引用。** 腳本未改，換用三槽皆空的新隔離 DB 以符合原腳本前提。過期提示、取消／收起正常；503、合約錯誤、資料過大時各只發一次請求；320／375／430px 無溢出，外部回報三入口的四來源結果 4／4 identical。repair 表始終零列；DB 計數由 `0|0|0` 到 `1|2|0` 的變化來自遊戲操作。本輪空槽 UI 沒有涵蓋有候選情境，該部分仍引用舊證據；前輪腳本至第 23 行才逾時，不是完全未執行。
3. **其他世界 migration：本輪通過。** 樣本包含 current、其他角色且其他世界的 game_states 列；槽一為同角色舊 Run 加其他世界（時間 `.654321`），槽二其他角色（`.123456`），槽三含大數字的 v1 舊格式（`.000001`）。migration 前後 game_states 兩列 md5 前綴 `5f6c5739…`、save_slots 三列 `cd3668e2…`、舊結構 `3b5c3645…` 均未變，微秒時間與大數字保留；上述只有外部提供的前綴，不補寫完整雜湊。新表／pgmigrations 第四列分開判斷，pg_dump 差異只有新表，重跑無待執行項目。
4. **404：本輪確認為 favicon，Info。** 首次載入時瀏覽器請求 `GET /favicon.ico`；index.html 沒有 icon link，也沒有 public 目錄。Vite preview 與正式靜態站有該 404，Phase 31 helper 因 SPA fallback 不出現。只增加 console 訊息，不影響功能；證據為 `logs/netlog-404.jsonl`。同期 500／連線重設是 results 腳本注入，不能列為產品缺陷。本次沒有修 favicon。
5. **探索大字排版：已完整記錄，Low，未修。** CSS 字體放大模擬在 320px／200% 時頁面寬 364px，由 `.exploration-header` 撐闊；375px 的 100／150／200% 均無溢出；430px／150% 為 460px、斷線時 518px，430px／200% 為 612px、斷線時 690px，由 `.connection-brief` 撐闊。連線提示及重試被推出畫面，故事標題被壓窄。外部分析涉及 style.css 的 header 橫排 flex（321–327）、connection-brief 的 flex:none（359–365）、狀態 nowrap（367–373）及 ≤25rem 才直排（1001–1009），對應 ExplorationPage.tsx（270–280）；行號均指本輪 TARGET。重現為 430×932、html font-size 150／200%，另截斷 health 模擬斷線，量度 scrollWidth 與 innerWidth。可見位置 touch tap 或 Enter 仍可開系統面板；舊稱完全無法點擊是座標錯誤，不成立。這是探索頁既有 Low，非 Phase 31 新缺陷，也不代表真手機系統字體效果。

### 版本與案例證據矩陣

下表 `E` 為外部 `/workspace/p31f-evidence`（`771e7de3d5e4facfd08f883f261026582dd43bc1`）。「引用」表示在該版本通過、本輪未重跑；產品碼相同也不改標為本輪通過。這些路徑是 Grok 保留的外部證據，開發代理未自行存取或執行。

| 範圍 | 本輪狀態／證據 |
|---|---|
| Phase 31 UI 1：雙入口、預覽、準備入口、收起／重取 | 引用 E 的 `logs/ui-p31-normal.log`、`ui-p31-mode-state-failure.log`、`shots/11,12,21` |
| UI 2：合法來源與外角色／受阻／過期／偽造／版本拒絕 | 引用 `ui-p31-ui2-b.log`、`shots/05`；六次拒絕 POST 沒有新增紀錄 |
| UI 3：同角色舊 Run／其他世界、其他角色拒絕 | PG 引用 `json/real-postgres-A.json`；Memory 本輪 `77125f4` 通過 |
| UI 4：連點／切換／收起再返回 | 引用 `ui-p31-mode-delayed.log`、`ui-p31-ui2-switch.log`；各只一次 POST |
| UI 5：遺失回應／取消／逾時、200／404／503 文案 | 引用 `ui-p31-mode-lost-response.log`、`ui-p31-mode-timeout.log`、`shots/06–09` |
| UI 6：滿三十秒、慢標頭／慢 body | 引用 `ui-p31-slow.log`、`faultproxy.log`、`shots/20` |
| UI 7：64 KiB／32 MiB 前端上限 | 引用 `ui-p31-limits.log`；不另推定摘要未列的子案例 |
| UI 8：列表／分頁／下載／重啟及獨立校驗 | 引用 `ui-p31-ui2-restart.log`、`json/restart-*`、`shots/22,23` |
| UI 9：來源改變後拒絕舊候選及保留備份 | 引用 `shots/03,24`；409、二十四份備份保留 |
| UI 10：320／375／430px、長 ID、200%、鍵盤／焦點／aria-live | 引用 `ui-p31-ui2-layout2.log`、`shots/30–36`；真機未測 |
| 真實 PG API＋前端的 Phase 31 流程 | 引用 `json/real-postgres-A/B.json`、`shots/40–42` |
| Phase 27／28／29、Phase 30 helper／Memory UI／PG API | 引用 E 的 `logs/p27-*`、`p28*`、`p29*`、`p30-modes.log`、`p30-pg-app-preview.log`、`pg-p282930.log`、`shots/p27`、`shots/p29` |
| Phase 30 PG UI | 本輪通過；空槽前提，有候選 UI 本輪未測、仍只引用 |
| Memory 雙程序並行／容量 | 引用 `E/sec7/two-process.json`、`boundary-stress.json`；同 ID 去重、不同 ID、差一 byte 回 507 |
| I4／I5 故障及 BASE 對照 | 引用 `E/sec7/natural.json`（I4 自然命中 169 次）、`i45.json`（I4／I5 注入與 abort）、`base-*/` |
| 大小／期限、備份不改來源 | 引用；本輪另確認 Memory hash 與 PG 列數未變 |
| 其他世界 migration | 本輪通過，詳見五項補缺 |
| npm test、typecheck、Phase 26 restart | 引用前輪結果，本輪未執行 |
| 真機／手機下載／讀屏 | 未執行 |

### 剩餘限制與清理

本輪另觀察存檔後焦點跳到「跳至故事紀錄」連結，Memory／PG 均出現，尚未深入定位，維持待查觀察，不能直接定為產品缺陷。不要與使用者已通過的備份查詢焦點混為同一操作。

I3 斷線無日誌 Low、丟棄健康連線與 BASE 失敗訊息的兩項 Info 均未修、未接受；favicon Info 與探索大字 Low 也未修。舊六個 503 維持無法歸因。真機、手機下載／讀屏、正式遊玩驗收仍待使用者確認；PG 有候選 UI、套件、restart、雙程序故障本輪未重跑，只保留各自舊版本引用。字體放大只有 CSS 模擬，不能當真手機結果。

外部回報所有本輪程序已停，三個 DB／角色、叢集及 `/workspace/p31g` 已刪除，沒有連接或改動 5432。舊 `/workspace/p31f-evidence`、`/workspace/i3r-evidence`、`/workspace/p31` 未改；本輪 `/workspace/p31g-evidence`（14M）保留。證據腳本仍指向已刪除的 `/workspace/p31g`，重跑須先重建隔離環境與更新路徑，不把保留腳本視為已可直接執行。

## 探索大字與 I3 安全日誌小修正（2026-10-03，待驗證）

使用者要求處理探索大字溢出及 I3 斷線缺少日誌。基準為 `d9879537c3239f4e679677295a3ab7551218d989`；本次尚未 commit，目標 SHA 待提交後填入。以下是開發代理已寫入本機的實作紀錄，**不是測試通過，也不是使用者接受**。上節各版本的「未修」保留為當輪歷史結果；這兩項目前改為「已實作，待 Grok 驗證」。

- 探索頁：標題列與連線提示允許換行、縮小到容器寬度，狀態與重試文字可以折行；故事標題與模式標籤也允許換列，避免大字時將標題擠成一字一行。只改 CSS，不隱藏橫向溢出、不縮小使用者字體、不限制縮放。
- I3：共用 PG 操作 helper 新增可選、無錯誤參數的日誌回呼。第一次借出 client error 先丟棄連線，再回報；重複 error 不重複回報。正常歸還、主動取消及業務拒絕不由此回呼記為斷線。同步拋錯或非同步拒絕的日誌回呼不取代原本 unavailable 結果。
- 三個 PG 入口（原始備份、候選預覽、修復備份）接上啟動程序的 logger。固定欄位為 `event: "pg_connection_error"`、`operation: "raw-backup" | "repair-preview" | "repair-archive"`、`state: "borrowed" | "idle"`；使用 error 等級及固定訊息，不傳入原始 error、SQL、故事、檔案路徑、stack 或連線字串。這三個專用 pool 的閒置斷線也改用相同安全欄位；其他 pool 不在本次範圍。
- 補充 `tests/pg-client-operation.test.ts`：無敏感錯誤參數、單次回報、三入口接線、取消／正常／業務拒絕不回報、日誌回呼拋錯／拒絕仍安全完成，以及 COMMIT 回應遺失不重送。所有新增及調整案例尚未執行。

本次檔案限於 `src/web/style.css`、`src/server/pg-client-operation.ts`、`src/server/postgres-raw-data-backup.ts`、`src/server/repair-preview-reader.ts`、`src/server/postgres-repair-archive.ts`、`src/server/index.ts`、`tests/pg-client-operation.test.ts` 及本文件。SQL、migration、Memory 鎖、容量與遊戲規則未改；不處理 favicon、存檔焦點待查觀察或既有兩項 Info，不實作 R03 套用。

依 AGENTS.md 第四節，開發代理只閱讀程式與 Git 資訊，未執行 build、typecheck、格式檢查、測試或瀏覽器驗證。Grok 應針對 320／375／430px、100／150／200% 字體及連線／離線狀態核對排版，並以隔離 PG 加真實 TCP 斷線核對日誌、程序生存、單次丟棄、COMMIT 不重送及結果查詢。CSS 模擬仍不等同真機字體與觸控驗收。

完成後停在 Phase 31，等使用者明確接受才討論 R03 原子套用的下一個小階段。
