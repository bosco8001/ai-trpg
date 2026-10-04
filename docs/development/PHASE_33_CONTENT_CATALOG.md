# Phase 33：正式內容名冊第一步

2026-10-04 使用者要求「進入下一階段」。本次是 R04 的小切片：只將已定五種族的創角資料轉為可讀、可驗證的正式名冊，並提供唯讀核對入口。首版 `641b82f` 的指定 bot 外部工程結論為未通過；同切片 D1／D2 補修待複驗，使用者尚未驗收。不宣稱全部 R04 或正式創角已完成。

Repository：`https://github.com/bosco8001/ai-trpg`；分支：`codex/phase27-mobile-ui`。BASE：`8f5c0334c2dbab10d2c519c3118af44c383c5a1e`。TARGET：本階段限定提交的完整 SHA，提交及 push 後填入實際送交 bot 的 prompt；本文件不以自身尚未產生的 SHA 作為驗證結果。

## 範圍與來源

- `docs/world/races.md` §3–7：五種族名稱、固定六屬性加成、人類兩點自由種族屬性點、魔力資質分布。
- `docs/gameplay/character_system.md` §5：魔力資質與直接施法資格分開；精靈／龍裔生成結果於創角完成後揭曉。
- 玩家可長期扮演普通人或代行者。沒有為任何角色預設代行者身分，沒有產生施法資格。
- 不含種族能力執行、壽命／文化資料、職業起始套裝、物品／技能／法術內容、創角、HP／MP 推導、存檔版本遷移或正式 Run。這些內容未收錄，不代表其 Canon 被移除或全部尚未設計。

## 工程契約

- 首批使用隨程式編譯的 TypeScript 結構化資料，位於 `src/server/content/races-v1.ts`；這是檔案格式選擇，不新增玩法。正式數值來源仍是上述 Canon，測試數值不得反寫。
- `schemaVersion=1` 定義這個有限資料格式；`catalogVersion=1` 定義首批內容；`namespace=official` 與 `scope=race-creation-metadata` 明確標示不是完整種族能力目錄。後續增改正式內容須明確處理版本及引用，不在本期決定舊存檔相容政策。
- ID 為 `race.human`、`race.elf`、`race.dwarf`、`race.orc`、`race.dragonborn`，屬穩定工程識別碼，不是新世界名稱。六屬性完整列出；未列加成以零表達已定無加成。人類自由加成另列兩點，不能默默套到某屬性。
- 魔力資質列整數百分比（低／普通／高／極高），總和必須為 100；矮人普通以 100% 表示。精靈／龍裔揭曉標為 `after-creation`；其他種族標為 `unspecified`，不替未定時機新增規則。沒有隨機抽取、角色資質或直接施法資格欄位。
- 載入時整份結構驗證，拒絕未知 schema／內容版本、額外或缺少欄位、重複或 TEST 種族 ID、非整數／越界數值、非法機率總和。數值界限只是首版格式的防錯限制，不是新屬性上限或平衡規則；未來 Canon 擴充須同步調整格式。
- 先複製，對即將載入的同一份快照驗證，再深層凍結；複製失敗或快照不合法時使用固定錯誤並整份拒絕。原始物件的 getter 不會在驗證後再被讀取以替換已載入值；呼叫者與原始物件不能改同一版本的內容。正式 lookup 只查正式 Map；未知、錯誤種類或 TEST 引用沒有 fallback。
- 正式 `class`／`item`／`skill`／`spell` 類別目前列在 `pendingKinds`，沒有任何正式定義；全部引用返回 unknown-content，不以 TEST fixture 代替。這個拒絕只作用於本次正式 lookup，既有 TEST state／inventory／技能／Save 驗證沒有改接這個服務。

## API 與畫面

