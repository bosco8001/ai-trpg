# Phase 33 第七切片：t76u 後 G4 修復計畫摘要

日期：2026-10-12（Asia/Hong_Kong）。目前為第三段限定提交準備：使用者在第二段完成後回覆「已切換，繼續」，其後明確授權「限定五檔 commit／push 並複驗」。本段只處理提交與工程交接，尚未取得遠端新 TARGET 或送驗；第七切片未接受，不推定客戶端實際 effort 設定。A–G 是前兩段的決策、證據與實作交接，當時停止文字由 H 的目前狀態補充。

## A. 版本與已知紅燈

- 分支：`codex/phase27-mobile-ui`。
- 本地 HEAD／診斷 TARGET：`f94aa51cfcf48d980bd571796f79ca0010a1b081`。
- 診斷 BASE／被測 UI：`4ff24fabdcb7638ee958234a44b631a4ee3dd2b9`。f94aa51 只新增探針及 MVP 交接文件。
- 來源：指定 AI TRPG Architecture Critic 的 t76u 三段外部回覆，上一段由 Grok Bot Control 讀回；不是開發代理親測。外部證據 `/workspace/p33g4-evidence/` 尚未下載或獨立核驗。
- 外部重現：844×390、568×320、390×620、844 重開，各有／無探針 N=3，合計 24／24 紅燈。普通字級、safe0、Chrome 154、device scale 2；不能外推所有瀏覽器。
- t75u 的閱讀區低於 158px、第三方 inline padding 被 refresh 覆寫仍 open；原工程 FAIL 仍有效。
- 本段只讀 Git、Canon、程式及交接資料，新增本摘要；沒有執行任何驗證、改程式、commit／push 或新送驗。其他未提交修改保留。

## B. 選定原因與未證實之處

| 原因 | 支持證據與判定 | 修復後可驗證預測 |
|---|---|---|
| 導航貼邊目的值沒有涵蓋實際寫入差額 | t76u：預測 247.484375，實際 scrollTop 247，列底 273.484375 超過範圍底 273；第二 rAF 的嚴格 containment 失敗後 dock。隔離 debugger 改成 248，在相同排程下不 dock。已在外部已測條件支持因果。 | 正常列若存在可行目的位置，寫入後實際 rect 完整落在共同 bounds，後續兩幀不 dock；原版仍紅燈。 |
| 導航之後 reserve 再增高才造成超界 | t76u 的 reserve 49→84、rail 65→100 發生在導航預測前；預先固定 rail 100 仍 3／3 dock。此原因在已測條件被排除，不拿來追加 CSS 補丁。 | 保留相同 reserve 與排程，單獨修導航仍應消除上述紅燈。若失敗先保留證據，不轉而大改 reserve。 |

debugger 的 +1 是因果控制，不是正式修復方案。不同瀏覽器／縮放的可表示捲動位置尚未知；不可宣稱 scrollTop 永遠是整數，也不可把超界小於 1px 當完整可見。

現有 fixture 把 scrollTop 當普通欄位，幾何測試直接用理論 delta 移動 rect，沒有模擬 setter 實際結果、clamp 或 Panel→RO→兩 rAF 鏈。真頁面探針則缺原案 bottom-scroll／Enter／200% 字級的完整組合；setter 實參來自 Critic logpoint，探針只重算預測。這些缺口須在回歸補齊。

## C. 處理順序與方案

選擇最小導航補修；不重做 reading／dock／捲動容器。必要的簡化只限「理論 delta」改為「可行目的位置」，使呼叫端能處理實際 scrollTop 與最大值。

