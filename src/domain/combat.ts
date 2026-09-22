import { createCombatState, type CombatSide, type CombatState } from "./combat-state.js";
import { createGameState, type GameState } from "./game.js";

export interface DiceRoller {
  d20(): number;
}

export interface CombatParticipantSeed {
  readonly id: string;
  readonly displayName: string;
  readonly side: CombatSide;
  readonly dexterityModifier: number;
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

interface MutableInitiative {
  readonly id: string;
  readonly displayName: string;
  readonly side: CombatSide;
  readonly dexterityModifier: number;
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

function reject(code: CombatTransitionCode): CombatTransitionResult {
  return { ok: false, code, message: messages[code] };
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
      || !Number.isSafeInteger(seed.dexterityModifier)) {
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
      initiative: {
        baseD20: participant.baseD20,
        dexterityModifier: participant.dexterityModifier,
        total: participant.total,
        tieBreakRolls: participant.tieBreakRolls,
      },
    })),
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
