/** TEST ONLY · ENGINEERING FIXTURE · NOT CANONICAL BALANCE. */
export const TEST_COMBAT_HEALTH: Readonly<Record<string, number>> = Object.freeze({
  "TEST-player": 10,
  "TEST-companion-1": 8,
  "TEST-enemy-1": 6,
  "TEST-enemy-2": 6,
});

export type CombatHealth = Readonly<{
  maxHp: number;
  currentHp: number;
  lifeState: "active" | "dying" | "dead";
  dyingTurnsRemaining: 1 | 2 | null;
}>;

export function isCombatHealth(value: unknown): value is CombatHealth {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const health = value as Record<string, unknown>;
  if (Object.keys(health).length !== 4 || !Object.hasOwn(health, "maxHp")
    || !Object.hasOwn(health, "currentHp") || !Object.hasOwn(health, "lifeState")
    || !Object.hasOwn(health, "dyingTurnsRemaining")
    || !Number.isSafeInteger(health.maxHp) || (health.maxHp as number) < 1
    || !Number.isSafeInteger(health.currentHp) || (health.currentHp as number) < 0
    || (health.currentHp as number) > (health.maxHp as number)) return false;
  if (health.lifeState === "active") return (health.currentHp as number) > 0 && health.dyingTurnsRemaining === null;
  if (health.lifeState === "dying") return health.currentHp === 0
    && (health.dyingTurnsRemaining === 1 || health.dyingTurnsRemaining === 2);
  return health.lifeState === "dead" && health.currentHp === 0 && health.dyingTurnsRemaining === null;
}

export function initialTestHealth(id: string): CombatHealth | undefined {
  const maxHp = TEST_COMBAT_HEALTH[id];
  return maxHp === undefined ? undefined : Object.freeze({ maxHp, currentHp: maxHp,
    lifeState: "active", dyingTurnsRemaining: null });
}
