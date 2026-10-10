import { CONTENT_ATTRIBUTES } from "./content-catalog.js";
import { INITIAL_CLASS_IDS, type ClassAttribute, type InitialClassId } from "./class-catalog.js";

export const STARTER_ITEM_IDS = ["item.one-handed-sword", "item.shortbow", "item.dagger", "item.wooden-staff",
  "item.chainmail", "item.leather-armor", "item.cloth-robe", "item.fire-arrow-spellbook"] as const;
export const STARTER_ABILITY_IDS = ["skill.heavy-slash", "skill.aimed-shot", "skill.swift-thrust", "spell.fire-arrow"] as const;
export const STARTER_KIT_IDS = ["starter-kit.swordsman", "starter-kit.archer", "starter-kit.scout", "starter-kit.mage"] as const;
export type StarterItemId = typeof STARTER_ITEM_IDS[number];
export type StarterAbilityId = typeof STARTER_ABILITY_IDS[number];
export type StarterKitId = typeof STARTER_KIT_IDS[number];
export type StarterWeaponFamily = "sword" | "bow" | "dagger" | "staff";
export interface StarterRequirement { readonly attribute: ClassAttribute; readonly minimum: number }
type Bonuses = Readonly<Record<ClassAttribute, number>>;
interface ItemMetadata {
  readonly id: StarterItemId; readonly name: string; readonly requirement: StarterRequirement;
  readonly attributeBonuses: Bonuses; readonly armor: number;
}
export type OfficialStarterItem = ItemMetadata & (
  | { readonly kind: "weapon"; readonly weaponFamily: StarterWeaponFamily }
  | { readonly kind: "body-armor" }
  | { readonly kind: "spellbook"; readonly spellId: "spell.fire-arrow" }
);
interface AbilityMetadata {
  readonly id: StarterAbilityId; readonly name: string; readonly description: string;
  readonly requirement: StarterRequirement; readonly attributeBonuses: Bonuses;
  /** Missing battle values must never be interpreted as free/instant/zero damage. */
  readonly combatRules: "unresolved";
}
export type OfficialStarterAbility = AbilityMetadata & (
  | { readonly kind: "physical-skill"; readonly source: { readonly kind: "learned-with-active-weapon"; readonly weaponFamily: StarterWeaponFamily } }
  | { readonly kind: "spell"; readonly element: "fire";
      readonly source: { readonly kind: "spellbook-or-qualified-learned"; readonly spellbookId: "item.fire-arrow-spellbook" } }
);
export interface OfficialStarterKit {
  readonly id: StarterKitId; readonly classId: InitialClassId;
  /** One of each item; this is a catalog, not a grant command. */
  readonly itemIds: readonly StarterItemId[];
  readonly ability: { readonly id: StarterAbilityId; readonly acquisition: "learned" | "spellbook" };
  readonly weaponProficiency: StarterWeaponFamily;
}
export interface OfficialStarterKitCatalog {
  readonly schemaVersion: 1; readonly catalogVersion: 1; readonly namespace: "official";
  readonly scope: "starter-kit-metadata"; readonly classCatalogVersion: 1;
  readonly items: readonly OfficialStarterItem[]; readonly abilities: readonly OfficialStarterAbility[];
  readonly kits: readonly OfficialStarterKit[];
}
export const STARTER_MESSAGES = {
  "invalid-request": "起始配套查詢格式不正確。",
  "unsupported-version": "目前不支援這個正式起始配套版本。",
  "unknown-content": "這個版本沒有該正式配套內容；TEST 資料不能代替正式內容。",
} as const;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: readonly string[]) => Object.keys(v).length === expected.length
  && expected.every(k => Object.hasOwn(v, k));
