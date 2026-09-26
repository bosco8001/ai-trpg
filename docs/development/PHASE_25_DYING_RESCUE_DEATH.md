# Phase 25：瀕死、救助與死亡手動驗收

Phase 1–25 已由使用者手動確認。Phase 26 尚未開始。本頁的 TEST HP 與傷害指令只供工程驗證，不代表正式平衡。普通攻擊與技能仍只裁定命中，不會自動扣 HP。

## 0. 準備乾淨 Memory 戰鬥

先停止舊的 API／Web 程序。終端機 A 執行：

```sh
cd "/Users/bosco0295/ai trpg"
DOMAIN_STORAGE=memory DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=normal npm run dev:api
```

終端機 B 執行以下完整共用區塊。所有後續 `curl` 範例都使用這個 `BASE` 與函式；`rev` 每次先從權威 GET 讀取最新 `expectedRevision`。精確測 API 時先關閉戰鬥瀏覽器分頁，避免 Phase 24 自動節奏在兩次命令之間推進回合。

```sh
cd "/Users/bosco0295/ai trpg"
export BASE=http://127.0.0.1:3001
state() { curl -fsS "$BASE/api/game-state"; }
rev() { state | node -e 'let s="";process.stdin.on("data",x=>s+=x).on("end",()=>console.log(JSON.parse(s).state.revision))'; }
show() { state | node -e 'let s="";process.stdin.on("data",x=>s+=x).on("end",()=>{const g=JSON.parse(s).state,c=g.combat;console.log("revision",g.revision,"round",c?.round,"status",c?.status,"endReason",c?.endReason,"actor",c?.currentActorId,"lastAction",c?.lastAction?.type,"MP",g.character.currentMp);console.log("cooldowns",JSON.stringify(c?.skillCooldowns),"racialCooldowns",JSON.stringify(c?.racialAbilityCooldowns),"castings",JSON.stringify(c?.activeCastings));for(const p of c?.participants??[])console.log(p.id,p.row,`${p.health.currentHp}/${p.health.maxHp}`,p.health.lifeState,p.health.dyingTurnsRemaining)})'; }
start() { local r=$(rev); curl -sS -i "$BASE/api/dev/combat/start" -H 'Content-Type: application/json' -d "{\"expectedRevision\":$r}"; }
next() { local r=$(rev); curl -sS -i "$BASE/api/dev/combat/advance" -H 'Content-Type: application/json' -d "{\"expectedRevision\":$r}"; }
hurt() { local r=$(rev); curl -sS -i "$BASE/api/dev/combat/apply-damage" -H 'Content-Type: application/json' -d "{\"expectedRevision\":$r,\"targetId\":\"$1\",\"amount\":$2}"; }
dying() { local r=$(rev); curl -sS -i "$BASE/api/combat/dying-turn" -H 'Content-Type: application/json' -d "{\"expectedRevision\":$r}"; }
rescue() { local r=$(rev); curl -sS -i "$BASE/api/combat/rescue" -H 'Content-Type: application/json' -d "{\"expectedRevision\":$r,\"targetId\":\"$1\"}"; }
act() { local r=$(rev); curl -sS -i "$BASE/api/combat/companion/act" -H 'Content-Type: application/json' -d "{\"expectedRevision\":$r}"; }
defend() { local r=$(rev); curl -sS -i "$BASE/api/combat/defend" -H 'Content-Type: application/json' -d "{\"expectedRevision\":$r}"; }
```

每個成功 `start`、`next`、`hurt`、`dying`、`rescue`、`act`、`defend` 都只使 revision **+1**。GET、瀏覽器取消與被拒絕的 POST 都是 **+0**。每次要重做一條情境，就在 A 按 Ctrl+C，重新執行 A 的 Memory 啟動命令；再於 B 執行 `show`，確認 `revision 0`、`combat null`。不需刪除 PostgreSQL volume。

```sh
cd "/Users/bosco0295/ai trpg"
start
show
```

