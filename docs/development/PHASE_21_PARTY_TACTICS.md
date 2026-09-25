# Phase 21：隊伍資訊與戰術偏好介面

> Phase 1–21 已由使用者確認。本文記錄 Phase 21 當時的交付邊界；Phase 22 工程完成，等待使用者手動確認。

## 階段範圍

本階段接上「隊伍」指令，提供權威隊友資料讀取、緊湊 Party 對話框、高層戰術偏好設定，以及 Memory／PostgreSQL 保存。

偏好設定只是玩家選的一個識別碼。Phase 21 不會讓隊友自動攻擊、治療、施法、用物品或推進 Turn；這些行為屬 Phase 22。

## 權威與資料邊界

- 開啟／關閉 Party 只改前端畫面。讀取資料使用 GET，不增加 revision、不改 actor、不消耗 Turn。
- 偏好變更只接受 `expectedRevision`、`companionId`、`tacticPreferenceId`。伺服器驗證隊友屬於目前隊伍、偏好 ID 存在且版本正確，再更新 GameState。
- 偏好變更增加 revision 一次；不呼叫 `advanceTurn`，也不更動 Round、`currentActorId`、`currentTurnIndex`、`lastAction`、casting、MP、冷卻、物品或站位。
- active casting 期間可讀取 Party，也可修改偏好。這不是主要行動，不套用 casting 的主要行動鎖。
- 任一 active combat actor 回合都可修改偏好，包括敵方回合。
- Ended combat 仍可讀取 Party；偏好變更安全拒絕。這是 Phase 21 的工程範圍，不定為永久遊戲規則。
- 沒有隊友參與 `CombatState.turnOrder`，沒有新增 initiative、companion turn、AI、傷害或 LLM 呼叫。

## TEST companion 與資料缺口

目前 repository 沒有既有隊友名冊，因此增加一名明確標示的工程 fixture：`TEST-companion-1`／「TEST 隊友」。此隊友不會被插入 CombatState 或行動順序。

目前沒有 companion 權威等級、隊伍站位、HP 或 MP。Party 對話框明確顯示「尚未接入」，不填入測試或 Prototype 數值。角色本人的 Phase 19 MP 欄位不代表隊友 MP。

Phase 1–20 舊 snapshot 缺少 party 欄位時，已知 `TEST-character` 安全取得固定工程隊友與偏好 A。正式或其他角色不會自動獲得 TEST 隊友或預設 tactic；正式隊友可保持偏好 `null`／未設定。現存未知偏好 ID 會當作 opaque 值保留，不解讀或改寫。

## Tactic catalog 與 PostgreSQL

Phase 21 的 server catalog 只有兩個工程測試項目：

| 識別碼 | 顯示名稱 | 用途 |
|---|---|---|
| `TEST-tactic-a` | TEST：戰術偏好 A | 驗證選擇與保存流程 |
| `TEST-tactic-b` | TEST：戰術偏好 B | 驗證選擇與保存流程 |

These are engineering fixtures only. They do not define final canonical tactic presets or behavior. 它們沒有戰鬥語意，不會被解讀成任何攻擊、治療、保護或 MP 行為；也不是 canonical enum，沒有定案 Prototype 的四個舊名稱。

未來正式 tactic 的 ID、顯示名稱、描述與語意屬靜態遊戲設計／data catalog。玩家為某名實際隊友選擇的 `tacticPreferenceId` 是 runtime mutable state，保存於 `GameState.partyMembers` 與既有 `game_states.snapshot` JSONB。沒有新增 migration 或 table；Save Format v1 與 active combat Save／Load safeguard 不變。

## API 契約

`GET /api/combat/party` 回傳 server-derived `revision`、context、隊友欄位、目前偏好及完整可選 catalog。Ended combat 可讀取；開啟與關閉 Party 不會送出 mutation。

偏好變更：

```http
POST /api/combat/party/tactic
Content-Type: application/json
```

```json
{
  "expectedRevision": 1,
  "companionId": "TEST-companion-1",
  "tacticPreferenceId": "TEST-tactic-b"
}
```

Body 嚴格拒絕 `displayName`、等級、row、HP、MP、behavior、target、action、turn 或其他額外欄位。伺服器只採信自身名冊與 catalog，不接受前端建立隊友或 catalog。

錯誤狀態：格式／額外欄位 `400 invalid-command`；未知隊友或選項 `404`；stale revision、非 active combat、ended combat、revision 上限 `409`。拒絕不改任何狀態。

