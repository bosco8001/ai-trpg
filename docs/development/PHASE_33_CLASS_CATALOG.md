# Phase 33 第二切片：四個初階職業正式名冊

**最新狀態（2026-10-06，Asia/Hong_Kong）**：使用者改由親自驗收本次補修，並明確回覆「Phase 33 第二切片：四個初階職業正式名冊與唯讀核對畫面通過。」第二切片已由使用者接受。首版 `6dfa95e1d84cb1c7ef0a1aa64be13919f3cf8316` 的 Grok t46u 工程 FAIL 保留；本次補修沒有 Grok 複驗 PASS。使用者回報 build 成功及 377 pass／0 fail／41 skipped，略過與其他未測限制不改標通過。補修及本次紀錄仍未 commit／push；詳細來源與界線見文末。下方提交前紀錄、FAIL 與補修 prompt 均保留作歷史。

日期：2026-10-06（Asia/Hong_Kong）。使用者已授權製作本切片，並另明確授權限定下列 17 檔 commit／push 及送 Grok。**本節為提交前紀錄：實作已準備，工程驗證及使用者手動驗收仍待完成。** 是否已提交／推送／送達須以 Git 與 Grok 當次交接讀回為準，不以此提交前紀錄代替。

Repository：`https://github.com/bosco8001/ai-trpg`；分支：`codex/phase27-mobile-ui`。
BASE：`8b8b210e984a179a1a814af3505247b53805a894`。
TARGET：**本文件保留提交前佔位；正式審查 prompt 於限定 17 檔提交／推送後填入完整 SHA。** 不在同一 commit 的文件內宣稱其自身完整 SHA，實際測試版本以送達 Grok 的固定 SHA 為準。

五族第一切片與獨立手機原型的接受只提供既有驗收與設計方向，不能當成本次正式整合已通過。開發代理本輪只讀取來源／Git、實作、準備測試及審查 prompt；未執行 build、typecheck、lint、自動化分析、單元／整合或瀏覽器測試。

## 範圍與正式來源

- 正式來源：[四職業](../gameplay/classes.md)、[角色 §9](../gameplay/character_system.md)、[魔法](../gameplay/magic.md)、[Manifest](CANONICAL_MANIFEST.md)、[待定項目](OPEN_QUESTIONS.md)。本次指定製作把已確認的四職業與倍率／被動方向明確收錄到 Canon；不把原型所有樣本數值一併升格。
- 劍士力量、弓箭手感知、斥候敏捷、魔術師智慧各 ×1.25，其餘五項 ×1。
- 四項被動只收錄資料及文字說明，不執行傷害、攻擊／閃避判定或 MP 扣除。
- 不接入創角、轉職、角色職業欄位、技能／裝備變更、進階解鎖、Save migration 或戰鬥狀態同步。
- 已接受的 UI 原型只提供冷黑石材、青綠點綴、高對比淺底按鈕、黑體字、短動畫及手機 Sheet 方向。CSS 限定新名冊，不全面替換其他正式畫面。

## 版本與 API 契約

職業版本與五族版本分開。五族 `/api/content-catalog` 的 v2、schema、pendingKinds、resolve 及既有 TEST 遊戲不改接職業名冊；其中 class 為該五族版本尚未收錄的類別，不表示新職業端點沒有資料。

- `GET /api/class-catalog`：不接受 query；回傳 schemaVersion 1、catalogVersion 1、namespace official、scope initial-class-metadata 及四職業。
- `GET /api/class-catalog/resolve?kind=class&id=class.swordsman&version=1`：只接受三個指定 query 欄位；種類必須 class。格式不正確 400；不支援職業版本 409；未知／TEST ID 404。成功及上述失敗皆 no-store，固定錯誤不回顯輸入、stack 或內部細節。
- 專用正式 Map 不查 TEST 名冊、不依賴角色、SQL 或 LLM。先複製、驗證同一快照，再凍結所有巢狀物件及陣列；非法資料整份拒絕。
- UI 在開啟與明確重新讀取時才發 GET。切換詳情／返回無追加請求；沒有背景輪詢。5 秒逾時、32KiB 上限、Content-Type／Content-Length／UTF-8／JSON／完整結構檢查；錯誤不顯示部分職業。
- 取消、關閉、卸載與重新讀取會中止舊請求，過期回應不能更新目前畫面。

