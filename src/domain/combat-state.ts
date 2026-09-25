import { getCombatItemDefinition } from "./combat-items.js";
import { getActiveSkillDefinition } from "./physical-skills.js";

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
  /** Present only for a semi-autonomous party member; absent on legacy snapshots. */
  readonly controlledBy?: "companion";
}

/** Existing player-action boundary: the controllable party actor has the player's action profile. */
export function isPlayerActionParticipant(
  participant: Pick<CombatParticipant, "side" | "normalAttack" | "controlledBy">,
): participant is Pick<CombatParticipant, "side"> & { readonly normalAttack: CombatNormalAttackProfile } {
  return participant.side === "party" && participant.normalAttack !== null && participant.controlledBy !== "companion";
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
  readonly tacticPreferenceId?: string;
}

export interface PhysicalSkillActionResolution extends Omit<NormalAttackActionResolution, "type" | "tacticPreferenceId"> {
  readonly type: "physical-skill";
  readonly skillId: string;
  readonly readyRound: number;
}

export interface SkillCooldown {
  readonly actorId: string;
  readonly skillId: string;
  readonly readyRound: number;
}

export interface RacialAbilityCooldown {
  readonly actorId: string;
  readonly abilityId: "dragon-breath";
  readonly readyRound: number;
}

export type DragonBreathElement = "fire" | "ice" | "lightning";

export interface AoETargetResolution {
  readonly targetId: string;
  readonly attack: { readonly rawD20: number; readonly perceptionModifier: number; readonly total: number };
  readonly evasion: { readonly rawD20: number; readonly dexterityModifier: number; readonly total: number };
  readonly outcome: "hit" | "miss";
  readonly critical: boolean;
}

export interface DragonBreathActionResolution {
  readonly type: "dragon-breath";
  readonly actorId: string;
  readonly round: number;
  readonly element: DragonBreathElement;
  readonly targetRow: CombatRow;
  readonly readyRound: number;
  readonly results: readonly AoETargetResolution[];
}

export interface CastingState {
  readonly actorId: string;
  readonly skillId: string;
  readonly startedRound: number;
  readonly completedCastingTurns: number;
  readonly totalCastingTurns: number;
  readonly totalMpCost: number;
  readonly mpSpent: number;
}

