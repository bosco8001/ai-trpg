# Phase 33 第三切片工程審查 prompt（尚未送達）

本 prompt 為原先準備、尚未送達的外部交接。使用者於 2026-10-07 明確指示「這次交給你親自驗證」，本輪改由 Codex 親測並記錄工程 PASS，沒有 Grok 結果，不自動送出本 prompt。本次例外不延伸後續階段，來源見第三切片文件。

若後續另要求 Grok，TARGET 完整 SHA 仍須使用者限定 commit／push 授權或自行提交後填入；未提交不代表 bot 能讀到本地檔案。下方為待按最新差異更新的原交接範本，不冒稱已送達。

---

請由 AI TRPG Architecture Critic 真正執行工程驗證；不要修改 repository、commit／push、部署或宣告使用者驗收。

Repository：https://github.com/bosco8001/ai-trpg
Branch：codex/phase27-mobile-ui
BASE：6dfa95e1d84cb1c7ef0a1aa64be13919f3cf8316
TARGET：待填入 bot 可讀取的遠端完整 SHA

## 範圍與必讀

本輪是 Phase 33 第三切片的獨立手機推導原型，另含前一切片已由使用者親自接受、尚未提交的 D1–D4 補修。BASE 的 Grok t46u 為 FAIL；使用者回報的 build 成功、377 pass／0 fail／41 skipped 不當成新 TARGET 的工程結果。請獨立複驗，不把前一輪移除 CSS 的隔離實驗當成本次正式結果。

18 個唯一檔案限定範圍：

- `prototypes/phase33-character-derivation/` 的 index.html、style.css、app.mjs、model.mjs、model.test.mjs、README.md、GROK_REVIEW.md（7）。
- `docs/development/PHASE_33_CHARACTER_DERIVATION_DISCUSSION.md`、`docs/gameplay/character_system.md`、`docs/gameplay/classes.md`、`docs/development/PHASE_26_FINAL_SPEC.md`（4）。
- `docs/development/CANONICAL_MANIFEST.md`、`OPEN_QUESTIONS.md`、`IMPLEMENTATION_PLAN.md`（3，共用第二切片紀錄）。
- `src/web/main.tsx`、`ClassCatalogPanel.tsx`、`class-catalog.css`、`docs/development/PHASE_33_CLASS_CATALOG.md`（4，前一切片補修）。

必讀 AGENTS.md、上述 Canon／規格、`docs/world/races.md`、兩份 Phase 33 切片規格及已接受原型 DESIGN_SYSTEM.md。若遠端 diff 不符合本範圍，先回報真實差異；不要猜 TARGET。

## 新規則與精確邊界

先加種族再乘目前職業，主項 ×1.25 其餘 ×1，向下取整。技能加成不支撐需求，最終屬性含生效裝備／技能；本輪樣本兩者都為 0，不新增正式內容。HP／MP 依最終體質／智慧。

本輪使用者明確修訂上限提高／下降時 current 增減相同差額、保留缺少量；40／55 → 49／64 → 40／55。零 HP 維持 0，不救援／復活；零 MP 可因上限增加取得相同差額。下降後存活 HP 低於 1 或 MP 小於 0 的永久玩法尚未批准，原型整份受阻、保留前值與明確原因，不能把這個工程保護升級為正式玩法。

Phase 26 正式 domain 仍是歷史實作，本次沒有遷移；文件明確標示新修訂與尚未接入。臨時上限消失、Start／Load／Settlement／永久雙邊原子同步，不得藉此暗中更改。

## 必須實跑並回報

```sh
npm ci
npm run build
node --test prototypes/phase33-character-derivation/model.test.mjs
node --import tsx --test tests/content-catalog.test.ts tests/class-catalog.test.ts
env -u TEST_DATABASE_URL npm test
```

另在新建隔離 PostgreSQL 上跑完整測試（依專案 TEST_DATABASE_URL 設定）；不得碰日常 DB 或 5432。回報全部 exit code、通過／失敗／略過數、Node／npm／DB／browser 版本與固定 TARGET。前一切片 D1 Node CSS 載入、D2 refresh 焦點與 Esc、D3 大字職業標題、D4 屬性格重排要獨立複驗。

原型模型案例：五族加成／人類兩點、14 分配上限但種族／職業可超過、精靈智慧 floor((10+1)×1.25)=13、獸人智慧 7 修正 −2、所有非法／未知輸入拒絕、HP／MP 差額上下往返、零 HP／零 MP 區別、未定下限受阻不部分修改。至少做非等價 mutation 驗證順序、floor、需求排除技能、上限增減與零 HP 保護；本原型沒有技能加成輸入，不能冒稱測過未接入的正式裝備／技能路徑。

用只讀 localhost 靜態 server 實測原型：預設 HP40／55、MP48／60；魔術師智慧12 MP56／68；改回 MP48／60；體質增加3 HP49／64、回復40／55；零 HP 樣本永遠0。Sheet 草稿／預覽／確認／取消／Esc／焦點返回、非法表單／少分多分／小數拒絕、一次更新兩種資源、重設與刷新只影響原型。抓網路／儲存確認零遊戲 API／LLM／DB／localStorage 寫入，正式 UI／State／Save 不變。

UI 至少 320／375／390／430px、短螢幕橫向、200%字體／zoom、Tab／Shift+Tab／Esc、reduced-motion、safe-area。測量文字／按鈕對比與 44px 觸控、六格不溢出、Sheet header／footer 不遮內容；清楚區分真手機／讀屏未測。禁止以兩個舊 prototype 的外觀測量替代本輪測量。

## 回報

先給工程 PASS／FAIL、High／Medium／Low 與 Info，逐項重現步驟、位置、影響與證據；列明實跑、引用、未測與受阻，不替使用者決定平衡或驗收。保留首版 t46u FAIL 與所有歷史 Info；不把略過改成通過。清理隔離 server／DB／角色與服務、保留可核對證據，保持 clone 乾淨。若不能取得固定 TARGET 或指定工具，明確回報，不能冒稱已測。
