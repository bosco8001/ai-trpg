# Current Open Questions

> 這些項目尚未正式定案。Agent 不得自行把 Prototype 數字或自己的偏好升級為 canon。

## Character / Progression
- XP 升級曲線。
- 各職業起始屬性／技能／裝備。
- 是否加入更多衍生屬性。
- v1 playtest 後 HP／MP 平衡。

## Magic
- **取消詠唱是否消耗主要行動／推進 Turn 尚未定案。** Phase 19 採用 **Provisional engineering behavior（暫定工程行為；NOT locked canonical gameplay rule）**：只在施法者自己的 Turn 解除詠唱、不扣新 MP、不退已付 MP、revision +1，並保留目前 actor，不自動推進 Turn。未來若權威規則決定取消要消耗行動，只需局部更改取消 transition 與 UI 提示；這不是正式規則。
- 正式角色的起始 MP、最大 MP 與等級／職業／種族成長公式尚未建立。Phase 19 的 `TEST-character.currentMp = 24` 僅是工程 fixture，不代表正式平衡。
- 正式施法後續流程，包括詠唱完成後的成功判定、魔法命中、法術傷害與反噬，仍未定案；Phase 19 只記錄詠唱完成。
- MP 歸零後暈眩或失去行動能力的精確時機尚未定案。Phase 19 測試施法完成後保留 6 MP。
- 生產角色與 Save Format v1 的 MP 欄位版本升級政策尚未定案。Phase 19 只為已知 `TEST-character` 舊快照補 `24 MP`，不作為正式角色預設值。
- 施法成功率完整公式。
- 反噬機率與具體效果。
- 魔法書智慧門檻。
- 多回合 MP 不能整除時如何分配。
- 元素專精正式傷害倍率。
- 治療魔法詳細能力上限。
- 儲物空間容量。
- 傳送門距離／目的地限制。
- 昏迷、封魔等未實作特殊狀態是否中斷詠唱仍未定；Phase 25 已確定進入瀕死或死亡會立即清除詠唱，已付 MP 不退。

## Combat
- 個別物理主動技能的傷害、額外命中修正、狀態效果與 AoE 規則，以及正式技能內容製作流程與 HP／傷害整合仍未定案。Phase 18 的 `TEST-skill-1` 只判定命中／未命中，不能視為正式技能效果。
- 正式物品效果與目標規則仍未定；Phase 15 的 TEST self-use fixture 只消耗數量，不代表世界物品或正式效果。
- 戰鬥中是否允許 Save / Load 尚未決定。Phase 11 暫時安全拒絕戰鬥中的保存與載入，避免 Save Format v1 遺失 CombatState；這不是正式 gameplay rule。
- 每排容量／擁擠、換排攔截、區域控制與 opportunity attack 尚未定義。Phase 14 只允許確定前後排換位，不加入容量限制或反擊。
- 防禦的正式減傷量／百分比尚未定案；Prototype 的 `-30%` 不是正式規則。Phase 16 只完成 Defend action plumbing，沒有減傷效果。
- 防禦減傷何時開始生效尚未定案。
- 防禦減傷何時失效、精確持續 timing 尚未定案；一次攻擊、一輪或直到下次自己的 Turn 等方案都未定。
- 防禦是否對所有傷害類型完全相同。
- 暴擊造成小數傷害時的統一取整規則。
- 正式普通攻擊傷害、武器基礎傷害、STR／DEX 加成、護甲、物理技能傷害、法術傷害、龍息傷害及治療數值仍未定；Phase 25 的 generic damage transition 不賦予這些行動傷害值。
- 正式角色與隊友的戰鬥 HP 來源、成長及平衡接入方式仍未定；Phase 25 固定 HP 僅供已知 TEST 角色驗證，不能作正式角色預設值。
- 對瀕死者的處決、特殊攻擊與 AoE 波及規則仍未定；Phase 25 一般目標與 generic damage 均排除瀕死／死亡者。
- 勝敗後瀕死角色的處置、復活、獎勵與返回探索屬 Phase 26 後續規則，尚未定案。Phase 25 結束戰鬥後不再倒數或救助。
- 龍息基礎傷害與等級成長公式。
- 龍息傷害套用須等權威 HP／傷害流程與具體龍息平衡值確立後才接入。Phase 20 僅記錄逐目標命中、未命中、暴擊；不設定 0 傷害，也不計護甲、死亡或取整。
- 龍息火／冰／雷的生成機率。
- 正式創角時龍息元素生成的實作與舊正式龍裔快照缺值處理仍待決定；Phase 20 僅讓已知 TEST 角色安全補固定火元素，未知角色保持未解決且龍息不可用。
- 龍息各元素是否有額外效果。
- Phase 21 的 `TEST-tactic-a`／`TEST-tactic-b` 是工程測試 fixture。Phase 22 工程 policy 暫以 **TEST-tactic-a = 普通攻擊（無合法目標時防禦）、TEST-tactic-b = 防禦** 驗證偏好接通行動；only for engineering verification，**不是正式 canonical 戰術語意**。正式 policy 可替換此對應。
- 正式 tactic preset 的名稱與數量尚未定案。
- 每個正式 tactic preset 的精確語意尚未定案。Phase 22 對 `null`、未知正式偏好與不支援的 opaque ID 安全拒絕隊友行動；正式 production policy、沒有支援偏好時如何處理回合仍待決定，不可預設為攻擊。
- 正式隊友職業／技能、HP／MP、治療優先序、保護主角門檻、MP 節省門檻、最弱目標判準、物品使用、法術選擇與逃跑政策尚未定案。
- 正式 companion 的預設戰術偏好尚未定案。
- 是否允許在戰鬥外修改隊友戰術偏好尚未定案。
- ended-but-unsettled combat 期間是否允許修改偏好尚未定案；Phase 21 在 ended combat 僅允許讀取並安全拒絕修改。
- 正式 companion 的權威 HP／MP、等級與站位資料，以及接入時機尚未定案；Phase 25 只在 CombatParticipant 保存已知 TEST 隊友的戰鬥 HP，不建立正式角色數值。

## AI / LLM
- 正式使用的 LLM 供應商與模型尚未決定。Phase 5 只建立中立介面與固定回應測試模型；不以測試模型代表正式選擇。
- 戰鬥敘事是否永久保存、是否進入存檔歷史，以及每場戰鬥保留多少段敘事尚未決定。Phase 23 只在當次成功 action response 回傳文字；刷新或 PostgreSQL hydrate 不自動補敘事。
- 正式戰鬥敘事模型、token budget、production retry policy 與 streaming 是否需要尚未決定。Phase 23 沿用本機 fake adapter、一次生成與現有逾時邊界。
- 最終戰鬥敘事停頓、動畫毫秒數、是否提供玩家節奏速度設定及是否提供 NPC 動畫快轉仍未定。Phase 24 的前端常數只是可調工程預設，**不是 gameplay rule**。
- 正式 enemy AI、敵方 action／target policy 與 production 不支援 NPC 的長期處理方式仍未定。Phase 24 只在 sandbox 對 `TEST-enemy-*` 使用既有開發推進，不作敵方行動。
- 正式動畫風格細節及傷害、瀕死、死亡的最終畫面停頓尚未定；Phase 25 延伸 Phase 24 暫定呈現節奏。
- Phase 25 敘事僅可使用伺服器已確認的 HP、生命狀態、救助與勝敗事實；正式模型更細緻的受傷用語規範仍未定，不得自行加入傷口或狀態效果。

## Rule
- 遇到上述未定義內容：標記 unresolved / TODO，向使用者回報。
- 不要為了「讓程式完整」而自行創造正式世界規則。
