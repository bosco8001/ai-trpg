# Phase 11：戰鬥回合與先攻引擎

> Phase 1–13 已由使用者確認。Phase 14 工程實作完成，等待使用者手動驗收；Phase 15 尚未開始。

本階段像戰鬥用的排隊號碼機與時鐘。它只決定參戰者順序、目前 Round 與輪到誰，不執行任何攻擊、傷害、技能、NPC AI 或敘事。

## Canonical 規則

規則來源為 `docs/gameplay/combat_system.md` 與 `docs/gameplay/character_system.md`：

```text
Initiative = D20 + DEX modifier
```

initiative total 由高至低排列，整場戰鬥只在開始時建立一次基本順序。Canonical 文件要求同 total 者重擲 D20；文件沒有定義重擲後再次同點的細節。Phase 11 依使用者明確要求，只讓仍同點的小組繼續重擲，直到能排定順序。Tie-break 不改寫原本 initiative total。

## Authoritative CombatState

`GameState.combat` 在非戰鬥時是 `null`。Active combat 至少保存：

- `participants`：最小 participant ID、TEST 顯示名稱、陣營與 initiative 結果。
- `initiative.baseD20`。
- `initiative.dexterityModifier`。
- `initiative.total`。
- `initiative.tieBreakRolls`。
- `turnOrder`。
- `round`。
- `currentTurnIndex`。
- `currentActorId`。

`activity = outside-combat` 必須配合 `combat = null`；`activity = in-combat` 必須配合完整 CombatState。Runtime validation 會拒絕不一致 actor、重複／缺漏 order、錯誤 total、非法 D20 與額外欄位。

Participant 沒有 HP、MP、護甲、傷害、裝備、spell slot、status effect 或 cooldown。完整角色屬性尚未進入 implementation，因此 DEX modifier 使用明確的 TEST fixture，不代表正式角色數值。

## Dice abstraction

Domain 只依賴 `DiceRoller.d20()`，不直接呼叫亂數 API。Server 提供：

- `RandomD20Roller`：使用 Node.js `crypto.randomInt(1, 21)`。
- `SequenceD20Roller`：automated test 與 sandbox fixture 使用的固定序列。

Domain 會重新驗證每個結果必須是 1–20 的整數。平手解析設有工程安全上限，避免錯誤 adapter 永久回傳同一點數造成無限迴圈；超出時 Start Combat 整體失敗，state 不變。

## TEST combat fixtures

參戰者全部是工程資料：

| ID | Side | DEX modifier |
|---|---|---:|
| `TEST-player` | party | +2 |
| `TEST-enemy-1` | enemy | +1 |
| `TEST-enemy-2` | enemy | +0 |

### Normal mode

初始 D20 依序為 `12, 17, 8`：

- `TEST-player`：12 + 2 = 14
- `TEST-enemy-1`：17 + 1 = 18
- `TEST-enemy-2`：8 + 0 = 8

Final order：

```text
TEST-enemy-1 → TEST-player → TEST-enemy-2
```

### Tie mode

初始 D20 為 `10, 11, 6`：

- `TEST-player`：10 + 2 = 12
- `TEST-enemy-1`：11 + 1 = 12
- `TEST-enemy-2`：6 + 0 = 6

前兩者第一次 tie-break 是 `7, 7`，仍然平手；第二次是 `4, 15`。因此 final order 仍是：

```text
TEST-enemy-1 → TEST-player → TEST-enemy-2
```

兩名平手者的原 total 都維持 12；`TEST-enemy-2` 沒有重擲。

## Start Combat

Start request 只能有 `expectedRevision`。成功時：

1. 確認 current state 尚未進入戰鬥。
2. 為每名 TEST participant 擲初始 D20。
3. 計算 total 並解決所有 tie group。
4. 設定 final turn order。
5. 設定 Round 1、index 0 與第一名 current actor。
6. `activity` 改為 `in-combat`。
7. GameState revision 只增加一次。

Start 不自動攻擊、執行第一名行動、結束 Turn 或呼叫 LLM。

## Advance Turn

每次成功 Advance 只前進一名 participant，revision 只增加一次：

```text
Round 1：A → B → C
A advance：Round 1 / B
B advance：Round 1 / C
C advance：Round 2 / A
```

敵人或隊友不會自動跳過，也不會自動採取行動。Phase 11 沒有正式 End Combat、victory、defeat、flee 或 settlement。

## Sandbox API

只有非 production 且明確設定 `COMBAT_SANDBOX=1` 時才註冊：

- `GET /api/dev/combat`
- `POST /api/dev/combat/start`
- `POST /api/dev/combat/advance`

POST body 必須精確為：

```json
{ "expectedRevision": 0 }
```

Caller 不能提交 initiative、round、turn order、actor、winner、damage 或 HP。正常與 tie fixture 由 `COMBAT_ROLL_FIXTURE_MODE=normal|tie` 選擇。這些 route 只供 Phase 11 工程驗證；Phase 12 才建立正式 Combat UI boundary。

## Persistence 與 backward hydration

CombatState 是 authoritative GameState 的一部分，會寫入既有 `game_states.snapshot` JSONB，不需要新 table 或 migration。PostgreSQL restart 後會恢復 active combat、initiative results、order、Round、current turn 與 revision。

Phase 10 以前的 snapshot 沒有 `combat` 欄位；repository hydration 會補成 `combat: null`，再交給完整 domain validation。下一次成功 authoritative mutation 會寫回目前完整 GameState schema。

## Save / Load temporary safeguard

Save Format v1 的意義維持不變，沒有升版，也沒有加入 CombatState。當 current state 是 active combat 時，Save 與 Load 都回：

```text
combat-not-supported
目前工程階段尚未支援戰鬥中的存檔與載入。
```

拒絕不修改 state 或 revision。這是避免不完整 snapshot 的暫時工程防護，**不是正式 gameplay rule**。戰鬥中是否允許 Save / Load 仍保留在 `OPEN_QUESTIONS.md`。

## 明確未實作

Phase 11 沒有普通攻擊、命中、閃避、傷害、暴擊、HP／MP、死亡、護甲、防禦、逃跑、前後排、技能、魔法、AoE、龍息、物品、隊友 AI、combat narration、動畫、Combat UI、戰鬥結算或正式 LLM provider。

完整手動測試見 [README](../../README.md#phase-11戰鬥回合與先攻引擎手動測試)。
