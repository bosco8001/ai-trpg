# Phase 33 第七切片：正式起始配套名冊與唯讀核對

日期：2026-10-10（Asia/Hong_Kong）。使用者在第六切片獨立原型接受後要求下一步，並對第七切片方案選 A，批准沿用原型門檻、屬性加成與護甲值作首版正式數值。程式與案例已準備；Codex 未執行 build、typecheck、測試、靜態檢查或 UI 驗證。以下準備狀態與待填欄位保留為提交時的歷史紀錄；目前狀態見各版交接／外部結果及最新補修紀錄，第七切片仍待使用者驗收。

## 範圍與來源

- 正式來源：[起始配套 v1](../gameplay/starter_kits.md)、Character、Classes、Magic、Combat；依 MANIFEST／OPEN_QUESTIONS 處理未定界線。
- 首批八件物品、四項能力、四職業配套與熟練，獨立名冊 v1／schema v1／official namespace，引用職業名冊 v1。
- 使用者批准的是裝備／能力屬性門檻、加成與護甲值，不批准傷害、MP 消耗、詠唱、冷卻或箭矢數量。能力明示 `combatRules: unresolved`，未定欄位不填 0。
- 固定配套明示各一件；重斬／瞄準射擊／迅刺為已學物理技能，火焰箭由魔法書提供，不等於永久已學或直接施法資格。
- 只查閱資料，不發放配套、不改出生紀錄、不開放其他職業、不穿戴、不推導角色屬性或資源、不改 Run／三槽 Save／DB schema／LLM／戰鬥。
- 第六切片人類單一 14 點與初始全零操作已接受，但本次不改正式創角 UI 或第五切片資料契約；正式接入另分切片。

## 工程介面

- `GET /api/starter-kit-catalog`：只接受空查詢，回完整名冊，`Cache-Control: no-store`。
- `GET /api/starter-kit-catalog/resolve?kind=item|skill|spell|kit&id=...&version=1`：只接受精確三欄；錯格式 400、未知／錯種類／TEST 引用 404、不支援版本 409；固定訊息不回原始錯誤或請求。
- Loader 先複製後驗證同一快照、凍結全部巢狀物件；驗證整份種類、結構、完整 ID 集合、重複／稀疏列表與配套跨引用，不提供部分資料或 TEST 回退。
- 前端完整驗證、單次回應 64 KiB 上限、整次載入 5 秒，手動重試。職業與配套都成功才顯示內容，版本不合或其中一份失敗均不顯示部分名冊；關閉／重開取消舊請求，不讓過期回應覆蓋新狀態。
- 四職業 → 單職業配套 → 返回原職業列的焦點；裝備細節採折疊，主動能力及來源分開。原生 modal dialog／portal，Escape 只關上層、Tab 不交由底下系統面板處理、關閉回入口。
- 沿用已接受 class-catalog 手機設計 tokens 與 Sheet 外殼：game-ui-ux 負責流程／焦點／唯讀狀態，ui-ux-pro-max 負責分層／換行／觸控／無障礙，apple-design 負責字級／間距／短回饋。新增 CSS 僅針對起始配套；未重設全站風格。
- 既有職業核對畫面的共通說明同步首批內容與門檻來源，職業資料／版本不改。

## 待使用者手動核對

1. 正式探索畫面開「系統」→「起始配套名冊」，確認四職業與配套名冊 v1。
2. 逐個職業開啟，展開物品：核對名稱、需求、加成、護甲與熟練；確認弓箭手／斥候共用皮甲。
3. 魔術師的書本需求智慧 12，火焰箭需求智慧 15、技能加成智慧 +1；書本標示未永久學會，火焰箭無木杖需求。
4. 返回四職業／關閉／重開，確認畫面與焦點正常；手機窄畫面、橫向及大字下內部可捲動，關閉與返回可操作。
5. 查閱前後已保存角色及三槽資料保持；沒有發放、換裝或施法操作。

以下命令與自動化／瀏覽器案例供 Grok 執行；本地尚未執行，不宣告工程通過。完整審查 prompt 見 [Grok 要求](PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md)。

## 限定提交範圍（21 檔）