預期：`start` HTTP 200，revision `0 → 1`；第 1 回合，依固定先攻為 `TEST-enemy-1`。權威 HP：玩家 `10/10`、隊友 `8/8`、敵人 1 與 2 各 `6/6`，全為 `active`。`maxHp` 在這場戰鬥不變。若 `show` 已有 active combat，請勿重複開始。

## 1. 非致命傷、玩家瀕死與隊友自動救援

以下從剛開始、revision 1 的戰鬥執行。`hurt` 是 sandbox 工程入口，不消耗主要行動；只要傷害的是別人，目前 actor 保持不變。這些回應不呼叫 LLM。

```sh
cd "/Users/bosco0295/ai trpg"
hurt TEST-player 3
show
hurt TEST-player 99
show
next
show
dying
show
next
show
act
show
```

逐步預期：

1. 非致命傷：玩家 `10 → 7 HP`，仍 `active`；revision `1 → 2`，actor 仍敵人 1。
2. 致命 TEST 傷害：玩家 `7 → 0 HP`，`dying / remaining 2`；revision `2 → 3`，actor 仍敵人 1，`lastAction` 不被工程傷害覆蓋。
3. `next`：敵人 1 的工程回合結束，revision `3 → 4`，actor 為瀕死玩家。
4. `dying`：玩家自己回合 `2 → 1` 並跳過，revision `4 → 5`，actor 變敵人 2。此步只有確定性系統狀態，不呼叫 LLM。
5. `next`：revision `5 → 6`，actor 為 TEST 隊友。
6. `act`：隊友優先救玩家，即使 TEST 戰術偏好為 A／B；玩家 `0 → 1 HP`、`active / remaining null`，`lastAction=rescue`，revision `6 → 7`。隊友回合已消耗，排位與冷卻不變。

以 `show` 與 `GET /api/game-state` 比對：其他 actor 的 Turn 不會扣玩家倒數。瀕死者沒有正常攻擊、技能、詠唱、換排、防禦、逃跑、物品或龍息行動。

## 2. 玩家手動救隊友與跨排救助

重新啟動乾淨 Memory API，重新執行 `start`。預設玩家在前排、隊友在後排。

```sh
cd "/Users/bosco0295/ai trpg"
start
hurt TEST-companion-1 8
next
show
```

預期依次為 revision `1、2、3`；隊友 `0/8、dying 2`，actor 是玩家。這時可用終端機 C 啟動 `npm run dev:web`，打開 <http://127.0.0.1:5173>。玩家回合會停下。按「救助」→ 明確選「TEST 隊友」；不能選自己、敵人、active 或 dead。成功後隊友 `1/8、active`，仍在**後排**，`lastAction=rescue`，revision `3 → 4`，玩家 Turn 已消耗。重新整理不再執行第二次救助。

不開瀏覽器時，同一步也可用：

```sh
cd "/Users/bosco0295/ai trpg"
rescue TEST-companion-1
show
```

預期同樣是 HTTP 200、revision `3 → 4`。不要在 UI 已救助後再送此命令；那時舊的 `expectedRevision` 已過期。

### 救助不刷新冷卻

重開 Memory API。先在戰鬥外裝備 `TEST-skill-1`，再開戰：

```sh
cd "/Users/bosco0295/ai trpg"
curl -sS -i "$BASE/api/dev/domain/commands" -H 'Content-Type: application/json' -d '{"type":"set-equipped-skills","expectedRevision":0,"skillIds":["TEST-skill-1"]}'
start
next
```

預期裝備 `0 → 1`、開戰 `1 → 2`、敵人推進 `2 → 3`，actor 為玩家。使用 UI 的 `TEST-skill-1` 攻擊前排敵人，記下 `skillCooldowns` 的 `readyRound`；再用 `hurt TEST-player 10`，待隊友輪到時自動救助。比對 `readyRound`：瀕死與救助前後相同。TEST 隊友目前沒有技能冷卻來源；這個流程驗證玩家冷卻不會因隊友救助重設。

