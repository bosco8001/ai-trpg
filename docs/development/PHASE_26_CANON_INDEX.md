# Phase 26 Canon #1–#116 索引

本索引依原對話在本對話已回讀的定案內容整理，為摘要，不是原文逐字轉錄。保留全部原編號。
已接受的後期Canon細化與本次六項修訂依 [Final Spec](PHASE_26_FINAL_SPEC.md) 為準；未修改其他Canon。

| Canon | 摘要 |
|---|---|
| #1 | Victory dying → 1 HP active；dead不復活 |
| #2 | Dead Companion退出active Party，保留角色紀錄 |
| #3 | Party Defeat進Game Over，不自動回探索 |
| #4 | Victory保留HP，不免費補滿 |
| #5 | Victory保留MP，不免費補滿 |
| #6 | Combat cooldown於Victory Settlement清除 |
| #7 | 任何Combat ended立即清activeCastings，MP不退款 |
| #8 | Escape dying同樣穩定到1 HP |
| #9 | Escape資源與combat-only清理原則 |
| #10 | Victory reward eligibility；Escape/Defeat無部分擊殺Reward |
| #11 | Phase26不實作XP/Gold/Loot |
| #12 | Combat ended與Settlement completed分離；Continue最多一次提交 |
| #13 | 成功Settlement清Combat、回探索；不做Combat History |
| #14 | 返回觸發Combat時探索位置/context，不回檔探索 |
| #15 | Victory resolve來源Encounter；Escape unresolved，不同操作立即重開 |
| #16 | Start保存optional sourceEncounterId，不猜來源 |
| #17 | 不建persistent Settlement entity/id/status；domain集中 |
| #18 | Defeat拒絕一般Settlement，保留Combat |
| #19 | 结果頁不建立Settlement preview |
| #20 | Post-combat AI只能敘述confirmed facts |
| #21 | Persist first，narrate second |
| #22 | Ended-but-unsettled Combat合法Save/Load |
| #23 | Dead Companion裝備物品保留 |
| #24 | lastAction不帶入Exploration；只交transient confirmed facts |
| #25 | HP Persistent→Combat→Settlement authority交接 |
| #26 | MP採相同authority，不退款已付MP |
| #27 | Row/round/turn/initiative皆Combat-only |
| #28 | 本Phase不依round推進world time；保留Open |
| #29 | 清理明確combat-only state；persistent status留正式系統 |
| #30 | Escape不保存敵人Combat HP；重新Encounter正常初始化 |
| #31 | Settlement原子revision+1一次，失敗整包rollback |
| #32 | Response authoritative state+transient result |
| #33 | 不確定request以GET恢復目前state，不自動重送（已修訂） |
| #34 | 下場Combat直接繼承Persistent HP/MP |
| #35 | 缺necessary persistent references fail closed；Repair future required |
| #36 | sourceEncounter有值解析失敗整體拒絕 |
| #37 | Response/Narration遺失，v1不猜facts補生成 |
| #38 | Victory/Escape dead Companion採相同死亡規則 |
| #39 | 移除死者後存活相對order不變，不補員 |
| #40 | Combat consumable成功action即原子persistent消耗 |
| #41 | 跨戰鬥保留item/equipment變化由原action即commit |
| #42 | TEST採真正Persistent→Combat→Settlement |
| #43 | Start TEST不偷偷Reset Party |
| #44 | combat非null不能Start第二場 |
| #45 | Gameplay commit後等model/fallback再正常進Exploration UI |
| #46 | Post-combat Narration成為正式Exploration History Entry |
| #47 | Narrative append不加Gameplay revision |
| #48 | Stable combatId；早期單combat去重由#112修正 |
| #49 | Start Combat原子完整建立、revision+1 |
| #50 | Resolved persistent Encounter不能再次Start來源 |
| #51 | Combat保存最小returnExplorationContext，失效安全拒絕 |
| #52 | combat非null禁止一般Exploration mutation |
| #53 | Client只傳settle intent/expectedRevision，Server決定facts |
| #54 | Persistent lifeState僅active/dead；dying僅Combat |
| #55 | Defeat GameOver以final Combat authority顯示 |
| #56 | Dead Companion剩餘MP忠實寫回 |
| #57 | Settlement重新驗證endReason/final Combat一致 |
| #58 | 不把lastCombatId/sourceEncounterId塞入Exploration |
| #59 | Narration pending是presentation，非Gameplay lock |
| #60 | Narrative保存失敗不rollback；未來有facts才補 |
| #61 | SettlementResult是Post-combat Narration唯一Gameplay facts輸入 |
| #62 | Start前完整驗Persistent Party，不偷偷修復 |
| #63 | Settlement不以Combat max覆寫Persistent max |
| #64 | 合法temporary capacity消失clamp；非法Combat fail closed |
| #65 | 以最新Persistent max作長期上限 |
| #66 | 永久capacity action兩邊原子更新、必要clamp（已修訂） |
| #67 | Sandbox-only Reset可強制丟棄目前TEST Combat |
| #68 | Reset原子DEV mutation、revision+1，不歸零 |
| #69 | Reset只清TEST ownership的History/fixture |
| #70 | Reset不重用combatId |
| #71 | Versioned deterministic migration，原Save保留 |
| #72 | 舊Save是否可升級依evidence，不粗暴禁Combat Save |
| #73 | source Encounter只在Victory Settlement成功resolve |
| #74 | Result有rewardEligible但不發Reward |
| #75 | Sandbox Victory rewardEligible=false |
| #76 | Start server決定reward policy snapshot，全Combat不變 |
| #77 | Load runtime revision不回退；補generation |
| #78 | Save完整coherent同一切面snapshot |
| #79 | Settlement後Narration pending也能Save |
| #80 | Async callback驗有效runtime lineage；補generation原子guard |
| #81 | Model/fallback都保存正式Entry，不日後暗換 |
| #82 | Result有最小Enemy confirmed facts |
| #83 | Enemy final HP/MP是本Combat facts，不persistent Enemy |
| #84 | Last confirmed action最小結構化facts，非AI文字 |
| #85 | 主要Entity保存stable ID+confirmed display label |
| #86 | Party membership以before/after表達 |
| #87 | Result不另存完整Party order/index |
| #88 | Optional EncounterResult保存identity+resolved before/after |
| #89 | UI防雙擊；Backend revision check+mutation同原子邊界 |
| #90 | Conflict自動GET，不自动重送mutation |
| #91 | Narrative duplicate first-write-wins；identity由#112精確化 |
| #92 | PartyResult.before按欄位authority，非舊Persistent整份snapshot |
| #93 | Party before/after都有精確current/max HP/MP |
| #94 | 可由before/after推導boolean不另保存 |
| #95 | Settlement成功與Narration成功分開表達 |
| #96 | settleCombat僅victory/escaped，Defeat不同operation |
| #97 | 成功Response：state、transient result、narration outcome |
| #98 | Response state是本次commit精確snapshot；晚到不倒退UI |
| #99 | NarrativeEntry不永久保存完整SettlementResult |
| #100 | Post-combat Entry保存sourceStateRevision |
| #101 | History chronology依Gameplay provenance，非insert完成時間 |
| #102 | 通用sourceStateRevision；補placement/legacy相容分類 |
| #103 | Revision+sequence完整排序；補null provenance混排 |
| #104 | 邏輯事件排定時reserve sequence；補短原子邊界與失敗處理 |
| #105 | Sequence由Persistence原子分配、monotonic、no reuse、可gap |
| #106 | Sequence domain排序範圍為每History stream，非全DB故事 |
| #107 | Load恢復active History，allocator不回退；branch system future |
| #108 | Save完整active History，不只sequence cutoff |
| #109 | Save完整Entry內容，不只ID；新增排序metadata也保存 |
| #110 | Load保留Entry id/sequence/provenance/content，不merge新造 |
| #111 | sourceStateRevision immutable，Load不remap成新revision |
| #112 | Post-combat dedupe=(combatId,sourceStateRevision)，支持Load replay |
| #113 | Result保存settlementRevision，與response.state一致 |
| #114 | 不存previousRevision，derive settlementRevision-1 |
| #115 | Party用pre-settlement order，Enemy用stable participant order |
| #116 | PartyResult僅實際Persistent Party參戰者；無規則不一致fail closed |

## 已接受修訂對照

| 確認稿項目 | Canon銜接 | 內容 |
|---|---|---|
| 1 | #77/#80 | Runtime generation及原子callback guard |
| 2 | #66，#25–#26例外 | 永久capacity變更必要clamp |
| 3 | #33，#12/#17/#89–#90 | GET同步現在，最多一次提交 |
| 4 | #102–#104，#109–#111 | 完整排序、placement、legacy、reservation |
| 5 | #47/#78/#80/#89，#91/#112 | History並發、first-write-wins UI一致 |
| 6 | #35–#36/#62/#71–#72/#116等 | References、same-run Load、Party/裝備guard、清理時點 |

## 補充與工程狀態

使用者接受上述修訂並授權自行補齊必要邊界。Final Spec第11節記錄補充方式，第12節保留future/open commitments。
目前只完成規格文件整理；没有修改AI TRPG專案、沒有實作、沒有執行工程測試，也沒有宣稱使用者手動驗收通過。

