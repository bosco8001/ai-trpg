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

完成後停在 Phase 31，等使用者明確接受才討論 R03 原子套用的下一個小階段。