## 3. 詠唱被致命傷中斷

重開 Memory API，戰鬥外裝備 `TEST-skill-2`：

```sh
cd "/Users/bosco0295/ai trpg"
curl -sS -i "$BASE/api/dev/domain/commands" -H 'Content-Type: application/json' -d '{"type":"set-equipped-skills","expectedRevision":0,"skillIds":["TEST-skill-2"]}'
start
next
curl -sS -i "$BASE/api/combat/casting/start" -H 'Content-Type: application/json' -d "{\"expectedRevision\":$(rev),\"skillId\":\"TEST-skill-2\"}"
show
hurt TEST-player 10
show
```

預期裝備／開戰／敵人推進／開始詠唱／致命傷每步 +1，最終 revision 5；開始詠唱後玩家 MP `24 → 18`、`activeCastings` 有玩家。致命傷後玩家 `0 HP / dying 2`、`activeCastings` 立即清空，MP 仍 18，不返還。隊友救回後須從頭開始詠唱。普通非致命傷則保留詠唱。

## 4. 隊友瀕死兩次倒數後死亡

重開 Memory API，`start` 後按以下順序執行：

```sh
cd "/Users/bosco0295/ai trpg"
start
hurt TEST-companion-1 8
next
defend
next
dying
show
next
defend
next
dying
show
```

預期 revision 依序為 `1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10`。第一次隊友瀕死 Turn `2 → 1`，仍在後排；第二次 `1 → 0 → dead`，HP 仍 0，`remaining=null`，留在 participants／turnOrder／後排。這兩次各僅 +1；死亡跳過不另加 revision，`lastAction` 保留上次真正行動。玩家仍 active，戰鬥繼續；對 dead 隊友呼叫救助應 HTTP 409、revision +0。

## 5. 敵人死亡、前排阻擋與勝利

重開 Memory API：

```sh
cd "/Users/bosco0295/ai trpg"
start
hurt TEST-enemy-1 99
show
curl -fsS "$BASE/api/combat/normal-attack/options"
hurt TEST-enemy-2 99
show
```

敵人 1 立即 `0/6 / dead`，revision `1 → 2`；因他原是 current actor，同一次轉換已跳至玩家。唯讀 options 會列後排敵人 2 為合法近戰目標，GET +0。敵人 2 死亡後 revision `2 → 3`、`ended / victory`、actor 為 null，兩名死者仍保留原 row。勝利不發 XP、金錢、戰利品，也不返回探索。

## 6. 敗北與不能直接操作的邊界

### 全隊無 active 與單人玩家

重開 Memory API，先執行 `start`：

```sh
cd "/Users/bosco0295/ai trpg"
start
hurt TEST-player 10
hurt TEST-companion-1 8
show
```

玩家瀕死時有 active 隊友，戰鬥仍 active；隊友也瀕死後，全隊無 active，revision `1 → 2 → 3`，立刻 `ended / party-defeat`。兩人的 HP 0 與剩餘 2 保持不變；戰鬥結束後 `dying` 與 `rescue` 均應拒絕、revision +0。

目前公開 TEST 開戰名冊固定包含隊友，且 active 隊友必定優先救援；因此「玩家死亡時隊友仍 active」、「單人玩家瀕死立即敗北」與「同一轉換同時勝敗」不能用這組公開 TEST API 自然製造。這些邊界由 `tests/combat-life.test.ts` 的 domain 自動測試檢查。可複製執行：

```sh
cd "/Users/bosco0295/ai trpg"
node --import tsx --test tests/combat-life.test.ts
```

應見 `Player death defeats Party despite active Companion`、`no active Party and solo Player dying` 通過。單人玩家敗北時仍是 `dying 2`，不自動死亡；玩家死亡優先於 active 隊友。勝敗同時成立時應取 `party-defeat`；後續戰後命運由 Phase 26 決定。

## 7. 過期、非法、注入請求

在新的 active 戰鬥 revision 1 執行以下拒絕測試；請先 `start`，不要讓瀏覽器自動推進。`expectedRevision` 故意用 0：

