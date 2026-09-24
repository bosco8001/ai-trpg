import {
  createCombatState,
  type CombatNormalAttackProfile,
  type CombatRow,
  type CombatSide,
  type CombatState,
  type NormalAttackActionResolution,
  type RowMoveActionResolution,
  type ItemUseActionResolution,
  type DefendActionResolution,
  type ActiveCombatState,
  type RunActionResolution,
  type PhysicalSkillActionResolution,
  type CombatParticipant,
} from "./combat-state.js";
import { isPlayerActionParticipant } from "./combat-state.js";
import { getActiveSkillDefinition } from "./physical-skills.js";
import { getCombatItemDefinition } from "./combat-items.js";
import {
  getNormalAttackTargetOptions,
  type NormalAttackTargetOptions,
  checkNormalAttackTarget,
  getLegalNormalAttackTargets,
} from "./combat-targeting.js";
import { createGameState, type GameState } from "./game.js";

export interface DiceRoller {
  d20(): number;
}

export interface CombatParticipantSeed {
  readonly id: string;
  readonly displayName: string;
  readonly side: CombatSide;
  readonly row: CombatRow;
  readonly dexterityModifier: number;
  readonly normalAttack: CombatNormalAttackProfile | null;
  readonly racialEscapeModifier?: 0 | -2;
}

export type CombatTransitionCode = "invalid-command" | "stale-revision" | "revision-limit"
  | "already-in-combat" | "not-in-combat" | "combat-ended" | "invalid-combat-setup";

export type CombatTransitionResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly effect: { readonly type: "combat-started" | "combat-turn-advanced" };
    }
  | { readonly ok: false; readonly code: CombatTransitionCode; readonly message: string };

export type NormalAttackCode = "invalid-command" | "stale-revision" | "revision-limit" | "not-in-combat"
  | "combat-ended" | "not-player-turn" | "illegal-target" | "invalid-roll";

export type RowMoveCode = "invalid-command" | "stale-revision" | "revision-limit" | "not-in-combat"
  | "combat-ended" | "not-player-turn" | "illegal-row-move";

export type NormalAttackResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly effect: { readonly type: "normal-attack-resolved"; readonly outcome: "hit" | "miss" };
    }
  | { readonly ok: false; readonly code: NormalAttackCode; readonly message: string };

export type NormalAttackOptionsResult =
  | { readonly ok: true; readonly revision: number; readonly options: NormalAttackTargetOptions }
  | { readonly ok: false; readonly code: "not-in-combat"; readonly message: string };

export interface RowMoveOptions {
  readonly currentActorId: string;
  readonly currentRow: CombatRow;
  readonly canPlayerAct: boolean;
  readonly legalTargetRows: readonly CombatRow[];
}

export type RowMoveOptionsResult =
  | { readonly ok: true; readonly revision: number; readonly options: RowMoveOptions }
  | { readonly ok: false; readonly code: "not-in-combat"; readonly message: string };

export type RowMoveResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly effect: { readonly type: "row-move-completed" };
    }
  | { readonly ok: false; readonly code: RowMoveCode; readonly message: string };

export type CombatItemUnavailableReason = "not-player-turn" | "quantity-depleted";

export interface CombatItemOption {
  readonly itemId: string;
  readonly displayName: string;
  readonly quantity: number;
  readonly usable: boolean;
  readonly unavailableReason?: CombatItemUnavailableReason;
}

export interface CombatItemOptions {
  readonly currentActorId: string;
  readonly items: readonly CombatItemOption[];
}

export type CombatItemOptionsResult =
  | { readonly ok: true; readonly revision: number; readonly options: CombatItemOptions }
  | { readonly ok: false; readonly code: "not-in-combat"; readonly message: string };

export type CombatItemUseCode = "invalid-command" | "stale-revision" | "revision-limit"
  | "not-in-combat" | "combat-ended" | "not-player-turn" | "unsupported-item" | "item-unavailable";

export type CombatItemUseResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly effect: { readonly type: "combat-item-used" };
    }
  | { readonly ok: false; readonly code: CombatItemUseCode; readonly message: string };

export type DefendCode = "invalid-command" | "stale-revision" | "revision-limit" | "not-in-combat" | "combat-ended" | "not-player-turn";

export type DefendResult =
  | { readonly ok: true; readonly state: GameState; readonly effect: { readonly type: "defend-completed" } }
  | { readonly ok: false; readonly code: DefendCode; readonly message: string };

export type RunCode = "invalid-command" | "stale-revision" | "revision-limit" | "not-in-combat"
  | "combat-ended" | "not-player-turn" | "invalid-roll";

export type RunResult =
  | { readonly ok: true; readonly state: GameState; readonly effect: { readonly type: "run-resolved"; readonly outcome: "success" | "failure" } }
  | { readonly ok: false; readonly code: RunCode; readonly message: string };

