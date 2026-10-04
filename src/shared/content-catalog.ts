export const CONTENT_ATTRIBUTES = ["strength", "dexterity", "constitution", "intelligence", "perception", "charisma"] as const;
export const CONTENT_ATTRIBUTE_LABELS = { strength: "力量", dexterity: "敏捷", constitution: "體質",
  intelligence: "智慧", perception: "感知", charisma: "魅力" } as const;
export const CONTENT_APTITUDES = ["low", "ordinary", "high", "exceptional"] as const;
export const CONTENT_APTITUDE_LABELS = { low: "低", ordinary: "普通", high: "高", exceptional: "極高" } as const;
export const CONTENT_KINDS = ["race", "class", "item", "skill", "spell"] as const;
export type ContentKind = typeof CONTENT_KINDS[number];
export interface OfficialRaceDefinition {
  readonly id: string;
  readonly name: string;
  readonly attributeModifiers: Readonly<Record<typeof CONTENT_ATTRIBUTES[number], number>>;
  readonly freeAttributePoints: number;
  readonly aptitudePercent: Readonly<Record<typeof CONTENT_APTITUDES[number], number>>;
  readonly aptitudeReveal: "after-creation";
}
export interface OfficialContentCatalog {
  readonly schemaVersion: 1;
  readonly catalogVersion: 2;
  readonly namespace: "official";
  readonly scope: "race-creation-metadata";
  readonly races: readonly OfficialRaceDefinition[];
  readonly pendingKinds: readonly ["class", "item", "skill", "spell"];
}
export const CONTENT_MESSAGES = {
  "invalid-request": "內容查詢格式不正確。",
  "unsupported-version": "目前不支援這個正式內容版本。",
  "unknown-content": "這個版本沒有該正式內容；TEST 資料不能代替正式內容。",
} as const;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: readonly string[]) => Object.keys(v).length === expected.length
  && expected.every(k => Object.hasOwn(v, k));
export function isOfficialRaceDefinition(v: unknown): v is OfficialRaceDefinition {
  if (!object(v) || !keys(v, ["id", "name", "attributeModifiers", "freeAttributePoints", "aptitudePercent", "aptitudeReveal"])
    || typeof v.id !== "string" || !/^race\.[a-z][a-z0-9-]{0,47}$/.test(v.id)
    || typeof v.name !== "string" || v.name.length < 1 || v.name.length > 40 || v.name.trim() !== v.name
    || !Number.isSafeInteger(v.freeAttributePoints) || (v.freeAttributePoints as number) < 0
    || (v.freeAttributePoints as number) > 12 || v.aptitudeReveal !== "after-creation") return false;
  const modifiers = v.attributeModifiers, aptitude = v.aptitudePercent;
  if (!object(modifiers) || !keys(modifiers, CONTENT_ATTRIBUTES) || !CONTENT_ATTRIBUTES.every(k =>
    Number.isSafeInteger(modifiers[k]) && (modifiers[k] as number) >= -12 && (modifiers[k] as number) <= 12)
    || !object(aptitude) || !keys(aptitude, CONTENT_APTITUDES)) return false;
  return CONTENT_APTITUDES.every(k => Number.isSafeInteger(aptitude[k]) && (aptitude[k] as number) >= 0 && (aptitude[k] as number) <= 100)
    && CONTENT_APTITUDES.reduce((sum, k) => sum + (aptitude[k] as number), 0) === 100;
}
export function isOfficialContentCatalog(v: unknown): v is OfficialContentCatalog {
  if (!object(v)) return false;
  const pending = v.pendingKinds;
  if (!keys(v, ["schemaVersion", "catalogVersion", "namespace", "scope", "races", "pendingKinds"])
    || v.schemaVersion !== 1 || v.catalogVersion !== 2 || v.namespace !== "official" || v.scope !== "race-creation-metadata"
    || !Array.isArray(v.races) || v.races.length !== 5 || !v.races.every(isOfficialRaceDefinition)
    || new Set(v.races.map(r => r.id)).size !== v.races.length
    || !Array.isArray(pending) || pending.length !== 4
    || !["class", "item", "skill", "spell"].every((kind, i) => pending[i] === kind)) return false;
  return true;
}
