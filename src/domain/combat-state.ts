export type CombatSide = "party" | "enemy";

export interface CombatInitiative {
  readonly baseD20: number;
  readonly dexterityModifier: number;
  readonly total: number;
  readonly tieBreakRolls: readonly number[];
}

export interface CombatParticipant {
  readonly id: string;
  readonly displayName: string;
  readonly side: CombatSide;
  readonly initiative: CombatInitiative;
}

export interface CombatState {
  readonly round: number;
  readonly currentTurnIndex: number;
  readonly currentActorId: string;
  readonly turnOrder: readonly string[];
  readonly participants: readonly CombatParticipant[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isD20(value: unknown): value is number {
  return isSafeInteger(value) && value >= 1 && value <= 20;
}

function parseParticipant(value: unknown): CombatParticipant {
  if (!isRecord(value) || !exact(value, ["id", "displayName", "side", "initiative"])
    || !isId(value.id) || !isId(value.displayName)
    || (value.side !== "party" && value.side !== "enemy")
    || !isRecord(value.initiative)
    || !exact(value.initiative, ["baseD20", "dexterityModifier", "total", "tieBreakRolls"])) {
    throw new Error("戰鬥參與者格式不正確。");
  }
  const initiative = value.initiative;
  if (!isD20(initiative.baseD20) || !isSafeInteger(initiative.dexterityModifier)
    || !isSafeInteger(initiative.total)
    || initiative.total !== initiative.baseD20 + initiative.dexterityModifier
    || !Array.isArray(initiative.tieBreakRolls) || !initiative.tieBreakRolls.every(isD20)) {
    throw new Error("先攻資料格式不正確。");
  }
  return Object.freeze({
    id: value.id,
    displayName: value.displayName,
    side: value.side,
    initiative: Object.freeze({
      baseD20: initiative.baseD20,
      dexterityModifier: initiative.dexterityModifier,
      total: initiative.total,
      tieBreakRolls: Object.freeze([...initiative.tieBreakRolls]),
    }),
  });
}

function resolveStoredTieOrder(
  participants: readonly CombatParticipant[],
  rollIndex: number,
): string[] {
  const byRoll = new Map<number, CombatParticipant[]>();
  for (const participant of participants) {
    const roll = participant.initiative.tieBreakRolls[rollIndex];
    if (!isD20(roll)) throw new Error("CombatState 缺少必要的平手重擲結果。");
    const group = byRoll.get(roll) ?? [];
    group.push(participant);
    byRoll.set(roll, group);
  }
  return [...byRoll.keys()].sort((a, b) => b - a).flatMap((roll) => {
    const group = byRoll.get(roll)!;
    if (group.length > 1) return resolveStoredTieOrder(group, rollIndex + 1);
    if (group[0]!.initiative.tieBreakRolls.length !== rollIndex + 1) {
      throw new Error("CombatState 含有不必要的平手重擲結果。");
    }
    return [group[0]!.id];
  });
}

function expectedTurnOrder(participants: readonly CombatParticipant[]): string[] {
  const byTotal = new Map<number, CombatParticipant[]>();
  for (const participant of participants) {
    const group = byTotal.get(participant.initiative.total) ?? [];
    group.push(participant);
    byTotal.set(participant.initiative.total, group);
  }
  return [...byTotal.keys()].sort((a, b) => b - a).flatMap((total) => {
    const group = byTotal.get(total)!;
    if (group.length > 1) return resolveStoredTieOrder(group, 0);
    if (group[0]!.initiative.tieBreakRolls.length !== 0) {
      throw new Error("CombatState 的非平手參與者不應有重擲結果。");
    }
    return [group[0]!.id];
  });
}

/** PostgreSQL 與 domain 建立狀態時共用的完整 runtime validation。 */
export function createCombatState(value: unknown): CombatState {
  if (!isRecord(value)
    || !exact(value, ["round", "currentTurnIndex", "currentActorId", "turnOrder", "participants"])
    || !isPositiveSafeInteger(value.round)
    || !isSafeInteger(value.currentTurnIndex) || value.currentTurnIndex < 0
    || !isId(value.currentActorId)
    || !Array.isArray(value.turnOrder) || !value.turnOrder.every(isId)
    || !Array.isArray(value.participants) || value.participants.length === 0) {
    throw new Error("CombatState 格式不正確。");
  }
  const participants = value.participants.map(parseParticipant);
  const ids = participants.map((participant) => participant.id);
  const expectedOrder = expectedTurnOrder(participants);
  if (new Set(ids).size !== ids.length
    || value.turnOrder.length !== ids.length
    || new Set(value.turnOrder).size !== value.turnOrder.length
    || value.turnOrder.some((id) => !ids.includes(id))
    || value.turnOrder.some((id, index) => id !== expectedOrder[index])
    || value.currentTurnIndex >= value.turnOrder.length
    || value.currentActorId !== value.turnOrder[value.currentTurnIndex]) {
    throw new Error("CombatState 行動順序不一致。");
  }
  return Object.freeze({
    round: value.round,
    currentTurnIndex: value.currentTurnIndex,
    currentActorId: value.currentActorId,
    turnOrder: Object.freeze([...value.turnOrder]),
    participants: Object.freeze(participants),
  });
}