export type PhysicalSkillCode = "invalid-command" | "stale-revision" | "revision-limit" | "not-in-combat"
  | "combat-ended" | "not-player-turn" | "unknown-skill" | "not-physical-skill"
  | "skill-not-learned" | "skill-not-equipped" | "skill-on-cooldown" | "illegal-target" | "invalid-roll";

export interface PhysicalSkillOption {
  readonly skillId: string;
  readonly displayName: string;
  readonly category: "physical-active";
  readonly targetMode: "single-enemy";
  readonly range: "melee" | "ranged";
  readonly usable: boolean;
  readonly unavailableReason?: "not-player-turn" | "skill-on-cooldown" | "no-legal-target";
  readonly readyRound: number | null;
  readonly targets: NormalAttackTargetOptions["targets"];
}

export type PhysicalSkillOptionsResult =
  | { readonly ok: true; readonly revision: number; readonly options: {
    readonly currentActorId: string; readonly skills: readonly PhysicalSkillOption[];
  } }
  | { readonly ok: false; readonly code: "not-in-combat"; readonly message: string };

export type PhysicalSkillUseResult =
  | { readonly ok: true; readonly state: GameState; readonly effect: {
    readonly type: "physical-skill-resolved"; readonly outcome: "hit" | "miss";
  } }
  | { readonly ok: false; readonly code: PhysicalSkillCode; readonly message: string };

const physicalSkillMessages: Record<PhysicalSkillCode, string> = {
  "invalid-command": "物理技能請求格式不正確。",
  "stale-revision": "戰鬥狀態已更新，請重新讀取後再使用技能。",
  "revision-limit": "狀態版本已達工程上限，無法使用技能。",
  "not-in-combat": "目前沒有進行中的戰鬥。",
  "combat-ended": "戰鬥已結束，不能再執行行動。",
  "not-player-turn": "目前不是可操作角色的回合。",
  "unknown-skill": "找不到這個技能定義。",
  "not-physical-skill": "這不是目前支援的物理主動技能。",
  "skill-not-learned": "角色尚未學會這個技能。",
  "skill-not-equipped": "這個技能尚未裝備。",
  "skill-on-cooldown": "技能仍在冷卻中。",
  "illegal-target": "目前無法合法指定這名目標。",
  "invalid-roll": "物理攻擊骰子服務暫時無法使用。",
};

function rejectPhysicalSkill(code: PhysicalSkillCode): PhysicalSkillUseResult {
  return { ok: false, code, message: physicalSkillMessages[code] };
}

const runMessages: Record<RunCode, string> = {
  "invalid-command": "逃跑請求格式不正確。",
  "stale-revision": "戰鬥狀態已更新，請重新讀取後再逃跑。",
  "revision-limit": "狀態版本已達工程上限，無法嘗試逃跑。",
  "not-in-combat": "目前沒有進行中的戰鬥。",
  "combat-ended": "戰鬥已結束，不能再執行行動。",
  "not-player-turn": "目前不是可操作角色的回合。",
  "invalid-roll": "逃跑骰子服務暫時無法使用。",
};

function rejectRun(code: RunCode): RunResult {
  return { ok: false, code, message: runMessages[code] };
}

const defendMessages: Record<DefendCode, string> = {
  "invalid-command": "防禦請求格式不正確。",
  "stale-revision": "戰鬥狀態已更新，請重新讀取後再防禦。",
  "revision-limit": "狀態版本已達工程上限，無法執行防禦。",
  "not-in-combat": "目前沒有進行中的戰鬥。",
  "combat-ended": "戰鬥已結束，不能再執行行動。",
  "not-player-turn": "目前不是可操作角色的回合。",
};

function rejectDefend(code: DefendCode): DefendResult {
  return { ok: false, code, message: defendMessages[code] };
}

const itemUseMessages: Record<CombatItemUseCode, string> = {
  "invalid-command": "物品使用請求格式不正確。",
  "stale-revision": "戰鬥狀態已更新，請重新讀取後再使用物品。",
  "revision-limit": "狀態版本已達工程上限，無法使用物品。",
  "not-in-combat": "目前沒有進行中的戰鬥。",
  "combat-ended": "戰鬥已結束，不能再執行行動。",
  "not-player-turn": "目前不是可操作角色的回合。",
  "unsupported-item": "目前不支援使用這件物品。",
  "item-unavailable": "這件物品目前沒有可使用的數量。",
};

function rejectItemUse(code: CombatItemUseCode): CombatItemUseResult {
  return { ok: false, code, message: itemUseMessages[code] };
}

interface MutableInitiative extends CombatParticipantSeed {
  readonly baseD20: number;
  readonly total: number;
  readonly tieBreakRolls: number[];
}

const messages: Record<CombatTransitionCode, string> = {
  "invalid-command": "戰鬥命令格式不正確。",
  "stale-revision": "狀態已更新，請重新讀取後再操作戰鬥回合。",
  "revision-limit": "狀態版本已達工程上限，無法更新戰鬥回合。",
  "already-in-combat": "目前已有進行中的戰鬥。",
  "not-in-combat": "目前沒有進行中的戰鬥。",
  "combat-ended": "戰鬥已結束，不能再推進回合。",
  "invalid-combat-setup": "TEST 戰鬥設定或骰子結果不符合規則。",
};

