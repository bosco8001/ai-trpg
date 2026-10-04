# Phase 33：正式內容名冊第一步

2026-10-04 使用者要求「進入下一階段」。本次是 R04 的小切片：只將五種族的創角資料轉為可讀、可驗證的正式名冊，並提供唯讀核對入口。首版 `641b82f` 外部工程未通過；D1／D2 補修 `8792e15` 的內容版本 1 已獲外部工程 PASS。使用者核對時澄清所有角色資質均在創角後揭曉，內容版本 2 與文案同切片修正 `940e1f3` 已獲外部工程 PASS；使用者已回報新版文案及五族數值正常，並選定緊湊資料卡排版。正式排版整合待新一輪 bot 驗證及使用者接受。歷史結果保留，不宣稱全部 R04 或正式創角已完成。

Repository：`https://github.com/bosco8001/ai-trpg`；分支：`codex/phase27-mobile-ui`。首版整體 BASE：`8f5c0334c2dbab10d2c519c3118af44c383c5a1e`；補修 BASE：`641b82f1686d24991e0d1da4ba9095b629995dcc`；版本 1 已複驗 TARGET：`8792e15843fbfe02d9f035db27e9ef5e5d784b4a`；版本 2 已複驗 TARGET：`940e1f3ac9d6cda82f6c7d52c6e9cd1612ef85f2`（BASE 為前述版本 1 TARGET）。本次外部結果紀錄的後續文件變更，不是該測試 TARGET 的一部分。

## 範圍與來源

- `docs/world/races.md` §3–7：五種族名稱、固定六屬性加成、人類兩點自由種族屬性點、魔力資質分布。
- `docs/gameplay/character_system.md` §5 與 `docs/world/races.md` §2：魔力資質與直接施法資格分開；依使用者 2026-10-04 核對澄清，所有角色的資質均於創角完成後揭曉。
- 玩家可長期扮演普通人或代行者。沒有為任何角色預設代行者身分，沒有產生施法資格。
- 不含種族能力執行、壽命／文化資料、職業起始套裝、物品／技能／法術內容、創角、HP／MP 推導、存檔版本遷移或正式 Run。這些內容未收錄，不代表其 Canon 被移除或全部尚未設計。

## 工程契約

- 使用隨程式編譯的 TypeScript 結構化資料，現位於 `src/server/content/races-v2.ts`（原 v1 檔更名）；這是檔案格式選擇。揭曉規則依使用者明確澄清更新，正式數值來源仍是上述 Canon，測試數值不得反寫。
- `schemaVersion=1` 定義這個有限資料結構；`catalogVersion=2` 標示本次揭曉規則更新，避免以同一內容版本暗換 v1 語意。版本 2 的全部種族要求 `after-creation`，不再接受 `unspecified`；版本 1 解析請求回 `unsupported-version`／409，沒有 v1 到 v2 或 TEST 的自動回退。`namespace=official` 與 `scope=race-creation-metadata` 明確標示不是完整種族能力目錄。尚無角色／Save 正式引用此名冊，不新增資料遷移或決定未來舊存檔相容政策。
- ID 為 `race.human`、`race.elf`、`race.dwarf`、`race.orc`、`race.dragonborn`，屬穩定工程識別碼，不是新世界名稱。六屬性完整列出；未列加成以零表達已定無加成。人類自由加成另列兩點，不能默默套到某屬性。
- 魔力資質列整數百分比（低／普通／高／極高），總和必須為 100；矮人普通以 100% 表示。五族揭曉皆為 `after-creation`，配合所有角色創角完成後揭曉的規則。各族機率不變；沒有隨機抽取、角色資質或直接施法資格欄位。
- 載入時整份結構驗證，拒絕未知 schema／內容版本、額外或缺少欄位、重複或 TEST 種族 ID、非整數／越界數值、非法機率總和。數值界限只是首版格式的防錯限制，不是新屬性上限或平衡規則；未來 Canon 擴充須同步調整格式。
- 先複製，對即將載入的同一份快照驗證，再深層凍結；複製失敗或快照不合法時使用固定錯誤並整份拒絕。原始物件的 getter 不會在驗證後再被讀取以替換已載入值；呼叫者與原始物件不能改同一版本的內容。正式 lookup 只查正式 Map；未知、錯誤種類或 TEST 引用沒有 fallback。
- 正式 `class`／`item`／`skill`／`spell` 類別目前列在 `pendingKinds`，沒有任何正式定義；全部引用返回 unknown-content，不以 TEST fixture 代替。這個拒絕只作用於本次正式 lookup，既有 TEST state／inventory／技能／Save 驗證沒有改接這個服務。

