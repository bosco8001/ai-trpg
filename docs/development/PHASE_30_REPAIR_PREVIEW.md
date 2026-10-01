# Phase 30：修復候選預覽交付與手動測試

日期：2026-10-01（Asia/Hong_Kong）。本階段已依使用者確認的 [完整規格](PHASE_30_REPAIR_PREVIEW_SPEC.md) 實作，完成下列工程檢查，**等待使用者手動驗收**。Phase 1–29 的既有驗收保持原狀；本頁不新增玩法 Canon，也不批准 R03 套用。

## 可見結果

探索、戰鬥、結果及主選單的系統面板新增「修復候選預覽」。初始狀態讀取失敗畫面也能獨立開啟，不要求健康檢查、存檔清單或備份成功。

目前資料與三槽各自顯示有效候選、無需修復、受阻、不存在、空槽或目前無法讀取。有效候選顯示最多兩項更正的原值、建議值、規則、證據欄位與整筆驗證結果；受阻只顯示已確認原因，沒有局部差異。沒有套用按鈕，也不送資料給 LLM。

結果只代表各項擷取時刻，不是備份，也不是跨來源同一時間的快照。Save 只使該槽的舊預覽過期；Load 使目前資料失效或清除舊畫面。等待中的變動、回應遺失亦保守失效，不宣稱操作成功、不自動重送。

## 原始來源與驗證

- `GET /api/repair-preview`：固定來源範圍、no-store，query 一律拒絕，沒有寫入方法。
- 記憶體直接讀取既有狀態與存檔原稿，在同步讀取邊界限制 JSON 編碼大小；不呼叫一般 `getState()`、Save、Load 或 Reset。
- PostgreSQL 每項一條 SELECT，一次取得原始列文字、大小與擷取時間；`row_to_json(... )::text` 保留數值字面量及保存時間微秒。不經資料庫 repository hydrate。四項可在不同讀取時刻完成。
- 每項來源最大 10 MiB；超限整項拒絕，不傳回被截斷的原稿。預覽回應最多 64 KiB，只含安全差異、原因、時間及指紋，沒有故事文字或完整資料。
- 原始數字需能精確表示為安全整數；會被 JavaScript 四捨五入的值不能當作證據。兩個目標欄位須已存在、型別／值域合法。
- 只接受完整目前 v2／Save v2。既有驗證器僅檢查暫時候選；比對其輸出，若需要補值或更正其他欄位就拒絕。Save v2 驗證器內部的臨時協調欄位只供既有格式驗證，不是原稿或修復證據，不寫回候選。
- SHA-256 以 UTF-8 的 `JSON.stringify([1, storage, configuredCharacterId, source])`、換行及完整原始列文字依序計算；候選指紋以同前綴及更正後完整資料的有界限 JSON 編碼計算。內容順序／空白影響原稿指紋；校驗不是來源認證，不是可永久套用的憑證。
- PostgreSQL 專用唯讀連線池：取得連線一秒、查詢兩秒，不改一般遊戲連線。取消會捨棄專用連線，不保證資料庫立即停止，仍受自查詢開始計算的兩秒 statement timeout 限制。
- 前端整次接收最多 30 秒，完整驗證回應後才顯示。失敗手動重試；取消／收起／離開後舊回應不能顯示結果。等待按鈕可聚焦，同步旗標阻止重複觸發。

## 手動測試一：正常遊戲

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

1. 探索「系統」→「修復候選預覽」。目前資料應為「無需修復」，新記憶體程序的三槽應為空槽。
2. 記下狀態版本、位置及資源；反覆重新預覽，數值應不變。沒有套用、結算或寫入按鈕。
3. 保持預覽開啟，存入槽 1。只有槽 1 的舊結果應顯示過期；重新預覽後槽 1 應顯示無需修復。Save 的 live revision 保持原有行為。
4. 在已開預覽的情況下做合法探索／戰鬥操作，仍可繼續遊戲；目前資料的舊結果應過期，或隨畫面切換清除。Load 後不能保留舊世界的預覽。
5. 在戰鬥、詠唱、結果未結算、Game Over 與主選單確認入口。預覽本身不推進回合、不退 MP、不結算、不回血或返回探索。
6. 用 Tab、Enter／Space 操作；等待、完成與失敗不應搶走焦點，等待中可移往其他控制。收起面板後不應被舊回應重新展開。
7. 手機 320／375／430px、橫向與放大字級確認原值、建議值、證據路徑與受阻原因可讀。真實觸控、讀屏及操作感受由使用者判斷。

可用唯讀方式比較預覽前後完整目前資料；比較期間不要做其他遊戲操作：

```sh
curl -fsS http://127.0.0.1:3001/api/game-state > /private/tmp/phase30-before.json
curl -fsS http://127.0.0.1:3001/api/repair-preview > /private/tmp/phase30-report.json
curl -fsS http://127.0.0.1:3001/api/game-state > /private/tmp/phase30-after.json
diff -u /private/tmp/phase30-before.json /private/tmp/phase30-after.json
```

沒有 diff 只證明比較期間資料一致，不代表使用者驗收。要檢查空 PostgreSQL 狀態不被初始化，只呼叫預覽 API；一般遊戲頁仍有既有的初始化讀取路徑。