- `GET /api/content-catalog`：不接受 query，返回完整五種族名冊。
- `GET /api/content-catalog/resolve?kind=race&id=race.human&version=1`：恰好接受 `kind`、`id`、`version` 三欄。非法格式 400、不支援版本 409、未知正式內容 404；固定安全文案，不回顯任意 ID 或內部錯誤。兩個 GET 都 `Cache-Control: no-store`，不讀取／寫入玩家、存檔或 DB，不呼叫 LLM。
- 系統／存檔面板新增「正式內容名冊」，手動開啟讀取五個種族，顯示版本、固定加成、自由種族點、資質分布及揭曉註記。前端驗證完整回應，32 KiB 接收上限、5 秒等待、收起／離頁取消、固定錯誤文案、手動重新讀取；不輪詢、不生成角色。
- 補修將 `ContentCatalogPanel` 接入探索頁自己的系統抽屜；戰鬥與主選單沿用 `RuntimeSystemPanel` 的入口。首版只接入後者，正常探索缺少入口（D1）；補修後的實際畫面仍待 bot 複驗。本期沒有新增初始讀取失敗畫面的入口。

## 本次限定檔案

新增：`src/shared/content-catalog.ts`、`src/server/content/races-v1.ts`、`src/server/content-catalog.ts`、`src/web/ContentCatalogPanel.tsx`、`tests/content-catalog.test.ts`、本文件。

修改：`src/server/app.ts`、`src/web/RuntimeSystemPanel.tsx`、`docs/development/CANONICAL_MANIFEST.md`、`docs/development/OPEN_QUESTIONS.md`、`docs/development/IMPLEMENTATION_PLAN.md`。首版共十一檔；同切片 D1 補修另修改 `src/web/ExplorationPage.tsx`。不包含原有未提交的 `AGENTS.md` 或 Phase 31 文字。

## 工程檢查：待 Grok Bot

開發代理只閱讀程式／Git、編寫案例及核對差異，沒有執行 build、typecheck、lint、測試或 UI 驗證。首版五項測試由 Grok 執行；本次補修與新增案例尚未執行，不能引用首版結果作為補修通過。

指定 bot 的命令：`npm ci`、`npm run build`、`node --import tsx --test tests/content-catalog.test.ts`、完整 `npm test`、BASE..TARGET `git diff --check`。完整 PG 回歸須隔離 `TEST_DATABASE_URL` 並先 migrate，不能碰正常 DB 或 5432；skip 不算 PASS。本次本身無 DB migration。

## 使用者核對清單（待工程驗證後）

1. 開啟系統／存檔 → 正式內容名冊，看到五個種族與內容版本 1。
2. 人類固定加成皆零，另有兩點自由種族點；精靈力量 -1／體質 -2／智慧 +1／感知 +2；矮人力量 +1／敏捷 -1／體質 +2／魅力 -2；獸人敏捷 +2／感知 +2／智慧 -3／魅力 -1；龍裔力量 +2／體質 +2／智慧 +1。
3. 分布與 Canon 一致；精靈／龍裔註記創角後揭曉。沒有預設直接施法資格或聲稱種族能力已接入。
4. 收起、重開、重新讀取、窄螢幕及鍵盤操作正常；開名冊後繼續遊戲、Save／Load／修復仍照原流程，讀取名冊不增加 revision。

如使用者未另行修訂，Phase 32 小補修的 bot 結果驗收授權不延伸至 Phase 33；本階段仍等使用者接受。下一步可討論首批職業內容或另拆 R05 屬性推導，未自動開始。

## 限定提交與送驗

2026-10-04 使用者以「確認授權」批准本切片列出的十一個檔案限定 commit／push 及送交指定 bot。這次授權不包含原有 AGENTS.md 與 Phase 31 變更，亦不延伸至後續主要階段。限定提交指令：

```sh
git add -- src/shared/content-catalog.ts src/server/content/races-v1.ts src/server/content-catalog.ts src/web/ContentCatalogPanel.tsx tests/content-catalog.test.ts src/server/app.ts src/web/RuntimeSystemPanel.tsx docs/development/PHASE_33_CONTENT_CATALOG.md docs/development/CANONICAL_MANIFEST.md docs/development/OPEN_QUESTIONS.md docs/development/IMPLEMENTATION_PLAN.md
git diff --cached --name-only
git commit -m "feat: add versioned official race content catalog"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
```

首版完整審查 prompt 範本（實際送出時 TARGET 已填 `641b82f1686d24991e0d1da4ba9095b629995dcc`，20:49 HKT 已讀回確認送達；以下保留範本，不作補修送達證據）：