## API 與畫面

- `GET /api/content-catalog`：不接受 query，返回完整五種族名冊。
- `GET /api/content-catalog/resolve?kind=race&id=race.human&version=2`：恰好接受 `kind`、`id`、`version` 三欄。非法格式 400、不支援版本（包含 1）409、未知正式內容 404；固定安全文案，不回顯任意 ID 或內部錯誤。兩個 GET 都 `Cache-Control: no-store`，不讀取／寫入玩家、存檔或 DB，不呼叫 LLM。
- 系統／存檔面板新增「正式內容名冊」，手動開啟讀取五個種族，顯示版本、固定加成、自由種族點、資質分布及揭曉註記。前端驗證完整回應，32 KiB 接收上限、5 秒等待、收起／離頁取消、固定錯誤文案、手動重新讀取；不輪詢、不生成角色。
- 補修將 `ContentCatalogPanel` 接入探索頁自己的系統抽屜；戰鬥與主選單沿用 `RuntimeSystemPanel` 的入口。首版只接入後者，正常探索缺少入口（D1）；`8792e15` 的 production 探索入口已由 bot 複驗通過。戰鬥與主選單的 UI 回歸僅在非 production 模式實測，production 入口仍受阻。本期沒有新增初始讀取失敗畫面的入口。

## 首版與 D1／D2 補修檔案（歷史）

新增：`src/shared/content-catalog.ts`、`src/server/content/races-v1.ts`、`src/server/content-catalog.ts`、`src/web/ContentCatalogPanel.tsx`、`tests/content-catalog.test.ts`、本文件。

修改：`src/server/app.ts`、`src/web/RuntimeSystemPanel.tsx`、`docs/development/CANONICAL_MANIFEST.md`、`docs/development/OPEN_QUESTIONS.md`、`docs/development/IMPLEMENTATION_PLAN.md`。首版共十一檔；同切片 D1 補修另修改 `src/web/ExplorationPage.tsx`。不包含原有未提交的 `AGENTS.md` 或 Phase 31 文字。

## 工程檢查：歷史版本各自 PASS，最新排版補修待驗證

開發代理只閱讀程式／Git、編寫案例及核對差異，沒有執行 build、typecheck、lint、測試或 UI 驗證。首版五項測試與 D1／D2 補修六項測試分別由 Grok 執行，版本 1 結果見下方歷史複驗紀錄。版本 2 交付當時待驗證，其後由 Grok 對 `940e1f3` 獨立執行並回報 PASS，詳見文末；不是沿用 `8792e15` 的 PASS。

指定 bot 的命令：`npm ci`、`npm run build`、`node --import tsx --test tests/content-catalog.test.ts`、完整 `npm test`、BASE..TARGET `git diff --check`。完整 PG 回歸須隔離 `TEST_DATABASE_URL` 並先 migrate，不能碰正常 DB 或 5432；skip 不算 PASS。本次本身無 DB migration。

## 使用者核對清單（版本 2 文案與數值已回報正常，最新排版待工程驗證）

1. 開啟系統／存檔 → 正式內容名冊，看到五個種族與內容版本 2。
2. 人類固定加成皆零，另有兩點自由種族點；精靈力量 -1／體質 -2／智慧 +1／感知 +2；矮人力量 +1／敏捷 -1／體質 +2／魅力 -2；獸人敏捷 +2／感知 +2／智慧 -3／魅力 -1；龍裔力量 +2／體質 +2／智慧 +1。
3. 分布與 Canon 一致；五族都註記創角後揭曉，畫面不再有「玩家可以是普通人或代行者」，保留「魔力資質不代表直接施法資格」。沒有預設直接施法資格或聲稱種族能力已接入。
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

