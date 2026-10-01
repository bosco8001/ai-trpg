# Phase 23：AI 戰鬥敘事

> Phase 23 已由使用者手動驗收通過；目前階段狀態見 [Implementation Phase Plan](IMPLEMENTATION_PLAN.md)。本文件保留當時的實作與測試紀錄。

## 權威邊界

戰鬥系統是裁判，LLM 是場邊說書人。每個正式戰鬥行動先驗證、進行權威 transition、保存 GameState 並確定 revision；**只有保存成功後**，伺服器才從 `lastAction` 建立最少量 `CombatNarrationFacts` 並呼叫 `CombatNarrationService`。敘事者沒有 session 或 repository 寫入能力；輸出的 `{ "text": "..." }` 不可能 merge 進 GameState。敘事不增加 revision，不另設保存端點，也不執行背景重試。

模型透過 Phase 5 `LanguageModel` 與現有逾時架構呼叫。Phase 23 使用本機 fake adapter，不使用供應商 SDK、金鑰或網路。一次成功 action 最多生成一次；rejected/stale/非法目標/注入請求、repository save 失敗、GET、Party 偏好修改與 TEST advance 均不呼叫模型。若模型 throw、逾時、回 malformed JSON、空字串、額外欄位或違反事實限制，HTTP action 仍成功，已提交的 revision、Turn、MP、物品與冷卻保留，回傳 `source: "fallback"` 的固定敘事。

`CombatNarrationFacts` 是依 action kind 區分的唯讀事實：回合、**lastAction.actorId 對應名稱**、必要目標與 hit/miss、換排起訖、道具／技能名稱、詠唱階段與進度、逃跑成敗、龍息元素／選定排／每個目標的結果與已確認暴擊。它不包含整個 GameState、骰值以外的未確認後果、inventory、全部技能或隊伍。姓名及名稱都在 JSON `data` 內，模型指示明確視為資料而非命令。模型輸出須是 exact `text` 物件、單行、非空且最多 240 個 Unicode 字元；禁用未確認的傷害、HP、受傷、死亡、治療、減傷與法術效果文字。這些長度與關鍵字是可調工程防線，並非 canon 規則或完整語意證明。無效輸出整份拒絕，直接用 deterministic fallback。

已支援普通攻擊、換排、使用物品、防禦、逃跑成功／失敗、物理主動技能、詠唱開始／繼續／完成／取消、龍息 AoE、隊友普通攻擊與防禦。普通攻擊及技能只有 hit/miss；防禦沒有已實作減傷；TEST 物品沒有治療效果；詠唱完成不等於施法成功；龍息沒有傷害。TEST 敵方推進不產生假戰鬥敘事。系統裁定面板仍獨立顯示權威骰值與結果；右側 AI 面板只顯示當次成功回應的敘事。等待時顯示簡短狀態，完成後一次更新 `aria-live="polite"`；不逐 token 串流，面板不移動焦點。

Markdown／canonical combat 文件定義「系統判定、AI 敘事」與世界語氣；程式中的 facts、輸出 schema 及 fallback 定義工程契約；PostgreSQL `game_states.snapshot` 只保存權威機械 GameState。**Phase 23 不保存 AI prose**。瀏覽器刷新、API 重啟或 PostgreSQL hydrate 會保留機械結果，但敘事區可回到空狀態，且不自動呼叫 LLM。敘事歷史是否跨刷新保存仍見 [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)，不是永久產品決定。沒有新 migration。

## 共通測試準備

先停止舊服務。終端機 A 每次以以下方式啟動乾淨 Memory；測 MISS 或故障時先按 Ctrl+C，再改指定 fixture 重新啟動。終端機 B 保持在專案根目錄。`NARRATION_FIXTURE_MODE` 可用 `normal`、`unavailable`、`timeout`、`malformed`；`unavailable` 用於 provider failure。

```sh
cd "/Users/bosco0295/ai trpg"
DOMAIN_STORAGE=memory DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=normal npm run dev
```

```sh
cd "/Users/bosco0295/ai trpg"
curl -s http://127.0.0.1:3001/api/game-state
curl -i http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' -d '{"expectedRevision":0}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance \
  -H 'Content-Type: application/json' -d '{"expectedRevision":1}'
curl -s http://127.0.0.1:3001/api/game-state
```

乾淨 Memory 到此是 Round 1 玩家、revision 2。瀏覽器開 <http://127.0.0.1:5173>。若已操作過，先讀 GET 的實際 revision 並代入所有指令；不要在同一 revision 同時按畫面按鈕與送 curl。每次合法玩家行動後，下一 actor 通常是 TEST 敵人 2；TEST 控制只推進回合，不會敘事。

## 1. HIT 與 MISS

在上述 HIT 設定執行，或於畫面按「普通攻擊」後選 TEST 敵人 1：

```sh
curl -i http://127.0.0.1:3001/api/combat/normal-attack \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":2,"targetId":"TEST-enemy-1"}'
curl -s http://127.0.0.1:3001/api/game-state
```

