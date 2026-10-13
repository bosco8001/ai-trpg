# Phase 33 第七切片：t78u 後第二段實作交接

日期：2026-10-13（Asia/Hong_Kong）。使用者確認第一段 **A：限定補修**，其後回覆「已切換，繼續」。本段依[第一段摘要](PHASE_33_T78_REPAIR_ANALYSIS.md)實作，不重做根因分析。仍屬同一第七切片，沒有開始下一主要切片。

## 版本、範圍與結果界線

- 分支：`codex/phase27-mobile-ui`；本地HEAD／本補丁BASE：`b79fc7a6ab6b8043468fc05cfbed91557a440b3f`。
- 本段TARGET尚未提交，沒有新的遠端完整SHA。前次五檔授權已用於BASE；本段沒有commit／push授權，沒有提交、推送或送Grok。
- b79的外部工程FAIL及Codex補驗FAIL仍有效；來源與作廢／未測／受阻見[補驗報告](PHASE_33_T78_CODEX_VERIFICATION.md)。本段只有閱讀程式、Git版本／差異及寫檔，**未執行build、typecheck、lint、格式／靜態檢查、測試、瀏覽器或UI驗證**，新增／更新案例全部尚未執行。
- 保留其他既有未提交修改。沒有改正式數值、Canon、API、角色／保存、reading演算法、來源包裝、兩層rAF、pointer交易或其他畫面樣式。

## 實際變更（九檔）

| 檔案 | 變更及目的 |
|---|---|
| `src/web/starter-catalog-focus-dock.ts` | 共同量測停泊控制項的一行文字下限；定位使用套用CSS後的真正外框高度，超容量明列`fits:false`，不再把58px截成44px計算位置。保留原焦點／父節點／閱讀位置及inline所有權。 |
| `src/web/starter-kit-catalog.css` | 只在停泊時用4px上下／8px左右內距，保留字級及文字；row的首行從頂端開始，完整內容仍可在控制項內捲動。rail預留共同文字下限、兩個8px焦點間距、1px邊框與bottom safe。 |
| `src/web/StarterKitCatalogPanel.tsx` | reserve改量測目前畫面全部控制項的字級／行高／邊框，排除placeholder及停泊後scrollHeight；不由目前焦點或dock開關決定rail高度。僅改import與reserve量測。 |
| `tests/starter-catalog-focus-dock.test.ts` | 補V1真假高度、實高讀回、字級／內距預算及新inline變數所有權；沒有讓fixture的樣式寫入自行縮小rect。保留原位置／焦點／閱讀／清理斷言，沒有skip。 |
| `tests/browser/starter-catalog-g4-probe.mjs` | 移除未證實1px容差。一次wheel、原等待上限、同幾何及實際正向位移保留；分列準備／安裝／返回階段，原錯誤優先於最後量測、cleanup及保存錯誤。 |
| `tests/browser/starter-catalog-probe-evidence.mjs`（新增） | 真實async保存與錯誤交接seam；保留原throw值／Error實例，次級失敗另記，無主錯誤的保存失敗仍拋錯並列BLOCKED。 |
| `tests/browser/starter-catalog-probe-evidence.test.mjs`（新增） | 補保存前／後拋錯、frozen原錯誤、導航＋cleanup＋保存、斷言紅燈、沒有主錯誤／沒有trace及throw undefined等錯誤契約案例。不是假Playwright頁面。 |
| `docs/development/PHASE_33_T78_REPAIR_ANALYSIS.md` | 補記使用者選A及第二段已開始；第一段證據／預測保留來源，不改成PASS。 |
| `docs/development/PHASE_33_T78_REPAIR_IMPLEMENTATION.md`（本檔） | 本段限定交接與未驗證界線。 |

另有前一輪產生、尚未提交的`PHASE_33_T78_CODEX_VERIFICATION.md`。它不是本段新修改；第三段若需讓bot讀取來源，須將它明列於新的限定提交清單，不擅自納入其他dirty檔。

## 主要行為與尺寸界線