1. `src/shared/starter-kit-catalog.ts`
2. `src/server/content/starter-kits-v1.ts`
3. `src/server/starter-kit-catalog.ts`
4. `src/server/app.ts`
5. `src/web/starter-kit-catalog-client.ts`
6. `src/web/StarterKitCatalogPanel.tsx`
7. `src/web/starter-kit-catalog.css`
8. `src/web/ExplorationPage.tsx`
9. `src/web/ClassCatalogPanel.tsx`
10. `src/web/main.tsx`
11. `tests/starter-kit-catalog.test.ts`
12. `docs/gameplay/starter_kits.md`
13. `docs/gameplay/character_system.md`
14. `docs/gameplay/classes.md`
15. `docs/gameplay/magic.md`
16. `docs/development/PHASE_33_STARTER_KIT_CATALOG.md`
17. `docs/development/PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md`
18. `docs/development/PHASE_33_STARTER_KIT_DISCUSSION.md`
19. `docs/development/CANONICAL_MANIFEST.md`
20. `docs/development/IMPLEMENTATION_PLAN.md`
21. `docs/development/OPEN_QUESTIONS.md`

第 19–21 檔包含前輪尚未提交的使用者驗收／外部結果狀態記錄及本輪第七切片狀態。其他既有 dirty 檔案，包括 AGENTS、Phase 31／第五切片、原型 README／提案與其他原型，不在本次提交範圍；不暫存或清理。

依 AGENTS 第 4 節，本次 A 與實作範圍批准不等於 commit／push 授權。限定指令準備如下，等待使用者授權才執行：

```sh
git add -- src/shared/starter-kit-catalog.ts src/server/content/starter-kits-v1.ts src/server/starter-kit-catalog.ts src/server/app.ts src/web/starter-kit-catalog-client.ts src/web/StarterKitCatalogPanel.tsx src/web/starter-kit-catalog.css src/web/ExplorationPage.tsx src/web/ClassCatalogPanel.tsx src/web/main.tsx tests/starter-kit-catalog.test.ts docs/gameplay/starter_kits.md docs/gameplay/character_system.md docs/gameplay/classes.md docs/gameplay/magic.md docs/development/PHASE_33_STARTER_KIT_CATALOG.md docs/development/PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md docs/development/PHASE_33_STARTER_KIT_DISCUSSION.md docs/development/CANONICAL_MANIFEST.md docs/development/IMPLEMENTATION_PLAN.md docs/development/OPEN_QUESTIONS.md
git diff --cached --name-only
git commit -m "feat: add official starter kit catalog and readonly sheet"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
git ls-remote origin refs/heads/codex/phase27-mobile-ui
```

首版基準完整 SHA：`72d804335d6f9aa32fbddddd9b93fe7c72228f27`。首版 TARGET：`49f23f9aa6e627012063b8d3cf5d754557d6886e`。送出前再次核對 Git、遠端 TARGET、當次指定對話與 draft，完整 prompt 填 TARGET 後送一次並讀回確認；未送達不得寫成已送驗。

## 工程與驗收狀態

- 首版新測試檔 8 項案例已由指定 Grok 外部執行；本次新增拒絕案例尚待複驗。首版案例涵蓋首版數值、配套／來源、拒絕引用、失效名冊、快照凍結、HTTP、真 app 唯讀及有界讀取／取消；首版 mutation／瀏覽器結果見下方外部回報，不代表補修已通過。
- 舊第六切片 Grok PASS 不沿用為本次結果。舊 N1 Low、Info、略過與真手機／讀屏／Safari 未測限制保留各自來源，不宣告已修正。
- 本切片工程狀態：首版外部 PASS，補修待指定 AI TRPG Architecture Critic 複驗。第七切片狀態：待使用者驗收，不宣告整個 Phase 33 完成。
- 下一候選切片：配套發放與可變配裝保存的契約討論；發放／補發／去重／初始化資源等確認及本切片接受後才開始實作。

## 交接紀錄