```text
請以 AI TRPG Architecture Critic 做 Phase 33/R04 首個種族名冊切片工程驗證，不代替使用者驗收。
操作者 Codex。Repository https://github.com/bosco8001/ai-trpg；Branch codex/phase27-mobile-ui。
BASE 8f5c0334c2dbab10d2c519c3118af44c383c5a1e
TARGET 待限定提交及 push 後填入完整 SHA；先確認遠端分支與祖先、恰好本文件列出的十一個檔案。
必要文件：AGENTS（本次開發代理沒有執行驗證，由指定 bot 執行）、CANONICAL_MANIFEST、OPEN_QUESTIONS、PHASE_33_CONTENT_CATALOG、Character §5、Race §3–7。Phase 32 已接受及小補修 PASS 的外部來源與限制保留，不重判其驗收。
範圍是五種族已定創角 metadata 的 versioned official catalog、嚴格 loader/lookup、兩個只讀 GET、系統面板唯讀入口。職業/物品/技能/法術 pending；不得把本次 lookup 拒絕當成已改接一般 state/Save，沒有新玩法、生成、資格、HP/MP 推導、migration 或 LLM。
新隔離環境 npm ci、npm run build（包含 typecheck）、node --import tsx --test tests/content-catalog.test.ts、完整 npm test、git diff --check BASE TARGET；完整 PG 回歸用隔離 TEST_DATABASE_URL 並先 migrate，記命令 exit code及實際 pass/skip，不碰正常 DB/5432。
逐項核對五種族固定屬性、人類自由兩點、四種資質百分比及精靈/龍裔揭曉與兩份 Canon 一致；普通人/代行者皆可扮演，魔力資質不賦予施法資格。metadata 明確不包含種族能力執行。
驗 loader 整份拒絕、未知版本/缺欄/額外欄/非法數值/重複ID/TEST隔離；原物件及消費者不能改凍結名冊；未知class/item/skill/spell/race引用、錯類別及__proto__/constructor不可回退TEST。核對數值驗證界限屬工程格式不是新Canon。
真 HTTP 200/400/404/409、no-store、嚴格query/重複欄/注入、固定安全錯誤不洩漏。GET 不讀寫玩家或DB、不改revision/slot/generation/guard、LLM呼叫零。既有TEST戰鬥/存檔/修復回歸仍正常；如引用舊結果須標版本。
正式 build 產物由正常系統面板/主選單/戰鬥入口打開名冊，驗完整五族顯示、手動刷新、收起/離頁/取消、timeout/格式非法/舊回應不覆蓋、鍵盤/320/430寬度及live提示；無自動輪詢，正常操作無JS錯誤，不顯示測試資料或錯誤暗示已創角。不要用繞過build的UI補充當PASS。
回報完整SHA/環境/命令exitcode、逐項結果、缺陷嚴重度與精確行號/重現/影響、真做/引用/推斷/未測/受阻、清理及證據位置；不修改專案、不commit/push、不代替使用者接受，不展開下一階段。
```

## 首版外部工程結果與同切片補修（2026-10-04）

來源：AI TRPG Architecture Critic，Asia/Hong_Kong 21:00:23–21:00:33 的報告，Codex 透過 Grok Bot Control 直接讀取。BASE `8f5c0334c2dbab10d2c519c3118af44c383c5a1e`；TARGET `641b82f1686d24991e0d1da4ba9095b629995dcc`。遠端指定分支為 TARGET、BASE 為祖先、限定十一檔，均為外部回報。整體工程結論：**未通過**；不重判 Phase 32，不代替使用者驗收。

外部環境為 Node 24.21.0、npm 9.2.0、Debian 13.7、隔離 PostgreSQL 17.11（55426）、Chrome 154、Playwright 1.63.0。外部命令結果：

| 命令 | exit | 外部結果 |
|---|---:|---|
| `npm ci` | 0 | 成功 |
| `npm run build` | 0 | 含 typecheck |
| `node --import tsx --test tests/content-catalog.test.ts` | 0 | 5／5 通過 |
| `env -u TEST_DATABASE_URL npm test` | 0 | 370 通過、41 略過，共 411 |
| `npx node-pg-migrate up`（隔離 DB） | 0 | 成功 |
| `npm test`（隔離 PG） | 0 | 413／413 通過 |
| `git diff --check BASE TARGET` | 0 | 成功 |

