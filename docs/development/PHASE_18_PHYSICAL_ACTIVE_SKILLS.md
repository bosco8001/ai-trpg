# Phase 18：物理主動技能

> Phase 1–18 已由使用者確認。Phase 19 工程實作中；Phase 20 尚未開始。

## 規則與權威邊界

物理主動技能與魔法共用 Phase 3 的六個裝備格。只有角色已學且已裝備的技能可在戰鬥使用；戰鬥中不能換裝。物理技能不建立 SP、體力或其他資源。TEST-skill-1 是工程 fixture，不是正式世界技能：物理主動、單一敵方目標、近戰。這階段只記錄命中／未命中，沒有傷害、HP 或狀態效果。

技能使用沿用 Phase 13 的近戰目標檢查、物理攻擊與閃避判定。敵方前排有人時，後排受阻；敵方前排空缺時可攻擊後排。玩家位於我方後排仍可近戰。攻擊總值大於或等於閃避總值即命中；raw D20 1 不自動失敗。

R1 使用後在 CombatState 記錄 `actorId + skillId + readyRound = 3`。R2 不可再用，R3 可用。命中與未命中都算使用，都記錄冷卻並消耗完整 Turn。其他參戰者的 Turn 不會遞減冷卻；可用性由目前 Round 即時計算。舊 Phase 11–17 snapshot 缺少冷卻欄位時安全補為空陣列。冷卻、最近裁定、Round、actor 與 revision 保存在既有 `game_states.snapshot` JSONB；沒有新 migration。

`GET /api/combat/physical-skills/options` 只讀，回傳 revision、目前 actor、已裝備且受支援的物理技能、可用原因、readyRound 與合法目標。`POST /api/combat/physical-skills/use` 精確只接受：

~~~json
{"expectedRevision":3,"skillId":"TEST-skill-1","targetId":"TEST-enemy-1"}
~~~

後端重新驗證 active combat、revision、玩家操作邊界、技能定義、已學、已裝備、冷卻與目標，全部通過後才擲骰。合法提交在同一 transition 中寫 `physical-skill` lastAction、冷卻、下一位 actor，revision 只增加一次。驗證失敗不擲骰；擲骰失敗也不寫狀態。前端點技能只進入目標模式；取消不提交。逃跑成功的終止戰鬥畫面停用技能；直接 POST 會被拒絕。

## 手動驗收發現與修復證據

首次手動驗收時，R1 技能使用成功，R2 冷卻與 R3 恢復顯示也正確；R3 再次提交卻收到 HTTP 500 `invalid-roll`。原因是 `COMBAT_ACTION_ROLL_FIXTURE_MODE=hit` 原本建立只有 `[10, 8]` 的一次性 `SequenceD20Roller`。服務在同一場戰鬥持續共用這個 provider，R1 已取完兩顆骰，R3 讀取時序列耗盡。`miss` 與 `raw-one-hit` 有相同風險。這是工程 fixture 的使用週期問題，沒有更改 R1／R2／R3 的冷卻規則。

現在這三種 action fixture 會在服務執行期間循環提供各自固定的攻擊與閃避骰值；普通攻擊與物理技能共用時也可連續裁定。一次性 `SequenceD20Roller` 仍供明確測試骰子耗盡情境使用；正式 `RandomD20Roller` 與權威 GameState、PostgreSQL snapshot 均未改動。擲骰失敗仍回 HTTP 500，revision、Turn、冷卻與最近裁定保持原狀。技能 API 遇到 5xx 時前端顯示固定繁中錯誤，並在技能區提供警示；不採用失敗回應更新權威狀態。

`tests/combat-physical-skills.test.ts` 新增同一 provider 在 R1、R3、R5 重複技能使用的 HIT、MISS、raw-one-hit 回歸；另測普通攻擊與技能雙向交替、R3 權威 API 及擲骰失敗的原子性。R3 API 測試從 `round = readyRound = 3`、revision 9 提交，斷言 HTTP 200、攻擊 14、閃避 9、命中、`readyRound = 5`、revision 10 及下一位 `TEST-enemy-2`。這些是工程測試結果；Phase 18 其後已由使用者完成手動驗收。

## 記憶體模式手動驗收

停止舊服務後，在專案根目錄啟動：

~~~sh
DOMAIN_STORAGE=memory DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=normal npm run dev
~~~

先讀取 `/api/dev/domain` 的實際 revision。以下示例假設為 0；若不同，請填入讀到的版本：

~~~sh
curl -s http://127.0.0.1:3001/api/dev/domain
curl -i http://127.0.0.1:3001/api/dev/domain/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","expectedRevision":0,"skillIds":["TEST-skill-1"]}'
curl -s http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' -d '{"expectedRevision":1}'
~~~

預期裝備後 revision 1；開始戰鬥後 Round 1、TEST 敵人 1、revision 2。刷新瀏覽器，按「TEST：推進下一回合」到 TEST 玩家、revision 3。可用以下唯讀 API 核對：