## 畫面流程

探索頁的「系統」以及既有遊戲系統面板都有「初階職業名冊」入口。入口 → 原生模態 Sheet 四職業列表 → 單一職業詳情 → 返回列表／關閉。詳情列六項倍率與被動；魔術師額外提示不自動取得直接施法資格。

原生 dialog 透過 portal 位於頂層；關閉鍵與底部操作固定，長內容只在 Sheet 內捲動。標題與入口焦點管理、返回先前列項、背景模態限制，以及 Tab／Escape 與外層系統抽屜的事件隔離已實作，**尚待實際工程核對**。本輪沒有宣稱讀屏或手機已通過。

本切片僅顯示職業資料，不顯示「目前職業」、不把四個職業標成角色已開放、不自動建立角色、不計算個人屬性／資源。

## 檔案與提交範圍

限定以下 17 檔；不使用 `git add .`。其中 Manifest、OPEN_QUESTIONS、IMPLEMENTATION_PLAN、PHASE_33_CONTENT_CATALOG 原本已有第一切片驗收的未提交文字，本次擬連同這四份文件的既有紀錄一起提交，保留來源及限制。其他既有 AGENTS、Phase 31、兩份原型目錄與原型驗收文件不包含在這次範圍。

```text
src/shared/class-catalog.ts
src/server/content/classes-v1.ts
src/server/class-catalog.ts
src/server/app.ts
src/web/class-catalog-client.ts
src/web/ClassCatalogPanel.tsx
src/web/class-catalog.css
src/web/ExplorationPage.tsx
src/web/RuntimeSystemPanel.tsx
tests/class-catalog.test.ts
docs/gameplay/classes.md
docs/gameplay/character_system.md
docs/development/CANONICAL_MANIFEST.md
docs/development/OPEN_QUESTIONS.md
docs/development/IMPLEMENTATION_PLAN.md
docs/development/PHASE_33_CONTENT_CATALOG.md
docs/development/PHASE_33_CLASS_CATALOG.md
```

使用者已提供本次限定 Git 授權，以下為提交指令紀錄；不是命令執行成功的證據：

```sh
git add -- src/shared/class-catalog.ts src/server/content/classes-v1.ts src/server/class-catalog.ts src/server/app.ts src/web/class-catalog-client.ts src/web/ClassCatalogPanel.tsx src/web/class-catalog.css src/web/ExplorationPage.tsx src/web/RuntimeSystemPanel.tsx tests/class-catalog.test.ts docs/gameplay/classes.md docs/gameplay/character_system.md docs/development/CANONICAL_MANIFEST.md docs/development/OPEN_QUESTIONS.md docs/development/IMPLEMENTATION_PLAN.md docs/development/PHASE_33_CONTENT_CATALOG.md docs/development/PHASE_33_CLASS_CATALOG.md
git commit -m "feat: add official initial class catalog and read-only sheet"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
```

## 使用者核對清單（工程結果回來後）

1. 正式探索 → 系統 → 初階職業名冊，看到劍士、弓箭手、斥候、魔術師。
2. 每個職業主項 ×1.25，其餘 ×1；四項被動與 Canon 一致。
3. 列表 → 詳情 → 返回 → 關閉 → 重開操作清楚，系統抽屜不被意外一起關閉；鍵盤焦點可辨認。
4. 手機寬度及大字設定沒有裁切，關閉／返回一直可操作；長內容只在名冊內捲動。
5. 魔術師施法資格提示清楚；查看前後角色、資源、背包與存檔沒有改動。
6. 讀取失敗能重新讀取，不出現半份職業或假成功。

## 交 AI TRPG Architecture Critic 的完整 prompt

下面 TARGET 待填；不是已送達紀錄。須先取得 bot 可讀的完整遠端 SHA，再核對 Grok Bot 當次介面的指定對話、單次送出並讀回確認。

