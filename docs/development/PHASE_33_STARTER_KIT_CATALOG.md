# Phase 33 第七切片：正式起始配套名冊與唯讀核對

日期：2026-10-10（Asia/Hong_Kong）。使用者在第六切片獨立原型接受後要求下一步，並對第七切片方案選 A，批准沿用原型門檻、屬性加成與護甲值作首版正式數值。程式與案例已準備；Codex 未執行 build、typecheck、測試、靜態檢查或 UI 驗證。以下準備狀態與待填欄位保留為提交時的歷史紀錄；目前狀態見下方「交接紀錄」，第七切片仍待使用者驗收。

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