- **D1 Medium**：首版只有 RuntimeSystemPanel 接入名冊，探索頁獨立系統抽屜缺少入口；production 預設非戰鬥狀態無法到達名冊，與文件及核對清單不符。補修在 `ExplorationPage.tsx` 系統抽屜加入現有 `ContentCatalogPanel`，不重建探索工具或改動遊戲命令；補修交付當時待複驗，其後 `8792e15` production 探索 UI 已由 bot 實測通過。
- **D2 Low**：loader 先驗原始輸入、再複製，getter 可使載入值與驗證值不同。首版固定 literal 不會觸發，但快照保證不成立。補修先 `structuredClone`，驗證該快照再凍結；複製失敗也整份拒絕並用固定訊息。新增變動 getter、非法首次快照與不可複製輸入案例，補修交付當時尚未執行；其後 `8792e15` 已由 bot 複驗通過。
- **測試 Info（首版報告）**：首版 28 個 mutation 捕捉 22 個，當時報漏掉屬性多鍵、種族缺欄、移除 ±12 界限、移除 schemaVersion 檢查、未凍結種族物件、resolve 缺 no-store。補相關資料變體、各層凍結及修改種族名稱、resolve 成功與錯誤回應 header 斷言後，當時待 bot 重新評估；複驗確認六項均被新測試捕捉，並更正首版「種族缺欄」漏網項為等價 mutant，真正缺欄 mutant 原已能捕捉，見文末。新的小數案例缺口仍保留。
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

補修完整送驗 prompt 範本（保留交付當時的 TARGET 待填文字；實際送出時已填 `8792e15843fbfe02d9f035db27e9ef5e5d784b4a`，2026-10-04 21:17 HKT 讀回確認送達，複驗結果見下）：

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

## 內容版本 1 補修外部複驗 PASS（2026-10-04，當時待使用者驗收）

來源：AI TRPG Architecture Critic，Asia/Hong_Kong 21:27:01、21:27:08、21:27:09 的報告，Codex 經 Grok Bot Control 直接讀取。補修 BASE `641b82f1686d24991e0d1da4ba9095b629995dcc`；TARGET `8792e15843fbfe02d9f035db27e9ef5e5d784b4a`；首版整體 BASE `8f5c0334c2dbab10d2c519c3118af44c383c5a1e`。外部核對遠端分支為 TARGET、祖先正確及限定七檔；種族數值、shared 格式、接收上限、app 與 state／Save／LLM 路徑未改。工程結論 **PASS**，D1／D2 已修正，無新 High、Medium 或 Low；不重判 Phase 32，首版 FAIL 保留，Phase 33 最終接受仍由使用者決定。

外部環境：Node 24.21.0、npm 9.2.0、Debian 13.7、隔離 PG 17.11（55426）、Chrome 154、Playwright 1.63.0。

| 外部命令 | exit | 結果 |
|---|---:|---|
| `npm ci` | 0 | 成功 |
| `npm run build` | 0 | 成功 |
| `node --import tsx --test tests/content-catalog.test.ts` | 0 | 6／6 通過 |
| `env -u TEST_DATABASE_URL npm test` | 0 | 371 通過、41 略過，共 412 |
| migrate 隔離 DB（報告未列出本輪完整命令文字） | 0 | 成功 |
| `npm test`（隔離 PG） | 0 | 414／414 通過 |
| `git diff --check BASE TARGET` | 0 | 成功 |

略過不算通過。這些結果由 bot 執行，開發代理沒有自行執行驗證。

**D1 外部真做**：正式 dist、`NODE_ENV=production` 的正常探索頁，從系統抽屜開啟名冊；五族、版本 1、固定加成、人類自由兩點、資質與揭曉註記均正確，沒有 TEST 字樣或暗示已創角。打開／刷新各一個 GET，前後各閒置五秒沒有請求；收起再開及 Esc 離頁取消不顯示舊回應。逾時、格式非法、壞 JSON、500、33 KiB 回應均固定錯誤、零種族顯示、不洩漏；忙碌與刷新禁用、Enter／Space／Tab、3px 焦點圈及 live 提示正常。320／375／430 寬度無溢出、無 JS pageerror，console 僅既有 favicon 404。名冊 GET 期間 SQL 與對外呼叫均零，state／slots／token／epoch／revision 前後一致；頁面載入本身有兩句既有 idempotent SQL，不能把全頁載入宣稱零 SQL。

**D2 外部真做**：先複製、再驗證同份快照並逐層凍結；變動 getter 只讀一次，首次非法值整份拒絕。拋錯 getter、不可複製輸入、Proxy／Map／Date／function／symbol 均固定錯誤；原始輸入與快照隔離、各層凍結。六項指定 mutation 均被新增測試捕捉；bot 更正首版「種族缺欄」漏網判斷：先前漏網的是行為不變的等價 mutant，真正缺欄 mutant 原已捕捉。還原 D2 修正後新測試失敗，首版舊測試漏網。

**HTTP 外部真做**：production 接 PG 的 50 個情況符合預期，200／400／404／409、安全固定錯誤、所有 no-store、未知與 TEST 不回退、無輸入回顯或洩漏。Save／Load／修復由 PG 全套測試覆蓋；Phase 32 UI 引用 `828d520`，沒有當成本輪 UI 真做。

