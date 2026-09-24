# Phase 19：多回合施法

> Phase 1–18 已由使用者確認。Phase 19 工程完成，等待使用者手動確認。Phase 20 尚未開始。

## 權威規則與工程範圍

多回合施法像念三頁咒文：開始前須有足夠 MP 念完整段，但每回合只支付當頁的 MP。權威來源為 [魔法](../gameplay/magic.md)及[戰鬥規則](../gameplay/combat_system.md)。直接施法必須念咒；開始與繼續施法各是一個主要行動。普通受攻擊不會清除詠唱。詠唱完成後仍要另行裁定施法成功、魔法命中及效果，Phase 19 不處理這些結果。

| 工程 fixture | 值 |
|---|---:|
| 技能 | `TEST-skill-2`，TEST 多回合法術，魔法主動，直接施法 |
| 目標 | 無；只測詠唱生命週期 |
| 總成本 | 18 MP |
| 詠唱回合 | 3 |
| 每回合 | 6 MP |
| TEST 角色起始 current MP | 24 MP |

`TEST-skill-2` 沿用 Phase 3 的 `learnedActiveSkillIds` 與 `equippedSkillIds`，跟物理主動技能共用最多六格。這些 TEST 名稱和 24 MP 都是工程 fixture，不是正式世界法術或角色平衡；18／3／6 則直接採用 canonical 整除例子，沒有自訂小數分配規則。

## MP、詠唱與保存

`GameState.character.currentMp` 是權威目前 MP。`CombatState.activeCastings` 依 `actorId` 保存 `skillId`、開始 Round、完成的詠唱回合、總回合、總成本和已投入 MP；資料結構可表示不同 actor 各自的詠唱。`lastAction` 記錄開始、繼續、取消或完成的機械事實，包括本次和累計 MP。法術定義仍在靜態工程目錄；不把顯示名稱、命中或傷害定義複製進資料庫。

上述 runtime state、revision、Round 與目前 actor 一起存入既有 `game_states.snapshot` JSONB；不需 migration。已知 `TEST-character` 的 Phase 1–18 舊快照缺少 MP 時只在讀取／驗證時補 TEST 24 MP，缺少詠唱時補空陣列；未知正式角色缺 MP 會拒絕，避免把 24 MP 當成正式預設值。Save Format v1 的正式 MP 欄位升級仍待版本政策；戰鬥中，包括詠唱中，沿用 Phase 10 的 Save／Load 拒絕防護。

## 狀態轉換

| 時點 | current MP | 進度 | 已投入 | 最近行動 | 回合 |
|---|---:|---:|---:|---|---|
| R1 開始前 | 24 | 無 | 0 | 無 | 玩家 |
| R1 開始後 | 18 | 1 / 3 | 6 | `casting-start` | 推進至敵人 2 |
| R2 繼續後 | 12 | 2 / 3 | 12 | `casting-continue` | 推進至敵人 2 |
| R3 繼續後 | 6 | 已完成並清除 | 18 | `casting-complete` | 推進至敵人 2 |

開始時由後端確認：active combat、目前 actor 可由玩家操作、技能存在且屬魔法主動、角色已學且已裝備、actor 尚未詠唱、目前 MP **至少 18**、revision 最新。10 MP 即使足夠第一期 6 MP，也不能開始。合法提交才扣 MP、更新詠唱、保存 lastAction、推進 Turn，revision 只加一次。敵方 Turn 不扣 MP，也不更動進度；只有施法者選擇繼續才扣下一期。

正在詠唱的 actor 在自己的 Turn 必須先繼續或取消。普通攻擊、物理技能、防禦、換排、使用物品、逃跑、開始另一個法術及 TEST 跳過自己的 Turn 都由後端拒絕。敵方 Turn 與 ended combat 也不能繼續或取消。UI 同時停用一般指令，但後端仍是最後守門者。

### 取消的暫定邊界

Canonical 只說每個詠唱回合可繼續或取消，沒有定義「取消」是否消耗主要行動。Phase 19 的 **Provisional engineering behavior（暫定工程行為；NOT locked canonical gameplay rule）** 是：在施法者自己的 Turn 清除詠唱、不扣下一期 6 MP、已付 MP 不退、revision +1，保留目前 actor、不自動推進 Turn。取消後可再選正常主要行動。若日後 canonical 決定取消也消耗 Turn，只需局部修改取消 transition 與介面文字；不要把此暫定行為寫入權威玩法文件。

## API 與介面

- `POST /api/combat/casting/start`：只收 `{"expectedRevision":3,"skillId":"TEST-skill-2"}`。
- `POST /api/combat/casting/continue`：只收 `{"expectedRevision":目前版本}`。
- `POST /api/combat/casting/cancel`：只收 `{"expectedRevision":目前版本}`。

額外 `actorId`、MP／成本、回合數、進度、命中、成功、傷害等欄位均拒絕。後端從權威狀態取得 actor、法術及下一期成本。stale 或非法提交不扣 MP、不變 Turn、不增 revision；檢視資訊與取消「開始確認」也不增 revision。

技能區顯示已裝備的 TEST 法術、18 MP、3 回合詠唱與完整成本的 MP 不足提示。點法術先顯示確認內容，只有確認才提交。詠唱中顯示目前進度、已投入與下次 6 MP；輪到施法者時提供「繼續詠唱／取消詠唱」。最近行動只顯示機械結果，不宣稱法術效果成功。