1. 明確返回時，沿用現有取消舊世代、release、先量目的 reserve、preventScroll 取焦順序。
2. 在目前 frame／共同 bounds 計算完整容納正常列的 scrollTop 區間，並與合法捲動範圍相交。以目前位置 s、列上／下邊 T／B、範圍上／下邊 U／V 表示，垂直區間為 `[s + B - V, s + T - U]`，再限制於 `[0, maximumScroll]`。
3. 有可行整數位置時，優先在此區間內朝可見區內側選最接近原導航目的值的位置：底部超界取向上整數、頂部超界取向下整數，但不得越過另一邊。已完整容納的列不額外移動。這是目的位置的選擇，不放寬 containment。
4. 區間只有分數位置或為空時，分開處理；不能四捨五入成不存在的可行位置。分數可行保留幾何目的值，超大列沿用顯示起點；實際 clamp／仍超界須明列，不冒稱成功。
5. 寫入後立即讀實際 scrollTop／rect，再建立焦點基準；以實際完整可見為完成依據。不新增 timer、rAF、重試迴圈或 suppress-dock 權限，不在後續 reflow 重寫位置。
6. 玩家閱讀及未知位移沿用原處理；邊界／無位移不新增閱讀權限。若本次單次目的位置選擇仍無法滿足正常列，停止擴大補丁，帶實際讀回證據回第一段，不自行新增再次捲動。

預期使用者可見結果：返回後仍聚焦原職業列，正常列留在閱讀區；定位可能比原貼邊位置向內不足 1 CSS px。按鈕、焦點欄樣式與閱讀操作不改。

## D. 最小改動範圍

程式／測試候選五檔：

- `src/web/StarterKitCatalogPanel.tsx`：返回導航呼叫與實際結果交接。
- `src/web/starter-catalog-focus-dock.ts`：可行目的位置計算；不改 style write／release。
- `tests/starter-catalog-focus-dock.test.ts`：分數位置、兩邊限制、最大值與無位移案例，保留原需求斷言。
- `tests/browser/starter-catalog-g4-probe.mjs`：補準備／操作選項及原列嚴格幾何證據；不以 dock 後位置冒充原列成功，不增加觀察窗口掩蓋短暫 dock。
- 本摘要：第二段交接及限制。

新授權的實際提交範圍以第二段完成後的 diff 為準。舊授權已完成，本摘要不授權 commit／push。CSS、reading、Canon、正式數值、API、保存契約不在本次補修範圍。閱讀高度與樣式擁有權須各自限定補修，仍屬同一切片。

## E. 四項要求與回歸

全部交指定 Critic 執行；開發代理可以補案例，但不自行跑。

1. **可見焦點不消失：** G4 三尺寸 × 原四情況 N=3，補滑鼠／Enter、先捲到底、普通／200% 字級及有／無探針。保存實際讀回、原列 rect、bounds、全程 dock 狀態；正常列嚴格完整容納，超大／clamp 分列。轉向／中途截限 H-2 仍需回歸。
2. **主動閱讀不打斷：** Home 同幀 resize、PageUp、wheel 相關次序，以及一般閱讀；本次導航不延伸為 reflow 修正。
3. **未知來源不拉回：** prototype scroll、非焦點 SIV、text fragment 與後續 reflow；未知保持未知，無新增 scroll write 或讀取權限。
4. **無虛假閱讀權限：** L-8 邊界／無位移，導航 repair 保持內部操作；關閉、重開、晚到回呼及清理不退化。

先定向確認本版修 G4、原版仍紅燈，再按既有 Phase Spec 完成必要完整回歸。不能把本次 G4 綠燈當整個切片 PASS；158px、44px、完整焦點環、第三方樣式問題與其餘既有要求仍保留。

## F. 待使用者決定

請確認是否採上述「只修返回導航的可行目的位置」方案。沒有新玩法選項，也不批准降低尺寸／焦點要求；短屏呈現方案與樣式擁有權留待各自補修。

第一段當時停止界線：請確認修復方案；確認後把 effort 切換為 xhigh，回覆「已切換，繼續」。使用者其後已回覆，第二段結果如下。

## G. 第二段實作交接（尚未驗證）

### 版本與精確範圍

本地 HEAD 仍為 `f94aa51cfcf48d980bd571796f79ca0010a1b081`，分支不變；四個程式／測試檔原先沒有未提交差異。只修改下列五檔，包含上一段新建、尚未追蹤的本摘要。其他既有修改與未追蹤目錄保留，不納入本次候選提交。

1. `src/web/StarterKitCatalogPanel.tsx`
2. `src/web/starter-catalog-focus-dock.ts`
3. `tests/starter-catalog-focus-dock.test.ts`
4. `tests/browser/starter-catalog-g4-probe.mjs`
5. `docs/development/PHASE_33_G4_REPAIR_PLAN_T76U.md`

### 實際行為與理由

