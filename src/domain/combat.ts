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
} from "./combat-state.js";
import { isPlayerActionParticipant } from "./combat-state.js";
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

export type RowMoveCode = "invalid-command" | "stale-revision" | "revision-limit" | "not-in-combat"
  | "not-player-turn" | "illegal-row-move";

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
  | "not-in-combat" | "not-player-turn" | "unsupported-item" | "item-unavailable";

export type CombatItemUseResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly effect: { readonly type: "combat-item-used" };
    }
  | { readonly ok: false; readonly code: CombatItemUseCode; readonly message: string };

export type DefendCode = "invalid-command" | "stale-revision" | "revision-limit" | "not-in-combat" | "not-player-turn";

export type DefendResult =
  | { readonly ok: true; readonly state: GameState; readonly effect: { readonly type: "defend-completed" } }
  | { readonly ok: false; readonly code: DefendCode; readonly message: string };

const defendMessages: Record<DefendCode, string> = {
  "invalid-command": "防禦請求格式不正確。",
  "stale-revision": "戰鬥狀態已更新，請重新讀取後再防禦。",
  "revision-limit": "狀態版本已達工程上限，無法執行防禦。",
  "not-in-combat": "目前沒有進行中的戰鬥。",
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

const rowMoveMessages: Record<RowMoveCode, string> = {
  "invalid-command": "移動請求格式不正確。",
  "stale-revision": "戰鬥狀態已更新，請重新讀取後再移動。",
  "revision-limit": "狀態版本已達工程上限，無法執行移動。",
  "not-in-combat": "目前沒有進行中的戰鬥。",
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

function advanceToNextTurn(combat: CombatState): CombatState {
  const wrapsRound = combat.currentTurnIndex === combat.turnOrder.length - 1;
  const currentTurnIndex = wrapsRound ? 0 : combat.currentTurnIndex + 1;
  return createCombatState({
    ...combat,
    round: wrapsRound ? combat.round + 1 : combat.round,
    currentTurnIndex,
    currentActorId: combat.turnOrder[currentTurnIndex],
  });
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
  const combat = advanceToNextTurn(state.combat);
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

/** Builds row movement options from the latest authoritative combat snapshot. */
export function getCurrentRowMoveOptions(state: GameState): RowMoveOptionsResult {
  if (state.activity !== "in-combat" || state.combat === null) {
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
  if (state.activity !== "in-combat" || state.combat === null) {
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

/** One deterministic row change, Turn consumption and revision are one transition. */
export function moveCombatRow(state: GameState, input: unknown): RowMoveResult {
  const command = parseRowMoveCommand(input);
  if (!command) return rejectRowMove("invalid-command");
  if (command.expectedRevision !== state.revision) return rejectRowMove("stale-revision");
  if (state.revision === Number.MAX_SAFE_INTEGER) return rejectRowMove("revision-limit");
  if (state.activity !== "in-combat" || state.combat === null) return rejectRowMove("not-in-combat");

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
  const nextCombat = advanceToNextTurn(movedCombat);
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
  const nextCombat = createCombatState({ ...advanceToNextTurn(combat), lastAction });
  return {
    ok: true,
    state: createGameState({ ...state, revision: state.revision + 1, combat: nextCombat }),
    effect: { type: "normal-attack-resolved", outcome },
  };
}
