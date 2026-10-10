# Phase 33 第七切片工程審查要求

2026-10-10 香港時間 21:39:03 已透過 Grok Bot Control 送達指定 AI TRPG Architecture Critic，已讀回新訊息與空 composer；首版 49f23f9 於 22:07 獲外部工程 PASS，L-1／五項 Info 保留；同切片補修待提交及複驗。Codex 未執行 build／測試／UI 驗證。以下第一份為首版實際送出的完整 prompt；本狀態與 TARGET 為提交後補入的本地文字紀錄，尚未另行提交。

---

請 AI TRPG Architecture Critic 對本次 Phase 33 第七切片「正式起始配套名冊與唯讀核對畫面」做工程驗證。這是 Codex 準備的實作，不能把舊原型 PASS 當成本次結果；工程審查不替使用者批准 UI 手感、平衡或階段完成。

Repository：https://github.com/bosco8001/ai-trpg
Branch：codex/phase27-mobile-ui
BASE：72d804335d6f9aa32fbddddd9b93fe7c72228f27
TARGET：49f23f9aa6e627012063b8d3cf5d754557d6886e
Operator：Codex

## 來源與授權

使用者已接受 Phase 33 第六切片獨立原型，其後選 A，明確批准沿用原型裝備／能力的屬性門檻、加成與護甲值作正式首版，要求小切片正式名冊及唯讀核對。A 沒有批准角色發放、配裝保存或正式戰鬥。

請先讀 TARGET 的 AGENTS、CANONICAL_MANIFEST、OPEN_QUESTIONS、docs/gameplay/starter_kits.md、character_system.md、classes.md、magic.md、combat_system.md，及 docs/development/PHASE_33_STARTER_KIT_CATALOG.md 的完整 21 檔範圍。第六切片討論的歷史「只供原型／數值未定」與舊報告不能覆蓋使用者這次明確批准；歷史缺陷、未測及 DB 略過不改標通過。

## 範圍與必要語意

獨立 schema v1／配套 catalog v1／official namespace，引用職業 v1：八件裝備、四項能力、四職業固定配套與熟練；嚴格唯讀 GET／resolve、複製後驗證同一快照、全部巢狀凍結、完整 ID 集合及跨引用、不回退 TEST。系統面板新增一個入口、一次看一職業、折疊物品明細、書本來源／永久已學分開，沿用接受的手機 Sheet 與 tokens。既有職業核對文案同步。

請獨立逐項對照正式 Canon 與程式／畫面，不能只相信測試表：

- 單手劍：力量 10，力量 +1，護甲 0；短弓：敏捷 10，感知 +1，護甲 0；匕首：敏捷 10，敏捷 +1，護甲 0；普通木杖：力量 6，無加成，護甲 0。
- 鎖甲：力量 10，體質 +1，護甲 3；皮甲：敏捷 10，敏捷 +1，護甲 2；布袍：智慧 10，智慧 +2，護甲 1；火焰箭魔法書：智慧 12，無加成，護甲 0，只包含火焰箭。
- 重斬力量 15／力量 +1／已學且生效劍；瞄準射擊感知 15／感知 +1／已學且生效弓；迅刺敏捷 15／敏捷 +1／已學且生效匕首；火焰箭智慧 15／智慧 +1／合法書本綁定，或已學且具有直接施法資格，無木杖需求。
- 劍士單手劍／鎖甲／重斬／劍熟練；弓箭手短弓／皮甲／瞄準射擊／弓熟練；斥候匕首／皮甲／迅刺／匕首熟練；魔術師木杖／布袍／魔法書／杖熟練，火焰箭不是永久已學。物品各一件。
- 裝備需求不含任何裝備或技能加成，技能需求可加入合法生效裝備但不能加入技能加成。普通木杖不授予施法資格；職業不鎖技能、名冊不開放職業。
- 戰鬥欄位 unresolved，沒有偷偷補傷害／消耗／詠唱／冷卻為零或執行戰鬥。配套發放、舊角色補發、去重、出生、可變行囊／配裝、目前資源、Run／Save、DB schema／LLM 都不接入。本輪也不改第五切片配點操作或生成。