回應應為 HTTP 200、`lastAction.outcome=hit`、`narration.source=model` 且文字表示命中；系統裁定顯示攻擊 14、閃避 9。revision 僅 2→3、actor 轉敵人 2，沒有傷害、HP、受傷或死亡敘述。

MISS：停止 Memory 服務，把 `COMBAT_ACTION_ROLL_FIXTURE_MODE=miss`，其他 env 不變；重做開戰與 TEST advance，送同一 normal-attack body。系統判定及敘事都應是未命中；不得描述擦傷、少量傷害或暴擊。revision 仍只 2→3。

## 2. 隊友 A 與 B

以 HIT／normal fixture 重新啟動乾淨 Memory，開戰後用三次 TEST advance 到隊友 Turn：

```sh
curl -i http://127.0.0.1:3001/api/dev/combat/start -H 'Content-Type: application/json' -d '{"expectedRevision":0}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance -H 'Content-Type: application/json' -d '{"expectedRevision":1}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance -H 'Content-Type: application/json' -d '{"expectedRevision":2}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance -H 'Content-Type: application/json' -d '{"expectedRevision":3}'
curl -i http://127.0.0.1:3001/api/combat/companion/act -H 'Content-Type: application/json' -d '{"expectedRevision":4}'
```

隊友 A 的伺服器結果應是 `normal-attack`、actor `TEST-companion-1`、target `TEST-enemy-1`、hit；敘事只描述已選結果。revision 4→5。再重新啟動乾淨 Memory，重做到隊友 revision 4，改偏好 B 後執行：

```sh
curl -i http://127.0.0.1:3001/api/combat/party/tactic -H 'Content-Type: application/json' \
  -d '{"expectedRevision":4,"companionId":"TEST-companion-1","tacticPreferenceId":"TEST-tactic-b"}'
curl -i http://127.0.0.1:3001/api/combat/companion/act -H 'Content-Type: application/json' -d '{"expectedRevision":5}'
```

偏好修改本身沒有敘事；隊友行動應是 defend，敘事不發明目標或減傷。A／B 的對應是工程 policy，不是正式戰術語意。

## 3. 詠唱完成

重新啟動乾淨 Memory。先裝備 TEST 法術，開戰並推至玩家：

```sh
curl -i http://127.0.0.1:3001/api/dev/domain/commands -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","expectedRevision":0,"skillIds":["TEST-skill-2"]}'
curl -i http://127.0.0.1:3001/api/dev/combat/start -H 'Content-Type: application/json' -d '{"expectedRevision":1}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance -H 'Content-Type: application/json' -d '{"expectedRevision":2}'
curl -i http://127.0.0.1:3001/api/combat/casting/start -H 'Content-Type: application/json' \
  -d '{"expectedRevision":3,"skillId":"TEST-skill-2"}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance -H 'Content-Type: application/json' -d '{"expectedRevision":4}'
curl -i http://127.0.0.1:3001/api/combat/companion/act -H 'Content-Type: application/json' -d '{"expectedRevision":5}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance -H 'Content-Type: application/json' -d '{"expectedRevision":6}'
curl -i http://127.0.0.1:3001/api/combat/casting/continue -H 'Content-Type: application/json' -d '{"expectedRevision":7}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance -H 'Content-Type: application/json' -d '{"expectedRevision":8}'
curl -i http://127.0.0.1:3001/api/combat/companion/act -H 'Content-Type: application/json' -d '{"expectedRevision":9}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance -H 'Content-Type: application/json' -d '{"expectedRevision":10}'
curl -i http://127.0.0.1:3001/api/combat/casting/continue -H 'Content-Type: application/json' -d '{"expectedRevision":11}'
curl -s http://127.0.0.1:3001/api/game-state
```

最後 revision 12、`lastAction.type=casting-complete`、進度 3/3、MP 6；敘事只表示詠唱完成，不表示法術成功、命中、造成傷害或敵人受傷。取消可於第二輪玩家 revision 7 改送 `/api/combat/casting/cancel`（body 只有 `expectedRevision`）；只敘述取消，不退 MP。請在另一個乾淨 Memory 流程測取消。

## 4. 龍息

重新啟動乾淨 Memory，按共通步驟到 revision 2 玩家，送：

```sh
curl -i http://127.0.0.1:3001/api/combat/dragon-breath -H 'Content-Type: application/json' \
  -d '{"expectedRevision":2,"targetRow":"front"}'
```

`lastAction` 應記火元素、敵方前排、每個目標的 hit/miss/critical；敘事符合選定排與逐目標結果，不加火焰傷害、灼傷、死亡。預設前排只有敵人 1；雙目標同排的逐目標語意由自動測試覆蓋。revision 2→3。

## 5. 模型故障、malformed 與拒絕

重新啟動乾淨 Memory，先使用 `NARRATION_FIXTURE_MODE=unavailable`，其他 env 與共通 HIT 設定相同。重做開戰、TEST advance、合法普通攻擊。應回 HTTP 200，`narration.source=fallback`，revision 2→3、actor 正常前進。再分別用 `NARRATION_FIXTURE_MODE=timeout` 和 `malformed` 重試乾淨流程；同樣顯示「系統敘述」且機械結果保持成功。畫面不應顯示 adapter 錯誤、JSON 或 stack trace。

