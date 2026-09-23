import { getCombatItemDefinition } from "./combat-items.js";

export type CombatSide = "party" | "enemy";
export type CombatRow = "front" | "back";
export type NormalAttackRange = "melee" | "ranged";

export interface CombatNormalAttackProfile {
  readonly range: NormalAttackRange;
  readonly perceptionModifier: number;
  readonly weaponMainStatModifier: number;
  readonly proficiencyModifier: number;
}

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
  readonly row: CombatRow;
  readonly initiative: CombatInitiative;
  readonly normalAttack: CombatNormalAttackProfile | null;
  readonly racialEscapeModifier: 0 | -2;
}

/** Existing player-action boundary: the controllable party actor has the player's action profile. */
export function isPlayerActionParticipant(
  participant: Pick<CombatParticipant, "side" | "normalAttack">,
): participant is Pick<CombatParticipant, "side"> & { readonly normalAttack: CombatNormalAttackProfile } {
  return participant.side === "party" && participant.normalAttack !== null;
}

export interface NormalAttackActionResolution {
  readonly type: "normal-attack";
  readonly round: number;
  readonly actorId: string;
  readonly targetId: string;
  readonly attack: {
    readonly rawD20: number;
    readonly perceptionModifier: number;
    readonly weaponMainStatModifier: number;
    readonly proficiencyModifier: number;
    readonly total: number;
  };
  readonly evasion: {
    readonly rawD20: number;
    readonly dexterityModifier: number;
    readonly total: number;
  };
  readonly outcome: "hit" | "miss";
}

export interface RowMoveActionResolution {
  readonly type: "row-move";
  readonly actorId: string;
  readonly round: number;
  readonly fromRow: CombatRow;
  readonly toRow: CombatRow;
}

export interface ItemUseActionResolution {
  readonly type: "item-use";
  readonly actorId: string;
  readonly round: number;
  readonly itemId: string;
  readonly quantityBefore: number;
  readonly quantityAfter: number;
}

export interface DefendActionResolution {
  readonly type: "defend";
  readonly actorId: string;
  readonly round: number;
}

export interface RunActionResolution {
  readonly type: "run";
  readonly actorId: string;
  readonly round: number;
  readonly rawD20: number;
  readonly dexterityModifier: number;
  readonly racialModifier: number;
  readonly total: number;
  readonly dc: 8;
  readonly outcome: "success" | "failure";
}

export type CombatLastAction = NormalAttackActionResolution | RowMoveActionResolution | ItemUseActionResolution | DefendActionResolution | RunActionResolution;

interface CombatStateBase {
  readonly round: number;
  readonly turnOrder: readonly string[];
  readonly participants: readonly CombatParticipant[];
  readonly lastAction: CombatLastAction | null;
}

export interface ActiveCombatState extends CombatStateBase {
  readonly status: "active";
  readonly endReason: null;
  readonly currentTurnIndex: number;
  readonly currentActorId: string;
}

export interface EndedCombatState extends CombatStateBase {
  readonly status: "ended";
  readonly endReason: "escaped";
  readonly currentTurnIndex: null;
  readonly currentActorId: null;
  readonly lastAction: RunActionResolution & { readonly outcome: "success" };
}

export type CombatState = ActiveCombatState | EndedCombatState;

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

const legacyTestPositions: Readonly<Record<string, {
  readonly displayName: string;
  readonly side: CombatSide;
  readonly row: CombatRow;
  readonly normalAttack: CombatNormalAttackProfile | null;
  readonly racialEscapeModifier: 0 | -2;
}>> = Object.freeze({
  "TEST-enemy-2": Object.freeze({ displayName: "TEST 敵人 2", side: "enemy", row: "back", normalAttack: null, racialEscapeModifier: 0 }),
  "TEST-enemy-1": Object.freeze({ displayName: "TEST 敵人 1", side: "enemy", row: "front", normalAttack: null, racialEscapeModifier: 0 }),
  "TEST-player": Object.freeze({
    displayName: "TEST 玩家", side: "party", row: "front",
    normalAttack: Object.freeze({
      range: "melee", perceptionModifier: 1, weaponMainStatModifier: 2, proficiencyModifier: 1,
    }),
    racialEscapeModifier: 0,
  }),
});