const attackMessages: Record<NormalAttackCode, string> = {
  "invalid-command": "普通攻擊請求格式不正確。",
  "stale-revision": "戰鬥狀態已更新，請重新讀取後再攻擊。",
  "revision-limit": "狀態版本已達工程上限，無法執行普通攻擊。",
  "not-in-combat": "目前沒有進行中的戰鬥。",
  "combat-ended": "戰鬥已結束，不能再執行行動。",
  "not-player-turn": "目前不是玩家可行動的回合。",
  "illegal-target": "目前無法合法指定這名目標。",
  "invalid-roll": "普通攻擊骰子服務暫時無法使用。",
};

const rowMoveMessages: Record<RowMoveCode, string> = {
  "invalid-command": "移動請求格式不正確。",
  "stale-revision": "戰鬥狀態已更新，請重新讀取後再移動。",
  "revision-limit": "狀態版本已達工程上限，無法執行移動。",
  "not-in-combat": "目前沒有進行中的戰鬥。",
  "combat-ended": "戰鬥已結束，不能再執行行動。",
  "not-player-turn": "目前不是玩家可行動的回合。",
  "illegal-row-move": "目前無法移至所選排位。",
};

function reject(code: CombatTransitionCode): CombatTransitionResult {
  return { ok: false, code, message: messages[code] };
}

function rejectAttack(code: NormalAttackCode): NormalAttackResult {
  return { ok: false, code, message: attackMessages[code] };
}

function rejectRowMove(code: RowMoveCode): RowMoveResult {
  return { ok: false, code, message: rowMoveMessages[code] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseExpectedRevision(value: unknown): number | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, "expectedRevision")
    || typeof value.expectedRevision !== "number" || !Number.isSafeInteger(value.expectedRevision)
    || value.expectedRevision < 0) return undefined;
  return value.expectedRevision;
}

function parseNormalAttackCommand(value: unknown): { readonly expectedRevision: number; readonly targetId: string } | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 2
    || !Object.hasOwn(value, "expectedRevision") || !Object.hasOwn(value, "targetId")
    || typeof value.expectedRevision !== "number" || !Number.isSafeInteger(value.expectedRevision)
    || value.expectedRevision < 0 || typeof value.targetId !== "string"
    || value.targetId.length === 0 || value.targetId.trim() !== value.targetId) return undefined;
  return { expectedRevision: value.expectedRevision, targetId: value.targetId };
}

function parseRowMoveCommand(value: unknown): { readonly expectedRevision: number; readonly targetRow: CombatRow } | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 2
    || !Object.hasOwn(value, "expectedRevision") || !Object.hasOwn(value, "targetRow")
    || typeof value.expectedRevision !== "number" || !Number.isSafeInteger(value.expectedRevision)
    || value.expectedRevision < 0 || (value.targetRow !== "front" && value.targetRow !== "back")) return undefined;
  return { expectedRevision: value.expectedRevision, targetRow: value.targetRow };
}

function parseItemUseCommand(value: unknown): { readonly expectedRevision: number; readonly itemId: string } | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 2
    || !Object.hasOwn(value, "expectedRevision") || !Object.hasOwn(value, "itemId")
    || typeof value.expectedRevision !== "number" || !Number.isSafeInteger(value.expectedRevision)
    || value.expectedRevision < 0 || typeof value.itemId !== "string"
    || value.itemId.length === 0 || value.itemId.trim() !== value.itemId) return undefined;
  return { expectedRevision: value.expectedRevision, itemId: value.itemId };
}

function parsePhysicalSkillCommand(value: unknown): {
  readonly expectedRevision: number; readonly skillId: string; readonly targetId: string;
} | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 3
    || !Object.hasOwn(value, "expectedRevision") || !Object.hasOwn(value, "skillId")
    || !Object.hasOwn(value, "targetId")
    || typeof value.expectedRevision !== "number" || !Number.isSafeInteger(value.expectedRevision)
    || value.expectedRevision < 0 || typeof value.skillId !== "string"
    || !value.skillId.length || value.skillId.trim() !== value.skillId
    || typeof value.targetId !== "string" || !value.targetId.length
    || value.targetId.trim() !== value.targetId) return undefined;
  return { expectedRevision: value.expectedRevision, skillId: value.skillId, targetId: value.targetId };
}

function advanceToNextTurn(combat: ActiveCombatState): ActiveCombatState {
  const wrapsRound = combat.currentTurnIndex === combat.turnOrder.length - 1;
  const currentTurnIndex = wrapsRound ? 0 : combat.currentTurnIndex + 1;
  return createCombatState({
    ...combat,
    round: wrapsRound ? combat.round + 1 : combat.round,
    currentTurnIndex,
    currentActorId: combat.turnOrder[currentTurnIndex],
  }) as ActiveCombatState;
}

