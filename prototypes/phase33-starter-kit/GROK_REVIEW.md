# 待送交 AI TRPG Architecture Critic：Phase 33 起始配套原型

交接模板：2026-10-10，使用者已授權限定十檔 commit／push 並送驗；Codex 尚未執行本輪工程驗證。以下保留提交前模板，實際送出時以 Git 取得的真實完整 SHA 取代 TARGET 欄位；本檔模板不作即時送達證明。不得把未執行案例或舊 Phase 33 PASS 當成本輪通過。

---

請你以 AI TRPG Architecture Critic 對以下版本做獨立工程驗證。操作代理為 Codex；使用者已確認原型製作範圍，工程判斷不能代替使用者對原型的手動驗收。請勿修改正式遊戲資料、commit／push 或宣布整個 Phase 33 結案。

## 固定版本與範圍

- Repository：https://github.com/bosco8001/ai-trpg
- 分支：`codex/phase27-mobile-ui`
- BASE：`7dddce1a02c7171986666b6ea0b06c656a2a2873`
- TARGET：`【待限定十檔 commit／push 後填入完整 SHA；未填不可送驗】`
- 本次目標：獨立記憶體手機原型，配點 → 起始配套 → 角色總覽 → 戰鬥外配置。正式 UI、角色建立／保存 API、不可暗改的出生紀錄及存檔不接入。
- 限定十檔：`prototypes/phase33-starter-kit/{index.html,style.css,app.mjs,model.mjs,model.test.mjs,catalog.test.ts,README.md,GROK_REVIEW.md}`，`docs/development/PHASE_33_STARTER_KIT_DISCUSSION.md`，`docs/development/PHASE_33_STARTER_KIT_PROTOTYPE_PROPOSAL.md`。
- 工作樹另有前置驗收紀錄、AGENTS、舊 UI 原型與 `phase33-profession-loadout` 未提交內容，不在本次；以固定版本真正 diff 為準。若範圍不吻合請回報。

## 必讀資料與規則優先順序

讀 `AGENTS.md`、`CANONICAL_MANIFEST.md`、`OPEN_QUESTIONS.md`、兩份本次起始配套文件、原型 README、`docs/gameplay/{character_system.md,classes.md,magic.md}`、`docs/world/races.md`、正式 `src/server/content/{races-v2.ts,classes-v1.ts}` 及 `prototypes/phase33-mobile-redesign/DESIGN_SYSTEM.md`。

使用者本次確認的原型範圍與新增決策優先；Canon 中以前標為待定的正式內容，不得用來宣告本原型已正式接入。八件裝備／四能力的數值僅是已確認的原型樣本，不批准正式平衡。前置第五切片只記錄已接受，不重新驗收或改寫其結果。

## 由你實際執行（Codex 本輪全部未跑）

在隔離 checkout、確認完整 SHA 及 BASE 祖先關係後：

```sh
npm ci
npm run build
node --test prototypes/phase33-starter-kit/model.test.mjs
node --import tsx --test prototypes/phase33-starter-kit/catalog.test.ts
node --import tsx --test tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts
git diff --check 7dddce1a02c7171986666b6ea0b06c656a2a2873 TARGET_FULL_SHA
python3 -m http.server 3047 --bind 127.0.0.1 --directory prototypes/phase33-starter-kit
```

最後一項是你隔離環境的 UI 服務，測完停止；不要碰使用者現有服務／5432。瀏覽器使用 `http://127.0.0.1:3047/`，收集實際請求與錯誤。全套回歸若另跑，分開列出；不要求建立資料庫，若自行測 DB 必須新隔離 cluster，不能沿用正式資料。

## 規則／資料案例

