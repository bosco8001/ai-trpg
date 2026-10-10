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

## 同切片補修完整複驗要求（已送達，待結果）

2026-10-10 香港時間 22:23:43 已送指定 Critic 並讀回確認；補修完整 TARGET 與本段送達狀態為提交後補入本地文字，尚未另行提交。

請指定 AI TRPG Architecture Critic 複驗 Phase 33 第七切片同切片補修。Operator：Codex。Repository：https://github.com/bosco8001/ai-trpg；branch：codex/phase27-mobile-ui。
BASE：49f23f9aa6e627012063b8d3cf5d754557d6886e
TARGET：16c322c78075cd4097145aa36ecb2a9fa0185bf0

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


---

## L-2 焦點補修完整複驗要求（已送達；外部結果見交付紀錄）

2026-10-10 香港時間 22:56:14 已透過 Grok Bot Control 送指定 Critic 一次並讀回確認送達。完整 TARGET 與本段送達狀態為提交後補入的本地文字，尚未另行提交。

請指定 AI TRPG Architecture Critic 複驗 Phase33第七切片L-2補修。Operator：Codex。
Repository：https://github.com/bosco8001/ai-trpg
Branch：codex/phase27-mobile-ui
BASE：16c322c78075cd4097145aa36ecb2a9fa0185bf0
TARGET：6436313ddc979d7518ffcf7f2c60f70dfd3952a8

先讀TARGET的AGENTS／MANIFEST／OPEN_QUESTIONS、starter_kits／character_system／classes／magic Canon及PHASE_33_STARTER_KIT_CATALOG的歷史／最新回報／六檔補修範圍。前版工程PASS含新增L-2，不當成本次結果；使用者尚未接受第七切片。只改起始配套dialog resize時既有焦點可見性及五份交付文，不改CSS／數值／來源／API／創角／發放／Run／Save／DB／LLM／原型／職業名冊外殼；Codex未親測。

補修：open期間ResizeObserver觀察dialog/frame/body/header/footer，window及visualViewport resize合併rAF；只當目前activeElement仍在dialog內且超出實際scroll viewport，instant scrollIntoView nearest，不focus別的元件／重載／重設一般scrollTop。關閉解除observer、resize listener、取消排程。

1. 核對遠端HEAD完整SHA、祖先及精確六檔；npm ci／npm run build／完整BASE TARGET的git diff --check記exitcode。跑五指定檔 node --import tsx --test tests/starter-kit-catalog.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts，再npm test；DB用全新隔離role/DB/叢集非5432，skip不算PASS。
2. 真production dist＋postgres先重現BASE L-2：390×844魔術師頁Tab到返回四職業→844×390，以及高640→620；量activeElement同viewport矩形、scrollTop。TARGET相同步驟應不換焦點卻回可見，反向切回亦正常。測36rem邊界±1px、6尺寸320/375/390/430及568×320/844×390，normal／CSSOM200%／真zoom分開記方法。
3. 已有焦點分別停在標題／關閉／物品summary／規則summary／返回／重讀，跨尺寸／轉向／字級後仍可見（巨大元件需分AA部分可見與AAA完整），按Tab／Shift+Tab、Esc／返回原列／重開都正常。安全區模擬另標。窗口resize與visualViewport resize均有結果證據，不以只檢查observer接線代替UI。跨佈局後首次位置讀取應在reflow後；不產生觀察器循環／滾動震盪。
4. 手動捲動閱讀時不發生持續吸回；焦點在dialog外或關閉時不操作；關閉前已排rAF/resize→焦點回入口後不能拉動探索／系統抽屜，重開不得重複listener。交錯選職業／返回、載入成功／失敗／19類故障及取消仍正確，只GET、沒有重載或mutation，state／出生／三槽不變。
5. 前版L-1已修、按鈕逐幀對比最低4.8、kind／resolve／complete三類新增測試守衛做必要回歸。15個caught與3個等價mutation來源依前輪更正，不延用14誤算。職業名冊L-1、原型N1、favicon404、Chrome運行時root字級queryInfo保留，不冒稱已修；未測真裝置／讀屏／Safari／系統字級仍明列。
6. 狀態文件保留49f23f9／16c322c完整SHA、各自外部PG461／461及無DB48skip。送出prompt是實際TARGET，提交時待填只是模板；新結果不由Codex執行，不替使用者驗收。