```sh
cd "/Users/bosco0295/ai trpg"
curl -sS -i "$BASE/api/dev/combat/apply-damage" -H 'Content-Type: application/json' -d '{"expectedRevision":0,"targetId":"TEST-player","amount":1}'
curl -sS -i "$BASE/api/dev/combat/apply-damage" -H 'Content-Type: application/json' -d '{"expectedRevision":1,"targetId":"TEST-player","amount":0}'
curl -sS -i "$BASE/api/dev/combat/apply-damage" -H 'Content-Type: application/json' -d '{"expectedRevision":1,"targetId":"TEST-player","amount":1,"hp":0}'
curl -sS -i "$BASE/api/dev/combat/apply-damage" -H 'Content-Type: application/json' -d '{"expectedRevision":1,"targetId":"TEST-player","amount":1,"lifeState":"dead"}'
show
```

預期 stale HTTP 409，其餘 HTTP 400；revision 仍 1、所有 HP 不變。對 dying／dead 目標再次 `hurt` 也應 HTTP 409、+0。未同時設定 `DOMAIN_SANDBOX=1` 與 `COMBAT_SANDBOX=1` 時，TEST damage endpoint 應 404。

救助拒絕測試：重開 Memory API，`start`、`hurt TEST-companion-1 8`、`next` 到玩家回合後，執行：

```sh
cd "/Users/bosco0295/ai trpg"
curl -sS -i "$BASE/api/combat/rescue" -H 'Content-Type: application/json' -d '{"expectedRevision":2,"targetId":"TEST-companion-1"}'
curl -sS -i "$BASE/api/combat/rescue" -H 'Content-Type: application/json' -d "{\"expectedRevision\":$(rev),\"targetId\":\"TEST-player\"}"
curl -sS -i "$BASE/api/combat/rescue" -H 'Content-Type: application/json' -d "{\"expectedRevision\":$(rev),\"targetId\":\"TEST-enemy-1\"}"
curl -sS -i "$BASE/api/combat/rescue" -H 'Content-Type: application/json' -d "{\"expectedRevision\":$(rev),\"targetId\":\"TEST-companion-1\",\"currentHp\":1}"
show
```

預期第一個 stale 為 HTTP 409；其餘 self／enemy 為 HTTP 409、額外欄位為 HTTP 400。revision 仍 3，隊友仍瀕死。再 `rescue TEST-companion-1` 成功 +1；立刻重送舊 revision 應 409，不能重救或多走一 Turn。兩個客戶端同時送相同 revision 也只能成功一個。

## 8. 前端節奏、刷新、敘事故障

使用終端機 C：

```sh
cd "/Users/bosco0295/ai trpg"
npm run dev:web
```

打開 <http://127.0.0.1:5173>，以下每組情境均先重開乾淨 Memory API 並 `start`；瀏覽器開著時敵方與隊友會自動行動，請用最新 `show` 核對 revision，不要套用舊數字。

1. `hurt TEST-player 10` 後立即刷新瀏覽器，觀察瀕死玩家卡顯示 `HP 0/10・瀕死・剩餘 2 回合`。玩家自己的回合顯示高亮，短暫停頓後由伺服器回應 `2 → 1` 並跳到下一 actor；刷新不能讓同一回合扣兩次。
2. 在瀕死前置停頓與倒數回應後各刷新一次。每次只從 GET 的權威 current actor／remaining 繼續；沒有舊回應蓋掉新 revision。
3. 隊友救助後、結果停留期間立即刷新。`lastAction=rescue`、玩家 `1 HP`、revision 只加一次，不會重做救助。
4. 讓隊友兩次瀕死 Turn 走到死亡；死亡有文字／邊框提示，死亡者保留在行動序列中但不會被選為 actor。一般 `2 → 1` 不會呼叫模型；死亡可以產生已確認事實敘事。
5. 停掉 API 時，自動節奏要顯示安全錯誤並停止；恢復 API 後手動「重新讀取戰鬥狀態」，不能盲目重送舊 mutation。

