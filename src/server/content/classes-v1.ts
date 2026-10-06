import type { OfficialClassCatalog } from "../../shared/class-catalog.js";

/** Canon: docs/gameplay/classes.md. Metadata only; not a combat executor or character loadout. */
export const OFFICIAL_CLASSES_V1: OfficialClassCatalog = {
  schemaVersion: 1, catalogVersion: 1, namespace: "official", scope: "initial-class-metadata",
  classes: [
    { id: "class.swordsman", name: "劍士", tier: "initial", primaryAttribute: "strength",
      attributeMultipliers: { strength: 1.25, dexterity: 1, constitution: 1, intelligence: 1, perception: 1, charisma: 1 },
      passive: { name: "劍術專長", description: "劍術主動技能命中後，傷害 +10%。",
        effect: { kind: "sword-active-skill-damage", multiplier: 1.1 } } },
    { id: "class.archer", name: "弓箭手", tier: "initial", primaryAttribute: "perception",
      attributeMultipliers: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, perception: 1.25, charisma: 1 },
      passive: { name: "精準射擊", description: "射擊主動技能的攻擊判定 +1。",
        effect: { kind: "shooting-active-skill-attack-check", bonus: 1 } } },
    { id: "class.scout", name: "斥候", tier: "initial", primaryAttribute: "dexterity",
      attributeMultipliers: { strength: 1, dexterity: 1.25, constitution: 1, intelligence: 1, perception: 1, charisma: 1 },
      passive: { name: "靈活身法", description: "閃避判定 +1。", effect: { kind: "evasion-check", bonus: 1 } } },
    { id: "class.mage", name: "魔術師", tier: "initial", primaryAttribute: "intelligence",
      attributeMultipliers: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1.25, perception: 1, charisma: 1 },
      passive: { name: "施法節約", description: "符合資格的直接施法或魔法書施法，總 MP 成本減少 10%，向上取整；原成本大於零時最低 1，零成本仍為零。",
        effect: { kind: "qualified-casting-total-mp", multiplier: 0.9, rounding: "ceil", positiveMinimum: 1, zeroCost: 0,
          sources: ["direct", "spellbook"] } } },
  ],
};
