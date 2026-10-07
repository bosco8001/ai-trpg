import type { OfficialRaceDefinition } from "../shared/content-catalog.js";
import { CONTENT_APTITUDES } from "../shared/content-catalog.js";
import type { OfficialClassDefinition } from "../shared/class-catalog.js";
import { BREATH_ELEMENTS, isCreationRecord, isCreationRequest, CREATION_MESSAGES,
  type CreationRequest, type CreationRecord, type CreationCode } from "../shared/character-creation.js";
import { deriveCharacterSample } from "./character-derivation.js";

export class CreationFailure extends Error {
  constructor(readonly code: CreationCode) { super(CREATION_MESSAGES[code]); }
}
export type CreationRandom = (exclusiveUpperBound: number) => number;
/** Only called after an empty, locked persistence scope has been established. */
export function generateCreationRecord(request: CreationRequest, race: OfficialRaceDefinition,
  profession: OfficialClassDefinition, random: CreationRandom, characterId: string, createdAt: string): CreationRecord {
  if (!isCreationRequest(request) || request.raceId !== race.id || request.classId !== profession.id)
    throw new CreationFailure("invalid-request");
  const draw = (max: number) => {
    const n = random(max);
    if (!Number.isSafeInteger(n) || n < 0 || n >= max) throw new CreationFailure("unavailable");
    return n;
  };
  const roll = draw(100);
  let cumulative = 0;
  const aptitude = CONTENT_APTITUDES.find(a => { cumulative += race.aptitudePercent[a]; return roll < cumulative; });
  if (!aptitude) throw new CreationFailure("unavailable");
  const directCasting = draw(100) < 1;
  const breath = race.id === "race.dragonborn" ? BREATH_ELEMENTS[draw(3)]! : null;
  const derived = deriveCharacterSample({ level: 1, raceId: request.raceId, classId: request.classId,
    allocation: request.allocation, raceAllocation: request.raceAllocation, aptitude }, race, profession);
  const record: CreationRecord = { formatVersion: 1, rulesVersion: 1, scope: "character-creation-record", characterId, createdAt,
    request: structuredClone(request), aptitude, directCasting, lineage: "unrevealed", breath,
    unlockedClassIds: [request.classId], race: structuredClone(race), profession: structuredClone(profession),
    attributes: derived.attributes, aptitudeBonus: derived.aptitudeBonus,
    resources: { currentHp: derived.maxHp, maxHp: derived.maxHp, currentMp: derived.maxMp, maxMp: derived.maxMp } };
  if (!isCreationRecord(record)) throw new CreationFailure("invalid-record");
  return structuredClone(record);
}
