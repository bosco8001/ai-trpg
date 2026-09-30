# Phase 26 規格與實作對照

設計來源：[已接受完整規格](PHASE_26_FINAL_SPEC.md)、[Canon 追溯索引](PHASE_26_CANON_INDEX.md)。兩份來源文件原樣保存；其中「尚未實作」是來源整理當時的狀態。最新工程狀態見 [驗證紀錄](PHASE_26_VERIFICATION.md)。

## 既有結構與明確映射

本專案以 `game_states(character_id, revision, snapshot JSONB)` 保存一個目前遊戲狀態，以三個 `save_slots` 保存快照。沒有正式創角、正式 Encounter catalog、完整裝備系統或永久 capacity modifier 系統。

本階段沿用 JSONB，在 `GameState.phase26` 加入 schemaVersion 2、run/world/fixture ownership、Persistent Characters、Encounter、active History，以及不隨 Save 回退的 generation／allocator／Entry 身分帳。`character.currentMp` 保留為玩家 Persistent MP 的相容欄位；戰鬥畫面與施法改讀 Participant MP。

`CombatParticipant.characterId` 明確對應 Persistent Character；Player 的 participantId 可與 characterId 不同，Companion 也同樣支援。Party 順序沿用玩家後接 `partyMembers` 的既有順序，與 initiative 分開。

`TEST-character` 與已知 TEST roster 使用明確舊版本映射；未知正式角色缺資料時不補造。新戰鬥產生 UUID combatId；已知舊 TEST Combat 使用固定版本映射身分，首次保存後重啟沿用。Reset 保留 run/world identity，換 generation，不重用新 Combat 身分。

## 逐節對照

| Final Spec 節 | 實作位置 | 工程證據 |
|---|---|---|
| 1 範圍 | `domain/settlement.ts`、`server/combat/settlement-service.ts` | Victory/Escape 閉環；Defeat 拒絕；沒有持久 Settlement 或 Reward entity |
| 2 Lifecycle / authority | `domain/combat.ts`、`combat-state.ts`、`game.ts`、`party.ts` | Start 繼承、結果頁停留、dying 1 HP、dead 移除且保留 Character／裝備／Inventory、順序保留、下場新 ID |
| 3 Capacity | `domain/settlement.ts`、共用 validators | 永久上限同步 clamp、上升不補資源、Defeat 保留；temporary capacity 只支援明確 TEST rule，未知正式 modifier 拒絕 |
| 4 Identity / references | `validatePhase26`、`validateCombatReferences`、Start / Settlement / Load | 缺失、跨世界、重複映射、已 resolved source、非法資源均零 mutation；不同 participantId／characterId 測試 |
| 5 Revision / generation | `server/domain-session.ts`、`server/history.ts`、`web/state-sync.ts` | 所有 gameplay 與 append／Load／Reset 共用鎖；Load／Reset 受控同步點丟棄舊 callback；有效延遲事件可插入 |
| 6 Response 遺失 | `web/api.ts`、`CombatPage.tsx` | 單次 intent、5 秒 timeout、只 GET 恢復；原 request 仍在等待時手動再送最多一個 commit |
| 7 SettlementResult | `domain/settlement.ts`、`shared/settlement.ts` | before 取 Combat、after 取 Persistent；最小 confirmed lastAction；回應保留本次 commit snapshot |
| 8 Ordering / reservation | `server/history.ts`、`shared/narrative.ts` | reserve 在 commit 內，provider 不持鎖；source／placement revision 加 sequence 排序；high-water 在 Load／Reset／重啟不退 |
| 9 Narration / dedupe | `settlement-service.ts`、History append、migration | confirmed facts 白名單、timeout fallback 關閉晚到發布、first-write-wins、unsaved 非阻塞；DB CHECK 拒絕重複 event／ID／placed sequence |
| 10 Save / Load / Sandbox | `server/save-game/*`、`game.ts`、`app.ts` | v2 完整同切面快照；Load 只同 run；active／ended／Game Over 可存載；v1 原列不改；雙旗標與 fixture ownership；TEST Reset |
| 11 邊界補充 | 上述 validators 與 services | 安全錯誤類別、禁止 AI 改玩法、不自動重送、不憑缺失資料修復 |
| 12 Future | `OPEN_QUESTIONS.md`、本文件下節 | 保留 FUTURE REQUIRED Repair 與其他 commitments |
| 13 交付 | `tests/settlement.test.ts`、既有回歸、兩份驗收／驗證文件 | 完整 PostgreSQL 回歸、實際 API 重啟、Memory 情境產生器、建置、migration dry-run、diff 檢查 |

上述程式路徑均相對於 `src/`；測試與 migration 路徑相對於專案根目錄。

## PostgreSQL 原子邊界

短交易先 `SELECT ... FOR UPDATE`，再驗證、轉換與提交。Gameplay revision +1；History reserve／append +0 且不能修改 Gameplay。Load／Reset 在同一邊界替換 generation，因此 callback 的 generation 檢查與 append 不會被拆開。

Save 使用單一 SQL statement 從 live JSONB 取完整切面，沒有使用先前讀取的 History 或等待 AI。Narrative 身分帳保留已發布 Entry 的最小文字與 provenance，以支援 first-write-wins 與 Load 身分衝突驗證；它不是 Combat History 或 SettlementResult 保存庫。並發範圍是目前單一狀態列，沒有新增帳號／跨 run import 架構。

## 舊資料與保守限制

- v1 已知 TEST Save：依已知版本補齊 TEST identity/resources/world，解碼為 v2；讀取與 Load 不覆寫原 Save。
- 舊 TEST live snapshot：保留已確認 Combat HP、玩家已付 MP、Party 與 revision；只按已知 roster 補必要映射。不從 initiative 推導 Party。
- 缺正式 identity/resources/world，或未知／不完整 roster：安全阻擋；沒有 Repair／猜測／正式角色預設數值。
- 舊前端本地文字從未保存於 Save，不能憑空重建。已有合法 `legacy-unplaced` Entry 保存原 ID、文字、已知順序與 nullable sequence，獨立顯示；新服務只產生 placed Entry。
- capacity domain 支援不等於新增正式成長／裝備／buff 行動。正式數值與 modifier 接入仍待後續規格。

## Future / open commitments

FUTURE REQUIRED：Save / State Repair System。需要 deterministic rules、verified evidence、backup、candidate validation、atomic apply 與 repair report。LLM 不猜 identity 或資源；單獨「最新結算 HP」不足以重建目前 HP，必須證明 lineage 與沒有後續相關 mutation。

Future：Persistent Settlement、Combat History／Statistics／Replay、Reward、Narration delivery／recovery／versioning、Resurrection、Persistent Enemy／Encounter composition、Persistent statuses／Formation。未保存的 confirmed facts／原文不能承諾追溯補回。未來 Reward identity 與 Save replay 政策須保留不同 completion 的區別。

Open：Combat 推進 world time 的正式模型。Phase 27 未開始。
