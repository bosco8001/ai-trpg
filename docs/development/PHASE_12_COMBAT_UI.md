# Phase 12：Responsive Combat UI Skeleton

> Phase 1–14 已由使用者確認。Phase 15 工程實作完成，等待使用者手動驗收；Phase 16 尚未開始。

本階段像把 Phase 11 裁判桌上的正式戰鬥記錄表變成玩家可閱讀的畫面。UI 只顯示已確定的 state；它不新增任何戰鬥裁定、攻擊或敘事。

## Authoritative data flow

```text
GameState / CombatState
→ GET /api/game-state
→ shared runtime validation
→ React application switch
→ CombatPage
```

`activity = outside-combat` 顯示既有 Exploration UI；`activity = in-combat` 顯示 Combat UI。重新整理頁面時，前端先讀權威快照，再決定畫面，因此不會先把 active combat 當作探索畫面。

`GET /api/game-state` 是唯讀 endpoint，回傳 `sandbox`、`storage` 與完整但受限的 GameState view。前端把 JSON 視為 `unknown`，會檢查 revision、activity、character、exploration、CombatState、initiative total、tie-break、turn order 與 current actor 的完整一致性；不合格式的 response 不會渲染半套戰鬥畫面。

## Layout

Desktop 使用 battlefield 為主、right rail 為輔的 grid。Header 顯示 `TEST 戰鬥`、Round、current actor 與直接來自 `combat.turnOrder` 的順序列。React 不重新依 initiative total 排序，也不自行遞增 Round 或 current index。

Battlefield 固定顯示四個 presentation lane：

1. 敵方後排
2. 敵方前排
3. 我方前排
4. 我方後排

窄螢幕約 375px 時改為單欄：header、turn order、battlefield、right rail 依序向下。turn order 只可在自己的小區域橫向捲動，不造成整個頁面橫向捲動。桌面 right rail 為較窄的 sticky rail；battlefield 保持較大閱讀與操作空間。

## TEST presentation placement

目前 CombatState 還沒有正式 row state。因此只有前端 `combat-ui.ts` 使用下列 TEST fixture：

```text
TEST-enemy-2 → 敵方後排
TEST-enemy-1 → 敵方前排
TEST-player  → 我方前排
```

這不是 canonical position、target rule 或 row movement。它不會送 request、不會寫入 GameState／PostgreSQL，也不會增加 revision。Phase 14 才會建立 authoritative 前後排狀態與換位規則。

## Participant、right rail 與 commands

Participant card 只顯示 display name、side、initiative total、骰值與明確的「目前行動」文字標記。它是 `article`，不是 target button。

Right rail 目前只有：

- 戰況：Round、current actor、participant count、activity、工程 revision。
- 戰鬥敘事：固定「尚未接入」placeholder；不呼叫 LLM 或 Phase 9 narrator。
- 技能：唯讀 `equippedSkillIds`；不執行技能。
- 指令：普通攻擊、防禦、背包、隊伍、站位／移動、逃走，全部使用 native `disabled`。

沒有 HP、MP、damage、armor、target、attack check、skill cost 或結果文字，避免把不存在的數值誤呈現為正式規則。

## Sandbox TEST control

只有後端以非 production `COMBAT_SANDBOX=1` 啟動時，畫面才顯示「TEST：推進下一回合」。它會呼叫既有 `POST /api/dev/combat/advance`，body 只含目前 authoritative `expectedRevision`。成功時 UI 僅採用 backend response 的新 state；stale 或失敗不會由 frontend 自行推進 actor、Round 或 revision。

Production 與 sandbox 關閉時，這個控制不會渲染。

## Loading、error 與 accessibility

初始讀取顯示「正在確認目前是探索或戰鬥狀態……」。Combat UI 可明確重新讀取 state；network、server 或 malformed response 只顯示安全繁體中文訊息，不顯示 stack、SQL、URL、credentials 或 raw fetch detail。

- 沿用 Phase 2 semantic tokens、繁體中文 font fallback、visible focus ring 與 reduced-motion tokens。
- current actor 使用 border、badge 與「目前行動」文字，不只靠顏色。
- interactive control 使用語意 button；disabled command 不可操作。
- 小螢幕按鈕至少 48px 高，內容使用 `min-width: 0` 與 wrapping 避免全頁 overflow。
- 沒有 turn carousel、card flying、NPC pacing 或其他動畫；reduced motion 不承載任何 state 意義。

本階段使用 `ui-ux-pro-max` 檢查 keyboard focus、touch size、responsive hierarchy 與 reduced motion。其 design-system 搜尋建議的 sci-fi/neon HUD 與外部字體服務，和 canonical dark-fantasy direction 衝突，因此未採用。

## Persistence

Phase 12 沒有新增 authoritative data、migration、table 或 UI persistence。既有 Phase 11 CombatState 繼續由 `game_states.snapshot` 保存；browser refresh 會重新讀取它。layout、scroll position、focus 與 TEST placement 都是 ephemeral frontend presentation state。

## 明確未實作

本階段不做 normal attack、targeting、legal target、attack check、evasion、damage、crit、HP／MP、armor、defend、run、正式 row state／movement、inventory action、skill execution、magic、AoE、Dragon Breath、隊友 AI、combat narration、turn animation、death、victory、defeat、settlement 或戰鬥中 Save／Load 政策。

手動測試見 [README](../../README.md#phase-12responsive-combat-ui-skeleton-手動測試)。