const text = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max && v.trim() === v;
const integer = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const has = <T extends string>(ids: readonly T[], v: unknown): v is T => typeof v === "string" && ids.includes(v as T);
const families = ["sword", "bow", "dagger", "staff"] as const;
function requirement(v: unknown): v is StarterRequirement {
  return object(v) && keys(v, ["attribute", "minimum"]) && has(CONTENT_ATTRIBUTES, v.attribute) && integer(v.minimum, 1, 100);
}
function bonuses(v: unknown): v is Bonuses {
  return object(v) && keys(v, CONTENT_ATTRIBUTES) && CONTENT_ATTRIBUTES.every(k => integer(v[k], 0, 100));
}
function item(v: unknown): v is OfficialStarterItem {
  if (!object(v) || !has(STARTER_ITEM_IDS, v.id) || !text(v.name, 40)
    || !requirement(v.requirement) || !bonuses(v.attributeBonuses) || !integer(v.armor, 0, 100)) return false;
  const common = ["id", "name", "requirement", "attributeBonuses", "armor", "kind"];
  const index = STARTER_ITEM_IDS.indexOf(v.id);
  if (index < 4) return v.kind === "weapon" && keys(v, [...common, "weaponFamily"])
    && v.weaponFamily === families[index] && v.armor === 0;
  if (index < 7) return v.kind === "body-armor" && keys(v, common);
  return v.kind === "spellbook" && keys(v, [...common, "spellId"]) && v.spellId === "spell.fire-arrow" && v.armor === 0;
}
function ability(v: unknown): v is OfficialStarterAbility {
  if (!object(v) || !has(STARTER_ABILITY_IDS, v.id) || !text(v.name, 40) || !text(v.description, 240)
    || !requirement(v.requirement) || !bonuses(v.attributeBonuses) || v.combatRules !== "unresolved" || !object(v.source)) return false;
  const common = ["id", "name", "description", "requirement", "attributeBonuses", "combatRules", "kind", "source"];
  const index = STARTER_ABILITY_IDS.indexOf(v.id);
  if (index < 3) return keys(v, common) && v.kind === "physical-skill"
    && keys(v.source, ["kind", "weaponFamily"]) && v.source.kind === "learned-with-active-weapon"
    && v.source.weaponFamily === families[index];
  return keys(v, [...common, "element"]) && v.kind === "spell" && v.element === "fire"
    && keys(v.source, ["kind", "spellbookId"]) && v.source.kind === "spellbook-or-qualified-learned"
    && v.source.spellbookId === "item.fire-arrow-spellbook";
}
function kit(v: unknown): v is OfficialStarterKit {
  if (!object(v) || !keys(v, ["id", "classId", "itemIds", "ability", "weaponProficiency"])
    || !has(STARTER_KIT_IDS, v.id) || !has(INITIAL_CLASS_IDS, v.classId)
    || !Array.isArray(v.itemIds) || !Array.from(v.itemIds).every(id => has(STARTER_ITEM_IDS, id))
    || new Set(v.itemIds).size !== v.itemIds.length || !object(v.ability) || !keys(v.ability, ["id", "acquisition"])) return false;
  const index = STARTER_KIT_IDS.indexOf(v.id);
  return v.classId === INITIAL_CLASS_IDS[index] && v.weaponProficiency === families[index]
    && v.ability.id === STARTER_ABILITY_IDS[index] && v.ability.acquisition === (index === 3 ? "spellbook" : "learned")
    && v.itemIds.length === (index === 3 ? 3 : 2);
}
function complete<T extends { readonly id: string }>(v: unknown, ids: readonly string[], check: (v: unknown) => v is T): v is T[] {
  return Array.isArray(v) && v.length === ids.length && Array.from(v).every(check)
    && new Set(v.map(e => e.id)).size === ids.length && ids.every(id => v.some(e => e.id === id));
}
export function isOfficialStarterKitCatalog(v: unknown): v is OfficialStarterKitCatalog {
  if (!object(v) || !keys(v, ["schemaVersion", "catalogVersion", "namespace", "scope", "classCatalogVersion", "items", "abilities", "kits"])
    || v.schemaVersion !== 1 || v.catalogVersion !== 1 || v.namespace !== "official" || v.scope !== "starter-kit-metadata"
    || v.classCatalogVersion !== 1 || !complete(v.items, STARTER_ITEM_IDS, item)
    || !complete(v.abilities, STARTER_ABILITY_IDS, ability) || !complete(v.kits, STARTER_KIT_IDS, kit)) return false;
  const items = v.items;
  return v.kits.every(k => {
    const equipment = k.itemIds.map(id => items.find(e => e.id === id));
    const expectedArmor = k.classId === "class.swordsman" ? "item.chainmail"
      : k.classId === "class.mage" ? "item.cloth-robe" : "item.leather-armor";
    return equipment.filter(e => e?.kind === "weapon" && e.weaponFamily === k.weaponProficiency).length === 1
      && equipment.some(e => e?.id === expectedArmor)
      && (k.classId !== "class.mage" || equipment.some(e => e?.kind === "spellbook" && e.spellId === k.ability.id));
  });
}