function rollD20(roller: DiceRoller): number {
  const result = roller.d20();
  if (!Number.isSafeInteger(result) || result < 1 || result > 20) {
    throw new Error("D20 必須回傳 1 至 20 的整數。");
  }
  return result;
}

function validateSeeds(seeds: readonly CombatParticipantSeed[]): void {
  if (seeds.length === 0 || new Set(seeds.map((seed) => seed.id)).size !== seeds.length) {
    throw new Error("戰鬥參與者不得為空或重複。");
  }
  for (const seed of seeds) {
    if (typeof seed.id !== "string" || seed.id.trim() !== seed.id || seed.id.length === 0
      || typeof seed.displayName !== "string" || seed.displayName.trim() !== seed.displayName
      || seed.displayName.length === 0 || (seed.side !== "party" && seed.side !== "enemy")
      || (seed.row !== "front" && seed.row !== "back")
      || !Number.isSafeInteger(seed.dexterityModifier)
      || (seed.racialEscapeModifier !== undefined && seed.racialEscapeModifier !== 0 && seed.racialEscapeModifier !== -2)
      || (seed.normalAttack !== null && (typeof seed.normalAttack !== "object"
        || (seed.normalAttack.range !== "melee" && seed.normalAttack.range !== "ranged")
        || !Number.isSafeInteger(seed.normalAttack.perceptionModifier)
        || !Number.isSafeInteger(seed.normalAttack.weaponMainStatModifier)
        || !Number.isSafeInteger(seed.normalAttack.proficiencyModifier)))) {
      throw new Error("戰鬥參與者設定不正確。");
    }
  }
}

/** 只讓仍同點的小組重擲；不使用 ID、字母或插入順序打破平手。 */
function resolveTieGroup(
  group: readonly MutableInitiative[],
  roller: DiceRoller,
  rerollBudget: { remaining: number },
): MutableInitiative[] {
  if (group.length < 2) return [...group];
  if (rerollBudget.remaining <= 0) throw new Error("平手重擲超出工程安全上限。");
  rerollBudget.remaining -= 1;
  const byRoll = new Map<number, MutableInitiative[]>();
  for (const participant of group) {
    const roll = rollD20(roller);
    participant.tieBreakRolls.push(roll);
    const tied = byRoll.get(roll) ?? [];
    tied.push(participant);
    byRoll.set(roll, tied);
  }
  return [...byRoll.keys()].sort((a, b) => b - a).flatMap((roll) => {
    const tied = byRoll.get(roll)!;
    return tied.length === 1 ? tied : resolveTieGroup(tied, roller, rerollBudget);
  });
}

export function rollInitiative(
  seeds: readonly CombatParticipantSeed[],
  roller: DiceRoller,
): CombatState {
  validateSeeds(seeds);
  const initiatives: MutableInitiative[] = seeds.map((seed) => {
    const baseD20 = rollD20(roller);
    return {
      ...seed,
      baseD20,
      total: baseD20 + seed.dexterityModifier,
      tieBreakRolls: [],
    };
  });
  const byTotal = new Map<number, MutableInitiative[]>();
  for (const initiative of initiatives) {
    const group = byTotal.get(initiative.total) ?? [];
    group.push(initiative);
    byTotal.set(initiative.total, group);
  }
  const rerollBudget = { remaining: 1_000 };
  const ordered = [...byTotal.keys()].sort((a, b) => b - a).flatMap((total) => {
    const group = byTotal.get(total)!;
    return group.length === 1 ? group : resolveTieGroup(group, roller, rerollBudget);
  });
  return createCombatState({
    status: "active",
    endReason: null,
    round: 1,
    currentTurnIndex: 0,
    currentActorId: ordered[0]!.id,
    turnOrder: ordered.map((participant) => participant.id),
    participants: initiatives.map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      side: participant.side,
      row: participant.row,
      initiative: {
        baseD20: participant.baseD20,
        dexterityModifier: participant.dexterityModifier,
        total: participant.total,
        tieBreakRolls: participant.tieBreakRolls,
      },
      normalAttack: participant.normalAttack,
      racialEscapeModifier: participant.racialEscapeModifier ?? 0,
    })),
    lastAction: null,
    skillCooldowns: [],
  });
}

/** Phase 13 的同一組 physical Attack／Evasion 裁定，供普通攻擊及物理技能呼叫。 */
export function resolvePhysicalAttackCheck(
  profile: CombatNormalAttackProfile,
  target: CombatParticipant,
  roller: DiceRoller,
): Pick<NormalAttackActionResolution, "attack" | "evasion" | "outcome"> {
  const attackD20 = rollD20(roller);
  const evasionD20 = rollD20(roller);
  const attackTotal = attackD20 + profile.perceptionModifier
    + profile.weaponMainStatModifier + profile.proficiencyModifier;
  const evasionModifier = target.initiative.dexterityModifier;
  const evasionTotal = evasionD20 + evasionModifier;
  return Object.freeze({
    attack: Object.freeze({
      rawD20: attackD20, perceptionModifier: profile.perceptionModifier,
      weaponMainStatModifier: profile.weaponMainStatModifier,
      proficiencyModifier: profile.proficiencyModifier, total: attackTotal,
    }),
    evasion: Object.freeze({ rawD20: evasionD20, dexterityModifier: evasionModifier, total: evasionTotal }),
    outcome: attackTotal >= evasionTotal ? "hit" : "miss",
  });
}