## 執行與回歸

1. 核對完整 TARGET／BASE、遠端 HEAD、祖先、diff 範圍；執行 npm ci、npm run build、git diff --check BASE TARGET，記命令及 exit code。
2. 執行 `node --import tsx --test tests/starter-kit-catalog.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts`，再執行 `npm test`。有 DB 測試請用全新隔離 PostgreSQL、獨立角色／DB／非 5432 連接埠，不碰既有資料；未做或 skip 必須分開記錄，不能算 PASS。
3. Loader/API：完整資料、有界輸入、getter 快照、所有巢狀凍結、未知／TEST／特殊 ID、錯種類、版本、重複／稀疏列表、未知跨引用、錯書本來源、重複 query、缺／多欄、寫入方法拒絕、安全固定錯誤、no-store。讀取前後比較已建立出生紀錄、活動 state／revision／HP／MP及三槽快照，確認沒有副作用。驗證真 app 與 production 註冊，不只獨立測試 Fastify。
4. 前端：兩份完整名冊成功才顯示；配套或職業其中一份失敗／非法／截斷／超過限制／慢回應／abort，不顯示部分或舊內容。關閉前仍在載入、立即重開／重試，舊回應不得覆蓋新狀態；只 GET 名冊，無 mutation、儲存或 LLM 請求。
5. UI 實測 320／375／390／430px、短橫向 568×320／844×390、普通與 200% 字體及真正 browser zoom（說明方法），reduced-motion、鍵盤與焦點。四職業進入／返回原列、重新開啟、物品折疊、關閉／Escape 只關上層、Tab／Shift+Tab 留在上層。注意系統抽屜自身 trap 不得攔截 dialog Tab，返回列須可見，header／footer／body 不遮焦點或溢出；不能用 CSSOM 字級模擬冒稱系統字體或真手機。
6. 每個裝備／能力數值與來源在畫面可核對，魔法書智慧 12 與技能智慧 15 分開，未學與直接施法資格界線清楚；觸控、對比、狀態播報、錯誤、重新載入與視覺一致性。真讀屏／真手機／Safari 未測須標示。
7. 既有種族、職業、推導、創角、探索／系統面板、存檔、修復與戰鬥必要回歸。原型未改，舊 N1 不因新 Sheet 通過而寫成已修。
8. 用有意義 mutation 證明數值／來源／完整性守衛會被捕捉：布袍 +2 改 +1、書本智慧 12 改 15、火焰箭變永久已學、技能／法術錯種類放行、未知引用 TEST 回退、缺漏／重複物品、書本引用錯法術或配套錯物品、讀名冊意外改 state。分清實際執行與引用；等價 mutation 判斷需證據，不為追求捕捉率新增玩法。

## 回報與界線

請報 PASS／FAIL、High／Medium／Low 新缺陷與 Info，逐項附 TARGET 完整 SHA、位置、可重現步驟、預期／實際、影響與建議；列完整命令、環境、pass／fail／skip、瀏覽器／尺寸／放大方法、實測／引用／推斷／未測／受阻及證據路徑。若說沒有缺陷，說明檢查範圍與限制，不宣告正式遊玩已通過。

不要修改或 commit／push repository，不替使用者驗收第七切片，不開始配套發放／保存或下一主要階段，不傳給其他 bot。清理本次隔離 server／DB／角色，保留證據與摘要，不碰 5432 或舊證據。


---

## 同切片補修完整複驗要求（尚未送達）

請指定 AI TRPG Architecture Critic 複驗 Phase 33 第七切片同切片補修。Operator：Codex。Repository：https://github.com/bosco8001/ai-trpg；branch：codex/phase27-mobile-ui。
BASE：49f23f9aa6e627012063b8d3cf5d754557d6886e
TARGET：待填：本次限定八檔提交推送後的完整 SHA