function parseNormalAttackProfile(value: unknown): CombatNormalAttackProfile | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !exact(value, [
    "range", "perceptionModifier", "weaponMainStatModifier", "proficiencyModifier",
  ]) || (value.range !== "melee" && value.range !== "ranged")
    || !isSafeInteger(value.perceptionModifier) || !isSafeInteger(value.weaponMainStatModifier)
    || !isSafeInteger(value.proficiencyModifier)) return undefined;
  return Object.freeze({
    range: value.range,
    perceptionModifier: value.perceptionModifier,
    weaponMainStatModifier: value.weaponMainStatModifier,
    proficiencyModifier: value.proficiencyModifier,
  });
}

function parseParticipant(value: unknown, allowKnownLegacyTest: boolean): CombatParticipant {
  if (!isRecord(value)) throw new Error("戰鬥參與者格式不正確。");
  let normalized: Record<string, unknown> = value;
  if (allowKnownLegacyTest && (exact(value, ["id", "displayName", "side", "initiative"])
    || exact(value, ["id", "displayName", "side", "initiative", "racialEscapeModifier"]))) {
    const known = typeof value.id === "string" ? legacyTestPositions[value.id] : undefined;
    if (!known || value.displayName !== known.displayName || value.side !== known.side
      || (Object.hasOwn(value, "racialEscapeModifier") && value.racialEscapeModifier !== 0)) {
      throw new Error("未知舊版戰鬥參與者缺少權威 row。");
    }
    normalized = { ...value, row: known.row, normalAttack: known.normalAttack, racialEscapeModifier: 0 };
  }
  if (exact(normalized, ["id", "displayName", "side", "row", "initiative", "normalAttack"])) {
    normalized = { ...normalized, racialEscapeModifier: 0 };
  }
  if (!exact(normalized, ["id", "displayName", "side", "row", "initiative", "normalAttack", "racialEscapeModifier"])
    || !isId(normalized.id) || !isId(normalized.displayName)
    || (normalized.side !== "party" && normalized.side !== "enemy")
    || (normalized.row !== "front" && normalized.row !== "back")
    || !isRecord(normalized.initiative)
    || !exact(normalized.initiative, ["baseD20", "dexterityModifier", "total", "tieBreakRolls"])) {
    throw new Error("戰鬥參與者格式不正確。");
  }
  const normalAttack = parseNormalAttackProfile(normalized.normalAttack);
  const initiative = normalized.initiative;
  if (normalAttack === undefined || !isSafeInteger(normalized.racialEscapeModifier)
    || (normalized.racialEscapeModifier !== 0 && normalized.racialEscapeModifier !== -2)
    || !isD20(initiative.baseD20) || !isSafeInteger(initiative.dexterityModifier)
    || !isSafeInteger(initiative.total)
    || initiative.total !== initiative.baseD20 + initiative.dexterityModifier
    || !Array.isArray(initiative.tieBreakRolls) || !initiative.tieBreakRolls.every(isD20)) {
    throw new Error("先攻或普通攻擊資料格式不正確。");
  }
  return Object.freeze({
    id: normalized.id,
    displayName: normalized.displayName,
    side: normalized.side,
    row: normalized.row,
    initiative: Object.freeze({
      baseD20: initiative.baseD20,
      dexterityModifier: initiative.dexterityModifier,
      total: initiative.total,
      tieBreakRolls: Object.freeze([...initiative.tieBreakRolls]),
    }),
    normalAttack,
    racialEscapeModifier: normalized.racialEscapeModifier as 0 | -2,
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

function parseNormalAttackAction(value: Record<string, unknown>): NormalAttackActionResolution | undefined {
  if (!exact(value, ["type", "round", "actorId", "targetId", "attack", "evasion", "outcome"])
    || value.type !== "normal-attack" || !isPositiveSafeInteger(value.round)
    || !isId(value.actorId) || !isId(value.targetId)
    || (value.outcome !== "hit" && value.outcome !== "miss")
    || !isRecord(value.attack) || !exact(value.attack, [
      "rawD20", "perceptionModifier", "weaponMainStatModifier", "proficiencyModifier", "total",
    ])
    || !isD20(value.attack.rawD20) || !isSafeInteger(value.attack.perceptionModifier)
    || !isSafeInteger(value.attack.weaponMainStatModifier) || !isSafeInteger(value.attack.proficiencyModifier)
    || !isSafeInteger(value.attack.total)
    || value.attack.total !== value.attack.rawD20 + value.attack.perceptionModifier
      + value.attack.weaponMainStatModifier + value.attack.proficiencyModifier
    || !isRecord(value.evasion) || !exact(value.evasion, ["rawD20", "dexterityModifier", "total"])
    || !isD20(value.evasion.rawD20) || !isSafeInteger(value.evasion.dexterityModifier)
    || !isSafeInteger(value.evasion.total)
    || value.evasion.total !== value.evasion.rawD20 + value.evasion.dexterityModifier
    || value.outcome !== (value.attack.total >= value.evasion.total ? "hit" : "miss")) return undefined;
  return Object.freeze({
    type: "normal-attack",
    round: value.round,
    actorId: value.actorId,
    targetId: value.targetId,
    attack: Object.freeze({
      rawD20: value.attack.rawD20,
      perceptionModifier: value.attack.perceptionModifier,
      weaponMainStatModifier: value.attack.weaponMainStatModifier,
      proficiencyModifier: value.attack.proficiencyModifier,
      total: value.attack.total,
    }),
    evasion: Object.freeze({
      rawD20: value.evasion.rawD20,
      dexterityModifier: value.evasion.dexterityModifier,
      total: value.evasion.total,
    }),
    outcome: value.outcome,
  });
}

function parseRowMoveAction(value: Record<string, unknown>): RowMoveActionResolution | undefined {
  if (!exact(value, ["type", "actorId", "round", "fromRow", "toRow"])
    || value.type !== "row-move" || !isId(value.actorId) || !isPositiveSafeInteger(value.round)
    || (value.fromRow !== "front" && value.fromRow !== "back")
    || (value.toRow !== "front" && value.toRow !== "back") || value.fromRow === value.toRow) return undefined;
  return Object.freeze({
    type: "row-move",
    actorId: value.actorId,
    round: value.round,
    fromRow: value.fromRow,
    toRow: value.toRow,
  });
}

function parseItemUseAction(value: Record<string, unknown>): ItemUseActionResolution | undefined {
  if (!exact(value, ["type", "actorId", "round", "itemId", "quantityBefore", "quantityAfter"])
    || value.type !== "item-use" || !isId(value.actorId) || !isPositiveSafeInteger(value.round)
    || typeof value.itemId !== "string" || !getCombatItemDefinition(value.itemId)
    || !isSafeInteger(value.quantityBefore) || value.quantityBefore < 1
    || !isSafeInteger(value.quantityAfter) || value.quantityAfter !== value.quantityBefore - 1) return undefined;
  return Object.freeze({
    type: "item-use",
    actorId: value.actorId,
    round: value.round,
    itemId: value.itemId,
    quantityBefore: value.quantityBefore,
    quantityAfter: value.quantityAfter,
  });
}

function parseDefendAction(value: Record<string, unknown>): DefendActionResolution | undefined {
  if (!exact(value, ["type", "actorId", "round"])
    || value.type !== "defend" || !isId(value.actorId) || !isPositiveSafeInteger(value.round)) return undefined;
  return Object.freeze({ type: "defend", actorId: value.actorId, round: value.round });
}

function parseRunAction(value: Record<string, unknown>): RunActionResolution | undefined {
  if (!exact(value, ["type", "actorId", "round", "rawD20", "dexterityModifier", "racialModifier", "total", "dc", "outcome"])
    || value.type !== "run" || !isId(value.actorId) || !isPositiveSafeInteger(value.round)
    || !isD20(value.rawD20) || !isSafeInteger(value.dexterityModifier)
    || !isSafeInteger(value.racialModifier) || (value.racialModifier !== 0 && value.racialModifier !== -2)
    || !isSafeInteger(value.total) || value.total !== value.rawD20 + value.dexterityModifier + value.racialModifier
    || value.dc !== 8 || value.outcome !== (value.total >= 8 ? "success" : "failure")) return undefined;
  return Object.freeze({
    type: "run", actorId: value.actorId, round: value.round, rawD20: value.rawD20,
    dexterityModifier: value.dexterityModifier, racialModifier: value.racialModifier,
    total: value.total, dc: 8, outcome: value.outcome as "success" | "failure",
  });
}

function parseLastAction(value: unknown): CombatLastAction | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (value.type === "normal-attack") return parseNormalAttackAction(value);
  if (value.type === "row-move") return parseRowMoveAction(value);
  if (value.type === "item-use") return parseItemUseAction(value);
  if (value.type === "defend") return parseDefendAction(value);
  if (value.type === "run") return parseRunAction(value);
  return undefined;
}

/** PostgreSQL 與 domain 建立狀態時共用的完整 runtime validation。 */
export function createCombatState(value: unknown): CombatState {
  if (!isRecord(value)) throw new Error("CombatState 格式不正確。");
  const legacyShape = exact(value, ["round", "currentTurnIndex", "currentActorId", "turnOrder", "participants"]);
  const previousShape = exact(value, ["round", "currentTurnIndex", "currentActorId", "turnOrder", "participants", "lastAction"]);
  const currentShape = exact(value, ["status", "endReason", "round", "currentTurnIndex", "currentActorId", "turnOrder", "participants", "lastAction"]);
  const status = legacyShape || previousShape ? "active" : value.status;
  const endReason = legacyShape || previousShape ? null : value.endReason;
  if ((!legacyShape && !previousShape && !currentShape)
    || !isPositiveSafeInteger(value.round)
    || (status !== "active" && status !== "ended")
    || (status === "active" && (endReason !== null || !isSafeInteger(value.currentTurnIndex)
      || value.currentTurnIndex < 0 || !isId(value.currentActorId)))
    || (status === "ended" && (endReason !== "escaped" || value.currentTurnIndex !== null
      || value.currentActorId !== null))
    || !Array.isArray(value.turnOrder) || !value.turnOrder.every(isId)
    || !Array.isArray(value.participants) || value.participants.length === 0) {
    throw new Error("CombatState 格式不正確。");
  }
  const participants = value.participants.map((participant) => parseParticipant(participant, legacyShape));
  const lastAction = legacyShape ? null : parseLastAction(value.lastAction);
  const ids = participants.map((participant) => participant.id);
  const expectedOrder = expectedTurnOrder(participants);
  if (lastAction === undefined
    || new Set(ids).size !== ids.length
    || value.turnOrder.length !== ids.length
    || new Set(value.turnOrder).size !== value.turnOrder.length
    || value.turnOrder.some((id) => !ids.includes(id))
    || value.turnOrder.some((id, index) => id !== expectedOrder[index])
    || (status === "active" && ((value.currentTurnIndex as number) >= value.turnOrder.length
      || value.currentActorId !== value.turnOrder[value.currentTurnIndex as number]))
    || (status === "ended" && (lastAction?.type !== "run" || lastAction.outcome !== "success"
      || lastAction.round !== value.round))
    || (status === "active" && lastAction?.type === "run" && lastAction.outcome !== "failure")
    || (lastAction !== null && (lastAction.round > value.round
      || !ids.includes(lastAction.actorId)
      || participants.find((participant) => participant.id === lastAction.actorId)?.side !== "party"))
    || (lastAction?.type === "normal-attack"
      && (!ids.includes(lastAction.targetId)
        || participants.find((participant) => participant.id === lastAction.targetId)?.side !== "enemy"))
    || (lastAction?.type === "row-move"
      && participants.find((participant) => participant.id === lastAction.actorId)?.row !== lastAction.toRow)
    || ((lastAction?.type === "item-use" || lastAction?.type === "defend" || lastAction?.type === "run")
      && !isPlayerActionParticipant(participants.find((participant) => participant.id === lastAction.actorId)!))
    || (lastAction?.type === "run" && (lastAction.dexterityModifier !== participants.find((participant) => participant.id === lastAction.actorId)?.initiative.dexterityModifier
      || lastAction.racialModifier !== participants.find((participant) => participant.id === lastAction.actorId)?.racialEscapeModifier))) {
    throw new Error("CombatState 行動順序或最近裁定不一致。");
  }
  const base = {
    round: value.round,
    turnOrder: Object.freeze([...value.turnOrder]),
    participants: Object.freeze(participants),
    lastAction,
  };
  if (status === "ended") return Object.freeze({
    ...base, status: "ended", endReason: "escaped", currentTurnIndex: null, currentActorId: null,
    lastAction: lastAction as EndedCombatState["lastAction"],
  });
  return Object.freeze({
    ...base, status: "active", endReason: null,
    currentTurnIndex: value.currentTurnIndex as number, currentActorId: value.currentActorId as string,
  });
}