目前偏好再選一次會回成功的 idempotent no-op：revision、GameState 與 Turn 都不變。

## API 手動驗收

### 1. 開啟／關閉 Party

在終端機 A 啟動乾淨的 Memory：

```sh
DOMAIN_STORAGE=memory DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 COMBAT_ROLL_FIXTURE_MODE=normal npm run dev
```

在終端機 B 開始 TEST 戰鬥：

```sh
curl -i http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":0}'
```

使用瀏覽器開啟 <http://127.0.0.1:5173>。記下畫面上的 revision、Round、目前 actor、`currentTurnIndex` 與 `lastAction`。按「隊伍」，確認看到 TEST 隊友與偏好；關閉對話框後，以 curl 重新讀取：

```sh
curl -s http://127.0.0.1:3001/api/game-state
curl -s http://127.0.0.1:3001/api/combat/party
```

GameState 的 revision、Round、actor、`currentTurnIndex`、`lastAction` 均應與開啟前相同。再次打開、關閉也不會增加 revision。GET Party 回應應有 `Cache-Control: no-store`。

### 2. 更改偏好

在 Party 對話框把 TEST 隊友從 TEST 偏好 A 改為 TEST 偏好 B。介面應顯示已更新，並說明不消耗回合；不可暗示隊友已採取任何行為。再次執行：

```sh
curl -s http://127.0.0.1:3001/api/game-state
curl -s http://127.0.0.1:3001/api/combat/party
```

偏好應為 B，revision 只增加一次；Round、actor、`currentTurnIndex`、`lastAction`、冷卻、MP、casting、inventory 與 row 應維持不變。重選目前的 B 應為 no-op，revision 不變。

### 3. 敵方回合

使用 normal TEST initiative 時，開戰後目前 actor 是 `TEST-enemy-1`。在此回合開啟 Party 並把偏好 A 改為 B。修改成功後再執行：

```sh
curl -s http://127.0.0.1:3001/api/game-state
```

目前 actor 仍應是 `TEST-enemy-1`，Round 與 `currentTurnIndex` 不變。玩家回合也可重做同一檢查。

### 4. Active casting

重新啟動乾淨 Memory，裝備測試法術：

```sh
curl -i http://127.0.0.1:3001/api/dev/domain/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","expectedRevision":0,"skillIds":["TEST-skill-2"]}'
```

此後 revision 是 1。開始戰鬥並移至玩家回合：

```sh
curl -i http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":1}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":2}'
```

玩家回合 revision 為 3，開始詠唱：

```sh
curl -i http://127.0.0.1:3001/api/combat/casting/start \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":3,"skillId":"TEST-skill-2"}'
```

之後依序推進敵方 `TEST-enemy-2`、下一 Round 的 `TEST-enemy-1`，revision 4 與 5：

```sh
curl -i http://127.0.0.1:3001/api/dev/combat/advance \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":4}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":5}'
```

現在是 Round 2 玩家回合，casting 應為 1/3、目前 MP 為 18、revision 為 6。打開 Party 並更改偏好。應只增加 revision；actor、Round、casting 進度、已投入 MP 與目前 MP 不變。

### 5. Browser refresh

把偏好設為 B，按 `⌘R`（或瀏覽器重新載入）。再次打開 Party，應仍顯示 B。讀取 `/api/game-state`，確認 reload 沒有建立或重啟戰鬥。

### 6. Stale revision、額外欄位與未知 ID

重新啟動乾淨 Memory 並開始戰鬥；Start 後 revision 為 1。送出舊 revision：

```sh
curl -i http://127.0.0.1:3001/api/combat/party/tactic \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":0,"companionId":"TEST-companion-1","tacticPreferenceId":"TEST-tactic-b"}'
```

預期 `409 stale-revision`。送出額外權威欄位：

```sh
curl -i http://127.0.0.1:3001/api/combat/party/tactic \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":1,"companionId":"TEST-companion-1","tacticPreferenceId":"TEST-tactic-b","hp":9999,"currentMp":9999,"row":"front","nextAction":"attack","targetId":"TEST-enemy-1"}'
```

預期 `400 invalid-command`。未知隊友及偏好也必須拒絕：

```sh
curl -i http://127.0.0.1:3001/api/combat/party/tactic \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":1,"companionId":"UNKNOWN-companion","tacticPreferenceId":"TEST-tactic-b"}'
curl -i http://127.0.0.1:3001/api/combat/party/tactic \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":1,"companionId":"TEST-companion-1","tacticPreferenceId":"UNKNOWN-tactic"}'
curl -s http://127.0.0.1:3001/api/game-state
```

