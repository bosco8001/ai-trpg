# Phase 3：權威狀態與命令邊界

這次像先建立裁判的記錄簿：玩家只能提出請求，裁判通過後才換上一份新記錄。

## 範圍與規則來源

這是最小的技能配置切片，並非完整遊戲存檔格式。規則來自 `character_system.md` 第 7 節與 `magic.md` 第 13 節：已學技能可超過六個；物理與魔法主動技能共用六格；只能在戰鬥外換裝。

`learnedActiveSkillIds` 只表示佔六格的已學主動技能。普通攻擊、武器熟練、種族被動與種族天生主動能力不放入此集合，未來另建模型。現在沒有技能效果或技能使用命令。

`activity` 僅供禁止戰鬥中換裝的守門條件；沒有開始戰鬥、回合或戰鬥結算。完整角色屬性、HP／MP、創角、職業、XP 與施法資格尚未建模。未定規則維持未定。

## 程式邊界

| 檔案 | 責任 |
|---|---|
| `src/domain/game.ts` | 狀態、命令、runtime validation、純狀態轉換 |
| `src/server/domain-session.ts` | 在單程序記憶體中持有權威狀態，只提交成功結果 |
| `src/server/domain-sandbox.ts` | 明確啟用才存在的本機測試 API 與測試資料 |
| `tests/domain.test.ts` | domain 與 HTTP 邊界的工程測試 |

Domain 不依賴 Fastify、React、資料庫或 LLM。建立狀態時複製並凍結巢狀資料，讀取者無法經由參照改寫；成功命令產生新快照，失敗不改動原快照。

目前唯一命令：

```json
{"type":"set-equipped-skills","expectedRevision":0,"skillIds":["TEST-skill-1"]}
```

三個欄位必須齊全，不接受額外欄位或隱式型別轉換。重複技能 ID 視為重複選取而拒絕。`revision` 是工程用更新版本，每次成功命令加一；不是遊戲回合或時間。相同版本送出的兩個命令，只有先處理者可成功，後者須重新讀取。

這個同步記憶體邊界只處理單程序。Phase 4 才設計保存介面、資料庫交易與跨程序併發；現在沒有 save/load、migration 或資料庫 schema。

## 手動測試

前端連線頁沒有改變。本階段使用終端機，無須開啟新的遊戲畫面。

在專案根目錄的終端機 A 啟動獨立測試服務，避免干擾原本的 3001：

```sh
PORT=3002 DOMAIN_SANDBOX=1 npm run dev:api
```

以下指令在終端機 B 依序執行。`TEST-` 全部是工程假資料，不是正式起始角色／技能。若 3002 已被佔用，可自行改成空閒連接埠，並同步修改以下網址。

### 1. 讀取初始狀態

```sh
curl -s http://127.0.0.1:3002/api/dev/domain
```

應有 `sandbox: true`、`revision: 0`、七個已學技能與空的 `equippedSkillIds`。

### 2. 合法裝備六個技能

```sh
curl -i http://127.0.0.1:3002/api/dev/domain/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","expectedRevision":0,"skillIds":["TEST-skill-1","TEST-skill-2","TEST-skill-3","TEST-skill-4","TEST-skill-5","TEST-skill-6"]}'
```

應收到 HTTP 200、`ok: true`、`revision: 1`，技能庫仍有七個技能。

### 3. 超過六格與未學技能

```sh
curl -i http://127.0.0.1:3002/api/dev/domain/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","expectedRevision":1,"skillIds":["TEST-skill-1","TEST-skill-2","TEST-skill-3","TEST-skill-4","TEST-skill-5","TEST-skill-6","TEST-skill-7"]}'

curl -i http://127.0.0.1:3002/api/dev/domain/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","expectedRevision":1,"skillIds":["UNKNOWN"]}'
```

兩者應是 HTTP 409，分別顯示 `too-many-skills` 與 `skill-not-learned`，並有繁體中文原因。重新讀取狀態，版本仍為 1，六個裝備技能不變。

### 4. 拒絕直接寫入 HP 與舊版本

```sh
curl -i http://127.0.0.1:3002/api/dev/domain/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","expectedRevision":1,"skillIds":[],"hp":999}'

curl -i http://127.0.0.1:3002/api/dev/domain/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","expectedRevision":0,"skillIds":[]}'
```

依序應是 HTTP 400 `invalid-command` 與 HTTP 409 `stale-revision`。再讀取時狀態仍不變。第一個例子證明命令拒絕額外狀態欄位，不代表已實作 HP 系統。

### 5. 清空配置與重啟

```sh
curl -i http://127.0.0.1:3002/api/dev/domain/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"set-equipped-skills","expectedRevision":1,"skillIds":[]}'
```

應成功，版本變成 2，配置清空，技能庫不變。在 A 按 Ctrl+C 再用相同命令啟動服務；重新讀取應回到版本 0。這是尚未持久化的預期結果。

測完後停止 A。若不帶 `DOMAIN_SANDBOX=1` 啟動，這兩個測試 API 均為 404；production 即使帶此旗標也不開放。此服務只有本機工程用途，沒有帳號與授權功能。

## 工程檢查

- `npm run build`：TypeScript、Vite 前端與後端編譯通過。
- `npm test`：13 項通過，包含原有 5 項與新增 8 項 domain／API 檢查。
- API 自動化使用 Fastify injection，未啟動額外網路監聽，也未代替手動驗收。

本階段完成後等待使用者確認；下一階段是 Phase 4：PostgreSQL／migration／persistence foundation。
