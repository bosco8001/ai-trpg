# Phase 33 第五切片 Grok 工程驗證要求

目前：實作與測試已準備，Codex 未執行工程驗證；使用者已於 2026-10-08 授權限定 35 檔 commit／push 及交接，提交前尚未推送或送達。TARGET 未填，不能寫成已送驗。使用者已授權本專案透過 Grok Bot Control 交接指定 **AI TRPG Architecture Critic**，這不包含自動 commit／push。

Repository：`https://github.com/bosco8001/ai-trpg.git`

Branch：`codex/phase27-mobile-ui`

BASE：`bb930080ac917a90fc2f6bdf0ecca888ebfcbe87`

TARGET：`TARGET_PENDING_FULL_SHA`（限定檔案獲授權、commit／push 成功後才填入；不可用浮動 HEAD 或本地未提交檔當 TARGET）

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

## 可直接交指定 bot 的完整 prompt

以下訊息送出前替換 TARGET，從當次 Grok 介面核對對話標題，讀回確認送達，只送一次。沒有可讀版本或工具受阻時保留待驗證，不冒稱送達。

```text
請以 AI TRPG Architecture Critic 為本次 Phase 33 第五切片做工程驗證。這不是使用者的階段驗收；請讀新 TARGET 並實際執行，不沿用第四切片或原型 PASS。請勿替使用者改檔、提交、推送、合併或開始下一切片。

repository https://github.com/bosco8001/ai-trpg.git
branch codex/phase27-mobile-ui
BASE bb930080ac917a90fc2f6bdf0ecca888ebfcbe87
TARGET TARGET_PENDING_FULL_SHA

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
