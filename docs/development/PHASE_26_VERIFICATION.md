# Phase 26 工程驗證紀錄

日期：2026-09-30。使用者手動驗收：等待確認；Phase 27 未開始。工程結果與接受遊戲玩法／介面是兩件事。

## 實際執行結果

| 檢查 | 結果 |
|---|---|
| `TEST_DATABASE_URL=...ai_trpg_phase26_final_test npm test` | 303 項通過，0 失敗，0 略過 |
| `npm run typecheck` | 通過；另包含於最終 build |
| `npm run build` | TypeScript、Vite 前端與 server 編譯通過 |
| 全新隔離 DB `db:migrate:dry-run` | 成功列出三份 migration SQL，不修改資料 |
| 全新隔離 DB `db:migrate` | 三份 migration 成功套用 |
| 已套用隔離 DB `db:migrate:dry-run` | `No migrations to run!` |
| `git diff --check` | 通過 |
| 真正 API 程序重啟 | 三次重啟通過；ended／settled／Load replay 快照逐項比較 |
| Memory TEST 情境產生器 | victory／escape／defeat／dead-companion 四種 API 情境均成功停在預期結果 |

測試涵蓋既有全部回歸與新增 Phase 26 測試。沒有以 SSR 或 API 檢查宣稱手機、節奏或人工操作已通過；沒有執行瀏覽器人工驗收。專案沒有 lint／format script，未宣稱執行這些檢查。

## 隔離範圍

使用本機 PostgreSQL 15 獨立 cluster `/private/tmp/ai-trpg-phase26-pg`，使用者 `phase26_test`，`127.0.0.1:55426`。測試資料庫：`ai_trpg_phase26_final_test`；實際程序重啟：`ai_trpg_phase26_restart`。單項競爭測試再建立隨機 schema，完成後移除其測試 schema。

沒有連接正式資料庫、沒有覆寫正式 Save、沒有刪 volume、沒有自行 commit／push。原工作區檢查時為乾淨狀態。現有修改均為本次 Phase 26 工作。

## 競爭與失敗證據

- concurrent Continue：同一 ended revision 只有一個 commit，另一個 stale，無第二次 Party／Encounter 更新。
- 原 request 仍在 controlled gate 等待時，client timeout 不重送；GET 仍讀到 ended，明確第二次 intent 提交後原 request 被拒絕。
- narration 在 gameplay commit 後才啟動。受控 Promise gate 讓後續 Gameplay、Load 或 Reset 先發生，再釋放 AI；同 generation 的舊事件保留，舊 generation 的 callback 丟棄。
- PostgreSQL append／Load／Reset 使用同一 row lock；History 與 Gameplay 不互相覆寫。
- Save 傳入舊讀取切面、live History 已更新但 revision 相同時，SQL 保存 live 完整切面，包含已保存 Entry。
- 強制 DB CHECK 阻擋 gameplay transition：整包 rollback，完整 ended state 保留。
- 不經 application guard 直接寫入重複 post-combat event：DB CHECK 23514 拒絕，原 state 不變。
- timeout fallback 與晚到 model 共用 identity；晚到發布關閉；first-write-wins 保留 canonical Entry。
- callback 保存失敗：settlement 成功、unsaved 一次呈現，不回滾 Gameplay、不重叫 AI、不重新 Settlement。
- allocator 到安全整數上限：可安全完成 Gameplay，但沒有 reservation 時不叫 AI、不補造正式 Entry。
- 同 Combat 經 Load replay：CombatId 保留，settlementRevision 不同，各自有 Entry；active History 恢復 snapshot，身分帳與 high-water 不回退。
- frontend 同 generation 精確 commit snapshot 不會擦掉已收到的 History；Load 的新 generation 仍完整恢復 snapshot，不 merge 舊世界紀錄。

## 實際 API 程序重啟

腳本：`tests/helpers/phase26-restart-check.mjs`。每次執行只允許 `phase26_test@127.0.0.1:55426/ai_trpg_phase26_*`；使用專用資料庫的 Slot 1，執行 TEST Reset，不碰其他 DB。

最終重跑輸出：

