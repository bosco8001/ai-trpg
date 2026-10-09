# Phase 33 第五切片 Grok 工程驗證要求

## 目前：M1 補修待複驗（2026-10-09）

Grok 對 `efaa63625e46bfa0602699a8f9948bc69f91ac3f` 的外部複驗仍為工程 FAIL；D1／D2 PASS、N2 細縫消失、官方 build 成功及隔離 PG 453／453，但新增 M1 Medium：整張 Sheet 捲動後，步驟切換仍只重設正文，標題在畫面外。M1 TSX 補修與獨立瀏覽器案例已準備，尚未提交／推送／送達新複驗；使用者已於 2026-10-09 授權限定七檔 commit／push 並複驗，使用者待驗收，Codex 未執行測試。完整結果見 [交付](PHASE_33_CHARACTER_CREATION.md#第一次補修外部結果與-m1)。

送驗時用本文最後的「M1 複驗」要求；以下交接紀錄與前兩版要求為歷史，不重送舊 TARGET，不把原七檔授權當新 TSX 範圍的授權。

## 歷史複驗送達（2026-10-08，提交後補記）

限定七檔已提交及推送為 `efaa63625e46bfa0602699a8f9948bc69f91ac3f`，BASE `30cf31fd3fba1d43c5e0c0428d01af20ac421e3a`；遠端指定分支已核對一致。完整複驗訊息已由 Grok Bot Control 送交 AI TRPG Architecture Critic，讀回新增送出訊息及空白輸入框；只送一次，工程結果待回覆、使用者待驗收。訊息 SHA-256 為 `27138c2770e8c3442a545cbcfecaec06602a4be5b45eeba772348b122274e602`。

本段尚未另行提交，不屬受測 TARGET；以下為提交前與首輪歷史紀錄。送交訊息使用上述完整 SHA，已替換待填 TARGET；不以浮動 HEAD 或本地未提交文字當受測版本。Codex 未執行補修測試。

目前：首版 `30cf31fd3fba1d43c5e0c0428d01af20ac421e3a` 已提交／推送／送達，**Grok t48u 外部工程 FAIL**；完整結果見 [交付報告](PHASE_33_CHARACTER_CREATION.md#首輪外部工程報告與同切片補修)。D1／D2／N2 同切片補修已準備，使用者已於 2026-10-08 授權限定七檔 commit／push 及複驗，提交前尚未推送或送達；Codex 沒有執行工程測試，使用者尚未驗收。請用本文最後的「補修複驗」要求，不重送首輪訊息。

## 首輪歷史交接（已完成，以下指令不適用本次七檔補修）

本次交接狀態於 TARGET 提交後補記，尚未再次提交，不屬受測 TARGET 的內容。送出訊息採以下完整 SHA；TARGET 文件中的提交前狀態及待填欄位是當時紀錄。訊息摘要 SHA-256：`b2d94bde6c9b9b02a46d595283184ad5c490c62acaa3356166794e3232efcb34`。本次只送出一次，不將前切片的報告當成第五切片結果。

Repository：`https://github.com/bosco8001/ai-trpg.git`

Branch：`codex/phase27-mobile-ui`

BASE：`bb930080ac917a90fc2f6bdf0ecca888ebfcbe87`

TARGET：`30cf31fd3fba1d43c5e0c0428d01af20ac421e3a`（已核對推送後的遠端指定分支；不改測浮動 HEAD 或本地未提交檔）

## 限定提交指令（已獲本次授權，以下保留提交前指令）

只包含 [交付所列 35 檔](PHASE_33_CHARACTER_CREATION.md#限定本次-35-檔)，含前切片純文字外部結果與接受紀錄。先閱讀 Git 狀態與 staged diff，若有原先 staged 改動，不將其混入；不執行 `git add .`。

```sh
git status --short
git branch --show-current
git rev-parse HEAD
git diff --cached --name-only
git add -- \
  src/shared/character-creation.ts \
  src/domain/character-creation.ts \
  src/server/character-creation/contracts.ts \
  src/server/character-creation/memory-repository.ts \
  src/server/character-creation/postgres-repository.ts \
  src/server/character-creation/service.ts \
  src/server/character-creation/routes.ts \
  src/server/app.ts src/server/index.ts \
  src/web/ExplorationPage.tsx src/web/main.tsx \
  src/web/CharacterCreationPanel.tsx \
  src/web/character-creation-client.ts \
  src/web/character-creation-ui.ts src/web/character-creation.css \
  migrations/1791300000000_character_creation_records.mjs \
  tests/character-creation.test.ts tests/character-creation-postgres.test.ts \
  tests/helpers/character-creation.ts \
  docs/gameplay/character_system.md docs/gameplay/classes.md \
  docs/gameplay/magic.md docs/world/races.md \
  docs/development/CANONICAL_MANIFEST.md \
  docs/development/IMPLEMENTATION_PLAN.md docs/development/OPEN_QUESTIONS.md \
  docs/development/PHASE_33_CHARACTER_CREATION_DISCUSSION.md \
  docs/development/PHASE_33_CHARACTER_CREATION_PROPOSAL.md \
  docs/development/PHASE_33_CHARACTER_CREATION.md \
  docs/development/PHASE_33_CHARACTER_CREATION_GROK_REVIEW.md \
  docs/development/PHASE_33_CHARACTER_DERIVATION.md \
  docs/development/PHASE_33_CHARACTER_DERIVATION_DISCUSSION.md \
  docs/development/PHASE_33_CHARACTER_DERIVATION_GROK_REVIEW.md \
  docs/development/PHASE_33_DERIVATION_IMPLEMENTATION_PROPOSAL.md \
  prototypes/phase33-character-derivation/README.md
git diff --cached --name-only
git diff --cached
git commit -m "feat: persist one character creation record"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
git ls-remote origin refs/heads/codex/phase27-mobile-ui
```

AGENTS、Phase 31 文件、mobile-redesign 文件及 profession-loadout 原型既有改動保留原狀，不包入本次。審查文件中的 TARGET 自我 SHA 無法在同一 commit 填寫；送交訊息須用提交後完整 SHA，之後另補送達／結果紀錄，不把未提交紀錄當新受測程式。

## 首輪完整 prompt（歷史紀錄，已送出）

以下訊息送出前替換 TARGET，從當次 Grok 介面核對對話標題，讀回確認送達，只送一次。沒有可讀版本或工具受阻時保留待驗證，不冒稱送達。

```text
請以 AI TRPG Architecture Critic 為本次 Phase 33 第五切片做工程驗證。這不是使用者的階段驗收；請讀新 TARGET 並實際執行，不沿用第四切片或原型 PASS。請勿替使用者改檔、提交、推送、合併或開始下一切片。

repository https://github.com/bosco8001/ai-trpg.git
branch codex/phase27-mobile-ui
BASE bb930080ac917a90fc2f6bdf0ecca888ebfcbe87
TARGET 30cf31fd3fba1d43c5e0c0428d01af20ac421e3a

先核對遠端可讀、TARGET／BASE 完整 SHA、祖先關係與完整 diff；若遠端更新，不改測浮動 HEAD。範圍為第五切片獨立角色出生紀錄、PostgreSQL 保存／重試、分步手機畫面、Canon／必要測試與文件；限定 35 檔見 PHASE_33_CHARACTER_CREATION.md。五份前切片文件只記錄 t47u 外部結果／使用者接受／原型封存，不是第五切片程式變更或親測結果。排除 AGENTS、Phase31、mobile-redesign 及 profession-loadout 未提交變更。

必要文件：AGENTS.md、CANONICAL_MANIFEST.md、OPEN_QUESTIONS.md、IMPLEMENTATION_PLAN.md、PHASE_33_CHARACTER_CREATION_PROPOSAL.md、PHASE_33_CHARACTER_CREATION_DISCUSSION.md、PHASE_33_CHARACTER_CREATION.md、PHASE_33_CHARACTER_CREATION_GROK_REVIEW.md；gameplay/character_system.md、classes.md、magic.md、world/races.md。遵循使用者已確認規則，未定內容不自行補定。

已批准：五族 v2／四初階職業 v1；基礎 8、分配 12（各最多 6）、人類另 2；先加種族再乘主項 1.25 並 floor，Lv1／裝備技能加成 0；資質依正式種族分布；資格獨立 1%、職業／資質無影響；具體血脈尚未揭露、不生成秘密身世；龍裔火冰雷各 1/3，非龍裔沒有龍息。首次滿 HP／MP，只初始化一次。後續提高容量不補資源、下降只截超出部分、HP0不復活，不採缺少量或隱藏債務。本切片保存不可編輯出生紀錄，尚未接正式冒險／Run、起始裝備／技能／熟練、轉職配裝、戰鬥或三槽 Save 升版。本切片只有一名角色，正式版多角色與列表是後續必做，不能誤判成永久單角色規則。

命令與結果請保留 exit code、環境及測試數／略過：npm ci；npm run build；node --import tsx --test tests/character-creation.test.ts tests/character-creation-postgres.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts；無 DB 的 npm test；獨立 TEST_DATABASE_URL 的完整 npm test；git diff --check BASE TARGET。新測試由 Codex 撰寫、未執行，不能假設能編譯或通過。無 DB 略過 PG 不算通過。若指令檔名或設定有誤，據 TARGET 更正並回報實際命令。

資料庫必須新建隔離環境，不能碰既有 DB、5432 的正式服務或使用者角色。核對所有 migration（含新表），透過現有 DOMAIN_STORAGE=postgres 實際 index.ts 啟動，不只注入 Memory adapter。執行新 PG 測試及必要真故障；檢查 max／timeouts／交易鎖／UNIQUE 和 onClose，不把可注入 Memory adapter 當 runtime 持久化。既有目前資料、三槽、修復準備／套用／token／敘事資料在角色建立前後內容與版本不變。

逐項工程重點：
1. RNG：100 個 aptitude 整數邊界符合每族權重；第二次獨立 1% 資格；三個龍息等份；零機率資質不可生成。不是每 100 個人必有一位。正式請求沒有指定 RNG 結果或測試 seed 開關，TEST 值不混入。
2. 20 組種族／職業及人類自由點、floor／負數修正／公式／初始資源。生成結果與原始分配／正式定義／版本一起保存。讀回不重抽、不覆寫、不初始化 live 資源。
3. 同 ID 同輸入重播原紀錄；同 ID 異內容拒絕；不同 ID 已有角色拒絕。兩分頁／兩服務同時建立、新 DB 唯一限制與鎖內生成，只能一份成功。輸入／回應 clone 避免外部 mutation。
4. 真保存失敗回滾沒有半份角色或揭曉；真 COMMIT 已成功但回覆遺失、逾時／連線中斷、取消及遲回覆，UI 不冒稱確定失敗或換 ID 重抽；同一次查詢／重試恢復原結果。合成 COMMIT 丟回覆測試不等於真 TCP 測試，請分開回報。等待鎖取消與超時不生成第二份，程序存活、health 正常、下一操作恢復。
5. 真服務重啟及新連線池讀回同一角色 ID／資質／資格／龍息／版本／初始資源，RNG 不再呼叫。Memory runtime 503／固定 PostgreSQL 提示，不能成功生成暫存角色。沒有 migration／DB不可用也安全拒絕。
6. 嚴格輸入／持久資料／client 驗證：額外欄位、query、自帶 owner／RNG、TEST／未知 ID、UUID／版本／分配錯誤、名冊名稱／被動快照假冒、錯誤結果／request 綁定、損壞 JSONB、摘要衝突、超大／截斷／非法UTF8／取消回應。未知版本不偷偷補值或拿新名冊重算；原始列保留。
7. 日誌／回應只用固定安全欄位／文字；錯誤中不得包含 DB url／host／port／user／密碼／SQL／stack／路徑／原始 err。用合成 marker 核對，不公開真憑證。沿用 PG helper 的既有 FATAL query 缺少日誌 Info 不能自動算已修正，若觸發須如實區分。
8. production 探索 → 系統 → 角色建立與核對的真入口；選擇／分配／最後確認／保存／結果完整流程。草稿與確認前不生成／揭曉，尤其最終 MP 不洩漏資質；取消前保存列仍空；建立後唯讀，不提供覆寫或第二名角色。既有樣本工具仍是樣本，沒有變成正式狀態。
9. UI pending：送 POST 前 sessionStorage 保留同次 request／輸入，無法保存或讀取識別就不送新 POST；只保留輸入、沒有未保存秘密結果。保存中連按／Enter 只送一次；關閉、重開、重整先 GET。網路錯誤／晚回覆／舊回應不得覆蓋新面板；unknown 不能返回編輯來換新身分，明確非法輸入拒絕才允許修正草稿。查詢純讀，不自動 retry POST。
10. 三項 UI 技能沿用已接受 Design System 02，分步 Full-screen Sheet、固定操作列、詳細名冊與計算折疊。標籤、錯誤摘要／連到欄位、48px觸控、鍵盤焦點／Tab／Esc／返回入口與外層系統面板、Pressed／disabled／loading、reduced motion、安全區與對比。至少 320×568／375×667／390×844／568×320／844×390／desktop，100%與200%文字／zoom分開，短畫面主要操作不能被切掉、內容可捲動且不橫向溢出。具體瀏覽器、真手機、讀屏或 Safari 未測須寫明，不能把 DOM 靜態檢查當實測。
11. 必要回歸：既有探索、兩個正式名冊、第四切片樣本工具、三槽 Save／Load、診斷／備份／修復入口、主 pool close／idle 日誌及 SSR CSS 匯入。沒有 API 被提前移到新角色，沒有 LLM 介入抽取或裁定。

報告格式：工程總結 PASS／FAIL／受阻；版本與完整 diff；實際命令／exit code／測試數／略過；逐項 PASS／FAIL／未測／受阻；按 High／Medium／Low／Info 列問題（可定位 TARGET file:line、重現、實測或推斷、影響與最小補修）；本輪實際執行、引用舊結果及未測限制分開。保留第四切片 t47u 的 6 Info 與其他歷史限制，不能因新 client 加 catalog 比對就宣稱舊工具已修。工程 PASS 不宣告 Phase 33 第五切片或整個 Phase 33 已由使用者接受。

提供證據所在位置與可取用方式，遮蔽合成敏感 marker；清理本輪 server／proxy／隔離 DB／schema／角色／process，保留本輪證據，不改舊證據或使用者工作目錄。若被環境或工具阻擋，說明已做項目、阻塞與未做項目，不虛構完成。
```

## 補修複驗（已獲七檔提交授權，以下為提交前紀錄）

首輪來源 t48u，固定 BASE 為 `30cf31fd3fba1d43c5e0c0428d01af20ac421e3a`。新 TARGET 在限定七檔取得 commit／push 授權並核對遠端後填入送交訊息，不能以本地未提交畫面或浮動 HEAD 代替。

### 限定七檔提交指令（已獲本次授權）

```sh
git status --short
git branch --show-current
git rev-parse HEAD
git diff --cached --name-only
git add -- \
  tests/character-creation.test.ts \
  src/web/character-creation.css \
  docs/development/PHASE_33_CHARACTER_CREATION.md \
  docs/development/PHASE_33_CHARACTER_CREATION_GROK_REVIEW.md \
  docs/development/CANONICAL_MANIFEST.md \
  docs/development/IMPLEMENTATION_PLAN.md \
  docs/development/OPEN_QUESTIONS.md
git diff --cached --name-only
git diff --cached
git commit -m "fix: correct character creation tests and short-screen layout"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
git ls-remote origin refs/heads/codex/phase27-mobile-ui
```

先確認沒有其他 staged 改動，保留 AGENTS、Phase 31、舊 mobile-redesign／profession-loadout 原型及其他既有工作。提交七檔之外的檔案需另確認範圍。前次 35 檔授權是已完成的首版提交，不能當本次新版本授權。

### 可直接交指定 Bot 的完整複驗 prompt

```text
操作方：Codex。請 AI TRPG Architecture Critic 為 Phase 33 第五切片 t48u 的 D1／D2／N2 同切片補修做工程複驗。此處 TARGET 必須在取得限定七檔 commit／push 授權、核對遠端後替換；待填代表尚未送驗。請勿替使用者改檔、提交、推送、合併或開始下一切片，工程審查不代表使用者驗收。

repository https://github.com/bosco8001/ai-trpg.git
branch codex/phase27-mobile-ui
BASE 30cf31fd3fba1d43c5e0c0428d01af20ac421e3a
TARGET TARGET_PENDING_FIX_FULL_SHA
首版的父版本 bb930080ac917a90fc2f6bdf0ecca888ebfcbe87 是回歸參考，不改測浮動 HEAD。

先核對完整 SHA、遠端可讀、祖先關係與完整 diff。僅七檔：tests/character-creation.test.ts、src/web/character-creation.css，及 docs/development/{PHASE_33_CHARACTER_CREATION.md,PHASE_33_CHARACTER_CREATION_GROK_REVIEW.md,CANONICAL_MANIFEST.md,IMPLEMENTATION_PLAN.md,OPEN_QUESTIONS.md}。排除 AGENTS、Phase31 及舊原型未提交變更。讀受測版本 AGENTS、上述文件、PHASE_33_CHARACTER_CREATION_PROPOSAL.md，以及 gameplay/character_system.md、classes.md、magic.md、world/races.md；不新增玩法。

首輪 t48u 為外部工程 FAIL：官方 build exit2，測試 7 個 TS 錯誤；兩個必跑測試失敗；全套隔離 PG 451 pass／2 fail，無 DB 401 pass／2 fail／48 skipped；新 7 個 PG 測試 pass。診斷 dist 的 runtime／62項 Chrome UI 結果不能當正式 build UI PASS，本輪須用新 TARGET 正式 npm run build 產物重做。

補修：D1 測試種族 fixture 改讀 createOfficialContentCatalog().catalog 的已驗證快照，state 明確採 CreationState，沒有以不安全型別斷言壓錯誤；D2 矮人／龍裔弓箭手的感知期望改 12（floor(10×1.25)），SQL 正規式用單詞邊界，另斷言完整固定 code/message，兩個 runtime 模式仍逐一覆蓋，不刪測試。N2 可用高度 <=28rem 壓縮 header/footer 留白、保留48px控制項，整張 Sheet 的 frame 捲動，body 不再作被固定上下列擠壓的捲動區；正常高度保留原固定操作列，沒有修改 TSX 的流程／focus／pending，也未改生成／保存／交易／名冊／API規則。

由你執行並回報實際命令、exitcode、環境、測試數及略過：npm ci；npm run build；node --import tsx --test tests/character-creation.test.ts tests/character-creation-postgres.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts（分無DB與隔離PG）；env -u TEST_DATABASE_URL npm test；隔離 TEST_DATABASE_URL 的 npm test；git diff --check BASE TARGET。Codex 沒有執行補修驗證，略過不算pass；build若仍失敗，不跳過typecheck後宣告正式UI通過。

D1：確認七個原錯誤消失、官方Vite/server產物可用。D2：20組預期逐項獨立核對，確認弓箭手兩組感知12且整個迴圈走完；固定PostgreSQL提示接受，但原始SQL token、URL、host/port、密碼、stack/path仍不可洩漏；memory與postgres分支都執行。不要為了通過修改遊戲公式或刪弱測試。

N2：用官方 dist、真 index.ts、NODE_ENV=production、DOMAIN_STORAGE=postgres 與新建隔離DB，從探索→系統→角色建立與核對走全部步驟。重做320×568、375×667、390×844、568×320、844×390與desktop，分開100%／200%文字大小及瀏覽器zoom；真zoom和模擬zoom分開回報。至少記錄正文可讀的實際視窗面積、整張Sheet捲動、頂部關閉和最底確認／重試／完成能否操作。放大後不能只留下32/59px細縫、藏文字、水平溢出、雙捲動或焦點被截掉。短高度允許標題與操作列在Sheet內正常流動，捲到內容／操作，不要求它們同時固定；一般高度仍固定操作列。檢查錯誤摘要／連到輸入、details展開、Tab/ShiftTab/Enter/Esc、內層返回外層與入口焦點、步驟改變回到頂部、旋轉或放大後焦點與捲動位置、安全區48px、pressed/disabled/loading與reducedmotion。正式UI流程重做保存前不揭曉、sessionStorage先保留request、連按單POST、取消、未知／晚回覆、查詢與同次重試、重整／重啟讀回且結果唯讀；只引用t48u的項目須明列引用，不算本輪新做。

必要回歸：既有探索、五族／四職業名冊、第四切片樣本工具、三槽存讀檔、診斷／備份／修復入口、SSR；新樣式只在creation-sheet生效，不改舊工具。使用隔離資源，不能碰5432或使用者的角色／存檔，不用重抽或刪正式資料測試。保留首次滿HP/MP、後續提高上限不補資源／下降只截超出部分、保存後揭曉、單角色暫行／正式版多角色後續必做等已確認契約。

N1/N3/N4/N5/N6及歷史Info保留；N4既有歸因只有推斷，沒有BASE重現，舊FATAL缺log本輪未觸發，不宣告已修。N7補寫文件目前／歷史版本，讀新紀錄核對。t47u I1–I6、t46u、第一切片與原型02舊Info保留，第四切片偽造回應問題未在本輪修；真手機／讀屏器／OS字體／Safari/WebKit／mutation等未測或受阻如實標記。

報告總結PASS/FAIL/受阻，逐項D1/D2/N2的證據與新問題，完整SHA/diff/命令/exit/統計；實做、舊結果引用、推斷、未測及受阻分開。提供可定位file:line、重現與最小修正，另提供遮蔽marker的證據位置。清理本次server/proxy/DB/schema/role/process，保留證據，不改舊證據。工程PASS不宣布第五切片或Phase33已由使用者接受。
```

## M1 複驗（已獲七檔授權，以下為提交前紀錄）

### 限定七檔指令（已獲本次授權）

```sh
git status --short
git branch --show-current
git rev-parse HEAD
git diff --cached --name-only
git add -- \
  src/web/CharacterCreationPanel.tsx \
  tests/browser/character-creation-scroll.mjs \
  docs/development/PHASE_33_CHARACTER_CREATION.md \
  docs/development/PHASE_33_CHARACTER_CREATION_GROK_REVIEW.md \
  docs/development/CANONICAL_MANIFEST.md \
  docs/development/IMPLEMENTATION_PLAN.md \
  docs/development/OPEN_QUESTIONS.md
git diff --cached --name-only
git diff --cached
git commit -m "fix: reset character creation sheet scroll between steps"
git push origin codex/phase27-mobile-ui
git rev-parse HEAD
git ls-remote origin refs/heads/codex/phase27-mobile-ui
```

只包含上述七檔，保留 AGENTS、Phase 31、舊原型及其他既有工作。前次七檔已提交，沒有涵蓋本次 TSX 與新增瀏覽器案例；尚未送出下列訊息，不以待填 TARGET 宣告送達。

### M1 完整複驗要求

```text
操作方：Codex。請 AI TRPG Architecture Critic 工程複驗第五切片 M1 最小補修；這不是使用者驗收。送出前須取得限定七檔 commit／push 授權、填入完整新 TARGET 並核對遠端。不要替使用者改檔、提交、推送、合併或開始下一切片。
repository https://github.com/bosco8001/ai-trpg.git
branch codex/phase27-mobile-ui
BASE efaa63625e46bfa0602699a8f9948bc69f91ac3f
TARGET TARGET_PENDING_M1_FULL_SHA
回歸參考 30cf31fd3fba1d43c5e0c0428d01af20ac421e3a、bb930080ac917a90fc2f6bdf0ecca888ebfcbe87，不改測浮動 HEAD。

先核對固定 SHA、遠端可讀、祖先及完整 diff。僅 src/web/CharacterCreationPanel.tsx、tests/browser/character-creation-scroll.mjs，以及 docs/development/{PHASE_33_CHARACTER_CREATION.md,PHASE_33_CHARACTER_CREATION_GROK_REVIEW.md,CANONICAL_MANIFEST.md,IMPLEMENTATION_PLAN.md,OPEN_QUESTIONS.md} 七檔。讀 AGENTS、上述文件、完整創角提案及 Character/Classes/Magic/Race Canon；排除既有 AGENTS、Phase31、舊原型未提交改動。Codex 未執行本地測試，不能預先假設新案例可用。

前次官方 build／typecheck成功、隔離PG453/453、無DB403pass/48skip，D1/D2 PASS及N2窄條消失，但工程FAIL：M1短螢幕轉步驟未回頂，焦點標題在外。最小產品補修只加frame ref，在既有[open,step,ready] useLayoutEffect重設frame和body的scrollTop，再focus標題；沒有改CSS、旋轉事件、流程順序、pending、生成／保存／交易／API／名冊或遊戲規則。N9旋轉焦點問題未在此修復，不沿用M1通過宣告它已解決。

由你執行npm ci、npm run build、指定五檔node --import tsx --test tests/character-creation.test.ts tests/character-creation-postgres.test.ts tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts（無DB與隔離PG）、env -u TEST_DATABASE_URL npm test、隔離TEST_DATABASE_URL npm test、git diff --check BASE TARGET。回報環境、實際命令、exitcode、測試數／skip；略過不算PASS。build若失敗不得跳過typecheck判正式UI通過。

核心M1：官方dist、真index.ts、production/postgres、新隔離DB。844×390、100%字，選擇與分配各捲到底再下一步，最後確認應從頂顯示身份／六屬性，標題焦點完整可見；返回分配再前進也回頂。重做568×320的真200%瀏覽器縮放，及844×390、320×568模擬縮放的原8項FAIL，BASE同操作應重現M1、TARGET消失；真與模擬縮放分開記錄。320×568、375×667、390×844與desktop核對正常正文捲動仍回頂、footer固定；短模式保留整張Sheet捲動，不能退回原32/59px窄條。

新增瀏覽器案例不是npm test glob的一部分。請以你現有Playwright環境匯入tests/browser/character-creation-scroll.mjs的checkCreationStepScroll(page)，先在隔離空角色／無pending的Sheet開到「種族與職業」再呼叫。案例選精靈弓箭手、各2點，只操作草稿；三次transition各先assert真的有scrollTop>4，再檢查frame/body<=1、焦點與標題完整可見，不按確認保存。至少844×390的100%字、568×320真200%zoom、320×568模擬200%zoom執行；另記錄所有before/after數值，核對POST數0。沒有捲動距離的樣本不當M1重現成功；helper若不可用報實際錯誤，不默默略過。請另外用人類另2點與鍵盤Enter操作獨立重驗，不能只靠這個helper或讀碼判通過。新案例只檢查草稿轉步驟，保存／重開／ready與pending/result仍需下面的真流程核對。

正式UI流程回歸：保存前不揭曉、sessionStorage先保留原request、連按／Enter單POST、取消／Esc／外層返回、未知或晚回覆仍查詢與同ID重試、關閉再開、重整／服務重啟同結果唯讀；切換至pending/result及重新讀取ready時標題／捲動正確，失敗焦點落在錯誤摘要而非被新回頂覆蓋，錯誤連結能見到input。旋轉／root200%／真zoom／reducedmotion／48px／details／安全區另核對，但N9–N11既有缺口不預設已修。既有探索／名冊／第四切片工具／三槽／診斷備份修復／SSR必要回歸；不必因單一ref改動將所有舊結果冒稱本次新做。

N8 regex與完整body比對界線、N9 BASE三項與TARGET新增轉回直向項、N10大字錯誤框、N11左右safe-area未接全部保留；N1/N3/N4/N5/N6引用保留，N4既有歸因只是推斷，FATAL缺日誌未觸發。t47u I1偽造回應仍未修、I2–I6及t46u／第一切片／原型02 Info保留。真手機／讀屏／OS字體／真safe-area／全面mutation未測、Safari/WebKit受阻如實標記。

只能用新隔離資源，不碰5432或使用者角色／存檔，不刪資料重抽。保留所有已確認創角、初始滿資源／容量、固定結果／同次重試及單角色暫行／正式多角色後續必做契約。報告PASS/FAIL/受阻、完整SHA/diff/命令/exit/統計、M1逐項證據；實做、舊引用、推斷、未測分開，新問題含file:line／重現／影響與最小修正。提供遮蔽marker證據，清理本次server/proxy/DB/schema/role/process，保留新舊證據。工程PASS不宣布第五切片或Phase33已由使用者接受。
```