**Info 與限制**：本輪新增「移除整數檢查」mutation 未捕捉，小數屬性加成案例尚缺；NaN 仍被上下限擋住，沒有回報現行產品接受小數的缺陷。原始 OFFICIAL_RACES_V1 未凍結、陣列非索引屬性接受、±12 界限可能混淆、access log 記 query、favicon 404，以及抽屜關閉按鈕隨內容捲走但可用 Esc 關閉，均保留。沒有以本次 PASS 將這些改標解決。

真做：全部命令、production 探索 UI、非 production 戰鬥／主選單 UI、HTTP、D2 探測、mutation／還原測試及文件。引用：首版 `641b82f` 的 `/workspace/p33-evidence`、Phase 32 `828d520` UI。推斷：矮人普通寫成 100% 合理、上下限屬格式防錯。未測：真手機、讀屏器、正式遊玩。受阻：production 戰鬥／主選單入口；非 production 回歸正常，不擴大為 production 已測。

外部清理：服務已停，隔離 DB／角色 drop、cluster 停，`/workspace/p33b` 已刪；5432、clone、舊證據未變。新證據 `/workspace/p33b-evidence` 共 105 檔。bot 未改檔、commit／push 或開下一切片；Codex 沒有在本機重跑或核驗該證據目錄。使用者尚未確認本切片通過。

## 使用者核對澄清：所有角色創角後揭曉（同切片，交付當時待驗證）

使用者先回報本機 build 成功、探索畫面開啟及名冊入口／五族正常，沒有回報全部數值一致或整體驗收。其後明確澄清：「全部角色的資質都是創角完成才揭曉，不用寫玩家可以是普通人或代行者」。因此手動核對停在資料註記步驟，依指示修正後重新送工程驗證，再繼續核對。

本次更新 Character §5／Race §2 共通規則，五族皆 `after-creation`；畫面移除普通人／代行者提示，保留資質不代表施法資格的說明。先前玩家身分方向澄清仍保留於 OPEN_QUESTIONS，沒有因移除 UI 句子而取消玩家可扮演普通人或代行者的方向。各族固定加成、自由點、資質機率及施法資格規則不變。

內容版本升為 2、資料檔更名為 `races-v2.ts`／`OFFICIAL_RACES_V2`；資料結構版本仍 1。正式 loader 僅提供版本 2，舊內容版本 1 查詢明確 409，不默默轉成版本 2 或 TEST。既有 state／Save 尚未引用名冊，不做 migration。測試對照改為版本 2／全族 after-creation，加入 unspecified／before-creation 拒絕及舊版本拒絕案例；交付當時尚未執行，其後外部結果見下。本次沒有補小數屬性案例，新舊 Info 仍保留。

本次限定範圍為十一項檔案變更（名冊更名涉及兩個路徑）：`docs/gameplay/character_system.md`、`docs/world/races.md`、`src/server/content/races-v1.ts` → `races-v2.ts`、`src/server/content-catalog.ts`、`src/shared/content-catalog.ts`、`src/web/ContentCatalogPanel.tsx`、`tests/content-catalog.test.ts`、本文件、`CANONICAL_MANIFEST.md`、`OPEN_QUESTIONS.md`、`IMPLEMENTATION_PLAN.md`。四份 development 文件包含先前未提交的 `8792e15` 外部 PASS 紀錄；該紀錄僅適用內容版本 1，本次版本 2 交付當時仍待驗證；其後獨立結果見下。不包含原有 AGENTS.md／Phase 31 變更。使用者於 2026-10-04 回覆「授權此次修正 commit／push 並送驗」，批准本次限定提交與驗證，不代替階段驗收或延伸至下一切片。

```sh
git add -- docs/gameplay/character_system.md docs/world/races.md src/server/content/races-v1.ts src/server/content/races-v2.ts src/server/content-catalog.ts src/shared/content-catalog.ts src/web/ContentCatalogPanel.tsx tests/content-catalog.test.ts docs/development/PHASE_33_CONTENT_CATALOG.md docs/development/CANONICAL_MANIFEST.md docs/development/OPEN_QUESTIONS.md docs/development/IMPLEMENTATION_PLAN.md
git diff --cached --name-only
git commit -m "fix: reveal all character aptitudes after creation"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
```