1. **先修共同尺寸原因，再修工具Low。** 停泊可讀下限取控制項與後代最大computed行高＋上下4px＋自身邊框；按鈕／summary至少44px，h2保留原行高，不當作觸控按鈕。若外部樣式提供`normal`，沿用本Sheet的1.55行高回退，仍待真字形可讀性驗證。
2. **rail不跟dock開關跳變。** 每個畫面先以全體控制項共同下限設reserve，向上取整。rail為reserve＋16px＋1px＋bottom safe；取消舊50%／100%−158的容量截限，因該截限低於文字／padding真下限時不能成立。字體、名稱、正常來源控制項外觀保留；空的常駐rail可能較前版緊湊，主閱讀區尺寸會改變，須重驗G4／clamp。
3. **真外框決定定位。** 寫入停泊寬度、文字下限與可用max-height後讀回border-box，再決定top。實高超容量時保留真高度、從可用區頂端放置並記失敗，不宣告完整可見。`geometry().fits`只表示高度可放性，**不代表真rect包含、完整6px框、文字可讀或hit-test通過**；外部位置／尺寸所有權仍可能造成不足。
4. **不足不是blur。** 容量小於44px或無可用幾何時，不再單憑尺寸自動release原焦點。這是已確認A「空間不足不release成失焦」的限定行為；關閉、focusout、焦點轉移、popover接管及顯式release仍按既有生命週期還原。原helper的sub-44 release期望更新為保留同節點並明列失敗；inline所有權測試改以真正close→refresh自動release→同焦點repin守原保護，沒有放寬44px／完整可見要求。
5. **來源佔位沒有另修。** sourceHeight／placeholder及details padding沿用原算法；即使緊湊呈現改變其輸入，也不將原390×620的30→31問題宣告解決。Grok須分記來源／停泊高度與rail預算。

兩區垂直條件仍為`A ≥158＋H＋16＋B`，這裡A應扣rail邊框；H須用真實可讀外框，不能拿44px代替放大文字。沒有降低158px或焦點框斷言。若物理高度不足，閱讀區仍可能低於158，**本輪不承諾整個切片PASS**。

## 工具Low與caller交接

- 準備政策是`exact-unchanged-geometry`；先前1px不能解釋720→721的真幾何變動。零range、未位移、不到精確上限或尺寸改變仍BLOCKED；不增加重試、等待、先dock或新baseline來取綠。
- `onEvidence`仍先被呼叫，再將已取得的原操作／準備／斷言錯誤原樣拋出。最後量測失敗記`last-preparation`，停止探針失敗記`probe-stop`，writer拋錯記`evidence-save`。返回cleanup用finally刪除本次probe key；仍不能把已關Page的清理當成功。
- caller可從同一模組import `probeFailureReport`，在catch原Error時讀回stage、原始error及secondaryErrors，另行保存診斷。使用WeakMap，不改frozen Error的cause／stack／識別；primitive throw仍原樣拋出，不能用WeakMap讀回，caller須保留收到的report參考。此限制明列。
- writer失敗時診斷`verdict:BLOCKED`，原產品判斷保留於`productVerdict`，`evidenceSaveCompleted:false`。沒有主錯誤時拋writer原錯誤；有主錯誤時仍拋原主錯誤。**先存的檔案不會因後來callback拋錯自動更新**，callback尚未寫入時也不冒稱證據已保存；須分列JSON／PNG／trace各自結果。
- 原外部writer假定`report.trace.length`不適用。第三段交接要求先保存JSON，再依`stage`及`Array.isArray(report.trace)`保存可取得的trace／截圖；preparation／instrumentation及page消失時不保證有final／trace。這裡沒有改外部driver或舊證據。

## 尚未執行：交指定Critic的必要案例

以下是下一段的驗證準備，**不是Codex執行結果**：

```sh
node --import tsx --test tests/starter-catalog-focus-dock.test.ts
node --test tests/browser/starter-catalog-probe-evidence.test.mjs
```

第二個mjs檔不在既有`npm test`的`tests/*.test.ts`glob內，須另跑，不以全套數字代替它。本輪未新增或改套件／測試設定。

定向真頁面先行，沿用第一段E及Phase Spec／GROK_REVIEW完整要求：

