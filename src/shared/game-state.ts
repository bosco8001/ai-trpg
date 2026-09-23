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

export interface CombatStateView {
  readonly round: number;
  readonly currentTurnIndex: number;
  readonly currentActorId: string;
  readonly turnOrder: readonly string[];
  readonly participants: readonly CombatParticipantView[];
  readonly lastAction: NormalAttackResolutionView | null;
}

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

export interface CombatNormalAttackResponse extends AuthoritativeGameStateResponse {
  readonly effect: { readonly type: "normal-attack-resolved"; readonly outcome: "hit" | "miss" };
}

export interface AuthoritativeGameStateView {
  readonly revision: number;
  readonly activity: "outside-combat" | "in-combat";
  readonly character: {
    readonly id: string;
    readonly learnedActiveSkillIds: readonly string[];
    readonly equippedSkillIds: readonly string[];
  };
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
  if (!isRecord(value) || !exact(value, ["id", "displayName", "side", "row", "initiative", "normalAttack"])
    || !isId(value.id) || !isId(value.displayName)
    || (value.side !== "party" && value.side !== "enemy")
    || (value.row !== "front" && value.row !== "back")
    || !isNormalAttackProfile(value.normalAttack)
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

function isNormalAttackResolution(value: unknown): value is NormalAttackResolutionView {
  return isRecord(value)
    && exact(value, ["type", "round", "actorId", "targetId", "attack", "evasion", "outcome"])
    && value.type === "normal-attack" && isSafeInteger(value.round) && value.round > 0
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
    "round", "currentTurnIndex", "currentActorId", "turnOrder", "participants", "lastAction",
  ])
    || !isSafeInteger(value.round) || value.round < 1
    || !isSafeInteger(value.currentTurnIndex) || value.currentTurnIndex < 0
    || !isId(value.currentActorId) || !isIds(value.turnOrder)
    || !Array.isArray(value.participants) || value.participants.length === 0) return false;
  const participants = value.participants.map(parseParticipant);
  if (participants.some((participant) => participant === undefined)) return false;
  const validatedParticipants = participants as CombatParticipantView[];
  const ids = validatedParticipants.map((participant) => participant.id);
  const expected = expectedTurnOrder(validatedParticipants);
  const lastAction = value.lastAction;
  if (lastAction !== null && !isNormalAttackResolution(lastAction)) return false;
  return new Set(ids).size === ids.length
    && value.turnOrder.length === ids.length
    && new Set(value.turnOrder).size === value.turnOrder.length
    && value.turnOrder.every((id, index) => ids.includes(id) && id === expected?.[index])
    && value.currentTurnIndex < value.turnOrder.length
    && value.currentActorId === value.turnOrder[value.currentTurnIndex]
    && (lastAction === null || (lastAction.round <= value.round
      && ids.includes(lastAction.actorId) && ids.includes(lastAction.targetId)
      && validatedParticipants.find((participant) => participant.id === lastAction.actorId)?.side === "party"
      && validatedParticipants.find((participant) => participant.id === lastAction.targetId)?.side === "enemy"));
}

export function isAuthoritativeGameStateView(value: unknown): value is AuthoritativeGameStateView {
  if (!isRecord(value) || !exact(value, ["revision", "activity", "character", "exploration", "combat"])
    || !isSafeInteger(value.revision) || value.revision < 0
    || (value.activity !== "outside-combat" && value.activity !== "in-combat")
    || !isRecord(value.character)
    || !exact(value.character, ["id", "learnedActiveSkillIds", "equippedSkillIds"])
    || !isId(value.character.id) || !isIds(value.character.learnedActiveSkillIds)
    || !isIds(value.character.equippedSkillIds)
    || !isRecord(value.exploration)
    || !exact(value.exploration, ["locationId", "lastObservationTargetId"])
    || (value.exploration.locationId !== "TEST-forest-edge" && value.exploration.locationId !== "TEST-ruin-entrance")
    || (value.exploration.lastObservationTargetId !== null && value.exploration.lastObservationTargetId !== "TEST-stone-door")) {
    return false;
  }
  return value.activity === "outside-combat" ? value.combat === null : isCombatStateView(value.combat);
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
    && value.state.combat?.lastAction?.outcome === value.effect.outcome;
}