本次完整工程審查 prompt 範本（保留交付當時的 TARGET 待填文字；實際送出已填 `940e1f3ac9d6cda82f6c7d52c6e9cd1612ef85f2`，2026-10-04 22:18:31 HKT 已讀回確認送達）：

```text
請以 AI TRPG Architecture Critic 驗證 Phase 33 第一個切片的使用者核對澄清補修，回報工程 PASS/FAIL，不代替使用者最終驗收。
操作者 Codex。Repository: https://github.com/bosco8001/ai-trpg
Branch: codex/phase27-mobile-ui
BASE: 8792e15843fbfe02d9f035db27e9ef5e5d784b4a
TARGET: 待本次限定提交及 push 後填入完整 SHA
使用者明確指示所有角色魔力資質都在創角完成後揭曉，並移除 UI「玩家可以是普通人或代行者」。只去掉畫面句子，不撤銷既有角色身分方向；保留資質與施法資格分開。
先核對遠端指定分支、完整SHA/祖先及本次限定十一項變更（更名涉及兩路徑）：Character Canon、Race Canon、races-v1.ts改races-v2.ts、server/content-catalog.ts、shared/content-catalog.ts、ContentCatalogPanel.tsx、content-catalog.test.ts、PHASE_33_CONTENT_CATALOG、CANONICAL_MANIFEST、OPEN_QUESTIONS、IMPLEMENTATION_PLAN。AGENTS／Phase31原有未提交變更不包含。
必要文件：AGENTS、CANONICAL_MANIFEST、OPEN_QUESTIONS、PHASE_33_CONTENT_CATALOG、docs/gameplay/character_system.md §5、docs/world/races.md §2–7。四份development文件同時加入上輪8792e15外部PASS紀錄；只適用內容版本1，未把舊PASS套到版本2，保留641b82f FAIL、mutation等價項更正、Info、模式限制。
變更：五族皆after-creation、共享格式拒絕unspecified/before-creation、內容版本2（schemaVersion1）、正式版本1查詢409無fallback、v2資料檔與所有使用處接線、UI去普通人/代行者句子。固定加成/自由點/資質百分比、直接施法資格、state/Save/DB/LLM/創角生成/取消/接收限制都未改。Codex未跑build/typecheck/測試/UI；相關案例尚未執行，使用者只回報先前版本本機build與入口正常。
新隔離環境npm ci、npm run build（包含typecheck）、node --import tsx --test tests/content-catalog.test.ts、完整無DB與隔離PG npm test、git diff --check BASE TARGET；隔離TEST_DATABASE_URL先migrate，記完整命令/exitcode/pass/skip，不碰正常DB/5432或舊證據，skip不算PASS。
對照全部五族機率/加成與Canon相同，全部揭曉after-creation；名冊GET/resolve版本2成功、版本1及未知版本409、不轉新版本或TEST，安全固定錯誤/no-store，非法revealing標記整份拒絕。檔更名不能造成編譯/執行引用失效；資料結構與內容版本分開，不新增存檔migration。loader快照驗證/凍結/未知TEST隔離做必要回歸。
正式build產物、NODE_ENV=production正常探索頁→系統→名冊：版本2、五族都顯示創角完成後揭曉註記，不再顯示玩家可為普通人或代行者，保留資質不代表施法資格；無暗示已完成創角。手動刷新/收起/重開、取消/timeout/格式非法/舊回應、鍵盤/live/320/375/430寬度依diff做必要驗證，無自動輪詢/JS錯誤。GET不讀寫DB、不改state/revision/slots/guard、不呼叫LLM。戰鬥/主選單必要回歸明示production模式受阻；引用舊UI結果標版本，不當今輪真做。
保留小數屬性測試缺口、來源原物件未凍結、陣列非索引屬性、格式界限語意、query access log、favicon、抽屜關閉按鈕捲走可Esc等Info，不因新PASS自動改標解決。真手機/讀屏/正式遊玩未測與舊版本結果分開。
回報完整SHA/環境/完整命令exitcode、逐項結果、缺陷嚴重度/精確行號/重現/影響、真做/引用/推斷/未測/受阻、清理與新證據。不修改專案、不commit/push、不展開下一切片，不代替使用者接受。
```


## 內容版本 2 澄清補修外部工程 PASS（2026-10-04，待使用者驗收）