拒絕測試使用乾淨 revision 2 的玩家 Turn：

```sh
curl -i http://127.0.0.1:3001/api/combat/normal-attack -H 'Content-Type: application/json' \
  -d '{"expectedRevision":1,"targetId":"TEST-enemy-1"}'
curl -i http://127.0.0.1:3001/api/combat/normal-attack -H 'Content-Type: application/json' \
  -d '{"expectedRevision":2,"targetId":"TEST-enemy-2"}'
curl -i http://127.0.0.1:3001/api/combat/normal-attack -H 'Content-Type: application/json' \
  -d '{"expectedRevision":2,"targetId":"TEST-enemy-1","hp":0}'
curl -s http://127.0.0.1:3001/api/game-state
```

依序應為 409 stale、409 illegal target、400 invalid command，revision 與 actor 不變；模型 call count = 0 由自動測試證明，手動不用猜。開關 Bag／Party、讀取 options、選目標後取消、刷新及 TEST advance 也不應生成敘事。

## 6. 獨立 PostgreSQL 與 API 重啟

請使用空的 `ai_trpg_phase23_manual`，勿沿用其他階段的資料庫。Docker Compose 與 `.env` 密碼設定依 README Phase 4。終端機 A：

```sh
cd "/Users/bosco0295/ai trpg"
docker compose up -d db
docker compose ps
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" ai_trpg_phase23_manual'
set -a
. ./.env
set +a
export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/ai_trpg_phase23_manual"
npm run db:migrate:dry-run
npm run db:migrate
PORT=3002 DOMAIN_STORAGE=postgres DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=unavailable npm run dev:api
```

若 `createdb` 顯示已存在，請先確認資料或另選新的空資料庫；不要刪有重要內容的資料。終端機 B：

```sh
cd "/Users/bosco0295/ai trpg"
curl -s http://127.0.0.1:3002/api/game-state
curl -i http://127.0.0.1:3002/api/dev/combat/start -H 'Content-Type: application/json' -d '{"expectedRevision":0}'
curl -i http://127.0.0.1:3002/api/dev/combat/advance -H 'Content-Type: application/json' -d '{"expectedRevision":1}'
curl -i http://127.0.0.1:3002/api/combat/normal-attack -H 'Content-Type: application/json' \
  -d '{"expectedRevision":2,"targetId":"TEST-enemy-1"}'
curl -s http://127.0.0.1:3002/api/game-state
```

應收到 HTTP 200 與 fallback；GET 的 revision 3、actor 敵人 2、`lastAction` 命中及兩組骰值與 action response 相同。只停止 API，不停止 PostgreSQL。用終端機 A 相同已 export 的 `DATABASE_URL` 和相同 env 重啟：

```sh
PORT=3002 DOMAIN_STORAGE=postgres DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=unavailable npm run dev:api
```

終端機 B 再讀：

```sh
curl -s http://127.0.0.1:3002/api/game-state
curl -s http://127.0.0.1:3002/api/dev/combat
```

機械狀態與 revision 應完全保留，沒有額外 revision 或重新敘事。用瀏覽器刷新時，權威最近裁定仍在，AI 敘事可顯示「目前沒有戰鬥敘事」。

## 7. 手機與鍵盤

- 在約 375px 的手機寬度檢查 AI 敘事與系統裁定分開可讀、長句可換行、六個基本指令可操作、沒有整頁水平溢出。
- 以 Tab／Enter 操作普通攻擊、選目標、隊友 TEST 行動與其他既有指令。焦點應可見，敘事更新由 `aria-live="polite"` 一次宣告，不造成焦點陷阱。
- 用鍵盤開啟 Party、按 Escape 關閉，焦點應返回 Party 按鈕；開關 Party 不產生敘事或修改 revision。

## 工程檢查與未解問題

專門測試覆蓋提交前後順序、全部正式 action 路由、lastAction actor 身分、HIT／MISS、逐目標龍息、隊友 A／B、四種詠唱、拒絕不呼叫模型、repository failure 不呼叫模型、故障／逾時／malformed／額外欄位備援、revision 與 PostgreSQL 重新建立 session 後讀回。這些是工程檢查，敘事品質、手機與鍵盤手感仍由使用者驗收。

`npm test` 在獨立 `ai_trpg_phase23_test` PostgreSQL 資料庫執行：242 項通過、0 失敗、0 略過。`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run`、`git diff --check` 通過；dry-run 無新 migration。自動測試重建 pool／repository／session，實際停止與重啟 API process 由上面的手動清單驗收。

正式 provider／model、token budget、production retry、streaming、跨刷新敘事歷史、Phase 24 節奏及未來傷害／瀕死／死亡用語未定。Phase 24 動畫與 NPC pacing、Phase 25+ HP／傷害、瀕死、死亡、結算、XP、金錢與掉落均未在本階段實作。