```text
請驗證 Phase 33 第二切片：四個初階職業正式名冊及唯讀核對 Sheet。
工程實作代理為 Codex；本次由你 AI TRPG Architecture Critic 執行工程測試。外部工程結果不代替使用者最終驗收。

Repository: https://github.com/bosco8001/ai-trpg
Branch: codex/phase27-mobile-ui
BASE: 8b8b210e984a179a1a814af3505247b53805a894
TARGET: <待填：限定17檔提交／推送後的完整SHA>
TARGET 未填或不可讀時停止工程執行並回報，不把浮動 HEAD 當作測試版本。
先核對遠端 TARGET、BASE 祖先關係、完整 diff 與下列17檔範圍。不要修改專案、commit、push、部署或重新判定使用者之前的驗收。

檔案範圍：
src/shared/class-catalog.ts
src/server/content/classes-v1.ts
src/server/class-catalog.ts
src/server/app.ts
src/web/class-catalog-client.ts
src/web/ClassCatalogPanel.tsx
src/web/class-catalog.css
src/web/ExplorationPage.tsx
src/web/RuntimeSystemPanel.tsx
tests/class-catalog.test.ts
docs/gameplay/classes.md
docs/gameplay/character_system.md
docs/development/CANONICAL_MANIFEST.md
docs/development/OPEN_QUESTIONS.md
docs/development/IMPLEMENTATION_PLAN.md
docs/development/PHASE_33_CONTENT_CATALOG.md
docs/development/PHASE_33_CLASS_CATALOG.md
四份既有 development 文件包含先前第一切片驗收文字，一併核對來源；不是新職業切片的工程結果。其餘舊未提交工作不在 TARGET。必要來源另讀 docs/gameplay/magic.md、docs/world/races.md、docs/gameplay/combat_system.md、docs/gameplay/combat_ui.md。

在隔離工作目錄、Node >=24 <25：
npm ci
npm run build
node --import tsx --test tests/class-catalog.test.ts tests/content-catalog.test.ts
npm test
git diff --check BASE TARGET（以完整SHA取代BASE與TARGET字面標籤）
記錄每條命令、exit code、通過／失敗／略過數，不把略過當通過。開發代理未本機執行以上命令。

重點：
1. Canon及正式數據：劍士力量、弓箭手感知、斥候敏捷、魔術師智慧各1.25，其餘1；只有目前職業生效，不疊加；劍術主動技能命中傷害+10%、射擊主動技能攻擊判定+1、閃避判定+1、符合資格直接/魔法書施法總MP減10%向上取整正成本最低1零仍零。被動只metadata、不執行戰鬥。沒有默認角色開放全四職業、轉職、創角、配裝、Save schema改寫、魔術師自動直接施法資格，沒有把原型技能15/技能+1/裝備+2或+3等升格Canon。傷害順序/取整、MP分回合及初始技能/裝備/熟練仍待定。
2. 專用職業版本1及正式Map；五族版本2原契約/lookup/pendingKinds不變。GET/resolve固定400/409/404、no-store、未知/TEST/錯種類/錯版本/重複query/額外query/指數版本/空白/超長ID、__proto__/constructor；POST不得提供寫入。非法整份名冊/缺欄/重複/疏陣列/NaN/錯誤倍率/被動/施法來源/額外資格欄位拒絕。getter先複製後驗同快照、深凍結含施法來源陣列。
3. 真正production正常探索→系統→職業名冊可達；既有系統面板亦核對（若production其他入口受阻，標示限制，不以sandbox代替production PASS）。列表四項、單項詳情六屬性與被動、返回、關閉重開、相同名稱可辨；無額外查詢、無輪詢。測GET零SQL/零LLM；對照state/revision/資源/背包/三Save槽皆不變。開啟系統面板原有讀存檔請求須與新增職業GET分開歸因。
4. 讀取client 5秒/32KiB：500、斷線、timeout、無Content-Length、錯Content-Type、長度不足/溢出、錯UTF8、壞JSON、錯結構/版本、快速關閉重開、卸載、中止後過期回應、重複刷新。安全固定錯誤，不顯示部分職業、無未處理promise或console/pageerror。React StrictMode不會讓舊請求覆蓋新畫面。
5. 原生dialog嵌在自訂系統抽屜：Tab/Shift+Tab只在最上層Sheet，背景不可操作；Esc只關名冊，保留外層系統抽屜；close返回入口、詳情heading焦點、返回正確列表列項且可見；列表最後列捲動返回焦點不得隱藏；連續Esc/Enter/關閉重開不吞新視窗或誤觸其他操作，多實例useId唯一。大字與短橫向高度header/footer不蓋body。檢查可及名稱/對比/觸控目標；AX樹不等於真讀屏PASS。
6. 手機320/360/375/430px、桌面、100/125/150/175/200%根字級、200%頁面zoom、短橫向、reduced-motion/contrast/transparency；沒有溢格/橫向捲動/裁切；固定關閉/返回可用；樣式不污染五族/診斷/備份/修復/探索/戰鬥。依實際可用瀏覽器分開報告Chrome與Safari/WebKit；不能宣稱未測真手機/讀屏/正式遊玩通過。

輸出：整體工程PASS/FAIL；各項真做/引用/推斷/未測/受阻，環境及命令exit code；缺陷按嚴重度給位置、重現、影響及是否本次diff引入；Info分開列；需要時用BASE重現歸因。工程結果不替使用者接受第二切片。保留舊Info與限制，不改標已解決。停止服務、清理隔離測試DB/角色/目錄（如有），保留可追溯且不含秘密的證據與固定SHA；不要碰正式5432或玩家存檔。
```

