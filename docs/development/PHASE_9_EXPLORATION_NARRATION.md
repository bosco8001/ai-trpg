# Phase 9：Exploration Narration Integration

Phase 8 的裁判先把結果寫進記分板，Phase 9 的說書人才描述已經發生的事情。即使說書人失聲，記分板也不會倒退。

## Pipeline

`player text` → Phase 7 candidate → Phase 8 deterministic validation／authoritative transition → Phase 9 `ExplorationNarrator` → Phase 5 `LanguageModel` → runtime validation → exploration UI。

同一個 `POST /api/exploration/actions` 會先提交 authoritative transition，再呼叫 narrator。Frontend 不需再次 POST action，因此不會為了取得敘事重複移動或增加 revision。

## Narration contract

Narrator 只接受以下兩種 backend 建立的權威事實：

- `location-changed`：前一個與目前的 TEST location ID。
- `target-inspected`：目前 TEST location ID 與已確定的 TEST target ID。

它不接受 frontend result、raw candidate 或玩家原文。Provider-neutral 模型請求把最小 instruction 與 authoritative facts JSON 分開；玩家 prompt injection 不會進入 narration input。

模型必須輸出恰好一個 `{ "text": "..." }` JSON object。文字經以下 runtime checks：

- 非空且最多 600 個 Unicode 字元。
- 最多三個短段落。
- 必須提及相應的測試廢墟入口或測試石門。
- 拒絕額外欄位，以及傷害、HP／MP、敵人、戰鬥、寶物、神器、任務、符文、血跡、隱藏機關、成功反轉或 state／command 等未提供宣稱。

這是針對目前兩個 TEST fixture 的最小 consistency guard，不是完整語意 fact checker，也不是正式敘事規則。

## Fixed narration

- 移動：`你完成了移動，抵達測試廢墟入口。`
- 觀察：`你把注意力集中在測試石門上，完成了這次觀察。`

觀察敘事沒有描述門上內容，因為 authoritative data 沒有提供符號、機關或其他觀察事實。上述文字全是工程 fixture，不是 canonical lore。

## Failure semantics

Authoritative transition 和 repository save 發生在 narrator 之前：

1. transition 成功，revision 增加。
2. PostgreSQL 模式先以 revision 條件式更新保存 snapshot。
3. narrator 才產生 presentation text。

`timeout`、`unavailable` 或 `malformed-response` 只回傳「行動已完成，但探索敘事暫時無法產生。」權威 ruling 保持 accepted，位置與 revision 保持更新後數值。系統不 rollback、不重新 interpretation、不重新執行 command。被 Phase 8 拒絕的 action 使用 `not-requested`，完全不呼叫 narrator。

目前沒有 UI retry button。Narrator 本身只接收 immutable facts，即使日後單獨重試敘事，也沒有 session 或 repository 寫入能力。

## Test modes

Backend-only `NARRATION_FIXTURE_MODE` 支援：

- `normal`
- `unavailable`
- `timeout`
- `malformed`

它不使用 `VITE_*`、provider credential、Internet 或付費請求。正式 provider／model 仍維持 [未決](OPEN_QUESTIONS.md)。完整手動步驟見 [README](../../README.md#phase-9探索敘事整合手動測試)。

## Deferred

Phase 10 才處理探索 save/load 流程。正式 provider、streaming、typing effect、conversation persistence、記憶、RAG、NPC、任務、物品、戰鬥與 combat narration 均未實作。

Phase 9 其後已由使用者手動確認，包括 narration failure 在 PostgreSQL 下不影響 authoritative state。目前 Phase 9.5 只進行 exploration UI alignment；仍不得自動進入 Phase 10。

## 工程檢查

- `npm run typecheck`：通過。
- `npm run build`：通過，包括 Vite frontend 與 TypeScript server build。
- `npm test`：61 項中 60 項通過；需明確提供隔離 `TEST_DATABASE_URL` 的既有 PostgreSQL integration test 略過。Repository contract 測試已覆蓋 transition 先保存及 narration failure 不 rollback。
- `git diff --check`：通過。

這些是工程檢查，不代表敘事品質、介面感受或手動驗收通過。