來源：AI TRPG Architecture Critic，2026-10-04 22:27:59 與 22:28:05（Asia/Hong_Kong）的報告，Codex 經 Grok Bot Control 直接讀取。BASE `8792e15843fbfe02d9f035db27e9ef5e5d784b4a`；TARGET `940e1f3ac9d6cda82f6c7d52c6e9cd1612ef85f2`。外部核對遠端分支為 TARGET、祖先正確及限定十一項變更（名冊更名 R087）；src、tests、dist 無舊 races-v1 引用。工程結論 **PASS**，無新 High、Medium 或 Low。這是外部結果，開發代理沒有執行 build、typecheck、測試或 UI 驗證，也未在本機核驗外部證據。

外部環境：Node 24.21.0、npm 9.2.0、Debian 13.7、新隔離 PG 17.11（55426）、Chrome 154、Playwright 1.63.0。

| 外部命令 | exit | 結果 |
|---|---:|---|
| `npm ci` | 0 | 成功 |
| `npm run build` | 0 | 包含 typecheck |
| `node --import tsx --test tests/content-catalog.test.ts` | 0 | 6／6 通過 |
| `env -u TEST_DATABASE_URL npm test` | 0 | 371 通過、41 略過，共 412 |
| `DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_test npx node-pg-migrate up` | 0 | 隔離 DB migration 成功 |
| `TEST_DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_test npm test` | 0 | 414／414 通過 |
| `git diff --check BASE TARGET` | 0 | BASE／TARGET 為本節完整 SHA |

略過不算通過。以上命令均為 bot 回報，不是 Codex 親自執行。

**Canon／loader 外部真做**：五族加成、人類自由兩點、資質百分比及 schemaVersion 1 與 BASE／Canon 一致，全部揭曉標記為 after-creation；身分方向與施法資格規則未改。四份 development 文件保留歷史來源、FAIL、等價 mutant 更正及限制。非法揭曉標記（unspecified、before-creation、其他字串、大小寫、尾端空格、null、缺欄）整份拒絕；快照驗證、凍結與 TEST 隔離回歸正常。45 個 mutant 捕捉 44 個，包含舊版本回退、409 改 404、逐族改回 unspecified；整個 v1 還原時六項新測試全部失敗。小數加成案例缺口仍保留，不將 mutation 漏網寫成現行產品缺陷。

**HTTP／UI 外部真做**：production dist 接 PG 的 54 個 HTTP 情況符合預期；版本 2 成功、1／3／999999999 回 409，格式錯誤 400、未知或 TEST 引用 404；全部 no-store、固定安全錯誤、不回退及不洩漏。名冊 GET 期間 SQL 與對外呼叫均零，state／slots／token／epoch／revision 不變。正式 production 探索頁 → 系統 → 名冊顯示版本 2、五族創角後揭曉註記 5／5、移除指定句子、保留資質不代表直接施法資格，無暗示已創角。開啟／刷新各一個 GET、閒置五秒無請求；取消及舊回應保護、鍵盤／焦點／live／aria-busy 正常；13 種非法回應（含整份舊 v1）只顯示固定錯誤。320／375／430 寬度無溢出、無 JS pageerror。戰鬥／主選單入口僅非 production 回歸，production 仍受阻。

**新增 Info**：UI 文案尚無自動化測試（ContentCatalogPanel.tsx L30、L41），本輪由真 UI 驗證；歷史 Info 的 OFFICIAL_RACES_V1 名稱適用當時版本，目前 OFFICIAL_RACES_V2 來源原物件同樣未凍結，service 使用獨立凍結快照。這是名稱補充，不宣稱已修正凍結限制。

**既有 Info 保留**：小數加成測試缺口、來源原物件未凍結、陣列非索引屬性接受、±12 格式界限語意、access log 記 query、favicon 404、抽屜關閉按鈕隨內容捲走但可用 Esc 關閉。沒有因本次 PASS 改標解決。

真做：上述命令、Canon／文件、loader、45 個 mutant／v1 還原、54 個 HTTP 情況、production 探索 UI、非 production 戰鬥／主選單。引用而非本輪真做：版本 1 `8792e15`、首版 `641b82f`、Phase 32 UI `828d520`。推斷：矮人普通 100% 合理、上下限屬格式防錯。版本 2 未測：真手機、讀屏器、正式遊玩。受阻：production 戰鬥／主選單入口。

外部清理：服務已停、DB／role 已 drop、cluster 已停、`/workspace/p33c` 已刪；5432、clone 與舊證據未變。新證據 `/workspace/p33c-evidence` 共 120 檔。bot 未改檔、commit／push 或展開下一切片。