## 下一步界線

首版當時安排：取得限定 Git 授權 → 固定遠端 TARGET → 主動送 Grok → 讀外部結果並補修本切片 → 使用者手動核對。其後使用者明確將本次補修改由親自驗收並回報通過，以文末接受紀錄為準；不再把本次 Grok 複驗當成尚待完成的驗收步驟。後續轉職／配裝仍須另確認範圍，未自動開始。

## 首版外部工程報告 t46u（2026-10-06，Asia/Hong_Kong）

來源：指定 **AI TRPG Architecture Critic**，Grok Bot 當次對話的 23:03:57／23:04:09 回覆，由 Codex 讀取。BASE `8b8b210e984a179a1a814af3505247b53805a894`，TARGET `6dfa95e1d84cb1c7ef0a1aa64be13919f3cf8316`。**外部結果 FAIL，只限 Chrome；不代替使用者驗收。** Codex 未本機執行或重跑報告中的命令，也未核驗外部證據目錄。

外部 Git／範圍：DNS 導致 git ls-remote exit 128，bot 透過 GitHub API 唯讀重建 commit，tree `b7ddace`，分支 HEAD 等於 TARGET、BASE 為祖先；17 檔（9 新增、8 修改），+785／−19。環境 Node 24.21.0、npm 9.2.0、Chrome 154、Playwright 1.63（離線安裝）、PG 17.11 隔離叢集 55426。

| 外部命令／條件 | Exit | 外部結果 |
|---|---|---|
| npm ci（BASE／TARGET） | 0 | registry DNS 受阻，207 套件由本機 cache 按 lockfile 驗證安裝 |
| npm run build（BASE／TARGET） | 0 | 成功 |
| node --import tsx --test tests/class-catalog.test.ts tests/content-catalog.test.ts | 0 | 12／12 pass |
| npm test（沒有 TEST_DATABASE_URL） | 1 | 209 項：175 pass、17 fail、17 skip |
| env -u TEST_DATABASE_URL npm test | 1 | 同上 |
| 三個隔離 DB 分別 npx node-pg-migrate up | 0 | 成功 |
| TEST_DATABASE_URL=隔離 PG npm test | 1 | 211 項：194 pass、17 fail、0 skip |
| git diff --check（完整 SHA） | 0 | 無空白問題 |

略過不等於通過。BASE 對照：無 DB 412 項（371 pass、41 skip），PG 414／414 pass。bot 在 TARGET 隔離副本只刪除元件 CSS import 一行後，無 DB 418 項（377 pass、41 skip），PG 420／420 pass；這是外部歸因實驗，不是已提交補修版本的驗證。

### 缺陷（外部報告，均為首版 diff 引入）

