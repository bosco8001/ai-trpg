# Phase 20：AoE 與龍息

> Phase 1–19 已由使用者確認。Phase 20 工程完成，等待使用者手動確認；Phase 21 尚未開始。

## 範圍與權威規則

本階段用排作為 v1 AoE 範圍。玩家選「敵方前排」或「敵方後排」；後端取得該排全部合法目標。每個目標各有一次獨立攻擊 D20 和閃避 D20，整次龍息仍是一個主要行動、一次 revision 更新及一次 Turn 推進。沒有座標、格距、角度或扇形幾何，也沒有新增其他正式 AoE 技能。TEST 戰鬥仍保持敵人 1 在前排、敵人 2 在後排；雙目標同排情境由自動測試建立獨立狀態。

龍息是龍裔天生主動能力，不屬已學或已裝備技能、不佔六格、不消耗 MP、不詠唱。後端依權威角色資料驗證龍裔資格與固定元素，前端不能送種族、元素、骰值、目標清單或結果。每個目標的攻擊為 `D20 + PER 修正`，**不加 INT**；閃避為 `D20 + DEX 修正`。攻擊總值相等即命中；raw 1 不自動失敗。先判定命中，再對 raw 19／20 記錄暴擊；19／20 不是自動命中。

R1 使用後記 `readyRound = 4`；R2、R3 不能使用；R4 可再用，再用後記 `readyRound = 7`。此冷卻另存於 `racialAbilityCooldowns`，不進 Phase 18 的 `skillCooldowns`。龍息可以直接選後排，即使前排仍有敵人。詠唱中的角色只能先繼續或取消詠唱；取消後按 Phase 19 暫定工程行為留在同一 Turn，可以再用龍息。

**Dragon Breath damage application deferred until authoritative HP/damage pipeline and concrete breath balance values exist.** 龍息未來的傷害結構雖已確認為基礎傷害、CON 修正和等級成長，具體數字及 HP／傷害流程尚未確立。本階段不寫傷害、假 0 傷害、HP、護甲減免、死亡或暴擊倍率計算。

## 狀態、API 與相容性

- `GameState.character.raceId` 與 `dragonBreathElement` 保存已確定的角色動態資料。TEST 角色固定 `dragonborn / fire`，**只屬 TEST fixture；不是正式元素機率，也不是創角生成邏輯**。既有 TEST 逃跑修正與其他屬性 fixture 不變。
- 已知 `TEST-character` 舊快照缺種族／元素時，只補上述固定工程值。未知正式舊角色缺資料時保存 `null`；即使種族已知是龍裔，但元素仍未解決，龍息也不可用。不對正式舊快照隨機補元素。
- 舊 CombatState 缺 `racialAbilityCooldowns` 時補空陣列。元素、冷卻、逐目標結果、Round、actor 和 revision 均存入既有 `game_states.snapshot` JSONB；沒有新增 migration。
- `GET /api/combat/dragon-breath/options` 是唯讀選項，含目前版本、actor、Round、元素、readyRound、可用狀態及兩排目標數。空排停用並顯示理由；終止戰鬥回拒絕。
- `POST /api/combat/dragon-breath` 僅接受 `{"expectedRevision":3,"targetRow":"front"}` 或 `back`。額外欄位、舊 revision、冷卻、非龍裔、詠唱、空排及終止戰鬥均在擲骰前拒絕。擲骰中途失敗不保存部分結果、冷卻或 Turn。
- 每個 `lastAction.results[]` 保存目標 ID、兩顆 raw D20、各自修正與總值、hit／miss 及 critical。沒有 damage 或 HP 欄位。
- 戰鬥中仍沿用 Phase 10 Save／Load 安全拒絕，不更改 Save Format v1 政策。此階段完全 deterministic，不呼叫 LLM 或戰鬥敘事。
- 「天生能力」區目前放在已裝備技能區上方，是 Phase 20 的介面選擇，並非永久 canonical 版位。開啟與取消選排只改前端暫存狀態，不提交權威命令。

## 手動測試：Memory 前排與取消

