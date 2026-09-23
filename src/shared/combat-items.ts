/** Only the Phase 15 engineering fixture is listed here; this is not world lore. */
export const TEST_COMBAT_CONSUMABLE_ID = "TEST-combat-consumable" as const;
export const TEST_COMBAT_CONSUMABLE_NAME = "TEST 戰鬥消耗品" as const;

export interface CombatItemDefinition {
  readonly itemId: string;
  readonly displayName: string;
  readonly consumable: boolean;
  readonly usage: "self";
}

export const COMBAT_ITEM_CATALOG: Readonly<Record<string, CombatItemDefinition>> = Object.freeze({
  [TEST_COMBAT_CONSUMABLE_ID]: Object.freeze({
    itemId: TEST_COMBAT_CONSUMABLE_ID,
    displayName: TEST_COMBAT_CONSUMABLE_NAME,
    consumable: true,
    usage: "self",
  }),
});

export function getCombatItemDefinition(itemId: string): CombatItemDefinition | undefined {
  return Object.hasOwn(COMBAT_ITEM_CATALOG, itemId) ? COMBAT_ITEM_CATALOG[itemId] : undefined;
}

export function getCombatItemDisplayName(itemId: string): string | undefined {
  return getCombatItemDefinition(itemId)?.displayName;
}
