# Phase 33 第五切片：角色建立與保存

更新：2026-10-08（Asia/Hong_Kong）。使用者以「對」批准 [完整實作確認稿](PHASE_33_CHARACTER_CREATION_PROPOSAL.md)。本切片已實作準備，使用者已於 2026-10-08 授權限定 35 檔 commit／push 及 Grok 交接，提交前尚未推送或送達 Grok；**工程待驗證、使用者待驗收**。Codex 僅閱讀程式／文件／Git、實作與撰寫測試，沒有執行 build、typecheck、lint、格式檢查、單元／整合／資料庫或瀏覽器／UI 測試。

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

選擇 → 分配 → 最後確認置於 Full-screen Sheet；只有當步操作，詳細名冊／計算放展開區。最後確認前不產生個別資質、資格、龍息或可反推資質的最終 MP。保存中阻止連按，未知結果提供查詢／重試；結果畫面唯讀。

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

**上述測試全部尚未執行。** PG 未提供隔離 `TEST_DATABASE_URL` 時會略過，略過不算通過。真伺服器重新啟動、真 TCP／PG FATAL、斷網／晚回覆、手機尺寸／大字／鍵盤／讀屏與瀏覽器仍待外部驗證；新池重讀或合成遺失回覆不冒稱這些項目已通過。完整 prompt 見 [Grok 要求](PHASE_33_CHARACTER_CREATION_GROK_REVIEW.md)。

第四切片 t47u 是外部回報、受測版本 `bb930080ac917a90fc2f6bdf0ecca888ebfcbe87`，不是第五切片結果。既有前端推導名冊核對、hash history、重複 JSON／BOM、極短畫面、測試缺口及未測平台等 Info 保留；新建立回應的名冊比對不代表舊工具 Info 已解決。

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