停止舊服務，在專案根目錄啟動：

```sh
DOMAIN_STORAGE=memory DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=normal npm run dev
```

乾淨 Memory 的初始 revision 為 0；如已操作過，先讀 `/api/game-state` 的實際值。另在終端機執行：

```sh
curl -s http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' -d '{"expectedRevision":0}'
```

開啟 `http://127.0.0.1:5173`，按「TEST：推進下一回合」至 R1 玩家。確認龍息・火可用、MP 24。點龍息只出現選排；按取消，確認 revision 與 actor 不變。再選敵方前排：敵人 1 應顯示攻擊 raw 10 + PER 1 = 11、閃避 raw 8 + DEX 1 = 9、命中。revision 增加一次，actor 轉敵人 2，`readyRound = 4`，MP 仍是 24；不顯示傷害或 HP。

## 手動測試：後排、冷卻與刷新

重新啟動乾淨 Memory，重做開戰與推進，選敵方後排。前排敵人仍在時，後排敵人 2 仍可直接被選中並逐目標裁定。

另開一場乾淨 Memory 於 R1 使用龍息。刷新瀏覽器，確認最近裁定、元素與 `readyRound = 4` 保留。用 TEST 推進敵方回合至 R2 玩家：龍息停用，顯示「第 4 回合可再次使用」。直接 POST 也應回 409 且 revision 不變：

```sh
curl -i http://127.0.0.1:3001/api/combat/dragon-breath \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":6,"targetRow":"front"}'
```

範例假設 R2 玩家 revision 為 6，實際操作請換成 GET 讀到的數字。R2 玩家用防禦結束 Turn，推進至 R3 玩家，仍停用；再防禦並推進至 R4 玩家，龍息恢復。R4 再用後應顯示 `readyRound = 7`。

## 手動測試：詠唱限制

重新啟動乾淨 Memory。先用 `/api/dev/domain/commands` 裝備 `TEST-skill-2`，開始戰鬥，推進至 R1 玩家。開始三回合詠唱，推進敵方 Turn 至 R2 玩家。進度 1/3 時龍息停用；直接 POST 應安全拒絕，且不扣 MP、不推進 Turn、不增加 revision。按「取消詠唱」後，actor 仍是玩家，龍息重新可用；使用後 Turn 才結束，MP 保持取消時的 18。

## 手動測試：獨立 PostgreSQL 與 API 重啟

請使用空的 `ai_trpg_phase20_manual` 資料庫，勿沿用 Phase 17–19 的資料庫。按 README 的 `.env` 設定啟動 PostgreSQL，再建立此獨立資料庫，讓 `DATABASE_URL` 指向它，執行 `npm run db:migrate`。啟動 API 時使用 `DOMAIN_STORAGE=postgres DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1` 與上述 hit fixture。先 GET `/api/game-state` 讀 revision，不假設為 0。

R1 玩家使用一次龍息後記錄 `revision`、Round、目前 actor、角色元素、`racialAbilityCooldowns.readyRound = 4` 和逐目標 `lastAction`。**只停止 API，保留 PostgreSQL**。用同一 `DATABASE_URL` 重啟 API；GET 應讀回完全相同的資料。再推進至 R4 玩家，確認龍息重新可用。Phase 20 工程整合測試另使用 `ai_trpg_phase20_test`，與此手動資料庫分離。

## 手機與鍵盤

約 375px 寬檢查「天生能力」、龍息冷卻、選排及逐目標裁定可讀，沒有水平捲動，六個基本指令仍易找到。以 Tab 到龍息、Enter 開選排、Tab 到前排／後排／取消並用 Enter 操作；確認焦點清楚。冷卻中按鈕不可觸發。

## 留待後續決定

龍息基礎傷害、等級成長、傷害取整、權威 HP 流程、護甲實際減免、由龍息造成的死亡、元素抗性、火／冰／雷生成機率、正式創角元素 RNG、其他 AoE 技能、物理 AoE 傷害以及魔法 AoE 命中與傷害均未在 Phase 20 定案。
