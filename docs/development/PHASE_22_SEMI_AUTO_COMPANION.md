# Phase 22：半自動隊友戰鬥行為

> Phase 1–21 已由使用者確認。Phase 22 工程完成，等待使用者手動確認。Phase 23 尚未開始。

## 這一階段的邊界

Phase 21 像替隊友選一張作戰偏好卡。Phase 22 讓 TEST 隊友輪到自己時，由伺服器讀取**當下**的卡，按固定規則自行選行動。玩家按「TEST：執行隊友回合」只是在請伺服器處理目前 Turn，不能指定行動、目標、骰值或結果。

新 TEST 戰鬥的 `TEST-companion-1` 是真正的 `CombatParticipant`：我方後排、參與 `D20 + DEX` 先攻、平手沿既有重擲規則。工程 fixture 的 DEX 0、PER 1、武器主屬性 1、熟練 0、近戰範圍都**不是正式隊友平衡值**。normal fixture 依序擲玩家 12、敵人 1 的 17、敵人 2 的 8、隊友 4，因此 Round 1 順序是敵人 1 → 玩家 → 敵人 2 → 隊友；正式順序仍由骰值決定，不在程式中指定位置。

### TEST 工程 policy，並非正式 canon

| 偏好識別碼 | Phase 22 工程行為 |
|---|---|
| `TEST-tactic-a` | 普通攻擊；按 CombatState participant 的穩定順序選第一個合法敵人。若沒有合法目標，防禦。 |
| `TEST-tactic-b` | 防禦。 |

**TEST-tactic-a = attack、TEST-tactic-b = defend 只供工程驗證，不使這些行為成為 canonical 戰術語意。** Phase 21 靜態 catalog 仍只提供 ID／顯示文字；對應行為放在獨立 `CompanionDecisionPolicy`，未來正式規則可以替換。`null`、未知與不支援的 opaque 偏好不猜行動，回 `409 unsupported-companion-tactic`；Turn、revision、`lastAction` 都不變。

普通攻擊沿用 Phase 13 的近戰前排限制與 `D20 + PER + 武器主屬性 + 熟練` 對 `D20 + DEX`。相等命中，raw 1 不自動落空。只記 hit／miss，沒有 HP、傷害、假 0 傷害、治療或死亡。防禦沿用 Phase 16，只記已用主要行動，不設定減傷數字或持續時間。本階段不用 LLM；Phase 23 才處理已定結果的敘事。Phase 24 才處理非玩家回合的動畫與時間節奏。

`POST /api/combat/companion/act` 的 body **只能**是 `{"expectedRevision":4}`。成功時伺服器在一個權威 transition 內選擇、擲骰、記錄 `lastAction`、推進一次 Turn、增加一次 revision。失敗不保存部分結果；PostgreSQL 以既有鎖定交易與 JSONB snapshot 保存。偏好可在隊友即將行動時修改；真正 act 時讀最新 GameState。玩家指令不會在隊友 Turn 代替隊友操作。TEST advance 保留給既有敵方測試流程，不能跳過隊友。

舊 Phase 1–21 active combat 快照即使有 partyMembers，重啟時也保留原三人名冊與順序；hydrate 不插入隊友。只有 Phase 22 後新開的 TEST 戰鬥加入適用隊友。Active combat Save／Load 限制維持原狀。

## 手動測試 A：乾淨 Memory、普通攻擊與畫面

先停止舊服務。終端機 A：

```sh
cd "/Users/bosco0295/ai trpg"
DOMAIN_STORAGE=memory DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit npm run dev
```

終端機 B：

```sh
cd "/Users/bosco0295/ai trpg"
curl -s http://127.0.0.1:3001/api/game-state
curl -i http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' -d '{"expectedRevision":0}'
curl -s http://127.0.0.1:3001/api/dev/combat
curl -s http://127.0.0.1:3001/api/combat/party
```

確認 `participants` 和 `turnOrder` 都有 `TEST-companion-1`，隊友 `initiative` 記錄 raw D20 4、DEX 0、total 4，`row=back`、`controlledBy=companion`，偏好是 A。瀏覽器開啟 <http://127.0.0.1:5173>，確認我方後排有緊湊「TEST 隊友」卡，行動順序有隊友 chip；沒有隊友 HP／傷害數字。

