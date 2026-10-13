# Phase 33 第七切片：t78u 後第一段修復計畫摘要

第一段只分析與定案。當時沒有改產品程式、撰寫新測試、重跑驗證、啟動服務、commit／push或送新修復版本。使用者其後確認 **A：限定補修**，並於2026-10-13回覆「已切換，繼續」，第二段依此開始。其他未提交修改保留；第二段交接見[實作摘要](PHASE_33_T78_REPAIR_IMPLEMENTATION.md)，本文件保留第一段分析，不把候選預測改寫為已驗證結果。

## A. 版本與已知紅燈

- 分支：`codex/phase27-mobile-ui`。
- 目前HEAD／下一補丁BASE：`b79fc7a6ab6b8043468fc05cfbed91557a440b3f`。
- t78u對照BASE：`a061fe25f534f239daf514843df2f127c510ce12`。
- 外部t78u及Codex本機補驗均維持整體FAIL；有效PG、G4、F1／F2、H-1／H-2、L-8等結果保留，來源及未測界線見[補驗報告](PHASE_33_T78_CODEX_VERIFICATION.md)。本機Mac／Chrome155與外部Linux／Chrome154分列，未推定跨平台結果。
- 新Medium V1：原生縮放200%再root字級200%，568×320及844×390職業列底部越界5px；TARGET兩案各N3紅，BASE各N3完整可見。
- 既有Medium：部分短屏、safe及縮放條件下閱讀區不足158px；極短視窗仍未解，使用者接受限定修復範圍不等於接受需求縮限或整個切片。
- 時序紅燈：422×195 CSS px、root32的職業列，TARGET第二rAF三次均完全不可見，之後才停泊；不是只看最終AA就能宣告通過。
- 兩項工具Low：1px準備容差沒有原始證據支持；`onEvidence`拋錯會覆蓋原timeout。

既有已執行的真頁面紅／綠對照與原始JSON是本段回饋基準，沒有為了套用診斷流程重跑。重現有N3區分能力，但尚未逐一移除初始條件完成最小化，不冒稱已取得每個因果步驟。

## B. 三個主要原因假設及未證實處

### 1. 主要原因：共同尺寸預算沒有納入真正外框下限

**已確認的尺寸鏈：** `matrix-partials.json`記錄TARGET row上下padding各28px、border各1px、border-box、宣告max-height44px，但實際高58px。rail高60px，扣目前上下8px僅有44px。`starterFocusDockPlacement`又把讀回的實際58截為44去算top：107＋58＝165，另一案142＋58＝200，分別超viewport160／195的底部5px。source／CSS／實測數字相符；不是靠猜測scroll來源解釋。

**根本限制：** 令A為Sheet與visualViewport交集扣top safe及上下border後的高度，B為bottom safe，H為實際可讀、可操作的控制項外框高度。沿用目前上下8px保留區時，垂直兩區須同時滿足：

`A ≥ 158＋H＋16＋B`。

即使H真的能降至44，仍須A≥218＋B。新紅燈的A只有158／193；844×200的A198亦不足。字級放大後，一行文字與padding可能令H高於44，44是下限，不是所有控制項都應被壓到的高度。

**可驗證預測：** 將CSS實際盒子、操作區容量、定位使用的高度統一，且放置後讀回驗證真外框，V1的5px越界應消失；極短屏的158px閱讀紅燈不會因此全部消失。只換top公式、只放寬測量或只把max-height再縮小，都不能同時守住全部要求。

**仍待驗：** 緊湊間距後文字是否真可讀、內部捲動是否可用、跨字級／safe後的最小可用外框，不能從純算式宣布PASS。158沿用原raw frame∩viewport口徑，扣scrollPadding的bounds另報，不將raw158說成bounds158。

### 2. 次要原因假設：首次停泊與已停泊refresh走不同時序

TARGET在font-alt前仍位於frame，rect25–109；放大第二rAF變553–762、visiblePx0，其後才到rail的142–200。BASE在放大前已經停泊，放大時只refresh，早期仍可見。Panel的兩層rAF、RO／generation取消路徑可造成首次呈現空窗，但目前沒有逐回呼時間戳，尚未證實是哪次回呼延後pin。

**可驗證預測：** 同樣幾何與操作下，初始未停泊／已停泊兩組應顯示不同早期結果；若修正首次呈現時機，空窗應消失，而frame位置、閱讀歸屬及wrapper合約保持。不得靠延長等待或改成最後幀才判斷取綠。

