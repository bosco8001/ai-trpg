# Phase 26 Final Spec — 戰鬥結算與返回探索

狀態：Canon #1–#116 已接受；本對話六項修訂已由使用者以「同意這版」接受。使用者另授權自行補齊必要邊界。
本文為規格整理，沒有開始實作或標記工程驗收通過。
資料依據：本對話先前已回讀的 Canon #1–#116、future/open commitments，以及已接受修訂確認稿。
原 Canon 編號保留；下列明列的修訂與補充優先於早期草圖。索引是摘要，不是原文逐字轉錄。

## 1. 目標與範圍

完成 Persistent Party → Combat → ended Combat → Settlement → Exploration 的閉環。
party-defeat 停在 Game Over，保留 ended Combat。
Settlement 是單一 domain operation；玩法資料先持久化，再生成敘事。

不在本 Phase 建立 persistent Settlement entity、settlementId/status workflow、Combat History、Reward、Resurrection、persistent status、persistent Enemy state、world-time conversion 或 branching history。
既有玩法缺少正式規則時，不因本規格新增傷害、buff、裝備耐久或治療 mechanic。

## 2. Lifecycle 與 authority

### Start Combat
在同一原子邊界驗證目前 combat=null、Player/active Party references、生命與資源合法性、source Encounter 與探索觸發 context。
一次建立完整 CombatState，新 combatId、persistent Character 映射、participants、HP/MP、initiative、turn state、sourceEncounterId、returnExplorationContext、rewardEligibleOnVictory。
成功 revision +1；拒絕或 gameplay persistence 失敗，零 gameplay mutation。

combatId 是新 instance 的唯一身分；Save/Load/API restart 保留；Escape 後重遇同 Encounter建立新 combatId。
Start 不隱藏補血、補魔、Reset 或結算舊 Combat。

### During/ended Combat
combat!=null 時目前 HP/MP/combat lifeState 由 Combat authority 決定，包含 Game Over。
Persistent current/lifeState 可以保留尚未結算的舊值；不要求與 Combat current/lifeState 相同。
普通探索 mutation、第二場 Combat、一般 Party 增減/重排與裝備修改禁止。
正式 Combat mechanic 若需要永久 persistent mutation，依該 mechanic 原子完成，不繞過 revision。
Save/Load、讀取與設定可用；Load 本身是 authoritative replacement。

Combat ended 與 Settlement completed 不同。
ended 後停止行動、turn、dying countdown；activeCastings 立即清除，MP不退款。
Victory/Escape 留在結果頁，直到玩家明確按「繼續」。
結果頁顯示 final Combat facts，不自行計算結算 preview。

### Settlement
只接受 ended + victory/escaped。
重新驗證結果與 final Combat facts，包含 Phase 25 的 Player dead 或全隊無 active → defeat 優先規則。
一包原子處理：
- active Party Character：Combat final HP/MP 寫回，合法 temporary capacity 差異依 Persistent max 向下 clamp。
- dying：1 HP、persistent active；MP依剩餘量寫回並遵守長期上限。
- dead Companion：0 HP、persistent dead，MP忠實寫回並遵守長期上限；移出 active Party。
- 死者 Character/equipment/inventory 保留，不自動轉移物品。
- 存活 Party 成員相對順序不變，不補員。
- Victory 有 source Encounter 時 resolved=true；Escape保持 unresolved。
- 清除 combat cooldown、casting、position/turn 等 combat-only state。
- combat=null，返回當初觸發 Combat 的最小 Exploration context。
- revision +1 exactly once。

不回滿HP/MP；不是Rest；Settlement stabilization不是Rescue action。
不回檔已確認探索資料，不依round推進世界時間。
Escape Settlement 不在同一操作重新觸發 Combat；後續由下一個正式探索行動判斷。

party-defeat 不接受 settleCombat；不寫回戰鬥current resources、不清Combat、不回Exploration、不發Reward。
已成功的物品消耗及永久capacity mutation不因敗北撤銷。

## 3. 永久 capacity 與資源驗證（#66 修訂）

