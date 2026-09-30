import { migrateKnownTest, validatePhase26, phase26, newIdentity, canonicalEntry, type Phase26State } from "./settlement.js";
import { createCombatState, type CombatState } from "./combat-state.js";
import { isInventory, normalizeInventory, type InventoryStack } from "./combat-items.js";
import { createLegacyPartyMembers, isPartyMemberStates, type PartyMemberState } from "./party-tactics.js";

export type ExplorationLocationId = "TEST-forest-edge" | "TEST-ruin-entrance";

export interface ExplorationState {
  readonly locationId: ExplorationLocationId;
  readonly lastObservationTargetId: "TEST-stone-door" | null;
}

/** Phase 8 工程 fixture 的起點；不是正式世界初始地點。 */
export function createInitialTestExplorationState(): ExplorationState {
  return Object.freeze({ locationId: "TEST-forest-edge", lastObservationTargetId: null });
}

/** 最小權威狀態切片；TEST 探索識別碼全是工程資料，不是正式世界設定。 */
export interface GameState {
  readonly phase26?: Phase26State;
  readonly revision: number;
  readonly activity: "outside-combat" | "in-combat";
  readonly character: {
    readonly id: string;
    /** 只包含佔六格的已學主動技能；不包含種族能力與武器熟練。 */
    readonly learnedActiveSkillIds: readonly string[];
    readonly equippedSkillIds: readonly string[];
    readonly currentMp: number;
    /** 已確定的角色種族；null 代表舊資料尚未解決。 */
    readonly raceId: string | null;
    /** 創角後固定；TEST 角色使用固定工程 fixture。 */
    readonly dragonBreathElement: "fire" | "ice" | "lightning" | null;
  };
  /** Authoritative item stacks; item definitions live in the static domain catalog. */
  readonly inventory: readonly InventoryStack[];
  /** Party membership and opaque companion preference IDs; no companion turn behavior lives here. */
  readonly partyMembers: readonly PartyMemberState[];
  readonly exploration: ExplorationState;
  readonly combat: CombatState | null;
}

/** Format v2 captures complete mutable gameplay and active persisted History. */
export type GameStateContents = Omit<GameState, "revision" | "phase26"> & { readonly phase26?: Omit<Phase26State,"runtimeGeneration" | "sequenceHighWater" | "narrativeLedger"> };
export function gameStateContents(state: GameState): GameStateContents {
  const validated = createGameState(state);
  const {revision, phase26: p, ...gameplay} = validated;
  if (!p) throw new Error("缺少版本化世界引用。");
  const {runtimeGeneration, sequenceHighWater, narrativeLedger, ...saved} = p;
  return {...gameplay, phase26:saved};
}

export type StateReplacementResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly code: "invalid-state" | "stale-revision" | "revision-limit"; readonly message: string };

/** Load 是 system operation：恢復內容，但 revision 永遠從目前 live state 往前一格。 */
export function replaceGameStateContents(
  current: GameState,
  expectedRevision: unknown,
  contents: unknown,
): StateReplacementResult {
  if (!isRevision(expectedRevision) || expectedRevision !== current.revision) {
    return { ok: false, code: "stale-revision", message: "狀態已更新，請重新讀取後再載入存檔。" };
  }
  if (current.revision === Number.MAX_SAFE_INTEGER) {
    return { ok: false, code: "revision-limit", message: "狀態版本已達工程上限，無法載入存檔。" };
  }
  try {
    if (!isRecord(contents)) throw new Error("存檔內容不是物件。");
    const p = phase26(current), candidate = contents.phase26 as GameStateContents["phase26"];
    if (!candidate || candidate.runId !== p.runId || candidate.worldId !== p.worldId || candidate.fixtureId !== p.fixtureId) throw new Error("存檔世界不一致。");
    const ledger = [...p.narrativeLedger];
    for (const e of candidate.history) {
      const known = ledger.find(k => k.id === e.id);
      if (known && canonicalEntry(known) !== canonicalEntry(e)) throw new Error("敘事身分衝突。");
      if (!known) ledger.push(e);
    }
    const next = createGameState({ ...contents, revision: current.revision + 1,
      phase26:{...candidate,runtimeGeneration:newIdentity(),sequenceHighWater:Math.max(p.sequenceHighWater,...candidate.history.map(e => e.sequence ?? 0)),narrativeLedger:ledger} });
    if (next.character.id !== current.character.id) throw new Error("角色識別碼不一致。");
    return { ok: true, state: next };
  } catch {
    return { ok: false, code: "invalid-state", message: "存檔內容不符合目前的遊戲狀態契約。" };
  }
}

export interface SetEquippedSkillsCommand {
  readonly type: "set-equipped-skills";
  readonly expectedRevision: number;
  readonly skillIds: readonly string[];
}