- V1：568×320、844×390真Chrome200%縮放＋root200%，各N3與BASE；記compact前後字級、padding、border、min／max／actualHeight、rail capacity、rect、完整6px框、文字首行及hit-test。不能只檢查helper `fits`。
- 常駐rail／G4：正常及放大文字，list／detail、loading／error、同原節點pin→refresh→release，rail／frame尺寸不因dock開關跳變。source佔位另報；G4真setter寫入值依新版實際bounds量測，不將舊248／318／102固定值當新預期。
- 短屏：844×200、568×320 safe47／34、真縮放／字級還原；raw與扣scrollPadding的bounds分開。仍要求158及完整操作框，低於門檻列紅，不以「有限呈現」判整體PASS。
- F1／F2／H-1／H-2／L-8：原有效刺激、Home同幀micro resize、PageUp／wheel次序、smooth中間幀、prototype／非焦點SIV／text fragment、邊界／no-op及未知捲動。reading與兩幀時序未改，不代表可省略受rail尺寸影響的回歸。
- 第一pin／已pin對照逐rAF：保留422×195、root32及375×667 row rotate的early紅燈；補callback／RO／generation時間戳，沒有改成末態判斷或延長等待。
- 外部12px／important所有權、真release→同焦點repin、長標題／row／summary內部捲動、pointerup／cancel及按住resize、關閉清理；外部尺寸接管造成的不足如實記錄。
- probe：原390×620一次wheel、alreadyAtBottom、無range／無位移／幾何改變、Page／frame消失；callback保存前／後拋錯、導航＋cleanup錯誤、無主錯誤但writer失敗。用真正Page確認主錯誤未被覆蓋，再配對有／無probe與獨立logpoint；24幀／400筆與嚴格G4斷言未降低。
- 必要完整回歸沿用現有要求：build／完整測試（隔離PG及no-DB略過分列）、HTTP／主流程／故障／readonly snapshot、舊UI、882 rail-aware矩陣、safe／對比、harness與cleanup。同版有效結果可引用，新patch影響的幾何／事件案例需重驗，不刪必要項目省token。

## 已知限制與下一段

- 極短屏閱讀不足158、首次停泊空窗、原390×620準備BLOCKED、窄H2可讀／取樣限制及按住summary resize的既有Info均未宣告解決。
- 真手機、讀屏器、Safari完整矩陣、系統字級、真safe area、Android網址列、Chrome原生尋找、真Ctrl-wheel、pinch及真320視窗的未測／受阻界線沿用補驗報告，不擅改PASS。
- 新helper fixture不模擬CSS排版、字形、原生details、paint或RO／rAF；新錯誤單元案例不證明真Page cleanup或writer可成功保存。全部仍待指定AI TRPG Architecture Critic。
- 下一步只開始第三段high：核對實際diff／新限定授權、取得遠端完整TARGET，再經Grok Bot Control送指定Critic一次並讀回確認。未得到新授權不commit／push；工程PASS仍待使用者驗收。FAIL只整理分類與證據，不自動續補丁。

第二段實作完成，尚待工程驗證。請把effort切換為high，回覆「已切換，繼續」。

## H. 第三段 high：限定提交及完整送驗草稿（2026-10-14）

使用者已回覆「已切換，繼續」。本段只依前兩段摘要及實際diff整理交接，沒有重做根因分析或修復程式。核對本地分支／HEAD仍為上述BASE，暫存前index沒有檔案；其他既有修改保留。Repository遠端是`https://github.com/bosco8001/ai-trpg.git`。下面十檔包含第二段九檔及先前尚未提交的Codex補驗來源報告。使用者其後明確回覆 **「授權限定十檔 commit／push 並送驗」**，並指示「繼續」；依此限定授權執行。本段為提交前紀錄，當時尚無新TARGET、送達或新的工程結果，後續須另記實際完整SHA與送達證據。

### 限定十檔與命令

1. `src/web/StarterKitCatalogPanel.tsx`
2. `src/web/starter-catalog-focus-dock.ts`
3. `src/web/starter-kit-catalog.css`
4. `tests/starter-catalog-focus-dock.test.ts`
5. `tests/browser/starter-catalog-g4-probe.mjs`
6. `tests/browser/starter-catalog-probe-evidence.mjs`（新增）
7. `tests/browser/starter-catalog-probe-evidence.test.mjs`（新增）
8. `docs/development/PHASE_33_T78_CODEX_VERIFICATION.md`（先前補驗報告，新增）
9. `docs/development/PHASE_33_T78_REPAIR_ANALYSIS.md`（新增）
10. `docs/development/PHASE_33_T78_REPAIR_IMPLEMENTATION.md`（新增，本檔含第三段交接）

