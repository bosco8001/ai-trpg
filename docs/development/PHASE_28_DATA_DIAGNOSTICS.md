# Phase 28：唯讀資料健康檢查

日期：2026-10-01。**本階段已由使用者確認手動驗收通過**；驗收版本為 `d2b400bdc0e22369be4188c05ff7ffa2d9a4720f`。本文件是工程交付紀錄，不是新增 Canon。

外部審查後已補上診斷專用 PostgreSQL 兩秒查詢逾時、不同重試按鈕名稱及檢查完成提示；第二次複查後補上 `PGOPTIONS` 繼承與鍵盤焦點修正。修正範圍、326 項工程檢查及重測清單見 [Phase 28 小修正](PHASE_28_REVIEW_FIXES.md)。下方原始工程檢查紀錄保留。

## 這次交付

像替存檔做體檢：讀取目前遊戲資料及三個存檔槽，逐項報告健康狀態；不替資料動手術。

- 探索的「系統」、戰鬥／結果／主選單的「系統／存檔」內有「資料健康檢查」。
- 初始遊戲狀態讀取失敗時，仍能直接打開檢查。
- 可收起、重新檢查資料；前端五秒逾時或網路錯誤只說報告無法取得，不判定資料損壞。完成時顯示可供讀屏軟體接收的狀態提示。
- 只檢查伺服器目前配置的角色及三槽，不掃描其他角色／Run。

| 顯示狀態 | 意義 |
|---|---|
| 正常 | 通過既有格式、資源及內部引用驗證 |
| 空槽 | 該槽沒有資料 |
| 缺少必要資料 | 目前資料不存在，或未知舊資料缺少可驗證的角色／世界資訊 |
| 資料不合法 | 格式、資源或引用驗證失敗，包括存檔列的必要資訊不合法 |
| 版本不支援 | 資料版本不受目前程式支援 |
| 目前無法讀取 | 該資料來源暫時不可用；不等於資料損壞 |

「正常」只代表資料內部檢查通過，**不保證可在目前 Run 載入，也不保證可修復**。Load 繼續遵守 Phase 26 的世界／Run／角色等規則。報告是各項獨立讀取的結果；其他遊戲操作可繼續，不是同一時間的跨資料快照，亦不是備份。

## 唯讀邊界

新增 `GET /api/data-diagnostics`，回傳固定狀態、資料來源、檢查時間與可驗證的版本資訊；回應有 `Cache-Control: no-store`。沒有寫入方法，不接收使用者指定的角色或世界，也不回傳原始存檔、資料庫錯誤或連線資訊。

記憶體 session 提供獨立讀取入口。正式 PostgreSQL 組裝使用獨立 SELECT 路徑，直接檢查原始列，再交給既有 domain／Save 驗證器。不走 `getState()` 的 `createIfAbsent` 初始化路徑，不觸發 TEST 世界建立或映射寫回。已知 TEST 舊資料的既有映射只在記憶體驗證，原始資料仍保留。

診斷使用專用 PostgreSQL 連線：預設唯讀、取得連線逾時一秒、查詢逾時兩秒。卡住的查詢由資料庫取消，該項回報目前無法讀取；不改動一般遊戲保存或結算的連線設定。

目前資料與每一槽各自攔截錯誤；一個不合法的資料列不能令整份存檔清單消失。本階段沒有備份、修復候選、套用、格式升級寫入或新遊戲規則。

注意：正常遊戲頁仍會呼叫既有的 `/api/game-state`，它有原有的初始化行為。要檢查「不存在的 PostgreSQL 狀態不被建立」，應單獨呼叫診斷 API；不要以同時打開正常遊戲頁作為零初始化證據。

## 手動測試一：正常遊戲入口與狀態不變

先停止舊的開發服務，避免瀏覽器連到舊程式。終端機 A：

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

1. 探索頁開啟「系統」→「資料健康檢查」。目前資料應正常，三槽應空白；資料來源應顯示暫存記憶體。
2. 收起再打開、連續按「重新檢查資料」；位置與狀態版本不應因診斷改變。完成後應出現完成提示；探索頁的另一個按鈕名稱為「重新檢查連線」。
3. 先存到槽 1，再檢查：槽 1 應正常，槽 2／3 仍空槽。確認仍能照既有流程載入。
4. 在手機 320／375／430px 寬度閱讀，確認四項報告和按鈕可用、整頁沒有左右捲動。鍵盤 Tab 應能走到檢查、重新檢查及收起。

若要進入戰鬥，在剛啟動且未做其他改動的記憶體服務執行：

```sh
curl -i http://127.0.0.1:3001/api/dev/combat/start -H 'Content-Type: application/json' -d '{"expectedRevision":0}'
```

如果已經存讀檔或做其他動作，先從 `/api/game-state` 查看目前 `state.revision`，再替換上述版本。成功後重新整理頁面，在「系統／存檔」檢查。反覆檢查時，角色 HP／MP、目前回合和行動者不應改變；勝利後按「繼續」之前與 Game Over 也應能檢查，不應自行結算或返回探索。