略過不算通過。以上是首版外部執行，不能套用為本次補修結果。

- **D1 Medium**：首版只有 RuntimeSystemPanel 接入名冊，探索頁獨立系統抽屜缺少入口；production 預設非戰鬥狀態無法到達名冊，與文件及核對清單不符。補修在 `ExplorationPage.tsx` 系統抽屜加入現有 `ContentCatalogPanel`，不重建探索工具或改動遊戲命令；待正式 production UI 複驗。
- **D2 Low**：loader 先驗原始輸入、再複製，getter 可使載入值與驗證值不同。首版固定 literal 不會觸發，但快照保證不成立。補修先 `structuredClone`，驗證該快照再凍結；複製失敗也整份拒絕並用固定訊息。新增變動 getter、非法首次快照與不可複製輸入案例，尚未執行。
- **測試 Info**：首版 28 個 mutation 捕捉 22 個，漏掉屬性多鍵、種族缺欄、移除 ±12 界限、移除 schemaVersion 檢查、未凍結種族物件、resolve 缺 no-store。已補相關資料變體、各層凍結及修改種族名稱、resolve 成功與錯誤回應 header 斷言；未宣稱六項已被測試捕捉，交 bot 重新評估。
- **其餘 Info 保留**：export 的 OFFICIAL_RACES_V1 原物件未凍結，service 使用獨立快照；races 陣列非索引屬性會被接受並在 JSON 輸出丟棄；±12 格式界限可能與 Canon 的 12 點自由屬性分配混淆，文件仍明示兩者無關。沒有改名冊數值、版本或世界規則。
- **既有觀察保留**：favicon 404；Fastify access log 會記錄傳入 query，外部回報沒有 SQL 或密碼洩漏。API 固定錯誤與 access log 是不同範圍。

外部真做：Canon 數值對照、49 個 loader 變體、28 個 mutation、50 個真 HTTP 情況、官方 dist server 接 PG 的零 SQL／零對外呼叫與前後狀態一致比較；確認探索入口缺漏。戰鬥及主選單 UI 使用同份官方 dist，但因 production 無法進入戰鬥而改用非 production 模式，不能寫成 production 戰鬥 UI 已驗證。這兩個入口的五族顯示、手動刷新、無輪詢、取消／舊回應、錯誤、鍵盤／live／aria-busy、320／375／430 寬度及無 JS pageerror均為外部實測。

引用：Phase 32 repair UI 引用 `828d520` 的 `/workspace/p32d-evidence`，本輪沒有重新驗該流程。推斷：矮人普通以 100% 表示合理，數值界限屬格式防錯。未測：真手機、讀屏器、正式遊玩。受阻：production 戰鬥入口。外部服務已停，隔離 DB／角色已 drop、cluster 已停、工作目錄 `/workspace/p33` 已刪；5432、clone 與舊證據未變，新證據 `/workspace/p33-evidence` 共 81 檔。Codex 沒有在本機重跑或核驗該目錄。

本次補修限定七檔：`src/web/ExplorationPage.tsx`、`src/server/content-catalog.ts`、`tests/content-catalog.test.ts`、本文件、`CANONICAL_MANIFEST.md`、`OPEN_QUESTIONS.md`、`IMPLEMENTATION_PLAN.md`。首版 Git 授權限定原十一檔；使用者其後於 2026-10-04 回覆「授權補修 commit／push 並複驗」，另行批准本次七檔提交及送驗。不包含原有 AGENTS.md／Phase 31 變更，不延伸至下一切片或代替使用者驗收。

```sh
git add -- src/web/ExplorationPage.tsx src/server/content-catalog.ts tests/content-catalog.test.ts docs/development/PHASE_33_CONTENT_CATALOG.md docs/development/CANONICAL_MANIFEST.md docs/development/OPEN_QUESTIONS.md docs/development/IMPLEMENTATION_PLAN.md
git diff --cached --name-only
git commit -m "fix: expose race catalog in exploration and validate cloned snapshot"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
```