~~~sh
curl -s http://127.0.0.1:3001/api/combat/physical-skills/options
curl -s http://127.0.0.1:3001/api/game-state
~~~

### 命中與取消

「TEST 物理技能」應可點。點技能後只顯示「請選擇技能目標」，revision 仍為 3；TEST 敵人 1 可選，TEST 敵人 2 顯示「前排敵人阻擋」。先按「取消」，確認 revision、actor、lastAction、冷卻都不變；再點技能，選 TEST 敵人 1。

預期攻擊 `10 + 1 + 2 + 1 = 14`、閃避 `8 + 1 = 9`、命中；`lastAction.type = physical-skill`、`skillId = TEST-skill-1`、`targetId = TEST-enemy-1`、`round = 1`、`readyRound = 3`。revision 4、目前 TEST 敵人 2。沒有 HP 或傷害數值。

### R2 冷卻與 R3 恢復

從 revision 4 按 TEST advance 兩次：revision 5 為 R2 敵人 1，revision 6 為 R2 玩家。技能應停用，顯示「冷卻中・第 3 回合可再次使用」。在此時直接 POST：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/physical-skills/use \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":6,"skillId":"TEST-skill-1","targetId":"TEST-enemy-1"}'
~~~

應回 HTTP 409 `skill-on-cooldown`；revision、actor、lastAction、冷卻不變。刷新瀏覽器，仍應顯示第 3 回合可用。

R2 玩家用防禦：

~~~sh
curl -i http://127.0.0.1:3001/api/combat/defend \
  -H 'Content-Type: application/json' -d '{"expectedRevision":6}'
~~~

預期 revision 7、TEST 敵人 2。再 TEST advance 兩次到 revision 9、R3 玩家。技能應重新可用。再次選「TEST 物理技能」與「TEST 敵人 1」後，應命中，攻擊 14、閃避 9；`lastAction.type = physical-skill`、`round = 3`、`skillId = TEST-skill-1`、`targetId = TEST-enemy-1`、`readyRound = 5`。revision 應為 10，目前 actor 為 TEST 敵人 2；R4 冷卻，R5 才可用。

### 未命中

停止 Memory 服務，以相同設定重新啟動，只把 `COMBAT_ACTION_ROLL_FIXTURE_MODE=miss`。重新裝備、開始戰鬥、推進至玩家。使用技能後預期攻擊 `3 + 1 + 2 + 1 = 7`、閃避 `15 + 1 = 16`、未命中；仍記 `readyRound = 3`、消耗 Turn、revision 增加一次。

### 拒絕與終止戰鬥

- 戰鬥外先把裝備清空，再開始戰鬥。玩家 Turn 不應有可用物理技能；直接 POST `TEST-skill-1` 應回 `skill-not-equipped`。
- 前排敵人存在時直接指定 `TEST-enemy-2`，應回 `illegal-target`，不擲骰、不進冷卻、不消耗 Turn。
- 玩家 revision N 時用 N−1，應回 HTTP 409 `stale-revision`，狀態不變。
- 在正確 request 另加 `damage`、`readyRound`、`attackRoll` 或 `actorId`，應回 HTTP 400，狀態不變。
- Phase 17 逃跑成功後，技能停用；直接 POST 應回 `combat-ended`，不能重新啟動戰鬥。

## PostgreSQL 重啟

僅使用沒有重要資料的測試資料庫。依 Phase 4 的 `.env` 設定，執行：

~~~sh
docker compose up -d db
docker compose ps
npm run db:migrate
~~~

預期沒有新 migration。以 `DOMAIN_STORAGE=postgres`、`DOMAIN_SANDBOX=1`、`COMBAT_SANDBOX=1` 和上述 hit fixture 啟動。先 GET 目前狀態，**不要假設 revision 0**。在乾淨測試狀態裝備技能、開始戰鬥、使用一次，推進到 R2 玩家。記錄 Round、actor、revision、`skillCooldowns`、`lastAction` 的技能 ID、目標、兩組骰值與 outcome。按 Ctrl+C 停止 API；不要刪 volume。用同設定重啟後 GET，這些資料與 R2 冷卻顯示都應保持。

## 手機、鍵盤與服務離線

約 375px 寬確認六格技能區可閱讀與觸控，技能、冷卻、非法目標、取消、最近裁定都不溢出且沒有整頁橫向捲動。鍵盤以 Tab 到技能、Enter 開目標模式、Tab 到合法敵人、Enter 提交；取消後焦點應回技能。冷卻按鈕不能用鍵盤提交。

停止後端後重新讀取技能或送出 action：頁面應顯示安全繁體中文訊息，不顯示原始錯誤、SQL 或內部路徑；不應假裝更改 revision、actor、冷卻或結果。

## 未處理項目

個別技能傷害、額外命中修正、狀態效果、AoE、正式技能內容製作流程、HP／傷害整合仍未定案。Phase 18 不建立體力、魔法、敵方技能 AI、戰鬥敘事、死亡、結算或戰鬥 Save／Load 政策。