測模型故障時，在 A 停止 API，以相同 Memory 指令重啟但改成 `NARRATION_FIXTURE_MODE=unavailable`；重新 `start` 並做一次玩家／隊友救助。應顯示「系統敘述」備援，只包含已確認救助、1 HP 等事實，revision 仍只 +1。亦可用 `malformed` 或 `timeout` 重做；不可出現骨折、傷口、失血等未確認事實。TEST damage endpoint 本身沒有敘事呼叫。

## 9. PostgreSQL 保存與 API 重啟

只使用**獨立、沒有重要資料**的資料庫。若已有隔離測試資料庫，可略過建立步驟。不要使用 `docker compose down --volumes`。在 B：

```sh
cd "/Users/bosco0295/ai trpg"
docker compose up -d db
docker compose ps
node --env-file=.env --input-type=module -e 'import pg from "pg";const u=new URL(process.env.DATABASE_URL);const p=new pg.Pool({connectionString:u.href});if(!(await p.query("SELECT 1 FROM pg_database WHERE datname=$1",["ai_trpg_phase25_manual"])).rowCount)await p.query("CREATE DATABASE ai_trpg_phase25_manual");await p.end();'
export DATABASE_URL="$(node --env-file=.env --input-type=module -e 'const u=new URL(process.env.DATABASE_URL);u.pathname="/ai_trpg_phase25_manual";process.stdout.write(u.href)')"
npm run db:migrate:dry-run
npm run db:migrate
```

停止 Memory API，再於 A 用同一個 shell 中的 `DATABASE_URL`（或在 A 重做 `export DATABASE_URL=...`）啟動：

```sh
cd "/Users/bosco0295/ai trpg"
export DATABASE_URL="$(node --env-file=.env --input-type=module -e 'const u=new URL(process.env.DATABASE_URL);u.pathname="/ai_trpg_phase25_manual";process.stdout.write(u.href)')"
DOMAIN_STORAGE=postgres DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal NARRATION_FIXTURE_MODE=normal npm run dev:api
```

在 B 使用前述 `state`／`rev`／`start`／`hurt`／`next`／`dying`／`rescue` helper。先 `show` 確認是乾淨的 revision 0，否則沿用既有狀態，**不要覆蓋**。執行 `start` (+1)、`hurt TEST-companion-1 8` (+1)、`next` (+1)，記下 HP、lifeState、remaining、current actor、row、cooldowns、revision。停止 A 的 API，再用同設定重啟；`show` 應完全一致，沒有額外 revision。接著玩家 `rescue TEST-companion-1` (+1)，再次重啟並讀回 `1 HP / active / remaining null / lastAction rescue`。對舊 revision 重送救助必須 409、state 不變。可另做一輪瀕死 `2 → 1`、重啟、再輪到自己時 `1 → dead`；每次已保存的倒數不重做。Phase 25 沒有新增 migration，仍使用既有 `game_states.snapshot` JSONB。

## 10. 手機、減少動態效果與鍵盤

1. 用瀏覽器裝置模式設為寬 **375px**。確認整頁無水平捲動；每張卡仍可讀 `HP current/max`、瀕死剩餘回合或死亡文字。瀕死與死亡不能只靠顏色辨認。
2. 系統／瀏覽器啟用「減少動態效果」。確認行動者、瀕死、死亡與勝敗仍有文字／邊框提示；不依賴位移動畫才能理解結果。
3. 玩家回合按 Tab 到「救助」，按 Enter 開啟。再用 Tab 到合法瀕死目標，按 Enter 確認；取消也可用鍵盤。焦點環應清楚，NPC 自動節奏不應搶焦點。
4. 結束戰鬥後救助不可操作。刷新後仍是同一 HP／lifeState／勝敗結果；Phase 26 結算尚未接入。

Phase 25 手動驗收已由使用者完成並確認全部通過；Phase 26 尚未開始。