2026-10-10：使用者明確授權限定 21 檔 commit／push 並送驗。已提交並推送 `49f23f9aa6e627012063b8d3cf5d754557d6886e`，遠端分支讀回一致；BASE 為 `72d804335d6f9aa32fbddddd9b93fe7c72228f27`。香港時間 21:39:03 透過 Grok Bot Control 將完整 prompt 送交 AI TRPG Architecture Critic 一次；讀回新 outgoing 訊息、完整 BASE／TARGET 及空 composer，確認送達。送達當時工程結果待回覆，不能把 Working 當 PASS；其後首版結果見下方。Codex 未執行 build／測試／UI 驗證；其他既有 dirty 檔未納入提交。此交接紀錄為提交後新增的本地文字紀錄，尚未另行提交。

## 首版外部工程回報（49f23f9，2026-10-10）

指定 AI TRPG Architecture Critic 於香港時間 22:07:25／22:07:30／22:07:36 回覆。Codex 僅讀取報告、對照來源及記錄，沒有執行其中命令，亦沒有下載遠端證據。BASE `72d804335d6f9aa32fbddddd9b93fe7c72228f27`；TARGET `49f23f9aa6e627012063b8d3cf5d754557d6886e`；外部結論工程 PASS，無 High／Medium，保留一項沿用 Low 與五項 Info，不替使用者接受第七切片。

- 外部 npm ci、npm run build、完整 SHA 的 git diff --check：全部 exit 0。Node 24.21.0、Chrome 154、Playwright 1.59.1、PG17 隔離 55426。
- 五個指定測試檔：無 DB 46／46、0 skip；隔離 PG 46／46。全套無 DB：459 項、411 pass／0 fail／48 skip；隔離 PG：461／461、0 skip。略過不算通過。
- 官方 production dist＋PostgreSQL HTTP 61／61、loader 探測 78 項通過；連讀 100 次後出生、state、三槽及 DB table md5 未變。四職業數值／來源與 Canon 一致；主流程 20／20、故障 19／19，舊回應不能覆蓋，Tab／Shift+Tab 各 25 次留在上層，Escape／返回焦點正常，只 GET。
- Chrome 實測 320／375／390／430、568×320／844×390，normal、CSSOM 200%、真縮放與模擬縮放分開，reduced-motion／鍵盤；無溢出、按鈕至少 44px、AA 0 fail。真縮放方法為 Chrome profile 3.8018＋CDP 截圖；CSSOM 200% 只改 root 字級，不代表系統字級／真手機。
- BASE／TARGET 4 尺寸×52 畫面 computed style 回歸：非位置樣式差異 0；新入口及職業文案導致預期位移／高度變化。memory 創角兩版均 503、取消備份下載均停用，未比較到該兩項；戰鬥／存檔／修復的回歸依全套 PG 測試推斷，未逐一 UI 操作。
- L-1 Low：起始配套沿用 class-catalog 固定 header／footer；CSSOM 200% 320×568 body 約 80px、568×320 約 76px；真縮放 568×320 約 36px、844×390 約 71px。既有職業名冊相同，非本次新引入；仍可捲動、Escape，AA 0 fail。
- Info 1：三個非等價 mutation 未被既有測試抓到。966 case 比對分別有物理技能 kind 6 個差異、kind=item 誤回配套 4 個差異、移除 complete() 48 個差異；另三個 mutation 外部比對為完全等價，其餘 14 個被抓到。實際 complete() 位於 shared/starter-kit-catalog.ts；報告這一項的 server 檔名按源碼對照補註，不改寫測試結論。
- Info 2：遠端提交時的待填／未提交文件狀態落後。Codex 未親測仍是事實；現在另列外部版本、提交／送達紀錄，不將外部執行改寫為親測。
- Info 3：favicon.ico 404，BASE 已存在。Info 4：validator 驗結構，數值由正式內容及測試鎖定。Info 5：重新讀取按鈕完成後 120ms 背景過渡短暫對比 1.61，穩定後高對比，reduced-motion 最低 4.89。
- 引用：原型未改，舊 N1 Low 仍 open。未測真手機／讀屏／Safari／系統字級，受阻無。證據由 Grok 保留於 `/workspace/p33r-evidence/`，總覽 SUMMARY.md；隔離 DB／role／55426 已清理，5432／舊證據未動。

## 同切片補修準備（尚未驗證）