/** 已裝備技能的 server-derived 可用性，沒有寫入 GameState。 */
export function getCurrentPhysicalSkillOptions(state: GameState): PhysicalSkillOptionsResult {
  if (state.activity !== "in-combat" || state.combat === null || state.combat.status === "ended") {
    return { ok: false, code: "not-in-combat", message: physicalSkillMessages["not-in-combat"] };
  }
  const combat = state.combat;
  const actor = combat.participants.find((participant) => participant.id === combat.currentActorId);
  if (!actor) return { ok: false, code: "not-in-combat", message: physicalSkillMessages["not-in-combat"] };
  const canPlayerAct = isPlayerActionParticipant(actor);
  const skills: PhysicalSkillOption[] = state.character.equippedSkillIds.flatMap((skillId) => {
    const definition = getActiveSkillDefinition(skillId);
    if (!definition || definition.category !== "physical-active"
      || !state.character.learnedActiveSkillIds.includes(skillId)) return [];
    const readyRound = combat.skillCooldowns.find((entry) => entry.actorId === actor.id
      && entry.skillId === skillId)?.readyRound ?? null;
    const targets: NormalAttackTargetOptions["targets"] = canPlayerAct
      ? combat.participants.filter((participant) => participant.side !== actor.side).map((participant) => {
        const check = checkNormalAttackTarget(combat, actor, participant.id, definition.range);
        return check.legal
          ? { targetId: participant.id, displayName: participant.displayName, legal: true }
          : { targetId: participant.id, displayName: participant.displayName, legal: false,
            ...(check.reason === "front-row-blocked" ? { reason: check.reason } : {}) };
      }) : [];
    const unavailableReason = !canPlayerAct ? "not-player-turn"
      : readyRound !== null && combat.round < readyRound ? "skill-on-cooldown"
        : !targets.some((target) => target.legal) ? "no-legal-target" : undefined;
    return [Object.freeze({
      skillId, displayName: definition.displayName, category: "physical-active" as const,
      targetMode: definition.targetType, range: definition.range,
      usable: unavailableReason === undefined,
      ...(unavailableReason ? { unavailableReason } : {}), readyRound,
      targets: Object.freeze(targets),
    })];
  });
  return { ok: true, revision: state.revision, options: Object.freeze({
    currentActorId: actor.id, skills: Object.freeze(skills),
  }) };
}

/** 驗證完成後才擲骰；命中與落空都進冷卻、消耗 Turn。 */
export function usePhysicalSkill(state: GameState, input: unknown, roller: DiceRoller): PhysicalSkillUseResult {
  const command = parsePhysicalSkillCommand(input);
  if (!command) return rejectPhysicalSkill("invalid-command");
  if (command.expectedRevision !== state.revision) return rejectPhysicalSkill("stale-revision");
  if (state.revision === Number.MAX_SAFE_INTEGER) return rejectPhysicalSkill("revision-limit");
  if (state.activity !== "in-combat" || state.combat === null) return rejectPhysicalSkill("not-in-combat");
  if (state.combat.status === "ended") return rejectPhysicalSkill("combat-ended");
  const combat = state.combat;
  const actor = combat.participants.find((participant) => participant.id === combat.currentActorId);
  if (!actor || !isPlayerActionParticipant(actor)) return rejectPhysicalSkill("not-player-turn");
  const definition = getActiveSkillDefinition(command.skillId);
  if (!definition) return rejectPhysicalSkill("unknown-skill");
  if (definition.category !== "physical-active") return rejectPhysicalSkill("not-physical-skill");
  if (!state.character.learnedActiveSkillIds.includes(command.skillId)) return rejectPhysicalSkill("skill-not-learned");
  if (!state.character.equippedSkillIds.includes(command.skillId)) return rejectPhysicalSkill("skill-not-equipped");
  const previous = combat.skillCooldowns.find((entry) => entry.actorId === actor.id && entry.skillId === command.skillId);
  if (previous && combat.round < previous.readyRound) return rejectPhysicalSkill("skill-on-cooldown");
  const target = combat.participants.find((participant) => participant.id === command.targetId);
  if (!target || !checkNormalAttackTarget(combat, actor, target.id, definition.range).legal
    || !getLegalNormalAttackTargets(combat, actor.id, definition.range).includes(target.id)) {
    return rejectPhysicalSkill("illegal-target");
  }
  let check: ReturnType<typeof resolvePhysicalAttackCheck>;
  try { check = resolvePhysicalAttackCheck(actor.normalAttack, target, roller); }
  catch { return rejectPhysicalSkill("invalid-roll"); }
  const readyRound = combat.round + 2;
  if (!Number.isSafeInteger(readyRound)) return rejectPhysicalSkill("revision-limit");
  const lastAction: PhysicalSkillActionResolution = Object.freeze({
    type: "physical-skill", actorId: actor.id, round: combat.round,
    skillId: command.skillId, targetId: target.id, readyRound, ...check,
  });
  const skillCooldowns = [
    ...combat.skillCooldowns.filter((entry) => entry.actorId !== actor.id || entry.skillId !== command.skillId),
    { actorId: actor.id, skillId: command.skillId, readyRound },
  ];
  const nextCombat = createCombatState({ ...advanceToNextTurn(combat), skillCooldowns, lastAction });
  return { ok: true, state: createGameState({ ...state, revision: state.revision + 1, combat: nextCombat }),
    effect: { type: "physical-skill-resolved", outcome: check.outcome } };
}

