# Phase 29：原始資料備份交付與手動測試

日期：2026-10-01（Asia/Hong_Kong）。Phase 29 已實作並完成下列工程檢查，**已由使用者於 2026-10-01 確認手動驗收通過**。本頁保留原有重測步驟與各次工程限制；使用者驗收紀錄見下方。已確認行為見 [Phase 29 規格](PHASE_29_RAW_DATA_BACKUP_SPEC.md)；本頁是交付紀錄，不新增玩法 Canon。

## 可見結果

探索、戰鬥、結果、主選單的系統面板，以及初始遊戲狀態讀取失敗畫面，都有「下載原始資料備份」。不需要先開啟或通過健康檢查，也不需要存檔清單可用。

點擊後取得目前配置角色與三槽的完整快照；前端驗證完整回應、格式、大小與 SHA-256 後，才發起一個 JSON 檔下載。其他遊戲操作照常；下載檔代表擷取時刻。兩個按鈕保持可聚焦，等待中阻止重複下載；「取消備份下載」只在有請求時起作用。關閉相關面板或畫面也會取消，不讓舊回應觸發下載。

預設完整檔案最多 10 MiB，整次接收最多 30 秒，失敗由使用者手動重試。成功只顯示「已發起下載，請確認下載檔案」，不聲稱已確認使用者磁碟保存成功。

## 原始讀取與檔案格式

`GET /api/raw-data-backup` 沒有使用者可指定的角色或資料來源；帶 query 會拒絕，沒有寫入方法。回應 `Cache-Control: no-store`、JSON 內容、附件檔名、完整 UTF-8 長度及 `X-Backup-Max-Bytes` 有效上限。

- PostgreSQL 用獨立唯讀連線池與一條 SELECT 取得目前列、三槽及擷取時間，四項使用同一 MVCC 快照。不開啟遊戲初始化路徑，不使用遊戲／Save hydrate 或 migration 映射。
- 來源列經 `row_to_json(... )::text` 保存為文字，不把 JSONB 大數字、bigint 或微秒時間交給 JavaScript 轉換後再寫出。來源本來缺欄位、版本不支援或資源不合法，也保留原值。
- SQL 先檢查來源文字總量，超限時不把原始內容聚合傳回應用程式；應用程式再用有大小限制的編碼器檢查完整最終檔案，涵蓋巢狀字串跳脫、外層資訊與校驗值。
- 記憶體來源在一個同步邊界擷取並編碼目前狀態與既有存檔記錄，不呼叫一般 `getState()` 或重新製作 Save。編碼時限制大小，不先建立無界限的深層複本。
- 不存在的目前列用 `current: null`，空槽用 `record: null`。來源暫時讀不到則整次失敗，不能假裝空槽。
- 目前狀態保留完整 History、敘事識別紀錄及執行協調資訊；存檔槽保留它原有的內容，不補入現在的狀態或敘事。

備份格式版本 1 的外層固定為：

```json
{
  "backupFormatVersion": 1,
  "payload": "完整備份資料區塊的 JSON 文字",
  "checksum": {
    "algorithm": "SHA-256",
    "encoding": "utf-8",
    "value": "64 個小寫十六進位字元"
  }
}
```

`payload` 是 JSON **字串**；先由外層 JSON 解碼一次後，對該字串的原有 UTF-8 bytes 計算 SHA-256。不能先解析、排序或重新序列化 `payload` 再計算；校驗值本身不參與。因此計算不依驗證器重排物件鍵順序，現有空白及字元也受校驗。

資料區塊含 `storage`、UTC `capturedAt`、配置 `characterId`、`current` 及依序 1／2／3 的 `slots`。每個非空來源記錄也保存為 JSON 字串，避免數值精度損失；記憶體目前資料是完整 GameState，槽位是既有 StoredSaveSlot，PostgreSQL 是原始列的欄位名稱與值。兩種來源由 `storage` 明確區分。

校驗只證明資料區塊內容一致，不證明來源、玩法合法性、可載入或可修復。一般 Load 不接受這個備份外層；還原仍是後續獨立階段。

## 逾時與設定

前端的 30 秒上限從操作開始持續到完整回應接收及下載前驗證，沒有在收到回應標頭時解除。取消會中止回應串流；失敗不產生 Blob 下載。

備份專用 PostgreSQL 連線沿用已驗證的連線選項優先順序，取得連線逾時一秒、資料庫查詢兩秒、預設唯讀；不改動一般遊戲連線或診斷路由。取消時會捨棄該專用連線並停止前端接收，不保證 PostgreSQL 立即停止正在執行或等待鎖的查詢；資料庫可能尚未察覺 socket 已關閉，仍由自查詢開始計算的兩秒 `statement_timeout` 取消。這不是從使用者取消時重新計算兩秒，也不是等待完整的 30 秒。正常完成則歸還連線。

`RAW_BACKUP_MAX_BYTES` 是伺服器工程設定，預設 `10485760`，只接受安全範圍正整數。前端依回應標頭使用同一有效上限，並核對宣告及實收的 UTF-8 長度；不以壓縮後大小或字數判斷。沒有自訂上限 UI。

