# Phase 33 第七切片工程審查要求

尚未送達；Codex 未執行 build／測試／UI 驗證。以下為完整待送 prompt，TARGET 必須在限定提交及遠端讀回後填寫，不能用 BASE 當本次 TARGET。

---

請 AI TRPG Architecture Critic 對本次 Phase 33 第七切片「正式起始配套名冊與唯讀核對畫面」做工程驗證。這是 Codex 準備的實作，不能把舊原型 PASS 當成本次結果；工程審查不替使用者批准 UI 手感、平衡或階段完成。

Repository：https://github.com/bosco8001/ai-trpg
Branch：codex/phase27-mobile-ui
BASE：72d804335d6f9aa32fbddddd9b93fe7c72228f27
TARGET：待填：本次限定提交推送後的完整 SHA
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
