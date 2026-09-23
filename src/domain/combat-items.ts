import {
  getCombatItemDefinition,
  TEST_COMBAT_CONSUMABLE_ID,
} from "../shared/combat-items.js";
export { COMBAT_ITEM_CATALOG, getCombatItemDefinition, TEST_COMBAT_CONSUMABLE_ID, TEST_COMBAT_CONSUMABLE_NAME }
  from "../shared/combat-items.js";
export type { CombatItemDefinition } from "../shared/combat-items.js";

export interface InventoryStack {
  readonly itemId: typeof TEST_COMBAT_CONSUMABLE_ID;
  readonly quantity: number;
}

export function createTestCombatInventory(): readonly InventoryStack[] {
  return Object.freeze([Object.freeze({ itemId: TEST_COMBAT_CONSUMABLE_ID, quantity: 2 })]);
}

export function isInventory(value: unknown): value is readonly InventoryStack[] {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const entry of value) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return false;
    const stack = entry as Record<string, unknown>;
    if (Object.keys(stack).length !== 2 || !Object.hasOwn(stack, "itemId")
      || !Object.hasOwn(stack, "quantity") || typeof stack.itemId !== "string"
      || stack.itemId.length === 0 || stack.itemId.trim() !== stack.itemId
      || !getCombatItemDefinition(stack.itemId) || !Number.isSafeInteger(stack.quantity)
      || (stack.quantity as number) < 0 || seen.has(stack.itemId)) return false;
    seen.add(stack.itemId);
  }
  return true;
}

export function normalizeInventory(value: readonly InventoryStack[]): readonly InventoryStack[] {
  return Object.freeze(value.map((stack) => Object.freeze({
    itemId: stack.itemId,
    quantity: stack.quantity,
  })));
}