先讀 TARGET 的 AGENTS、CANONICAL_MANIFEST、OPEN_QUESTIONS、正式 starter_kits／character_system／classes／magic Canon、PHASE_33_STARTER_KIT_CATALOG.md 的首版外部結果、補修八檔範圍與未測界線。首版 49f23f9 工程 PASS 不當成本次結果，使用者尚未接受第七切片。未提交遠端不得開始本次審查，不回退 BASE 冒稱 TARGET。

只改起始配套 Sheet 滾動／返回列焦點、按鈕同步狀態顏色、三類守衛測試與五份交付狀態文件；正式內容／門檻／API／創角／發放／Run／Save／DB schema／LLM／職業名冊 CSS／原型未改。勿修改、commit、push repo；勿傳其他 bot，勿開始發放或下一階段。

1. 核對完整 BASE／TARGET、遠端 HEAD、祖先及精確八檔；npm ci、npm run build、完整 SHA git diff --check，命令／exit code 分開記錄。
2. 跑五個指定測試：node --import tsx --test tests/starter-kit-catalog.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts；再 npm test，DB 用新隔離 PostgreSQL／角色／DB／非5432連接埠，skip 不算 PASS，保留環境與證據。
3. Info 1 反向驗證：逐個還原「物理技能 kind 不驗證」「kind=item 誤回 kit」「移除 shared complete()」非等價 mutation，證明新增案例均失敗；再原版通過。確認全部正式 ID 跨種類拒絕、空／少／多／重複集合及 HTTP 返回安全404，測試不靠原版跨引用偶然捕捉。前輪其餘 14 個 caught／3 個外部比對等價仍分開記錄，不改玩法為了捕捉等價 mutation。
4. 本次目標 L-1 限起始配套 Sheet：以真 production build 重現 BASE，再測 TARGET 320／375／390／430、568×320／844×390，normal、CSSOM200%、真browser zoom，說明方法。普通高畫面保留分段；短畫面／大字會有一個完整 scroll viewport，header/body/footer 可依序讀取，不再擠成 36–80px 內容條；關閉／返回按鈕及所有數值可捲到，觸控至少44px，無橫向溢出／裁字。測界線前後、放大／旋轉後已有焦點是否可見；Tab／Shift+Tab 留上層，自動焦點捲動不被阻擋，返回四職業定位原列，重開 reset，Esc只關上層回入口。新 size container 不得破壞 facts 的窄寬 container query、安全區或正常高畫面佈局。
5. Info 5：在 busy→成功、busy→失敗、手動重試以及 hover／pressed／focus 逐幀量按鈕前景／背景對比，驗證不再出現1.61混合顏色；不是只量穩定終點，reduced-motion 跟普通都測。
6. 兩份名冊整份成功才顯示、503／錯版／截斷／64KiB超限／慢回應／abort／關閉重開的19類必要回歸；四職業正確書本智慧12／技能15及未永久已學語意，只GET、無儲存或LLM。必要 production state／出生／三槽不變、舊名冊與系統疊層不退化；既有職業名冊 L-1、原型 N1、favicon404、validator結構/數值分工仍保留，不冒稱已修。
7. 文件當前狀態與歷史來源分清：首版完整 SHA、461／461 隔離PG與無DB48skip都是外部報告，Codex未親測仍為真；補修TARGET待填只屬模板，commit內不能自我引用尚未生成SHA，評價狀態以送出prompt/後續紀錄為準。未測真手機／讀屏／Safari／系統字級不可改成通過。

回報工程 PASS／FAIL、High／Medium／Low／Info、完整TARGET、精確位置／重現／預期實際／影響、命令exitcode、pass/fail/skip、實做／引用／推斷／未測／受阻。保留證據路徑並清理本次隔離server／DB／role，不碰5432／舊證據。不替使用者接受第七切片或UI手感／平衡。
