# Phase 33 第四切片：正式推導模組與唯讀樣本核對

日期：2026-10-07（Asia/Hong_Kong）。使用者確認最新容量規則後，指示「進入下一切片」，批准正式計算模組與唯讀樣本畫面。限定 31 檔已提交／推送為 `bb930080ac917a90fc2f6bdf0ecca888ebfcbe87`，並透過 Grok Bot Control 送達 AI TRPG Architecture Critic。Grok t47u 外部回報工程 PASS（限 Chrome）；6 項 Info 與未測限制保留，使用者已於 2026-10-07 明確回覆「通過」，第四切片已接受。Codex 沒有執行本輪工程測試。

## 單一目標與界線

把原型的計算機接上正式五族 v2／四初階職業 v1。系統面板新增「角色屬性核對」，調整的是記憶體樣本，不建立或改寫正式角色、存檔、Run 或戰鬥；本切片不提供正式轉職／配裝／創角命令。

只支援 Lv.1、六項從 8 開始、創角分配 12 點（每項 0～6）、人類另分配 2 點。裝備與技能加成均為 0，不建立正式道具／技能；樣本資質是已知值，不是玩家可選或提前揭曉的正式創角結果。職業清單不代表角色已開放全部職業。

## 規則與資料來源

- 伺服器使用既有正式名冊 loader／resolver，嚴格限定種族版本 2、職業版本 1；不複製獨立原型名冊，不回退 TEST 內容。
- 固有屬性先合併基礎、創角分配及種族固定／自由點，再乘目前職業倍率並向下取整。無裝備／技能樣本的資格與最終數值相同。修正為 floor（(最終屬性 − 10)／2）。
- HP = 20 ＋ Lv.1 × 5 ＋最終體質 × 3；MP = 最終智慧 × 4 ＋資質加成（0／20／40／70）。資質須是該種族機率大於 0 的已知樣本。
- 使用者最新容量規則：提高上限不改目前值，降低時只截掉超過新上限的部分；零 HP 維持 0。合法資源下，新目前值 = min（原目前值，新上限）。不保留隱藏差額；已撤回的 B 不是本切片依據。
- 範例 40／40 → 40／54 → 40／40；50／54 → 40／40 → 40／54，截掉的 10 點不因換回上限自動恢復。低資源 5／55 → 5／49、2／60 → 2／52，不產生負值。
- 以上樣本容量預覽供核對；種族、分配、資質的樣本修改不是正式角色可執行的變更命令。正式升級、技能、暫時效果等上限政策不由此擴大裁定。

## 介面與同步

`POST /api/character-derivation/preview` 是不寫入資料的計算操作。請求必須恰含 schemaVersion 1、raceCatalogVersion 2、classCatalogVersion 1、sample、resources；sample 恰含 level、raceId、classId、aptitude、allocation、raceAllocation；resources 恰含 currentHp、maxHp、currentMp、maxMp。

resources 是明確提供的核對基準，不是讀取遊戲角色。原目前值必須是合法整數且介於 0 與原上限；HP 上限至少 1，MP 上限可為 0。非法原值整份拒絕，不能藉 clamp 修復原本非法資料。Body limit 4096 bytes、回應 no-store，解析及規則錯誤回固定訊息，不回傳原請求、stack 或內部路徑。

回應包含版本與 sample scope、輸入快照、正式種族／職業名稱、六項推導明細、資質加成及 before／after 資源。前端只接受完整、有界且吻合本次樣本／基準／版本的回應；計算失敗保留原樣本。核對服務沒有 session、repository、PG 或 LLM 依賴。

## 手機流程與視覺

共同沿用已接受的 Mobile Design System 02：冷黑／魔導青／餘燼橙、明亮按鈕底、Heiti TC 與系統字型備援、緊湊六屬性格、數字等寬。沒有替換其他正式遊戲畫面。

- game-ui-ux：總覽／編輯／明細共用一個原生 modal dialog；入口焦點、返回焦點與 Escape 層級隔離；樣本與草稿分離，狀態由事件更新。
- ui-ux-pro-max：主總覽只留 HP／MP、六屬性、來源摘要與兩個入口；表單／長明細放 Sheet 內捲動。可重排格線、原生 label／number／select、48 CSS px 最小觸控目標、明確錯誤與狀態語意。
- apple-design：統一字階、4／8 間距節奏、短按壓回饋與 180ms 非手勢進場，不鎖動畫期間的操作； reduced-motion 停用位移與 transition。新技能／裝備介面不在本切片重做。

編輯先按「預覽數值」，成功後按「更新核對樣本」才更新總覽；修改任何草稿欄位都撤銷舊預覽並取消舊請求。取消／關閉不套用草稿，逾時或遲到回應不能覆蓋新草稿。樣本可在 Sheet 內設定目前 HP／MP，用來核對零 HP 或下降截低；重新整理／卸載系統面板會清除記憶體樣本。初始 HP 40／55、MP 48／60 是明確工程 fixture，不決定正式角色初始資源。