本段外部結果紀錄交付當時 Phase 33 第一個切片仍待使用者接受，版本 2 尚待使用者重新 build／重啟後核對；其後文案與數值回報及新排版選定見下。後續文件紀錄不包含在被測 TARGET 中。


## 使用者核對及緊湊資料卡正式整合（2026-10-04，同切片待驗證）

使用者在 `940e1f3` 外部工程 PASS 後，回報「重啟成功」、「新版文案正常」、「五族數值正常」。開發代理提供收起／重開／刷新／Esc／窄畫面／鍵盤核對步驟，但使用者沒有回報「名冊操作正常」或 Phase 33 通過；不能補寫全部操作及整階段已接受。

其後使用者指出長句排版混亂，要求參考 apple-design 並觀看 prototype。獨立原型位於本機 3043，五族數值直接取自 `races-v2.ts`；原型沒有接入遊戲。使用者要求屬性格縮小，修正為緊湊內距與 1.25rem 數字，再回覆「先用這個設計吧，五族數值正常」。這代表選定排版並確認所見數值，沒有授權下一切片或宣告階段通過。正式整合後已停止原型服務並移除獨立原型，原型的寬度切換／picker 不進正式遊戲。

**正式整合範圍**：`ContentCatalogPanel.tsx` 改為資料卡；`style.css` 新增限 content-catalog 的樣式。六屬性 dt／dd 對齊成三欄；容器至少 40rem 時六欄。屬性格使用原型縮小後的 0.4rem／0.45rem 上下內距及 1.25rem 數字，零值完整保留、加減號明確，顏色只是輔助。人類自由兩點獨立；資質百分比另成一組，裝飾分布條 aria-hidden，仍保留文字數值。共通創角後揭曉／生成後固定／資質不等於施法資格說明集中，每卡保留短註記。種族跳轉連結使用每個面板 useId 的唯一目標與焦點框；沒有自動捲動動畫。手動刷新、狀態／錯誤提示與既有取消／接收限制保留。

**不改動的資料與規則**：五族資料、schemaVersion 1、catalogVersion 2、Canon、server／API、state／Save／DB／LLM 未變；不是創角或完整 R04。舊版本 1 明確拒絕。`940e1f3` 的工程 PASS 僅適用其當時畫面，不能套到本次排版。UI 文案／小數加成測試覆蓋缺口、來源物件未凍結等 Info 保留，不因改成資料卡而宣稱解決。

**本次完整提交範圍六檔**：`src/web/ContentCatalogPanel.tsx`、`src/web/style.css`、本文件、`CANONICAL_MANIFEST.md`、`OPEN_QUESTIONS.md`、`IMPLEMENTATION_PLAN.md`。四份 development 文件包含此前未提交的 `940e1f3` 外部結果紀錄與本次進度。不包含原有未提交 `AGENTS.md`、Phase 31。開發代理僅閱讀／修改／核對程式及 Git 差異，沒有執行 build、typecheck、lint、測試或瀏覽器／UI 驗證；沒有新增測試，最新排版待指定 bot 驗證。

**手動核對（新一輪工程驗證後）**：重新 build／重啟服務並在正式遊戲系統抽屜開名冊；檢查緊湊格子、六屬性正負與零值、人類自由兩點、資質分布及揭曉註記；跳到五族、刷新／收起／重開／Esc、Tab／Enter、窄視窗與放大文字。原型上的選定不代替正式整合驗收。

以下限定提交指令交付當時尚待使用者批准。使用者其後回覆「接受，交給grok驗收吧」，依剛才明列的六檔提交及送驗範圍，批准本次 commit／push 與指定 bot 交接；不包含 AGENTS／Phase 31、不延伸下一切片。本紀錄提交前尚未送達 bot，TARGET 待限定提交後填入：

```sh
git add -- src/web/ContentCatalogPanel.tsx src/web/style.css docs/development/PHASE_33_CONTENT_CATALOG.md docs/development/CANONICAL_MANIFEST.md docs/development/OPEN_QUESTIONS.md docs/development/IMPLEMENTATION_PLAN.md
git diff --cached --name-only
git commit -m "style: use compact race catalog cards"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
```

完整送驗 prompt（待取得可讀遠端 TARGET 後主動送交指定 bot）：

