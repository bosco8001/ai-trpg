# Phase 33 第二切片：四個初階職業正式名冊

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

取得限定 Git 授權 → 固定遠端 TARGET → 主動送 Grok → 讀外部結果並補修本切片 → 使用者手動核對 → 使用者明確接受後，才討論角色職業／轉職或配裝的下一個小切片。本切片沒有自動開始後續功能。