## 手動測試一：正常遊戲與狀態不變

先停掉舊開發服務。終端機 A：

```sh
cd "/Users/bosco0295/ai trpg"
PORT=3001 DOMAIN_STORAGE=memory DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit COMBAT_ESCAPE_ROLL_FIXTURE_MODE=success NARRATION_FIXTURE_MODE=normal npm run dev:api
```

終端機 B：

```sh
cd "/Users/bosco0295/ai trpg"
npm run dev:web
```

打開 <http://127.0.0.1:5173>：

1. 探索「系統」→「下載原始資料備份」。確認瀏覽器實際下載一個 `ai-trpg-backup-...json` 檔；目前資料已保留，三槽在新記憶體程序中皆空。
2. 先存到槽 1，再下載；槽 1 應保留該次存檔的內容與時間，槽 2／3 仍空。下載不等於另存到槽位。
3. 記下版本、位置及其他資源，再備份兩次，數值不應改變。比較期間不要做其他遊戲操作。
4. 使用 Tab 移到下載按鈕，Enter／Space 觸發。完成與失敗後應保留焦點；等待期間可移到其他控制，完成不搶回焦點。用延遲樣本確認重複觸發及取消。
5. 在戰鬥、詠唱、結果未結算、Game Over 與主選單確認入口。備份不應推進回合、退 MP、結算、回血或返回探索；下載本身不阻擋遊戲操作。
6. 320／375／430px 及自己的手機瀏覽器確認說明、按鈕、提示及下載操作；整頁不應橫向溢出。

檢查下載檔案時，把下面路徑替換成真正的下載檔名：

```sh
cd "/Users/bosco0295/ai trpg"
node --import tsx tests/helpers/verify-raw-backup.mjs "/Users/bosco0295/Downloads/實際下載檔名.json"
```

預期顯示格式與 SHA-256 校驗通過，以及目前資料／三槽是否存在。工具只讀檔，不載入 `.env`、不連資料庫、不修改檔案，也不還原。若要查看內容，外層 `payload` 與各來源記錄需各解析一次；不要把原檔重排或重存後當成原始來源證據。

可在記憶體正常遊戲程序比較前後完整狀態：

```sh
curl -fsS http://127.0.0.1:3001/api/game-state > /private/tmp/phase29-before.json
curl -fsS http://127.0.0.1:3001/api/raw-data-backup -o /private/tmp/phase29-manual-backup.json
curl -fsS http://127.0.0.1:3001/api/game-state > /private/tmp/phase29-after.json
diff -u /private/tmp/phase29-before.json /private/tmp/phase29-after.json
```

沒有 `diff` 輸出表示該比較區間狀態一致。零初始化的 PostgreSQL 檢查仍須只呼叫備份 API，不要同時開一般遊戲頁；一般 `/api/game-state` 有原有初始化行為。

## 手動測試二：隔離錯誤與等待樣本

以下只用暫存記憶體，不載入 `.env`、不接資料庫、不提供遊戲寫入入口。

```sh
cd "/Users/bosco0295/ai trpg"
npm run build
node --import tsx tests/helpers/phase29-backup-preview.mjs normal
```

打開 <http://127.0.0.1:3029>。每次換模式先 Ctrl+C，再替換命令最後的 `normal`，重新整理頁面。樣本的存檔清單與健康檢查不可用，是刻意限制；本樣本只驗證備份。

| 模式 | 預期 |
|---|---|
| `normal` | 目前資料與槽 1 保留；槽 2 的版本 99、來源版本 -1、無效日期及 HP -999 都保留；槽 3 空 |
| `blocked` | 遊戲狀態失敗畫面仍能備份；不合法目前資料也保留 |
| `unavailable` | 顯示無法完整取得備份，沒有檔案、不自動重試 |
| `too-large` | 樣本上限 512 bytes，顯示超限，不截斷或下載部分內容 |
| `delayed` | 延遲 2.5 秒；等待中連按不重送，可取消或關閉面板；成功後可再下載 |
| `timeout` | 模擬 35 秒延遲；約 30 秒停止等待，不下載舊回應 |
| `bad-checksum` | 前端拒絕不一致的 SHA-256，沒有檔案 |

`delayed` 的取消後可立即再試；只有新請求能產生成功提示。停止樣本後點下載應失敗；重新啟動相同模式後，手動再試可恢復。

## 工程檢查與限制

