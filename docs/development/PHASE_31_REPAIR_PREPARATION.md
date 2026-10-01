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

完成後停在 Phase 31，等使用者明確接受才討論 R03 原子套用的下一個小階段。