- 新增 `starterFocusNavigationTarget`，以目前 scrollTop、實際共同 bounds、原列 rect 與合法最大值計算絕對目的位置。完整可見的列保留目前分數位置；正常列的可行區間有整數時，朝內側選擇最近合法整數，不能越過另一邊。只有分數位置、範圍截限或超大列時保留幾何目的值／起點政策，不捏造可用空間。
- Panel 只在明確返回流程使用新目的值，與目前值不同才寫入。沿用 reset 世代、先量 reserve、preventScroll 取焦及 reading.repair；既有 repair 在寫後讀取實際 scrollTop，既有 recordFocus 在寫後量實際 rect。沒有新增產品 timer、rAF、重試、容差、suppress-dock 或閱讀權限。
- 原 `starterFocusNavigationDelta` 與原幾何斷言保留，用於舊算法對照及超大列起點。沒有改閱讀分類、捲動容器、樣式 write／release、CSS、Canon、正式數值、API 或保存。
- 八個新單元案例使用可記錄單次寫入、按實際讀回移動 rect 的隔離 setter 模型：t76u 三個分數殘差、頂部絕對位置、完整可見無位移、分數可行但無整數、最大值截限、超大列起點。每個模型的量化政策明列，不冒充瀏覽器或 RO／rAF。
- 真頁面探針新增 `entryAction`／`returnAction`（click 或 enter）、`scrollToBottom`（原生 wheel 並確認到達底部）、`reopenBeforeEntry`（配套進入前 Esc 關閉／重開）。普通／200% 字級及尺寸仍由 Critic 的 driver 設定，證據記錄實際 root 字級與準備時 scrollTop。沒有放寬原斷言、增加觀察窗口或 skip。
- 探針分列 `sourceRow`、來源 placeholder 與 `rowInlineContained`，新增嚴格原列位於閱讀區的成功條件；焦點欄位置不能冒充原列成功。記錄最早觀察到的原列焦點樣本 `firstReturnedInline` 及操作後樣本；這不是同步 setter 觀察，也不保證抓到每個中間狀態。

### 尚未執行的驗證及限制

- 所有新案例、既有單元、build／typecheck／lint／格式、PG、瀏覽器及 UI 檢查均未由開發代理執行。本段只閱讀 Git diff／程式，不能稱工程 PASS。
- Critic 先用相同修訂探針對照原 UI，確認原版仍紅燈、新版是否綠燈；先完成普通字級三尺寸有／無探針 N=3，再補 Enter／bottom-scroll／200% 與原 t75u 四情況。核對實際寫入／讀回可重用隔離 logpoint，不把探針的 `projectedScrollTop` 當 setter 實參；該欄仍刻意代表舊幾何目的值。
- 新探針的 Enter 是 locator 取焦後發鍵，不是逐 Tab 的獨立完整鍵盤操作。重開選項只覆蓋明列的準備；原四情況須由 Critic 查原 driver／trace 對照，不能直接宣稱等價。準備失敗（如 wheel 無法到達底部）由 driver 保存證據並另列受阻，不算 G4 修復或退化。
- 維持 24 幀／400 筆限制、保存先於紅燈斷言、有／無探針對照。無探針只觀察結束狀態，不能證明過程從未短暫 dock；新探針仍可能影響 layout，bounds 公式與產品同源。需要 Critic 的獨立幾何／時間線核對。
- 不假定所有瀏覽器都接受整數 CSS px。若正常列仍因實際可表示位置或截限而超界，保留紅燈，回第一段分析，不追加二次捲動或降低完整可見斷言。
- 閱讀區低於 158px與第三方 inline padding refresh 覆寫仍 open，本次不處理；t75u 工程 FAIL 仍有效。正式修復後必要完整回歸沿用 E 及既有 Phase Spec，G4 PASS 不能當切片 PASS。

### 下一段交接

第三段只依本摘要與五檔 diff 核對限定提交、授權與遠端 TARGET，準備並送指定 Critic。舊 commit／push 授權已完成，本段沒有新提交授權，也未新送驗。不要重新展開根因分析或順便修另外兩項缺陷。

第二段實作完成，尚待工程驗證。請把 effort 切換為 high，回覆「已切換，繼續」。