沿用 game-ui-ux 的上層焦點／流程、ui-ux-pro-max 的可捲動區域／大字可讀性、apple-design 的同步回饋及既有視覺 tokens。只修起始配套，不改正式數值、資料契約、API 或其他名冊外殼。

- 起始配套 dialog 新增具名 size container：容器高度不超過 36rem 時讓 frame 整體捲動、body 自然高度；標題／內容／底欄不再佔固定三段。一般高畫面仍採原分段；返回列依實際 scroll viewport 計算，兩個 scrollTop 在切頁重設。關閉／返回仍可捲到，Escape 保留。
- 起始配套按鈕只保留短按壓 transform，前景／背景狀態同步切換，避免過渡對比下降；reduced-motion 停用 transition。
- 在原有八項測試內補物理技能 kind 遺失／錯值、所有正式 ID 跨 kind 的拒絕矩陣、items／abilities／kits 的空／缺漏／多／重複集合，HTTP kind=item＋配套 ID 拒絕。Codex 未執行新增案例或 mutation。
- 既有職業名冊 L-1、原型 N1、favicon 404、validator 結構與數值分工及未測限制保留；不因本次準備宣告已修好。

限定補修 8 檔：`src/web/StarterKitCatalogPanel.tsx`、`src/web/starter-kit-catalog.css`、`tests/starter-kit-catalog.test.ts`、`docs/development/PHASE_33_STARTER_KIT_CATALOG.md`、`docs/development/PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md`、`docs/development/CANONICAL_MANIFEST.md`、`docs/development/IMPLEMENTATION_PLAN.md`、`docs/development/OPEN_QUESTIONS.md`。含前次送達／本次外部結果記錄，其他既有 dirty 檔不納入。前次 21 檔提交已完成；本次補修提交／推送尚待使用者限定授權。

```sh
git add -- src/web/StarterKitCatalogPanel.tsx src/web/starter-kit-catalog.css tests/starter-kit-catalog.test.ts docs/development/PHASE_33_STARTER_KIT_CATALOG.md docs/development/PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md docs/development/CANONICAL_MANIFEST.md docs/development/IMPLEMENTATION_PLAN.md docs/development/OPEN_QUESTIONS.md
git diff --cached --name-only
git commit -m "fix: improve starter catalog reading and guard coverage"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
git ls-remote origin refs/heads/codex/phase27-mobile-ui
```

補修 BASE `49f23f9aa6e627012063b8d3cf5d754557d6886e`，TARGET 待限定提交推送後填入；不拿首版 PASS 代替複驗。

## 補修交接紀錄

2026-10-10 使用者授權限定上述 8 檔 commit／push 並複驗。已提交並推送 `16c322c78075cd4097145aa36ecb2a9fa0185bf0`，BASE 為 `49f23f9aa6e627012063b8d3cf5d754557d6886e`，遠端讀回一致。香港時間 22:23:43 透過 Grok Bot Control 送指定 AI TRPG Architecture Critic 一次，讀回完整新 outgoing 與空 composer，確認送達。補修工程結果待回覆，Codex 未親測；前文補修待提交／TARGET 待填描述提交前準備狀態。此紀錄為提交後新增本地文字，尚未另行提交。

## 16c322c 外部複驗回報（2026-10-10）

指定 AI TRPG Architecture Critic 於香港時間 22:48:01／22:48:08／22:48:12 回報；BASE `49f23f9aa6e627012063b8d3cf5d754557d6886e`、TARGET `16c322c78075cd4097145aa36ecb2a9fa0185bf0`，精確八檔。外部結論工程 PASS，無 High／Medium，但新增 Low L-2；使用者尚未接受第七切片。Codex 僅讀報告及源碼，不執行測試，未下載遠端證據。

