import {
  createCombatState,
  type CombatNormalAttackProfile,
  type CombatRow,
  type CombatSide,
  type CombatState,
  type NormalAttackActionResolution,
} from "./combat-state.js";
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
}

export type CombatTransitionCode = "invalid-command" | "stale-revision" | "revision-limit"
  | "already-in-combat" | "not-in-combat" | "invalid-combat-setup";

export type CombatTransitionResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly effect: { readonly type: "combat-started" | "combat-turn-advanced" };
    }
  | { readonly ok: false; readonly code: CombatTransitionCode; readonly message: string };

export type NormalAttackCode = "invalid-command" | "stale-revision" | "revision-limit" | "not-in-combat"
  | "not-player-turn" | "illegal-target" | "invalid-roll";

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
  "invalid-combat-setup": "TEST 戰鬥設定或骰子結果不符合規則。",
};

const attackMessages: Record<NormalAttackCode, string> = {
  "invalid-command": "普通攻擊請求格式不正確。",
  "stale-revision": "戰鬥狀態已更新，請重新讀取後再攻擊。",
  "revision-limit": "狀態版本已達工程上限，無法執行普通攻擊。",
  "not-in-combat": "目前沒有進行中的戰鬥。",
  "not-player-turn": "目前不是玩家可行動的回合。",
  "illegal-target": "目前無法合法指定這名目標。",
  "invalid-roll": "普通攻擊骰子服務暫時無法使用。",
};

function reject(code: CombatTransitionCode): CombatTransitionResult {
  return { ok: false, code, message: messages[code] };
}

function rejectAttack(code: NormalAttackCode): NormalAttackResult {
  return { ok: false, code, message: attackMessages[code] };
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
    })),
    lastAction: null,
  });
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
  const wrapsRound = state.combat.currentTurnIndex === state.combat.turnOrder.length - 1;
  const currentTurnIndex = wrapsRound ? 0 : state.combat.currentTurnIndex + 1;
  const combat = createCombatState({
    ...state.combat,
    round: wrapsRound ? state.combat.round + 1 : state.combat.round,
    currentTurnIndex,
    currentActorId: state.combat.turnOrder[currentTurnIndex],
  });
  return {
    ok: true,
    state: createGameState({ ...state, revision: state.revision + 1, combat }),
    effect: { type: "combat-turn-advanced" },
  };
}

export function getCurrentNormalAttackOptions(state: GameState): NormalAttackOptionsResult {
  if (state.activity !== "in-combat" || state.combat === null) {
    return { ok: false, code: "not-in-combat", message: attackMessages["not-in-combat"] };
  }
  return {
    ok: true,
    revision: state.revision,
    options: getNormalAttackTargetOptions(state.combat),
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

  const combat = state.combat;
  const attacker = combat.participants.find((participant) => participant.id === combat.currentActorId);
  if (!attacker || attacker.side !== "party" || attacker.normalAttack === null) {
    return rejectAttack("not-player-turn");
  }
  const target = combat.participants.find((participant) => participant.id === command.targetId);
  if (!target || !checkNormalAttackTarget(combat, attacker, target.id, attacker.normalAttack.range).legal
    || !getLegalNormalAttackTargets(combat, attacker.id, attacker.normalAttack.range).includes(target.id)) {
    return rejectAttack("illegal-target");
  }

  let attackD20: number;
  let evasionD20: number;
  try {
    attackD20 = rollD20(roller);
    evasionD20 = rollD20(roller);
  } catch {
    return rejectAttack("invalid-roll");
  }
  const attackTotal = attackD20 + attacker.normalAttack.perceptionModifier
    + attacker.normalAttack.weaponMainStatModifier + attacker.normalAttack.proficiencyModifier;
  const evasionModifier = target.initiative.dexterityModifier;
  const evasionTotal = evasionD20 + evasionModifier;
  const outcome = attackTotal >= evasionTotal ? "hit" : "miss";
  const wrapsRound = combat.currentTurnIndex === combat.turnOrder.length - 1;
  const currentTurnIndex = wrapsRound ? 0 : combat.currentTurnIndex + 1;
  const lastAction: NormalAttackActionResolution = Object.freeze({
    type: "normal-attack",
    round: combat.round,
    actorId: attacker.id,
    targetId: target.id,
    attack: Object.freeze({
      rawD20: attackD20,
      perceptionModifier: attacker.normalAttack.perceptionModifier,
      weaponMainStatModifier: attacker.normalAttack.weaponMainStatModifier,
      proficiencyModifier: attacker.normalAttack.proficiencyModifier,
      total: attackTotal,
    }),
    evasion: Object.freeze({
      rawD20: evasionD20,
      dexterityModifier: evasionModifier,
      total: evasionTotal,
    }),
    outcome,
  });
  const nextCombat = createCombatState({
    ...combat,
    round: wrapsRound ? combat.round + 1 : combat.round,
    currentTurnIndex,
    currentActorId: combat.turnOrder[currentTurnIndex],
    lastAction,
  });
  return {
    ok: true,
    state: createGameState({ ...state, revision: state.revision + 1, combat: nextCombat }),
    effect: { type: "normal-attack-resolved", outcome },
  };
}