## H. 第三段：限定提交與完整複驗要求（已授權、未送達）

已讀取本地 Git 狀態、分支、完整 HEAD、暫存清單與五檔交接；HEAD 仍為 `f94aa51cfcf48d980bd571796f79ca0010a1b081`，暫存清單為空。四個追蹤中程式／測試檔加 186 行、刪 22 行；第五檔為本新摘要。這是 Git 資訊核對，不是工程驗證。

使用者的 effort 切換／繼續只授權第三段交接；其後已另行明確回覆「授權限定五檔 commit／push 並複驗」。依 AGENTS.md 第 4 節，現在按這份限定授權執行，不延伸到其他修改。不能先送 f94aa51 冒充修復版本；本節為提交前紀錄，尚未取得新 TARGET 或將草稿貼入 bot composer，送達另行讀回記錄。

### 精確五檔命令（取得授權後才執行）

若 HEAD 改變，先核對新增差異。若暫存清單有其他工作，先停止提交，保留原工作；不能直接混入或自行清空。

```sh
git status --short
git branch --show-current
git rev-parse HEAD
git diff --cached --name-only
git add -- src/web/StarterKitCatalogPanel.tsx src/web/starter-catalog-focus-dock.ts tests/starter-catalog-focus-dock.test.ts tests/browser/starter-catalog-g4-probe.mjs docs/development/PHASE_33_G4_REPAIR_PLAN_T76U.md
git diff --cached --name-only
git diff --cached --stat
git commit -m "fix(web): keep starter return navigation within visible bounds"
git push origin HEAD:codex/phase27-mobile-ui
git rev-parse HEAD
git ls-remote origin refs/heads/codex/phase27-mobile-ui
```

須確認本次 commit 精確五檔、遠端完整 SHA 與本地一致，再以該完整值替換下方 TARGET。文件不能自引尚未生成的 commit SHA；下方是明確提交前模板，實際送出原文與讀回紀錄提供新版本身分。其他未提交修改與目錄均保留。

### 完整 Grok 複驗 prompt（提交前模板）