TARGET31格early false包含BASE29格；新增只有normal375×667 row rotate及上述realzoom row font-alt。前者缺早期rect／事件且只有一次Boolean差異，不能直接定成可重現的新退化。reading及Panel在兩個被測版本沒有程式diff；目前不足以支持重寫來源判斷。

### 3. 工具原因：原固定準備幾何在wheel後真的變動

外部`c-range-target.json`是720／468／max252→721／468／max253，scrollTop仍252；placeholder30→31令內容高度變動。`sameGeometry`拒絕此準備是正確的BLOCKED，不能把差值稱為捨入誤差。

`position()`用停泊後的scrollHeight回寫sourceHeight，是來源尺寸與呈現尺寸混用的候選原因；尚無逐幀證據證明它是30→31的唯一來源。本輪不把來源佔位算法與主要幾何補丁一起改。

**可驗證預測：** 若來源尺寸污染是原因，分別記來源位置與停泊內容的原始尺寸，應能看到31先出現在停泊量測、之後才寫入placeholder。在證實並另修之前，原一次wheel案例仍BLOCKED；移除1px容差不能冒稱已修好這個場景。

callback Low則無須再猜：準備catch在`throw error`前await保存回呼，次級錯誤直接跳過原錯誤重拋；外部report已存TimeoutError、外層卻收到callback failure。返回finally亦有同類風險，尚未實測。

### 為何多次補修仍失敗

1. 前次加`100%−158px`上限時，把44當作必定能壓到的外框，漏了padding／文字下限及兩區合併的可行性。這是本次新退化的設計缺口。
2. helper fixture預置rect／scrollHeight，寫max-height不會真的觸發CSS排版；它能驗所有權與算式，不能驗padding floor、字級wrap、原生clamp與RO／rAF順序。
3. 穩定後882格AA與每幀都可見是不同證據；TARGET／BASE的初始dock狀態也不同。只比較末態會漏掉首次呈現空窗。
4. 原driver的錯頁停泊、frame-only量法、未生效縮放、固定2px邊緣hit點與未證實1px理由，混入了準備／量法問題；callback再丟失主錯誤，令失敗訊號變得不清楚。

窄H2的1.5px外框比2px邊緣取樣偏移小，AAA旗標含量法限制；它的文字可讀性也沒有通過證據。不能與職業列真正越界混算，亦不能刪掉它取得綠燈。

## C. 狀態轉換、處理優先序及選定候選

共同優先序仍為使用者已確認需求→正式Canon／Phase Spec→手機可用性→視覺一致性→skill一般建議。game-ui-ux守原焦點／閱讀位置／唯讀狀態；ui-ux-pro-max守真外框、字級、可讀性、安全區及完整焦點框；apple-design守既有字體層次、間距與即時回饋。共同使用已接受視覺，不增新動畫或新玩法。

**已由使用者確認候選A：先限定幾何補修及兩項工具Low，短屏與未證實的首次時序仍如實列紅。**

1. 先統一每個畫面的閱讀／操作幾何預算。區分來源佔位、停泊呈現、實際控制項外框、可用viewport；操作區預算不隨有無dock跳變，避免G4再因reserve改變復發。
2. 只有停泊狀態使用緊湊間距，保留原字級、文字、同一實際節點／父節點及既有長控制項內部捲動。空間預算須容納可讀文字，不能只令外框變44但內容區變成零。
3. 寫入呈現限制後讀回實際外框，再用它定位並核對完整焦點框；實高大於容量時不可再次截成假高度。空間不足須明列不滿足，不 release成失焦、不改閱讀scrollTop來補位、不偷偷放寬斷言。
4. 四個事實分開：真尺寸觀察、閱讀狀態、待保護的原焦點、內部呈現寫入。已知閱讀保留；未知捲動仍未知，不授權拉回；邊界／no-op不取得閱讀權限。保留reading演算法、來源包裝、既有pointer交易及兩幀流程。
5. 早期首次停泊以既有N3案例補齊逐回呼／每幀證據，作獨立紅燈。若幾何補修後仍需改呈現時機，回到ultra先確認原因，不順手改事件／等待／清理。
6. 工具Low依序另處理：移除未證實的1px準備容差，保留一次wheel、原timeout、同幾何與實際位移；其次統一主／次錯誤優先序。操作／準備原錯誤優先，最後量測／callback／cleanup失敗另記；有主錯誤時重拋原錯誤實例，沒有主錯誤但保存失敗時仍須拋錯、工程受阻。caller採stage-aware JSON-first，不能假定BLOCKED都有trace／final。