可用以下唯讀方式保存前後快照作比較；比較期間不要做其他遊戲操作：

```sh
curl -fsS http://127.0.0.1:3001/api/game-state > /private/tmp/phase28-before.json
curl -fsS http://127.0.0.1:3001/api/data-diagnostics
curl -fsS http://127.0.0.1:3001/api/data-diagnostics
curl -fsS http://127.0.0.1:3001/api/game-state > /private/tmp/phase28-after.json
diff -u /private/tmp/phase28-before.json /private/tmp/phase28-after.json
```

預期 `diff` 沒有輸出。這只是資料比較；介面、流程及手機使用感受由使用者判斷。

## 手動測試二：隔離錯誤樣本

不需改壞自己的存檔。以下樣本不載入 `.env`、不連接資料庫，只用暫存記憶體；只提供診斷與頁面讀取，沒有 Save／Load／Reset／遊戲命令入口。既有存檔操作面板會顯示無法讀取，這是隔離樣本的刻意限制。

先建置，再啟動一個模式：

```sh
cd "/Users/bosco0295/ai trpg"
npm run build
node --import tsx tests/helpers/phase28-diagnostics-preview.mjs blocked
```

打開 <http://127.0.0.1:3028>。每次換模式先按 Ctrl+C 停止，再用下列模式取代命令最後的 `blocked`，重新整理頁面。

| 模式 | 手動確認 |
|---|---|
| `normal` | 探索系統入口：目前資料與槽 1 正常；槽 2／3 空槽 |
| `mixed` | 目前資料、槽 1 正常；槽 2 缺少必要資料；槽 3 資料不合法 |
| `unsupported` | 槽 3 版本不支援；正常槽仍顯示 |
| `blocked` | 遊戲狀態讀取失敗畫面仍可檢查；目前資料不合法，槽 1 正常、槽 2 缺資料、槽 3 不合法 |
| `unavailable` | 遊戲狀態讀取失敗，四項均顯示目前無法讀取，不能說資料已損壞 |

報告展開後停止樣本，再按「重新檢查資料」：應顯示無法取得報告，不能繼續顯示上次結果當作新報告；重新啟動相同樣本再試，應恢復。收起面板應取消尚未完成的前端請求，不把舊結果帶到下次檢查。

## 檔案範圍

- 新增：`src/shared/data-diagnostics.ts`、`src/server/data-diagnostics.ts`、`src/server/postgres-data-diagnostics.ts`、`src/web/DataHealthPanel.tsx`。
- 接入：`src/server/app.ts`、`src/server/index.ts`、`src/server/domain-session.ts`、`src/web/api.ts`、`src/web/App.tsx`、`src/web/ExplorationPage.tsx`、`src/web/RuntimeSystemPanel.tsx`、`src/web/style.css`。
- 測試：`tests/data-diagnostics.test.ts`、`tests/helpers/phase28-diagnostics-preview.mjs`。
- 文件：本指南、README、Implementation Plan、OPEN_QUESTIONS、Canonical Manifest、後續工作清單。
- 沒有修改 domain 遊戲規則、migration、正常 Save／Load 實作或 Canon 內容。

## 工程檢查

- `npm run build` 通過，包含型別檢查、前端建置及後端編譯。
- 使用新建的隔離 PostgreSQL 15 資料庫執行 `npm test`：324 項通過、0 失敗、0 略過。沒有使用現有遊戲資料庫。
- 新增 12 項診斷測試：只接受 GET、不初始化、不寫入、詠唱／未結算／Game Over 狀態不變、錯誤逐項隔離、版本分類、舊資料不改寫、契約及前端錯誤處理。
- PostgreSQL 測試將診斷連線設為 `default_transaction_read_only=on`，重複檢查後比較目前資料及全部槽位；缺失與不合法資料也未被建立或改寫。
- 瀏覽器工程檢查確認探索系統入口與狀態讀取失敗入口能顯示獨立報告；320px 寬度沒有橫向溢位。停止樣本服務後重新檢查，舊結果會清除並顯示無法取得報告的提示。這不代表手機手感或遊戲驗收通過。

## 使用者手動驗收紀錄

2026-10-01（Asia/Hong_Kong），使用者回報：「Phase 28 手動測試通過」。驗收版本為 `codex/phase27-mobile-ui` 的 `d2b400bdc0e22369be4188c05ff7ffa2d9a4720f`。

此處記錄使用者的整體驗收結論，不補寫未提供的逐項測試結果。使用者驗收、Grok 外部複查與本機工程檢查分開保留；不代表真實讀屏軟體、所有手機平台或 PostgreSQL 環境已逐項測試，也不代表分支已合併。

## 下一步

Phase 28 已完成使用者手動驗收。使用者其後逐項確認 [Phase 29 原始備份規格](PHASE_29_RAW_DATA_BACKUP_SPEC.md)，尚未開始程式實作；目前階段狀態見 [Implementation Plan](IMPLEMENTATION_PLAN.md)。修復候選與套用另拆，不自動繼續。