```text
請指定 AI TRPG Architecture Critic 對 Phase 33 第七切片完成 t76u 後的 G4 限定補修工程檢查。由 Codex 實作，你負責工程驗證；不要修改或 commit／push repository，不轉其他 bot，不代使用者驗收，不開始下一主要切片。

Repository：https://github.com/bosco8001/ai-trpg
分支：codex/phase27-mobile-ui
本次補修 BASE：f94aa51cfcf48d980bd571796f79ca0010a1b081
本次補修 TARGET：__待限定五檔提交並推送後填入完整SHA__
原被測 UI：4ff24fabdcb7638ee958234a44b631a4ee3dd2b9
t75u 原對照 BASE：7fbcdd8c0d471505b5c540c5d7884d883f865294

先核對完整版本、遠端 HEAD、祖先與精確五檔：
src/web/StarterKitCatalogPanel.tsx
src/web/starter-catalog-focus-dock.ts
tests/starter-catalog-focus-dock.test.ts
tests/browser/starter-catalog-g4-probe.mjs
docs/development/PHASE_33_G4_REPAIR_PLAN_T76U.md
未取得可讀 TARGET 不得以 BASE、診斷提交或舊 PASS 作本輪結果。TARGET 的本文件 H 是提交前模板，實際送驗訊息的完整 SHA 才是身分；不要將模板待填文字當成已發佈修復 SHA。

先讀 TARGET 的 AGENTS.md、CANONICAL_MANIFEST.md、OPEN_QUESTIONS.md、PHASE_33_STARTER_KIT_CATALOG.md、PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md、PHASE_33_G4_DIAGNOSTIC_MVP.md、本次 REPAIR_PLAN_T76U 的 C／G／H；正式 docs/gameplay/starter_kits.md、character_system.md、classes.md、magic.md、combat_system.md 沿用。既有 Phase Spec／GROK_REVIEW 必要回歸與需求仍有效，本 prompt 只更新版本與五檔範圍，不減少完整可見、158px 閱讀區、44px 控制及完整 6px 焦點環要求。

重用你 t76u /workspace/p33g4-evidence/ 與 t75u /workspace/p33w75-evidence/ 的 SUMMARY、JSON、trace／driver；已清理的腳本不得冒稱仍存在，必要時重建並明列差異。t76u 外部 24／24 穩定紅燈：三尺寸與844重開、有／無探針各N3；Chrome154、device scale2、普通字級、safe0。其隔離 logpoint 顯示 reserve 先增高再導航，預測247.484375／實際247／列底273.484375／bounds底273，第二rAF嚴格判定後dock。預先固定rail100仍紅燈；debugger改scrollTop到248在原排程下不dock。這是已測條件的診斷證據，不是正式 +1 或容差方案，也不證明所有瀏覽器整數量化。

本次只修明確返回導航：依共同bounds與合法最大值計算完全容納原列的scrollTop區間；有可行整數時朝內側選最近合法整數，已可見位置不多移動。分數-only／clamp／超大列不捏造空間；既有repair讀實際位置、recordFocus量實際rect。嚴格containment、世代／RO／兩rAF、reading來源與250ms、CSS／永久rail、樣式write／release均不改，沒有新產品timer、重試或抑制dock權限。Canon、數值、API、保存、配套發放與戰鬥未改；Codex沒有執行任何工程驗證，新八個單元案例與探針均尚未執行。

先準備隔離 BASE／TARGET production 真頁面，逐版本報 npm ci、npm run build、必要隔離 npm run db:migrate 的完整命令及 exit code，記 Node／npm／PG／OS／Playwright／Chrome、headless／有頭、device scale、字級、safe、縮放方法、服務 SHA。runtime 套件只在證據工作目錄，不改 repository 依賴；不碰正式 DB／5432。

先跑定向真頁面：
1. G4 紅→綠：同一修訂探針／driver分別載入 BASE UI 和 TARGET UI，普通字級safe0，844×390／568×320／390×620，有／無探針各N3；BASE應仍紅燈，新版結果如實報。再對照t75u原四情況，補先捲到底、Enter進入與返回、重讀／關閉重開及普通／200%字級。原四情況準備若無法確認，另列推斷或受阻，不冒稱等價；原版與新版使用相同有效初始化。
2. 使用 probeStarterCatalogG4 的 entryAction／returnAction、scrollToBottom、reopenBeforeEntry；字級與尺寸由driver設定並報實際值。Enter為locator取焦後發鍵，逐Tab完整鍵盤另測；重開選項僅進入配套前關閉重開。底部準備失敗由driver保存證據、另列受阻。onEvidence先保存JSON／trace／截圖再斷言；24幀／400筆有界限制、有／無探針的觀察干擾風險保留。
3. 保存導航實際setter實參與讀回scrollTop、原列／來源placeholder／frame／rail rect、bounds、focus／scroll／RO／rAF次序。可用你隔離logpoint核對單次導航；不以probe projectedScrollTop（仍為舊幾何預測）當setter實參。firstReturnedInline只是最早觀察樣本，不能冒稱同步setter或捕獲所有中間狀態。有／無探針或logpoint結果矛盾，先定位干擾，不直接PASS。
4. 正常列在原閱讀區完全容納、焦點保留、全程無已觀測dock，嚴格上下左右條件不加容差；焦點欄或來源佔位不得冒充原列成功。分數-only可表示／不可表示、合法最大值clamp、頂部返回、已完整可見無位移、超大列起點與可操作性分列。正常列仍失敗即保留紅燈，不加 +1／二次scroll／新timer代修復。八個setter模型須確認能抓舊算法殘差，但不能代替Panel原生鏈。
5. 無玩家操作的轉向／中途截限：G3／H-2 Case A／E及既有轉向、36rem界線、640↔620、scroll早／晚、第一／第二rAF及晚到截限，原可見焦點不完全消失、閱讀不歸零；保留未知分類。
6. F1：Home同幀844×390→844×389微resize、PageUp、ArrowUp與無resize對照，受信任鍵盤headless／有頭N5；wheel compositor／sample／wheel／scroll兩種次序N5，受信任／合成分列，smooth不被打斷。F2：prototype scrollTo／scrollTop、非焦點SIV、text fragment、CDP、不可配置descriptor、第三方第一／第二rAF遇reflow；0／300／300.5／max−1／max及五時序展開，未知不被拉回也不冒充閱讀，原分母與clamp分列。
7. L-8：既有七類×0／1frame／249／250／300ms、N2；End／ArrowDown／同值setter／無效scrollTo／NaN scrollBy／邊界wheel等，無輸入對照、noop前後、未知clamp後新noop、命令取代舊來源與結束輸入不取得虛假閱讀權限。內部狀態不可直接讀時另列受阻，不把passive trace當直接證明。
8. 一般閱讀與清理：既有H-1十七案headless／有頭N3、單步／連滾／反向、600ms smooth、無scrollend、fractional／max與部分／完全不可見焦點、包裝契約及第三方override。Esc第一／第二rAF、smooth／pointer／timer中關閉、五次重開：入口焦點／背景位置保持，refs／wrapper／listener／RO／rAF／timer／class／樣式／來源空間清乾淨，停定1秒活動0，無震盪／page error。

定向之後按結果完成既有必要完整回歸，不能以省token跳過需求。若紅燈阻塞某段，列受影響／未完成而非PASS；同版本有效檢查可引用，受新改動影響或原FAIL／受阻項目需重驗：
A. 六尺寸／三種字級／七停點882矩陣或充分等效，AA／AAA、超大／部分可見分列；M-1／L-2至L-6、safe top47／bottom34及0原24組加dock，158px閱讀、44px操作、完整6px框、安全區／橫溢出／對比≥4.5與原視覺。G1／G2／G5原點擊／觸控／summary／失焦／第三方popover清理與完整20步。未改CSS不代表導航停點免驗。
B. git diff --check 完整BASE TARGET（由你執行）；node --import tsx --test tests/starter-catalog-reading.test.ts tests/starter-catalog-focus-dock.test.ts tests/starter-kit-catalog.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts；npm test 無DB及新隔離非5432 PG／role／DB。reading＋focus-dock＋starter-kit正反序各兩次，globals／finally／worker污染及M-2原cleanup斷言。逐命令exit／pass-fail-skip，無DB skip不當PASS，不降低舊斷言／skip案例／改契約求綠燈。
C. 兩名冊production HTTP125／主流程20／故障19、慢載入取消重開重試、GET only；loader／API／kind／resolve／complete與守衛必要回歸，出生／state／revision／HP／MP／三槽／八表md5不變；舊UI四尺寸57畫面與M4b／M4c／M6a。t75u已完成數字保留為舊版引用；有可靠同版等價證據才可引用省重跑。歷史Info／未測／作廢／受阻保留，不順便宣告解決。

本次仍未修 t75u 閱讀區低於158px（safe47/34、568×320為137px等）及第三方inline padding在refresh後被覆寫。這兩項不是已接受縮限，請評估是否維持／退化並繼續列缺陷，不能因G4綠燈宣布第七切片整體PASS。G4限定補修結果與整個切片工程結論分列；新缺陷同樣記錄，不以「不在改動範圍」免報。

回報完整TARGET／BASE／環境、逐版本命令與exit code、各分母及pass-fail-skip；High／Medium／Low／Info的精確位置、重現、預期／實際、證據與最小受影響範圍。分列實做、引用、推斷、未測、受阻、作廢；真手機／讀屏／Safari／系統字級／真safe／Android網址列／Chrome搜尋／真Ctrl-wheel等未做照列，不能由Chrome／CDP替代品推成通過。保留證據與SUMMARY，清理本輪隔離服務、Page、DB／role／cluster，不改舊證據或5432。

回覆後Codex只整理結果。PASS仍待使用者驗收；FAIL只整理分類、證據與範圍，停止追加補丁，提醒使用者把effort切回ultra再繼續分析。請不要代修復或自行結案。
```

### 送達與結果停止界線

取得限定授權、bot 可讀完整 TARGET 後，使用 Grok Bot Control 從當次介面確認 AI TRPG Architecture Critic、composer 與最新回覆；準備完整原文，核對防重送紀錄，單次送出並讀回完整新 outgoing 與空 composer。未確認不得寫成已送驗，模糊狀態不重送。

收到結果後，依前述 PASS／FAIL 分類整理；目前新工程結果仍待驗證。若工程仍 FAIL，停止實作並提醒：「工程仍 FAIL。請把 effort 切回 ultra，回覆『已切換，繼續分析』。」