## 本切片檔案

| 範圍 | 檔案 |
|---|---|
| 共用契約／純規則 | src/shared/character-derivation.ts、src/domain/character-derivation.ts |
| 唯讀伺服器介面 | src/server/character-derivation.ts、src/server/app.ts |
| 畫面／讀取／草稿 | src/web/CharacterDerivationPanel.tsx、src/web/character-derivation-client.ts、src/web/character-derivation-ui.ts、src/web/character-derivation.css |
| 正式入口／樣式載入 | src/web/ExplorationPage.tsx、src/web/main.tsx |
| 必要測試 | tests/character-derivation.test.ts |
| 文件 | 本文件、完整 Grok prompt、提案、Character／Classes、Phase 26 後續修訂、Manifest／Open Questions／Implementation Plan |

獨立原型程式不改，保留修訂前比較；其 README 與歷史討論另同步。前一切片的 ClassCatalogPanel／class-catalog.css／main.tsx 補修與原型封存已隨 `bb93008` 提交，不冒稱本切片的新成果。

## 當時提供的手動核對清單（其後使用者已整體接受）

1. 重建／重啟後，探索 → 系統 → 角色屬性核對。起始人類／劍士，力量 15、HP 40／55、MP 48／60；明細顯示先加人類 2 點再乘 1.25。
2. 調整樣本 → 魔術師 → 預覽：智慧 12、MP 48／68。目前 MP 不增加；確認後才更新。改回劍士仍為 MP 48／60。
3. 在人類樣本設定目前 HP 為 50，改成精靈／劍士／高資質，保留六項各 2 點：HP 預覽 49／49；確認後改回人類／劍士／普通，HP 為 49／55，沒有補回截掉的 1 點。
4. 在樣本設定 HP 為 0，再改體質分配，維持 12 點：更新後仍為 0。這只是零 HP 核對，不是遊戲救援。
5. 少分／多分／小數／超過原上限的目前資源顯示錯誤，不能套用；取消保留原樣本。預覽成功後再改一個欄位，必須重新預覽。
6. 關閉／Esc 返回核對入口，不能同時關掉外層系統面板。取消編輯回到「調整樣本」焦點；明細返回其入口。
7. 手機寬度、橫向、大字與 reduced-motion：主要操作可見、內容只在 Sheet 內捲動、無橫向溢出、觸控與焦點可用；實際結果由使用者／Grok 回報。

## 工程狀態與下一步

Codex 僅實作、閱讀程式／Git／文件及撰寫 8 項測試，沒有執行本輪 build、typecheck、格式檢查、單元／整合／資料庫或 UI 測試。其後依使用者限定授權完成提交／推送及交接，Grok t47u 的實測結果見下；舊原型的 9／9、60 組畫面與其他 build 結果不沿用。

交接 prompt 見 [工程驗證要求](PHASE_33_CHARACTER_DERIVATION_GROK_REVIEW.md)。BASE 是 `6dfa95e1d84cb1c7ef0a1aa64be13919f3cf8316`，受測 TARGET 是 `bb930080ac917a90fc2f6bdf0ecca888ebfcbe87`；TARGET 為已推送且已送達的固定版本。以下文件紀錄補正尚未提交，不是額外受測程式版本；使用者其後已明確回覆「通過」；接受範圍與來源見本文件。

本切片接受後才討論正式角色／創角與持久狀態接入；初始資源、引用升版、不合格配裝等未定契約須另行確認。本文件不宣告 R05 或整個 Phase 33 完成。

## 2026-10-07 Grok t47u 外部工程回報

來源：Codex 透過 Grok Bot Control 讀取 AI TRPG Architecture Critic 當次 22:12:56／22:13:12／22:13:22 回覆。這是 Grok 的外部回報，不是 Codex 親測；本機未取得或驗證其證據檔案。結論是第四切片工程 PASS，限 Chrome，沒有 High／Medium／Low；不代替使用者驗收，不宣告 Phase 33 結案。

Grok 核對遠端 HEAD 等於上述 TARGET、BASE 為祖先，中間一個 commit；31 檔、加 1683／刪 24，沒有混入排除範圍。環境：Node 24.21.0、npm 9.2.0、Chrome 154、playwright-core 1.63.0、隔離 PostgreSQL 17.11（127.0.0.1:55426）。

