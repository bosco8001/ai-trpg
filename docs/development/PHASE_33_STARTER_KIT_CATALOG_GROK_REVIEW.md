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

## L-4／L-5 捲動來源補修完整複驗要求（已送達；外部工程 FAIL）

2026-10-11 香港時間 00:56:36 經 Grok Bot Control 送交 AI TRPG Architecture Critic 一次，讀回完整新訊息、完整 BASE／TARGET 及空輸入框確認送達。Working 不代表工程通過；以下送達狀態及完整 TARGET 為提交後本地文字補記，尚未另行提交。

請指定AI TRPG Architecture Critic複驗Phase33第七切片L-4／L-5補修。Operator：Codex。
Repository：https://github.com/bosco8001/ai-trpg
Branch：codex/phase27-mobile-ui
BASE：9f2b3e2cc1a1cac9b931dedcbf98a8baa4929397
TARGET：cb76c23788e78dc3e91b230ed42f4e6d2bf60261

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


## cb76c23 複驗結果讀回

2026-10-11 香港時間01:36:16／01:36:22，指定 Critic 回覆工程 **FAIL**，完整 TARGET `cb76c23788e78dc3e91b230ed42f4e6d2bf60261`／BASE `9f2b3e2cc1a1cac9b931dedcbf98a8baa4929397` 與本輪交接一致。L-4／L-5及模擬安全區焦點框已修；新Medium M-1為轉向中途截限造成焦點不可見，新觀察Low L-6為resize後第一個rAF程式捲動被吸回（BASE亦有），Info I-A為停用anchoring後上方details變動使閱讀位置跳動。外部PG461／461不覆蓋UI FAIL。完整重現、矩陣、實做／引用／推斷／未測／受阻及證據來源已記入 [交付文件](PHASE_33_STARTER_KIT_CATALOG.md#cb76c23-外部複驗回報2026-10-11)。Codex只讀回及核對程式，未親測；本段及狀態更新為未提交本地文字紀錄，程式未再修改，尚未準備或送出新複驗。使用者尚未接受第七切片，下一主要切片未開始。


---

## M-1／L-6 來源追蹤補修完整複驗要求（已送達；外部工程 FAIL）

2026-10-11 香港時間02:05:43，取得本次限定八檔commit／push授權後，經Grok Bot Control送交AI TRPG Architecture Critic一次，讀回完整新訊息、兩個完整SHA及空輸入框確認送達。工程結果待回覆；Codex未執行下列驗證命令。限定清單見交付文件；本段送達狀態及完整TARGET為提交後本地文字補記，尚未另行提交。

請AI TRPG Architecture Critic複驗Phase33第七切片M-1／L-6來源追蹤補修。Operator：Codex。
Repository：https://github.com/bosco8001/ai-trpg
Branch：codex/phase27-mobile-ui
BASE：cb76c23788e78dc3e91b230ed42f4e6d2bf60261
TARGET：e49567b6a1f64b53365465e6d59192878e6846fa

先讀TARGET AGENTS／CANONICAL_MANIFEST／OPEN_QUESTIONS、正式starter_kits／character_system／classes／magic Canon、PHASE_33_STARTER_KIT_CATALOG最新cb76c23外部FAIL及八檔補修。前版L-4／L-5／模擬安全區框已修，但新Medium M-1轉向中途截限失焦、Low L-6第一個rAF程式scroll吸回（BASE亦有）、Info I-A閱讀跳動仍open；PG461／461不能蓋UI FAIL。使用者尚未接受第七切片，Codex未親測。只改TSX、新增sheet reading helper與9項未執行控制層測試，加五份交付文；CSS／正式數值／API／server／名冊／創角／發放／配裝／Run／Save／DB／LLM／原型不改。

修法：不用舊scrollTop對最終max反推來源；wheel／pointer／可捲動key先宣告reading，frame/body實例scrollTop／scroll／scrollTo／scrollBy及目前focus實例scrollIntoView呼叫同步記錄位移；不改全域prototype。reading進行時焦點修正讓位；scrollend或250ms無新scroll事件收尾，有pointer未放開則保持。無實際位移保留焦點基準；有位移收尾取消該次pending修正並記當前焦點。focusin重新建基準，native非reading scroll不把原可見anchor改不可見；既有導航重設／nearest包在internal guard，close還原API／清理timer／listener／rAF／observer。不要把此修法或fixture當作已證明，請獨立找漏洞。借用prototype API／非focus後代scrollIntoView／不可配置descriptor有追蹤界線，額外評估實際影響；目前畫面未用，不得假寫全部程式API通過。

1. Git完整SHA／遠端HEAD／祖先及精確八檔核對；npm ci、npm run build、完整SHA git diff --check，命令exitcode。六指定檔：node --import tsx --test tests/starter-catalog-reading.test.ts tests/starter-kit-catalog.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts；再npm test無DB與新隔離PG角色／DB／非5432，skip不當PASS。9fixture只測控制層／API清理，不能代替實際layout。
2. 真production dist＋postgres先重現BASE M-1：844×390→390×620返回／規則summary各5次，568×320→320×568返回5次，追中途scrollTop1405／max先縮後增與事件順序。TARGET原同focus必須AA可見、可容納時完整可見，不重新focus。六尺寸320／375／390／430／568×320／844×390×normal／root200%／真zoom×七停點882矩陣或等效充分；TARGET前輪AA758／882不可重現。重Tab／捲回後轉向、連續5尺寸、body-frame切6次、details＋resize、慢載入改高度必測。
3. L-6：先resize再第一個rAF設scrollTop300各5次，兩種rAF註冊順序、微尺寸844×389／843×390，TARGET不能再被拉1441；同rAF先scroll再resize、resize事件中直接scroll亦保留L-5。script setter／scroll／scrollTo／scrollBy的座標與options overload、smooth開始／途中／結束、目前focus.scrollIntoView、非focus後代與prototype bypass分開記；觀察同步marker先於延後scroll event，0／fractional／max／max−1／無位移／不合法引數／自訂或不可配置descriptor、外部後來覆寫API亦測，不能偷偷改原生語意。
4. wheel／trackpad／touch慣性／scrollbar／Arrow/Page/Home/End/Space，按住／放開／pointercancel／外部pointerup，滾輪邊界無位移、Ctrl-wheel縮放、button／summary Space啟動與Tab不誤判reading；手動捲離後window／visualViewport／轉向／details不能吸回，重新Tab／捲回後reflow仍可見。reading期間或結束恰逢resize、250ms靜默後仍有慣性、scrollend先後或缺失都測；單次timer不得永久抑制／提早收尾，settle不得拉回閱讀位置。無位移操作後轉向不能丟焦點。
5. L-2／L-3／L-4／L-5回歸：normal／CSSOM200%再還原／真zoom字級還原，返回／標題／關閉／物品summary／規則／重讀／職業列，640→620與反向、36rem±1、合法1440→799與中途clamp後max增加；焦點part/full分開、超大控制別報完整。自己的nearest不進reading，第一次open／loading／返回原列的scroll reset也不啟動reading逾時。I-A上方details改變仍open，記是否退化，不自行改規則／CSS。
6. cleanup／隔離：開啟／重開5次各listener／RO／timer／focus instance wrapper與frame/body own descriptor，close全部0／還原；正在wheel/smooth/pointer/rAF/timeout時立即Esc或cancel，空背景不捲／焦點回入口。不可修改Element／HTMLElement prototypes、其他UI節點或其他owner後續wrapper；focus切換還原舊focus、只追新focus。無observer循環、振盪、持續輪詢、page error或額外GET。key／pointer監聽不能攔截遊戲操作。
7. 模擬safe top47／bottom34與0，844×390／620／390×844、normal／大字／真zoom；完整6px焦點框侵入0、inset0原間距、body可讀／無雙扣、44px控制／無橫溢出。前版padding少8px是已知，不以名義值代替rect。Ctrl-wheel/VV不是真pinch；真手機／讀屏／Safari／系統字級／真safe／Android網址列未測保留。
8. 兩名冊完整成功、productionHTTP／主流程／19故障／慢回應取消重開／重試，只GET，出生紀錄／state／三槽／八table md5不變；L-1最小可讀158、按鈕最低對比4.5以上（上輪4.8）、M4b/M4c/M6a及舊UI4尺寸57畫面必要回歸。15caught／3等價t66u、1–3格延遲t68u均引用，職業L-1／原型N1／favicon404／I-1／validator分工與I-A不改通過。
9. 文件前版cb76c23與9f2b3e2 FAIL、完整SHA／來源／實做／引用／推斷／未測／受阻保留。TARGET待填僅提交前模板，實際SHA以送出prompt為準。新控制層fixture的局部全域替代須finally還原，不跨worker或污染其他tests。

回報工程PASS/FAIL與所有新High/Medium/Low/Info；完整TARGET／實際環境版本／逐命令exitcode／pass-fail-skip、位置／重現／預期實際／影響、事件順序與scrollTop／rect／wrapper／listener／timer證據。不能只跑fixture或PG就PASS。不要修改／commit／push repo，不代使用者接受UI／第七切片，不傳其他bot／開下一階段；清理本輪server／DB／role／cluster，5432及舊證據不動，保留證據。


## e49567b 複驗結果讀回

2026-10-11 香港時間03:01:02／03:01:11，指定AI TRPG Architecture Critic回報工程 **FAIL**，完整TARGET `e49567b6a1f64b53365465e6d59192878e6846fa`／BASE `cb76c23788e78dc3e91b230ed42f4e6d2bf60261`與交接一致。M-1／L-6已在外部測過案例修好，AA882／882；新增H-1 High（滾輪／觸控板拉回焦點）、M-2 Medium（Node capture清理fixture固定失敗）、L-7 Low（未追蹤程式捲動後reflow拉回）、L-8 Low（無位移操作250ms內轉向失焦）。build exit0；六指定54pass／1fail、全套無DB419pass／1fail／48skip、隔離PG469pass／1fail，皆exit1。完整重現、Info、實做／引用／推斷／未測／受阻及證據已補記[交付文件](PHASE_33_STARTER_KIT_CATALOG.md#e49567b-外部複驗回報2026-10-11)。Codex只讀回與核對程式，未親測；這次五文件文字補記未提交，沒有修改程式／測試或送新複驗。第七切片尚未接受，下一主要切片未開始。


---

## H-1／M-2／L-7／L-8 補修完整複驗要求（已送達；外部工程 FAIL）

2026-10-11 香港時間03:21:37，取得本輪限定八檔commit／push授權後，經Grok Bot Control送交AI TRPG Architecture Critic一次。讀回完整新訊息、兩個完整SHA與空輸入框確認送達；工程結果待回覆。以下送達狀態及完整TARGET為提交後本地文字補記，尚未另行提交。保留e49567b的外部FAIL，不能以build或882矩陣替代滾輪／測試結果。

請AI TRPG Architecture Critic複驗Phase33第七切片H-1／M-2／L-7／L-8補修。Operator：Codex。
Repository：https://github.com/bosco8001/ai-trpg
Branch：codex/phase27-mobile-ui
BASE：e49567b6a1f64b53365465e6d59192878e6846fa
TARGET：66eb28c16c3e050c87a5802f95b2317cd70253c4

先讀TARGET AGENTS／CANONICAL_MANIFEST／OPEN_QUESTIONS、正式starter_kits／character_system／classes／magic Canon、PHASE_33_STARTER_KIT_CATALOG最新e49567b外部FAIL及八檔補修。只改StarterKitCatalogPanel.tsx、starter-catalog-reading.ts、其test與五文件；沒有CSS／數值／名冊／API／server／創角／發放／配裝／Run／Save／DB／LLM／原型改動。使用者尚未接受第七切片，Codex未親測。前輪M-1／L-6在已測情況已修，AA882／882，但H-1滾輪拉回、M-2單元固定失敗、L-7未追蹤捲動、L-8無位移轉向為工程FAIL；全套PG469pass／1fail，不能寫461／461或470／470。

修法未驗證：從安裝起保存位置／range尺寸，不在beginReading重設位置，passive wheel比較事件到達前最後觀察；resize／RO與兩個有界rAF採樣中途range，已觀察的範圍改變＋舊位置超界＋新位置落max（少於1px誤差）視為clamp，其餘未包裝位移作閱讀回退。實例API包裝仍保留、不改全域prototype；方法呼叫前後同步讀實際位置，own repair/reset保存位置不偽造閱讀。read移動撤銷pending修正，scrollend不因單純閱讀結束排repair；版面仍pending時才收尾重排，保留最後閱讀focus baseline。capture/passive options同物件加入移除。22項受控測試，新增13項未執行，fixture只是Node控制層／非layout。兩幀及250ms仍有時序風險；中途max若完全未觀察、非包裝API與clamp同時落相同位置、zoom原生重定位等必須獨立查，不以fixture或這段算法當證明。

1. 核對完整BASE／TARGET、遠端HEAD、祖先及精確八檔。npm ci、npm run build、完整SHA git diff --check，逐命令exitcode。node --import tsx --test tests/starter-catalog-reading.test.ts tests/starter-kit-catalog.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts；再npm test無DB與新隔離非5432 PG／role／DB，skip不當PASS。Node24 capture object cleanup舊M-2原assert必須通過、不skip不放寬；單檔正反次序各兩次、fixture globals finally還原且不跨worker污染。若測試數增加請回報實際數，不沿用前輪分母。
2. 先重現BASE H-1。真production dist＋postgres，844×390魔術師返回焦點，滑鼠wheel向上與精確trackpad delta，不resize、5格TARGET不能只移3px或彈1440；1280×800 summary後、真zoom640×400、整頁及分段body焦點、focus部分可見／完全不可見各測，BASE/TARGET至少各5次。headless＋Xvfb有頭Chrome，trace必須passive（non-passive可遮缺陷）；捕捉compositor已先移動再wheel／scroll1140／scrollend／下一幀，自己的scrollIntoView不得出現。繼續反向滾、單步及快速連滾、scrollend有／缺，沒有resize時閱讀結束不能排新焦點修正。
3. L-8：底部End5次、ArrowDown10次、無位移setter10次、scrollTo("x")／scrollBy(NaN)各3次、邊界wheel10次，0／一幀／249／250／300ms轉向。BASE先重現，TARGET保留原同focus AA可見，可容納完整可見；不能把resize截限算閱讀。clamp1440→799、中途1405後max長大、body-frame切換、reading先真移動後clamp、有位移又到邊界等都測；pending repair不得永久取消，真正read後resize不拉回。回報每次range／client尺寸／top／focus baseline／readingMoved／pending／timer／rAF先後，不只PASS字樣。
4. L-7：Element.prototype.scrollTo.call、prototype scrollTop setter.call、非focus後代scrollIntoView及不可配置descriptor，先resize、第一個rAF再捲300，各至少3次，兩註冊順序、844×389／843×390；不得拉1441。普通追蹤API、smooth各階段／options overload／this／返回值／throw與第三方後覆寫還原回歸。prototype bypass在穩定尺寸、同幀resize、非clamp位置、新max／max−1／0／fractional及與clamp重合分開報告；不可配置不能沉默當全部支援。頁內搜尋／text fragment／無障礙捲動／autoscroll可做則實測，不可做標未測；不以推斷聲稱已過。
5. M-1／L-6及L-2至L-5全回歸：BASE與TARGET三轉向各5次（844×390→390×620返回／規則、568×320→320×568返回）、六尺寸320／375／390／430／568×320／844×390×normal／root200%／真zoom×七停點882或等效充分。AA882／882須保持、可容納的焦點完整可見，超大控制分列；中途截限發生在全部RO／resize／scroll回調之前也特測，不能測試替身人為給一個已讀到的中間range就假報M-1。連續5resize、Tab／捲回再轉向、body-frame6次、details＋resize／慢載入，36rem±1、640↔620、字級還原。L-6先resize第一rAF sT300兩次序各5次，L-5同rAF先scroll再resize，第三方第一rAF及第二rAF讀取先後。兩個有界rAF延遲、250ms無位移delay與原1–3格引用分清，停定1秒0rAF、無RO循環／振盪。
6. 輸入與close：wheel／trackpad／touchfling／cancel／scrollbar按住resize／窗外pointerup、Arrow/Page/Home/End/Space，Ctrl-wheel縮放與summary/button Space／Tab不誤判；smooth長600ms、缺scrollend／合成提早scrollend、無up/cancel合成pointer及真pointer生命週期分列Info。開關／重開5次，window/dialog各listener及RO／單次timer／兩階段rAF／focus wrapper／frame body own API close全部歸零或還原；在第一／第二幀、wheel／smooth／pointer／timer中Esc，背景不動focus回入口。prototypes與其他UI不改、外部後覆寫API保留、無preventDefault阻擋遊戲操作、額外GET或pageerror。
7. 模擬safe top47／bottom34及0、24組原尺寸／字級／zoom，完整6pxfocus ring侵入0、inset0原間距、至少44px／無雙扣／橫溢出／最小可讀158／對比最低至少4.5（前輪4.8）；CSS未改仍必須回歸。兩名冊、productionHTTP125／主流程20／19故障／慢載入取消重開重試、GET only，出生紀錄／state／三槽／八table md5不變。M4b/M4c/M6a與舊UI4尺寸57畫面；前輪儲存覆蓋背景差異未證實，不當已解決或擅自歸因。
8. 文件保留五歷史SHA、e49567b/cb76c23/9f2b3e2工程FAIL完整SHA、實做／引用／推斷／未測／受阻。I-A上方details跳閱讀位置與職業L-1／原型N1／favicon404／I-1／validator分工仍open。15caught/3等價t66u、1–3格t68u屬引用；真機／讀屏／Safari／系統字級／真safe／Android網址列未測、真pinch／320真視窗受阻不得改PASS。TARGET待填是提交前模板，以送出prompt完整SHA為準。

回報工程PASS/FAIL及全部High/Medium/Low/Info，完整TARGET、實際環境版本、逐命令exitcode／pass-fail-skip、位置／重現／預期實際／影響、事件與rect／range／wrapper／pending／rAF／timer證據。請獨立找退化，不只跑fixture／PG就PASS。不要修改／commit／push repo，不代使用者接受UI／第七切片、不傳其他bot／開始下一階段。清理本輪server／DB／role／cluster，5432及舊證據不動，保留本輪證據。


## 66eb28c 複驗結果讀回

2026-10-11 香港時間05:03:42／05:03:50，指定AI TRPG Architecture Critic回報工程 **FAIL**；TARGET `66eb28c16c3e050c87a5802f95b2317cd70253c4`／BASE `e49567b6a1f64b53365465e6d59192878e6846fa`與交接一致。舊H-1與M-2已修，L-7限已測形態已修；新增High H-2為轉向後焦點消失／M-1復發，TARGET AA714／882、BASE882／882，三轉向TARGET15／15失焦。L-8因無輸入對照也失敗而被H-2遮蔽，不能判定通過。六指定68／68、reading22／22、無DB433pass／0fail／48skip、隔離PG483／483不覆蓋UI FAIL。

完整中斷／作廢重做、實做／引用／推斷／未測／受阻、Info與證據已記入[交付文件](PHASE_33_STARTER_KIT_CATALOG.md#66eb28c-外部複驗回報2026-10-11)。遠端TARGET待填屬提交前模板；完整SHA以送出prompt及本地交接紀錄為準。不將不可配置descriptor回退寫成直接API追蹤，不將CDP搜尋替代視作真搜尋／讀屏通過。Codex只讀回及核對程式，未親測；五文件文字補記未提交，沒有程式／測試修改或新送驗。第七切片未接受，下一主要切片未開始。

## H-2／L-8 Ultra 補修完整複驗要求（尚未提交／送達）

Operator：Codex。指定AI TRPG Architecture Critic；Repository：https://github.com/bosco8001/ai-trpg；branch：codex/phase27-mobile-ui。
BASE：66eb28c16c3e050c87a5802f95b2317cd70253c4
TARGET：待本輪限定八檔commit／push後填入完整SHA

請先核對可讀取遠端完整TARGET，未有版本不得回退BASE作本輪PASS。讀AGENTS、CANONICAL_MANIFEST、OPEN_QUESTIONS、正式starter_kits／character_system／classes／magic Canon，以及PHASE_33_STARTER_KIT_CATALOG.md最新外部FAIL與Ultra補修／能力界線。兩個Ultra代理只有讀碼意見；Codex與代理皆未跑任何驗證。66eb28c的H-1／M-2已修、L-7限定PASS、H-2新增／L-8遮蔽及483／483等，全部是上一版外部結果。

限定八檔：StarterKitCatalogPanel.tsx、starter-catalog-reading.ts、starter-catalog-reading.test.ts，以及PHASE_33_STARTER_KIT_CATALOG.md、對應GROK_REVIEW.md、CANONICAL_MANIFEST.md、IMPLEMENTATION_PLAN.md、OPEN_QUESTIONS.md。本次改來源／採樣分離、無位移不授權閱讀、API限定scroller、兩來源scrollend、返回完成焦點及受控測試；CSS／正式數值／內容／API／創角／發放／Run／Save／DB／LLM／原型未改。不要修改、commit、push repo；不送其他bot／不代使用者驗收或開始下一切片。

1. 核對完整BASE／TARGET、遠端HEAD、祖先及精確八檔；逐項執行npm ci、npm run build、完整SHA git diff --check，列每項命令／exitcode。執行node --import tsx --test tests/starter-catalog-reading.test.ts tests/starter-kit-catalog.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts；再npm test無DB與新隔離非5432 PG／role／DB。skip不當PASS，測試數依本次實際分母。reading globals含performance的finally還原、正反檔案次序各兩次及跨worker污染獨立查；M-2原cleanup assert不得放寬／skip。
2. **先重現H-2，再獨立評L-8**：每案新頁／初始焦點與位置正確，390×844→844×390→390×620返回四職業，BASE應1315／失焦，TARGET須修復；另外兩轉向各5次、六尺寸／三種字級放大／七停點882矩陣或充分等效，本輪BASE66eb28c的外部AA為714／882；882／882是e49567b外部對照，本輪目標恢復AA882／882，可容納focus完整可見，超大控制分列。必須測完全沒讀到中途maximum、scroll早於／晚於resize、body→frame、內容長大／字級還原、慢回應與連續5轉向。不要只跑人造中途range fixture就宣告H-2。原生scroll第三幀以後／250ms以後才送且沒有新RO也獨立測；本次兩幀不是全部時序保證，缺陷照報。
3. L-8完整對照×End／ArrowDown／同值setter／scrollTo("x")／scrollBy(NaN)／邊界wheel，0／1frame／249／250／300ms，BASE與TARGET各重複。無輸入對照要先通過才能關閉遮蔽。noop前後及未知clamp→新邊界noop的順序都測；新noop不能沿用舊可動來源／smooth。記錄top、max、client尺寸、focus rect、候選方向／種類、readingMoved、pending、timer及rAF；不能把截限算閱讀或只報收尾timer0。
4. **H-1不可退化**：真production＋PG，headless及Xvfb有頭Chrome，passive trace（non-passive可遮缺陷），844×390返回焦點向上wheel／trackpad、反向、單步／連滾／scrollend缺失及600ms smooth；BASE／TARGET每案至少5次。compositor先移動→wheel→scroll、compositor→第一rAF sample→wheel→scroll、wheel→sample→scroll及body noop夾在frame compositor／wheel之間都查。0／fractional／max邊界獨立分列；回讀快取在新邊界已不可動時會拒絕，真正wheel已到邊界且先被採樣可能受限，須報真實結果。一般高畫面body與短畫面frame、focus部分可見／完全不可見，閱讀結束沒有resize不能排nearest或拉回。
5. API與L-7務必獨立：wrapped setter／scroll／scrollTo／scrollBy同步0／300／300.5在resize前、同task、第一／第二rAF各註冊順序，以及options／this／return／throw／apply內dispose／第三方後覆寫。兩個scroller獨立smooth先後、另一方noop／scrollend、反向touch lastY／水平pointer不認領、scrollbar按住resize／窗外up／cancel，舊清理回歸。本次延後候選僅明確data smooth＋有限data top的scroller方法；focused SIV的同步前後會記錄，延後SIV／CSS auto smooth／getter／繼承／Proxy／超250ms／跨版面並無完整保證，全部可做則實測並報限制／缺陷，不能因文件明示就免評價。descriptor probe可能被Proxy觀察，不能冒稱完全零副作用。
6. **L-7能力縮限不是已修**：prototype方法／setter、非focus SIV、不可配置descriptor、text fragment／Chrome find／a11y捲動，穩定尺寸及resize第一／第二rAF至少各3次，0／300／300.5／max−1／max及與clamp同位分開；對照66eb28c已測PASS形態。未知位移不再有閱讀優先權，reflow可能被nearest拉回。原四項fixture改為此契約，不能當它們舊需求仍通過；請明確列出退化嚴重度，H-2優先不等於使用者已接受L-7限制。穩定尺寸本次不因unknown scroll主動排nearest，亦需驗證。已知wheel相符的250ms回讀不是未知來源的全面因果證明。
7. M-1／L-2至L-6及安全區全部必要回歸，兩有界rAF／單次timer、停定1秒0活動、不振盪；focus導航／內部返回完成、Tab／ShiftTab／summary/button Space／Ctrl-wheel／touch／Esc第一第二frame／wheel／smooth／pointer期間關閉。5次重開無累積，RO／refs／local wrappers／listener／rAF／timer歸零或還原，同options清理不改全域prototype。模擬safe top47／bottom34及0的24組、6pxfocus ring侵入0、至少44px、無橫溢出／對比至少4.5，真機限制分列。
8. 兩名冊production HTTP125／主流程20／19故障、慢載入／取消／重開／重試、GET only；出生／state／三槽／八table md5、舊UI57畫面與M4b／M4c／M6a必要回歸。I-A／職業L-1／原型N1／favicon404／I-1／validator仍open；t66u15caught／3等價、t68u1–3frame只作引用，未重做不得改成新結果。文件歷史SHA／實做／引用／推斷／未測／受阻與前版中斷作廢資料保留，TARGET待填是提交前模板，以實際送出完整SHA為準。

請回報工程PASS／FAIL、全部High／Medium／Low／Info、TARGET完整SHA、環境版本、逐命令exitcode及pass／fail／skip、位置／重現／預期實際／影響，附rect／range／來源／pending／rAF／timer證據。真手機、讀屏、Safari、系統字級、真safe、Android網址列、Chrome搜尋與真Ctrl-wheel未做請列未測；真pinch／320真視窗不能做列受阻。清理本輪隔離server／DB／role／cluster，不碰5432或舊證據，保留本輪證據與摘要。不代使用者接受第七切片或特殊能力縮限。尚未送達不得寫成已送驗。

## 1435b2c 複驗送達紀錄

使用者授權限定八檔 commit／push 並複驗後，Codex 已提交及推送 TARGET `1435b2ca15f232edee1a8d9ffd8aa7f23a823336`，BASE `66eb28c16c3e050c87a5802f95b2317cd70253c4`，分支 `codex/phase27-mobile-ui`。提交正好八檔，加 670 行、刪 84 行；遠端 HEAD 與本地完整 SHA 一致，未納入其他既有修改。

香港時間 2026-10-11 15:02:22，透過 Grok Bot Control 送達當次介面確認的 **AI TRPG Architecture Critic**。送出前完整 4514 字元草稿一致，送出後已讀回新訊息、完整版本與複驗要求及空白輸入框；單次送出紀錄已確認，沒有重複送出。介面刷新警告未當成成功證據。

已送 prompt 將上方 TARGET 待填替換為實際完整 SHA，並附精確八檔及已獲授權、已推送狀態。提交內準備段落的未授權／未提交／未送達是當時狀態，不是現況。本節為本地交接補記，尚未另外提交或推送。

沒有由 Codex 或代理執行專案驗證；外部工程回報仍待讀回，不宣告本輪 PASS。L-7 及時序限制仍待評估，第七切片及下一主要切片的使用者驗收界線不變。


## 1435b2c 複驗結果讀回

2026-10-11 香港時間 15:41:52／15:41:55／15:41:57／15:42:01，指定 AI TRPG Architecture Critic 回報 t73u 外部工程 **FAIL**。TARGET `1435b2ca15f232edee1a8d9ffd8aa7f23a823336`／BASE `66eb28c16c3e050c87a5802f95b2317cd70253c4` 與交接一致；八檔及遠端版本已由外部核對。

H-2、L-8 在本輪已測案例修好，TARGET AA 882／882、AAA 864；BASE 本輪 AA 730／882，保留上一輪 714／882 作獨立歷史結果。新增 F1 Medium：同幀 reflow 清除已知輸入的閱讀狀態，Home／PageUp 等 smooth 被 nearest 打斷；F2 Medium：prototype／非焦點 SIV／CDP／text fragment 等來源在 reflow 時被拉回，屬 L-7 實測退化，沒有使用者接受縮限。

六檔無 DB／PG 各 109／109；全套無 DB 474 pass／0 fail／48 skip（522 項），隔離 PG 524／524；reading 63／63、兩檔正反序各兩次 71／71。外部列出命令 exit 0 不代替 UI FAIL。未完成：舊 UI 僅 53／57 畫面、H-2 case M 作廢、雙 scroller smooth／touch 反向／resize 中按住 scrollbar 未跑真頁面。內部 reading 欄位讀取受阻，不宣稱直接驗證全部內部狀態。真機／讀屏／Safari 等限制保留。

完整缺陷位置、重現、實做／引用／推斷／未測／受阻及證據清理見[本輪交付紀錄](PHASE_33_STARTER_KIT_CATALOG.md#1435b2c-外部複驗回報2026-10-11)。Codex 只讀回及核對程式，沒有親測或獨立下載外部證據。這次五文件文字補記未提交，未改程式或新送驗。F1／F2 待同切片補修，工程 FAIL，第七切片未接受，下一主要切片未開始。

## F1／F2 第二段實作交接，尚未送驗

使用者已確認 A：允許本 Sheet 限定焦點／閱讀結構調整。本地補丁保留有效輸入生命週期，並以原生 manual popover 暫留同一實際焦點節點，reflow 不再 nearest 拉回閱讀位置。未知仍未知；明確導頁維持原行為。六個程式／測試檔與五份文件的完整十一檔清單、決策、未執行測試、限制及定向真頁面要求見[第二段交接](PHASE_33_STARTER_KIT_CATALOG.md#f1f2-三段補修第二段實作交接2026-10-11)。既有完整驗證要求仍適用，不以新增 fixture 取代真頁面。

本輪 BASE 為 `1435b2ca15f232edee1a8d9ffd8aa7f23a823336`；TARGET 待第三段限定提交／推送後填完整 SHA。目前未提交、未推送、未送達；沒有新 commit／push 授權，也沒有由 Codex 執行工程驗證。t73u 外部工程 FAIL 保留；新補丁尚待驗證及使用者接受。前文「未改程式」是當時外部報告補記的狀態。

依使用者三段安排，等 effort 切換為 high 及「已切換，繼續」後才準備完整新 prompt、核對授權與可讀版本、送達指定 AI TRPG Architecture Critic。定向案例先驗 H-2、F1、F2、L-8、一般閱讀及清理，再完成 Phase Spec／本文件既有必要全回歸。PASS 僅整理工程結果與手動核對；FAIL 僅整理分類、證據及範圍，停止並提醒回 ultra。

## F1／F2 第三段完整複驗 prompt（準備中，未送達）

使用者已回覆「已切換，繼續」，第三段交接已開始。本段只準備工程交接，不新增程式補丁。使用者其後已明確回覆「授權」，同意本輪限定十一檔 commit／push 並複驗；前次八檔授權沒有自行延伸。提交前 HEAD／分支未變。下列 TARGET 是待填模板，取得遠端可讀完整版本後才可送出；不是已送驗紀錄。提交指令見 PHASE_33_STARTER_KIT_CATALOG.md 第三段段落，提交／推送及送達另行補記。

```text
請 AI TRPG Architecture Critic 做 Phase 33 第七切片 F1／F2 補修的工程複驗。開發／交接方為 Codex；工程 PASS 不代替使用者驗收。這仍是同一切片，不開始下一主要切片。

Repository：https://github.com/bosco8001/ai-trpg
分支：codex/phase27-mobile-ui
BASE：1435b2ca15f232edee1a8d9ffd8aa7f23a823336
TARGET：__待限定提交並推送後填入完整SHA__

先核對完整 BASE／TARGET、遠端 HEAD、祖先及精確十一檔。未取得可讀 TARGET 不得回退 BASE 或用舊 PASS 作本輪結果。讀 TARGET 的 AGENTS.md、docs/development/CANONICAL_MANIFEST.md、OPEN_QUESTIONS.md、PHASE_33_STARTER_KIT_CATALOG.md 第二段交接／最新 t73u 外部報告，以及正式 docs/gameplay/starter_kits.md、character_system.md、classes.md、magic.md；沿用本 Phase Spec 和 GROK_REVIEW 必要全回歸，本 prompt 取代舊八檔 prompt 的版本、範圍和已作廢的預期，不刪除必要驗證。

精確十一檔：
src/web/StarterKitCatalogPanel.tsx
src/web/starter-catalog-reading.ts
src/web/starter-catalog-focus-dock.ts（新增）
src/web/starter-kit-catalog.css
tests/starter-catalog-reading.test.ts
tests/starter-catalog-focus-dock.test.ts（新增）
docs/development/PHASE_33_STARTER_KIT_CATALOG.md
docs/development/PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md
docs/development/CANONICAL_MANIFEST.md
docs/development/IMPLEMENTATION_PLAN.md
docs/development/OPEN_QUESTIONS.md

t73u 對上述 BASE 的外部工程結論為 FAIL：H-2／L-8 已測案例修好，F1 Medium 為同幀 reflow 清除已知輸入、nearest 打斷 Home／PageUp／wheel；F2 Medium 為未知／繞過包裝的捲動遇 reflow 被拉回，屬 L-7 退化。舊 AA882／882、AAA864、全套 PG524／524 不能代替本輪結果。直接重用你的 /workspace/p33y-evidence/ 真頁面腳本與 trace；不要重貼完整歷史，分清已實測與推斷。

本次 F1 保留有效輸入生命週期及原截止時間，版面／截限位移不取得閱讀權限；F2 經使用者確認 A，允許本 Sheet 限定結構調整：同一實際焦點節點以 manual popover 暫留可見操作區，DOM 父節點不變，沒有克隆／假焦點；reflow 不再 nearest 拉回閱讀視窗。未知仍未知，導頁重設維持原行為。未改 Canon、正式數值、API、保存、DB、發放、戰鬥或其他畫面。Codex 未自行執行 build／typecheck／lint／格式／靜態分析／任何測試或瀏覽器驗證。新增 fixture 只描述狀態、幾何與 DOM 擁有權，不是原生瀏覽器證明。

先以隔離 TARGET／BASE 準備真 production 頁面，列 npm ci、npm run build 等每條命令及 exit code；先跑下列定向真頁面案例，再依結果完成必要完整回歸。每案正確初始化、重複與 trace，受信任鍵盤、合成 wheel、CDP 代用來源分列。不得只看 fixture 或 PG 綠燈就 PASS。

1. H-2：無玩家操作 390×844→844×390→390×620 返回四職業、另外兩種轉向、連續五轉向、完全沒讀到中途 maximum、scroll 早／晚於 resize、body→frame、字級還原及內容長大；第一／第二 rAF 阻塞 300ms、事先阻塞 600ms，以及第三幀／250ms 以後 late scroll 沒有新 RO。重用 t73u 每案新頁 N=5；case M 若仍不能有效停妥列作廢，不當 PASS。原本可見的實際焦點不完全消失。
2. F1：重用受信任 CDP Home，390×844→844×390，Home 同幀微 resize 至 844×389；前版三次停 269／286／272，BASE66eb28c到0。另 PageUp、六次 ArrowUp、無 resize 對照。wheel 的 compositor→第一 rAF sample→wheel→scroll、wheel→sample→scroll，headless／有頭各 N=5，前版 1340→1441。核對 smooth 未被焦點修正或 popover 開合打斷，scroll 位置／事件與原 timer 期限；不能以無 nearest 呼叫但仍跳位置當修好。真裝置未測就標未測，不把合成 wheel 當真輸入。
3. F2：prototype scrollTo／scrollTop setter、非焦點 SIV、CDP DOM.scrollIntoViewIfNeeded、text fragment #:~:text=普通木杖、不可配置 own descriptor、第三方第一／第二 rAF。穩定尺寸及 reflow 各 N=3，0／300／300.5／max−1／max、與 clamp 同位、兩個 rAF 註冊順序分列；對照 t73u 40／40 拉回與24／24舊版保持的真頁面證據。未知仍不得冒充已知閱讀，搜尋／輔助工具／第三方閱讀位置不被無故拉回。CDP、text fragment 不等於真讀屏或 Chrome 搜尋列。
4. L-8：七類輸入、End／ArrowDown／同值 setter／scrollTo("x")／scrollBy(NaN)／邊界 wheel，0／1frame／249／250／300ms；無輸入對照先驗，noop 前後、未知 clamp→新邊界 noop、新命令取代舊可動來源、已結束輸入不保護後來 API。至少沿用 t73u N=2；不得靠虛假閱讀權限或放寬斷言掩蓋失焦。
5. 新操作層：標題、關閉、職業列、summary、返回、重讀的實際 activeElement、節點 identity、DOM 父節點、原事件／可及名稱與焦點環；summary 的 Enter／Space／點擊及 details 開合、Tab／Shift+Tab、ARIA disabled／載入狀態。popover show/hide、取消、例外、第三方屬性／樣式覆寫、焦點轉移／restore、來源佔位、字級換行、短畫面、雙 scroller、模擬安全區與超大控制項。檢查讀取視窗沒有原生 clamp／焦點自動捲動退化、遮擋不造成文字或操作不可達；不只驗 JS 沒寫 scrollTop。popover 不支援／空範圍回退如有缺陷照報，不因文件列限制而免評。
6. 一般閱讀／清理：原 H-1 passive trace 的 wheel／trackpad、單步／連滾／反向、缺 scrollend、600ms smooth、body noop 夾入、0／fractional／max、部分／完全不可見焦點，高畫面 body／短畫面 frame。Wrapped setter／scroll／scrollTo／scrollBy、options／this／return／throw／getter／繼承／Proxy／apply 中 dispose／第三方覆寫保持；延後 SIV／CSS auto smooth／跨版面／超250ms仍獨立評價。雙 scroller smooth、touch 反向、水平 pointer、resize 按住 scrollbar／窗外 up／cancel 須補真頁面，不能以 harness 引用代替。Esc 第一／第二 rAF、wheel／smooth／pointer／timer 中關閉、五次重開：不殘留 popover／class／屬性／樣式／佔位／RO／refs／wrapper／listener／rAF／timer，不改全域 prototype；停定一秒活動歸零，不振盪。

定向後完成必要全回歸，保留所有有效舊需求／斷言，不 skip 取綠燈：
（a）六尺寸／三種字級／七停點原882矩陣或充分等效，AA／AAA、超大與部分可見分開；M-1／L-2至L-6回歸。模擬 safe top47／bottom34及0的24組，完整6px焦點環侵入0、至少44px、無橫溢出、對比至少4.5，minimum body可讀與視覺一致性。CSS／top layer 改了必須重驗，舊4.8不冒充本輪。
（b）完整 SHA git diff --check BASE TARGET；node --import tsx --test tests/starter-catalog-reading.test.ts tests/starter-catalog-focus-dock.test.ts tests/starter-kit-catalog.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts；npm test 無 DB及新隔離非5432 PG／role／DB，逐命令exit／pass／fail／skip，skip不當PASS。兩份 fixture globals／finally／worker 污染及 reading＋focus-dock＋starter-kit 正反序各兩次；M-2 cleanup 斷言與舊測試不放寬。本次只是新增案例，歷史四個 fixture 改契約不能當舊 L-7 需求通過。
（c）兩名冊 production HTTP125／主流程20／故障19、慢載入取消重開重試、GET only；出生紀錄／state／三槽／八表 md5、不修改資料。舊UI四尺寸57畫面與 M4b／M4c／M6a必要回歸。前輪取消備份四頁timeout、只53／57未完成須補驗或仍列未完成。I-A／職業L-1／原型N1／favicon404／I-1／validator保留；t66u15caught／3等價、t68u1–3frame未重做只作引用。若已同版完成且有效可引用、不無故重跑，但新補丁影響的項目必須重驗。

回報外部工程 PASS／FAIL、完整 TARGET／BASE與環境版本；全部 High／Medium／Low／Info、精確位置、重現、預期／實際、影響與最小受影響範圍。附逐命令exit code／分母與pass-fail-skip，rect／range／來源／rAF／timer／popover／focus事件證據；內部欄位不可讀就列受阻，passive trace不是直接內部狀態證明。分列實做、引用、推斷、未測、受阻、作廢；真手機／讀屏／Safari／系統字級／真safe／Android網址列／Chrome搜尋／真Ctrl-wheel未做列未測，真pinch／真320視窗受阻不改PASS。保留本輪證據與摘要，清理本輪隔離server／DB／role／cluster，不碰5432或舊證據。

不要修改或 commit／push repository，不傳其他 bot、不代使用者接受第七切片、不開始下一主要階段。FAIL 時請只整理失敗分類、證據和受影響範圍；Codex 會停止，等使用者切回 ultra 再分析。PASS 時才整理簡短手動核對清單，仍待使用者接受。
```