## 手動測試：Memory

停止舊服務，於專案根目錄啟動：

```sh
DOMAIN_STORAGE=memory DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1 \
COMBAT_ROLL_FIXTURE_MODE=normal COMBAT_ACTION_ROLL_FIXTURE_MODE=hit \
NARRATION_FIXTURE_MODE=normal npm run dev
```

先 GET `/api/dev/domain` 讀實際 revision。乾淨 Memory 應為 0。用 Phase 3 指令裝備 `TEST-skill-2`；也可同時裝備 `TEST-skill-1`。以下假設 revision 0：

```sh
curl -s http://127.0.0.1:3001/api/dev/domain
curl -i http://127.0.0.1:3001/api/dev/domain/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","expectedRevision":0,"skillIds":["TEST-skill-1","TEST-skill-2"]}'
curl -s http://127.0.0.1:3001/api/dev/combat/start \
  -H 'Content-Type: application/json' -d '{"expectedRevision":1}'
```

打開 <http://127.0.0.1:5173>，以「TEST：推進下一回合」到 R1 玩家。應見 MP 24、TEST 法術 18 MP／3 回合。點法術只開確認；取消確認後 GET state 的 revision 應不變。再點法術並確認，預期 MP 18、進度 1/3、已投入 6/18、revision +1，目前 actor 為敵人 2。

以 TEST 控制推進敵人 2、R2 敵人 1，到 R2 玩家。過程中 MP 和詠唱進度不變；玩家回合一般主要行動不可直接使用。點「繼續詠唱」後應為 MP 12、進度 2/3、投入 12/18、revision +1，Turn 結束。再推進兩個敵方 Turn 到 R3 玩家，繼續後應為 MP 6、詠唱清除、最近行動顯示「詠唱完成／總投入 18 MP」、revision +1，Turn 結束。不得顯示施法成功、命中、傷害或反噬。

## 手動測試：取消與拒絕

重新啟動乾淨 Memory，裝備並完成 R1 開始。到 R2 玩家，按「取消詠唱」。預期 MP 保持 18、詠唱清除、revision +1、actor 仍是 TEST 玩家；介面說明已付 6 MP 不退，然後可選普通主要行動。若重新開始測試，要重啟 Memory 服務，因為目前沒有戰鬥重置 API。

在 R1 玩家可用以下請求檢查注入與 stale；把版本改成當前讀到的數字。兩者均不改 state：

```sh
curl -i http://127.0.0.1:3001/api/combat/casting/start \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":2,"skillId":"TEST-skill-2"}'
curl -i http://127.0.0.1:3001/api/combat/casting/start \
  -H 'Content-Type: application/json' \
  -d '{"expectedRevision":3,"skillId":"TEST-skill-2","mpCost":0}'
```

第一個示例假設目前版本 3，應回 `stale-revision`；第二個應回 HTTP 400 `invalid-command`。繼續／取消也只可送 `expectedRevision`，多加 actor、進度或 outcome 必須拒絕。MP 10 不足例子由自動測試建立，不提供可修改 MP 的公開測試 API。Phase 17 escaped 終止戰鬥後三個詠唱 endpoint 都應回 `combat-ended`。

## 手動測試：刷新、PostgreSQL、手機與鍵盤

R1 開始後、進度 1/3 時重新整理瀏覽器：MP 18、詠唱 1/3 與已投入 6/18 應仍在。到 R2 玩家仍須先繼續或取消。約 375px 寬檢查技能區、確認與詠唱資訊可讀、沒有水平捲動。鍵盤以 Tab 到 TEST 法術、Enter 開確認、Tab／Enter 確認；下一個玩家 Turn 以 Tab／Enter 操作繼續或取消，焦點要清楚。

PostgreSQL 使用**獨立 Phase 19 測試資料庫**，不要沿用 Phase 18 資料庫或刪除既有 volume。先依 README 的本機 PostgreSQL 設定啟動資料庫，在 PostgreSQL 建立例如 `ai_trpg_phase19_test` 的空資料庫；將此獨立資料庫的連線字串提供給 `DATABASE_URL` 與 `TEST_DATABASE_URL`，在此資料庫執行 `npm run db:migrate`，再以 `DOMAIN_STORAGE=postgres DOMAIN_SANDBOX=1 COMBAT_SANDBOX=1` 和上述 fixture 啟動 API。先 GET state 讀實際 revision，在乾淨狀態裝備、開始戰鬥並完成 R1 施法。記下 MP 18、詠唱 actor／skill／進度 1/3／已投入 6、Round、目前 actor 與 revision。只停止 API、保留 PostgreSQL，再用同一個 `DATABASE_URL` 啟動 API 並 GET state；資料應保持，到下一個玩家 Turn 仍能繼續。隔離資料庫整合測試可用 `TEST_DATABASE_URL` 執行；勿把連線密碼貼進文件。

## 延後項目

小數 MP 分配、正式 MP 成長、MP=0 行動能力、詠唱成功率、反噬機率與嚴重度、魔法命中與傷害、元素專精傷害、死亡／完全昏迷／封魔／反魔法／沉默中斷、魔法書 1.25 倍回合邊界、正式法術清單與平衡均待後續規則。Phase 20 的 AoE、龍息未開始。
