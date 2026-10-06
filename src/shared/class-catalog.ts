import { CONTENT_ATTRIBUTES } from "./content-catalog.js";

export const INITIAL_CLASS_IDS = ["class.swordsman", "class.archer", "class.scout", "class.mage"] as const;
export type InitialClassId = typeof INITIAL_CLASS_IDS[number];
export type ClassAttribute = typeof CONTENT_ATTRIBUTES[number];
export type ClassPassiveEffect =
  | { readonly kind: "sword-active-skill-damage"; readonly multiplier: 1.1 }
  | { readonly kind: "shooting-active-skill-attack-check"; readonly bonus: 1 }
  | { readonly kind: "evasion-check"; readonly bonus: 1 }
  | { readonly kind: "qualified-casting-total-mp"; readonly multiplier: 0.9;
      readonly rounding: "ceil"; readonly positiveMinimum: 1; readonly zeroCost: 0;
      readonly sources: readonly ["direct", "spellbook"] };
export interface OfficialClassDefinition {
  readonly id: InitialClassId;
  readonly name: string;
  readonly tier: "initial";
  readonly primaryAttribute: ClassAttribute;
  readonly attributeMultipliers: Readonly<Record<ClassAttribute, number>>;
  readonly passive: { readonly name: string; readonly description: string; readonly effect: ClassPassiveEffect };
}
export interface OfficialClassCatalog {
  readonly schemaVersion: 1;
  /** Independent from the race catalog's version numbering. */
  readonly catalogVersion: 1;
  readonly namespace: "official";
  readonly scope: "initial-class-metadata";
  readonly classes: readonly OfficialClassDefinition[];
}
export const CLASS_MESSAGES = {
  "invalid-request": "職業查詢格式不正確。",
  "unsupported-version": "目前不支援這個正式職業版本。",
  "unknown-content": "這個版本沒有該正式職業；TEST 資料不能代替正式內容。",
} as const;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: readonly string[]) => Object.keys(v).length === expected.length
  && expected.every(k => Object.hasOwn(v, k));
const text = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max && v.trim() === v;
const primaryById = { "class.swordsman": "strength", "class.archer": "perception",
  "class.scout": "dexterity", "class.mage": "intelligence" } as const;
function validEffect(id: InitialClassId, v: unknown): boolean {
  if (!object(v)) return false;
  switch (id) {
    case "class.swordsman": return keys(v, ["kind", "multiplier"]) && v.kind === "sword-active-skill-damage" && v.multiplier === 1.1;
    case "class.archer": return keys(v, ["kind", "bonus"]) && v.kind === "shooting-active-skill-attack-check" && v.bonus === 1;
    case "class.scout": return keys(v, ["kind", "bonus"]) && v.kind === "evasion-check" && v.bonus === 1;
    case "class.mage": return keys(v, ["kind", "multiplier", "rounding", "positiveMinimum", "zeroCost", "sources"])
      && v.kind === "qualified-casting-total-mp" && v.multiplier === 0.9 && v.rounding === "ceil"
      && v.positiveMinimum === 1 && v.zeroCost === 0 && Array.isArray(v.sources)
      && v.sources.length === 2 && v.sources[0] === "direct" && v.sources[1] === "spellbook";
  }
}
export function isOfficialClassDefinition(v: unknown): v is OfficialClassDefinition {
  if (!object(v) || !keys(v, ["id", "name", "tier", "primaryAttribute", "attributeMultipliers", "passive"])
    || typeof v.id !== "string" || !INITIAL_CLASS_IDS.includes(v.id as InitialClassId)
    || !text(v.name, 40) || v.tier !== "initial" || v.primaryAttribute !== primaryById[v.id as InitialClassId]) return false;
  const multipliers = v.attributeMultipliers, passive = v.passive;
  return object(multipliers) && keys(multipliers, CONTENT_ATTRIBUTES)
    && CONTENT_ATTRIBUTES.every(k => multipliers[k] === (k === v.primaryAttribute ? 1.25 : 1))
    && object(passive) && keys(passive, ["name", "description", "effect"])
    && text(passive.name, 40) && text(passive.description, 240) && validEffect(v.id as InitialClassId, passive.effect);
}
export function isOfficialClassCatalog(v: unknown): v is OfficialClassCatalog {
  if (!object(v)) return false;
  const classes = v.classes;
  return keys(v, ["schemaVersion", "catalogVersion", "namespace", "scope", "classes"])
    && v.schemaVersion === 1 && v.catalogVersion === 1 && v.namespace === "official" && v.scope === "initial-class-metadata"
    && Array.isArray(classes) && classes.length === 4 && classes.every(isOfficialClassDefinition)
    && INITIAL_CLASS_IDS.every(id => classes.some(c => c?.id === id));
}