回報PASS/FAIL、所有新High/Medium/Low/Info，完整TARGET、精確位置、重現步驟／預期實際／影響、各命令exitcode、pass/fail/skip、實做／引用／推斷／未測／受阻、證據路徑。不修改或commit/push repo，不代使用者批准UI／平衡／第七切片，不傳其他bot或開始下一主要階段；清理本次隔離server／DB／role，保留證據，不碰5432／舊證據。


---

## L-3 閱讀位置與安全區補修完整複驗要求（已送達；外部 FAIL 見交付紀錄）

2026-10-11 香港時間 00:02:14 已透過 Grok Bot Control 送指定 Critic 一次，讀回完整新 outgoing 及空 composer，確認送達。完整 TARGET 與本段狀態為提交後補入的本地文字，尚未另行提交。

請指定 AI TRPG Architecture Critic 複驗Phase33第七切片同切片L-3補修。Operator：Codex。
Repository：https://github.com/bosco8001/ai-trpg
Branch：codex/phase27-mobile-ui
BASE：6436313ddc979d7518ffcf7f2c60f70dfd3952a8
TARGET：9f2b3e2cc1a1cac9b931dedcbf98a8baa4929397

先讀TARGET的AGENTS／CANONICAL_MANIFEST／OPEN_QUESTIONS、正式starter_kits／character_system／classes／magic Canon及PHASE_33_STARTER_KIT_CATALOG中的最新外部結果與限定七檔範圍。6436313外部工程PASS、L-2已修，但新增L-3與模擬安全區Info；使用者尚未接受第七切片，前版結果不當本次PASS。只改起始配套TSX焦點可見性記錄／scroll處理與CSS底部scroll-padding，加五份交付文；不改名冊數值／server／shared／API／創角／發放／配裝／Run／Save／DB／LLM／原型／職業名冊外殼。Codex未親測，沒有新增自動化測試，以下交由指定bot執行。

補修使用focusin及frame/body scroll記錄同一activeElement的可見性與viewport幾何；scroll區域或幾何改變時不把它當閱讀移動。observer／window／visualViewport resize合併rAF，只維持變動前仍可見的焦點，手動捲離則不吸回；處理後更新基準，不重新focus／讀資料。close清除所有新舊listener及rAF。whole-frame scroll-padding-bottom加入env底部，焦點幾何採實際scroll-padding。

