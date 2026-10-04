# Phase 33：正式內容名冊第一步

2026-10-04 使用者要求「進入下一階段」。本次是 R04 的小切片：只將已定五種族的創角資料轉為可讀、可驗證的正式名冊，並提供唯讀核對入口。工程待指定 bot 驗證，使用者尚未驗收；不宣稱全部 R04 或正式創角已完成。

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
- 驗證後複製並深層凍結，呼叫者與原始物件不能改同一版本的內容。正式 lookup 只查正式 Map；未知、錯誤種類或 TEST 引用沒有 fallback。
- 正式 `class`／`item`／`skill`／`spell` 類別目前列在 `pendingKinds`，沒有任何正式定義；全部引用返回 unknown-content，不以 TEST fixture 代替。這個拒絕只作用於本次正式 lookup，既有 TEST state／inventory／技能／Save 驗證沒有改接這個服務。

## API 與畫面

- `GET /api/content-catalog`：不接受 query，返回完整五種族名冊。
- `GET /api/content-catalog/resolve?kind=race&id=race.human&version=1`：恰好接受 `kind`、`id`、`version` 三欄。非法格式 400、不支援版本 409、未知正式內容 404；固定安全文案，不回顯任意 ID 或內部錯誤。兩個 GET 都 `Cache-Control: no-store`，不讀取／寫入玩家、存檔或 DB，不呼叫 LLM。
- 系統／存檔面板新增「正式內容名冊」，手動開啟讀取五個種族，顯示版本、固定加成、自由種族點、資質分布及揭曉註記。前端驗證完整回應，32 KiB 接收上限、5 秒等待、收起／離頁取消、固定錯誤文案、手動重新讀取；不輪詢、不生成角色。
- 入口沿用正常遊戲、戰鬥及主選單中的系統面板。本期沒有新增初始讀取失敗畫面的入口。

## 本次限定檔案

新增：`src/shared/content-catalog.ts`、`src/server/content/races-v1.ts`、`src/server/content-catalog.ts`、`src/web/ContentCatalogPanel.tsx`、`tests/content-catalog.test.ts`、本文件。

修改：`src/server/app.ts`、`src/web/RuntimeSystemPanel.tsx`、`docs/development/CANONICAL_MANIFEST.md`、`docs/development/OPEN_QUESTIONS.md`、`docs/development/IMPLEMENTATION_PLAN.md`。不包含原有未提交的 `AGENTS.md` 或 Phase 31 文字。

## 工程檢查：待 Grok Bot

開發代理只閱讀程式／Git、編寫案例及核對差異，沒有執行 build、typecheck、lint、測試或 UI 驗證。新測試尚未執行。

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

完整審查 prompt（TARGET 待填，不代表已送達）：

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