export function startCombat(
  state: GameState,
  input: unknown,
  participants: readonly CombatParticipantSeed[],
  roller: DiceRoller,
): CombatTransitionResult {
  const expectedRevision = parseExpectedRevision(input);
  if (expectedRevision === undefined) return reject("invalid-command");
  if (expectedRevision !== state.revision) return reject("stale-revision");
  if (state.revision === Number.MAX_SAFE_INTEGER) return reject("revision-limit");
  if (state.activity === "in-combat" || state.combat !== null) return reject("already-in-combat");
  try {
    const combat = rollInitiative(participants, roller);
    return {
      ok: true,
      state: createGameState({
        ...state,
        revision: state.revision + 1,
        activity: "in-combat",
        combat,
      }),
      effect: { type: "combat-started" },
    };
  } catch {
    return reject("invalid-combat-setup");
  }
}

export function advanceCombatTurn(state: GameState, input: unknown): CombatTransitionResult {
  const expectedRevision = parseExpectedRevision(input);
  if (expectedRevision === undefined) return reject("invalid-command");
  if (expectedRevision !== state.revision) return reject("stale-revision");
  if (state.revision === Number.MAX_SAFE_INTEGER) return reject("revision-limit");
  if (state.activity !== "in-combat" || state.combat === null) return reject("not-in-combat");
  if (state.combat.status === "ended") return reject("combat-ended");
  const combat = advanceToNextTurn(state.combat);
  return {
    ok: true,
    state: createGameState({ ...state, revision: state.revision + 1, combat }),
    effect: { type: "combat-turn-advanced" },
  };
}

export function getCurrentNormalAttackOptions(state: GameState): NormalAttackOptionsResult {
  if (state.activity !== "in-combat" || state.combat === null || state.combat.status === "ended") {
    return { ok: false, code: "not-in-combat", message: attackMessages["not-in-combat"] };
  }
  return {
    ok: true,
    revision: state.revision,
    options: getNormalAttackTargetOptions(state.combat),
  };
}

/** Builds row movement options from the latest authoritative combat snapshot. */
export function getCurrentRowMoveOptions(state: GameState): RowMoveOptionsResult {
  if (state.activity !== "in-combat" || state.combat === null || state.combat.status === "ended") {
    return { ok: false, code: "not-in-combat", message: rowMoveMessages["not-in-combat"] };
  }
  const combat = state.combat;
  const actor = combat.participants.find((participant) => participant.id === combat.currentActorId);
  if (!actor) return { ok: false, code: "not-in-combat", message: rowMoveMessages["not-in-combat"] };
  const canPlayerAct = isPlayerActionParticipant(actor);
  const legalTargetRows: readonly CombatRow[] = canPlayerAct
    ? [actor.row === "front" ? "back" : "front"]
    : [];
  return {
    ok: true,
    revision: state.revision,
    options: Object.freeze({
      currentActorId: actor.id,
      currentRow: actor.row,
      canPlayerAct,
      legalTargetRows: Object.freeze([...legalTargetRows]),
    }),
  };
}

/** Derived inventory usability for the current combat actor; this never changes GameState. */
export function getCurrentCombatItemOptions(state: GameState): CombatItemOptionsResult {
  if (state.activity !== "in-combat" || state.combat === null || state.combat.status === "ended") {
    return { ok: false, code: "not-in-combat", message: itemUseMessages["not-in-combat"] };
  }
  const combat = state.combat;
  const actor = combat.participants.find((participant) => participant.id === combat.currentActorId);
  if (!actor) return { ok: false, code: "not-in-combat", message: itemUseMessages["not-in-combat"] };
  const canPlayerAct = isPlayerActionParticipant(actor);
  const items = state.inventory.flatMap((stack): CombatItemOption[] => {
    const definition = getCombatItemDefinition(stack.itemId);
    if (!definition || !definition.consumable || definition.usage !== "self") return [];
    const unavailableReason: CombatItemUnavailableReason | undefined = !canPlayerAct
      ? "not-player-turn"
      : stack.quantity === 0 ? "quantity-depleted" : undefined;
    return [Object.freeze({
      itemId: definition.itemId,
      displayName: definition.displayName,
      quantity: stack.quantity,
      usable: unavailableReason === undefined,
      ...(unavailableReason ? { unavailableReason } : {}),
    })];
  });
  return {
    ok: true,
    revision: state.revision,
    options: Object.freeze({ currentActorId: actor.id, items: Object.freeze(items) }),
  };
}

