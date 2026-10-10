import type { ClassAttribute } from "../../shared/class-catalog.js";
import type { OfficialStarterKitCatalog } from "../../shared/starter-kit-catalog.js";

const bonus = (attribute?: ClassAttribute, amount = 1) => ({ strength: 0, dexterity: 0, constitution: 0,
  intelligence: 0, perception: 0, charisma: 0, ...(attribute ? { [attribute]: amount } : {}) });
/** Canon: docs/gameplay/starter_kits.md. Readonly metadata; unresolved combat values are deliberately absent. */
export const OFFICIAL_STARTER_KITS_V1: OfficialStarterKitCatalog = {
  schemaVersion: 1, catalogVersion: 1, namespace: "official", scope: "starter-kit-metadata", classCatalogVersion: 1,
  items: [
    { id: "item.one-handed-sword", name: "單手劍", kind: "weapon", weaponFamily: "sword",
      requirement: { attribute: "strength", minimum: 10 }, attributeBonuses: bonus("strength"), armor: 0 },
    { id: "item.shortbow", name: "短弓", kind: "weapon", weaponFamily: "bow",
      requirement: { attribute: "dexterity", minimum: 10 }, attributeBonuses: bonus("perception"), armor: 0 },
    { id: "item.dagger", name: "匕首", kind: "weapon", weaponFamily: "dagger",
      requirement: { attribute: "dexterity", minimum: 10 }, attributeBonuses: bonus("dexterity"), armor: 0 },
    { id: "item.wooden-staff", name: "普通木杖", kind: "weapon", weaponFamily: "staff",
      requirement: { attribute: "strength", minimum: 6 }, attributeBonuses: bonus(), armor: 0 },
    { id: "item.chainmail", name: "鎖甲", kind: "body-armor",
      requirement: { attribute: "strength", minimum: 10 }, attributeBonuses: bonus("constitution"), armor: 3 },
    { id: "item.leather-armor", name: "皮甲", kind: "body-armor",
      requirement: { attribute: "dexterity", minimum: 10 }, attributeBonuses: bonus("dexterity"), armor: 2 },
    { id: "item.cloth-robe", name: "布袍", kind: "body-armor",
      requirement: { attribute: "intelligence", minimum: 10 }, attributeBonuses: bonus("intelligence", 2), armor: 1 },
    { id: "item.fire-arrow-spellbook", name: "火焰箭魔法書", kind: "spellbook", spellId: "spell.fire-arrow",
      requirement: { attribute: "intelligence", minimum: 12 }, attributeBonuses: bonus(), armor: 0 },
  ],
  abilities: [
    { id: "skill.heavy-slash", name: "重斬", kind: "physical-skill", description: "偏傷害的單體劍術。",
      requirement: { attribute: "strength", minimum: 15 }, attributeBonuses: bonus("strength"), combatRules: "unresolved",
      source: { kind: "learned-with-active-weapon", weaponFamily: "sword" } },
    { id: "skill.aimed-shot", name: "瞄準射擊", kind: "physical-skill", description: "偏命中的單體射擊。",
      requirement: { attribute: "perception", minimum: 15 }, attributeBonuses: bonus("perception"), combatRules: "unresolved",
      source: { kind: "learned-with-active-weapon", weaponFamily: "bow" } },
    { id: "skill.swift-thrust", name: "迅刺", kind: "physical-skill", description: "敏捷型單體近戰；名稱不代表額外攻擊或行動。",
      requirement: { attribute: "dexterity", minimum: 15 }, attributeBonuses: bonus("dexterity"), combatRules: "unresolved",
      source: { kind: "learned-with-active-weapon", weaponFamily: "dagger" } },
    { id: "spell.fire-arrow", name: "火焰箭", kind: "spell", element: "fire", description: "單體火元素法術；不需要木杖。",
      requirement: { attribute: "intelligence", minimum: 15 }, attributeBonuses: bonus("intelligence"), combatRules: "unresolved",
      source: { kind: "spellbook-or-qualified-learned", spellbookId: "item.fire-arrow-spellbook" } },
  ],
  kits: [
    { id: "starter-kit.swordsman", classId: "class.swordsman", itemIds: ["item.one-handed-sword", "item.chainmail"],
      ability: { id: "skill.heavy-slash", acquisition: "learned" }, weaponProficiency: "sword" },
    { id: "starter-kit.archer", classId: "class.archer", itemIds: ["item.shortbow", "item.leather-armor"],
      ability: { id: "skill.aimed-shot", acquisition: "learned" }, weaponProficiency: "bow" },
    { id: "starter-kit.scout", classId: "class.scout", itemIds: ["item.dagger", "item.leather-armor"],
      ability: { id: "skill.swift-thrust", acquisition: "learned" }, weaponProficiency: "dagger" },
    { id: "starter-kit.mage", classId: "class.mage", itemIds: ["item.wooden-staff", "item.cloth-robe", "item.fire-arrow-spellbook"],
      ability: { id: "spell.fire-arrow", acquisition: "spellbook" }, weaponProficiency: "staff" },
  ],
};