- **D1 High**：ClassCatalogPanel.tsx L6 直接 import CSS；Node 載入 App／ExplorationPage／RuntimeSystemPanel 時報 ERR_UNKNOWN_FILE_EXTENSION。17 個測試檔無法載入：13 個 combat 測試及 data-diagnostics、exploration、raw-data-backup、settlement；約 200 個案例未執行。Production 運行沒有因此失敗。
- **D2 Medium**：重新讀取按鈕變原生 disabled 後，production 焦點實測落到 BODY，按 Esc 會連外層系統抽屜一起關閉。只在 dialog 節點攔 Esc 及焦點移動是 bot 的成因推斷；錯誤關閉現象為實測。
- **D3 Medium**：200% 根字級時 360／375px 列項名稱欄僅 0–7px，被動文字與倍率重疊；320px 的 200% 頁面縮放有倍率裁切。
- **D4 Low**：固定屬性欄數使倍率溢格；手機一般從 150% 開始，360px 從 125% 開始，175% 連 ×1 也溢出，200% 頁面縮放同樣重現。

### 通過及限制（只記外部結果）

Canon／資料／四項被動說明一致，待定仍保留。78 個 HTTP 案例符合固定 400／409／404、no-store、無輸入回顯；POST／PUT／PATCH／DELETE 404。200 次職業請求 0 次 LLM（探索對照 1 次），職業 GET 0 SQL／0 對外連線，角色 state、revision、三槽不變。五族 API／resolve／pendingKinds 與 BASE 逐 byte 一樣；系統原有存檔查詢 1 條 SQL 分開歸因。

Loader 32 個探測符合快照／getter／深凍結。30 種讀取故障顯示固定錯誤、沒有部分內容，timeout 5.04 秒、32KiB 邊界符合，舊回應不覆蓋、0 pageerror／unhandledrejection。正常 production 可進職業名冊，返回／一般關閉焦點與 Tab 背景限制正常；D2 仍失敗。對比最低 4.89、觸控目標至少 44px；dev StrictMode 1 次 GET、隔離多實例 useId 唯一。100%／桌面／短橫向正常，38 組排版另有 D3／D4；偏好設定生效，其他畫面樣式與 BASE 逐元素 0 差異。非 production 戰鬥／主選單正常。

新增 Info 保留：N1 九個存活 mutation 的測試缺口（重複名冊、409／404 次序、ID trim／長度、32KiB 真正量測、500／!ok 原文、固定文字）；N2 loader 可接受 TEST-劍士等替換名稱／說明；N3 陣列非索引屬性；N4 來源物件未凍結但服務副本已凍結；N5 既有 receive 接受 application/jsonp（BASE 已有）；N6 詳情標題 outline:none；N7 短橫向 200% body 76–146px、返回列項上半可能裁切；N8 新入口字型與原抽屜不同；N9 Manifest「本輪外部工程 PASS」指第一切片但可能誤讀；N10 兩名冊各有重新讀取按鈕，AX 不會同時出現；N11 新 DB 兩個並行首次 game-state GET 其中一個 503，BASE 同樣重現，屬既有問題。首版資料與 N1 所提產品行為外部實測正確；mutation 捕捉 30 個、存活 9 個。

第一切片舊 Info、原型 02 N1–N5（本輪未重驗）全部保留。真做：Git／命令、HTTP、LLM spy、loader／mutation、production UI、故障注入、dialog／焦點、useId、AX 結構、對比、38 組排版、偏好設定、樣式差異、非 production 戰鬥／主選單、StrictMode 及 BASE 歸因。引用：第一切片使用者接受句。推斷：D2 成因。未測：真手機、OS 字體縮放、讀屏、正式遊玩。受阻：Safari／WebKit、production 戰鬥／主選單入口；AX 結構不當作真讀屏 PASS。

外部證據 `/workspace/p33i-evidence`：189 檔、75 截圖，命令紀錄 logs/exits.txt。bot 回報服務已停、9 隔離 DB／角色已刪、cluster 停止、測試工作目錄已刪；未碰 5432，clone 保留舊 HEAD 且乾淨，舊證據未改。未修改專案或 commit／push。Codex 只讀報告及記錄，不冒稱親自驗證。

## 同切片 D1–D4 補修（當時準備紀錄；其後使用者接受見下）