- npm ci／build／完整 SHA diff --check／三個隔離 DB migration：外部全部 exit 0。五個指定檔案無 DB 及隔離 PG 均 46／46、0 skip；全套無 DB 459 項、411 pass／0 fail／48 skip，隔離 PG 461／461。
- 三個非等價 mutation M4b／M4c／M6a：TARGET fail、首版 pass；還原原碼與 TARGET 測試 pass，非靠舊交叉引用偶然捕捉。production HTTP 125／125，16 正式 ID×3 錯 kind 的 48 查詢均安全404／no-store，正確種類200。
- Grok 主動更正首版報告：「其餘14個 caught」應為15（M3a／M3b分開）；三個等價 mutation M5b／M6b／M6d 仍引用前輪966 case比對。complete() 的 shared 檔位置補註正確。上方首版14個與原送出prompt只保留歷史來源，本次以這項更正為準。
- 起始配套 L-1 已由 BASE 重現＋TARGET 18 組（6 尺寸×normal／CSSOM200%／真縮放）證明修正。CSSOM200% 320×568 可讀 viewport 521px；真縮放568×320為158px、844×390為193px。高畫面保留分段，短／大字整張Sheet捲動；所有數值／控制可捲到，目標至少44px，無裁字／橫向溢出。窄寬facts、返回列／重新開啟／Esc及各Tab停點正常；安全區只用CDP模擬。
- 按鈕逐rAF約156格／段：normal及reduced-motion的busy成功／失敗、重試、hover／pressed／focus最低4.8，前版1.61混色已修。
- **L-2，新 Low，尚未解決**：390×844魔術師頁，Tab停「返回四職業」，轉844×390或高度640→620跨36rem。frame改整頁捲動但scrollTop仍0，activeElement在top1777，完全不可見，需另按Tab／Shift+Tab。BASE無此退化；本次真縮放轉向未跨界線則不受影響。位置為starter-kit-catalog.css的高度query及StarterKitCatalogPanel只在selected/open校正捲動。
- 主流程20／20、故障19／19；production出生／state／三槽／8table md5不變。舊UI 4尺寸×57狀態 computed style及位置差異0（時間戳／預覽hash除外）。戰鬥／存檔／修復只依全套PG測試推斷，未逐項UI操作。
- Info：Chrome154開著Sheet改root字級時container query不即時切，需resize或重開；390×844當時body357px仍可讀。320×568普通字也整頁捲動為設計取捨。提交內部分狀態文落後，歷史／外部來源仍分清，TARGET待填模板非缺陷。既有職業名冊L-1、原型N1、favicon404及validator結構／數值分工保留。
- 未測真手機／讀屏／Safari／系統字級、頁面開著改真縮放、375×667運行中改字級實際值、真安全區。受阻無；證據由Grok保留 `/workspace/p33s-evidence/`／SUMMARY.md。server／三DB／role／55426已清理，5432／舊證據未動。

## L-2 焦點補修（尚未提交／驗證）

只在起始配套 dialog 開啟期間，以 ResizeObserver 觀察 dialog／frame／body／header／footer，並聽視窗及 visualViewport resize；合併到下一個 animation frame，重新讀目前 activeElement，僅當焦點仍在此 dialog 且超出實際 scroll viewport，使用 instant nearest 捲回可見範圍。不重新focus、不改selected、不重載名冊、不重設一般捲動位置；關閉時解除observer／事件及取消排程，保留上層Esc、開啟／返回流程、來源取消與原有配套／樣式規則。game-ui-ux的焦點／狀態邊界、ui-ux-pro-max的尺寸可用性及apple-design的即時非動畫回饋協同適用，並未重設視覺。

Codex 未執行 build／typecheck／測試／browser／UI驗證；新焦點補修待指定 Critic 複驗，不因前版結果宣告L-2已修。確認桌面轉向／跨36rem、大字／viewport尺寸變化時已停留的焦點可見，且滑鼠自由閱讀不被拉回、關閉後沒有殘留作用；方法／邊界／失敗回歸見新prompt。

本次限定六檔：`src/web/StarterKitCatalogPanel.tsx`、`docs/development/PHASE_33_STARTER_KIT_CATALOG.md`、`docs/development/PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md`、`docs/development/CANONICAL_MANIFEST.md`、`docs/development/IMPLEMENTATION_PLAN.md`、`docs/development/OPEN_QUESTIONS.md`。含前輪送達紀錄及本輪外部結果；其他dirty不納入。前次八檔提交已完成，焦點補修commit／push尚待限定授權。

