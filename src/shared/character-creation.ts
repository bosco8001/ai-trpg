import { CONTENT_ATTRIBUTES, isOfficialRaceDefinition, type OfficialRaceDefinition } from "./content-catalog.js";
import { INITIAL_CLASS_IDS, isOfficialClassDefinition, type OfficialClassDefinition } from "./class-catalog.js";
import { derivationObject as object, derivationKeys as keys, validPoints, isDerivationResult,
  type AttributeDerivation, type DerivationAptitude, type SampleResources } from "./character-derivation.js";

export const CREATION_RACE_IDS = ["race.human", "race.elf", "race.dwarf", "race.orc", "race.dragonborn"] as const;
export const BREATH_ELEMENTS = ["fire", "ice", "lightning"] as const;
export const CREATION_MESSAGES = {
  "invalid-request": "角色建立請求格式不正確，請重新核對。",
  "unsupported-version": "目前不支援這個角色建立或名冊版本。",
  "unknown-content": "找不到指定的正式種族或職業。",
  "invalid-allocation": "請分配完整 12 點，每項最多 6 點；人類另分配 2 點。",
  "already-created": "已保存一名角色，請重新讀取原角色。",
  "request-conflict": "這次建立識別已使用其他輸入，請重新讀取保存狀態。",
  "postgres-required": "角色保存需要 PostgreSQL；目前模式不提供建立角色。",
  "invalid-record": "已保存的角色紀錄無法安全讀取，原資料仍保留。",
  "unavailable": "目前無法確認角色保存結果，請查詢或重試同一次建立。",
} as const;
export type CreationCode = keyof typeof CREATION_MESSAGES;
export interface CreationRequest {
  readonly schemaVersion: 1;
  readonly raceCatalogVersion: 2;
  readonly classCatalogVersion: 1;
  readonly requestId: string;
  readonly raceId: string;
  readonly classId: string;
  readonly allocation: readonly number[];
  readonly raceAllocation: readonly number[];
}
export interface CreationRecord {
  readonly formatVersion: 1;
  readonly rulesVersion: 1;
  readonly scope: "character-creation-record";
  readonly characterId: string;
  readonly createdAt: string;
  readonly request: CreationRequest;
  readonly aptitude: DerivationAptitude;
  readonly directCasting: boolean;
  readonly lineage: "unrevealed";
  readonly breath: typeof BREATH_ELEMENTS[number] | null;
  readonly unlockedClassIds: readonly string[];
  readonly race: OfficialRaceDefinition;
  readonly profession: OfficialClassDefinition;
  readonly attributes: readonly AttributeDerivation[];
  readonly aptitudeBonus: number;
  readonly resources: SampleResources;
}
export interface CreationState {
  readonly schemaVersion: 1;
  readonly storage: "postgres";
  readonly state: "empty" | "created";
  readonly record: CreationRecord | null;
}
export const isCreationId = (v: unknown): v is string => typeof v === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
export function isCreationRequest(v: unknown): v is CreationRequest {
  return object(v) && keys(v, ["schemaVersion", "raceCatalogVersion", "classCatalogVersion", "requestId",
    "raceId", "classId", "allocation", "raceAllocation"])
    && v.schemaVersion === 1 && v.raceCatalogVersion === 2 && v.classCatalogVersion === 1
    && isCreationId(v.requestId) && typeof v.raceId === "string" && CREATION_RACE_IDS.some(id => id === v.raceId)
    && typeof v.classId === "string" && INITIAL_CLASS_IDS.some(id => id === v.classId)
    && validPoints(v.allocation, 6, 12) && validPoints(v.raceAllocation, 2, v.raceId === "race.human" ? 2 : 0);
}
/** Stable field order, independent of JSON key order. Used for replay binding, never a RNG seed. */
export function creationRequestText(v: CreationRequest): string {
  return JSON.stringify([v.schemaVersion, v.raceCatalogVersion, v.classCatalogVersion, v.requestId,
    v.raceId, v.classId, [...v.allocation], [...v.raceAllocation]]);
}
export function sameCreationDefinition(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((v, i) => sameCreationDefinition(v, b[i]));
  if (object(a) || object(b)) return object(a) && object(b) && Object.keys(a).length === Object.keys(b).length
    && Object.keys(a).every(k => Object.hasOwn(b, k) && sameCreationDefinition(a[k], b[k]));
  return a === b;
}
export function isCreationRecord(v: unknown): v is CreationRecord {
  if (!object(v) || !keys(v, ["formatVersion", "rulesVersion", "scope", "characterId", "createdAt", "request",
    "aptitude", "directCasting", "lineage", "breath", "unlockedClassIds", "race", "profession", "attributes", "aptitudeBonus", "resources"])
    || v.formatVersion !== 1 || v.rulesVersion !== 1 || v.scope !== "character-creation-record"
    || !isCreationId(v.characterId) || typeof v.createdAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.createdAt)
    || !Number.isFinite(Date.parse(v.createdAt)) || new Date(v.createdAt).toISOString() !== v.createdAt
    || !isCreationRequest(v.request) || typeof v.directCasting !== "boolean" || v.lineage !== "unrevealed"
    || !isOfficialRaceDefinition(v.race) || !isOfficialClassDefinition(v.profession)
    || v.race.id !== v.request.raceId || v.profession.id !== v.request.classId
    || !Array.isArray(v.unlockedClassIds) || v.unlockedClassIds.length !== 1 || Object.keys(v.unlockedClassIds).length !== 1
    || v.unlockedClassIds[0] !== v.request.classId
    || (v.request.raceId === "race.dragonborn" ? !BREATH_ELEMENTS.some(e => e === v.breath) : v.breath !== null)) return false;
  const race = v.race, profession = v.profession;
  const calculated = { schemaVersion: 1, raceCatalogVersion: 2, classCatalogVersion: 1, scope: "character-derivation-sample",
    sample: { level: 1, raceId: v.request.raceId, classId: v.request.classId, allocation: v.request.allocation,
      raceAllocation: v.request.raceAllocation, aptitude: v.aptitude },
    identity: { raceName: v.race.name, className: v.profession.name }, attributes: v.attributes,
    aptitudeBonus: v.aptitudeBonus, before: v.resources, after: v.resources };
  if (!isDerivationResult(calculated) || v.race.aptitudePercent[calculated.sample.aptitude] <= 0
    || !validPoints(v.request.raceAllocation, 2, v.race.freeAttributePoints)) return false;
  return calculated.after.currentHp === calculated.after.maxHp && calculated.after.currentMp === calculated.after.maxMp
    && CONTENT_ATTRIBUTES.every((k, i) => calculated.attributes[i]!.raceFixed === race.attributeModifiers[k]
      && calculated.attributes[i]!.multiplier === profession.attributeMultipliers[k]);
}
export function isCreationState(v: unknown): v is CreationState {
  return object(v) && keys(v, ["schemaVersion", "storage", "state", "record"]) && v.schemaVersion === 1 && v.storage === "postgres"
    && (v.state === "empty" ? v.record === null : v.state === "created" && isCreationRecord(v.record));
}