export interface CastingActionResolution {
  readonly type: "casting-start" | "casting-continue" | "casting-cancel" | "casting-complete";
  readonly actorId: string;
  readonly skillId: string;
  readonly round: number;
  readonly mpSpentThisAction: number;
  readonly totalMpSpent: number;
  readonly completedCastingTurns: number;
  readonly totalCastingTurns: number;
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
  readonly tacticPreferenceId?: string;
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

export type CombatLastAction = NormalAttackActionResolution | PhysicalSkillActionResolution | RowMoveActionResolution | ItemUseActionResolution | DefendActionResolution | RunActionResolution | CastingActionResolution | DragonBreathActionResolution;

interface CombatStateBase {
  readonly round: number;
  readonly turnOrder: readonly string[];
  readonly participants: readonly CombatParticipant[];
  readonly lastAction: CombatLastAction | null;
  readonly skillCooldowns: readonly SkillCooldown[];
  readonly activeCastings: readonly CastingState[];
  readonly racialAbilityCooldowns: readonly RacialAbilityCooldown[];
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
  if (!(exact(normalized, ["id", "displayName", "side", "row", "initiative", "normalAttack", "racialEscapeModifier"])
    || exact(normalized, ["id", "displayName", "side", "row", "initiative", "normalAttack", "racialEscapeModifier", "controlledBy"]))
    || !isId(normalized.id) || !isId(normalized.displayName)
    || (normalized.side !== "party" && normalized.side !== "enemy")
    || (normalized.row !== "front" && normalized.row !== "back")
    || (Object.hasOwn(normalized, "controlledBy") && (normalized.controlledBy !== "companion" || normalized.side !== "party"))
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
    ...(normalized.controlledBy === "companion" ? { controlledBy: "companion" as const } : {}),
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

function parsePhysicalAttackAction(value: Record<string, unknown>): NormalAttackActionResolution | PhysicalSkillActionResolution | undefined {
  const skill = value.type === "physical-skill";
  if (!(exact(value, skill
    ? ["type", "round", "actorId", "skillId", "targetId", "attack", "evasion", "outcome", "readyRound"]
    : ["type", "round", "actorId", "targetId", "attack", "evasion", "outcome"])
    || (!skill && exact(value, ["type", "round", "actorId", "targetId", "attack", "evasion", "outcome", "tacticPreferenceId"])))
    || (value.type !== "normal-attack" && !skill) || !isPositiveSafeInteger(value.round)
    || (Object.hasOwn(value, "tacticPreferenceId") && !isId(value.tacticPreferenceId))
    || !isId(value.actorId) || !isId(value.targetId)
    || (skill && (!isId(value.skillId)
      || getActiveSkillDefinition(value.skillId)?.category !== "physical-active"
      || !isPositiveSafeInteger(value.readyRound) || value.readyRound !== value.round + 2))
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
    type: value.type,
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
    ...(typeof value.tacticPreferenceId === "string" ? { tacticPreferenceId: value.tacticPreferenceId } : {}),
    ...(skill ? { skillId: value.skillId as string, readyRound: value.readyRound as number } : {}),
  }) as NormalAttackActionResolution | PhysicalSkillActionResolution;
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
  if (!(exact(value, ["type", "actorId", "round"])
    || exact(value, ["type", "actorId", "round", "tacticPreferenceId"]))
    || value.type !== "defend" || !isId(value.actorId) || !isPositiveSafeInteger(value.round)
    || (Object.hasOwn(value, "tacticPreferenceId") && !isId(value.tacticPreferenceId))) return undefined;
  return Object.freeze({ type: "defend", actorId: value.actorId, round: value.round,
    ...(typeof value.tacticPreferenceId === "string" ? { tacticPreferenceId: value.tacticPreferenceId } : {}) });
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

function parseCastingAction(value: Record<string, unknown>): CastingActionResolution | undefined {
  if (!exact(value, ["type", "actorId", "skillId", "round", "mpSpentThisAction", "totalMpSpent", "completedCastingTurns", "totalCastingTurns"])
    || (value.type !== "casting-start" && value.type !== "casting-continue"
      && value.type !== "casting-cancel" && value.type !== "casting-complete")
    || !isId(value.actorId) || !isId(value.skillId) || !isPositiveSafeInteger(value.round)
    || !isSafeInteger(value.mpSpentThisAction) || !isSafeInteger(value.totalMpSpent)
    || !isPositiveSafeInteger(value.completedCastingTurns) || !isPositiveSafeInteger(value.totalCastingTurns)) return undefined;
  const definition = getActiveSkillDefinition(value.skillId);
  if (!definition || definition.category !== "magic-active"
    || value.totalCastingTurns !== definition.castingTurns
    || value.completedCastingTurns > definition.castingTurns
    || value.totalMpSpent !== value.completedCastingTurns * definition.perTurnMpCost
    || value.mpSpentThisAction !== (value.type === "casting-cancel" ? 0 : definition.perTurnMpCost)
    || (value.type === "casting-start" && value.completedCastingTurns !== 1)
    || (value.type === "casting-complete" && value.completedCastingTurns !== definition.castingTurns)
    || (value.type !== "casting-complete" && value.completedCastingTurns >= definition.castingTurns)) return undefined;
  return Object.freeze(value) as unknown as CastingActionResolution;
}

function parseDragonBreathAction(value: Record<string, unknown>): DragonBreathActionResolution | undefined {
  if (!exact(value, ["type", "actorId", "round", "element", "targetRow", "readyRound", "results"])
    || value.type !== "dragon-breath" || !isId(value.actorId) || !isPositiveSafeInteger(value.round)
    || (value.element !== "fire" && value.element !== "ice" && value.element !== "lightning")
    || (value.targetRow !== "front" && value.targetRow !== "back")
    || value.readyRound !== value.round + 3 || !Array.isArray(value.results) || value.results.length === 0) return undefined;
  const results: AoETargetResolution[] = [];
  for (const result of value.results) {
    if (!isRecord(result) || !exact(result, ["targetId", "attack", "evasion", "outcome", "critical"])
      || !isId(result.targetId) || !isRecord(result.attack)
      || !exact(result.attack, ["rawD20", "perceptionModifier", "total"])
      || !isD20(result.attack.rawD20) || !isSafeInteger(result.attack.perceptionModifier)
      || !isSafeInteger(result.attack.total)
      || result.attack.total !== result.attack.rawD20 + result.attack.perceptionModifier
      || !isRecord(result.evasion) || !exact(result.evasion, ["rawD20", "dexterityModifier", "total"])
      || !isD20(result.evasion.rawD20) || !isSafeInteger(result.evasion.dexterityModifier)
      || !isSafeInteger(result.evasion.total)
      || result.evasion.total !== result.evasion.rawD20 + result.evasion.dexterityModifier
      || result.outcome !== (result.attack.total >= result.evasion.total ? "hit" : "miss")
      || result.critical !== (result.outcome === "hit" && result.attack.rawD20 >= 19)) return undefined;
    results.push(Object.freeze({ targetId: result.targetId, attack: Object.freeze({
      rawD20: result.attack.rawD20, perceptionModifier: result.attack.perceptionModifier, total: result.attack.total,
    }), evasion: Object.freeze({
      rawD20: result.evasion.rawD20, dexterityModifier: result.evasion.dexterityModifier, total: result.evasion.total,
    }), outcome: result.outcome as "hit" | "miss", critical: result.critical }));
  }
  if (new Set(results.map((result) => result.targetId)).size !== results.length) return undefined;
  return Object.freeze({ type: "dragon-breath", actorId: value.actorId, round: value.round,
    element: value.element, targetRow: value.targetRow, readyRound: value.readyRound,
    results: Object.freeze(results) });
}

function parseLastAction(value: unknown): CombatLastAction | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (value.type === "normal-attack" || value.type === "physical-skill") return parsePhysicalAttackAction(value);
  if (value.type === "row-move") return parseRowMoveAction(value);
  if (value.type === "item-use") return parseItemUseAction(value);
  if (value.type === "defend") return parseDefendAction(value);
  if (value.type === "run") return parseRunAction(value);
  if (value.type === "dragon-breath") return parseDragonBreathAction(value);
  if (typeof value.type === "string" && value.type.startsWith("casting-")) return parseCastingAction(value);
  return undefined;
}

/** PostgreSQL 與 domain 建立狀態時共用的完整 runtime validation。 */
export function createCombatState(value: unknown): CombatState {
  if (!isRecord(value)) throw new Error("CombatState 格式不正確。");
  const legacyShape = exact(value, ["round", "currentTurnIndex", "currentActorId", "turnOrder", "participants"]);
  const previousShape = exact(value, ["round", "currentTurnIndex", "currentActorId", "turnOrder", "participants", "lastAction"]);
  const previousSkillShape = exact(value, ["round", "currentTurnIndex", "currentActorId", "turnOrder", "participants", "lastAction", "skillCooldowns"]);
  const currentShape = exact(value, ["status", "endReason", "round", "currentTurnIndex", "currentActorId", "turnOrder", "participants", "lastAction"]);
  const skillShape = exact(value, ["status", "endReason", "round", "currentTurnIndex", "currentActorId", "turnOrder", "participants", "lastAction", "skillCooldowns"]);
  const castingShape = exact(value, ["status", "endReason", "round", "currentTurnIndex", "currentActorId", "turnOrder", "participants", "lastAction", "skillCooldowns", "activeCastings"]);
  const breathShape = exact(value, ["status", "endReason", "round", "currentTurnIndex", "currentActorId", "turnOrder", "participants", "lastAction", "skillCooldowns", "activeCastings", "racialAbilityCooldowns"]);
  const status = legacyShape || previousShape || previousSkillShape ? "active" : value.status;
  const endReason = legacyShape || previousShape || previousSkillShape ? null : value.endReason;
  if ((!legacyShape && !previousShape && !previousSkillShape && !currentShape && !skillShape && !castingShape && !breathShape)
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
  const skillCooldowns: SkillCooldown[] = (skillShape || castingShape || breathShape || previousSkillShape) && Array.isArray(value.skillCooldowns)
    ? value.skillCooldowns.map((entry) => {
      if (!isRecord(entry) || !exact(entry, ["actorId", "skillId", "readyRound"])
        || !isId(entry.actorId) || !isId(entry.skillId)
        || getActiveSkillDefinition(entry.skillId)?.category !== "physical-active"
        || !isPositiveSafeInteger(entry.readyRound) || entry.readyRound < 3) {
        throw new Error("技能冷卻資料格式不正確。");
      }
      return Object.freeze({ actorId: entry.actorId, skillId: entry.skillId, readyRound: entry.readyRound });
    }) : [];
  if ((skillShape || castingShape || breathShape || previousSkillShape) && !Array.isArray(value.skillCooldowns)) throw new Error("技能冷卻資料格式不正確。");
  if ((castingShape || breathShape) && !Array.isArray(value.activeCastings)) throw new Error("詠唱資料格式不正確。");
  const activeCastings: CastingState[] = (castingShape || breathShape) ? (value.activeCastings as unknown[]).map((entry) => {
    if (!isRecord(entry) || !exact(entry, ["actorId", "skillId", "startedRound", "completedCastingTurns", "totalCastingTurns", "totalMpCost", "mpSpent"])
      || !isId(entry.actorId) || !isId(entry.skillId) || !isPositiveSafeInteger(entry.startedRound)
      || !isPositiveSafeInteger(entry.completedCastingTurns) || !isPositiveSafeInteger(entry.totalCastingTurns)
      || !isPositiveSafeInteger(entry.totalMpCost) || !isPositiveSafeInteger(entry.mpSpent)) throw new Error("詠唱資料格式不正確。");
    const definition = getActiveSkillDefinition(entry.skillId);
    if (!definition || definition.category !== "magic-active" || entry.totalCastingTurns !== definition.castingTurns
      || entry.totalMpCost !== definition.totalMpCost || entry.completedCastingTurns >= definition.castingTurns
      || entry.mpSpent !== entry.completedCastingTurns * definition.perTurnMpCost) throw new Error("詠唱進度不一致。");
    return Object.freeze(entry) as unknown as CastingState;
  }) : [];
  if (breathShape && !Array.isArray(value.racialAbilityCooldowns)) throw new Error("天生能力冷卻資料格式不正確。");
  const racialAbilityCooldowns: RacialAbilityCooldown[] = breathShape
    ? (value.racialAbilityCooldowns as unknown[]).map((entry) => {
      if (!isRecord(entry) || !exact(entry, ["actorId", "abilityId", "readyRound"])
        || !isId(entry.actorId) || entry.abilityId !== "dragon-breath"
        || !isPositiveSafeInteger(entry.readyRound) || entry.readyRound < 4) {
        throw new Error("天生能力冷卻資料格式不正確。");
      }
      return Object.freeze({ actorId: entry.actorId, abilityId: "dragon-breath" as const, readyRound: entry.readyRound });
    }) : [];
  const ids = participants.map((participant) => participant.id);
  const expectedOrder = expectedTurnOrder(participants);
  if (lastAction === undefined
    || new Set(ids).size !== ids.length
    || skillCooldowns.some((entry) => !ids.includes(entry.actorId) || entry.readyRound > (value.round as number) + 2)
    || racialAbilityCooldowns.some((entry) => !ids.includes(entry.actorId) || entry.readyRound > (value.round as number) + 3)
    || new Set(racialAbilityCooldowns.map((entry) => `${entry.actorId}\u0000${entry.abilityId}`)).size !== racialAbilityCooldowns.length
    || new Set(skillCooldowns.map((entry) => `${entry.actorId}\u0000${entry.skillId}`)).size !== skillCooldowns.length
    || new Set(activeCastings.map((entry) => entry.actorId)).size !== activeCastings.length
    || activeCastings.some((entry) => !ids.includes(entry.actorId) || entry.startedRound > (value.round as number)
      || !isPlayerActionParticipant(participants.find((participant) => participant.id === entry.actorId)!))
    || (status === "ended" && activeCastings.length > 0)
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
    || (lastAction !== null && (lastAction.type === "normal-attack" || lastAction.type === "defend")
      && (participants.find((participant) => participant.id === lastAction.actorId)?.controlledBy === "companion")
        !== (lastAction.tacticPreferenceId !== undefined))
    || ((lastAction?.type === "normal-attack" || lastAction?.type === "physical-skill")
      && (!ids.includes(lastAction.targetId)
        || participants.find((participant) => participant.id === lastAction.targetId)?.side !== "enemy"))
    || (lastAction?.type === "physical-skill"
      && skillCooldowns.find((entry) => entry.actorId === lastAction.actorId
        && entry.skillId === lastAction.skillId)?.readyRound !== lastAction.readyRound)
    || (lastAction?.type === "dragon-breath" && (racialAbilityCooldowns.find((entry) => entry.actorId === lastAction.actorId
      && entry.abilityId === "dragon-breath")?.readyRound !== lastAction.readyRound
      || lastAction.results.length !== participants.filter((participant) => participant.side === "enemy"
        && participant.row === lastAction.targetRow).length
      || lastAction.results.some((result) => participants.find((participant) => participant.id === result.targetId)?.side !== "enemy"
        || participants.find((participant) => participant.id === result.targetId)?.row !== lastAction.targetRow
        || result.evasion.dexterityModifier !== participants.find((participant) => participant.id === result.targetId)?.initiative.dexterityModifier
        || result.attack.perceptionModifier !== participants.find((participant) => participant.id === lastAction.actorId)?.normalAttack?.perceptionModifier)))
    || (lastAction !== null && lastAction.type.startsWith("casting-")
      && ((lastAction.type === "casting-start" || lastAction.type === "casting-continue")
        ? !activeCastings.some((entry) => entry.actorId === lastAction.actorId
          && entry.skillId === lastAction.skillId && entry.mpSpent === lastAction.totalMpSpent)
        : activeCastings.some((entry) => entry.actorId === lastAction.actorId)))
    || (lastAction?.type === "row-move"
      && participants.find((participant) => participant.id === lastAction.actorId)?.row !== lastAction.toRow)
    || ((lastAction?.type === "item-use" || lastAction?.type === "run")
      && !isPlayerActionParticipant(participants.find((participant) => participant.id === lastAction.actorId)!))
    || (lastAction?.type === "defend" && !isPlayerActionParticipant(participants.find((participant) => participant.id === lastAction.actorId)!)
      && participants.find((participant) => participant.id === lastAction.actorId)?.controlledBy !== "companion")
    || (lastAction?.type === "run" && (lastAction.dexterityModifier !== participants.find((participant) => participant.id === lastAction.actorId)?.initiative.dexterityModifier
      || lastAction.racialModifier !== participants.find((participant) => participant.id === lastAction.actorId)?.racialEscapeModifier))) {
    throw new Error("CombatState 行動順序或最近裁定不一致。");
  }
  const base = {
    round: value.round,
    turnOrder: Object.freeze([...value.turnOrder]),
    participants: Object.freeze(participants),
    lastAction,
    skillCooldowns: Object.freeze(skillCooldowns),
    activeCastings: Object.freeze(activeCastings),
    racialAbilityCooldowns: Object.freeze(racialAbilityCooldowns),
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