/** Consumes one supported self-use item and the full current Turn in one state transition. */
export function useCombatItem(state: GameState, input: unknown): CombatItemUseResult {
  const command = parseItemUseCommand(input);
  if (!command) return rejectItemUse("invalid-command");
  if (command.expectedRevision !== state.revision) return rejectItemUse("stale-revision");
  if (state.revision === Number.MAX_SAFE_INTEGER) return rejectItemUse("revision-limit");
  if (state.activity !== "in-combat" || state.combat === null) return rejectItemUse("not-in-combat");
  if (state.combat.status === "ended") return rejectItemUse("combat-ended");

  const combat = state.combat;
  const actor = combat.participants.find((participant) => participant.id === combat.currentActorId);
  if (!actor || !isPlayerActionParticipant(actor)) return rejectItemUse("not-player-turn");
  const definition = getCombatItemDefinition(command.itemId);
  if (!definition || !definition.consumable || definition.usage !== "self") {
    return rejectItemUse("unsupported-item");
  }
  const stack = state.inventory.find((entry) => entry.itemId === definition.itemId);
  if (!stack || stack.quantity <= 0) return rejectItemUse("item-unavailable");

  const quantityAfter = stack.quantity - 1;
  const inventory = state.inventory.map((entry) => entry.itemId === stack.itemId
    ? { ...entry, quantity: quantityAfter }
    : entry);
  const lastAction: ItemUseActionResolution = Object.freeze({
    type: "item-use",
    actorId: actor.id,
    round: combat.round,
    itemId: definition.itemId,
    quantityBefore: stack.quantity,
    quantityAfter,
  });
  const nextCombat = createCombatState({ ...advanceToNextTurn(combat), lastAction });
  return {
    ok: true,
    state: createGameState({ ...state, revision: state.revision + 1, inventory, combat: nextCombat }),
    effect: { type: "combat-item-used" },
  };
}

/** Records the action and consumes one full Turn; damage effects remain unresolved. */
export function defendCombatTurn(state: GameState, input: unknown): DefendResult {
  const expectedRevision = parseExpectedRevision(input);
  if (expectedRevision === undefined) return rejectDefend("invalid-command");
  if (expectedRevision !== state.revision) return rejectDefend("stale-revision");
  if (state.revision === Number.MAX_SAFE_INTEGER) return rejectDefend("revision-limit");
  if (state.activity !== "in-combat" || state.combat === null) return rejectDefend("not-in-combat");
  if (state.combat.status === "ended") return rejectDefend("combat-ended");

  const combat = state.combat;
  const actor = combat.participants.find((participant) => participant.id === combat.currentActorId);
  if (!actor || !isPlayerActionParticipant(actor)) return rejectDefend("not-player-turn");
  const lastAction: DefendActionResolution = Object.freeze({
    type: "defend", actorId: actor.id, round: combat.round,
  });
  const nextCombat = createCombatState({ ...advanceToNextTurn(combat), lastAction });
  return {
    ok: true,
    state: createGameState({ ...state, revision: state.revision + 1, combat: nextCombat }),
    effect: { type: "defend-completed" },
  };
}

export const GENERAL_ESCAPE_DC = 8;

/** Canonical v1 check; racial modifier is fixed when the participant enters combat. */
export function resolveEscapeCheck(rawD20: number, dexterityModifier: number, racialModifier: 0 | -2):
  Pick<RunActionResolution, "rawD20" | "dexterityModifier" | "racialModifier" | "total" | "dc" | "outcome"> {
  if (!Number.isSafeInteger(rawD20) || rawD20 < 1 || rawD20 > 20
    || !Number.isSafeInteger(dexterityModifier)
    || (racialModifier !== 0 && racialModifier !== -2)) throw new Error("逃跑判定資料不正確。");
  const total = rawD20 + dexterityModifier + racialModifier;
  if (!Number.isSafeInteger(total)) throw new Error("逃跑判定總值超出安全範圍。");
  return Object.freeze({
    rawD20, dexterityModifier, racialModifier, total, dc: GENERAL_ESCAPE_DC,
    outcome: total >= GENERAL_ESCAPE_DC ? "success" : "failure",
  });
}