- D1：CSS 移到既有 browser entry main.tsx 載入；可被 Node 測試 import 的元件不再 import CSS。
- D2：讀取中採 aria-disabled 並在操作入口拒絕重複觸發，保留按鈕焦點；dialog 開啟期間以 window capture 攔 Esc，包含焦點落 BODY 的狀況，關閉／卸載移除 listener。Tab 仍保留原生 dialog 導航。
- D3：按 Sheet body 實際寬度及字級調整列項；倍率獨立一行並可換行，極窄時收起純裝飾圖示，不強制縮小文字。
- D4：倍率格按文字所需寬度自適應，最多三欄，再降為兩欄／一欄，不固定窄欄。
- 同處處理 N6：標題焦點改為可見框；N9：Manifest 明確標註第一切片結果。這兩項亦待外部複驗，其餘 Info 不改標解決。

**限定補修 7 檔**：src/web/main.tsx、src/web/ClassCatalogPanel.tsx、src/web/class-catalog.css、docs/development/PHASE_33_CLASS_CATALOG.md、docs/development/CANONICAL_MANIFEST.md、docs/development/OPEN_QUESTIONS.md、docs/development/IMPLEMENTATION_PLAN.md。前次授權僅限首版 17 檔，本次新增 main.tsx，需使用者確認此次限定 Git 範圍。沒有修改 Canon 數值、伺服器／API、Save、其他畫面或舊原型。

```sh
git add -- src/web/main.tsx src/web/ClassCatalogPanel.tsx src/web/class-catalog.css docs/development/PHASE_33_CLASS_CATALOG.md docs/development/CANONICAL_MANIFEST.md docs/development/OPEN_QUESTIONS.md docs/development/IMPLEMENTATION_PLAN.md
git commit -m "fix: restore class catalog tests and accessible reflow"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
```

### 補修複驗 prompt（當時準備、未送達；其後本次改由使用者驗收）

```text
請做 Phase 33 第二切片 D1–D4 補修工程複驗；由 AI TRPG Architecture Critic 真正執行，Codex 未本機執行測試。不要修改專案、commit/push、部署、開下一切片或重新判定使用者驗收。
Repository: https://github.com/bosco8001/ai-trpg
Branch: codex/phase27-mobile-ui
BASE: 6dfa95e1d84cb1c7ef0a1aa64be13919f3cf8316
TARGET: <待填：此次限定7檔補修推送後完整SHA>
未填或遠端不可讀則停在受阻，不用浮動HEAD。核對BASE祖先關係及完整diff，只允許：
src/web/main.tsx
src/web/ClassCatalogPanel.tsx
src/web/class-catalog.css
docs/development/PHASE_33_CLASS_CATALOG.md
docs/development/CANONICAL_MANIFEST.md
docs/development/OPEN_QUESTIONS.md
docs/development/IMPLEMENTATION_PLAN.md
讀上述交付文件t46u首版FAIL紀錄，以及docs/gameplay/classes.md、character_system.md、magic.md、world/races.md；沿用首版唯讀範圍與Canon，不把原型試算轉成戰鬥或角色運算。
在隔離環境Node>=24<25，BASE與TARGET npm ci、npm run build；TARGET node --import tsx --test tests/class-catalog.test.ts tests/content-catalog.test.ts；env -u TEST_DATABASE_URL npm test；隔離PG migrate後以TEST_DATABASE_URL跑npm test；git diff --check完整BASE/TARGET。記錄exit/pass/fail/skip，略過不當通過，不動正式5432或玩家資料。
1.D1：BASE重現17檔CSS載入失敗，TARGET正常Node import App/ExplorationPage/RuntimeSystemPanel、完整測試不因CSS而崩；browser entry仍載入新CSS，production畫面樣式完整，不能以移除整套名冊或CSS代替。
2.D2：production正常探索→系統→名冊→重新讀取，延遲/timeout/500/取消/快速關閉重開；焦點在原刷新按鈕、不可觸發重複請求；Esc只關名冊保留系統抽屜。另刻意把焦點落BODY驗證capture邊界。Tab/Shift+Tab、Esc/Enter連按、listener卸載與重開、返回原列、關閉返回入口；其他抽屜正常Esc不被殘留handler干擾。
3.D3/D4：用BASE重現，再比較TARGET320/360/375/430px、桌面、100/125/150/175/200%根字級、200%page zoom、短橫向；列項文字欄有寬度，職業名稱/被動/倍率無重疊或裁切，六倍率最多三欄並能自適應2/1欄，不縮小文字或隱藏數值。選四職業全部詳情、返回/關閉/刷新真點擊可用，header/footer不蓋body。核對裝飾圖示隱藏不損名稱/觸控/可及名稱。
4.N6標題有可見焦點、N9文件確實區分第一切片PASS與第二切片FAIL；其餘N1–N11及舊Info保留，未測不標通過。特別檢查短橫向大字返回焦點的N7，不假定已修。
5.必要回歸：四職業/六倍率/被動/施法資格提示、只metadata；五族v2 API/pendingKinds不變；API成功/固定錯誤/no-store、32KiB/5秒與舊回應；無輪詢、只開啟/明確刷新GET、職業GET零SQL/LLM、state/revision/資源/背包/三Save槽不變；樣式/鍵盤/事件不污染探索/戰鬥/其他系統面板。production戰鬥/主選單若受阻，不以sandbox代替PASS。Chrome/Safari/WebKit/真手機/讀屏分開列實際未測/受阻。
報告整體工程PASS/FAIL、D1–D4及N6/N9逐項、命令exit與通過/失敗/略過、真做/引用/推斷/未測/受阻、BASE歸因、新缺陷嚴重度/位置/重現、Info與清理/證據目錄。首版t46u歷史FAIL保留；外部PASS仍不代替使用者接受第二切片。清理隔離服務/DB/角色/測試目錄，保留不含秘密證據，不改玩家資料。
```