目前依序為敵人 1、玩家、敵人 2、隊友。以下 TEST 指令只推進前三名；每次 GET 可以核對目前 actor。玩家回合亦可用其正式指令結束，但下列固定 revision 範例使用 TEST 推進以便重做。

```sh
curl -i http://127.0.0.1:3001/api/dev/combat/advance \
  -H 'Content-Type: application/json' -d '{"expectedRevision":1}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance \
  -H 'Content-Type: application/json' -d '{"expectedRevision":2}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance \
  -H 'Content-Type: application/json' -d '{"expectedRevision":3}'
curl -s http://127.0.0.1:3001/api/game-state
```

此時 `revision=4`、`currentActorId=TEST-companion-1`。瀏覽器重新整理可看到隊友高亮與「TEST：執行隊友回合」按鈕。玩家不選 target。按鈕或以下 API 均可觸發；**只選一種**，然後用 GET 讀結果：

```sh
curl -i http://127.0.0.1:3001/api/combat/companion/act \
  -H 'Content-Type: application/json' -d '{"expectedRevision":4}'
curl -s http://127.0.0.1:3001/api/game-state
```

確認 `lastAction.type=normal-attack`、`actorId=TEST-companion-1`、`tacticPreferenceId=TEST-tactic-a`、server 選 `targetId=TEST-enemy-1`。hit fixture 的攻擊是 `10 + 1 + 1 + 0 = 12`，閃避是 `8 + 1 = 9`，結果 hit。沒有 HP／damage。revision 由 4 到 5，Round 由 1 到 2，下一 actor 是敵人 1。刷新瀏覽器後卡片、順序、先攻、偏好、actor 與最近裁定仍相同。

## 手動測試 B：防禦與臨時改偏好

停止 Memory 服務並用上面的終端機 A 指令重啟，從乾淨 revision 0 開始。重新執行 Start Combat 與三次 TEST advance，使隊友成為目前 actor（revision 4）。在這一刻才改 A → B：

```sh
curl -i http://127.0.0.1:3001/api/combat/party/tactic \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":4,"companionId":"TEST-companion-1","tacticPreferenceId":"TEST-tactic-b"}'
curl -s http://127.0.0.1:3001/api/game-state
curl -i http://127.0.0.1:3001/api/combat/companion/act \
  -H 'Content-Type: application/json' -d '{"expectedRevision":5}'
curl -s http://127.0.0.1:3001/api/game-state
```

改偏好後 revision 是 5，actor 仍是隊友，Round／Turn／lastAction 不變。act 後 revision 是 6、Round 2、actor 是敵人 1；`lastAction.type=defend`、`tacticPreferenceId=TEST-tactic-b`，沒有 target、attack／evasion 骰或減傷數字。這證明戰術不是開戰時預先鎖死。也可在隊友下一次 Turn 前改 B → A，確認又選普通攻擊。Party 仍顯示「TEST：戰術偏好 B」，不把它命名為正式「防禦型」。

## 手動測試：stale、欄位注入與玩家權限

再次以乾淨 Memory 到達隊友 Turn（revision 4），先送舊版本及偽造行動；兩者都要保持隊友尚未行動：

```sh
curl -i http://127.0.0.1:3001/api/combat/companion/act \
  -H 'Content-Type: application/json' -d '{"expectedRevision":3}'
curl -i http://127.0.0.1:3001/api/combat/companion/act \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":4,"action":"normal-attack","targetId":"TEST-enemy-2","attackRoll":20}'
curl -i http://127.0.0.1:3001/api/dev/combat/advance \
  -H 'Content-Type: application/json' -d '{"expectedRevision":4}'
curl -i http://127.0.0.1:3001/api/combat/normal-attack \
  -H 'Content-Type: application/json' -d '{"expectedRevision":4,"targetId":"TEST-enemy-1"}'
curl -s http://127.0.0.1:3001/api/game-state
```

依序預期 `409 stale-revision`、`400 invalid-command`、TEST advance 拒絕、玩家普通攻擊拒絕；revision 仍是 4，隊友仍是目前 actor。玩家防禦、背包使用、站位、逃跑、技能、龍息與詠唱同樣不能借用隊友 Turn。Party 開啟／讀取／改偏好仍可用，且改偏好不消耗 Turn。

## 手動測試：獨立 PostgreSQL 與 API 重啟

使用空的 `ai_trpg_phase22_manual`，不要沿用過去階段的資料庫；以下假設已按 README 設定本機 `.env`，Docker PostgreSQL 已啟動。終端機 A：

