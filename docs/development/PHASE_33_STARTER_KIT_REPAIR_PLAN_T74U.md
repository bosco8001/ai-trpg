# Phase 33 第七切片：t74u 修復計畫與分段交接

日期：2026-10-11（Asia/Hong_Kong）。使用者回覆「已切換，繼續分析」，本輪只做 ultra 分析及方案比較。這是待確認的工程提案，不是 Canon、Phase Spec 修訂、工程 PASS、使用者驗收或 commit／push 授權。第二段先讀本摘要，只補讀新增或受影響差異，不重新展開歷史。

**現況：** 使用者其後回覆「已切換，繼續」，第二段依建議的單一捲動區及獨立焦點區完成限定本地實作。下方 A–F 的待確認／未改程式是第一段當時狀態；本次修改、未執行案例與限制見文末第二段交接。沒有工程通過、新提交授權或使用者驗收。

## A. 版本與已知紅燈

- 本地 HEAD：`7fbcdd8c0d471505b5c540c5d7884d883f865294`，分支 `codex/phase27-mobile-ui`。程式／測試目前無未提交差異；既有其他文件及原型修改保留。沒有執行測試、build、typecheck、lint、格式檢查、靜態分析或專案瀏覽器驗證。
- 最近外部 t74u TARGET 同上述 HEAD，BASE `1435b2ca15f232edee1a8d9ffd8aa7f23a823336`，結論 **FAIL**。Grok 的詳細重現及限制見[外部結果](PHASE_33_STARTER_KIT_CATALOG.md#t74u-外部工程結果7fbcdd8-fail2026-10-11)。本輪重用其真頁面證據，未下載或獨立驗證 `/workspace/p33z-evidence/`。
- F1／F2 在外部已測案例修好；新紅燈為 G1 High 遮住返回／重讀，G2 Medium 至 High 吞點擊／padding 殘留，G3 Medium body→frame 閱讀歸零，G4 Medium 返回後再 dock，G5 Medium 模擬無 popover 時失焦，另兩項 Low 涉及 BODY 失焦清理及第三方 hide。矩陣有22個 AA miss、70格受阻，主流程只完成10／20；PG545／545不能覆蓋UI FAIL。

## B. 三個主要原因假設

| 排序／假設 | 支持證據 | 可驗證預測／尚未證實 |
| --- | --- | --- |
| 1. 焦點呈現沒有獨立空間，並依賴新增的 popover 能力 | 外部G1標題y330–374與返回y337–381相交，hit-test打中標題，click／tap無效。helper L5–12僅以dialog／viewport底部定位，未扣其他操作區；L84無popover直接return。 | 保留與閱讀區不相交的空間後，各操作的中心／邊緣hit-test應打中自己；只往上移會在密集內容／大字時改遮其他控制項。G5模擬已測，但真舊瀏覽器未測，不能靠功能檢測或加nearest備援當修好。 |
| 2. 浮層的排版還原與一次操作的生命週期不一致 | G2滑鼠／觸控各0／3能開另一summary，click轉到SECTION，6／6留下49.7969px padding。Panel focusin→recordFocus→refresh→release可在取焦時改排版；helper存寫入原字串再與CSSOM回傳字串比較。只掛dialog focusin，沒有失焦至BODY／第三方hide的完整清理入口。 | 應對照pointerdown／up／click target、release前後rect、寫入值與CSSOM序列值。修正字串比較後若仍吞click，表示手勢中改排版是另一個必要因素。精確事件順序與實際字串仍待Critic量測；不能只加focusout立即還原。 |
| 3. 捲動容器／導航的幾何基準交接不完整 | G3 N=5：Case A／E TARGET新frame停0，BASE1829／1440。CSS36rem把body捲動換成frame，Panel沒有內容位置交接。G4三尺寸各3／3：返回定位使用原viewport邊界與8px，但measureFocus使用computed scroll-padding，通常16px或更多；導航亦未明確取消舊兩rAF。 | 跨界線記兩個scrollTop、owner及可見內容偏移；同owner的小resize不應固定歸零。返回列若只部分落在共同可用區，晚scroll／RO可能再dock。先核對8／16px差額，再分辨舊排程；外部沒有足夠trace把任一項定為已證實唯一根因。 |

CSSOM 的 `getPropertyValue` 回傳序列化後的值，不能假設等於寫入原字串（[CSSOM規格](https://drafts.csswg.org/cssom/#dom-cssstyledeclaration-getpropertyvalue)）。未捕捉的指標click可依pointerdown／up共同祖先決定target，支持手勢中排版變動的可驗假設，但不證明本案已逐事件追查（[Pointer Events規格](https://www.w3.org/TR/pointerevents4/#event-dispatch)）。

**fixture缺口：** Style的Map原樣保存字串；假的Node沒有hit-test、原生details activation、真正focus／popover演算法。失焦測試手動呼叫refresh，掩蓋缺少事件入口。reading fixture的兩個元素不會隨CSS切換捲動owner，也不會原生reflow／clamp；沒有Panel導航→focus→RO→rAF完整鏈。因此helper綠燈不能取代t74u真頁面案例。

## C. 選定方向與狀態優先順序

主要方向：先取消「焦點靠覆蓋閱讀區維持可見」及「因高度換捲動owner」的結構耦合，保留已修好的F1輸入生命週期。下面仍待使用者確認呈現，尚未開始實作。

比較：

- **只作局部補丁：** 避開footer、正規化CSS值、加清理事件與模式位置交接，改動表面較小；但密集內容可能根本沒有空白可放實際焦點，還需處理兩owner交接與popover備援。不足以作為已守住四要求的定案。
- **建議的限定結構簡化：** 只改本Sheet，header／body／footer內容與原生折疊流程保留；所有尺寸由同一frame捲動，外層預留一條與frame不相交的焦點區。不固定高大的header／footer，以免重現L-1閱讀高度不足。焦點仍使用同一實際節點及原父節點，必要時顯示在保留區；不複製控制項、不偽造焦點、不用pointer-events:none讓玩家穿透。
- 原生popover不再是必要能力。普通定位方案須處理此Sheet及body祖先的container containment與入場transform，並用本Sheet限定的等效響應式排版保留窄寬／大字可讀性；不能只改position或加z-index。Layout containment會形成fixed containing block（[CSS Containment規格](https://drafts.csswg.org/css-contain-2/#containment-layout)）。這仍是設計依據，並非瀏覽器實測或相容性通過。

狀態分開：**事實觀察**（rect／owner／位置／實際focus）、**有效閱讀輸入**（既有來源／期限）、**焦點呈現**（原位／保留區／待釋放）、**內部導航**（新的畫面世代及目標）。

處理順序：

1. 關閉／明確導航先終止舊修正與手勢交易；導航完成後依共同可用範圍建立新焦點基準。晚到回呼不得套用舊畫面。
2. pointerdown至click／取消完成期間，保住目標及來源幾何；不在focusin無條件移除流內空間。CSS擁有權以實際寫入後的序列值及priority保存；第三方後續覆寫仍保留。
3. 有效已知閱讀沿用F1原期限，版面變動不取消smooth或續期；未知位移只更新事實，不改成閱讀，也不允許拉回。
4. reflow只更新可用範圍及實際焦點呈現；不向閱讀frame寫舊scrollTop或nearest。單一owner不等於原生clamp永不發生，先不新增內容錨點還原規則。
5. 真失焦至BODY／新控制項／第三方狀態變動有明確入口；不搶回使用者已移走的焦點。邊界／noop不取得閱讀權限。

**空間界線：** 保留區在同一畫面不因dock開關臨時增減高度；需按字級／實際控制項配置，不能假設44px能裝下多行職業列／summary。超大控制項可在自身範圍內閱讀，但須保留操作與焦點環，主frame仍可讀。指定短畫面／大字／安全區若兩者無法同時滿足，列為失敗並回ultra討論；不縮字、降觸控尺寸、放寬AA或暗中縮browser支援範圍。也不直接批准把折疊流程改為新分頁／代理按鈕。

## D. 最小實作範圍及順序

候選程式／案例：`StarterKitCatalogPanel.tsx`、`starter-kit-catalog.css`、`starter-catalog-focus-dock.ts`及其測試；補Panel層的導航／事件鏈案例。reading既有演算法、包裝、250ms期限先保留；僅核對接入同一owner所必需的部分，沒有證據不重寫。文件只更新Phase交接／驗證要求與狀態，不改Canon、正式數值、API、載入／取消、保存、發放或其他名冊。

第二段一次處理一個主要原因：先操作交易／清理，再限定呈現空間與單一owner接入，最後共用導航幾何及世代。每步閱讀diff；不把來源判斷、等待時間、容器與全域清理一起重寫。若實作要求超出上述範圍、證據推翻假設或空間條件不成立，停止擴大補丁、回ultra，不靠新增timer／特例掩蓋。

本輪只新增這份分析摘要；沒有修改程式／測試或執行驗證，也沒有commit／push／送新版本。第二段可補案例但須標示未執行，第三段仍交指定Critic。

## E. 四要求的回歸案例

| 必守要求 | 指定Critic定向真頁面案例及判定 |
| --- | --- |
| 轉向／字級後原可見實際焦點不完全消失 | 重用H-2無輸入／中途截限／late scroll／rAF阻塞、G3 Case A／E N=5；實際節點／父節點／名稱保留。單owner切高寬不固定歸零，量可見內容而非只看焦點。無popover、show取消／拋錯舊G5條件亦不能失焦。 |
| 主動閱讀不被打斷 | F1 Home同幀微resize、PageUp、六ArrowUp、兩wheel次序，headless／有頭N=5；位置與無resize對照，無nearest或新timer／期限延長。G1全部尺寸控制中心／邊緣hit-test，滑鼠／touch完整20步；G2各N=3、Enter／Space、正常拖取消均不吞操作。 |
| 未知／繞過來源不被拉回 | F2 prototype／非焦點SIV／text fragment／CDP／不可配置descriptor／第三方rAF，N=3並保持未知分類；無自動舊位置／焦點錨點還原。G4返回三尺寸N=3、舊回呼與新導航競爭。window.find未造成捲動仍列受阻，不引用成PASS。 |
| 邊界／無位移不取得假閱讀 | L-8七類×五時序N=2、無輸入對照／新noop取代舊候選；保留區可見不等於已知閱讀，須核對來源／狀態證據。BODY失焦、第三方hide、Esc／重開、晚回呼與樣式／佔位清理另驗。 |

定向後沿用現有完整GROK_REVIEW：882矩陣、safe area加焦點區、大字／短畫面L-1、AA／AAA及超大分列、44px／對比、七指定測試／全套無DB與隔離PG、順序／globals／finally、HTTP125／流程20／故障19／md5、舊UI57及未完成M-1／L-4至L-6／API／真頁面雙scroller等。原生雙scroller若新結構只剩一個，舊結構對照與新等效要求分列，不能直接skip取綠燈。有效同版本檢查不無故重跑；受修改影響或先前受阻者須補驗。新結果分列實做／引用／推斷／未測／受阻／作廢，既有真手機、Safari、讀屏、系統字級等限制保留。

## F. 待使用者決定

是否接受上述**單一整張名冊捲動區＋不覆蓋內容的焦點保留區**？可見差異是高畫面也不再固定三段，焦點必要時停在獨立區域；原職業／配套／折疊／返回功能及已接受視覺保留。不等同先前A自動涵蓋，也不代表正式全UI重設。若希望完整保留目前分段呈現，需要另行定案兩owner閱讀交接與可靠備援，本摘要不能宣稱只避碰就四要求全解。

第一段完成。請確認修復方案；確認後把 effort 切換為 xhigh，回覆『已切換，繼續』。

## 第二段：xhigh 實作交接（2026-10-11，尚未驗證）

### 版本、範圍及來源

分支仍為 `codex/phase27-mobile-ui`，HEAD／本次補丁 BASE 為 `7fbcdd8c0d471505b5c540c5d7884d883f865294`。TARGET：`__待第三段限定提交並推送後填入完整SHA__`。最近有效外部結果仍是上述版本的 t74u FAIL；本地新補丁未由 Critic 驗證。上一輪十一檔提交授權已用於該 HEAD，本段沒有新 commit／push 授權，亦未提交、推送或送驗。

本段實際修改七檔：

1. `src/web/starter-catalog-focus-dock.ts`：實際節點呈現、操作交易、樣式還原及共用可見範圍／導航幾何。
2. `src/web/StarterKitCatalogPanel.tsx`：單一 owner、保留區、事件接入、目的畫面定位及修正世代。
3. `src/web/starter-kit-catalog.css`：僅本 Sheet 的捲動、保留區、定位及無 containment 的響應式樣式。
4. `tests/starter-catalog-focus-dock.test.ts`：補寫幾何、擁有權、交易及還原案例，**全部尚未執行**。
5. 本文件：保留第一段決策與精簡實作交接。
6. `docs/development/PHASE_33_STARTER_KIT_CATALOG.md`：補記待驗證狀態及本交接連結。
7. `docs/development/PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md`：補記第三段必讀交接與驗證界線。

其餘既有未提交修改保留，不能納入本次限定提交而未另核對授權。沒有修改 reading 演算法／包裝／250ms 期限、既有 reading 測試、共用 class-catalog.css、Canon、正式數值、API、載入期限、DB、發放、角色或保存契約。

### 實際處理順序與行為

- **先處理交易／還原（G2、Low）：** CSS 擁有權保存 setProperty 後的實際序列值及 priority；還原仍保留第三方後續覆寫。primary pointerdown 到相符 pointerup／cancel 期間延後失焦釋放，停止移動既有按壓目標，也不建立新 dock。up／cancel 的 native target 已決定後才還原；不攔截預設 click、不合成 activation、不新增 timer。失焦到 BODY 有 focusout 入口；window focusin 核對實際焦點；明確導航及關閉結束交易。轉向中仍有按壓時保留待呈現焦點，相符 up／cancel 後再處理，不把它當閱讀權限。
- **再接入空間／單一 owner（G1、G3、G5）：** 所有尺寸只由 frame 捲動；header／body／footer 的資料、原生 details 及按鈕仍在原處。frame 外永久保留焦點區，實際控制項必要時以普通 fixed 定位在該區，原節點／父節點不變，沒有複製／假焦點／穿透操作。背景保留區為 aria-hidden，實際節點仍在原來的可及樹。移除本 Sheet／body 的 containment，入場改為同期限的淡入以免 transform 形成 fixed containing block；沿用既有色彩、字體、按鈕與操作。資料欄位以限定 flex wrap 保持寬畫面 1：2、窄寬／大字換行，取代此處 container query。
- 保留區按畫面實際控制項高度計算，dock 開關不臨時增減；一般上限為可用 Sheet 高度的一半，最低留 44px 加焦點環及安全區。超大控制項在自身範圍內捲動，不縮字。來源寬度取佔位／父內容區，來源高度取實際內容、邊框及現有 rem 最小高度；後者按 root 字級換算，不因單一控制項文字變大重複倍增。普通節點使用 aria-hidden 空白佔位，summary 仍在原 details，來源 padding 只維持一次並還原。
- **最後統一導航／排程（G4）：** 目的畫面的保留區先量度，再用與 focus observation 相同的 scroll-padding／visualViewport 範圍定位返回列。導航／焦點移走／關閉增加修正世代並取消舊兩幀回呼；回呼在 sampleLayout 前後核對世代。只有明確導頁寫新的 frame 位置；reflow 不搬回舊 scrollTop、不呼叫 nearest、不新增內容錨點。未知位移仍是未知。

上述是程式行為與設計推導，不是 G1–G5／Low 已修好的真頁面證據。

### 已補但未執行的案例

原純幾何斷言保留。補寫：保留區不與 frame 相交且扣安全區；不足 44px 不捏造可用空間；同一節點／父節點／focus／scroll 位置；浮點 padding 序列化及原 priority；第三方覆寫／既有或晚到 popover；文字／root 字級與來源空間；相符或無關 pointerup／cancel、按壓中 reflow／切焦點、失焦到 BODY、導航／關閉及晚事件；共用 16px／24px padding、visualViewport clipping、超大列導航；按壓結束後可處理延後的呈現。

舊 showPopover 取消／拋錯／移除 refocus 的實作特定預期，依使用者已確認的無 popover 方案改為相同環境仍可保持實際焦點、原父節點及清理來源空間；另加 missing API，不 skip、不降低可見／可操作需求。fixture 沒有原生 hit-test、click target、details／focus 演算法、CSS contain／捲動 layout 或 Panel 兩幀事件鏈，不能取代真頁面。

### 第三段指定 Critic 優先事項與限制

使用本交接及實際 diff，只補讀新差異。先核對新的限定提交清單與授權，再取得遠端完整 TARGET；沒有授權就提供具體檔案及命令等待授權，本段不預先擴大。

先重用 t74u G1–G5／Low 及 t73u H-2／F1／F2／L-8 真頁面腳本與對照，再完成 E 與現有 GROK_REVIEW 全回歸。除原定定向案例，務必記錄：

- G1：frame／rail／每個實際控制項及完整焦點環 rect、中心／邊緣 hit-test，六尺寸／三字級／安全區，完整 20 步滑鼠與 touch。不能只看區域的 CSS 宣告就算無遮擋。
- G2／Low：pointerdown→focusout/in→pointerup/cancel→click 的 target、來源 rect／padding 序列值及 priority；wheel 後點另一 summary、Enter／Space、窗外 up、按住 scrollbar 轉向、水平 pointer／touch 反向。按壓延期與 native click dispatch 尚未真測；BODY／Tab／Shift+Tab、第三方 show/hide、五次重開及關閉中各 pending 狀態仍須驗。
- G3：所有高度都量 frame owner、body 不另捲動及可見內容位置。跨原 36rem 界線、N5 Case A／E、中途截限／晚 scroll 不固定歸零。單一 owner 不等於原生 clamp 永不改位置；native clamp 與原 I-A 尚未宣告解決，不加舊位置還原取綠燈。
- G4：返回三尺寸 N3、目的畫面 reserve 高度先於導航、共同 bounds、focus／RO／兩幀次序。舊回呼不能處理新畫面；一般列完全放入可用區，超大列單獨判定起點與可操作性，不能放寬正常列斷言。
- G5：missing／cancel／throw showPopover、第三方 popover；檢查移除 containment 後實際 fixed box、入場／reduced-motion、窄寬資料換行。無 popover 依賴不等於 Safari／舊瀏覽器已驗證。

**仍未證實：** 真 click／touch 的完整事件順序；短畫面、大字與真 safe area 的閱讀高度／44px／6px 焦點環；fixed node 是否完全不被裁切；native details、來源排版與 clamp；Panel 導航／RO／世代完整鏈。保留區不足時 helper 不假造低於 44px 的 box，此情況屬待 Critic 評估的失敗風險，不是接受能力縮限。rem 推算以現有正式 CSS 為基礎，不能稱已涵蓋任意第三方改寫最小高度。真手機、Safari、讀屏、系統字級／網址列與真縮放未測界線保留。

本段沒有執行 build／typecheck／lint／格式／靜態分析／測試／專案瀏覽器驗證，沒有新結果分母或 exit code。第三段 PASS 才整理外部結果及手動核對；FAIL 僅分類與交接、停止並提醒回 ultra。此時可準備的手動核對為：一般點擊／折疊／返回／重讀、轉向與字級後焦點可見且不遮按鈕、閱讀位置不被拉回、Esc／重開清理；工程通過不代替使用者接受。

第二段實作完成，尚待工程驗證。請把 effort 切換為 high，回覆『已切換，繼續』。


## 第三段 high 交接準備（2026-10-11，尚未提交／送達）

依第二段摘要與實際 diff 整理，沒有新增程式補丁。候選提交是上方七檔，加三份全域工作狀態文件，共十檔；保留同檔前次未提交的 t74u 外部結果，其餘既有差異不納入。完整清單、待授權命令及 Git／指定 Critic 當前讀取狀態見[第三段準備](PHASE_33_STARTER_KIT_CATALOG.md#t74u-後第三段交接準備2026-10-11待授權)，完整新 prompt 見 GROK_REVIEW 文末。BASE 未變，TARGET 待新的限定提交／推送授權；未執行工程驗證、未 commit／push 或送達。本段等待提交授權，不重新分析根因或修改修復。

授權更新（第三段）：使用者明確回覆「授權」，批准交付文件列出的限定十檔 commit／push 並送指定 Critic；下方尚未提交的版本模板會在送出前換成遠端完整 SHA。尚無本輪工程結果或使用者驗收。