```sh
git add -- src/web/StarterKitCatalogPanel.tsx docs/development/PHASE_33_STARTER_KIT_CATALOG.md docs/development/PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md docs/development/CANONICAL_MANIFEST.md docs/development/IMPLEMENTATION_PLAN.md docs/development/OPEN_QUESTIONS.md
git diff --cached --name-only
git commit -m "fix: retain starter catalog focus through reflow"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
git ls-remote origin refs/heads/codex/phase27-mobile-ui
```

BASE `16c322c78075cd4097145aa36ecb2a9fa0185bf0`；TARGET待限定提交推送後填入。待使用者接受第七切片，下一主要切片不開始。


## L-2 補修交接紀錄

2026-10-10 使用者授權限定上述六檔 commit／push 並複驗。已提交並推送 `6436313ddc979d7518ffcf7f2c60f70dfd3952a8`，BASE 為 `16c322c78075cd4097145aa36ecb2a9fa0185bf0`，遠端分支讀回一致。香港時間 22:56:14 透過 Grok Bot Control 將完整要求送交 AI TRPG Architecture Critic 一次；讀回完整新 outgoing、BASE／TARGET 與空 composer，確認送達。工程結果待回覆，Working 不代表 PASS；Codex 未執行 build／測試／UI 驗證。前文待提交／待填描述提交前準備狀態，此交接紀錄及 prompt 完整 TARGET 為提交後新增的本地文字，尚未另行提交。其他既有 dirty 檔未納入，第七切片仍待使用者最終驗收，未開始下一主要切片。


## 6436313 外部複驗回報（2026-10-10）

指定 AI TRPG Architecture Critic 於香港時間 23:37:31／23:37:38／23:37:44 回覆，Codex 經 Grok Bot Control 原生介面讀回。BASE `16c322c78075cd4097145aa36ecb2a9fa0185bf0`；TARGET `6436313ddc979d7518ffcf7f2c60f70dfd3952a8`。外部結論工程 PASS、無 High／Medium，L-2 已修，但新增 Low L-3。使用者尚未接受第七切片。以下都是外部執行／觀察，Codex 未執行命令或 UI 測試，亦未下載遠端證據。

- 遠端 HEAD／上一個 BASE 及六檔範圍一致：TSX +28／−0，加五份文件；CSS、prototype、server、shared、migration、package 未改。npm ci、build、完整 SHA diff --check、三個隔離 DB migration 均 exit 0；PG 叢集 55426。
- 五指定檔無 DB／隔離 PG 均 46／46、0 skip；全套無 DB 459 項、411 pass／0 fail／48 skip，隔離 PG 461／461。Production HTTP 125／125、主流程 20／20、故障 19／19；三槽與八個 table md5 未變，只有 GET、無重載。
- L-2：BASE 390×844 魔術師頁 Tab 返回後轉 844×390，焦點 top1777–1821／viewport1–389，scrollTop0；640→620、反向與629→628亦重現。TARGET 保留同一焦點，例 rect337–381／scrollTop1440；反向與631–627逐1px正常。
- 6尺寸×normal／CSSOM200%／真縮放×7焦點停點，每次轉向／轉回／尺寸／字級及還原後等6個rAF；882次全部 AA 可見、864次完整可見，18次只AA均在真縮放＋CSSOM200%約400%，其中10個元件大於viewport。無震盪／observer loop／page error；18組Tab、Shift+Tab、返回原魔術師列、Esc回入口及重開標題正常。真縮放用Chrome profile3.8018＋CDP截圖，非系統字級或真手機。
- window resize 有上述結果證據；`Emulation.setPageScaleFactor 1.5` 僅觸發 visualViewport resize，原可見焦點不移動。`Input.synthesizePinchGesture` 在headless無作用，真pinch受阻。CDP模擬top47／bottom34後TARGET轉向／620高度焦點可見，BASE返回／規則不可見；非真安全區。
- 開啟時window／visualViewport listener及observer各1，關閉各0，重開5次無累積；dialog外焦點／關閉不操作；resize立即Esc取消rAF且探索／抽屜未捲動；慢載入、重試、選職業／resize／返回、取消交錯正常。
- **L-3，新 Low，待修**：390×844配套頁焦點在返回，手動捲離（scrollTop1440），window改1px或僅visualViewport resize，被拉回scrollTop220，scrollIntoView一次；程式切details亦觸發。只捲動或等2秒不吸回；BASE不會。位置StarterKitCatalogPanel.tsx L56–69／L73–78。手機pinch／網址列伸縮／轉向可能打斷閱讀是Grok推斷，未真機驗證。
- Info：reflow後約1–3格生效，第二格仍有98次不可見、第六格全部可見；「使用者感覺不到」只屬推斷。模擬安全區轉橫返回底部373，進入底部安全區17px；Grok指出scroll-padding16px未計env底部。本輪提交狀態字眼屬提交前紀錄，非缺陷。
- 必要回歸：起始配套L-1仍已修，最小可讀158px；按鈕逐幀對比最低4.8；M4b／M4c／M6a均被抓，還原正常；四尺寸computed style與BASE一致。15caught／3等價引用t66u更正結果，非本輪全量重做。既有職業名冊L-1本輪重測仍36px；原型N1、favicon404、I-1及validator結構／數值分工保留。
- 未測真機、讀屏、Safari、系統字級、真安全區、真Chrome Android網址列；真pinch受阻。證據由Grok保留 `/workspace/p33t-evidence/`／SUMMARY.md。server／DB／role／叢集已清理，PG套件保留；5432未碰，舊證據hash未變、舊audit維持771e7de，repo無修改／commit／push。本輪未重新測全部舊UI玩法，不能將前輪回歸來源改寫成親測。

