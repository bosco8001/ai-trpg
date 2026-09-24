import { TEST_COMBAT_CONSUMABLE_ID, TEST_COMBAT_CONSUMABLE_NAME } from "./combat-items.js";

/** 前端讀取的最小權威狀態快照。所有資料仍必須經 runtime validation。 */
export type CombatSide = "party" | "enemy";
export type CombatRow = "front" | "back";
export type NormalAttackRange = "melee" | "ranged";

export interface CombatNormalAttackProfileView {
  readonly range: NormalAttackRange;
  readonly perceptionModifier: number;
  readonly weaponMainStatModifier: number;
  readonly proficiencyModifier: number;
}

export interface CombatInitiativeView {
  readonly baseD20: number;
  readonly dexterityModifier: number;
  readonly total: number;
  readonly tieBreakRolls: readonly number[];
}

export interface CombatParticipantView {
  readonly id: string;
  readonly displayName: string;
  readonly side: CombatSide;
  readonly row: CombatRow;
  readonly initiative: CombatInitiativeView;
  readonly normalAttack: CombatNormalAttackProfileView | null;
  readonly racialEscapeModifier: number;
}

export interface NormalAttackResolutionView {
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

export interface PhysicalSkillResolutionView extends Omit<NormalAttackResolutionView, "type"> {
  readonly type: "physical-skill";
  readonly skillId: string;
  readonly readyRound: number;
}

export interface SkillCooldownView {
  readonly actorId: string;
  readonly skillId: string;
  readonly readyRound: number;
}

export interface RacialAbilityCooldownView {
  readonly actorId: string;
  readonly abilityId: "dragon-breath";
  readonly readyRound: number;
}

export interface DragonBreathResolutionView {
  readonly type: "dragon-breath";
  readonly actorId: string;
  readonly round: number;
  readonly element: "fire" | "ice" | "lightning";
  readonly targetRow: CombatRow;
  readonly readyRound: number;
  readonly results: readonly {
    readonly targetId: string;
    readonly attack: { readonly rawD20: number; readonly perceptionModifier: number; readonly total: number };
    readonly evasion: { readonly rawD20: number; readonly dexterityModifier: number; readonly total: number };
    readonly outcome: "hit" | "miss";
    readonly critical: boolean;
  }[];
}

export interface CastingStateView {
  readonly actorId: string;
  readonly skillId: string;
  readonly startedRound: number;
  readonly completedCastingTurns: number;
  readonly totalCastingTurns: number;
  readonly totalMpCost: number;
  readonly mpSpent: number;
}

interface CastingResolutionFields {
  readonly actorId: string;
  readonly skillId: string;
  readonly round: number;
  readonly mpSpentThisAction: number;
  readonly totalMpSpent: number;
  readonly completedCastingTurns: number;
  readonly totalCastingTurns: number;
}

export type CastingResolutionView = CastingResolutionFields & (
  { readonly type: "casting-start" } | { readonly type: "casting-continue" }
  | { readonly type: "casting-cancel" } | { readonly type: "casting-complete" }
);

export interface RowMoveResolutionView {
  readonly type: "row-move";
  readonly actorId: string;
  readonly round: number;
  readonly fromRow: CombatRow;
  readonly toRow: CombatRow;
}

export interface ItemUseResolutionView {
  readonly type: "item-use";
  readonly actorId: string;
  readonly round: number;
  readonly itemId: string;
  readonly quantityBefore: number;
  readonly quantityAfter: number;
}

export interface DefendResolutionView {
  readonly type: "defend";
  readonly actorId: string;
  readonly round: number;
}

export interface RunResolutionView {
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

export type CombatLastActionView = NormalAttackResolutionView | PhysicalSkillResolutionView | RowMoveResolutionView | ItemUseResolutionView | DefendResolutionView | RunResolutionView | CastingResolutionView | DragonBreathResolutionView;

interface CombatStateViewBase {
  readonly round: number;
  readonly turnOrder: readonly string[];
  readonly participants: readonly CombatParticipantView[];
  readonly lastAction: CombatLastActionView | null;
  readonly skillCooldowns: readonly SkillCooldownView[];
  readonly activeCastings: readonly CastingStateView[];
  readonly racialAbilityCooldowns: readonly RacialAbilityCooldownView[];
}

export interface ActiveCombatStateView extends CombatStateViewBase {
  readonly status: "active";
  readonly endReason: null;
  readonly currentTurnIndex: number;
  readonly currentActorId: string;
}

export interface EndedCombatStateView extends CombatStateViewBase {
  readonly status: "ended";
  readonly endReason: "escaped";
  readonly currentTurnIndex: null;
  readonly currentActorId: null;
  readonly lastAction: RunResolutionView & { readonly outcome: "success" };
}

export type CombatStateView = ActiveCombatStateView | EndedCombatStateView;

export interface NormalAttackTargetOptionView {
  readonly targetId: string;
  readonly displayName: string;
  readonly legal: boolean;
  readonly reason?: "front-row-blocked";
}

export interface NormalAttackOptionsResponse {
  readonly revision: number;
  readonly currentActorId: string;
  readonly canPlayerAct: boolean;
  readonly legalTargetIds: readonly string[];
  readonly targets: readonly NormalAttackTargetOptionView[];
}

export interface RowMoveOptionsResponse {
  readonly revision: number;
  readonly currentActorId: string;
  readonly currentRow: CombatRow;
  readonly canPlayerAct: boolean;
  readonly legalTargetRows: readonly CombatRow[];
}

export interface InventoryStackView {
  readonly itemId: typeof TEST_COMBAT_CONSUMABLE_ID;
  readonly quantity: number;
}

export interface CombatItemOptionView {
  readonly itemId: typeof TEST_COMBAT_CONSUMABLE_ID;
  readonly displayName: typeof TEST_COMBAT_CONSUMABLE_NAME;
  readonly quantity: number;
  readonly usable: boolean;
  readonly unavailableReason?: "not-player-turn" | "quantity-depleted" | "casting-active";
}

export interface CombatItemOptionsResponse {
  readonly revision: number;
  readonly currentActorId: string;
  readonly items: readonly CombatItemOptionView[];
}

export interface CombatNormalAttackResponse extends AuthoritativeGameStateResponse {
  readonly effect: { readonly type: "normal-attack-resolved"; readonly outcome: "hit" | "miss" };
}

export interface CombatRowMoveResponse extends AuthoritativeGameStateResponse {
  readonly effect: { readonly type: "row-move-completed" };
}

export interface CombatItemUseResponse extends AuthoritativeGameStateResponse {
  readonly effect: { readonly type: "combat-item-used" };
  readonly options: CombatItemOptionsResponse;
}

export interface CombatDefendResponse extends AuthoritativeGameStateResponse {
  readonly effect: { readonly type: "defend-completed" };
}

export interface CombatRunResponse extends AuthoritativeGameStateResponse {
  readonly effect: { readonly type: "run-resolved"; readonly outcome: "success" | "failure" };
}

export interface PhysicalSkillOptionView {
  readonly skillId: string;
  readonly displayName: string;
  readonly category: "physical-active";
  readonly targetMode: "single-enemy";
  readonly range: NormalAttackRange;
  readonly usable: boolean;
  readonly unavailableReason?: "not-player-turn" | "skill-on-cooldown" | "no-legal-target" | "casting-active";
  readonly readyRound: number | null;
  readonly targets: readonly NormalAttackTargetOptionView[];
}

export interface PhysicalSkillOptionsResponse {
  readonly revision: number;
  readonly currentActorId: string;
  readonly skills: readonly PhysicalSkillOptionView[];
}

export interface PhysicalSkillUseResponse extends AuthoritativeGameStateResponse {
  readonly effect: { readonly type: "physical-skill-resolved"; readonly outcome: "hit" | "miss" };
}

export interface CastingResponse extends AuthoritativeGameStateResponse {
  readonly effect: { readonly type: "casting-started" | "casting-continued" | "casting-cancelled" | "casting-completed" };
}

export interface DragonBreathOptionsResponse {
  readonly revision: number;
  readonly currentActorId: string;
  readonly currentRound: number;
  readonly element: "fire" | "ice" | "lightning" | null;
  readonly readyRound: number | null;
  readonly available: boolean;
  readonly unavailableReason?: "not-player-turn" | "not-dragonborn" | "element-unresolved" | "casting-active" | "ability-on-cooldown" | "no-target-row";
  readonly rows: readonly { readonly row: CombatRow; readonly targetCount: number; readonly available: boolean;
    readonly unavailableReason?: "empty-target-row" }[];
}

export interface DragonBreathResponse extends AuthoritativeGameStateResponse {
  readonly effect: { readonly type: "dragon-breath-resolved" };
}

export interface AuthoritativeGameStateView {
  readonly revision: number;
  readonly activity: "outside-combat" | "in-combat";
  readonly character: {
    readonly id: string;
    readonly learnedActiveSkillIds: readonly string[];
    readonly equippedSkillIds: readonly string[];
    readonly currentMp: number;
    readonly raceId: string | null;
    readonly dragonBreathElement: "fire" | "ice" | "lightning" | null;
  };
  readonly inventory: readonly InventoryStackView[];
  readonly exploration: {
    readonly locationId: "TEST-forest-edge" | "TEST-ruin-entrance";
    readonly lastObservationTargetId: "TEST-stone-door" | null;
  };
  readonly combat: CombatStateView | null;
}

export interface AuthoritativeGameStateResponse {
  readonly sandbox: boolean;
  readonly storage: "memory" | "postgres";
  readonly state: AuthoritativeGameStateView;
}

export interface CombatSandboxAdvanceResponse extends AuthoritativeGameStateResponse {
  readonly effect: { readonly type: "combat-turn-advanced" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isD20(value: unknown): value is number {
  return isSafeInteger(value) && value >= 1 && value <= 20;
}

function isIds(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isId);
}

function isNormalAttackProfile(value: unknown): value is CombatNormalAttackProfileView | null {
  if (value === null) return true;
  return isRecord(value) && exact(value, [
    "range", "perceptionModifier", "weaponMainStatModifier", "proficiencyModifier",
  ]) && (value.range === "melee" || value.range === "ranged")
    && isSafeInteger(value.perceptionModifier) && isSafeInteger(value.weaponMainStatModifier)
    && isSafeInteger(value.proficiencyModifier);
}

function parseParticipant(value: unknown): CombatParticipantView | undefined {
  if (!isRecord(value) || !exact(value, ["id", "displayName", "side", "row", "initiative", "normalAttack", "racialEscapeModifier"])
    || !isId(value.id) || !isId(value.displayName)
    || (value.side !== "party" && value.side !== "enemy")
    || (value.row !== "front" && value.row !== "back")
    || !isNormalAttackProfile(value.normalAttack)
    || (value.racialEscapeModifier !== 0 && value.racialEscapeModifier !== -2)
    || !isRecord(value.initiative)
    || !exact(value.initiative, ["baseD20", "dexterityModifier", "total", "tieBreakRolls"])
    || !isD20(value.initiative.baseD20)
    || !isSafeInteger(value.initiative.dexterityModifier)
    || !isSafeInteger(value.initiative.total)
    || value.initiative.total !== value.initiative.baseD20 + value.initiative.dexterityModifier
    || !Array.isArray(value.initiative.tieBreakRolls)
    || !value.initiative.tieBreakRolls.every(isD20)) return undefined;
  return value as unknown as CombatParticipantView;
}

function isPhysicalAttackResolution(value: unknown): value is NormalAttackResolutionView | PhysicalSkillResolutionView {
  const skill = isRecord(value) && value.type === "physical-skill";
  return isRecord(value)
    && exact(value, skill
      ? ["type", "round", "actorId", "skillId", "targetId", "attack", "evasion", "outcome", "readyRound"]
      : ["type", "round", "actorId", "targetId", "attack", "evasion", "outcome"])
    && (value.type === "normal-attack" || skill)
    && (!skill || (value.skillId === "TEST-skill-1" && isSafeInteger(value.readyRound)
      && value.readyRound === (value.round as number) + 2))
    && isSafeInteger(value.round) && value.round > 0
    && isId(value.actorId) && isId(value.targetId)
    && (value.outcome === "hit" || value.outcome === "miss")
    && isRecord(value.attack)
    && exact(value.attack, [
      "rawD20", "perceptionModifier", "weaponMainStatModifier", "proficiencyModifier", "total",
    ])
    && isD20(value.attack.rawD20) && isSafeInteger(value.attack.perceptionModifier)
    && isSafeInteger(value.attack.weaponMainStatModifier) && isSafeInteger(value.attack.proficiencyModifier)
    && isSafeInteger(value.attack.total)
    && value.attack.total === value.attack.rawD20 + value.attack.perceptionModifier
      + value.attack.weaponMainStatModifier + value.attack.proficiencyModifier
    && isRecord(value.evasion)
    && exact(value.evasion, ["rawD20", "dexterityModifier", "total"])
    && isD20(value.evasion.rawD20) && isSafeInteger(value.evasion.dexterityModifier)
    && isSafeInteger(value.evasion.total)
    && value.evasion.total === value.evasion.rawD20 + value.evasion.dexterityModifier
    && value.outcome === (value.attack.total >= value.evasion.total ? "hit" : "miss");
}

function isRowMoveResolution(value: unknown): value is RowMoveResolutionView {
  return isRecord(value)
    && exact(value, ["type", "actorId", "round", "fromRow", "toRow"])
    && value.type === "row-move" && isId(value.actorId)
    && isSafeInteger(value.round) && value.round > 0
    && (value.fromRow === "front" || value.fromRow === "back")
    && (value.toRow === "front" || value.toRow === "back")
    && value.fromRow !== value.toRow;
}

function isItemUseResolution(value: unknown): value is ItemUseResolutionView {
  return isRecord(value)
    && exact(value, ["type", "actorId", "round", "itemId", "quantityBefore", "quantityAfter"])
    && value.type === "item-use" && isId(value.actorId)
    && isSafeInteger(value.round) && value.round > 0
    && value.itemId === TEST_COMBAT_CONSUMABLE_ID
    && isSafeInteger(value.quantityBefore) && value.quantityBefore > 0
    && isSafeInteger(value.quantityAfter) && value.quantityAfter === value.quantityBefore - 1;
}

function isDefendResolution(value: unknown): value is DefendResolutionView {
  return isRecord(value) && exact(value, ["type", "actorId", "round"])
    && value.type === "defend" && isId(value.actorId)
    && isSafeInteger(value.round) && value.round > 0;
}

function isRunResolution(value: unknown): value is RunResolutionView {
  return isRecord(value) && exact(value, [
    "type", "actorId", "round", "rawD20", "dexterityModifier", "racialModifier", "total", "dc", "outcome",
  ]) && value.type === "run" && isId(value.actorId) && isSafeInteger(value.round) && value.round > 0
    && isD20(value.rawD20) && isSafeInteger(value.dexterityModifier)
    && (value.racialModifier === 0 || value.racialModifier === -2)
    && isSafeInteger(value.total)
    && value.total === value.rawD20 + value.dexterityModifier + value.racialModifier
    && value.dc === 8 && value.outcome === (value.total >= 8 ? "success" : "failure");
}

function isCastingResolution(value: unknown): value is CastingResolutionView {
  if (!isRecord(value) || !exact(value, ["type", "actorId", "skillId", "round", "mpSpentThisAction", "totalMpSpent", "completedCastingTurns", "totalCastingTurns"])
    || (value.type !== "casting-start" && value.type !== "casting-continue"
      && value.type !== "casting-cancel" && value.type !== "casting-complete")
    || !isId(value.actorId) || value.skillId !== "TEST-skill-2"
    || !isSafeInteger(value.round) || value.round < 1
    || !isSafeInteger(value.completedCastingTurns) || value.completedCastingTurns < 1
    || value.completedCastingTurns > 3 || value.totalCastingTurns !== 3
    || value.totalMpSpent !== value.completedCastingTurns * 6
    || value.mpSpentThisAction !== (value.type === "casting-cancel" ? 0 : 6)) return false;
  return (value.type !== "casting-start" || value.completedCastingTurns === 1)
    && (value.type !== "casting-complete" || value.completedCastingTurns === 3)
    && ((value.type === "casting-complete") || value.completedCastingTurns < 3);
}

function isCastingState(value: unknown): value is CastingStateView {
  return isRecord(value) && exact(value, ["actorId", "skillId", "startedRound", "completedCastingTurns", "totalCastingTurns", "totalMpCost", "mpSpent"])
    && isId(value.actorId) && value.skillId === "TEST-skill-2"
    && isSafeInteger(value.startedRound) && value.startedRound >= 1
    && (value.completedCastingTurns === 1 || value.completedCastingTurns === 2)
    && value.totalCastingTurns === 3 && value.totalMpCost === 18
    && value.mpSpent === value.completedCastingTurns * 6;
}

function isDragonBreathResolution(value: unknown): value is DragonBreathResolutionView {
  if (!isRecord(value) || !exact(value, ["type", "actorId", "round", "element", "targetRow", "readyRound", "results"])
    || value.type !== "dragon-breath" || !isId(value.actorId) || !isSafeInteger(value.round) || value.round < 1
    || (value.element !== "fire" && value.element !== "ice" && value.element !== "lightning")
    || (value.targetRow !== "front" && value.targetRow !== "back")
    || value.readyRound !== value.round + 3 || !Array.isArray(value.results) || value.results.length === 0) return false;
  return value.results.every((result) => isRecord(result)
    && exact(result, ["targetId", "attack", "evasion", "outcome", "critical"])
    && isId(result.targetId) && isRecord(result.attack)
    && exact(result.attack, ["rawD20", "perceptionModifier", "total"])
    && isD20(result.attack.rawD20) && isSafeInteger(result.attack.perceptionModifier)
    && result.attack.total === result.attack.rawD20 + result.attack.perceptionModifier
    && isSafeInteger(result.attack.total) && isRecord(result.evasion)
    && exact(result.evasion, ["rawD20", "dexterityModifier", "total"])
    && isD20(result.evasion.rawD20) && isSafeInteger(result.evasion.dexterityModifier)
    && result.evasion.total === result.evasion.rawD20 + result.evasion.dexterityModifier
    && isSafeInteger(result.evasion.total)
    && result.outcome === (result.attack.total >= result.evasion.total ? "hit" : "miss")
    && result.critical === (result.outcome === "hit" && result.attack.rawD20 >= 19))
    && new Set(value.results.map((result) => (result as Record<string, unknown>).targetId)).size === value.results.length;
}

function resolveTieOrder(participants: readonly CombatParticipantView[], rollIndex: number): string[] | undefined {
  const groups = new Map<number, CombatParticipantView[]>();
  for (const participant of participants) {
    const roll = participant.initiative.tieBreakRolls[rollIndex];
    if (!isD20(roll)) return undefined;
    const group = groups.get(roll) ?? [];
    group.push(participant);
    groups.set(roll, group);
  }
  const order: string[] = [];
  for (const roll of [...groups.keys()].sort((a, b) => b - a)) {
    const group = groups.get(roll)!;
    if (group.length === 1) {
      if (group[0]!.initiative.tieBreakRolls.length !== rollIndex + 1) return undefined;
      order.push(group[0]!.id);
    } else {
      const nested = resolveTieOrder(group, rollIndex + 1);
      if (!nested) return undefined;
      order.push(...nested);
    }
  }
  return order;
}

function expectedTurnOrder(participants: readonly CombatParticipantView[]): string[] | undefined {
  const groups = new Map<number, CombatParticipantView[]>();
  for (const participant of participants) {
    const group = groups.get(participant.initiative.total) ?? [];
    group.push(participant);
    groups.set(participant.initiative.total, group);
  }
  const order: string[] = [];
  for (const total of [...groups.keys()].sort((a, b) => b - a)) {
    const group = groups.get(total)!;
    if (group.length === 1) {
      if (group[0]!.initiative.tieBreakRolls.length !== 0) return undefined;
      order.push(group[0]!.id);
    } else {
      const tied = resolveTieOrder(group, 0);
      if (!tied) return undefined;
      order.push(...tied);
    }
  }
  return order;
}

export function isCombatStateView(value: unknown): value is CombatStateView {
  if (!isRecord(value) || !exact(value, [
    "status", "endReason", "round", "currentTurnIndex", "currentActorId", "turnOrder", "participants", "lastAction", "skillCooldowns", "activeCastings", "racialAbilityCooldowns",
  ])
    || !isSafeInteger(value.round) || value.round < 1
    || (value.status !== "active" && value.status !== "ended")
    || !isIds(value.turnOrder)
    || !Array.isArray(value.participants) || value.participants.length === 0
    || !Array.isArray(value.skillCooldowns) || !Array.isArray(value.activeCastings)
    || !Array.isArray(value.racialAbilityCooldowns)) return false;
  const participants = value.participants.map(parseParticipant);
  if (participants.some((participant) => participant === undefined)) return false;
  const validatedParticipants = participants as CombatParticipantView[];
  const ids = validatedParticipants.map((participant) => participant.id);
  const expected = expectedTurnOrder(validatedParticipants);
  const lastAction = value.lastAction;
  if (lastAction !== null && !isPhysicalAttackResolution(lastAction)
    && !isRowMoveResolution(lastAction) && !isItemUseResolution(lastAction)
    && !isDefendResolution(lastAction) && !isRunResolution(lastAction)
    && !isCastingResolution(lastAction) && !isDragonBreathResolution(lastAction)) return false;
  const actor = lastAction === null
    ? undefined
    : validatedParticipants.find((participant) => participant.id === lastAction.actorId);
  const cooldowns = value.skillCooldowns as unknown[];
  const castings = value.activeCastings as unknown[];
  const racialCooldowns = value.racialAbilityCooldowns as unknown[];
  if (!racialCooldowns.every((entry) => isRecord(entry) && exact(entry, ["actorId", "abilityId", "readyRound"])
    && isId(entry.actorId) && ids.includes(entry.actorId) && entry.abilityId === "dragon-breath"
    && isSafeInteger(entry.readyRound) && entry.readyRound >= 4 && entry.readyRound <= (value.round as number) + 3)
    || new Set(racialCooldowns.map((entry) => (entry as RacialAbilityCooldownView).actorId)).size !== racialCooldowns.length) return false;
  if (!castings.every(isCastingState)
    || new Set(castings.map((entry) => (entry as CastingStateView).actorId)).size !== castings.length
    || castings.some((entry) => {
      const casting = entry as CastingStateView;
      return !ids.includes(casting.actorId) || casting.startedRound > (value.round as number)
        || validatedParticipants.find((participant) => participant.id === casting.actorId)?.side !== "party";
    }) || (value.status === "ended" && castings.length > 0)) return false;
  if (!cooldowns.every((entry) => isRecord(entry) && exact(entry, ["actorId", "skillId", "readyRound"])
    && isId(entry.actorId) && ids.includes(entry.actorId) && entry.skillId === "TEST-skill-1"
    && isSafeInteger(entry.readyRound) && entry.readyRound >= 3 && entry.readyRound <= (value.round as number) + 2)) return false;
  if (new Set(cooldowns.map((entry) => `${(entry as SkillCooldownView).actorId}\u0000${(entry as SkillCooldownView).skillId}`)).size !== cooldowns.length) return false;
  return new Set(ids).size === ids.length
    && value.turnOrder.length === ids.length
    && new Set(value.turnOrder).size === value.turnOrder.length
    && value.turnOrder.every((id, index) => ids.includes(id) && id === expected?.[index])
    && (value.status === "active"
      ? value.endReason === null && isSafeInteger(value.currentTurnIndex)
        && value.currentTurnIndex >= 0 && value.currentTurnIndex < value.turnOrder.length
        && isId(value.currentActorId) && value.currentActorId === value.turnOrder[value.currentTurnIndex]
        && (lastAction?.type !== "run" || lastAction.outcome === "failure")
      : value.endReason === "escaped" && value.currentTurnIndex === null && value.currentActorId === null
        && lastAction?.type === "run" && lastAction.outcome === "success" && lastAction.round === value.round)
    && (lastAction === null || (lastAction.round <= value.round
      && ids.includes(lastAction.actorId) && actor?.side === "party"))
    && (lastAction === null || (lastAction.type !== "normal-attack" && lastAction.type !== "physical-skill")
      || (ids.includes(lastAction.targetId)
        && validatedParticipants.find((participant) => participant.id === lastAction.targetId)?.side === "enemy"))
    && (lastAction?.type !== "physical-skill" || cooldowns.some((entry) => {
      const cooldown = entry as SkillCooldownView;
      return cooldown.actorId === lastAction.actorId && cooldown.skillId === lastAction.skillId
        && cooldown.readyRound === lastAction.readyRound;
    }))
    && (lastAction?.type !== "dragon-breath" || (racialCooldowns.some((entry) => {
      const cooldown = entry as RacialAbilityCooldownView;
      return cooldown.actorId === lastAction.actorId && cooldown.readyRound === lastAction.readyRound;
    }) && lastAction.results.length === validatedParticipants.filter((participant) => participant.side === "enemy"
      && participant.row === lastAction.targetRow).length
      && lastAction.results.every((result) => validatedParticipants.some((participant) => participant.id === result.targetId
      && participant.side === "enemy" && participant.row === lastAction.targetRow
      && participant.initiative.dexterityModifier === result.evasion.dexterityModifier)
      && actor?.normalAttack?.perceptionModifier === result.attack.perceptionModifier)))
    && (lastAction === null || !lastAction.type.startsWith("casting-")
      || ((lastAction.type === "casting-start" || lastAction.type === "casting-continue")
        ? castings.some((entry) => (entry as CastingStateView).actorId === lastAction.actorId
          && (entry as CastingStateView).mpSpent === lastAction.totalMpSpent)
        : !castings.some((entry) => (entry as CastingStateView).actorId === lastAction.actorId)))
    && (lastAction === null || lastAction.type !== "row-move" || actor?.row === lastAction.toRow)
    && (lastAction === null || (lastAction.type !== "item-use" && lastAction.type !== "defend" && lastAction.type !== "run")
      || actor?.normalAttack !== null)
    && (lastAction?.type !== "run" || (lastAction.dexterityModifier === actor?.initiative.dexterityModifier
      && lastAction.racialModifier === actor?.racialEscapeModifier));
}

export function isAuthoritativeGameStateView(value: unknown): value is AuthoritativeGameStateView {
  if (!isRecord(value) || !exact(value, ["revision", "activity", "character", "inventory", "exploration", "combat"])
    || !isSafeInteger(value.revision) || value.revision < 0
    || (value.activity !== "outside-combat" && value.activity !== "in-combat")
    || !isRecord(value.character)
    || !exact(value.character, ["id", "learnedActiveSkillIds", "equippedSkillIds", "currentMp", "raceId", "dragonBreathElement"])
    || !isId(value.character.id) || !isIds(value.character.learnedActiveSkillIds)
    || !isIds(value.character.equippedSkillIds)
    || !isSafeInteger(value.character.currentMp) || value.character.currentMp < 0
    || (value.character.raceId !== null && !isId(value.character.raceId))
    || (value.character.dragonBreathElement !== null && value.character.dragonBreathElement !== "fire"
      && value.character.dragonBreathElement !== "ice" && value.character.dragonBreathElement !== "lightning")
    || (value.character.raceId !== "dragonborn" && value.character.dragonBreathElement !== null)
    || !Array.isArray(value.inventory)
    || !value.inventory.every((entry) => isRecord(entry)
      && exact(entry, ["itemId", "quantity"])
      && entry.itemId === TEST_COMBAT_CONSUMABLE_ID
      && isSafeInteger(entry.quantity) && entry.quantity >= 0)
    || new Set(value.inventory.map((entry) => (entry as Record<string, unknown>).itemId)).size !== value.inventory.length
    || !isRecord(value.exploration)
    || !exact(value.exploration, ["locationId", "lastObservationTargetId"])
    || (value.exploration.locationId !== "TEST-forest-edge" && value.exploration.locationId !== "TEST-ruin-entrance")
    || (value.exploration.lastObservationTargetId !== null && value.exploration.lastObservationTargetId !== "TEST-stone-door")) {
    return false;
  }
  if (value.activity === "outside-combat") return value.combat === null;
  if (!isCombatStateView(value.combat)) return false;
  const lastAction = value.combat.lastAction;
  if (lastAction?.type === "dragon-breath"
    && (value.character.raceId !== "dragonborn"
      || value.character.dragonBreathElement !== lastAction.element)) return false;
  if (lastAction?.type !== "item-use") return true;
  const stack = value.inventory.find((entry) => (entry as Record<string, unknown>).itemId === lastAction.itemId) as
    | Record<string, unknown> | undefined;
  return stack?.quantity === lastAction.quantityAfter;
}

export function isAuthoritativeGameStateResponse(value: unknown): value is AuthoritativeGameStateResponse {
  return isRecord(value) && exact(value, ["sandbox", "storage", "state"])
    && typeof value.sandbox === "boolean"
    && (value.storage === "memory" || value.storage === "postgres")
    && isAuthoritativeGameStateView(value.state);
}

export function isCombatSandboxAdvanceResponse(value: unknown): value is CombatSandboxAdvanceResponse {
  return isRecord(value) && exact(value, ["sandbox", "storage", "effect", "state"])
    && typeof value.sandbox === "boolean"
    && (value.storage === "memory" || value.storage === "postgres")
    && isAuthoritativeGameStateView(value.state)
    && isRecord(value.effect) && exact(value.effect, ["type"])
    && value.effect.type === "combat-turn-advanced";
}

export function isNormalAttackOptionsResponse(value: unknown): value is NormalAttackOptionsResponse {
  if (!isRecord(value) || !exact(value, [
    "revision", "currentActorId", "canPlayerAct", "legalTargetIds", "targets",
  ]) || !isSafeInteger(value.revision) || value.revision < 0 || !isId(value.currentActorId)
    || typeof value.canPlayerAct !== "boolean" || !isIds(value.legalTargetIds)
    || !Array.isArray(value.targets)) return false;
  const targets = value.targets;
  if (!targets.every((target) => isRecord(target)
    && (exact(target, ["targetId", "displayName", "legal"])
      || exact(target, ["targetId", "displayName", "legal", "reason"]))
    && isId(target.targetId) && isId(target.displayName) && typeof target.legal === "boolean"
    && (target.reason === undefined || target.reason === "front-row-blocked")
    && (target.legal ? target.reason === undefined : target.reason === "front-row-blocked"))) return false;
  const ids = targets.map((target) => (target as Record<string, unknown>).targetId);
  const legalIds = targets.filter((target) => (target as Record<string, unknown>).legal === true)
    .map((target) => (target as Record<string, unknown>).targetId);
  return new Set(ids).size === ids.length
    && new Set(value.legalTargetIds).size === value.legalTargetIds.length
    && value.legalTargetIds.length === legalIds.length
    && value.legalTargetIds.every((id, index) => id === legalIds[index])
    && (value.canPlayerAct || (targets.length === 0 && value.legalTargetIds.length === 0));
}

export function isCombatNormalAttackResponse(value: unknown): value is CombatNormalAttackResponse {
  return isRecord(value) && exact(value, ["sandbox", "storage", "effect", "state"])
    && typeof value.sandbox === "boolean"
    && (value.storage === "memory" || value.storage === "postgres")
    && isAuthoritativeGameStateView(value.state)
    && isRecord(value.effect) && exact(value.effect, ["type", "outcome"])
    && value.effect.type === "normal-attack-resolved"
    && (value.effect.outcome === "hit" || value.effect.outcome === "miss")
    && value.state.combat?.lastAction?.type === "normal-attack"
    && value.state.combat.lastAction.outcome === value.effect.outcome;
}

export function isRowMoveOptionsResponse(value: unknown): value is RowMoveOptionsResponse {
  if (!isRecord(value) || !exact(value, [
    "revision", "currentActorId", "currentRow", "canPlayerAct", "legalTargetRows",
  ]) || !isSafeInteger(value.revision) || value.revision < 0 || !isId(value.currentActorId)
    || (value.currentRow !== "front" && value.currentRow !== "back")
    || typeof value.canPlayerAct !== "boolean" || !Array.isArray(value.legalTargetRows)
    || !value.legalTargetRows.every((row) => row === "front" || row === "back")
    || new Set(value.legalTargetRows).size !== value.legalTargetRows.length) return false;
  return value.canPlayerAct
    ? value.legalTargetRows.length === 1 && value.legalTargetRows[0] !== value.currentRow
    : value.legalTargetRows.length === 0;
}

export function isCombatRowMoveResponse(value: unknown): value is CombatRowMoveResponse {
  return isRecord(value) && exact(value, ["sandbox", "storage", "effect", "state"])
    && typeof value.sandbox === "boolean"
    && (value.storage === "memory" || value.storage === "postgres")
    && isAuthoritativeGameStateView(value.state)
    && isRecord(value.effect) && exact(value.effect, ["type"])
    && value.effect.type === "row-move-completed"
    && value.state.combat?.lastAction?.type === "row-move";
}

export function isCombatItemOptionsResponse(value: unknown): value is CombatItemOptionsResponse {
  if (!isRecord(value) || !exact(value, ["revision", "currentActorId", "items"])
    || !isSafeInteger(value.revision) || value.revision < 0 || !isId(value.currentActorId)
    || !Array.isArray(value.items)) return false;
  const validItems = value.items.every((item) => isRecord(item)
    && (exact(item, ["itemId", "displayName", "quantity", "usable"])
      || exact(item, ["itemId", "displayName", "quantity", "usable", "unavailableReason"]))
    && item.itemId === TEST_COMBAT_CONSUMABLE_ID
    && item.displayName === TEST_COMBAT_CONSUMABLE_NAME
    && isSafeInteger(item.quantity) && item.quantity >= 0
    && typeof item.usable === "boolean"
    && (item.usable
      ? item.quantity > 0 && item.unavailableReason === undefined
      : item.unavailableReason === "not-player-turn"
        || item.unavailableReason === "casting-active"
        || (item.unavailableReason === "quantity-depleted" && item.quantity === 0)));
  return validItems && new Set(value.items.map((item) => (item as Record<string, unknown>).itemId)).size === value.items.length;
}

export function isCombatItemUseResponse(value: unknown): value is CombatItemUseResponse {
  if (!isRecord(value) || !exact(value, ["sandbox", "storage", "effect", "state", "options"])
    || typeof value.sandbox !== "boolean"
    || (value.storage !== "memory" && value.storage !== "postgres")
    || !isAuthoritativeGameStateView(value.state)
    || !isRecord(value.effect) || !exact(value.effect, ["type"])
    || value.effect.type !== "combat-item-used"
    || !isCombatItemOptionsResponse(value.options)) return false;
  const state = value.state;
  const action = state.combat?.lastAction;
  return action?.type === "item-use"
    && state.revision > 0
    && value.options.revision === state.revision
    && value.options.currentActorId === state.combat?.currentActorId
    && value.options.items.length === state.inventory.length
    && value.options.items.every((item) => state.inventory.some((stack) =>
      stack.itemId === item.itemId && stack.quantity === item.quantity));
}

export function isCombatDefendResponse(value: unknown): value is CombatDefendResponse {
  return isRecord(value) && exact(value, ["sandbox", "storage", "effect", "state"])
    && typeof value.sandbox === "boolean"
    && (value.storage === "memory" || value.storage === "postgres")
    && isAuthoritativeGameStateView(value.state)
    && isRecord(value.effect) && exact(value.effect, ["type"])
    && value.effect.type === "defend-completed"
    && value.state.combat?.lastAction?.type === "defend";
}

export function isCombatRunResponse(value: unknown): value is CombatRunResponse {
  return isRecord(value) && exact(value, ["sandbox", "storage", "effect", "state"])
    && typeof value.sandbox === "boolean"
    && (value.storage === "memory" || value.storage === "postgres")
    && isAuthoritativeGameStateView(value.state)
    && isRecord(value.effect) && exact(value.effect, ["type", "outcome"])
    && value.effect.type === "run-resolved"
    && (value.effect.outcome === "success" || value.effect.outcome === "failure")
    && value.state.combat?.lastAction?.type === "run"
    && value.state.combat.lastAction.outcome === value.effect.outcome
    && value.state.combat.status === (value.effect.outcome === "success" ? "ended" : "active");
}

export function isPhysicalSkillOptionsResponse(value: unknown): value is PhysicalSkillOptionsResponse {
  if (!isRecord(value) || !exact(value, ["revision", "currentActorId", "skills"])
    || !isSafeInteger(value.revision) || value.revision < 0 || !isId(value.currentActorId)
    || !Array.isArray(value.skills)) return false;
  return value.skills.every((skill) => isRecord(skill)
    && (exact(skill, ["skillId", "displayName", "category", "targetMode", "range", "usable", "readyRound", "targets"])
      || exact(skill, ["skillId", "displayName", "category", "targetMode", "range", "usable", "unavailableReason", "readyRound", "targets"]))
    && skill.skillId === "TEST-skill-1" && skill.displayName === "TEST 物理技能"
    && skill.category === "physical-active" && skill.targetMode === "single-enemy" && skill.range === "melee"
    && typeof skill.usable === "boolean"
    && (skill.readyRound === null || (isSafeInteger(skill.readyRound) && skill.readyRound >= 3))
    && (skill.usable ? skill.unavailableReason === undefined
      : skill.unavailableReason === "not-player-turn" || skill.unavailableReason === "skill-on-cooldown"
        || skill.unavailableReason === "no-legal-target" || skill.unavailableReason === "casting-active")
    && (skill.unavailableReason !== "skill-on-cooldown" || skill.readyRound !== null)
    && Array.isArray(skill.targets)
    && skill.targets.every((target) => isRecord(target)
      && (exact(target, ["targetId", "displayName", "legal"])
        || exact(target, ["targetId", "displayName", "legal", "reason"]))
      && isId(target.targetId) && isId(target.displayName) && typeof target.legal === "boolean"
      && (target.legal ? target.reason === undefined : target.reason === "front-row-blocked"))
    && new Set(skill.targets.map((target) => (target as NormalAttackTargetOptionView).targetId)).size === skill.targets.length)
    && new Set(value.skills.map((skill) => (skill as PhysicalSkillOptionView).skillId)).size === value.skills.length;
}

export function isPhysicalSkillUseResponse(value: unknown): value is PhysicalSkillUseResponse {
  return isRecord(value) && exact(value, ["sandbox", "storage", "effect", "state"])
    && typeof value.sandbox === "boolean" && (value.storage === "memory" || value.storage === "postgres")
    && isAuthoritativeGameStateView(value.state)
    && isRecord(value.effect) && exact(value.effect, ["type", "outcome"])
    && value.effect.type === "physical-skill-resolved"
    && (value.effect.outcome === "hit" || value.effect.outcome === "miss")
    && value.state.combat?.lastAction?.type === "physical-skill"
    && value.state.combat.lastAction.outcome === value.effect.outcome;
}

export function isCastingResponse(value: unknown): value is CastingResponse {
  if (!isRecord(value) || !exact(value, ["sandbox", "storage", "effect", "state"])
    || typeof value.sandbox !== "boolean" || (value.storage !== "memory" && value.storage !== "postgres")
    || !isAuthoritativeGameStateView(value.state) || !isRecord(value.effect)
    || !exact(value.effect, ["type"])) return false;
  const action = value.state.combat?.lastAction;
  return (value.effect.type === "casting-started" && action?.type === "casting-start")
    || (value.effect.type === "casting-continued" && action?.type === "casting-continue")
    || (value.effect.type === "casting-cancelled" && action?.type === "casting-cancel")
    || (value.effect.type === "casting-completed" && action?.type === "casting-complete");
}

export function isDragonBreathOptionsResponse(value: unknown): value is DragonBreathOptionsResponse {
  if (!isRecord(value) || !(exact(value, ["revision", "currentActorId", "currentRound", "element", "readyRound", "available", "rows"])
    || exact(value, ["revision", "currentActorId", "currentRound", "element", "readyRound", "available", "unavailableReason", "rows"]))
    || !isSafeInteger(value.revision) || value.revision < 0 || !isId(value.currentActorId)
    || !isSafeInteger(value.currentRound) || value.currentRound < 1
    || (value.element !== null && value.element !== "fire" && value.element !== "ice" && value.element !== "lightning")
    || (value.readyRound !== null && (!isSafeInteger(value.readyRound) || value.readyRound < 4))
    || typeof value.available !== "boolean" || !Array.isArray(value.rows) || value.rows.length !== 2) return false;
  const reasons = ["not-player-turn", "not-dragonborn", "element-unresolved", "casting-active", "ability-on-cooldown", "no-target-row"];
  return (value.available ? value.unavailableReason === undefined : reasons.includes(value.unavailableReason as string))
    && (value.unavailableReason !== "ability-on-cooldown" || value.readyRound !== null)
    && value.rows.every((row) => isRecord(row)
      && (exact(row, ["row", "targetCount", "available"])
        || exact(row, ["row", "targetCount", "available", "unavailableReason"]))
      && (row.row === "front" || row.row === "back")
      && isSafeInteger(row.targetCount) && row.targetCount >= 0
      && row.available === (row.targetCount > 0)
      && (row.available ? row.unavailableReason === undefined : row.unavailableReason === "empty-target-row"))
    && new Set(value.rows.map((row) => (row as Record<string, unknown>).row)).size === 2;
}

export function isDragonBreathResponse(value: unknown): value is DragonBreathResponse {
  return isRecord(value) && exact(value, ["sandbox", "storage", "effect", "state"])
    && typeof value.sandbox === "boolean" && (value.storage === "memory" || value.storage === "postgres")
    && isAuthoritativeGameStateView(value.state)
    && isRecord(value.effect) && exact(value.effect, ["type"])
    && value.effect.type === "dragon-breath-resolved"
    && value.state.combat?.lastAction?.type === "dragon-breath"
    && value.state.character.raceId === "dragonborn"
    && value.state.character.dragonBreathElement === value.state.combat.lastAction.element;
}
