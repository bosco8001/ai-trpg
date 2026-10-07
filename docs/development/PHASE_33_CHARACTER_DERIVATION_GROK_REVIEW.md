# Phase 33 第四切片：Grok 工程驗證交接

> 最新交接狀態（2026-10-07）：下方是送出前模板與 Git 指令的歷史紀錄。限定 31 檔已提交／推送為 `bb930080ac917a90fc2f6bdf0ecca888ebfcbe87`，實際送出時已填完整 TARGET，並讀回確認送達。Grok t47u 外部回報工程 PASS（限 Chrome），6 項 Info 與未測限制保留；使用者已於 2026-10-07 明確回覆「通過」，第四切片已接受。完整回報見 [第四切片交付](PHASE_33_CHARACTER_DERIVATION.md#2026-10-07-grok-t47u-外部工程回報)。不要照下方待填模板重新送出或重複提交。

送出前紀錄（2026-10-07）：使用者已授權下列限定 31 檔 commit／push 並送 Grok。完整 prompt 已準備；此提交內保留 TARGET 待填模板，實際送出時填入推送後完整 SHA。此刻尚未送達、沒有 Grok 結果。既有未提交前片補修與接受原型一併列作版本前置資料，不冒稱本片新實作。取得固定遠端版本後，透過 Grok Bot Control 核對當次目標 **AI TRPG Architecture Critic**、讀回草稿並只送一次。

## 可直接交給指定 Bot 的完整 prompt

請做工程驗證，不代替使用者的階段驗收。操作者是 Codex。請只在隔離 checkout／資料庫／瀏覽器設定檔驗證，不改正式遊戲資料、既有證據或使用者工作樹；不要自行 commit／push 或宣告 Phase 33 結案。

- Repository：https://github.com/bosco8001/ai-trpg
- 分支：codex/phase27-mobile-ui
- BASE：6dfa95e1d84cb1c7ef0a1aa64be13919f3cf8316
- TARGET：**待填入限定提交／推送後的完整 40 字元 SHA；填入前不要開始驗證**。
- 送出時請先記錄實際遠端 HEAD、確認 TARGET 可讀、BASE 是祖先。若 HEAD 已變，仍以固定 TARGET 驗證，不悄悄改測其他版本。

本次主要範圍是第四切片：正式名冊來源的 Lv.1 屬性推導、容量預覽及系統面板唯讀核對工具。11 個程式／測試檔：

1. src/shared/character-derivation.ts
2. src/domain/character-derivation.ts
3. src/server/character-derivation.ts
4. src/server/app.ts
5. src/web/character-derivation-client.ts
6. src/web/character-derivation-ui.ts
7. src/web/CharacterDerivationPanel.tsx
8. src/web/character-derivation.css
9. src/web/ExplorationPage.tsx
10. src/web/main.tsx
11. tests/character-derivation.test.ts

文件以 docs/gameplay/character_system.md、classes.md 最新 2026-10-07 容量政策為準，並讀 docs/development/CANONICAL_MANIFEST.md、OPEN_QUESTIONS.md、PHASE_26_FINAL_SPEC.md、IMPLEMENTATION_PLAN.md、PHASE_33_DERIVATION_IMPLEMENTATION_PROPOSAL.md、PHASE_33_CHARACTER_DERIVATION.md 與本 prompt。先前「保留缺少量」與 B 已撤回；歷史段落不可當成最新規則。

BASE 還未包含下列已接受、尚未提交的前置內容。若它們出現在此次提交 diff，請分開歸因：

- 第二切片 D1–D4 補修：ClassCatalogPanel.tsx、class-catalog.css、main.tsx 及 PHASE_33_CLASS_CATALOG.md／三份狀態文件。包含 CSS 改到正式入口載入，這是 Node 測試能讀取 ExplorationPage 的前置；首版 Grok t46u FAIL 保留，沒有補修 Grok PASS。使用者曾回報 build／377 pass／0 fail／41 skipped 並接受，屬使用者提供的結果，請勿代替本輪實測。
- 第三切片已接受的獨立原型：prototypes/phase33-character-derivation/ 七檔及 PHASE_33_CHARACTER_DERIVATION_DISCUSSION.md。原型仍用歷史差額算法，故不應拿其目前資源往返結果當作第四切片期待值。原型當輪曾由使用者明確授權 Codex 親測，本輪不沿用；其舊程式只保存作比較，不是正式引用來源。
- 不含 AGENTS.md、Phase 31 補正、phase33-mobile-redesign 文件或 profession-loadout 原型的其他工作樹變動。

Codex 本輪只實作、讀程式／Git／文件及準備 8 項測試；沒有執行任何 build、typecheck、格式檢查、自動測試、資料庫或瀏覽器／UI 驗證。請實際執行、記錄原始輸出、exit code 及來源版本：

```sh
npm ci
npm run build
node --import tsx --test tests/character-derivation.test.ts tests/class-catalog.test.ts tests/content-catalog.test.ts
env -u TEST_DATABASE_URL npm test
git diff --check "$BASE_SHA" "$TARGET_SHA"
```

BASE_SHA／TARGET_SHA 需設成上述固定完整 SHA。沒有隔離 DB 時，DB 測試略過要照實列出，不把略過算通過；本片沒有 PG schema／migration，若測 PG 請只用新隔離叢集／角色，不能碰使用者常用 DB。LLM 不需連線或 key。禁止拿以前的 build 或測試結果替代本輪結果。

必要工程核對：

1. 正式五族 v2／四職業 v1 由既有 loader／resolver 解析，20 組內容數值及小數 floor、負數修正正確；不引用原型鏡像或 TEST 值，不產生起始角色、施法資格或職業被動戰鬥效果。
2. 嚴格 sample／版本／欄位／種族資質／一般 12 點／人類 2 點驗證；未知引用、稀疏陣列、超出點數、小數、負值、非法目前資源整份拒絕。原資料本來超過舊上限不能藉新上限 clamp 成合法。
3. 最新容量：40／40 → 40／54；50／54 → 40／40 → 40／54；5／55 → 5／49；MP 2／60 → 2／52；零 HP 不復活、零 MP 不免費增加、MP 新上限 0 仍合法。HP 上限至少 1。不另存缺少量，也沒有切換補血漏洞。
4. POST 是純計算而非狀態 mutation；before 基準是樣本，不是角色身分／revision。讀取遊戲狀態與 save slots 前後完全一致；抽查成功、失敗、重複計算均沒有存檔、Run、Combat、SQL、LLM 或 localStorage 寫入。回應 no-store、請求 4096 bytes／前端回應 32 KiB 有界，malformed JSON／過大請求與規則拒絕安全，不回傳原請求、stack／路徑。
5. 前端只接受完整且吻合本次 sample、before、schema／名冊版本的結果。計算失敗、5 秒逾時、取消或卸載保留原樣本；編輯期間更改草稿取消舊請求，遲到回應不覆蓋新草稿，舊預覽不能套用到新草稿。
6. 進入探索 → 系統 → 角色屬性核對：正式人類／劍士力量 15、HP 40／55、MP 48／60；魔術師智慧 12、MP 48／68，確認前總覽不變；改回仍 MP 48／60。詳情來源與公式正確，資質明確是已知樣本，沒有提前揭曉玩家資質或表示所有職業已開放。
7. 核對 HP 50 的人類樣本 → 精靈 HP 49／49 → 人類 HP 49／55；設定 HP 0 並提高體質仍維持 0。取消／關閉／Esc 不套用草稿；返回編輯／明細入口焦點正確，Esc 不同時關外層系統，Tab 不到外層操作；輸入驗證及錯誤焦點／讀屏語意可用。
8. 用實際瀏覽器核對 320／375／390／430px 寬、一般高度與 375px 短橫向、100%／200% 文字、reduced-motion、三種 view、失敗與重試狀態。避免 CSS 根字級模擬與瀏覽器縮放／OS 大字混稱。確認主要操作／關閉可見，長內容在 Sheet 內捲動、無橫向溢出、48 CSS px 操作目標與大字 reflow。若 Safari／真手機／讀屏未測，照實列未測，不推測 PASS。
9. 閱讀正式樣式、React StrictMode 開關／重試／請求清理、載入失敗不產生空白可套用結果，無未處理 rejection／console error。抽查舊種族／職業名冊與系統工具沒有退化。
10. 文件正確區分原型歷史接受、前置補修使用者結果、第四切片待驗證／待驗收；不寫正式 R05、創角／轉職／配裝／持久角色已完成。未定玩法、舊觀察與測試限制仍保留。

回報格式：TARGET／BASE 完整 SHA、分支／遠端核對、實際環境、每條命令與 exit code／測試通過及略過數、HTTP／UI 真實案例和證據目錄、逐項 PASS／FAIL／未測／受阻、缺陷嚴重度與檔案行號／重現／影響、前置／本片／既有問題歸因、清理狀態。明確說工程是否通過，不代替使用者驗收；推斷須標示，資料不夠就保留待驗證。

## 限定 Git 交付範圍（使用者已授權）

共 **31 個獨立檔案**：本切片 20 檔（11 程式／測試、9 文件），前片補修另 3 檔，以及已接受原型封存 8 檔。可以分成前置接受內容與第四切片兩個 commit，重疊文件須用部分暫存；不要用 git add .，也不要包含本段明列排除項目。使用者本次授權僅涵蓋此清單；本 prompt 未填 TARGET 前不得送驗。

以下是可審閱的限定指令，**Codex 尚未執行**。若一次提交此 31 檔，BASE 如上；若使用者選擇拆成兩個 commit，先記錄前置 commit SHA，再於送出 prompt 明列其範圍與第四切片父版，不能只改 BASE 隱去前置依賴。

```sh
git add -- \
  src/shared/character-derivation.ts \
  src/domain/character-derivation.ts \
  src/server/character-derivation.ts \
  src/server/app.ts \
  src/web/character-derivation-client.ts \
  src/web/character-derivation-ui.ts \
  src/web/CharacterDerivationPanel.tsx \
  src/web/character-derivation.css \
  src/web/ExplorationPage.tsx \
  src/web/main.tsx \
  tests/character-derivation.test.ts \
  docs/gameplay/character_system.md \
  docs/gameplay/classes.md \
  docs/development/PHASE_26_FINAL_SPEC.md \
  docs/development/CANONICAL_MANIFEST.md \
  docs/development/OPEN_QUESTIONS.md \
  docs/development/IMPLEMENTATION_PLAN.md \
  docs/development/PHASE_33_DERIVATION_IMPLEMENTATION_PROPOSAL.md \
  docs/development/PHASE_33_CHARACTER_DERIVATION.md \
  docs/development/PHASE_33_CHARACTER_DERIVATION_GROK_REVIEW.md \
  src/web/ClassCatalogPanel.tsx \
  src/web/class-catalog.css \
  docs/development/PHASE_33_CLASS_CATALOG.md \
  docs/development/PHASE_33_CHARACTER_DERIVATION_DISCUSSION.md \
  prototypes/phase33-character-derivation/index.html \
  prototypes/phase33-character-derivation/style.css \
  prototypes/phase33-character-derivation/app.mjs \
  prototypes/phase33-character-derivation/model.mjs \
  prototypes/phase33-character-derivation/model.test.mjs \
  prototypes/phase33-character-derivation/README.md \
  prototypes/phase33-character-derivation/GROK_REVIEW.md
git diff --cached --name-only
git diff --cached
git commit -m 'feat: add official character derivation sample tool'
git rev-parse HEAD
git push origin HEAD:codex/phase27-mobile-ui
git ls-remote origin refs/heads/codex/phase27-mobile-ui
```

暫存前須讀取是否已有使用者暫存內容，不能把別人的 staged 內容帶入 commit；限定名單核對是閱讀 Git，不是測試通過。Git 授權不代表本片工程或使用者驗收通過；成功取得固定 TARGET 後主動核對指定 Bot 對話並送達。
