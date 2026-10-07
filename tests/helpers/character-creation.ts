import assert from "node:assert/strict";
import { generateCreationRecord, CreationFailure } from "../../src/domain/character-creation.js";
import { createOfficialContentCatalog } from "../../src/server/content-catalog.js";
import { createOfficialClassCatalog } from "../../src/server/class-catalog.js";
import type { CreationRequest, CreationCode } from "../../src/shared/character-creation.js";

export const signal = () => new AbortController().signal;
export const requestId = "10000000-0000-4000-8000-000000000001";
export const secondRequestId = "10000000-0000-4000-8000-000000000002";
export const characterId = "20000000-0000-4000-8000-000000000001";
export const date = "2026-10-07T00:00:00.000Z";
export function creationRequest(overrides: Partial<CreationRequest> = {}): CreationRequest {
  const raceId = overrides.raceId ?? "race.human";
  return { schemaVersion: 1, raceCatalogVersion: 2, classCatalogVersion: 1, requestId, raceId,
    classId: "class.swordsman", allocation: [2,2,2,2,2,2],
    raceAllocation: raceId === "race.human" ? [2,0,0,0,0,0] : [0,0,0,0,0,0], ...overrides };
}
export function birth(request = creationRequest(), rolls = [20,99,0], id = characterId) {
  const races = createOfficialContentCatalog(), classes = createOfficialClassCatalog();
  let i = 0;
  return generateCreationRecord(request, races.resolve("race", request.raceId, 2), classes.resolve("class", request.classId, 1),
    () => rolls[i++]!, id, date);
}
export async function failure(operation: Promise<unknown>, code: CreationCode) {
  await assert.rejects(operation, (e: unknown) => e instanceof CreationFailure && e.code === code);
}
