# Phase 33 第七切片：正式起始配套名冊與唯讀核對

日期：2026-10-10（Asia/Hong_Kong）。使用者在第六切片獨立原型接受後要求下一步，並對第七切片方案選 A，批准沿用原型門檻、屬性加成與護甲值作首版正式數值。程式與案例已準備；Codex 未執行 build、typecheck、測試、靜態檢查或 UI 驗證。尚未新增 commit／push、未送達 Grok、未獲第七切片驗收。

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

基準完整 SHA：`72d804335d6f9aa32fbddddd9b93fe7c72228f27`。TARGET：`待填：本次限定提交推送後的完整 SHA`。送出前再次核對 Git、遠端 TARGET、當次指定對話與 draft，完整 prompt 填 TARGET 後送一次並讀回確認；未送達不得寫成已送驗。

## 工程與驗收狀態

- 新測試檔 8 項案例尚未執行，涵蓋首版數值、配套／來源、拒絕引用、失效名冊、快照凍結、HTTP、真 app 唯讀及有界讀取／取消；沒有宣告 mutation 或瀏覽器通過。
- 舊第六切片 Grok PASS 不沿用為本次結果。舊 N1 Low、Info、略過與真手機／讀屏／Safari 未測限制保留各自來源，不宣告已修正。
- 本切片工程狀態：待指定 AI TRPG Architecture Critic 驗證。第七切片狀態：待使用者驗收，不宣告整個 Phase 33 完成。
- 下一候選切片：配套發放與可變配裝保存的契約討論；發放／補發／去重／初始化資源等確認及本切片接受後才開始實作。