未知 ID 回 `404`；所有拒絕後 preference、revision、actor、Round 與 Turn 均保持不變。

### 7. PostgreSQL 保存與 API 重啟

以下使用獨立的 `ai_trpg_phase21_manual`。請勿沿用有重要資料的資料庫。Docker Compose PostgreSQL 必須先處於 healthy：

```sh
docker compose up -d db
docker compose ps
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" ai_trpg_phase21_manual'
```

在終端機 A 載入本機 `.env` 的連線帳密，再把 URL 指向剛建立的測試資料庫。若密碼含 URL 保留字元，先按 README 說明進行 URL 編碼。

```sh
set -a
. ./.env
set +a
export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/ai_trpg_phase21_manual"
npm run db:migrate:dry-run
npm run db:migrate
```

同一終端機啟動 PostgreSQL API：

```sh
PORT=3002 DOMAIN_STORAGE=postgres DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 COMBAT_ROLL_FIXTURE_MODE=normal npm run dev:api
```

終端機 B 讀取初始狀態、開始戰鬥、讀取 Party options，再把偏好 A 改為 B：

```sh
curl -s http://127.0.0.1:3002/api/game-state
curl -i http://127.0.0.1:3002/api/dev/combat/start \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":0}'
curl -i http://127.0.0.1:3002/api/combat/party
curl -i http://127.0.0.1:3002/api/combat/party/tactic \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":1,"companionId":"TEST-companion-1","tacticPreferenceId":"TEST-tactic-b"}'
curl -s http://127.0.0.1:3002/api/game-state
```

記下偏好、revision、Round、目前 actor、`currentTurnIndex` 與 `lastAction`。此時偏好應是 B，revision 應為 2；actor／Round／Turn 不應因偏好變更而改動。

只在終端機 A 按 Ctrl+C 停止 API，不停止 PostgreSQL。以同一個 `DATABASE_URL` 重新啟動 API：

```sh
PORT=3002 DOMAIN_STORAGE=postgres DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 COMBAT_ROLL_FIXTURE_MODE=normal npm run dev:api
```

API 重新啟動後執行：

```sh
curl -s http://127.0.0.1:3002/api/game-state
curl -s http://127.0.0.1:3002/api/combat/party
```

偏好 B、revision、Round、actor、`currentTurnIndex`、`lastAction` 與完整 combat snapshot 應與重啟前相同。測試完成後只需停止 API；Docker PostgreSQL 測試資料庫可保留供檢查。

### 8. 手機寬度

把瀏覽器縮至約 375px。Party 對話框應符合 viewport 寬度；隊友卡與偏好控制可讀，內容需要時在對話框內垂直捲動，關閉按鈕仍可見，頁面沒有水平捲動。

### 9. 鍵盤

按 Tab 移至「隊伍」，按 Enter。焦點應進入標題／對話框，後續 Tab 只在對話框控制中移動，偏好選單有可見 label 與 focus ring。選擇另一項偏好後按 Escape；對話框應關閉，焦點回到「隊伍」按鈕。開啟／關閉不增加 revision。

## 工程檢查與手動驗收

工程檢查：`npm test` 使用獨立 `ai_trpg_phase21_test`，222 項通過、0 項失敗、0 項略過；包含 Phase 18–20 regression 與重新建立 repository／session／pool 後從 PostgreSQL 讀回 preference、revision、actor、Round 及完整 combat snapshot。`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run` 與 `git diff --check` 通過；dry-run 無待執行 migration。

自動測試沒有替代瀏覽器流程。Party 開啟／關閉、偏好操作、敵方回合、active casting、browser refresh、手動 API process restart、375px mobile 與 keyboard 流程，以及 Phase 21 是否接受，仍由使用者依以上清單手動確認。

## 保留的未解問題

- 正式 tactic preset 的名稱。
- 正式 tactic preset 的數量。
- 每個正式 tactic 的精確語意。
- 正式 companion 的預設 tactic。
- 是否可在 combat 外修改 tactic。
- ended-but-unsettled combat 期間的 mutation policy。
- companion 權威 HP／MP／等級／站位接入方式。

## 刻意延後

Phase 21 當時未實作 companion initiative、turn、行動、法術、物品使用、自動回合推進、戰術語意解讀、HP／MP／傷害／治療、LLM narration 或從 Prototype 複製戰術行為。Phase 22 已另以工程 policy 接入最小隊友行動；正式戰術仍未定案。