| Grok 實際命令 | Exit | 外部結果 |
|---|---|---|
| TARGET／BASE 的 npm ci、npm run build | 0 | 成功 |
| node --import tsx --test tests/character-derivation.test.ts tests/class-catalog.test.ts tests/content-catalog.test.ts | 0 | 20／20 通過 |
| TARGET：env -u TEST_DATABASE_URL npm test | 0 | 426 項；385 pass、0 fail、41 skipped（略過不算通過） |
| BASE：同一無 DB 測試命令 | 1 | 17 個 fail，對應 t46u D1 |
| TARGET：migrate 後 TEST_DATABASE_URL=… npm test | 0 | 428／428 通過 |
| git diff --check BASE TARGET（上述完整 SHA） | 0 | 無空白問題 |

- HTTP 197／197 案例符合預期；五族 × 四職業 × 五種分配共 100 組，與 Grok 獨立計算一致。固定錯誤、4096／4097 bytes 邊界與 chunked 過大拒絕、非法舊資源拒絕及 no-store 符合要求。
- 最新容量提高不補充、下降只截超出部分、零 HP／MP 維持零、MP 上限零合法，往返 1000 次沒有增加資源。純計算期間 PG log／對外連線為零；game-state、三存檔槽、DB dump hash 不變，300 次呼叫的 interpreter／narrator／combat／settlement spy 皆零。
- 官方 dist 正常探索入口的 375px UI 48／48 PASS；預覽與確認分離、取消與焦點、Esc 層級及 100 次 Tab 符合預期。13 種初始失敗與 12 種預覽失敗保留原樣本，遲到回應不覆蓋草稿。133 組排版零溢出，控件至少 48 CSS px；CSS 根字級與模擬 zoom 分開記錄。對比最低 6.7。
- 前置第二切片：本輪觀察 D1 不再崩潰、D2 焦點／Esc 正常、D3／D4 在 CSS 根字級下零裁切／溢出；職業名冊 zoom 未測。保留 t46u FAIL 與「沒有第二切片補修 Grok PASS」，不重新判定使用者既有驗收。

新增 Info（未修正、不改標已解決）：

1. I1：前端只核對結構、內部數學、sample／before／版本，沒有對照已讀取的正式名冊。Grok 偽造內部一致的名稱「TEST-人類」、倍率或體質修正 +4，前端仍接受顯示，HP 可成 40／67；正常伺服器輸出正確。Grok 列 Info；若要求前端嚴格核對正式名冊，可升 Low，但尚未由使用者裁定或實作。
2. I2：文件仍有未提交／未執行與舊 HEAD 的現在式描述。成因為提交前紀錄是 Grok 推斷；本輪只補正文字的目前／歷史狀態，未修改程式。
3. I3：錯誤摘要連結改 hash 並增加 history，與既有 anchor Info 同類。
4. I4：JSON 重複 key 採最後值，UTF-8 BOM 被接受。
5. I5：短橫向配 zoom 200% 時 body 只餘 56px，但仍可捲動。
6. I6：缺少前端正式名冊核對的測試；本輪沒有 mutation testing。

未測：真手機、OS 字體大小、讀屏器、正式遊玩、mutation testing；Safari／WebKit 受阻。AX 結構正確不代表讀屏 PASS。Grok 有兩次焦點判定 FAIL，推斷為腳本時序，重跑三次皆 PASS；假拒絕的兩張 harness-artifact-* 圖不能當產品缺陷證據。舊 t46u N1–N11、第一切片全部 Info、原型 02 N1–N5 均保留。

Grok 報告本輪證據在其 `/workspace/p33j-evidence`，156 檔、78 截圖；服務已停、三個 DB／role 已刪、叢集停、隔離 checkout 已刪，5432／55426 無 listener，未 commit／push。重新安裝的 postgresql-17 套件仍留在 Grok 環境。Grok 另報告開工前舊 p33g／p33h／p33i 與 phase31 暫存證據已消失，原因未證實；舊結果來源保留，但不能再聲稱那些路徑目前可取用。


## 2026-10-07 使用者接受第四切片

在 Codex 讀取 Grok t47u 結果、提供正式探索頁「角色屬性核對」手動入口後，使用者明確回覆「通過」。依上下文記錄：Phase 33 第四切片「正式屬性／HP／MP 推導模組與唯讀樣本核對畫面」已由使用者接受。

程式 HEAD 與 Grok 受測 TARGET 為 `bb930080ac917a90fc2f6bdf0ecca888ebfcbe87`，是版本對照；使用者沒有另指定測試 SHA 或逐項結果，不補寫七項清單全數親測、真手機／讀屏／Safari 通過。Grok 外部工程 PASS 及六項 Info 保留各自來源；本次接受不將 I1／I3／I4／I5／I6 標成修正，I2 僅有未提交的文字狀態補正。

接受範圍僅為本切片的正式來源計算與記憶體樣本工具，不代表 R05、整個 Phase 33、正式創角／轉職／配裝、持久角色或戰鬥接入已完成，也沒有批准未定初始資源／配裝政策。此輪只更新驗收文件，沒有改程式、跑測試或新增 commit／push。下一主要切片尚未開始，先確認範圍與未定契約。
