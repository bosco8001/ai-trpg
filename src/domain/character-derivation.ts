import type { OfficialRaceDefinition } from "../shared/content-catalog.js";
import { CONTENT_ATTRIBUTES } from "../shared/content-catalog.js";
import type { OfficialClassDefinition } from "../shared/class-catalog.js";
import { DERIVATION_MESSAGES, isDerivationSample, isSampleResources, validPoints,
  type DerivationSample, type SampleResources, type AttributeDerivation } from "../shared/character-derivation.js";

export class DerivationFailure extends Error {
  constructor(readonly code: keyof typeof DERIVATION_MESSAGES) { super(DERIVATION_MESSAGES[code]); }
}
/** Pure domain rules. Definitions must come from the validated official catalogs. */
export function deriveCharacterSample(input: unknown, race: OfficialRaceDefinition, profession: OfficialClassDefinition) {
  if (!isDerivationSample(input) || input.raceId !== race.id || input.classId !== profession.id
    || !validPoints(input.raceAllocation, 2, race.freeAttributePoints) || race.aptitudePercent[input.aptitude] <= 0)
    throw new DerivationFailure("invalid-sample");
  const sample: DerivationSample = Object.freeze({ ...input,
    allocation: Object.freeze([...input.allocation]), raceAllocation: Object.freeze([...input.raceAllocation]) });
  const attributes: readonly AttributeDerivation[] = Object.freeze(CONTENT_ATTRIBUTES.map((attribute, i) => {
    const base = 8 + sample.allocation[i]!, raceFixed = race.attributeModifiers[attribute], raceFree = sample.raceAllocation[i]!;
    const intrinsic = base + raceFixed + raceFree, multiplier = profession.attributeMultipliers[attribute];
    const qualification = Math.floor(intrinsic * multiplier);
    return Object.freeze({ attribute, base, raceFixed, raceFree, intrinsic, multiplier,
      equipment: 0 as const, skill: 0 as const, qualification, final: qualification,
      modifier: Math.floor((qualification - 10) / 2) });
  }));
  const aptitudeBonus = { low: 0, ordinary: 20, high: 40, exceptional: 70 }[sample.aptitude];
  return Object.freeze({ sample, attributes, aptitudeBonus,
    maxHp: 20 + sample.level * 5 + attributes[2]!.final * 3,
    maxMp: attributes[3]!.final * 4 + aptitudeBonus });
}
/** Capacity transitions only; not damage, healing, revival or a gameplay command. */
export function previewResourceCapacity(before: unknown, maxHp: number, maxMp: number): SampleResources {
  if (!isSampleResources(before) || !Number.isSafeInteger(maxHp) || maxHp < 1
    || !Number.isSafeInteger(maxMp) || maxMp < 0) throw new DerivationFailure("invalid-resources");
  return Object.freeze({ currentHp: Math.min(before.currentHp, maxHp), maxHp,
    currentMp: Math.min(before.currentMp, maxMp), maxMp });
}