/** One Run consumes one action; success ends combat without selecting another actor. */
export function runFromCombat(state: GameState, input: unknown, roller: DiceRoller): RunResult {
  const expectedRevision = parseExpectedRevision(input);
  if (expectedRevision === undefined) return rejectRun("invalid-command");
  if (expectedRevision !== state.revision) return rejectRun("stale-revision");
  if (state.revision === Number.MAX_SAFE_INTEGER) return rejectRun("revision-limit");
  if (state.activity !== "in-combat" || state.combat === null) return rejectRun("not-in-combat");
  if (state.combat.status === "ended") return rejectRun("combat-ended");
  const combat = state.combat;
  const actor = combat.participants.find((participant) => participant.id === combat.currentActorId);
  if (!actor || !isPlayerActionParticipant(actor)) return rejectRun("not-player-turn");
  let check: ReturnType<typeof resolveEscapeCheck>;
  try {
    check = resolveEscapeCheck(rollD20(roller), actor.initiative.dexterityModifier,
      actor.racialEscapeModifier);
  } catch {
    return rejectRun("invalid-roll");
  }
  const lastAction: RunActionResolution = Object.freeze({
    type: "run", actorId: actor.id, round: combat.round, ...check,
  });
  const nextCombat = check.outcome === "success"
    ? createCombatState({
      ...combat, status: "ended", endReason: "escaped", currentTurnIndex: null,
      currentActorId: null, lastAction,
    })
    : createCombatState({ ...advanceToNextTurn(combat), lastAction });
  return {
    ok: true,
    state: createGameState({ ...state, revision: state.revision + 1, combat: nextCombat }),
    effect: { type: "run-resolved", outcome: check.outcome },
  };
}

/** One deterministic row change, Turn consumption and revision are one transition. */
export function moveCombatRow(state: GameState, input: unknown): RowMoveResult {
  const command = parseRowMoveCommand(input);
  if (!command) return rejectRowMove("invalid-command");
  if (command.expectedRevision !== state.revision) return rejectRowMove("stale-revision");
  if (state.revision === Number.MAX_SAFE_INTEGER) return rejectRowMove("revision-limit");
  if (state.activity !== "in-combat" || state.combat === null) return rejectRowMove("not-in-combat");
  if (state.combat.status === "ended") return rejectRowMove("combat-ended");

  const combat = state.combat;
  const actor = combat.participants.find((participant) => participant.id === combat.currentActorId);
  if (!actor || !isPlayerActionParticipant(actor)) return rejectRowMove("not-player-turn");
  const options = getCurrentRowMoveOptions(state);
  if (!options.ok || !options.options.legalTargetRows.includes(command.targetRow)) {
    return rejectRowMove("illegal-row-move");
  }

  const lastAction: RowMoveActionResolution = Object.freeze({
    type: "row-move",
    actorId: actor.id,
    round: combat.round,
    fromRow: actor.row,
    toRow: command.targetRow,
  });
  const movedCombat = createCombatState({
    ...combat,
    participants: combat.participants.map((participant) => participant.id === actor.id
      ? { ...participant, row: command.targetRow }
      : participant),
    lastAction,
  });
  const nextCombat = advanceToNextTurn(movedCombat as ActiveCombatState);
  return {
    ok: true,
    state: createGameState({ ...state, revision: state.revision + 1, combat: nextCombat }),
    effect: { type: "row-move-completed" },
  };
}

/** One attack, its checks, saved result, turn consumption and revision are one transition. */
export function resolveNormalAttack(
  state: GameState,
  input: unknown,
  roller: DiceRoller,
): NormalAttackResult {
  const command = parseNormalAttackCommand(input);
  if (!command) return rejectAttack("invalid-command");
  if (command.expectedRevision !== state.revision) return rejectAttack("stale-revision");
  if (state.revision === Number.MAX_SAFE_INTEGER) return rejectAttack("revision-limit");
  if (state.activity !== "in-combat" || state.combat === null) return rejectAttack("not-in-combat");
  if (state.combat.status === "ended") return rejectAttack("combat-ended");

  const combat = state.combat;
  const attacker = combat.participants.find((participant) => participant.id === combat.currentActorId);
  if (!attacker || !isPlayerActionParticipant(attacker)) {
    return rejectAttack("not-player-turn");
  }
  const target = combat.participants.find((participant) => participant.id === command.targetId);
  if (!target || !checkNormalAttackTarget(combat, attacker, target.id, attacker.normalAttack.range).legal
    || !getLegalNormalAttackTargets(combat, attacker.id, attacker.normalAttack.range).includes(target.id)) {
    return rejectAttack("illegal-target");
  }

  let check: ReturnType<typeof resolvePhysicalAttackCheck>;
  try {
    check = resolvePhysicalAttackCheck(attacker.normalAttack, target, roller);
  } catch {
    return rejectAttack("invalid-roll");
  }
  const lastAction: NormalAttackActionResolution = Object.freeze({
    type: "normal-attack",
    round: combat.round,
    actorId: attacker.id,
    targetId: target.id,
    ...check,
  });
  const nextCombat = createCombatState({ ...advanceToNextTurn(combat), lastAction });
  return {
    ok: true,
    state: createGameState({ ...state, revision: state.revision + 1, combat: nextCombat }),
    effect: { type: "normal-attack-resolved", outcome: check.outcome },
  };
}