不納入AGENTS、MANIFEST、OPEN_QUESTIONS、IMPLEMENTATION_PLAN、舊Phase交付／Grok文件、其他原型及`docs/ui-ux/`的既有修改。第三段沒有另改程式或測試。取得使用者新的限定授權後才執行：

```sh
git add -- src/web/StarterKitCatalogPanel.tsx src/web/starter-catalog-focus-dock.ts src/web/starter-kit-catalog.css tests/starter-catalog-focus-dock.test.ts tests/browser/starter-catalog-g4-probe.mjs tests/browser/starter-catalog-probe-evidence.mjs tests/browser/starter-catalog-probe-evidence.test.mjs docs/development/PHASE_33_T78_CODEX_VERIFICATION.md docs/development/PHASE_33_T78_REPAIR_ANALYSIS.md docs/development/PHASE_33_T78_REPAIR_IMPLEMENTATION.md
git diff --cached --name-only
git commit -m "fix(web): size starter focus rail for readable controls"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
git ls-remote origin refs/heads/codex/phase27-mobile-ui
```

核對暫存清單精確十檔及遠端完整SHA；若版本或scope改變，先核對受影響差異，不擅自使用舊授權。上述Git狀態／差異讀取不是工程測試，開發代理仍不跑build／typecheck／lint／格式／靜態分析／單元／PG／瀏覽器驗證。

### 完整 Grok prompt（TARGET待填，尚未送達）

取得可讀的遠端完整TARGET後，僅替換下列TARGET欄位，使用Grok Bot Control從當次介面核對AI TRPG Architecture Critic、最新回覆及composer；先讀私有防重送紀錄，再核對完整draft、送一次並讀回新outgoing及空composer。不得將Working／收件確認當工程PASS；送達模糊時停止重送。提交文件無法自引尚未產生的SHA，以實際送出原文及後續送達紀錄為準。