1. 核對完整BASE／TARGET、遠端HEAD、祖先及精確七檔。執行npm ci、npm run build、完整SHA的git diff --check，列命令／exitcode。五指定檔：node --import tsx --test tests/starter-kit-catalog.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts；再npm test，新隔離PG／角色／DB／非5432叢集。無DB略過不可當PASS。
2. 真production dist＋postgres先重現BASE L-3：390×844魔術師頁將焦點停返回，轉入whole-frame模式，wheel／scrollbar／touch及程式scroll捲走焦點；改window1px、僅visualViewport resize、轉向、details程式展開收起。TARGET應保留選擇的閱讀位置，不呼叫scrollIntoView、不額外GET；版面收縮造成合法scrollTop截限與捲動錨定另記，不誤判成吸回。捲動當下、慣性期間、完成後再resize都測，記焦點／viewport矩形與scrollTop、scrollIntoView次數，不只等兩秒。另測手動捲後立刻同一格resize／details，確認事件順序不丟閱讀意圖。
3. L-2必須維持：從可見的返回／標題／關閉／物品summary／規則summary／重讀／職業列，390×844→844×390、640→620及反向、36rem界線±1px、6尺寸normal／CSSOM200%／真zoom的882焦點矩陣或等效充分覆蓋。說明縮放方法，AA部分／AAA完整分開；包含observer引起scroll先於resize callback、body↔frame切換、多次連續尺寸改變及載入改高度，不能靠把焦點追蹤全停用來修L-3。焦點重新Tab到另一元素／重新捲回可見後，下一次reflow仍應維持可見。
4. 安全區：模擬top47／bottom34與0，轉844×390／620高度、normal／大字／真zoom，量返回rect底部與安全區邊界、實際computed scroll-padding，修正前17px侵入應消失，焦點環亦可辨認。不雙扣安全區而浪費body、不改職業名冊。安全區模擬不能冒稱真機；visualViewport單獨resize與真正pinch分開，headless不支援時標受阻。
5. 關閉前排rAF／scroll／resize再Esc，入口焦點及背景scroll保持；focusin／scroll／observer／window／visualViewport清理且重開5次不累積。Tab／Shift+Tab trap、返回原列、重開reset、手動自由捲、焦點在dialog外／關閉時無動作、不循環／震盪／page error。載入／成功／失敗／19類故障、慢回應關閉重開／重試，兩名冊完整才顯示，只有GET，production出生／state／三槽／DB table不變。
6. L-1可讀區域、按鈕逐幀對比至少4.5（上輪最低4.8）、M4b/M4c/M6a拒絕守衛、四職業內容及其他UI做必要回歸。15caught／3等價只按實際重測或t66u引用標示。reflow延遲約1–3格Info、既有職業L-1／原型N1／favicon404／運行時root字級queryInfo、validator結構／數值分工及真機／讀屏／Safari／系統字級未測保持來源；本次改底部間距亦要看有無新回歸。
7. 文件保留首版49f23f9、16c322c、6436313完整SHA、各自外部工程PASS含Low、PG461／461與無DB48skip，不將新補修標通過，不代使用者驗收。TARGET待填為提交前模板，實際版本以送出prompt完整SHA為準。

回報工程PASS/FAIL與全部新High/Medium/Low/Info，完整TARGET、位置／重現／預期實際／影響、命令exitcode、環境、pass/fail/skip、實做／引用／推斷／未測／受阻、證據路徑。勿修改／commit／push repo，不替使用者驗收UI／平衡／第七切片，不傳其他bot或開始下一主要階段。清理本次隔離server／DB／role，保留證據，5432／舊證據不動。


---

## L-4／L-5 捲動來源補修完整複驗要求（尚未送達）

請指定AI TRPG Architecture Critic複驗Phase33第七切片L-4／L-5補修。Operator：Codex。
Repository：https://github.com/bosco8001/ai-trpg
Branch：codex/phase27-mobile-ui
BASE：9f2b3e2cc1a1cac9b931dedcbf98a8baa4929397
TARGET：待填：本次限定七檔提交推送後完整 SHA

先讀TARGET AGENTS／CANONICAL_MANIFEST／OPEN_QUESTIONS、正式starter_kits／character_system／classes／magic Canon、PHASE_33_STARTER_KIT_CATALOG最新9f2b3e2工程FAIL與七檔補修範圍。前版L-3一般案例已修、L-4字級還原失焦／L-5同幀scroll-resize吸回尚未解決；全套PG461／461不能蓋過UI FAIL。使用者尚未接受第七切片，Codex未親測，沒有新增自動化測試。只改起始配套TSX／CSS及五份交付文；數值／API／名冊／創角／發放／Run／Save／DB／LLM／原型／職業名冊不改。

工程選擇：只在starter frame/body停用overflow-anchor，避免原生錨定與焦點捲動互相干擾。scroll處理不再靠viewport幾何判斷；記scrollTop，若舊位置超出新scrollHeight-clientHeight且已落到最大值（小於1px取整誤差）才保留reflow前基準，其餘scroll含同幀resize都更新當前可見性。focusin、resize合併rAF、同一原可見焦點nearest、close清理保留。footer真實底部padding取原間距與safe-bottom＋8px較大值，給6px焦點框餘量，inset0保留原間距；safe scroll-padding仍保留。這不是已驗證算法，請獨立找退化，不只量名義值。