## L-3 閱讀位置與安全區補修（尚未提交／複驗）

game-ui-ux負責焦點與閱讀狀態，ui-ux-pro-max負責手機安全區及可見範圍，apple-design負責保留玩家操作主導及instant回饋，共同沿用已接受視覺。本次只補起始配套Sheet，不改其他名冊、正式數值或任何角色狀態。

- 開啟期間記錄目前焦點、實際scroll viewport幾何及可見性。focusin建立新基準，frame／body的scroll在viewport幾何未改時更新閱讀位置；viewport因reflow換區域或尺寸時，保留舊基準供resize判斷，避免把版面變動當手動捲動。
- resize／observer仍合併rAF，只維持「同一焦點在變動前仍可見」的情況。已手動捲離焦點則不呼叫scrollIntoView；重新用Tab選焦點／捲回可見後重新記錄。處理後更新基準，關閉清除focusin／scroll與原有observer／resize／rAF。
- whole-frame模式的scroll-padding-bottom加入env(safe-area-inset-bottom)，焦點測量採實際scroll-padding，避免nearest把返回捲進底部安全區。外觀、按鈕顏色／動畫及一般高畫面分段規則保持既有設計。
- Codex只讀程式、文件、差異及外部報告；未執行build／typecheck／測試／browser／UI驗證，未新增自動化測試。必要真UI案例及原缺陷對照已列於新Grok prompt；本輪補修尚未證明通過。

限定七檔：`src/web/StarterKitCatalogPanel.tsx`、`src/web/starter-kit-catalog.css`、`docs/development/PHASE_33_STARTER_KIT_CATALOG.md`、`docs/development/PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md`、`docs/development/CANONICAL_MANIFEST.md`、`docs/development/IMPLEMENTATION_PLAN.md`、`docs/development/OPEN_QUESTIONS.md`。包含上輪送達紀錄與本輪外部結果；其他既有dirty不納入。前次六檔commit／push授權已完成；本次加入CSS等新改動，限定提交推送尚待使用者授權。完整prompt見GROK_REVIEW最末段。

```sh
git add -- src/web/StarterKitCatalogPanel.tsx src/web/starter-kit-catalog.css docs/development/PHASE_33_STARTER_KIT_CATALOG.md docs/development/PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md docs/development/CANONICAL_MANIFEST.md docs/development/IMPLEMENTATION_PLAN.md docs/development/OPEN_QUESTIONS.md
git diff --cached --name-only
git commit -m "fix: preserve starter catalog reading position on resize"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
git ls-remote origin refs/heads/codex/phase27-mobile-ui
```

BASE `6436313ddc979d7518ffcf7f2c60f70dfd3952a8`；TARGET待限定七檔提交推送後填入。不把本輪外部PASS當成新補修PASS，待使用者最終驗收，未開始下一主要切片。