## 手動測試二：不改壞真實資料的隔離樣本

以下不載入 `.env`、不連資料庫、不修改真實存檔。除 `live` 外，只提供預覽及頁面讀取；其他存檔／診斷／備份入口不可用是刻意限制。

```sh
cd "/Users/bosco0295/ai trpg"
npm run build
node --import tsx tests/helpers/phase30-repair-preview.mjs normal
```

打開 <http://127.0.0.1:3030>。每次換模式先 Ctrl+C，再替換最後的 `normal`，重新整理頁面。

| 模式 | 手動確認 |
|---|---|
| `normal` | 目前資料無需修復；槽 1 同時顯示活動標記與 MP 相容欄位更正；槽 2 非法長期 MP 受阻、沒有局部差異；槽 3 空 |
| `blocked` | 初始狀態讀取失敗畫面仍可獨立預覽；目前資料與槽 1 有兩項完整候選，不要求先診斷或備份 |
| `combat` | 詠唱中目前 Combat MP 為 18，長期主帳為 24；候選只把活動標記同步為戰鬥中、外層相容 MP 同步為 24，不改 Combat 的 18 或詠唱 |
| `unavailable` | 四項均為目前無法讀取；不能說資料已損壞或產生候選 |
| `too-large` | 目前來源超過 10 MiB，整項拒絕；其他槽仍獨立顯示結果 |
| `delayed` | 延遲 2.5 秒；等待時連按不重送，可取消或收起；重新預覽只顯示新請求結果 |
| `timeout` | 模擬 35 秒；約 30 秒停止等待，不自動重試、不顯示晚到結果 |
| `live` | 可操作既有 Save／Load，但只影響此程序的記憶體。先預覽，再覆蓋槽 1，確認只有槽 1 過期；手動重新預覽後恢復 |

停止樣本後重新預覽，應清除舊結果並顯示無法取得完整報告；恢復相同模式後，使用者可手動再試。

## 工程檢查

- `npm run build` 通過，含型別檢查及前後端建置。
- 無 DB 的 `npm test`：358 項，324 通過、34 個 PostgreSQL 項目略過、0 失敗。
- 全新暫存 PostgreSQL 15，套用既有三項 migration 後，`npm test`：358 通過、0 略過、0 失敗。未新增或改動 migration，未連到使用者遊戲資料庫。
- 新增 17 項測試：兩項完整候選、原稿／ledger 保留、不同 MP authority、active／victory／Game Over、缺值／非法值／身分與引用拒絕、舊格式不補值、精度、獨立失敗／大小／逾時、GET-only、前端完整契約／取消及 Save／Load 過期守衛。
- PostgreSQL 原稿包含微秒保存時間；反覆預覽後列內容與時間不變。空目前資料不初始化；鎖住槽表時目前資料獨立完成、槽查詢約兩秒停止，解除後可重新讀取。
- 首次完整測試有三項被既有 Phase 26 測試資料庫名稱保護擋住；改在同一暫存 PostgreSQL 新建符合名稱限制的 `ai_trpg_phase26_phase30_test` 後重跑，全部通過。沒有改掉名稱保護或略過失敗。
- DOM 確認正常與初始讀取失敗入口、逐欄差異與受阻原因。320／375／430px 及 812×375 橫向沒有整頁橫向溢出；新控制高 48 CSS px。重新預覽後焦點仍留在按鈕。
- 隔離延遲樣本中，三次快速強制點擊只增加四項讀取，即一次預覽。取消與收起清除等待結果；隔離 `live` 樣本覆蓋槽 1 只使槽 1 過期，手動重新預覽恢復。
- `git diff --check` 通過。未自行 commit／push。

工程檢查不代表遊戲手感、UI 感受、手機實機、真實讀屏、放大字級或使用者驗收通過。其他分頁變動未必被即時察覺，沒有聲稱實作了 R03 的競爭檢查／原子套用。只顯示已確認的拒絕原因，不保證列出全部錯誤。

## 完整檔案範圍

- 新增後端／共用：`src/shared/repair-preview.ts`、`src/server/repair-preview.ts`、`src/server/repair-preview-reader.ts`。
- 新增前端：`src/web/repair-preview.ts`、`src/web/RepairPreviewPanel.tsx`。
- 接入：`src/server/app.ts`、`src/server/index.ts`、`src/web/App.tsx`、`src/web/ExplorationPage.tsx`、`src/web/RuntimeSystemPanel.tsx`、`src/web/api.ts`、`src/web/style.css`。
- 測試／樣本：`tests/repair-preview.test.ts`、`tests/helpers/phase30-repair-preview.mjs`。
- 文件：本頁、Phase 30 規格、README、Canonical Manifest、Implementation Plan、OPEN_QUESTIONS、後續工作清單。
- 沒有修改 domain 遊戲規則、正常 Save／Load 寫入路徑、敘事保存、Canon、migration 或正式內容。前端 API 只加上預覽過期通知，不改既有請求內容或重試政策。

## 下一步

先等待使用者手動驗收 Phase 30。之後才討論 R03 的備份前置驗證、來源／版本／lineage 守衛、原子套用與修復報告；不自動開始，也不將全部項目綁成一個巨大階段。