> 後續玩法修訂（截至 2026-10-07）：2026-10-07 使用者撤回保留缺少量與 B 方案，改採穿上裝備提高最大 HP／MP 時，目前值不變（40／40 → 40／54）。使用者其後回覆「確定」：卸下裝備或切換職業降低上限時，只有超出新上限的部分才截低；職業提高上限同樣不恢復目前值；不另存隱藏差額。第四切片已準備正式規則模組與唯讀樣本工具，待 Grok 驗證與使用者驗收；正式角色／存檔尚未接入，原型程式保留舊算法，舊驗證結果不涵蓋此修訂。 原子同步、生命狀態與合法資源驗證維持；不改寫暫時效果、Start／Load／Settlement 或復活規則。下方 Phase 26 契約仍保留作歷史追溯，不代表正式職業／裝備已接入。見 [最新角色規則](../gameplay/character_system.md#上限變化2026-10-07-使用者修訂)。

以下為 Phase 26 當時接受與實作的契約，保留作版本追溯：

永久Max HP/MP action在同一個authoritative transition中：
1. 更新Persistent永久capacity。
2. 必要时向下clamp Persistent current，維持record範圍合法。
3. 依既有正式modifier規則重算Combat effective capacity。
4. 必要時向下clamp Combat current。

例：Persistent 12/15、Combat 7/15，永久maxHp降至10 → Persistent 10/10、Combat 7/10；目前HP仍是Combat的7。
上限提高不恢復current；不直接用Persistent max抹掉合法temporary modifier。
這是#25–#26的明確例外，普通damage/healing/MP消耗仍只改Combat current。

前後皆驗證正式resource invariants：
- maxHp是integer且>=1；currentHp在0..maxHp。
- Persistent active必須currentHp>0；dead必須currentHp=0。
- Combat active>0 HP；dying/dead=0 HP；remaining依Phase25。
- MP若適用，current/max是合法整數，0<=currentMp<=maxMp，maxMp>=0。
- 不支援的capacity/lifeState轉換整體拒絕；不猜死亡、復活或補血。

clamp只處理合法規則造成的上限變化，不修原本非法的Combat current>combat max。
相同規則套用Save/Load/Start/Settlement validators，避免各入口各自猜測。
若現有schema有更窄限制，以既有正式schema為準，不自行放寬。

## 4. Identity、references 與完整性

Combat participantId 與persistent characterId可以不同，必須有明確映射。
Player恰好一次；Party persistent Characters與active Party對應、沒有重複或缺失。
沒有正式mechanic支持的額外Party-side非persistent參與者，本Phase安全拒絕，不暗中加入Summon/follower玩法。
Party order權威來源按既有schema，不能從initiative推導。

每個必要reference必須解析到正確run/world/fixture ownership。
sourceEncounterId=null合法，表示沒有persistent Encounter；有值查不到或屬錯世界即拒絕。
source Encounter Start與Settlement時都必須unresolved；已resolved不是可靜默no-op的正常Settlement。
return context必须有效；source Encounter和return context不互相臨時反推。

所有identity/ownership/結果驗證與mutation共用同一原子邊界，防止驗證後資料改變。
stale expectedRevision先安全拒絕；錯誤不得覆寫或修補目前資料。
完整性失敗保留ended Combat、revision不變、無部分Party/Encounter更新。
UI停止mutation，提供重新讀取、Load健康Save、主選單；不盲目重試。
錯誤回應用穩定issue類別與安全文字，不暴露SQL或內部路徑。

## 5. Revision、generation 與callback（#77/#80 補充）

runtime revision是每個目前run的持久化concurrency token。
成功Start/Combat action/Settlement/Load/Reset各+1；GET/Narrative append/拒絕為+0。
Load使用目前revision+1，不恢復Save的舊revision。

runtimeGeneration是持久化、非重用的世界載入識別：
- 成功Load/Reset更換；失敗不更換。
- 一般Gameplay/Settlement/Narrative append不更換。
- API restart保留；New Run使用獨立run身分與新generation。
- 不從Save恢復舊generation。

AI工作保存run identity、generation、sourceCombatId、sourceStateRevision與reserved sequence。
不得在commit後重新讀目前generation當作原工作的generation。
先commit成功才呼叫AI。

callback的generation檢查、dedupe與History append共用原子邊界，並與Load/Reset協調。
同generation且後續revision較高：可保存舊事件敘事於正確位置。
不同generation/run：discarded，不保存、不顯示、不發布fallback。
取消request只是優化，不能取代檢查。

2026-10-04 已批准的 [R03 第二階段](R03_SECOND_STAGE_PROPOSAL.md) 另將成功的目前資料修復列為同步點：revision 加 1、換新 generation，保留已保存 History、身分帳與 allocator；callback 與修復共用同一來源提交邊界。這是工程修復的延伸；槽修復不影響目前 generation，實作與階段驗收見 [Phase 32](PHASE_32_REPAIR_APPLICATION.md)。

Frontend分開處理state與history：
- 舊revision state不可覆蓋已知新state。
- 有效舊事件敘事可插入History，但不切回舊場景或覆蓋目前主要敘事。
- Load/New Run UI替換使舊非同步UI工作失效；接收Load成功回覆才切換有效世界。
- API command仍是既有minimal intent；run binding由現有session/route/context驗證，不讓client指定玩法facts。

## 6. Response遺失與競爭（#33 修訂）

Timeout/response lost不判定成功或失敗，不自动重送mutation。
GET只恢復讀取當時的authoritative state，不充當原request receipt。
同一Combat仍可結算：恢復結果頁，允許玩家重新點擊。
已Exploration/另一Combat/世界被替換：顯示目前state，放棄舊操作UI。
GET失敗：停止mutation，提供讀取恢復；晚到舊GET亦遵守state guard。

玩家重新點擊使用目前画面revision；原request若仍進行，最多一個成功，其餘conflict、零mutation。
Conflict後自動讀取可以，自动取新revision重送不可以。
保證是同一份ended state最多一次成功提交，不保證同response重播或永久request outcome查詢。
Load回Combat後再完成是合法新Settlement，並非重複原transition。
恢復文案不無證據宣稱原request成功；generic恢復文字不製造成正式post-combat Entry。

## 7. SettlementResult 最終契約

SettlementResult是這次commit的transient confirmed mechanics facts；不是永久歷史record。
包含：
- combatId
- settlementRevision
- result: victory | escaped
- rewardEligible
- partyResults[]
- enemyResults[]
- encounterResult | null
- returnExplorationContext（最小有效references+confirmed labels）
- lastConfirmedCombatAction | null

partyResults每项：
characterId、displayName；
before/after：currentHp/maxHp/currentMp/maxMp（依正式角色resource模型）、lifeState、activePartyMember。

before資源與lifeState來自Combat final；before membership來自pre-settlement Party。
after資源/lifeState來自post-settlement Persistent Character；after membership來自新Party。
不額外保存stabilized/removed/hpChanged、Party order/index或previousRevision。
previousRevision=settlementRevision-1。

partyResults按pre-settlement authoritative active Party order，包含本場實際persistent Party Characters。
enemyResults按Combat既有穩定participant order，若不存在可靠order則stable ID fallback：
participantId、displayName、finalLifeState、final current/max HP、適用時current/max MP。
它不是persistent enemy record。

encounterResult有值時包含encounterId、displayName、before.resolved、after.resolved。
null只表示沒有persistent source Encounter。
lastConfirmedCombatAction只包含最小actionType/actor identity+label/target identities/confirmed outcome；
非action的dying countdown/dead traversal/end check不冒充lastAction，不使用舊AI文字。

rewardEligible：
Victory使用Start時server決定的rewardEligibleOnVictory snapshot；
Escape=false；Sandbox Victory=false。
不生成、不發放XP/Gold/Loot。

## 8. Narrative ordering、legacy、reservation（#102–#104 修訂）

新Gameplay Entry必須sourceStateRevision=來源commit revision。
新system/tutorial/meta Entry sourceStateRevision=null、placementRevision=事件排定时目前runtime revision。
placement不是gameplay來源；來源與位置不在AI完成/append时改寫。
Gameplay Entry不額外存可推導的placementRevision。

可定位Entry：
orderingRevision=sourceStateRevision（Gameplay）或placementRevision（nonGameplay）。
按(orderingRevision,sequence)遞增形成完整排序，不依createdAt/insert完成時間。
sequence由persistence原子reserve；同stream唯一、遞增、不回收、允許gap，restart/Load/Reset不得倒退。
實作不得只用MAX+1或把persistent correctness交給memory counter；選擇機制須满足上述全部保證。
同位置events先確立邏輯次序，再reserve；不得由provider latency決定。
整合到短暫persistence協調邊界，AI等待期间不持有Gameplay lock。

reserve成功前不啟動AI。Gameplay commit失敗不發布敘事，已消耗token可gap。
純敘事reserve失敗若Gameplay仍可安全commit，不rollback Gameplay；回報無法保存敘事。
若整個DB transaction已無法安全commit，按真正Gameplay persistence failure整包rollback。
沒reservation的工作不稍後猜位置補一篇正式Entry；可使用本次非持久化generic presentation。
不建立pending Settlement entity或durable job queue；process crash可能丟失未完成敘事，屬v1接受限制。

legacy：
可由明確evidence migration來源/位置才補齊；
否則legacy-unplaced，保留id/content及已知原order，獨立「舊版紀錄」區段。
保留原sequence（如存在）；缺少sequence不能以MAX重新配置成新歷史事件。
保留snapshot已有順序作legacy區段內order，不猜chronology。
legacy例外只允許versioned migration建立，不開放新Gameplay Entry規避source要求。
排序metadata/category納入完整Save，Load原樣恢復。

## 9. Narrative生成、去重與response

SettlementResult是post-combat narration唯一Gameplay facts輸入。
Labels不能產生新mechanics；不得發明loot、傷勢、援軍、移動、復活等未確認facts。
不永久保存完整SettlementResult於NarrativeEntry。
Narrative保存text、identity、type、必要ordering/provenance、source=model/fallback。

Post-combat dedupe：
在正確run/History identity namespace內，
(type=post-combat,sourceCombatId,sourceStateRevision)最多一篇正式Entry。
generation不是dedupe key。
同Combat在Load後不同settlementRevision可各有一篇；Load恢復舊Entry不改identity/provenance。

first-write-wins；provider timeout fallback與遲到model使用同事件identity/reservation。
fallback不被日後model替換；duplicate發布既有canonical Entry或停止發布輸家版本。
正常pipeline超時選定fallback後關閉model發布路徑；DB constraint仍是最後去重保障。
保存失敗不重做Settlement、不回滾、不無限retry DB或重新叫AI。
成功生成但unsaved文字可一次顯示，附非阻塞提示。
discarded（世界失效）、unavailable（無生成）、unsaved（未保存）與saved outcome語意區分；具體API命名配合現有型別。

Settlement成功response：
state是本次transaction的精確post-commit snapshot；
settlementResult.settlementRevision==state.revision；
narration表達其生成/保存狀況。
Narration完成前其他合法Gameplay可推進，不重新GET最新state拼進舊response。
若舊工作因Load失效，回應只供安全判讀，不能推回舊UI。

一般UI短暫等model/fallback后返回Exploration，不新增authoritative narrationPending鎖。
response丟失後可同步目前state；v1不重建丟失facts或承諾補回原文。

## 10. Save/Load、migration、Sandbox

Save是同一持久化切面的完整Gameplay + 已保存active Narrative snapshot，不只存cutoff/Entry IDs。
包含Persistent Characters、Party、Inventory/equipment、Exploration、Encounter、Combat（含ended/gameOver）及正式相關state。
未保存Narration不等待；token high-water/generation infrastructure不隨Save倒退。

Load同run；跨run複製/import不在本Phase。
完整candidate migration/validation通過才原子替換Gameplay與active History，revision+1、generation更換。
不merge目前History，不暗中Settlement、不改combatId/舊Entry id/sequence/provenance。
同Narrative ID對應不同內容/identity facts是integrity conflict，不last-write-wins。
比較以明確versioned schema正常化為準，不因新增metadata把合法舊schema當內容被竄改；沒有證據不改text/provenance。
Run allocator至少保留既有high-water，且新token須大於所有合法恢復token；不能僅靠目前active History的MAX。
Save缺必要world references：versioned mapping能唯一解析才migration，否則保留原檔、migration-blocked。
「自給自足」涵蓋完整mutable Gameplay/History snapshot；static definitions依既有versioned content/reference政策解析，不擅自複製整套世界定義。

Sandbox能力只在DOMAIN_SANDBOX=1 AND COMBAT_SANDBOX=1可用。
已知TEST fixture可deterministic建立，不為正式缺reference造角色。
Start TEST保留已存在HP/MP/membership；Reset才重建。
Reset先驗明確fixture ownership，不靠TEST名稱猜範圍，不能丟掉正式Combat。
Reset原子重建TEST資料/History，revision+1、新generation；combatId永不重用，allocator不倒退。
正式Save/其他world/schema/其他fixture不碰。

## 11. 必要邊界補充的判定方式

以下是使用者授權自行補齊的保守實作契約：
- 正式ID mapping、run/fixture ownership與禁止非法重複，屬既有fail-closed具體化。
- Start/Settlement/Load共用合法性規則，但authority分層不同，不強迫Combat與Persistent資源相等。
- Resolved Encounter、缺return context、未支持額外participant都安全拒絕，不自動創建新玩法。
- Callback generation guard必須在DB append boundary，UI另做有效世界與revision保護。
- Save captures only persisted History；load只restore snapshot，未保存文字不作Entry。
- Legacy schema metadata差異經明確migration處理；來源未知保持未知。
- Request失敗、Narrative失敗、世界失效、資料損壞分別呈現，不能把成功Gameplay誤報成Settlement失敗。

## 12. Future/open commitments

FUTURE REQUIRED：Save / State Repair System。以deterministic rules、verified evidence、backup、candidate validation、atomic apply和repair report為基礎；LLM不猜authoritative identity/resources。
未來從History修復必须证明是目前lineage且沒有後續相關mutation；「最新Settlement HP」本身不足以重建目前HP。

Future：Persistent Settlement/Combat History/Statistics/Replay、Reward、Narration delivery/recovery/versioning、Resurrection、Persistent Enemy/Encounter composition、Persistent statuses/Formation。
Open：Combat推進world time的正式模型。
未來補Narration只能使用已保存的足夠confirmed facts；不能追溯恢復本Phase已丟失facts，原文重送須原text已保存。
未來Settlement/reward identity與Save replay政策須沿用#112的不同completion distinction。
Current enemy final facts只描述本Combat，不讓AI推斷Escape後永久死亡/傷勢/敵人療傷規則。

## 13. 實作與驗收交付

本規格接受≠工程完成。先對照現有domain/schema/API/frontend做implementation mapping，再實作。
主要驗收情境：
- Victory/Escape包含active/dying/dead：HP/MP、Party移除順序、物品保留、Encounter、回原位置。
- Defeat/GameOver Combat authority、無Settlement、Save/Load。
- 下一場Combat繼承資源；temporary clamp；永久capacity下降/增加與Defeat。
- ended Combat可Save/Load、API restart；Combat ID不變，revision不回退。
- duplicate/concurrent Continue、timeout原request仍running、conflict只讀取、不自動mutation retry。
- Load/Reset與pending AI/append競爭，舊world不污染；有效延遲Narration正確排序。
- model/fallback first-write-wins、unsaved/nonblocking、reservation failure/crash不假成功保存。
- Narrative與Gameplay互不覆寫，Save切面完整；History rewind/identity保留/high-water不退。
- 缺/跨world references、duplicate mapping、resolved source、非法Combat facts零mutation。
- legacy migration有/無evidence，原Save保留；TEST ownership與Reset隔離。
- 結果頁Continue in-flight、blocking recovery、375px、keyboard/focus/reduced motion。
工程自動檢查與使用者手動確認分開記錄；目前兩者尚未執行。
