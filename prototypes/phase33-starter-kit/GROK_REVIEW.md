# 待送交 AI TRPG Architecture Critic：起始配套原型配點操作補修

2026-10-10。使用者要求人類單一 14 點、所有種族初始未分配。本輪七檔已準備，使用者已明確授權限定七檔 commit／push 並複驗，提交／送達仍依實際讀回。Codex 未執行 build、測試或 UI 驗證。80d5f32 的外部工程 PASS 及 N1 Low 是前版結果，不涵蓋這次變更。實際送出須填完整遠端 TARGET，本檔不是送達證明。

---

請 AI TRPG Architecture Critic 獨立工程驗證以下原型補修。操作代理 Codex；使用者要求只有兩項改動，不重新判定已接受的第五切片、不宣布第六切片或整個 Phase 33 通過。不得改檔案、commit／push、向其他對話發訊息。

## 固定版本與範圍

- Repository：https://github.com/bosco8001/ai-trpg
- 分支：`codex/phase27-mobile-ui`
- BASE：`80d5f329473fbf1bdad97cc5f997811e9d116668`
- TARGET：`【待本輪七檔限定 commit／push 後填入完整 SHA；未填不可送驗】`
- 七檔：`prototypes/phase33-starter-kit/{model.mjs,app.mjs,model.test.mjs,README.md,GROK_REVIEW.md}`、`docs/development/PHASE_33_STARTER_KIT_DISCUSSION.md`、`docs/development/PHASE_33_STARTER_KIT_PROTOTYPE_PROPOSAL.md`。
- README／PROPOSAL 同時補登前版 80d5f32 的外部結果。工作樹其餘 dirty 檔案不在本次；CSS、正式程式／API／保存／名冊不改。核對實際 diff、TARGET 分支與 BASE 祖先關係。

## 必讀來源

AGENTS、CANONICAL_MANIFEST、OPEN_QUESTIONS、本輪兩份討論／範圍文件、原型 README；正式 `docs/gameplay/{character_system.md,classes.md,magic.md}`、`docs/world/races.md`、`src/server/content/{races-v2.ts,classes-v1.ts}`、已接受手機 DESIGN_SYSTEM。使用者最新原型操作要求優先，不把原型物品／技能樣本定為正式平衡。

## 本輪兩項要求

1. 人類配點只有一組 14 點，不再切換自由 12／種族 2 點；其他種族 12 點。六組加減、已分／剩餘、紅字與資格即時一致。
2. 初始、重新整理及清除樣本後所有已分配點數均為 0。沒有預先平均、沒有自動把人類 2 點加到力量，也沒有開始就可建立角色。未完成可預覽，建立須分完合法完整額度。

保留原單項可達範圍：自由 +6、種族可另加 +2，所以人類合計 +8／其他 +6；不擴大既有正式規則。畫面只操作合計；內部仍是 allocation／human。changePoint 先將超過 +6 的部分映射為人類點，若自由總額超過 12 再依屬性順序移到人類來源。確認每一步合計未被改動、沒有丟點／重複點、完整分配與原公式一致，不依賴分配順序改變最終數值。

換初始職業、同族重選、核對頁返回都保留點數。換族保留自由分配、移除舊種族點（沿用原流程）；切回人類增加 2 個未分配點，不幫玩家分配。檢查額度、欄位、紅字、aria 與提示同步。正式創角 UI／API 未改。

## 實際執行（Codex 全部未跑）

使用隔離 checkout：

```sh
npm ci
npm run build
node --test prototypes/phase33-starter-kit/model.test.mjs
node --import tsx --test prototypes/phase33-starter-kit/catalog.test.ts
node --import tsx --test tests/content-catalog.test.ts tests/class-catalog.test.ts tests/character-derivation.test.ts tests/character-creation.test.ts
git diff --check 80d5f329473fbf1bdad97cc5f997811e9d116668 TARGET_FULL_SHA
python3 -m http.server 3047 --bind 127.0.0.1 --directory prototypes/phase33-starter-kit
```

模型 22 項：原18項改用明確完成樣本，另4項新配點案例，全部未執行；名冊2項、前置38項回歸。全套若另跑分開列出，DB skip 不當通過。不要碰使用者現有服務／5432；測完停止自己新開的服務。不要求開 DB，若另測須隔離 cluster。

## 配點與 UI 必測

- 載入人類／劍士：14點未分配，六項已分0、基礎8；紅字依本版已知配套門檻，不能預先揭曉資質／資格／龍息或抽亂數。零點按減無效；直接按核對顯示缺少14且不能建立，焦點到錯誤摘要。
- 手動分 `4／2／2／2／2／2`：每次剩餘與按鈕即時更新，分完14才可進核對。分第15點受阻；減一點變少分又阻擋，重新加到另一屬性可繼續。按鍵／觸控／讀屏名稱及aria-describedby 不再稱自由／種族兩組。人類欄位已分應顯示合計，固定種族值0不重複算額外2。
- 合法但配套不足可繼續，物品／已學保留且不配置。不合格新裝備／技能受阻；既有失效配置保留。
- 人類集中 `8／6／0／0／0／0`、`7／7／0／0／0／0` 可建立；第9點或超額不可。其他四族上限+6及總額12，零初始亦一致。用獨立枚舉核對完整14點向量與原12+2合法向量合計的可達集合一致；同向量不同加點順序的資格、最終屬性及資源一致。
- 切人類→精靈→人類，檢查移除種族點、自由分配保留、新增2點未分配；同族重選、初始職業切換及核對頁返回不丟分配。不得新增預先配點快捷按鈕。
- 上述人類劍士手動分配建立後 HP55/58、MP60/60；重斬生效。背包卸劍停用保留原格、還劍恢復。取消預覽維持原配置／資源。
- 人類魔術師手動合計 `4／2／1／3／2／2`：裝備智慧13／資格15／最終16，MP72/84；卸木杖火焰箭仍生效；轉劍士書與法術停用原格，MP72/72→轉回72/84。另滿值84/84→72/72→72/84證明截低不補回。零 HP／MP 換裝轉職仍0。
- 六格、持有／已學／直接資格、不同技能加成不撐門檻、停用裝備不給屬性／護甲、書本自身12／法術15獨立、高資質不自動取得直接資格、起始配套不重發等22項案例真正跑過；測試使用完成樣本而非把 initialDraft 假做完整分配。
- 手機320／375／390／430、短螢幕／橫向、200%字及zoom，鍵盤完整流程、觸控44×44、文字對比、reduced-motion／transparency、焦點／Sheet堆疊及返回／取消。前版D2主畫面與D3重新開啟回頂應無退化。
- 前版 N1 Low 是切字級／方向時閱讀位置歸零，本輪沒有修正；重現時保留，不冒稱已解決。部分大字候選高於body／畫面、AA與AAA、真手機／Safari／讀屏等限制依本輪實測分開回報。同一session切換真zoom若未測標清。
- 本頁仍只載入入口／CSS／app／model／favicon靜態資源，無API／DB／LLM／localStorage／sessionStorage，重新整理清除樣本。正式角色與存檔未變。

## 回報

先列TARGET／BASE完整SHA、scope、環境、命令exit code，再給工程PASS／FAIL；新缺陷列嚴重度、檔案行號、步驟、影響。原N1與Info和新問題分開，不用舊PASS代替新測試。分本輪實做、引用、推斷、未測、受阻。附可核對輸出／截圖及證據路徑，清理自己新增服務／工作資料夾並保留必要證據。不要改repo、commit／push、其他對話，原型最終是否接受由使用者決定。