```text
請以 AI TRPG Architecture Critic 驗證 Phase 33 第一個切片的緊湊資料卡排版補修，回報工程 PASS/FAIL，不代替使用者最終驗收。
操作者 Codex。
Repository: https://github.com/bosco8001/ai-trpg
Branch: codex/phase27-mobile-ui
BASE: 940e1f3ac9d6cda82f6c7d52c6e9cd1612ef85f2
TARGET: 待本次限定六檔 commit／push 後填入完整 SHA
核對遠端分支／完整 SHA／BASE 祖先；本次範圍只含 src/web/ContentCatalogPanel.tsx、src/web/style.css、docs/development/PHASE_33_CONTENT_CATALOG.md、CANONICAL_MANIFEST.md、OPEN_QUESTIONS.md、IMPLEMENTATION_PLAN.md。四份文件也包含先前 940e1f3 的外部 PASS 紀錄；不含原有未提交 AGENTS.md／Phase 31。必要文件：AGENTS、Manifest、Open Questions、Phase 33、Character §5、Race §2–7。
使用者回報版本 2 新文案與五族數值正常，其後選定獨立 prototype 的緊湊資料卡；未宣告 Phase 33 通過。正式整合後仍待驗證。Codex 沒有跑 build/typecheck/lint/測試/UI；沒有新增測試案例。之前的 940e1f3 PASS 不適用這次 UI diff。
變更：六屬性 dl 網格，三欄窄版／容器寬度 >=40rem 六欄，數字 1.25rem／緊湊內距；零值仍完整顯示、正負號明確；人類自由兩點獨立；資質分組與裝飾分布條（aria-hidden、百分比文字仍可讀）；共通創角後揭曉說明及每卡短註記；種族 anchor 與 useId 唯一目標、tabIndex -1／焦點框；既有手動刷新及狀態提示保留。prototype 寬度控制／picker 未進正式遊戲。
資料／schema 1／內容版本 2／Canon／server／API／GET 不寫入／Save／state／DB／LLM／創角未改。既有 fetch/no-store、5 秒、32 KiB、取消、舊回應與固定錯誤程式保留。所有新增 CSS 限 content-catalog，不可使資料診斷／修復面板或其他 UI 退化。
新隔離 checkout npm ci、npm run build、node --import tsx --test tests/content-catalog.test.ts、env -u TEST_DATABASE_URL npm test、隔離 PG migrate 後 TEST_DATABASE_URL=<隔離 URL> npm test、git diff --check BASE TARGET。列完整實際命令／環境／exit code／pass／skip，skip 不算 PASS，不碰正常 DB／5432／舊證據。不沿用先前 414/414 當新執行結果。
正式 production dist 正常探索→系統→名冊驗五族全部 30 個加成與 Canon／BASE 一致（含零、負號）、人類自由 2、各資質百分比正確；不是角色生成結果或直接施法資格。版本 2／共通揭曉說明／每卡短註記正確，沒有普通人／代行者句子。窄版320/375/430、寬容器及200%字體／zoom、對比／鍵盤：數值不截斷、百分比不與標籤分開、無左右溢出；讀屏結構 dl/dt/dd 與裝飾 aria-hidden 請分清實測或僅結構檢查，真讀屏未做不要寫通過。
五個 anchor 均能在抽屜內跳到正確族，鍵盤可見焦點、Esc 關閉仍正常；多個面板實例 ID 不碰撞，hash 不觸發遊戲命令／fetch／revision，刷新／取消／收起／重開／舊回應正常，不殘留舊資料或錯誤 anchor。打開／刷新各一個 GET、閒置不輪詢；逾時／格式非法／舊v1／壞JSON／500／33KiB皆固定錯誤、零種族、不洩漏，aria-live／busy／disabled 正常。名冊 GET 零 SQL／對外呼叫，狀態與三槽前後一致。
檢查新增 CSS 不影響診斷／備份／修復，沿用正式入口及隔離資料做必要回歸；戰鬥／主選單 UI 若 production 受阻明示，不寫成 production PASS。主張仍與 940e1f3 不同時須列準確來源，不將 Phase32 UI 引用變成今輪真做。bar 使用實際機率，1%仍有文字證據，不加入新數值或隱藏零屬性。
既有 Info 保留：UI 文案自動化測試缺口、小數加成案例缺口、來源原物件未凍結、陣列非索引屬性、±12 界限語意、access log query、favicon、抽屜關閉掣捲走可 Esc。真手機／讀屏／正式遊玩未測及 production 模式限制保留。選定 prototype 與手動數值正常，不等同整階段接受。
回報工程 PASS/FAIL、缺陷嚴重度／精確行號／重現／影響、完整命令結果、逐項實測／引用／推斷／未測／受阻、清理與新證據。不修改專案、不 commit/push、不啟動下一切片、不代替使用者驗收。
```