```json
{"passed":true,"processRestarts":3,"endedRevision":24,"firstSettlementRevision":25,"replayRevision":27,"sequenceHighWater":6,"combatIdPreserved":true,"historyRestored":true,"generationChangedOnLoad":true}
```

版本不是固定初始值：腳本可重複執行，Reset 保留 allocator／身分帳。首次乾淨 DB 曾驗證 ended 6、settlement 7、Load 8、replay 9、high-water 2。每次重啟完整比較 state，Load 改 generation，ordinary Settlement／restart 保留 generation。

Memory 情境產生器的實際 HTTP 結果：

| 情境 | Reset revision | ended revision | 結果 |
|---|---:|---:|---|
| victory | 1 | 6 | victory |
| escape | 7 | 11 | escaped |
| defeat | 12 | 15 | party-defeat |
| dead-companion | 16 | 29 | victory |

以上只檢查工程資料與 API 契約，沒有判定遊戲感受。

## Migration 與舊存檔相容

新增 `1780300000000_phase26-jsonb-contract.js`：JSONB Phase 26 object 約束、run identity unique index，以及 History／身分帳的 Entry ID、placed sequence、post-combat event 去重約束。沒有新玩法資料表或 destructive data migration。

| 資料 | 相容策略 | 原資料 |
|---|---|---|
| 已知 TEST v1 探索 Save | 明確版本映射為 v2，補已知 fixture 的必要 resources／ownership | 讀取與 Load 不覆寫原 Save row；PostgreSQL 測試逐欄比較原列 |
| Phase 1–25 已知 TEST live snapshot | hydrate 保留既有 revision／Combat facts，補明確映射，首次安全保存 Phase 26 infrastructure | 不重建正式世界、不回滿現有 Combat current |
| v2 active／ended／Game Over Save | 完整驗證後同 run 原子 Load；live revision +1，新 generation，CombatId 原樣 | 原 Save 不修改 |
| 未知正式 v1 Save／缺 world identity | `migration-blocked`，保留原檔 | PostgreSQL 驗證拒絕後 live state 與原 Save 均不變 |
| 缺失／跨 world／重複 references、非法 resources | 安全拒絕，不修補、不部分提交 | 保留原資料 |
| 合法 legacy-unplaced Entry | 保留 ID／文字／已知順序／nullable sequence，獨立區段 | 不猜 chronology、不分配新 sequence |
| 舊前端本地探索文字 | 舊 Save 未保存，沒有可驗證資料可恢復 | 不憑空生成舊歷史 |

正式角色數值／modifier 接入、跨 run import 與損壞資料 Repair 不在本階段。

## 實際限制

- 目前 server 仍使用 TEST fake model。戰後文字採保守 confirmed facts 選項，沒有新增正式 provider、streaming 或開放生成未驗證玩法事實。
- 沒有 durable AI queue。程序 crash 可能丟失未完成文字；保存失敗文字不進入 Save。response 丟失後 GET 不保證取回原 SettlementResult 或原文字。
- `legacy-unplaced` 是相容資料分類；現有 v1 Save 沒有 persisted History，不能從本地頁面文字推定正式來源。
- 嚴重損壞的 live row 可能連安全 hydrate 都不能完成；本階段不繞過 validators 強行修復。FUTURE REQUIRED Repair 仍保留。
- 正式 HP／MP 成長、傷害／治療、Reward／復活、永久 statuses、敵人持久狀態與 Combat 推進 world time 仍依 open commitments 等待規格。

## 證據檔與重跑

本次暫存輸出：`/private/tmp/phase26-final-tests.log`、`phase26-final-build.log`、`phase26-migration-fresh-dry.log`、`phase26-migration-fresh.log`、`phase26-migration-applied-dry.log`、`phase26-restart-final.log`、`phase26-memory-fixture-result.log`。暫存檔可能由作業系統清除；上述數量與結論已記錄於本文件。

```sh
TEST_DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_final_test npm test
npm run typecheck
npm run build
DATABASE_URL=postgres://phase26_test@127.0.0.1:55426/ai_trpg_phase26_final_test npm run db:migrate:dry-run
git diff --check
```

下一步是 [使用者手動驗收](PHASE_26_SETTLEMENT_ACCEPTANCE.md)，不是 Phase 27。