## 使用者驗收：第二切片通過（2026-10-06，Asia/Hong_Kong）

使用者讀取首版 Grok FAIL 與同切片補修摘要後，明確指示 **「這次由我親自驗收吧」**；依 AGENTS 第 4 節使用者另行明確授權的例外，本次補修改由使用者驗收，沒有送 Grok 複驗。這次安排只適用本次補修，不更改其他階段的長期 Grok 工程驗證政策。

使用者在 build 核對步驟回報 **「build 成功」**；在 `env -u TEST_DATABASE_URL npm test` 引導後提供以下終端統計：

```text
ℹ tests 418
ℹ suites 0
ℹ pass 377
ℹ fail 0
ℹ cancelled 0
ℹ skipped 41
ℹ todo 0
ℹ duration_ms 29719.417667
```

以上為使用者回報，不是 Codex 執行。使用者沒有另提供 build exit code、完整命令回顯、環境或測試快照 SHA，不能補寫。這份統計支持本次本機完整測試未再出現首版 CSS 載入失敗；41 項 skipped 仍為未測，不當作 PG 測試通過。

之後使用者明確回覆 **「Phase 33 第二切片：四個初階職業正式名冊與唯讀核對畫面通過。」** 依此記錄整個第二切片已接受：四職業正式 metadata、獨立職業版本 1、唯讀核對入口／Sheet 及本次補修。不要求使用者重覆接受；未逐項提供的 UI／焦點／字級操作結果不補寫成測試證據。

版本界線：記錄時本地 HEAD 為 `6dfa95e1d84cb1c7ef0a1aa64be13919f3cf8316`、分支 `codex/phase27-mobile-ui`，但 main.tsx、ClassCatalogPanel.tsx、class-catalog.css 及四份交付／狀態文件的補修仍為未提交變更。HEAD 只供版本對照，不是補修版本，也不是使用者指定的測試 SHA。首版固定 TARGET 的 Grok t46u FAIL、外部隔離實驗及本次使用者結果分開保留，不能把使用者接受改寫成 Grok 複驗 PASS 或 Codex 親自測試。

Grok t46u N1–N11、第一切片及原型既有 Info 保留。N6／N9 的調整也沒有 Grok 複驗；不把全部 Info 改標已解決。真手機、OS 字體縮放、讀屏、正式遊玩、Safari／WebKit、production 戰鬥／主選單受阻及本次 41 項略過，均不因階段接受而變成已測通過。接下來的轉職、創角、配裝、技能／裝備名冊、戰鬥被動及進階解鎖仍未開始。

本輪只更新本文件、CANONICAL_MANIFEST.md、OPEN_QUESTIONS.md、IMPLEMENTATION_PLAN.md 的驗收紀錄；依純文字例外不另外送 bot。沒有新增程式變更、測試執行、commit／push 或部署。使用者的階段接受不自動擴大先前限定 17 檔的 Git 授權；補修與紀錄仍待另行授權提交。