```text
請指定 AI TRPG Architecture Critic 做 Phase 33 第七切片 t78u 後 A 限定補修的工程複驗。Operator：Codex。同一切片，工程結果不代替使用者驗收，不開始下一主要切片，也不要代修程式或commit／push。

Repository：https://github.com/bosco8001/ai-trpg
分支：codex/phase27-mobile-ui
BASE：b79fc7a6ab6b8043468fc05cfbed91557a440b3f
TARGET：__待限定十檔提交並推送後填入完整SHA__
歷史比較BASE：a061fe25f534f239daf514843df2f127c510ce12（僅t78u紅／綠來源對照，不是本輪BASE）。

先核對完整SHA、遠端HEAD／祖先及BASE→TARGET精確十檔。TARGET未可讀不得回退BASE當本輪結果。限定檔案：
src/web/StarterKitCatalogPanel.tsx
src/web/starter-catalog-focus-dock.ts
src/web/starter-kit-catalog.css
tests/starter-catalog-focus-dock.test.ts
tests/browser/starter-catalog-g4-probe.mjs
tests/browser/starter-catalog-probe-evidence.mjs（新增）
tests/browser/starter-catalog-probe-evidence.test.mjs（新增）
docs/development/PHASE_33_T78_CODEX_VERIFICATION.md（新增，前輪補驗來源）
docs/development/PHASE_33_T78_REPAIR_ANALYSIS.md（新增）
docs/development/PHASE_33_T78_REPAIR_IMPLEMENTATION.md（新增）

先讀本輪IMPLEMENTATION摘要與H段，再補讀ANALYSIS的四項要求／未證實處及CODEX_VERIFICATION來源。讀TARGET的AGENTS.md、CANONICAL_MANIFEST.md、OPEN_QUESTIONS.md、PHASE_33_STARTER_KIT_CATALOG.md、對應GROK_REVIEW、PHASE_33_G4_REPAIR_PLAN_T76U.md、PHASE_33_REMAINING_REPAIR_PLAN_T77U.md H段及正式starter_kits.md／character_system.md／classes.md／magic.md／combat_system.md。舊文件的待填／待接受段落保留為歷史；最新版本、限定呈現及未解界線以本prompt／新交接為準，正式Canon與有效Phase需求不縮限。

最小背景：t78u對b79回報整體FAIL；inline所有權已測PASS，rail只達有限呈現，probe390×620仍BLOCKED。兩Low為未證實1px準備容差、callback蓋過原timeout。Codex經使用者另行授權在精確b79／a061本機Mac補驗，整體仍FAIL：rail-aware兩版各882、AA882／AAA878，early AA false 31／29；原版H-1、rail-aware補充H-2、M-1正確列表reload與真正smooth中間幀有有效結果。新Medium V1為真Chrome200%縮放再root200%：568×320→CSS284×160，b79 row top107／bottom165／height58；844×390→CSS422×195，top142／bottom200／height58，均越viewport5px，兩案各N3紅，a061各N3完整可見。字級32、padding上下28、border2、宣告max44但實高58。早期首次pin空窗與極短閱讀不足158仍未解；不要重貼整份歷史或把本機證據當Linux實測。

重用你保留的 /workspace/p33t78-evidence/SUMMARY.md、scripts及原json/logs/shots/traces，先確認仍可讀。Mac補驗摘要在repository新文件；其中/private/tmp屬Codex本機，不是你的Linux共享路徑。原外部包SHA256：8d39248e8f64e7643b88d2c11a869ab3ca09e6d6f48cce46ab13899508672458；本機補驗包SHA256：c4c46158247511cc8d59f7200e9258186b4cf000f339169bc7cda705ed061961。包未轉移時只作來源／摘要引用，不冒稱已讀原JSON或已重用Mac driver；若需要原件請明列缺口，可先用原Linux有效driver做本輪真頁面對照，不停在不存在的Mac路徑，也不把重新建立的driver叫原版。

本輪使用者選A，僅允許共同尺寸、停泊緊湊間距及兩工具Low。保留字級／名稱／正式數值／API／保存、同實際焦點／父節點／單frame與pointer交易。停泊上下4px／左右8px，首行可讀下限取目前畫面控制項與後代computed行高＋padding＋border，touch最低44。rail固定預算不跟dock開關或placeholder變動，含16px間距、1px邊框及bottom safe；取消舊不可能壓過padding floor的50%／100%−158 cap。寫CSS限制後讀真border-box定位，不再把實高截成假44。超容量記fits:false而不單因不足release成失焦；關閉／focusout／焦點轉移／第三方popover仍還原。geometry().fits只是高度可放性，不是containment／ring／hit／文字PASS。sourceHeight／details padding算法、reading來源包裝、兩rAF／等待期限與清理流程沒有另重寫；緊湊CSS仍可能改其輸入，須真頁面回歸。長控制項保留全部文字並內部捲動，不用截字／縮字換綠。

probe改精確到原上限、同幾何、正向實際位移；alreadyAtBottom另列。一次wheel及原timeout，沒有重試／新baseline／先dock假準備。移除1px不代表已解決原720→721／max252→253；若真幾何仍改，原390×620仍BLOCKED。保存用原錯誤優先、最後量測／stop／writer錯誤secondary；有主錯誤重拋同Error實例，無主錯誤的保存失敗也拋錯並BLOCKED。caller先JSON再按stage保存有的trace／PNG，BLOCKED不保證trace/final。probeFailureReport(error)可讀原Error的診斷，frozen Error不改cause／stack；primitive throw無WeakMap讀回，保留report參考。先寫檔再callback throw不會自動更新舊檔，PNG／trace／JSON各自報保存狀態；產品FAIL不能因writer失敗被藏掉。24幀／400筆、嚴格G4斷言及無probe對照保留。

Codex本輪沒有跑build、typecheck、lint、格式／靜態分析、測試或瀏覽器；新／改案例全部未執行。fixture不實作CSS／padding floor／字形／原生details／paint／RO-rAF，不以helper綠燈證明真頁面。

準備精確BASE／TARGET隔離production真頁面，報逐版本npm ci／npm run build、必要隔離npm run db:migrate完整命令與exit，以及Node／npm／PG／OS／Playwright／Chrome／headed/headless／DPR／root字級／safe／真縮放方法。BASE同版本已有有效結果可引用，不為填表重跑；TARGET新改動及受影響的紅燈／回歸仍須實驗。隔離非5432 DB，不改repository套件、正式資料或舊證據。先做下列定向真頁面，再依結果完成必要完整回歸：

1. V1兩個N3紅例與BASE：同真zoom／root、原有效停點及rotate／restore／font-alt序列。逐幀記raw rect、padding/border/min/max/actualHeight、compact minimum、rail容量及frame，實際完整6px框、中心／邊緣hit、首行與內部捲動。外部樣式normal行高／尺寸或position接管另測，算式fits不當PASS；還原字級不新失焦。短屏844×200、844×240、568×320 safe47／34及0，raw frame∩viewport／扣scrollPadding bounds分列，仍要求158／44／完整框，不假稱全部可行。
2. G4／共同預算：844×390／568×320／390×620正常safe0，有／無probe各N3，純Tab／Enter、先捲底、重讀／close reopen、200%／超大控制項及loading／error。list→detail→return目的reserve先量後導航；同node pin／refresh／release時rail/frame不因dock開關跳變。源佔位與停泊分報，實際setter實參／讀回和focus／scroll／RO／rAF世代留證；舊248／318／102只是歷史輸入，不作新版固定預期。正常原列須在閱讀區完整可見，placeholder或rail不能代替，任何已觀測短暫dock仍紅；有／無probe配獨立logpoint，不把projectedScrollTop當實參。
3. 無玩家操作的H-2／M-1：原有效Case A/E、36rem界線、640↔620、三種旋轉、reload真正pending GET、未觀測中途maximum、早／晚clamp與第一／第二rAF阻塞，原可見焦點不完全消失，閱讀不歸零。第一次pin／已pin分列；422×195 root32與375×667 row rotate每幀與callback／RO／generation時間戳，early缺口不改末幀判斷或延長等待來取綠。原h1t74／h2原版若仍在請保留原本序列與新rail-aware量法；h2 M錯頁焦點作廢，不偷換成PASS。
4. F1：受信任Home同幀844×390→844×389、PageUp、ArrowUp、無resize對照，有頭／headless N5；wheel compositor→sample→wheel→scroll與wheel→sample→scroll各N5，合成／受信任分列。真正smooth中間幀含中途resize／wheel；不僅看無SIV／末態，既有截止時間及閱讀位置不被尺寸補修打斷。
5. F2：prototype scrollTo／scrollTop、非焦點SIV、text fragment、CDP、不可配置descriptor／第三方第1／2rAF與原值0／300／300.5／max−1／max及五時序。穩定／reflow N3，有效構成與分母展開。未知保持未知，不當閱讀也不允許拉回；native clamp與產品主動寫入分開。window.find無位移不當有效搜尋，不把替代品叫真讀屏／Chrome尋找。
6. L-8：七類×0／1frame／249／250／300ms N2；End／ArrowDown／同值setter／無效scrollTo／NaN scrollBy／邊界wheel，無輸入、clamp後noop、命令取代舊來源、已結束輸入均不冒充閱讀權限。量不到內部狀態須列受阻，不以passive trace推成直接證明。
7. 一般閱讀／inline／清理：H-1全17類、有頭／headless N3，原wheel／trackpad單步連滾反向、600ms smooth／無scrollend、fractional／max與部分／完全不可見焦點；wrapper的this／return／throw／getter／繼承／Proxy／apply中dispose／第三方覆寫與cleanup契約。外部12px／important／priority-only／移除→3refresh→自動release→同焦點repin、summary交替、按住resize、pointerup／cancel／不同ID與close。新版不再因sub44自動release，舊極短觸發不同須明列變更，用真close/focusout/popover接管等既有自動release路徑驗所有權，不以fixture改預期說原極短鏈照通。長row／summary／H2名稱與文字、兩區捲動、touch反向及scrollbar，原生details click/default不得被吞。Esc第1／2rAF、smooth/pointer/timer中關閉、5次reopen，refs/wrapper/listener/RO/rAF/timer/class/style/spacer還原、外部所有權保留，停定1秒活動0，不振盪／新增pageerror。
8. 工具Low真正Page鏈：原390×620一次wheel＋before/after完整raw，精確上限／already底部／無range／無位移／尺寸變動／frame或Page消失。timeout＋writer保存前及保存後throw、導航＋stop throw＋writer throw、產品斷言紅＋writer throw、無主錯誤但保存失敗。外層原錯誤實例／name/message/stack及secondary三階段留證，避免次級catch再蓋原錯誤。BLOCKED不當G4 PASS；writer stage-aware JSON-first，PNG/trace失敗另外記，保存前throw不假稱已有檔。重用module本體，不只測手寫模型。

定向後沿用Phase Spec／GROK_REVIEW及T77U H段全部必要完整檢查，不刪斷言、skip或改契約取綠；同版本有效檢查可引用，受新patch影響／舊FAIL或受阻者重驗：
A. 六尺寸／三字級／七停點882 rail-aware矩陣或充分等效；AA／AAA、超大／部分可見及early分列。M-1／L-2至L-6、G1/G2/G5、safe原24組及dock、158/44/6px框、橫溢出、busy成功失敗／hover/pressed/focus/disabled每幀對比≥4.5與舊視覺，不能拿b79的4.8作新版結果。
B. npm test無DB及新隔離PG，skip不當PASS；七檔node --import tsx --test tests/starter-catalog-reading.test.ts tests/starter-catalog-focus-dock.test.ts tests/starter-kit-catalog.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts；另在TARGET跑node --test tests/browser/starter-catalog-probe-evidence.test.mjs（不在npm test TS glob內，BASE沒有新增檔，不將missing當BASE產品FAIL）。reading＋focus-dock＋starter-kit正反序各兩次，globals/finally/worker污染／M-2／新案例與有效mutation、G4紅控制。git diff --check本輪完整BASE與TARGET。逐命令報exit／pass／fail／skip，不以總數掩蓋單案失敗；舊oversize假的縮高assert改成明列不可放，不降低真頁面操作與可見要求。
C. production HTTP125／主流程20／faults19、慢載入／取消重開重試／GET only、loader/API/kind/resolve/complete與守衛，出生/state/revision/HP/MP/三槽/八表md5不變；舊UI四尺寸57畫面及M4b/M4c/M6a，harness與cleanup-app必要回歸。程式未改的同BASE有效結果可明列引用，所有受UI geometry影響者重驗，沒跑不能列新PASS。

回報分列：共同尺寸V1、兩工具Low、G4與四共同要求回歸、整體slice結論。使用者只接受限定A呈現，沒有接受降低158或首次空窗，也未接受第七切片；必要需求仍紅或驗證不完整時不得以限定補修PASS換成整體PASS。列High/Medium/Low/Info、完整TARGET/BASE與環境、重現／預期／實際／影響、最小受影響範圍、raw證據及各分母；分開本輪實做、同版本引用、推斷、未測、受阻、作廢。保留舊I-A／窄H2／按住summary resize及其他歷史限制，不順便宣告解決。
真手機／讀屏／Safari完整矩陣／系統字級／真safe／Android網址列／Chrome尋找列／真Ctrl-wheel未測，真pinch／真320視窗受阻界線依實際能力保留；模擬與桌面實驗不外推。保存新SUMMARY及可重跑driver/json/logs/shots/traces，清理本輪隔離服務／proxy／Page／DB／role／cluster，不碰5432或舊證據；舊留存55426與3131–3133先核對來源，不擅自當本輪新建服務清理。

不要修repo、不commit/push、不傳其他bot、不代使用者驗收／結案。PASS後Codex只整理外部結果與手動核對清單等使用者；FAIL後只整理分類／證據／範圍，停止續補丁並提醒：「工程仍 FAIL。請把 effort 切回 ultra，回覆『已切換，繼續分析』。」
```

### 結果整理及手動驗收準備

本段沒有新工程結果；以上為待授權／待完整TARGET／待送達的草稿。Grok回覆後逐項記來源與版本：PASS才提供短手動清單（轉向／大字的文字與焦點、閱讀不拉回、summary／返回／重讀／關閉及長控制項內部捲動）；FAIL只整理失敗分類、證據及範圍，依三段停止界線回ultra，不在high追加補丁。即使限定項目PASS，只要必要整體項目仍FAIL，就不進入下一主要切片。