export interface ApproachTargetCommand {
  readonly type: "approach-target";
  readonly expectedRevision: number;
  readonly targetId: "TEST-ruin-entrance";
}

export interface InspectTargetCommand {
  readonly type: "inspect-target";
  readonly expectedRevision: number;
  readonly targetId: "TEST-stone-door";
}

export type DomainCommand = SetEquippedSkillsCommand | ApproachTargetCommand | InspectTargetCommand;

export type CommandEffect =
  | { readonly type: "equipped-skills-updated"; readonly skillIds: readonly string[] }
  | { readonly type: "location-changed"; readonly locationId: ExplorationLocationId }
  | { readonly type: "target-inspected"; readonly targetId: "TEST-stone-door" };

export type RejectionCode = "invalid-command" | "stale-revision" | "revision-limit"
  | "in-combat" | "target-not-found" | "too-many-skills" | "duplicate-skill" | "skill-not-learned";

export type CommandResult =
  | { readonly ok: true; readonly state: GameState; readonly effect: CommandEffect }
  | { readonly ok: false; readonly code: RejectionCode; readonly message: string };

const rejectionMessages: Record<RejectionCode, string> = {
  "invalid-command": "命令格式不符；不接受直接修改權威狀態。",
  "stale-revision": "狀態已更新，請重新讀取後再送出命令。",
  "revision-limit": "狀態版本已達工程上限，無法接受新命令。",
  "in-combat": "戰鬥中不能執行這項操作。",
  "target-not-found": "目前位置沒有可執行這項操作的目標。",
  "too-many-skills": "最多只能裝備六個主動技能。",
  "duplicate-skill": "同一技能不能重複選取。",
  "skill-not-learned": "只能裝備技能庫中的已學主動技能。",
};

function reject(code: RejectionCode): CommandResult {
  return { ok: false, code, message: rejectionMessages[code] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isIds(value: unknown): value is string[] {
  return Array.isArray(value) && Array.from(value).every(isId);
}

/** 不做型別轉換，也不移除多餘欄位後偷偷接受命令。 */
export function parseCommand(value: unknown): DomainCommand | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 3 || !isRevision(value.expectedRevision)) return undefined;
  if (value.type === "set-equipped-skills" && isIds(value.skillIds)) {
    return { type: value.type, expectedRevision: value.expectedRevision, skillIds: [...value.skillIds] };
  }
  if (value.type === "approach-target" && value.targetId === "TEST-ruin-entrance") {
    return { type: value.type, expectedRevision: value.expectedRevision, targetId: value.targetId };
  }
  if (value.type === "inspect-target" && value.targetId === "TEST-stone-door") {
    return { type: value.type, expectedRevision: value.expectedRevision, targetId: value.targetId };
  }
  return undefined;
}

function loadoutError(learned: readonly string[], equipped: readonly string[]): RejectionCode | undefined {
  if (equipped.length > 6) return "too-many-skills";
  if (new Set(equipped).size !== equipped.length) return "duplicate-skill";
  if (equipped.some((id) => !learned.includes(id))) return "skill-not-learned";
  return undefined;
}