候選A不承諾此輪整個切片PASS。若第二段無法在限定幾何範圍內維持文字可讀及原來源／呈現界線，停止擴大補丁、回到ultra；不能為兌現計畫而新增timer／proxy焦點或改source算法。

**候選B：先另建短橫屏側邊焦點區原型。** 閱讀與操作分享寬度，原焦點節點及閱讀位置保留；主閱讀區會變窄，須先確認原型，不能直接取代正式畫面。A<158時連側邊也不能產生158可讀高度；覆蓋閱讀區或改成二選一模式會改要求，不在本次授權內。B是必要時的結構候選，尚未選定，並非全面重做已批准。

## D. 最小改動範圍

若採A，第二段以此摘要為基準，只補讀新差異：

- `src/web/starter-kit-catalog.css`：限定停泊盒子／緊湊間距與共同容量，不改其他UI樣式。
- `src/web/starter-catalog-focus-dock.ts`：使用真外框與可放性；外部CSSOM所有權、來源還原及pointer交易保留。
- `src/web/StarterKitCatalogPanel.tsx`：必要的畫面幾何reserve量測；不改reading來源、事件先後或等待時間。
- `tests/browser/starter-catalog-g4-probe.mjs`：準備容差及錯誤優先序；正常產品嚴格斷言、24幀／400筆限制保留。
- 必要的helper／probe錯誤案例及本摘要交接文字；實際測試檔依真實seam決定，不建立能自行假定CSS縮高成功的Page模型。新案例標尚未執行，交指定Critic。

不改`starter-catalog-reading.ts`、class-catalog共用樣式、正式數值／資料版本／API／保存／角色或遊戲流程。原probe的390×620幾何BLOCKED、首次呈現空窗、窄H2及按住summary resize的既有Info，未有證據前不改標解決。

本prompt不授權commit／push；前次五檔授權已用於b79fc7a。第三段才按實際diff準備限定清單並取得新授權。

## E. 四項共同要求的回歸案例

| 要求 | 必要真頁面信號 |
|---|---|
| 原可見操作焦點不完全消失 | V1兩尺寸各N3與BASE，原始／緊湊後actualHeight、slot capacity、rect、完整6px框、字級／真zoom／safe；首次pin及已pin對照逐rAF，不只最後幀；H-2／G4原有效刺激保留。 |
| 主動閱讀不被修正打斷 | Home同幀微resize、PageUp、wheel次序、smooth中間幀；原閱讀位置／產品SIV／ownership不改，來源佔位與操作區不因dock開關跳變。 |
| 未辨識捲動不被reflow拉回 | prototype setter／非焦點SIV／text fragment及第三方inline12px／important→refresh→自動release／同焦點repin；未知保持未知。 |
| 邊界／no-op沒有虛假閱讀權限 | top／max／fractional、無位移wheel／setter／API及resize；L-8不復發，零range準備仍BLOCKED。 |

另保留：短屏844×200、568×320 safe47／34、真正200%縮放及字級還原；分報raw／bounds，不用超大或部分可見冒充全通過。普通／長控制項、文字可讀、內部捲動、padding外部接管、pointer up／cancel、關閉清理均需核對。

probe需驗：原390×620一次wheel、正常／alreadyAtBottom／無range／無位移、尺寸變動、Page／frame消失；timeout＋callback在保存前／後拋錯、導航＋cleanup錯誤、無主錯誤但保存失敗；外層保留主錯誤與次級失敗，PNG／trace／JSON分列成功或受阻。有／無探針及獨立logpoint仍配對。

完整回歸沿用Phase Spec／Grok交付要求；同版有效結果可引用，新改動影響的案例重驗，不因省token省必要項目。本段沒有新驗證結果。第三段若FAIL只分類及交接，等切回ultra，不自動續補丁。

## F. 使用者決定與停止界線

- **A（建議）：** 下一輪限定幾何補修與兩個工具Low，接受焦點欄必要的緊湊間距；字級／名字／實際焦點／閱讀位置保留。極短屏與首次時序仍列未解，整體仍不能宣告通過。
- **B：** 先確認短橫屏側邊焦點區的獨立原型方向，再決定正式結構；閱讀寬度及手機可讀性需實看，不能假定一定可行。

使用者已選 **A**，沒有選B。這是呈現與補修範圍的確認；不是新的提交／推送批准。三段仍屬同一第七切片。極短屏及首次停泊空窗繼續列未解，不降低158px、44px或完整焦點框要求。

第一段的停止提醒（當時）：請確認修復方案；確認後把effort切換為xhigh，回覆「已切換，繼續」。第二段完成後仍須另等使用者切換high，才開始第三段交接。
