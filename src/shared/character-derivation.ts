import { CONTENT_ATTRIBUTES, CONTENT_APTITUDES } from "./content-catalog.js";

export type DerivationAttribute = typeof CONTENT_ATTRIBUTES[number];
export type DerivationAptitude = typeof CONTENT_APTITUDES[number];
export interface DerivationSample {
  readonly level: 1;
  readonly raceId: string;
  readonly classId: string;
  readonly aptitude: DerivationAptitude;
  readonly allocation: readonly number[];
  readonly raceAllocation: readonly number[];
}
export interface SampleResources {
  readonly currentHp: number;
  readonly maxHp: number;
  readonly currentMp: number;
  readonly maxMp: number;
}
export interface DerivationRequest {
  readonly schemaVersion: 1;
  readonly raceCatalogVersion: 2;
  readonly classCatalogVersion: 1;
  readonly sample: DerivationSample;
  /** Explicit sample baseline, never an authoritative character snapshot. */
  readonly resources: SampleResources;
}
export interface AttributeDerivation {
  readonly attribute: DerivationAttribute;
  readonly base: number;
  readonly raceFixed: number;
  readonly raceFree: number;
  readonly intrinsic: number;
  readonly multiplier: number;
  readonly equipment: 0;
  readonly skill: 0;
  readonly qualification: number;
  readonly final: number;
  readonly modifier: number;
}
export interface DerivationResult {
  readonly schemaVersion: 1;
  readonly raceCatalogVersion: 2;
  readonly classCatalogVersion: 1;
  readonly scope: "character-derivation-sample";
  readonly sample: DerivationSample;
  readonly identity: { readonly raceName: string; readonly className: string };
  readonly attributes: readonly AttributeDerivation[];
  readonly aptitudeBonus: number;
  readonly before: SampleResources;
  readonly after: SampleResources;
}
export const DERIVATION_MESSAGES = {
  "invalid-request": "核對請求格式不正確。",
  "unsupported-version": "目前不支援這個核對或名冊版本。",
  "unknown-content": "找不到指定的正式種族或職業，不能使用 TEST 資料代替。",
  "invalid-sample": "請分配完整 12 點、人類另 2 點，並選擇該種族有效的樣本資質。",
  "invalid-resources": "目前資源須是整數，且介於 0 與原上限之間。",
} as const;
export const derivationObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
export const derivationKeys = (v: Record<string, unknown>, expected: readonly string[]) =>
  Object.keys(v).length === expected.length && expected.every(k => Object.hasOwn(v, k));
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const id = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 80 && v.trim() === v;
export function validPoints(v: unknown, perAttribute: number, total?: number): v is readonly number[] {
  return Array.isArray(v) && v.length === 6 && Object.keys(v).length === 6
    && CONTENT_ATTRIBUTES.every((_, i) => Object.hasOwn(v, i) && integer(v[i]) && v[i] >= 0 && v[i] <= perAttribute)
    && (total === undefined || v.reduce((sum: number, n: number) => sum + n, 0) === total);
}
export function isDerivationSample(v: unknown): v is DerivationSample {
  return derivationObject(v) && derivationKeys(v, ["level", "raceId", "classId", "aptitude", "allocation", "raceAllocation"])
    && v.level === 1 && id(v.raceId) && id(v.classId)
    && typeof v.aptitude === "string" && CONTENT_APTITUDES.includes(v.aptitude as DerivationAptitude)
    && validPoints(v.allocation, 6, 12) && validPoints(v.raceAllocation, 2);
}
export function isSampleResources(v: unknown): v is SampleResources {
  return derivationObject(v) && derivationKeys(v, ["currentHp", "maxHp", "currentMp", "maxMp"])
    && integer(v.maxHp) && v.maxHp >= 1 && integer(v.maxMp) && v.maxMp >= 0
    && integer(v.currentHp) && v.currentHp >= 0 && v.currentHp <= v.maxHp
    && integer(v.currentMp) && v.currentMp >= 0 && v.currentMp <= v.maxMp;
}
export function sameDerivationSample(a: DerivationSample, b: DerivationSample): boolean {
  return a.level === b.level && a.raceId === b.raceId && a.classId === b.classId && a.aptitude === b.aptitude
    && CONTENT_ATTRIBUTES.every((_, i) => a.allocation[i] === b.allocation[i] && a.raceAllocation[i] === b.raceAllocation[i]);
}
export function sameSampleResources(a: SampleResources, b: SampleResources): boolean {
  return a.currentHp === b.currentHp && a.maxHp === b.maxHp && a.currentMp === b.currentMp && a.maxMp === b.maxMp;
}
function isRow(v: unknown, attribute: DerivationAttribute): v is AttributeDerivation {
  return derivationObject(v) && derivationKeys(v, ["attribute", "base", "raceFixed", "raceFree", "intrinsic", "multiplier",
    "equipment", "skill", "qualification", "final", "modifier"])
    && v.attribute === attribute && integer(v.base) && integer(v.raceFixed) && integer(v.raceFree)
    && integer(v.intrinsic) && integer(v.qualification) && integer(v.final) && integer(v.modifier)
    && (v.multiplier === 1 || v.multiplier === 1.25) && v.equipment === 0 && v.skill === 0
    && v.intrinsic === v.base + v.raceFixed + v.raceFree && v.qualification === Math.floor(v.intrinsic * v.multiplier)
    && v.final === v.qualification && v.modifier === Math.floor((v.final - 10) / 2);
}
export function isDerivationResult(v: unknown): v is DerivationResult {
  if (!derivationObject(v) || !derivationKeys(v, ["schemaVersion", "raceCatalogVersion", "classCatalogVersion", "scope",
    "sample", "identity", "attributes", "aptitudeBonus", "before", "after"])
    || v.schemaVersion !== 1 || v.raceCatalogVersion !== 2 || v.classCatalogVersion !== 1
    || v.scope !== "character-derivation-sample" || !isDerivationSample(v.sample)
    || !derivationObject(v.identity) || !derivationKeys(v.identity, ["raceName", "className"])
    || !id(v.identity.raceName) || !id(v.identity.className)
    || !Array.isArray(v.attributes) || v.attributes.length !== 6 || Object.keys(v.attributes).length !== 6
    || ![0, 20, 40, 70].includes(v.aptitudeBonus as number)
    || !isSampleResources(v.before) || !isSampleResources(v.after)) return false;
  const attributes = v.attributes;
  const sample = v.sample;
  return CONTENT_ATTRIBUTES.every((k, i) => isRow(attributes[i], k)
      && attributes[i].base === 8 + sample.allocation[i]!
      && attributes[i].raceFree === sample.raceAllocation[i])
    && v.aptitudeBonus === { low: 0, ordinary: 20, high: 40, exceptional: 70 }[sample.aptitude]
    && v.after.maxHp === 20 + sample.level * 5 + (attributes[2] as AttributeDerivation).final * 3
    && v.after.maxMp === (attributes[3] as AttributeDerivation).final * 4 + (v.aptitudeBonus as number)
    && v.after.currentHp === Math.min(v.before.currentHp, v.after.maxHp)
    && v.after.currentMp === Math.min(v.before.currentMp, v.after.maxMp);
}