/** 伺服器建立初始狀態的入口；不是玩家命令，也不是創角規則。 */
export function createGameState(seed: unknown): GameState {
  if (isRecord(seed) && Object.hasOwn(seed, "phase26")) {
    const { phase26: data, ...base } = seed;
    // Validate legacy fields without performing fixture migration a second time.
    const validated = createGameStateBase(base);
    if (!isRecord(data)) throw new Error("長期資料格式不正確。");
    const p = data as unknown as Phase26State;
    const state = {...validated, phase26: p};
    validatePhase26(state, p);
    return Object.freeze({...validated,phase26:deepFreeze(structuredClone(p))});
  }
  const base = createGameStateBase(seed);
  const p = migrateKnownTest(base);
  if (!p) return base;
  let combat = base.combat;
  if (combat && !combat.lifecycle) {
    // Versioned known TEST mapping only. Incomplete old rosters remain blocked from Settlement.
    combat = createCombatState({...combat,lifecycle:{combatId:`legacy-TEST-combat-${base.revision}`,runId:p.runId,worldId:p.worldId,fixtureId:p.fixtureId,sourceEncounterId:null,returnExplorationContext:base.exploration,rewardEligibleOnVictory:false},
      participants:combat.participants.map(c => ({...c,characterId:c.side === 'enemy' ? null : c.id === 'TEST-player' ? base.character.id : c.id,
        ...(c.side === 'party' ? {mp:{currentMp:c.id === 'TEST-player' ? base.character.currentMp : 0,maxMp:c.id === 'TEST-player' ? 24 : 0}} : {})}))});
  }
  const migrated={...base,combat,phase26:deepFreeze(p)};
  validatePhase26(migrated,p);
  return Object.freeze(migrated);
}
function deepFreeze<T>(value:T):T { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
function createGameStateBase(seed: unknown): GameState {
  if (!(hasExactKeys(seed, ["revision", "activity", "character", "inventory", "exploration", "combat"])
      || hasExactKeys(seed, ["revision", "activity", "character", "inventory", "partyMembers", "exploration", "combat"]))
    || !(hasExactKeys(seed.character, ["id", "learnedActiveSkillIds", "equippedSkillIds", "currentMp", "raceId", "dragonBreathElement"])
      || hasExactKeys(seed.character, ["id", "learnedActiveSkillIds", "equippedSkillIds", "currentMp"])
      || (hasExactKeys(seed.character, ["id", "learnedActiveSkillIds", "equippedSkillIds"])
        && seed.character.id === "TEST-character"))
    || !hasExactKeys(seed.exploration, ["locationId", "lastObservationTargetId"])) {
    throw new Error("初始 domain 狀態不符合契約。");
  }
  const character = seed.character;
  const partyMembers = Object.hasOwn(seed, "partyMembers") ? seed.partyMembers
    : isRecord(seed.combat) && Array.isArray(seed.combat.participants) && !seed.combat.participants.some(c=>isRecord(c) && c.id === 'TEST-companion-1') ? []
    : createLegacyPartyMembers(typeof character.id === "string" ? character.id : "");
  // 僅供已知 TEST-character 的 Phase 1–18 舊快照升級；正式角色須帶有 MP。
  const currentMp = Object.hasOwn(character, "currentMp") ? character.currentMp : 24;
  // 僅已知 TEST 角色補固定火元素；未知舊角色不產生種族或龍息元素。
  const raceId = Object.hasOwn(character, "raceId") ? character.raceId
    : character.id === "TEST-character" ? "dragonborn" : null;
  const dragonBreathElement = Object.hasOwn(character, "dragonBreathElement") ? character.dragonBreathElement
    : character.id === "TEST-character" ? "fire" : null;
  const exploration = seed.exploration;
  let combat: CombatState | null;
  try {
    combat = seed.combat === null ? null : createCombatState(seed.combat);
  } catch {
    throw new Error("初始 domain 狀態不符合契約。");
  }
  if (!isRevision(seed.revision)
    || (seed.activity !== "outside-combat" && seed.activity !== "in-combat")
    || (seed.activity === "outside-combat" ? combat !== null : combat === null)
    || !isId(character.id)
    || !isIds(character.learnedActiveSkillIds)
    || !isIds(character.equippedSkillIds)
    || !isRevision(currentMp)
    || (raceId !== null && !isId(raceId))
    || (dragonBreathElement !== null && dragonBreathElement !== "fire"
      && dragonBreathElement !== "ice" && dragonBreathElement !== "lightning")
    || (raceId !== "dragonborn" && dragonBreathElement !== null)
    || !isInventory(seed.inventory)
    || !isPartyMemberStates(partyMembers)
    || new Set(character.learnedActiveSkillIds).size !== character.learnedActiveSkillIds.length
    || loadoutError(character.learnedActiveSkillIds, character.equippedSkillIds)
    || (exploration.locationId !== "TEST-forest-edge" && exploration.locationId !== "TEST-ruin-entrance")
    || (exploration.lastObservationTargetId !== null
      && exploration.lastObservationTargetId !== "TEST-stone-door")) {
    throw new Error("初始 domain 狀態不符合契約。");
  }
  const lastAction = combat?.lastAction;
  if (lastAction?.type === "item-use"
    && seed.inventory.find((stack) => stack.itemId === lastAction.itemId)?.quantity !== lastAction.quantityAfter) {
    throw new Error("CombatState 最近物品行動與權威 inventory 數量不一致。");
  }
  if (lastAction?.type === "dragon-breath"
    && (raceId !== "dragonborn" || dragonBreathElement !== lastAction.element)) {
    throw new Error("CombatState 龍息裁定與角色權威資料不一致。");
  }
  return Object.freeze({
    revision: seed.revision,
    activity: seed.activity,
    character: Object.freeze({
      id: character.id,
      learnedActiveSkillIds: Object.freeze([...character.learnedActiveSkillIds]),
      equippedSkillIds: Object.freeze([...character.equippedSkillIds]),
      currentMp,
      raceId,
      dragonBreathElement,
    }),
    inventory: normalizeInventory(seed.inventory),
    partyMembers: Object.freeze(partyMembers.map((member) => Object.freeze({ ...member }))),
    exploration: Object.freeze({
      locationId: exploration.locationId,
      lastObservationTargetId: exploration.lastObservationTargetId,
    }),
    combat,
  });
}

export type CandidateRejectionCode = "invalid-candidate" | "clarification-required"
  | "unsupported-action" | "target-not-found" | "stale-revision";

export type CandidateValidationResult =
  | { readonly ok: true; readonly command: ApproachTargetCommand | InspectTargetCommand }
  | { readonly ok: false; readonly code: CandidateRejectionCode; readonly message: string };

const candidateMessages: Record<CandidateRejectionCode, string> = {
  "invalid-candidate": "候選行動格式不正確。",
  "clarification-required": "候選行動仍需玩家澄清。",
  "unsupported-action": "目前的權威探索規則尚未支援這項行動。",
  "target-not-found": "目前位置找不到可唯一對應的目標。",
  "stale-revision": "狀態已更新，請依最新狀態重新送出行動。",
};

function rejectCandidate(code: CandidateRejectionCode): CandidateValidationResult {
  return { ok: false, code, message: candidateMessages[code] };
}

function validCandidateText(value: unknown, nullable = false): boolean {
  return (nullable && value === null) || (typeof value === "string" && value.trim() === value
    && value.length > 0 && Array.from(value).length <= 500);
}

/** 把不可信 candidate 解析成有限的 domain command；自由文字永遠不直接成為 state ID。 */
export function validateCandidateAction(
  state: GameState,
  candidate: unknown,
  expectedRevision: unknown,
): CandidateValidationResult {
  if (!isRevision(expectedRevision) || !hasExactKeys(candidate,
    ["status", "kind", "target", "manner", "clarificationQuestion", "originalText"])
    || (candidate.status !== "candidate" && candidate.status !== "clarification-needed"
      && candidate.status !== "unsupported")
    || (candidate.kind !== "move" && candidate.kind !== "inspect" && candidate.kind !== "interact"
      && candidate.kind !== "speak" && candidate.kind !== "other")
    || !validCandidateText(candidate.target, true) || !validCandidateText(candidate.manner, true)
    || !validCandidateText(candidate.clarificationQuestion, true)
    || !validCandidateText(candidate.originalText)) return rejectCandidate("invalid-candidate");
  if (expectedRevision !== state.revision) return rejectCandidate("stale-revision");
  if (candidate.status === "clarification-needed") return candidate.clarificationQuestion === null
    ? rejectCandidate("invalid-candidate") : rejectCandidate("clarification-required");
  if (candidate.status === "unsupported") return candidate.kind === "other"
    && candidate.clarificationQuestion === null
    ? rejectCandidate("unsupported-action") : rejectCandidate("invalid-candidate");
  if (candidate.clarificationQuestion !== null) return rejectCandidate("invalid-candidate");
  if (candidate.kind === "move") {
    if (state.exploration.locationId === "TEST-forest-edge" && candidate.target === "森林裡的廢墟") {
      return { ok: true, command: { type: "approach-target", expectedRevision, targetId: "TEST-ruin-entrance" } };
    }
    return rejectCandidate("target-not-found");
  }
  if (candidate.kind === "inspect") {
    if (state.exploration.locationId === "TEST-ruin-entrance" && candidate.target === "門上的符號") {
      return { ok: true, command: { type: "inspect-target", expectedRevision, targetId: "TEST-stone-door" } };
    }
    return rejectCandidate("target-not-found");
  }
  return rejectCandidate("unsupported-action");
}

/** 純狀態轉換：無 I/O、不修改輸入。所有呼叫端都必須經過相同驗證。 */
export function applyCommand(state: GameState, input: unknown): CommandResult {
  const command = parseCommand(input);
  if (!command) return reject("invalid-command");
  if (command.expectedRevision !== state.revision) return reject("stale-revision");
  if (state.revision === Number.MAX_SAFE_INTEGER) return reject("revision-limit");
  if (state.activity === "in-combat") return reject("in-combat");
  if (command.type === "approach-target") {
    if (state.exploration.locationId !== "TEST-forest-edge") return reject("target-not-found");
    const next = createGameState({
      ...state, revision: state.revision + 1,
      exploration: { locationId: command.targetId, lastObservationTargetId: null },
    });
    return { ok: true, state: next, effect: { type: "location-changed", locationId: command.targetId } };
  }
  if (command.type === "inspect-target") {
    if (state.exploration.locationId !== "TEST-ruin-entrance") return reject("target-not-found");
    const next = createGameState({
      ...state, revision: state.revision + 1,
      exploration: { ...state.exploration, lastObservationTargetId: command.targetId },
    });
    return { ok: true, state: next, effect: { type: "target-inspected", targetId: command.targetId } };
  }
  const error = loadoutError(state.character.learnedActiveSkillIds, command.skillIds);
  if (error) return reject(error);
  const skillIds = [...command.skillIds];
  return {
    ok: true,
    state: createGameState({
      ...state,
      revision: state.revision + 1,
      character: { ...state.character, equippedSkillIds: skillIds },
    }),
    effect: { type: "equipped-skills-updated", skillIds },
  };
}
