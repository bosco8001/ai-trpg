# Phase 33 第七切片：t77u 後剩餘補修計畫摘要

日期：2026-10-13（Asia/Hong_Kong）。A–F 為第一段分析與已確認方案；使用者其後回覆「已切換，繼續」，第二段限定本地實作已完成，尚未工程驗證，詳見 G。沒有提交／推送或送出新修復版本，不推定客戶端實際 effort 設定。使用者已確認「接受限定方案，極短視窗仍列未解決」；只批准限定呈現方向，不降低原需求，不接受第七切片，也不授權 commit／push。

## A. 版本與紅燈

- 分支 `codex/phase27-mobile-ui`；目前 HEAD／外部 t77u TARGET `a061fe25f534f239daf514843df2f127c510ce12`，BASE `f94aa51cfcf48d980bd571796f79ca0010a1b081`。程式與測試沒有未提交差異；其他既有文件及原型差異保留。
- [t77u 外部結果](PHASE_33_G4_REPAIR_PLAN_T76U.md#j-t77u-外部工程結果2026-10-13-讀回)：G4 限定補修 PASS、整體仍 FAIL。核心 BASE 18／18 紅、TARGET 18／18 綠，Tab 6／6 綠；不重做已修導航。證據 `/workspace/p33t77-evidence/` 未由 Codex 下載或獨立核驗。
- 剩餘 Medium：568×320、CDP safe47／34 閱讀區 137px；844×240 為 138px，低於 158px。t75u 的 844×200 名冊 99px／配套 133px 是舊版本外部結果，不當作 t77u 重測。
- 剩餘 Low：第三方 padding 12px 被 refresh 改成 49px，release 後遺失。新工具 Low：390×620 探針算出捲動上限 253、實際停 252，準備步驟 timeout。兩版產品 padding 現象相同；探針問題不是產品缺陷。
- 完整矩陣、safe+dock、對比度、H-1 其餘九類／wrapper、API／舊 UI 等回歸未完成；兩個重建腳本 `ok` 旗標的取樣基準有問題，尚未指明檔名／案例。不能把 t75u 或不可靠旗標當本輪 PASS。

## B. 三個主要原因與證據門檻

| 原因假設 | 支持證據 | 可驗證預測／未證實之處 |
|---|---|---|
| 1. 永久焦點欄按最高控制項預留，沒有聯合閱讀高度預算 | Panel `measureReserve` 取所有控制項最高來源高度；CSS rail 按該值、16px 框空間及 bottom safe 配高，frame 可縮至零。320−47−2−134＝137、240−2−100＝138 與外部結果吻合。 | 在物理空間足夠時，只限制 rail 的分配上限應能恢復閱讀區，不需改 reading。這是程式與算式推導，尚未真頁面驗證；158px 原始量測口徑、縮放後實際 viewport 仍須對齊舊證據。 |
| 2. 擁有權只在 release 檢查，refresh 已先覆寫第三方值 | helper `write()` 每次 setProperty，僅首次保存 previous；`position()` 反覆更新 DETAILS padding。fixture 只有外部寫入→立即 release，漏了外部寫入→refresh→release。 | 寫前核對實際 CSSOM value＋priority 並永久交回該 property，應保住 12px／priority；自動 release→repin 也不得搶回。後者是待驗復發風險，沒有 t77u 真頁面證據。 |
| 3. 探針把量測上限當成必定可達的位置 | 準備固定等待 scrollTop ≥ scrollHeight−clientHeight，外部 253／252 差額使其 timeout。 | 同一次原生 wheel，以有界量測差判斷準備，應能進入原 G4 流程；產品 strict containment 仍不變。具體量化來源未證實，不把外部「clientHeight 有小數」說法當根因已定。 |

CSSOM View 將 `scrollHeight`／`clientHeight` 定為 `long`，`scrollTop` 定為 `unrestricted double`；因此必須取得原始欄位，而非直接採信「clientHeight 有小數」（[規格](https://drafts.csswg.org/cssom-view/#extension-to-the-element-interface)）。這只核對 API 定義，不是 Chrome 本案實測。

fixture 缺口：rail rect 是預置值，不會經 flex、字級、安全區分配空間；Style fixture 沒有外部改動後反覆 refresh 的鏈；navigation setter 模型不涵蓋原生 wheel／CSS 尺寸／Panel→RO→rAF。補 helper 斷言可以鎖擁有權，不能替代這三條真頁面紅燈。

## C. 選定方案與處理順序

保留單一 frame、現有實際焦點節點／父節點、原生 details、按壓交易、G4 可行目的位置及 reading 演算法。game-ui-ux 約束焦點／閱讀流程，ui-ux-pro-max 約束空間／可讀性／44px，apple-design 約束字體／操作回饋；三者服從已確認設計及 Phase 要求，不引入新視覺系統。

### 1. 先修樣式擁有權

- 每個 property 分為未接管、自己持有、已交回外部。自己持有時，每次 write 先比較實際 value＋priority 與上次自己讀回的序列值；不一致即交回。
- 已交回的 property 不再寫入、不在 release 還原、不因自動 repin 重新接管。建議交回記憶留到本次 Sheet helper dispose，按 node＋property 保存；其他自己持有的樣式仍正常更新／還原。外部後續再次改值或改回舊 dock 值也不解除記憶。
- 不靠新增 observer／timer、改 previous 或把外部 padding 再加一層來取得表面成功。既有 pointerdown→up／cancel 延後處理保留。
- SUMMARY 來源空間完全靠 DETAILS padding。外部改成 12px 本身可能縮短來源空間、造成原生 clamp；本修復不反向干預外部值、不把 clamp 當閱讀，也不拉回舊位置。若真頁面證明原生操作／可達性因此不滿足現有需求，停止，回 ultra 討論獨立來源 spacer；不順便改 DOM 結構。比較 guard 無法識別觀察前已完成的同值 ABA 或任意 stylesheet 改寫，不宣稱全面第三方相容。

### 2. 再限制永久欄的空間預算

- 空間預算只依 Sheet 實際可用尺寸、安全區及字級；有／無 dock 使用相同欄高，不在取焦或玩家閱讀時臨時開關整條欄。
- 按目前外部 frame 高度口徑，令可用高度 A＝Sheet 高度−top safe−上下邊框，rail 最低 L＝44＋8＋8＋bottom safe。在 A≥158＋L 時，rail 不高於 A−158，同時不低於 L；高畫面沿用原預留值，不縮字、觸控項或完整焦點框。
- **算式預測：**568×320 safe47／34，A＝271、L＝94，可限制 rail≤113、保留 frame158；844×240 safe0，A＝238、L＝60，可限制 rail≤80。較長控制項沿用自身內部捲動，玩家可見底欄較小；使用者已接受這項限定呈現。
- 844×200 safe0，A＝198，158＋60＝218，分離的兩區放不下。使用者明確確認這輪仍列未解決；不把焦點欄覆蓋閱讀內容、不宣告此案例通過、不隱藏或 skip。真縮放後的可用高度也須實量，不能用未縮放 window 高度代替。
- 158 最初出自舊外部可讀 viewport 結果，未命名原始欄位；現有 frame 上下 scrollPadding 另影響焦點 bounds。Critic 必須同報 frame／client／visualViewport 交集與扣 scrollPadding 的 bounds，對齊舊口徑，不能把 raw158 冒充 bounds158。若舊契約實指扣除後高度，本算式前提被推翻，停止擴大補丁，回 ultra；不自行換口徑取綠燈。
- 最小候選是本 Sheet 限定 CSS 上限；不重寫 `measureReserve`、來源分類、等待時間、捲動容器或清理。若 CSS 百分比／可視範圍無法表達該預算，再回報必要 Panel 量測接入，不默默擴大。

### 3. 最後修探針準備及證據保存

- wheel 前後保存 scrollTop、scrollHeight、clientHeight、rect、root 字級、viewport、計算 maximum 與剩餘差。準備最多接受 1 CSS px 量測差，須在相同原生瀏覽器用原始數值核對；不將此容差放進產品幾何／導航／閱讀斷言。
- 保留一次原生 wheel、原等待上限，不新增重試或加長 timeout。原本不在底部須有正向實際位移；已在底部另記 alreadyAtBottom，不假稱 wheel 產生閱讀。無範圍、未移動又不在底部、差值過大或尺寸持續變動列 BLOCKED。
- 準備失敗也要先保存 JSON／截圖／錯誤及 case ID，再拋出；不能只有外層 timeout。原完整可見、同焦點、無已觀測短暫 dock 等斷言不放寬；無探針末態不代表全程證明。

不選「只加 frame min-height」讓兩區擠出 Sheet、依 dock 才縮／展欄、全欄固定44px或全面重做呈現；前兩者轉移裁切／閱讀跳位，後兩者擴大已接受 UI 的變化，仍不能消除物理不足。

## D. 限定範圍與停止條件

第二段候選五檔，依上方順序一次處理一個原因：

1. `src/web/starter-catalog-focus-dock.ts`：逐 property 寫入擁有權；G4 導航不改。
2. `tests/starter-catalog-focus-dock.test.ts`：外部改動→多次 refresh→release／repin／dispose。
3. `src/web/starter-kit-catalog.css`：限定 rail 高度預算，保留最小項目／框／安全區。
4. `tests/browser/starter-catalog-g4-probe.mjs`：準備判斷及失敗證據，不改產品斷言。
5. 本摘要：第二／三段交接；實際範圍以完成後 diff 為準。

Canon、數值、API、出生／角色／Run／Save、其他 UI、reading、G4 目的位置不在本輪。Panel 目前只讀；若需要新增程式接入或獨立來源 spacer，先停止擴大範圍並說明矛盾。此清單沒有提交授權。

## E. 回歸與工程交接

所有工程檢查交指定 Critic，Codex 不執行。先用相同有效準備對照 BASE／新 TARGET 的三條紅燈，才完成必要回歸；留下極短視窗紅燈及本輪結果界線。

| 必守要求 | 定向真頁面案例 |
|---|---|
| 原可見操作焦點不完全消失 | H-2 無玩家輸入轉向／中途截限；短屏／字級還原、欄高 cap／最低值、按壓中 resize；同節點／父節點、44px、完整框、hit-test、安全區。G4 普通／200%／Tab／Enter／底部返回，正常列嚴格完整可見。 |
| 玩家閱讀不被打斷 | F1 Home 同幀 resize、PageUp、wheel 次序；H-1 全17類與 wrapper、一般 touch／wheel、summary 開合。欄高不因 dock 開關變動，不取消閱讀或寫舊位置。 |
| 未知捲動不被拉回 | F2 prototype、非焦點 SIV、fragment、CDP／descriptor／第三方 rAF→reflow；padding 接管→refresh→原生 clamp 另列，不改成已知閱讀或允許拉回。 |
| 邊界／無位移沒有虛假閱讀權限 | L-8 七類×五時序、工具 alreadyAtBottom／no-range／未移動另列；Esc pending 清理、失焦、五次重開、dispose 後 late refresh／repin 不接管或重建。 |

樣式另驗 value／priority／移除、外部改回舊 dock 值、同焦點 release→repin、root 字級、兩 summary 交替及無外部變動的原樣還原。工具另驗390×620原253／252準備、有／無探針；原版 G4 紅→新版綠，不以準備綠代替產品結果。

完整驗證沿用 [既有交付要求 H 段](PHASE_33_G4_REPAIR_PLAN_T76U.md)及 Phase／GROK_REVIEW：882或充分等效、safe24＋dock／對比／G1–G5、HTTP125／流程20／故障19／md5、舊UI57／M4b／M4c／M6a、build及指定／全套無DB和隔離PG。t77u 未完成與受阻不能省略；新改動會影響原結果時需重驗。

Critic 須將完整可重跑 drivers、fixture 來源、環境／實際命令、case 清單、原始 JSON／trace／截圖及 exit code 留在證據目錄，再清暫存環境，避免下輪重建。先查 SUMMARY 定位兩個不可靠取樣腳本及案例，不能沿用其 `ok` 旗標。分列實做／引用／推斷／未測／受阻／作廢；缺陷解決與整體結論分開，極短需求未解時整體仍 FAIL。

## F. 使用者決定與下一段

**已確認：**限定欄高、長控制項在欄內捲動；極短視窗本輪保持未解決，不降低158／44／框要求、不宣告切片通過。沒有其他新玩法或使用者決定。158 的量測口徑、樣式接管後原生來源空間及探針量化來源是待工程證據，不冒充使用者已確認。

第一段當時只新增本摘要並停止；使用者其後回覆「已切換，繼續」，第二段結果如下。

## G. 第二段實作交接（2026-10-13，尚未驗證）

### 實際範圍與版本

HEAD／本輪新補丁 BASE 仍為 `a061fe25f534f239daf514843df2f127c510ce12`，分支不變。只修改 D 段的四個程式／測試檔及本摘要，共五檔；四個已追蹤檔的 `git diff --numstat` 為加 243 行、刪 32 行。本摘要仍未追蹤，不包含在該統計。其他既有修改保留，沒有改 Panel、reading、G4 導航、Canon、正式數值、API 或保存契約；未 commit／push、未送新版本。

### 行為與實作順序

1. **樣式擁有權：** helper 用本次生命週期的 `WeakMap<node, Set<property>>` 記住外部接管。write 及 release 都先比較實際 CSSOM value＋priority；一旦不符，該 property 的後續更新／復原／repin 均跳過，其他仍持有的幾何屬性照常運作。沒有新增 observer、timer、捲動修正或焦點搬移，原按壓交易保留。
2. **空間上限：** 只在 starter CSS 的永久 rail 高度加入 `max(0px, calc(100% - 158px))` 上限，沿用原來源高度及50%上限；原44px＋16px＋bottom safe 最低高度仍優先。欄高不依 dock 開關，長項目沿用原內部捲動；沒有替換 `measureReserve`、改字體／顏色／操作或增加第二個主捲動容器。百分比以 Sheet 內容高度計算的實際結果仍待真頁面確認；沒有把算式預測改寫為已達158。
3. **探針準備：** 一次原生 wheel、原等待上限保留。準備最多容許1 CSS px的量測差；原本未在底部須有正向實際位移，alreadyAtBottom 另列，零範圍受阻。前後 scrollHeight／clientHeight、frame、字級及 viewport 須一致；準備中失去定位、尺寸改動或 timeout 均先經 onEvidence 保存 BLOCKED／錯誤與最新可讀量測，再拋出。沒有在產品 containment／導航／閱讀加入容差。

準備證據保留舊的平面 scrollTop／maximumScroll／rootFontSize 欄位，新增 beforeBottom／afterBottom、actualMovement、alreadyAtBottom、entryCompleted、原始尺寸、剩餘差及 visualViewport 交集高度。返回觀察也分列 scrollHeight／clientHeight／visibleFrameHeight、原 frame rect 與扣 scrollPadding 的 bounds；24幀／400筆及原 G4 成功斷言沒有改。新增讀取可能影響量測時序，仍須有／無探針及獨立 logpoint 對照。

### 已補、尚未執行的案例

新增11項 helper 案例：padding 外部值／value＋priority／priority-only／移除四種，另有觀察接管後寫回舊 dock 值、空間不足 release→恢復→repin、無 refresh 先 release→repin、root／來源高度變動、單一屬性交回而其他幾何仍更新、按壓中失焦／up清理，以及 dispose／late work。原案例／斷言完整保留，沒有 skip 或改契約取綠燈。

這些 fixture 不模擬原生 details、CSS 高度分配、來源縮短的 native clamp、wheel 或 Panel→RO→rAF。CSS 與底部準備沒有加鏡像布林測試；交 Critic 用 E 段真頁面案例驗證。Codex 本輪沒有執行 build、typecheck、lint、格式、靜態分析、單元、PG、瀏覽器、UI 或 `git diff --check`，不能宣告工程通過。

### 已知限制及第三段基準

- 極短視窗及實際縮放後物理空間不足仍未解決，保留FAIL；使用者批准的是限定呈現，不是接受158要求縮限。158原量測口徑／percentage實際尺寸／visualViewport裁切待Critic釐清；若推翻第一段前提，停止擴大補丁、回ultra。
- SUMMARY 的外部 padding 改動仍可能縮短來源空間；guard 保留外部值，不保證來源等高或沒有原生clamp。沒有另建spacer。觀察前完成的同值ABA／任意CSSOM改寫不在可辨識證據內。
- 準備前後尺寸不一致會保守列BLOCKED；1px只屬量測準備，需要本輪原始數值支持。沒有frame／已關Page時最新量測可能為null；證據回呼仍須由Critic driver配置可保存錯誤與截圖的處理，保存本身失敗也不能算PASS。無探針末態仍不能證明過程沒有短暫dock。
- t77u 未完成完整回歸與兩個不可靠腳本旗標仍是驗證缺口；後續先定位原證據、保留可重跑drivers，再完成E段，不引用舊數字冒充新通過。

第三段先讀本節、A／E及實際diff，只補讀新增內容；核對上述五檔及新commit／push限定授權，再取得遠端可讀完整TARGET，由Grok Bot Control單次送指定Critic。前次五檔授權已用於a061fe25，本輪尚無新提交授權。G4既有PASS是舊版外部證據，CSS／樣式新差異可能影響它，仍須回歸；工程PASS不能代替使用者接受，不開始下一主要切片。

工程驗證後的手動核對：短屏底欄及長項目內部捲動、閱讀不中斷、原生折疊／返回／關閉／重開及焦點位置。這是待驗清單，不是已完成結果。

第二段實作完成，尚待工程驗證。請把 effort 切換為 high，回覆「已切換，繼續」。

## H. 第三段交接準備（2026-10-13，已獲限定提交授權、未送達）

使用者回覆「已切換，繼續」後，Codex 進入第三段；只讀取 G／既有完整交付要求與實際 diff，沒有重新分析根因或追加程式補丁。HEAD 仍為 `a061fe25f534f239daf514843df2f127c510ce12`，分支 `codex/phase27-mobile-ui`，origin 為 `https://github.com/bosco8001/ai-trpg.git`。暫存清單為空；四個追蹤檔加243、刪32與G一致，第五檔為本摘要。這是Git資訊及人工差異閱讀，不是工程驗證。

以下五檔與完整送驗模板準備完成後，使用者明確回覆「授權限定五檔 commit／push 並複驗」。前次授權已用於a061fe25；本次只按新的五檔授權辦理，不把effort切換當提交授權。尚未取得新完整TARGET或送出；取得遠端可讀完整TARGET後才送驗，不把BASE冒充新修復版本。其他既有修改不納入。

### 限定五檔與命令（授權後才執行）

若HEAD變動，先核對受影響差異；若暫存區出現其他工作，停止提交並保留它，不自行清空或混入。

```sh
git status --short
git branch --show-current
git rev-parse HEAD
git diff --cached --name-only
git add -- src/web/starter-catalog-focus-dock.ts tests/starter-catalog-focus-dock.test.ts src/web/starter-kit-catalog.css tests/browser/starter-catalog-g4-probe.mjs docs/development/PHASE_33_REMAINING_REPAIR_PLAN_T77U.md
git diff --cached --name-only
git diff --cached --stat
git commit -m "fix(web): preserve starter dock style ownership and reading space"
git push origin HEAD:codex/phase27-mobile-ui
git rev-parse HEAD
git ls-remote origin refs/heads/codex/phase27-mobile-ui
```

核對commit精確五檔、遠端完整SHA與本地一致後，替換下方TARGET。提交內文件保留提交前模板，不自引尚未生成的SHA；實際送出原文及私有讀回紀錄另行記錄版本。

### 完整複驗prompt（待填TARGET，尚未送達）

```text
請指定 AI TRPG Architecture Critic 對 Phase 33 第七切片 t77u 後的限定補修做工程複驗。Codex負責實作，你負責工程驗證；不要改repository、commit／push、轉其他bot、代使用者驗收或開始下一主要切片。

Repository：https://github.com/bosco8001/ai-trpg
分支：codex/phase27-mobile-ui
本輪BASE：a061fe25f534f239daf514843df2f127c510ce12
本輪TARGET：__待限定五檔提交並推送後填入完整SHA__
t77u原BASE：f94aa51cfcf48d980bd571796f79ca0010a1b081
原被測UI：4ff24fabdcb7638ee958234a44b631a4ee3dd2b9
t75u原BASE：7fbcdd8c0d471505b5c540c5d7884d883f865294

先核對完整SHA、遠端HEAD、祖先與精確五檔：
src/web/starter-catalog-focus-dock.ts
tests/starter-catalog-focus-dock.test.ts
src/web/starter-kit-catalog.css
tests/browser/starter-catalog-g4-probe.mjs
docs/development/PHASE_33_REMAINING_REPAIR_PLAN_T77U.md
未取得可讀TARGET不要用BASE／舊PASS作本輪結果。本摘要H是提交前模板，以這次送驗訊息的完整SHA辨識版本。其他本地未提交修改不在遠端補丁範圍。

先讀TARGET的AGENTS.md、docs/development/CANONICAL_MANIFEST.md、OPEN_QUESTIONS.md、PHASE_33_STARTER_KIT_CATALOG.md、PHASE_33_STARTER_KIT_CATALOG_GROK_REVIEW.md、PHASE_33_G4_DIAGNOSTIC_MVP.md、本輪REMAINING_REPAIR_PLAN_T77U的A／E／G／H，以及PHASE_33_G4_REPAIR_PLAN_T76U的既有H段。T76U文件新增J段屬其他本地未提交紀錄，不在本次五檔，勿要求遠端必須有J；t77u來源改讀你的原對話與證據SUMMARY，下段是其外部結果摘要。正式docs/gameplay/starter_kits.md、character_system.md、classes.md、magic.md、combat_system.md沿用。Phase Spec／GROK_REVIEW必要回歸不刪減；完整可見、158px閱讀、44px操作及完整6px焦點框要求不降低。

t77u外部結果：G4限定PASS、整體FAIL；568×320 safe47／34閱讀137px、844×240閱讀138px；外部inline padding12px被refresh改成49px且release後遺失；390×620探針底部準備253／252 timeout。G4核心BASE18／18紅、TARGET18／18綠及Tab6／6是舊版證據，不替代新CSS／樣式變動後回歸。t77u未完成完整矩陣、safe+dock、對比、H-1其餘類與wrapper、HTTP／舊UI；亦沒有單列npm ci／build／migrate exit，不補推通過。

重用/workspace/p33t77-evidence/、/workspace/p33g4-evidence/、/workspace/p33w75-evidence/的SUMMARY與有效原始證據。先查t77u SUMMARY定位兩個取樣基準不可靠的重建腳本／案例，不沿用其ok旗標。已刪driver不得冒稱存在；必要重建則說明與原版差異。這輪清理checkout前，務必保留可重跑drivers、fixture來源、實際命令、case清單、JSON／trace／截圖及exit code在新證據目錄，避免再因刪腳本缺回歸。

實作摘要：
1. write與release先比較自己上次寫入的CSSOM value＋priority；外部接管後用helper生命週期WeakMap記住node／property，refresh／release／repin不搶回，其他自己持有的幾何仍更新還原。沒有新timer／observer、scroll修正或focus搬移，按壓交易保留。觀察前已完成同值ABA與任意stylesheet改寫不保證辨識。SUMMARY來源空間仍靠DETAILS padding；外部12px可能引發native clamp，沒有另建spacer，不能宣稱全面第三方相容。
2. 永久rail CSS加入100%−158px上限，原來源高度／50%上限及44＋16＋bottom safe最低高度保留；有／無dock欄高一致，長項目沿用內部捲動。沒有改Panel measureReserve、reading、G4目的位置、Canon、正式數值、API或保存。使用者接受限定呈現，明確保留844×200等物理不足未解，不接受需求縮限或切片通過。
3. 探針準備保留一次原生wheel及原timeout，最多1 CSS px量測差，只用於準備。非alreadyAtBottom須正向實際位移，無範圍／尺寸改變等BLOCKED；前後原始尺寸及viewport一致。準備失敗經onEvidence保存BLOCKED、最新可讀量測及錯誤後重拋。原24幀／400筆及嚴格G4產品斷言未改；1px不可放入產品containment。新增讀取可能干擾時序，仍需有／無探針與獨立logpoint對照。
新11項helper案例及探針由Codex撰寫但未執行；Codex沒有跑build、typecheck、lint、格式、靜態分析、單元、PG或瀏覽器驗證。fixture不模擬CSS尺寸分配、原生details／clamp／wheel／Panel→RO→rAF，不能替代真頁面。

隔離BASE／TARGET production頁，逐版本報npm ci、npm run build、必要npm run db:migrate及exit；記Node／npm／PG／OS／Playwright／Chrome、有頭／headless、DPR、字級、safe、縮放方法與服務SHA。runtime套件只在證據工作目錄，不改repository依賴，不碰正式DB／5432。先跑下面定向，再依結果完成必要完整回歸。

定向新補修：
A. inline擁有權真頁面：外部12px、value＋important、priority-only、移除→多次refresh→release；觀察接管後寫回舊dock值、同焦點自動release→repin、字級／來源高度變動、兩summary交替、pointer中失焦／up／cancel、dispose及late work。報實際value＋priority、節點／父節點、frame／rail／來源rect與時序；無外部變動仍原樣還原。外部縮短來源引起native clamp與產品拉回分開，不得把未知當閱讀或准許拉回；若可達性或操作退化，列新缺陷，不代修spacer。
B. 空間：568×320 CDP safe47／34、844×240 safe0、844×200及實際200%／字級還原、按壓中resize；無dock／dock同永久budget，普通與長控制項的44px、完整6px框、內部捲動、hit-test、安全區。同步報frame rect、clientHeight、visualViewport交集與扣scrollPadding的bounds，對齊舊158口徑，不能把raw158冒充bounds158。百分比實際解析、裁切以真量測為準；若舊要求實指扣padding後158，明確指出方案前提不成立，不改口徑取綠。極短視窗未解繼續FAIL，不skip或宣稱使用者已接受縮限。
C. 探針390×620原253／252：BASE／TARGET UI都用同一新版driver／有效準備；保存wheel前後scrollTop／scrollHeight／clientHeight、maximum／remaining、rect、root字級、DPR／visualViewport與actualMovement／alreadyAtBottom。CSSOM整數尺寸／fractional scrollTop的實際值自行核對，不採信未證實根因。有範圍、無範圍、already底部、無位移、geometry改變、Page／frame消失、timeout與證據回呼失敗另測；無重試／加長等待。1px是否合理用原始證據支持。BLOCKED不是產品PASS／FAIL，保存JSON／截圖／error再重拋；回呼driver也要保證失敗可留證據，不能只有外層timeout。

四項共同要求與G4回歸：
1. 無玩家操作轉向／中途截限：G3／H-2 Case A／E、36rem界線、640↔620、scroll早／晚、第一／第二rAF及晚到clamp。原可見焦點不完全消失、閱讀不歸零，未知保持未知。
2. F1 Home同幀844×390→844×389微resize、PageUp、ArrowUp及無resize對照，受信任鍵盤有頭／headless N5；wheel compositor／sample／wheel／scroll兩種次序N5，合成與受信任分列，smooth不中斷。H-1全部17類有頭／headless N3及wrapper，不只沿用t77u8類；單步／連滾／反向、600ms smooth、無scrollend、fractional／max與部分／完全不可見焦點、summary開合及第三方override。
3. F2 prototype scrollTo／scrollTop、非焦點SIV、text fragment、CDP、不可配置descriptor、第三方第一／第二rAF→reflow，0／300／300.5／max−1／max與原五時序；未知不被拉回也不冒充閱讀，native clamp另列。來源繞過包裝不代表允許後續reflow拉回。
4. L-8既有七類×0／1frame／249／250／300ms N2，End／ArrowDown／同值setter／無效scrollTo／NaN scrollBy／邊界wheel等；無輸入、noop前後、未知clamp後新noop、命令替代舊來源、結束輸入皆不能取得虛假閱讀權限。不能直接量內部狀態時列受阻，不把passive trace當直接證明。
5. G4核心844×390／568×320／390×620，普通字級safe0，有／無探針各N3。本輪BASE已修G4，應作不退化對照，不期待它重新紅；需舊算法紅→綠控制時另用t76u原BASE，清楚分版本。補純Tab、Enter、先捲到底、重讀／關閉重開與200%／超大列，原t75u四情況不能確認初始化則另列。正常列原閱讀區完全容納、同焦點、無已觀測短暫dock，嚴格上下左右不加容差；焦點欄或來源placeholder不冒充原列成功。分數-only、合法maximum clamp、頂部返回、已可見無位移分列。
6. 保存實際setter實參及讀回scrollTop、來源／frame／rail rect、bounds、focus／scroll／RO／rAF順序；probe projectedScrollTop是舊預測，不當setter實參，firstReturnedInline只是第一個觀察樣本。instrument=false末態不證明過程無dock，有／無探針／logpoint矛盾先定位干擾，不能直接PASS。
7. Esc第一／第二rAF、smooth／pointer／timer pending、失焦與五次重開：入口焦點及背景位置保持，refs／wrapper／listener／RO／rAF／timer／class／inline樣式／來源空間正確清理，外部接管值保留，停定1秒活動0，無震盪／page error。

定向後完成Phase Spec／既有H段必要回歸；紅燈阻塞的項目報未完成，不算PASS。同版本有效結果可引用，受新改動影響或舊FAIL／受阻須重驗：
I. 六尺寸／三字級／七停點882矩陣或充分等效，AA／AAA、超大／部分可見分列；M-1、L-2至L-6、safe top47／bottom34及0原24組加dock、158px／44px／完整6px框／橫溢出／對比≥4.5與原視覺。G1／G2／G5原點擊／觸控／summary／失焦／第三方popover清理與完整20步。
II. 執行git diff --check a061fe25f534f239daf514843df2f127c510ce12 <本輪完整TARGET>；逐BASE／TARGET執行node --import tsx --test tests/starter-catalog-reading.test.ts tests/starter-catalog-focus-dock.test.ts tests/starter-kit-catalog.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts，無DB及隔離非5432 PG；npm test無DB及隔離PG。reading＋focus-dock＋starter-kit正反序各兩次，globals／finally／worker污染、M-2原cleanup斷言及11新案例。逐命令exit／pass-fail-skip，無DB skip不算PASS，不降斷言、skip或改契約取綠。既有G4八案例與舊算法反向控制仍保留。
III. 兩名冊production HTTP125／主流程20／故障19、慢載入取消重開重試、GET only；loader／API／kind／resolve／complete／守衛回歸，出生／state／revision／HP／MP／三槽／八表md5不變；舊UI四尺寸57畫面及M4b／M4c／M6a。t75u數字只是歷史引用；完整回歸未跑不得換成新通過。

報告分開三項限定補修、G4回歸及整體結論。極短158px需求仍未解時，整體仍FAIL；使用者只接受限定呈現，不是第七切片驗收。新缺陷不以不在diff範圍免報。列完整TARGET／BASE／環境／命令exit／分母與pass-fail-skip、High／Medium／Low／Info位置、重現、預期／實際、證據及最小受影響範圍；分列實做／引用／推斷／未測／受阻／作廢。真手機／讀屏／Safari／系統字級／真safe／Android網址列／Chrome搜尋／真Ctrl-wheel／pinch等沒做如實列，替代品不外推。
保留新SUMMARY與可重跑證據，清理本輪隔離server／proxy／Page／DB／role／cluster，不動5432或舊證據。不要代修或自行結案。Codex收回PASS後整理外部結果及手動清單等待使用者；FAIL只分類／證據／範圍，不直接加補丁，提醒切回ultra再分析。
```

### 送達與回覆界線

取得授權與完整遠端TARGET後，透過Grok Bot Control從當次介面確認指定Critic、最新回覆及composer，讀取私有防重送紀錄，以新TARGET限定scope準備原文，核對完整草稿，單次送出並讀回新outgoing與空composer。未確認不寫已送驗，模糊送達狀態不重送。本節尚未貼入composer或送出，工程仍待驗證。

回覆若FAIL，只整理失敗分類／證據／範圍，不追加補丁，提醒：「工程仍 FAIL。請把 effort 切回 ultra，回覆『已切換，繼續分析』。」PASS亦不代使用者驗收，不進入下一主要切片。