1. 核對完整BASE／TARGET、遠端HEAD、祖先及精確七檔。npm ci、npm run build、完整SHA git diff --check，記命令exitcode。五指定檔 node --import tsx --test tests/starter-kit-catalog.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts；再npm test，新隔離PG／role／DB／非5432，skip不能當PASS。
2. 真production dist＋postgres重現BASE L-4：568×320正常、真zoom844×390，規則summary／職業列焦點，CSSOM root200%再還原，5次；TARGET同樣檢查並跑六尺寸320／375／390／430及568×320／844×390，normal／CSSOM200%／真zoom、七停點882矩陣或等效充分覆蓋。BASE AA867／882的15失敗不可在TARGET重現；焦點同一且AA部分／完整可見分開，超大元件別假報完整。量rect／viewport／scrollTop及事件順序，實測overflow-anchor生效，不只讀CSS。
3. L-5：同rAF先scrollTop300再window844×389／843×390，各5次，再反向順序、scrollTo/smooth途中、wheel同幀／一格、觸控慣性／scrollbar、只visualViewport、details切換；TARGET不吸回、不scrollIntoView／額外GET。scroll事件與resize回調交錯、連續微尺寸變化及同幀多次scroll都測；程式scroll仍是受支持的閱讀移動，不能只靠有wheel標記才放行。方法與受阻分開記。
4. L-3一般案例與L-2其他案例都保留：可見返回／標題／關閉／物品summary／規則／重讀／職業列轉向、640→620及反向、36rem±1px、body-frame切6次、連續尺寸5次／載入高度／details；手動捲離後再resize不吸回，重新Tab或捲回後再reflow焦點可見。停用錨定後新增的details展開收起、內容高度改變、讀到中段／尾段再縮字、焦點在附近或遠處都核對閱讀位置與可預期性。
5. 專測clamp：舊scrollTop1440→新max799等resize／字級還原及content收縮，確認合法截限不讓L-2失焦；同時手動scroll剛好到新max／新max−1／0、舊viewport換成body或frame、fractional scroll／真zoom／huge字體，避免將真閱讀移動錯判clamp而又吸回。不出現observer循環／震盪／page error／持續輪詢。
6. 安全區模擬top47／bottom34及0，844×390／620高度、normal／CSSOM200%／真zoom；量返回按鈕與完整焦點環（3px outline＋3px offset）到安全區邊界，前輪約5px侵入應消失，scroll到底也可見。footer真實捲動餘量、inset0舊間距、frame／body可讀高度、無雙扣／遮住內容／橫向溢出／44px控制。CDP不是真安全區，pinch、網址列、真手機未做必須保留未測／受阻。
7. Tab／Shift+Tab留上層、返回原列、重開reset、Esc焦點回入口；所有observer／focusin／scroll／window／visualViewport關閉清零、重開5次不累積，排rAF與scroll立即關閉不動背景。兩名冊完整成功、19故障／慢回應取消重開／重試，只GET且production出生／state／三槽／DB table md5不變。
8. 配套L-1可讀區、按鈕逐幀contrast至少4.5（上輪4.8）、M4b/M4c/M6a守衛、四職業內容與舊UI四尺寸57畫面必要回歸。15caught／3等價引用t66u、1–3格延遲引用t68u；職業L-1／原型N1／favicon404／I-1／validator分工及真機／讀屏／Safari／系統字級未測不改標通過。文件保留各輪完整SHA／來源／9f2b3e2 FAIL／Low與PG結果，TARGET待填僅提交前模板，實際SHA以送出prompt為準。

報工程PASS/FAIL、全部新High/Medium/Low/Info、完整TARGET、位置／重現／預期實際／影響、命令exitcode、環境、pass/fail/skip、實做／引用／推斷／未測／受阻與證據路徑。不要修改或commit/push repo，不替使用者驗收第七切片／UI／平衡，不傳其他bot或開下一階段；清理本輪隔離server／DB／role，保留證據，5432與舊證據不動。
