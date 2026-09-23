# Phase 13：普通攻擊與合法目標

> Phase 1–13 已由使用者確認。Phase 14 工程實作完成，等待使用者手動驗收；Phase 15 尚未開始。

## 範圍與 canonical 規則

本階段依照 [combat_system.md](../gameplay/combat_system.md)、[combat_ui.md](../gameplay/combat_ui.md) 與 [character_system.md](../gameplay/character_system.md)。本階段不改寫 canonical gameplay rule。

普通物理攻擊：

~~~text
Attack Check = D20 + PER modifier + weapon main-stat modifier + proficiency modifier
Evasion Check = D20 + DEX modifier
Attack Check >= Evasion Check → Hit
Attack Check < Evasion Check → Miss
~~~

相等算命中。raw D20 1 不會自動失敗；先加修正，再和閃避總值比較。命中只建立 mechanical result，不造成傷害。

## 權威 row 與攻擊 profile

每名 Combat participant 的位置保存為：

~~~ts
side: "party" | "enemy"
row: "front" | "back"
~~~

戰場位置由 side + row 決定。Combat UI 直接讀 participant.row 與 participant.side 排列，不再有 Phase 12 的 frontend TEST placement fixture。

Phase 13 不提供 row movement。row 在本階段是 authoritative、combat 期間固定；Phase 14 才實作換排。

participant 可帶最小 normalAttack profile：

~~~ts
{
  range: "melee" | "ranged";
  perceptionModifier: number;
  weaponMainStatModifier: number;
  proficiencyModifier: number;
}
~~~

只有目前可由玩家操作的 party actor 需要 profile 才能執行本階段 action。Evasion 的 DEX modifier 重用既有 initiative.dexterityModifier，不另建第二份 DEX。

TEST 初始位置與 profile 都是 engineering fixture：

| participant | side / row | DEX modifier | 普通攻擊 profile |
|---|---|---:|---|
| TEST-player | party / front | +2 | melee；PER +1、主屬性 +2、熟練 +1 |
| TEST-enemy-1 | enemy / front | +1 | 無 |
| TEST-enemy-2 | enemy / back | +0 | 無 |

TEST-player 的 +1 熟練修正只為指定測試 fixture，不定義正式角色熟練數值或角色建立規則。敵方 DEX 直接沿用 Phase 11 initiative fixture。

## 舊 snapshot hydration

Phase 11／12 的已知 TEST combat participant 快照沒有 row。Runtime hydration 只對 exact known TEST participant shape 套用工程相容值：

- TEST-enemy-2 → enemy / back
- TEST-enemy-1 → enemy / front
- TEST-player → party / front，並補上 TEST 普通攻擊 profile

這是工程 backward compatibility，不是 canonical spawn rule。未知 participant 缺少 row、未知舊 ID／side／display name、或新 shape 缺 row 都會 safe reject。相容值通過 validation 後會由下次成功 state mutation 寫回 JSONB。

## Legal targeting

domain function 依 CombatState 和攻擊 range 計算合法目標：

- target 必須存在，且不能是 attacker 或同 side participant。
- melee：若敵方 front row 有 participant，只能指定 enemy front；front 空時 enemy back 可指定。
- ranged：enemy front 與 enemy back 均可指定。
- 不實作 death／unconscious／removed participant 規則。

目標清單是 derived result，不寫進 CombatState 或 PostgreSQL。Frontend 不依 row 自行推導攻擊合法性。

唯讀 endpoint：

~~~http
GET /api/combat/normal-attack/options
~~~

目前 player turn 的回應：

~~~json
{
  "revision": 2,
  "currentActorId": "TEST-player",
  "canPlayerAct": true,
  "legalTargetIds": ["TEST-enemy-1"],
  "targets": [
    { "targetId": "TEST-enemy-1", "displayName": "TEST 敵人 1", "legal": true },
    {
      "targetId": "TEST-enemy-2",
      "displayName": "TEST 敵人 2",
      "legal": false,
      "reason": "front-row-blocked"
    }
  ]
}
~~~

