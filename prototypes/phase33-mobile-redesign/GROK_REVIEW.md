# 新手機原型 02 · 首輪 FAIL 補修複驗

首輪外部 TARGET `4ee0a54aa9bebb65ab44a8eaa078da15b458b72d` 結論為 FAIL：1 Medium、4 Low。本輪同原型補修已準備，尚未送達，TARGET 待限定四檔 commit／push 後填入。不是已解決紀錄；視覺方向接受保留。

```text
請 AI TRPG Architecture Critic 複驗新手機原型 02 的首輪 FAIL 補修。操作者 Codex。使用者已接受視覺方向，不重新判定其偏好；工程結果仍由你獨立實測，不能把上輪 PASS 子項直接沿用成本輪 PASS。不是正式 UI 整合、Phase 33 第二切片通過或下一階段授權。

Repository: https://github.com/bosco8001/ai-trpg
Branch: codex/phase27-mobile-ui
BASE: 4ee0a54aa9bebb65ab44a8eaa078da15b458b72d
TARGET: 待本次四檔限定 commit／push 後填入完整 SHA

固定完整 SHA，確認遠端可讀 TARGET、BASE 祖先與 diff；只能改 prototypes/phase33-mobile-redesign/index.html、DESIGN_SYSTEM.md、README.md、GROK_REVIEW.md。既有未提交 AGENTS／Phase31／Phase33 文件、原型01均不得混入。不要用移動 HEAD、舊第一切片 PASS 或純閱讀代替這輪實測。

必要文件：遠端 AGENTS.md、docs/development/CANONICAL_MANIFEST.md、OPEN_QUESTIONS.md、PHASE_33_CONTENT_CATALOG.md、docs/gameplay/character_system.md、magic.md、原型 DESIGN_SYSTEM.md／README.md。優先序：使用者已確認規則 → Canon/Phase Spec → 手機可用性 → 視覺一致性 → skill 建議。試作規則不是永久 Canon。

你在 2026-10-06 20:30:36–20:30:48（HKT）的首輪回報：Chrome 工程 FAIL，M1 大字 Sheet 標題／CTA 裁掉，L1 主畫面橫向溢出，L2 雙 Enter／Esc+Enter 清掉新任務，L3 新 Sheet 繼承舊捲動，L4 橫向誤用桌面最小高度。外部證據 /workspace/p33g-evidence。13 個驅動 exit 0 只是記錄完成，並非案例 PASS。上輪 fetch DNS 失敗後用 GitHub API 重建核對 SHA，若本輪再受阻需同樣清楚交代來源。

本輪補修：
- M1：圖示控件44–56px不被flex擠小；Sheet容器小於20rem時標題獨佔一列，其他寬度同列；副標／footer說明移進body，固定footer只留一個主要CTA，示範重設移至body。沒有縮小使用者文字、裁掉資訊或把CTA藏起。
- L1：header允許換行、容器min-width:0、摘要重排；app小於22rem時更換職業另成一列，裝備只隱藏裝飾徽記，名稱／狀態／入口保留。
- L2：close時同步清stack與返回焦點；延後close事件不清理已重開dialog；change/click另檢查有效任務。
- L3：showModal後才focus標題（preventScroll）與body.scrollTop=0，新開／push都走同一重設。
- L4：桌面須同時64rem寬和40rem高，移除32rem最小高度。
- 相關Info I2/I4/I8：form關聯submit支援Enter；icon入口不縮小於44px；核對返回用預覽CTA穩定key找焦點。
色彩／字型／試作數值／正式UI均未更改。Codex僅閱讀與修改，未跑build/typecheck/lint/格式檢查/靜態分析/測試/瀏覽器UI。

隔離 clone 服務：
python3 -m http.server 3045 --bind 127.0.0.1 --directory prototypes/phase33-mobile-redesign
開 http://127.0.0.1:3045/ 。自含HTML，無npm/API/DB/LLM/外部字型依賴。請做必要HTML／inline JS語法核對與 git diff --check BASE TARGET，再實際瀏覽器量測。不要改檔案、commit、push、安裝新軟體或碰正式DB。舊原型01仍未在遠端，3044比較受阻須明示，不能推測通過。

複驗逐項要求：
1. M1：先在BASE重現320×720文字200%→更換→魔術師→核對的887pxheader／CTA裁切，再在TARGET同案例量測header/body/footer/CTA bounds與可點性。320/375/390/430寬，文字100/125/150/175/200%、頁面zoom200%、短高568/667、橫向125/200%；全部Sheet含核對、屬性表單、技能詳情都須有可用body、長內容可達尾、header/CTA不蓋內容。文字不許強制縮小。Safe-area與虛擬鍵盤若無真設備只記推斷／未測。
2. L1/L4：320寬150/175/200%的header、職業入口、導航不可橫向溢出。844×390橫向不套用高512px桌面；底部導航在viewport內。768/1280桌面及放大仍可操作；通常375–430正常文字主屏六格仍可看到，短高／大字允許內容捲動。注意新container query、44px圖示與長字串沒有新的重疊／裁切。
3. L2：BASE雙Enter、Esc+Enter（0ms；6倍CPU慢速時33ms鍵盤重複）重現對照；TARGET大量重複開關後stack與目前route一致，radio可選、預覽能用、沒有console error／overlay殘留／背景焦點、未套用不變。也回歸mouse/touch快速取消／套用，不能用動畫輸入鎖或延遲掩蓋問題。
4. L3：390×844裝備捲到底→關閉→完整數值，以及你上輪5個跨任務組合，TARGET新開body.scrollTop應為0、看到副標與第一筆；push新任務同樣從頂部。正常radio重建／篩選保留目前捲動，不回歸。Info I8：job/gear核對返回焦點回原CTA、預選保留；保存重建技能slot後仍回目前入口。9路由Tab／ShiftTab不出背景、radio方向鍵、Enter／Space／Esc需回歸。
5. Info I2/I4：合法表單Enter與保存按鈕同樣保存一次；非法空值、小數、範圍外不部分保存，有第一錯誤焦點，取消草稿不保存。reset仍可達且明確。320寬右上更多及Sheet圖示實測至少44×44px。I1快速第二點背景庫、I3數字1e1/12.0、I5讀屏結構、I6對比邊界、I7舊版受阻仍保留，不冒稱已解決；有影響再分級。
6. 數值／配置回歸：資格floor(固有×主要1.25)+有效裝備，技能不進門檻；初始全12劍士徽章+3力量資格18最終19，魔術師力量12智慧資格15最終16，徽章／重斬失效火球生效，取消不改、切回恢復。智慧13魔術師通用+2→18/19；非魔術師智慧14火球不自助。4職業×9裝備36組及六格保存／替換／清空／篩選、不重複暫定、失效保留／恢復。魔術師不自動賦予直接施法資格；獨立武器／施法條件是樣本假設，被動只有說明。
7. 接受視覺的回歸：按鈕 #ffc39d／#bfd3dd／#3d5362 與狀態字對比、選取／停用／focus／pressed清楚；Heiti/Avenir備用字型實際情況、負號較小仍可讀、零不丟。220ms discrete退出、reduced-motion/contrast/transparency，Chrome與Safari分開寫實測／受阻。AAA完全不遮焦點不等同AA最低部分可見。未做真讀屏不能以AX結構宣告讀屏PASS。
8. 隔離：零API/DB/storage/LLM/外部字型圖片請求，refresh重設；main同步、log20上限、loading手動樣式不假請求。正式state/Save/Canon/五族/CSS不變，無戰鬥HP/MP/敘事整合。瀏覽器Back／遊戲手把／拖曳Sheet未實作，未測正式遊玩。

請給出完整BASE/TARGET、限定diff、環境/瀏覽器/命令exit code、M1/L1–L4及I2/I4/I8逐項結果與新缺陷、重現／回歸矩陣、證據路徑、工程PASS/FAIL。分清本輪實做、引用、推斷、未測、受阻；BASE能重現與TARGET消失須有實測支持。外部工程通過不代替使用者最終階段驗收。
```
