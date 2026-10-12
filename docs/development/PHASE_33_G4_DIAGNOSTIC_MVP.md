# Phase 33 第七切片：G4 定位 MVP

日期：2026-10-12（Asia/Hong_Kong）。使用者在側對話確認依定位方案執行，其後明確授權限定本文件與新探針兩檔 commit／push 並送指定 Critic。以下為提交前交接；尚未執行工程驗證，不是修復版本、工程 PASS 或使用者驗收。主對話其他未提交修改保留。提交及送達身分以當次送驗訊息的完整 SHA 與讀回紀錄為準。

## 版本、範圍與來源

- Repository：https://github.com/bosco8001/ai-trpg
- 分支：`codex/phase27-mobile-ui`。
- 探針製作基準／被測 UI 版本：`4ff24fabdcb7638ee958234a44b631a4ee3dd2b9`；提交探針後不再將此版本稱為目前 HEAD。
- 該版本外部 t75u 對照 BASE：`7fbcdd8c0d471505b5c540c5d7884d883f865294`。
- 指定 AI TRPG Architecture Critic t75u 結果為 FAIL。2026-10-12 本輪透過 Grok Bot Control 讀回同一報告，沒有新執行結果。
- 外部 G4：三尺寸 × 四情況，各 3／3 返回魔術師列後 dock。報告量到需求位移 247.48、實際 scrollTop 247、列底 273.48、範圍底 273。這是外部實測；不能推成所有瀏覽器 scrollTop 都是整數。原證據 `/workspace/p33w75-evidence/` 未由開發代理下載／獨立核驗。
- 唯一假設：導航寫入後殘留的分數超界，觸發嚴格 containment 與後續焦點固定。完整事件因果鏈尚待新探針及原 trace 對照。
- 本次只新增 `tests/browser/starter-catalog-g4-probe.mjs` 與本文件。正式程式、CSS、Canon、數值、API、保存及依賴均不變。

## 方法與限制

採用 [systematic-debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md) 的先重現／證據後修復流程，重用既有 Grok Playwright。沒有安裝 skill 或新套件。

探針接收 Critic 既有 Page；真實開啟名冊、進入魔術師配套、返回。記錄 focusin／scroll／DOM mutation／rAF 中的實際 scrollTop、rect、共同 padding 範圍、焦點區高度及 dock 狀態。只重算「預測位移」，不攔截 scrollTop 寫入，不冒稱觀察到內部來源、世代、pending 狀態或 setter 實參。

請以 `instrument=false` 配對無事件／逐幀探針的對照，再以預設探針重跑。兩者都保留相同導航與有界結束觀察；量測可能強制 layout 或改變時序。若兩者 verdict 不一致，先報 observer effect，不把探針值當唯一根因。24 幀是觀察窗口，不是新增產品 timer，也不是所有晚到事件的充分證明；400 筆截限須明列。

`onEvidence` 在紅燈斷言前執行，呼叫方保存 JSON、trace.zip、返回畫面截圖、環境及完整 SHA。呼叫方負責每案新 Page、資源清理與保存函式錯誤；準備步驟失敗另列受阻，不當 G4 FAIL。不降低舊斷言、不加 skip、不放寬正常列需求。

## 限定提交指令（使用者已授權）

使用者另行明確授權本次 commit／push。依 AGENTS.md 第 4 節，限定兩個新檔：

```sh
git status --short
git diff --cached --name-only
git add -- tests/browser/starter-catalog-g4-probe.mjs docs/development/PHASE_33_G4_DIAGNOSTIC_MVP.md
git diff --cached --name-only
git commit -m "test(web): add native starter catalog G4 diagnostic probe"
git push origin HEAD:codex/phase27-mobile-ui
git rev-parse HEAD
git ls-remote origin refs/heads/codex/phase27-mobile-ui
```

必須確定原 staged 清單為空／無其他工作，提交清單精確兩檔；不提交主對話既有修改。版本有變則先讀新增差異。Bot 必須可讀取含探針的新完整 TARGET；原被測 UI 的 SHA 仍明列，不以診斷提交冒稱修復。