- `npm run build` 通過，包含型別檢查、前端與後端建置。
- `npm test` 無 DB：341 項，310 通過、31 個 PostgreSQL 項目略過、0 失敗。
- 新建隔離 PostgreSQL 15 資料庫 `ai_trpg_phase26_phase29_test` 執行既有三項 migration 後，`npm test`：341 通過、0 略過、0 失敗。沒有新增或改動 migration。
- 新增 15 項測試涵蓋完整資料／隱藏敘事紀錄、戰鬥生命週期不變、原始精度、空資料不初始化、大小邊界、校驗、慢速回應取消、整次失敗、SQL 鎖表逾時與恢復，以及並行交易下四項快照一致。
- 隔離樣本的 HTTP 檔案經實際校驗工具檢查通過。瀏覽器 DOM 確認成功提示與焦點保留；等待中三次強制點擊只增加一個請求。320／375／430px 頁面沒有橫向溢出，備份控制高 48 CSS px。
- 內建瀏覽器的下載事件監測沒有取得實際保存檔案的回報；介面顯示已發起下載不被當成磁碟保存證據。實際瀏覽器下載與手機／鍵盤使用感受仍由使用者驗收。
- 真實讀屏軟體、iOS／Android 實機、全部 PostgreSQL 版本及長期大量歷史的使用情況沒有宣稱已驗收。JSONB 保存前的原始排版也無法從資料庫還原。
- 只讀備份、不送 LLM；沒有還原、修復、自動備份、壓縮、加密或上限設定 UI。

## 外部審查與 L1 文件修正

使用者提供 Grok 對 `e8865532b0702a51880e42beaad97929459451fd` 的獨立審查報告：沒有阻擋手動驗收、高或中嚴重度問題；隔離 PostgreSQL 17 的 341 項測試通過，無 DB 為 310 通過、31 略過。報告亦確認真實瀏覽器下載檔案可獨立重算 SHA-256、唯讀與來源不變、並行快照一致、大小邊界、七種樣本，以及 Phase 26／27 工程回歸。這些是外部回報，不是本次重新執行的檢查，也不代替使用者驗收。

**低 L1：取消不保證資料庫查詢立即停止。** Grok 鎖住 `save_slots`，在請求開始約 0.5 秒時中止客戶端，稍後仍在 `pg_stat_activity` 看見查詢；最終由資料庫的 statement timeout 取消。`release(true)` 捨棄連線不等於送出 PostgreSQL CancelRequest。本次採用報告提出的最小文件修正，將上方說明改為自查詢開始計算的兩秒上限；保留既有唯讀路徑及設定，沒有新增 `pg_cancel_backend` 呼叫或其他程式變更。

其餘說明記錄為工程限制，不擴大本階段：

- 目前備份失敗沒有專用伺服器日誌；維運觀測另待評估。
- 30 秒是整次接收的上限，資料庫查詢仍可先在兩秒時失敗；上限工程設定僅限制為正安全整數，沒有額外產品層最高值。
- 記憶體編碼遇到非 JSON 值（例如 `undefined` 欄位）會整次失敗，不能默默省略成部分備份。
- 檔名採 UTC 與毫秒；PG `saved_at` 保留來源時間點及微秒，不要求來源字串一律轉成 UTC。
- Grok 的故意破壞測試有兩個案例以卡住結束；明確失敗的測試逾時可後續評估，報告未提供足以定位這兩個案例的細節。本次沒有宣稱已修正。

本次只修正文件並記錄外部報告；`git diff --check` 與文件連結檢查通過，沒有重跑建置或程式測試。**該次文件修正交付時仍待使用者手動驗收；使用者其後已確認通過，見下節。**

## 使用者手動驗收紀錄

2026-10-01（Asia/Hong_Kong），使用者回報：「Phase 29 手動測試通過」。本頁記錄使用者的整體驗收結論，不補寫未提供的逐項結果，也不把 Grok 外部報告或本機工程檢查當成使用者驗收。

回報時本地分支 `codex/phase27-mobile-ui` 的 HEAD 為 `7960c9ba33aaa10d8b3ecaee1bfc37fd06e9694f`，程式實作為 `e8865532b0702a51880e42beaad97929459451fd`，其後只有 L1 文件修正。這是專案版本對照，使用者未另指定測試 SHA、手機平台或讀屏環境；不宣稱所有環境已逐項測試，也不代表分支已合併。

本次只同步驗收狀態，沒有程式變更，不重跑建置或程式測試。後續修復候選、唯讀預覽或套用仍須各自討論及批准。

## 檔案範圍與下一步

- 新增來源／格式：`src/shared/raw-data-backup.ts`、`src/server/raw-data-backup.ts`、`src/server/postgres-raw-data-backup.ts`。
- 新增前端：`src/web/raw-data-backup.ts`、`src/web/RawDataBackupPanel.tsx`。
- 接入：`src/server/app.ts`、`src/server/index.ts`、`src/server/domain-session.ts`、`src/server/save-game/memory-repository.ts`、`src/web/App.tsx`、`src/web/ExplorationPage.tsx`、`src/web/RuntimeSystemPanel.tsx`、`src/web/style.css`。
- 新增測試／樣本／檢查工具：`tests/raw-data-backup.test.ts`、`tests/helpers/phase29-backup-preview.mjs`、`tests/helpers/verify-raw-backup.mjs`。
- 文件：本頁、Phase 29 規格與階段狀態文件。沒有修改 domain 遊戲規則、Save／Load／結算寫入路徑或 migration。

Phase 29 已由使用者手動驗收通過。下一個建議討論的小項是有限修復候選與唯讀預覽，須先確認允許的錯誤類型、證據及拒絕條件；不能因已有備份就自動開始修復或套用。
