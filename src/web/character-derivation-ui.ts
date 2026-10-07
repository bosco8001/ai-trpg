import type { OfficialContentCatalog } from "../shared/content-catalog.js";
import type { OfficialClassCatalog } from "../shared/class-catalog.js";
import { isDerivationSample, isSampleResources, validPoints,
  type DerivationSample, type SampleResources, type DerivationRequest, type DerivationResult,
  sameDerivationSample, sameSampleResources } from "../shared/character-derivation.js";

/** Explicit engineering fixture; not the starting resources of a real character. */
export function initialDerivationRequest(): DerivationRequest {
  return { schemaVersion: 1, raceCatalogVersion: 2, classCatalogVersion: 1,
    sample: { level: 1, raceId: "race.human", classId: "class.swordsman", aptitude: "ordinary",
      allocation: [2, 2, 2, 2, 2, 2], raceAllocation: [2, 0, 0, 0, 0, 0] },
    resources: { currentHp: 40, maxHp: 55, currentMp: 48, maxMp: 60 } };
}
export function derivationDraftError(sample: DerivationSample, resources: SampleResources,
  races: OfficialContentCatalog, classes: OfficialClassCatalog): string {
  if (!isDerivationSample(sample)) return "請分配完整 12 點，每項 0～6 點，並選擇有效的樣本資質。";
  const race = races.races.find(r => r.id === sample.raceId);
  if (!race || !classes.classes.some(c => c.id === sample.classId)) return "請選擇名冊內的正式種族與職業。";
  if (!validPoints(sample.raceAllocation, 2, race.freeAttributePoints)) return "人類須分配另 2 點種族加成，其他種族不分配這 2 點。";
  if (race.aptitudePercent[sample.aptitude] <= 0) return "請選擇該種族有效的樣本資質。";
  if (!isSampleResources(resources)) return "目前 HP／MP 須是整數，且不能超過原樣本上限。";
  return "";
}
/** An old preview must never commit after a draft or resource baseline changes. */
export function previewMatchesDraft(preview: DerivationResult | null, sample: DerivationSample, resources: SampleResources) {
  return preview !== null && sameDerivationSample(preview.sample, sample) && sameSampleResources(preview.before, resources);
}