## 完整 Grok 診斷 prompt（提交前模板，送達另行讀回）

請 AI TRPG Architecture Critic 只完成 Phase 33 第七切片 G4 定位 MVP，不修改修復程式、不 commit／push、不判定使用者驗收。採用根因流程，先穩定紅燈，不先加容差、timer 或全面重寫。

Repository https://github.com/bosco8001/ai-trpg；分支 codex/phase27-mobile-ui。
診斷交付 BASE 4ff24fabdcb7638ee958234a44b631a4ee3dd2b9；診斷交付 TARGET 使用當次送驗訊息明列的完整 SHA，文件本身不自引所在 commit。開發代理必須先取得並核對 git rev-parse HEAD 與遠端 SHA，再將完整 TARGET 加入實際送出訊息。
原 UI TARGET 4ff24fabdcb7638ee958234a44b631a4ee3dd2b9；原對照 BASE 7fbcdd8c0d471505b5c540c5d7884d883f865294。先核對新 TARGET 只新增本探針及交接文件、正式程式一致；以當次訊息的完整 TARGET 作送驗身分，不將本文件誤讀成新修復版本。

先讀 TARGET AGENTS.md、CANONICAL_MANIFEST.md、OPEN_QUESTIONS.md、starter_kits Canon、本文件、StarterKitCatalogPanel.tsx 與 starter-catalog-focus-dock.ts／CSS。重用 t75u /workspace/p33w75-evidence 的 G4 driver、trace 及 SUMMARY；若不存在，明列受阻或重建所需最小案例，不冒稱重用。新探針尚未執行，先由你閱讀其有效性與觀察干擾風險。

在隔離正式服務／Page，用現有 Playwright 呼叫 `probeStarterCatalogG4(page, {targetSha, instrument, onEvidence})`。第一輪只普通字級、safe0、844×390、魔術師進入／返回，無探針與有探針各 N=3。保存 JSON／截圖於斷言之前，driver 記 exit code；頁面若不能完成準備，另列受阻，不算 bug 紅燈。再必要地擴到 t75u 的568×320／390×620及四情況；先讀原 driver 確認四情況，不能自行冒充已涵蓋。

由審查者自己的短 driver 啟動既有服務並建立 Page，不新增依賴至 repository。範例調用（Playwright runtime 由既有 driver 提供）：
`import { probeStarterCatalogG4 } from './tests/browser/starter-catalog-g4-probe.mjs';`
`await probeStarterCatalogG4(page, { targetSha: ACTUAL_TARGET, instrument: true, onEvidence: async report => { await writeFile(jsonPath, JSON.stringify(report, null, 2)); await page.screenshot({path: screenshotPath}); } });`
實際命令請報完整 driver 路徑、Node／Playwright／Chromium版本、字級、device scale、headless／有頭、viewport、用到的準備樣本與服務 SHA。不得把上面的範例當已執行。

判定／交付：
1. 有／無探針都能穩定重現返回列被固定才算 tight loop 建立；若不一致，先定位觀察干擾。
2. 分清預測位移與實際寫入，列出 focus／scroll／mutation／rAF 時間與 geometry。逐幀證據只能支持外觀狀態，沒有記錄的內部原因保持未知。
3. 以原 trace 或必要的隔離 debugger 確認：分數殘差是否先於 dock，是否仍有 reserve 變高／排程因素。一次只驗一個假設，不改正式程式。
4. 回報實做／引用／推斷／未測／受阻／作廢、每案exit與重現率、證據路徑、探針是否可作將來紅→綠回歸。MVP只建立定位信號，不等於第七切片工程 PASS。
5. t75u 的閱讀高度<158與第三方padding覆寫保持 open，原F1／F2／H-2／L-8等有效證據保留。沒有產品改動時不無故重跑全套；正式補修後仍需完整 Phase Spec 回歸、158／44與焦點環要求，不用MVP取代。
6. 保持唯讀GET／原保存契約；不碰正式DB／5432。清理新服務、Page、observer與隔離樣本；舊證據保留。診斷完成後停止，等待使用者確認下一個限定修復。