Enemy turn 的回應會標示 canPlayerAct false，並提供空目標清單。UI 將 front-row-blocked 顯示為「前排敵人阻擋」。

## Normal Attack action boundary

正式 action endpoint：

~~~http
POST /api/combat/normal-attack
Content-Type: application/json
~~~

Body exact keys：

~~~json
{
  "expectedRevision": 2,
  "targetId": "TEST-enemy-1"
}
~~~

不得傳 actorId、attack／evasion roll、total、hit、damage、critical、round 或 currentActorId。伺服器一律從 CombatState.currentActorId 取得 actor，並在擲骰前依序驗證 body、expectedRevision、active combat、party action boundary 與 legal target。任何拒絕都不消耗 Turn 或 revision；正常 stale／illegal request 不擲骰。

攻擊與閃避都由注入的 DiceRoller 擲 D20。Production 使用 Node crypto 的安全 D20；規則不直接呼叫 Math.random，也不接受 frontend 提交的骰值。

成功 action 在同一 domain transition 中：

1. 擲攻擊與目標閃避 D20。
2. 計算 totals，依比較規則決定 hit／miss。
3. 保存 lastAction。
4. 結束目前 actor Turn，前進至下一位；最後一位則 Round +1 並 wrap。
5. GameState revision 只增加一次。

無論 hit 或 miss 都會消耗 Turn。CombatState.lastAction 只保留最近一次已確認的 normal attack，包含 round、actor、target、raw D20、所有 modifiers、totals 與 outcome。沒有 unlimited battle log。

## Deterministic action roll fixtures

Action fixture 與 Phase 11 initiative fixture 分開設定。只有 sandbox 啟動時才套用：

| COMBAT_ACTION_ROLL_FIXTURE_MODE | Attack D20 | Evasion D20 | 結果 |
|---|---:|---:|---|
| hit | 10 | 8 | 14 對 9，命中 |
| miss | 3 | 15 | 7 對 16，未命中 |
| raw-one-hit | 1 | 1 | 5 對 2，命中 |

Profile modifiers 固定為 PER +1、weapon main-stat +2、proficiency +1；enemy-1 DEX +1。fixture 數字不代表正式角色設定。

## Persistence 與邊界

CombatState 仍保存於既有 game_states.snapshot JSONB：

- participant row 與必要 normalAttack profile
- Round、turn order、current actor 與 index
- 最近一次 authoritative lastAction
- GameState revision

未新增 table 或 migration。Save／Load 在 active combat 仍回 Phase 11 的 combat-not-supported 暫時 safeguard；戰鬥中是否允許 Save／Load 仍是 OPEN_QUESTIONS。Normal attack 不呼叫 exploration interpreter、narrator、combat narrator 或 LLM。

PostgreSQL 的普通攻擊會在同一筆 `SELECT ... FOR UPDATE` transaction 內讀取目前狀態、檢查 expectedRevision、擲骰並條件式提交。兩個相同版本的併發攻擊中，取得鎖較晚的請求會讀到新 revision，並在擲骰前以 stale-revision 拒絕。

本階段沒有 HP、damage、critical multiplier、armor、status、death、row movement、weapon switching、skills、magic、AI turn 或 combat narration。

## 工程檢查

- npm test：129 項，125 項通過；4 項 PostgreSQL integration test 因未提供隔離的 TEST_DATABASE_URL 而略過。
- npm run build：通過，包含 TypeScript typecheck、Vite build 與 server TypeScript build。
- git diff --check：通過。
- 工程實作階段沒有執行真實 PostgreSQL restart 或使用者手動 UI 驗收。

## 手動驗收

完整啟動指令與 HIT、MISS、raw-one-hit、target cancel、illegal target、stale revision、refresh、PostgreSQL restart、mobile、keyboard 與 backend unavailable 步驟見 [README Phase 13 手動驗收](../../README.md#phase-13普通攻擊與合法目標手動驗收)。

使用者其後確認 Phase 13 手動驗收完成，涵蓋 HIT、MISS、raw D20 1 仍可命中、melee 前排阻擋、非法後排目標、stale revision、取消選目標、browser refresh、mobile／keyboard 與 PostgreSQL persistence。
