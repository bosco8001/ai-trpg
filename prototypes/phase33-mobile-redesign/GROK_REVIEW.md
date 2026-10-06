# 新手機原型 02 · 工程驗證交接

提交前狀態：未送達。尚未 commit／push，TARGET 待填。這是待用完整 prompt，不是已執行結果；送出時以新完整 SHA 取代 TARGET 欄位，送達狀態另行記錄。

使用者已於 2026-10-06 接受調整後的視覺設計方向；工程驗證及正式整合範圍仍待處理。

```text
請 AI TRPG Architecture Critic 對這次獨立 Mobile UI 全面重設原型進行工程驗證。操作者 Codex。不是正式遊戲 UI 整合，也不代替使用者確認視覺方向或 Phase 33 驗收。

使用者已於 2026-10-06 回覆「接受這個設計」，請保留這項視覺方向接受，不重新判定其偏好。這不代表工程 PASS、正式 UI 全面替換批准或 Phase 33 第二切片通過；仍須獨立檢查全部工程案例。

Repository: https://github.com/bosco8001/ai-trpg
Branch: codex/phase27-mobile-ui
BASE: 8a59cfe82f04c75758a9468abcca75996d1a3eaa
TARGET: 待本次四檔限定 commit／push 後填入完整 SHA

固定 SHA、確認遠端能讀取 TARGET、祖先與限定 diff；不要拿分支移動 HEAD 或第一切片舊 PASS 代替此次 TARGET。新增範圍僅 prototypes/phase33-mobile-redesign/index.html、DESIGN_SYSTEM.md、README.md、GROK_REVIEW.md。此前未提交的 AGENTS／Phase 31／四份 Phase 33 文件、原型 01 都不應混入本次 commit。若範圍或 BASE 不符，先回報。

必要讀取：遠端 AGENTS.md、Canonical manifest、Open questions、Phase 33 content catalog、docs/gameplay/character_system.md、docs/gameplay/magic.md、新原型 DESIGN_SYSTEM.md／README.md。使用者本次優先序：已確認規則需求 → Canon/Phase Spec → 手機可用性 → 視覺一致性 → skill 一般建議。新原型試作規則屬使用者已確認的 provisional 範圍，不是永久 Canon。

背景：使用者要求另外建立真正 Mobile-first 的新視覺，不沿用舊深金資料冊；冷黑石材／霧銀／魔導青光／餘燼橙、現代手機遊戲功能層、抽象中世紀遺跡氣氛，沒有羊皮紙大框或 SaaS 儀表板。主畫面只顯示目前職業、主屬性、裝備、六格技能，詳細流程放原生 modal Sheet，header/footer 固定、內部捲動。遊戲規則不因改設計而變動。

隔離 clone 中展示：
python3 -m http.server 3045 --bind 127.0.0.1 --directory prototypes/phase33-mobile-redesign
開 http://127.0.0.1:3045/ 。這是自含 HTML，沒有 npm／API／DB／LLM／外部字型依賴。舊版入口 3044 在未啟動原型 01 服務時不可用，不能把缺服務當成新原型程式缺陷；該原型 01 尚未提交，若遠端沒有它須明示新舊互動比較受阻，不推測舊版通過。可以比對 BASE 正式 UI 原始碼，但不能替代實際舊原型測試。不要改檔案、commit、push、安裝新本機軟體或碰正式 DB。

Codex 未跑 build/typecheck/lint/格式檢查/自動化靜態分析/測試/瀏覽器UI；啟動靜態預覽服務不是驗證通過。請獨立實測，來源與版本寫清楚。

使用者其後回報氣氛可接受、按鈕功能沒問題，要求提高按鈕底色對比並換字體。TARGET 須包含此輪同原型調整：主要按鈕 #ffc39d／深字；次要 #bfd3dd／#15232d；其他可點入口 #3d5362、邊界 #a4bac9；導航與篩選選取 #a0ddd6／深字。標題/功能 Heiti TC 優先，數字 Avenir Next／Helvetica Neue 優先，缺字型有 fallback。並未改操作／數值程式。局部使用者回報不是工程 PASS；請測非 hover 普通狀態、停用區分、success/warning/metadata在新底色上的對比，以及實際字型/字重/負號/200%換行。純列出CSS fallback不代表字型已載入，不下載或安裝新字型。

驗證重點：
1. 數值：主要屬性 ×1.25、其他 ×1，先 floor 後加有效裝備。通用 +2、指定職業特化 +3，技能不進任何門檻；每個生效技能最終 +1。初始全固有12、劍士徽章、重斬／穿透箭／分身術／火球術，力量資格18最終19。魔術師預覽力量12、智慧資格15最終16，徽章失效、重斬停用、火球生效。取消完全不改，目前職業套用才變；切回劍士恢復徽章／重斬。智慧13魔術師+通用智慧護符→資格18最終19。非魔術師智慧14無智慧裝備，火球不能靠自己+1生效。
2. 配置：轉職不刪失效技能/裝備；重算使用單一配置；技能庫最多六格、永久保留。點單格／從庫選空格／替換已有技能／清空；篩選全部生效未生效正確。暫定同技能不可重複配置，不可宣稱這成為正式規則。四職業與技能屬性對應沒有抄錯；切魔術師不賦予直接施法資格，相關武器／施法條件為樣本假設、沒有模擬全部需求。
3. 原生 dialog 堆疊：job/gear 預選→核對→返回保留選擇，Esc/關閉丟棄未套用；技能詳情返回庫保留篩選/欄位；header/CTA 固定且 body 自己捲動。Tab/ShiftTab 焦點不能到背景、radio方向鍵/Enter/Space、關閉返回目前入口。尤其技能保存重建 slot DOM 後，焦點仍須回第幾格；不對舊 detached DOM focus。快速開關/套用/返回/連按無狀態污染、overlay不殘留；沒有動畫期間鎖操作。瀏覽器Back、遊戲手把與拖曳Sheet明列未實作，不冒稱PASS。
4. 主畫面與手機：320/375/390/430×一般手機高度、短高568/667、橫向、768/1280桌面；100/125/150/175/200%字體及頁面zoom200%。逐文字/控件bounds核對沒有溢格、重疊、裁掉字；safearea不遮入口，主屏正常文字主要操作不需反覆捲頁，短高或大字允許內部捲動。Sheet header/footer不擠掉可用body、radio長列表能到尾、虛擬鍵盤可用若有真設備，沒有不要猜。桌面僅手機舞台與比較說明，功能不能只在desktop能用。
5. 設計系統：全新色彩、字階、層次、按鈕、SVG圖示、卡片/技能/裝備樣式、Navigation/Sheet一致；pressed/selected/disabled/focus清楚。裝飾不搶閱讀，文字/控件對比與touch44px量測、圖示aria-hidden、status有文字不只顏色。負號比數字小且不可漏讀負值；數字含零完整。真讀屏未做須標DOM/AX結構而非讀屏PASS。
6. 輸入/回饋：示範固有屬性1–99整數；空字串、小數、超範圍、非法值不部分保存，有欄位錯誤與第一錯誤焦點；草稿返回/取消不保存。成功即時同步所有摘要/數值，提示消失後狀態仍保留；log最多20且不持久。設計展示loading是手動樣式開關，沒有假資料請求；普通套用同步完成，沒有假wait。
7. motion/accessibility：220msSheet、pressed即時、prefers-reduced-motion/contrast/transparency；CSS discrete display/overlay的Chrome/Safari可用性需分清實測與受阻。沒有drag/sliding把手，不要求不存在手勢；縮放/字型prefs不可強制縮小來隱藏溢出。
8. 隔離：零 API/DB/storage/LLM/外部字型/圖像請求，除了靜態HTML與瀏覽器可能favicon。refresh重設，不改正式state/Save/Canon/五族/正式CSS；原型不是正式創角或戰鬥。被動是文字，沒有實際傷害/MP引擎，不當作完整玩法PASS。

請報告完整BASE/TARGET、限定檔案diff、環境/瀏覽器、實際命令exit code、案例結果與證據位置，按High/Medium/Low/Info列新缺陷；工程PASS/FAIL；分清本輪實做、引用、推斷、未測、受阻。不要把舊結果或純程式閱讀寫成親測，也不要重新決定使用者對第一切片的既有接受或本次新視覺是否通過。
```