```sh
cd "/Users/bosco0295/ai trpg"
docker compose up -d db
docker compose ps
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" ai_trpg_phase22_manual'
set -a
. ./.env
set +a
export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/ai_trpg_phase22_manual"
npm run db:migrate:dry-run
npm run db:migrate
PORT=3002 DOMAIN_STORAGE=postgres DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit npm run dev:api
```

若資料庫已建立，`createdb` 會提示已存在；請使用新的空資料庫或先確認目前資料，勿刪除有重要內容的資料庫。終端機 B 使用 3002：

```sh
cd "/Users/bosco0295/ai trpg"
curl -s http://127.0.0.1:3002/api/game-state
curl -i http://127.0.0.1:3002/api/dev/combat/start \
  -H 'Content-Type: application/json' -d '{"expectedRevision":0}'
curl -s http://127.0.0.1:3002/api/dev/combat
curl -i http://127.0.0.1:3002/api/dev/combat/advance \
  -H 'Content-Type: application/json' -d '{"expectedRevision":1}'
curl -i http://127.0.0.1:3002/api/dev/combat/advance \
  -H 'Content-Type: application/json' -d '{"expectedRevision":2}'
curl -i http://127.0.0.1:3002/api/dev/combat/advance \
  -H 'Content-Type: application/json' -d '{"expectedRevision":3}'
curl -i http://127.0.0.1:3002/api/combat/party/tactic \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":4,"companionId":"TEST-companion-1","tacticPreferenceId":"TEST-tactic-b"}'
curl -i http://127.0.0.1:3002/api/combat/companion/act \
  -H 'Content-Type: application/json' -d '{"expectedRevision":5}'
curl -s http://127.0.0.1:3002/api/game-state
```

記下完整 combat snapshot：隊友 participant、initiative、row、turnOrder、偏好 B、`lastAction=defend`、Round 2、actor 敵人 1、revision 6。**只在終端機 A 按 Ctrl+C 停止 API，保留 PostgreSQL**。在 A 使用同一個已 export 的 `DATABASE_URL` 重新啟動：

```sh
PORT=3002 DOMAIN_STORAGE=postgres DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit npm run dev:api
```

終端機 B 讀回並繼續：

```sh
curl -s http://127.0.0.1:3002/api/game-state
curl -s http://127.0.0.1:3002/api/combat/party
curl -i http://127.0.0.1:3002/api/dev/combat/advance \
  -H 'Content-Type: application/json' -d '{"expectedRevision":6}'
curl -s http://127.0.0.1:3002/api/game-state
```

重啟後先確認完整狀態與先前一致；不能重擲隊友先攻、重建 turnOrder、把偏好改回 A 或遺失 `lastAction`。繼續後 revision 7，下一 actor 是玩家。

## 手機、鍵盤與使用者驗收

- 375px 寬：我方後排隊友卡、行動順序 chip 和目前隊友高亮清楚可讀；TEST 隊友回合按鈕可按，整頁沒有水平溢出。
- 六個基本指令仍可見；隊友 Turn 時玩家主要行動停用。Party modal 仍可開關、改偏好，尚無權威隊友 HP／MP 時仍顯示「尚未接入」。
- Tab 可移到 Party 與 TEST 隊友回合按鈕，以 Enter 操作；焦點可見，Party modal 的焦點管理與 Escape 關閉仍正常。
- 使用者自行判定流程、介面與手機操作是否接受。工程檢查不代替手動驗收。

## 尚未定案與刻意延後

正式戰術名稱、數量、語意、生產預設偏好、正式隊友職業／技能與 HP／MP、治療／保護／節省 MP／最弱目標門檻、物品／法術／逃跑政策仍見 [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)。Phase 23 的 LLM 戰鬥敘事、Phase 24 的高亮動畫／延遲／自動節奏均未開始。

## 工程檢查

`npm test` 以隔離的 `ai_trpg_phase22_test` PostgreSQL 執行：232 項通過、0 失敗、0 略過。`npm run typecheck`、`npm run build`、`npm run db:migrate:dry-run`、`git diff --check` 通過；沒有待執行 migration。工程流程另實際停止並重啟 API，確認相同資料庫中的隊友先攻、turnOrder、偏好、lastAction、Round、actor、revision 完整保留，且可繼續戰鬥。這些是工程檢查，使用者手動驗收仍未完成。