補修完整送驗 prompt（TARGET 待填，尚未送達）：

```text
請以 AI TRPG Architecture Critic 複驗 Phase 33/R04 首個種族名冊切片 D1、D2 同切片補修，回報工程 PASS 或 FAIL，不代替使用者驗收。
操作者 Codex。Repository: https://github.com/bosco8001/ai-trpg
Branch: codex/phase27-mobile-ui
BASE: 641b82f1686d24991e0d1da4ba9095b629995dcc
TARGET: 待本次限定提交及 push 後填完整 SHA
首版整體 BASE: 8f5c0334c2dbab10d2c519c3118af44c383c5a1e
先核對遠端指定分支、完整 SHA、祖先及限定七檔：src/web/ExplorationPage.tsx、src/server/content-catalog.ts、tests/content-catalog.test.ts、docs/development/PHASE_33_CONTENT_CATALOG.md、docs/development/CANONICAL_MANIFEST.md、docs/development/OPEN_QUESTIONS.md、docs/development/IMPLEMENTATION_PLAN.md。原有 AGENTS.md／Phase 31 未提交變更不包含。
必要文件：AGENTS、CANONICAL_MANIFEST、OPEN_QUESTIONS、PHASE_33_CONTENT_CATALOG、docs/world/races.md §3–7、docs/gameplay/character_system.md §5。保留首版未通過、外部命令與 UI 模式限制，不重判 Phase 32。Codex 未自行跑 build/typecheck/測試/UI，本次新增案例尚未執行。
補修：探索頁獨立 system 抽屜加入既有 ContentCatalogPanel（D1）；loader 先 structuredClone、驗同份快照、再 deep freeze，複製失敗固定安全錯誤整份拒絕（D2）。新增動態 getter、非法首次快照、不可複製輸入及六項 mutation 缺口相關案例；不宣稱已捕捉，請驗其有效性。五族數值、版本1、TEST隔離、API/接收限制、施法資格界線、正式其他內容 pending、既有 state/Save/LLM 路徑未改。
新隔離環境 npm ci、npm run build（含 typecheck）、node --import tsx --test tests/content-catalog.test.ts、完整無 DB 與隔離 PG npm test、git diff --check BASE TARGET；PG 先對隔離 TEST_DATABASE_URL migrate，記每條命令 exit code及 pass/skip，不碰正常 DB/5432、舊證據。
D1 必須用正式 build 產物、NODE_ENV=production 的正常探索頁，從系統抽屜打開名冊，不以戰鬥入口或非 production 補充代替。驗五族與版本1、固定加成/人類自由點/資質註記、手動刷新、收起與離頁取消、舊回應不覆蓋、timeout/非法格式/壞JSON/500/過大回應固定錯誤、鍵盤焦點圈/live/aria-busy、320/375/430寬度；無輪詢/JS錯誤，GET不寫玩家/slots/guard/revision、不讀DB或呼叫LLM。既有戰鬥/主選單入口依改動做必要回歸，production 受阻須明示。
D2 驗可變getter不能使載入值跳過驗證；被複製的非法值整份拒絕；不可複製或getter拋錯也固定訊息，驗證與載入同份快照、原始輸入隔離、各層凍結。六項 mutation 請重新判斷新增測試是否捉到：多屬性鍵、種族缺欄、移除數值界限、移除schemaVersion檢查、未凍結種族物件、resolve缺no-store。保留來源原物件未凍結、陣列非索引屬性、界限語意及access log既有Info，未改的不能自動標解決。
真HTTP的200/400/404/409與no-store/固定錯誤、未知/TEST引用不fallback依diff做必要回歸。既有Save/Load/修復可依diff安排；引用舊結果明示版本，不能寫成今輪真做。核對文件所述首版結果與本次待複驗一致。
回報完整 SHA/環境/命令exit code、逐項結果、缺陷嚴重度與精確行號/重現/影響、真做/引用/推斷/未測/受阻、清理及新證據位置。不修改專案、不commit/push、不開始下一切片，不代替使用者接受。
```