1. 五族 v2／四職業 v1 真實原檔對照：固定加成、人類另 2 點、資質分布／有效固定樣本、主項 ×1.25、其他 ×1、先種族後職業取整。基本 8、自由 12 點每項最多 +6，完成人類另 2 點；預覽可少分，建立不可少分／多分／小數／越界。
2. 起始配套僅按初始職業取得：劍士劍＋鎖甲＋重斬＋劍熟練；弓箭手短弓＋皮甲＋瞄準射擊＋弓熟練；斥候匕首＋皮甲＋迅刺＋匕首熟練；魔術師普通木杖＋布袍＋火焰箭書＋杖熟練。僅合法項目自動配置，其他留背包／技能庫。轉職不得重發／改永久已學或熟練，測試庫標示不同來源且去重。
3. 裝備門檻只用 `floor(固有屬性 × 目前職業倍率)`。自己、另一件裝備、任何技能的加成都不能支撐門檻。停用裝備不給護甲／屬性／武器與施法來源；仍保留位置，合法時自動恢復。
4. 技能資格只加入生效裝備。所有技能加成均排除需求；重斬需生效劍、瞄準射擊需生效弓、迅刺需生效匕首。沒有職業技能種類硬鎖。
5. 火焰箭書本本身智慧需求 12、法術技能智慧需求 15 分開核對。書本逐技能格綁定且須持有，無木杖需求；拿到書不永久學會。直接路線需要已學＋獨立資格，不能由高資質／職業賦予；UI 固定無資格樣本，不假做學習或抽取。
6. 六格、停用仍佔格與自動恢復、未持有書本、重複同技能／同書、錯欄位及越界受阻。只有四項樣本能力；不得要求為填滿六格臨時造正式能力。未配置的不合格起始技能不因轉職憑空新增格位。
7. 最終屬性及 HP／MP 公式採生效技能，資格屬性不採技能。上限提高不補充，下降只截超出部分，上限恢復不補回、HP0不復活、MP0不補魔，無隱藏差額。確認套用按完整最終配置一次計算，不經中間卸裝狀態截低；取消預覽完全不改配置／資源。
8. 原型出生資源先用無配套推導滿值一次，再配置合法配套依不補充政策變更上限。這是本原型樣本設定，不改正式出生紀錄；按鈕的受傷／耗魔／零／上限情境是明確測試資料，不是治療／復活。

## 必須實際操作的 UI 案例

- 按 README 九步完整操作，記錄前後值；配點畫面與確認頁紅字列物品／技能、目前判定值、門檻、差額和來源。合法分配帶警告可繼續；不能提前揭曉資質／資格／龍息或呼叫 RNG。確認後才出現固定結果文字，不能誤寫正式抽取。
- 預設人類劍士：HP 55／58、MP 60／60。載入目前上限測試值後，卸鎖甲降到55／55，穿回55／58；取消不變。卸劍使重斬停用，原第1格保留，還劍恢復。
- 人類魔術師，自由 `2／2／1／3／2／2`、人類力量 +2：智慧裝備判定13、技能資格15、最終16，MP72／84。卸木杖法術仍生效；轉劍士裝備判定智慧11、布袍不能支撐書門檻，書／火焰箭停用，MP52／52；轉回52／84恢復但不補回。
- 五族／四職業選擇、返回配點保持分配、重選相同種族保持人類點數；切不同種族明確核對種族點。新配置受阻按鈕不可啟動；停用既有格可檢視／清空。詳細值在 Sheet，不把長清單堆在總覽。
- 技能庫 → 單格 → 預覽的返回、關閉、Esc／scrim取消；快速開關再開，不被延後原生 close 事件清空。入口／返回焦點、標題初始焦點、原生dialog焦點限制、選取／按壓／disabled狀態、讀屏名稱及aria-expanded。
- 320／375／390／430 CSS px、短螢幕及橫向、200%文字與zoom、reduced-motion、reduced-transparency、鍵盤核對。清單內部捲動，返回／開啟回頂；主畫面三個入口與六格可到達，不用大量主頁捲動完成核心配置。不得以裁字或關閉zoom換取一屏。
- 測量文字與有語意元件對比、44×44 CSS px觸控、safe-area；焦點至少不被完全遮住的 AA 與完整可見 AAA 分開表述。Chrome以外、真手機、讀屏是否實測逐項標明，不能用桌面emulation冒充。
- DevTools／實際網路紀錄證明只載入原型靜態資源；不使用 API、資料庫、LLM、localStorage／sessionStorage，不碰已有角色或存檔；重新整理回到配點。

## 回報要求

先列固定 TARGET／BASE 完整 SHA、範圍、環境與命令 exit code，再給工程 PASS／FAIL。缺陷逐項列嚴重度、檔案／行號、影響與可重現步驟；樣本平衡建議與無法歸因問題歸 Info。

分開「本輪實做」「引用舊結果」「未測」「受阻」，不要推斷未測瀏覽器或正式遊戲通過。列出證據檔路徑與可核對輸出、截圖；停止你新增的預覽服務，保留必要證據。不改檔案、不 commit／push、不向其他對話發訊息，也不重新判定使用者已接受的前置切片。最終原型接受仍由使用者決定。
