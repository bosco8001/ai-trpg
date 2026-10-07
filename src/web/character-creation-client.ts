import { receive } from "./repair-preparation.js";
import { CREATION_MESSAGES, isCreationState, creationRequestText, sameCreationDefinition,
  type CreationCode, type CreationRequest, type CreationState, type CreationRecord } from "../shared/character-creation.js";
import type { OfficialContentCatalog } from "../shared/content-catalog.js";
import type { OfficialClassCatalog } from "../shared/class-catalog.js";
import { derivationObject, derivationKeys } from "../shared/character-derivation.js";

export class CreationClientFailure extends Error {
  constructor(readonly code: CreationCode) { super(CREATION_MESSAGES[code]); }
}
export function creationMatchesCatalogs(record: CreationRecord, races: OfficialContentCatalog, classes: OfficialClassCatalog) {
  return record.request.raceCatalogVersion === races.catalogVersion && record.request.classCatalogVersion === classes.catalogVersion
    && sameCreationDefinition(record.race, races.races.find(r => r.id === record.request.raceId))
    && sameCreationDefinition(record.profession, classes.classes.find(c => c.id === record.request.classId));
}
async function exchange(signal: AbortSignal, request: CreationRequest | null, fetcher: typeof fetch): Promise<CreationState> {
  signal.throwIfAborted();
  const response = await fetcher("/api/character-creation", { method: request ? "POST" : "GET", signal, cache: "no-store",
    ...(request ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) } : {}) });
  const value: unknown = JSON.parse(await receive(response, signal, 32 * 1024));
  signal.throwIfAborted();
  if (!response.ok) {
    if (derivationObject(value) && derivationKeys(value, ["code", "message"]) && typeof value.code === "string"
      && Object.hasOwn(CREATION_MESSAGES, value.code) && value.message === CREATION_MESSAGES[value.code as CreationCode])
      throw new CreationClientFailure(value.code as CreationCode);
    throw new CreationClientFailure("unavailable");
  }
  if (!isCreationState(value) || (request && (!value.record || creationRequestText(value.record.request) !== creationRequestText(request))))
    throw new CreationClientFailure("unavailable");
  return value;
}
export const readCreationState = (signal: AbortSignal, fetcher: typeof fetch = fetch) => exchange(signal, null, fetcher);
export const submitCreation = (request: CreationRequest, signal: AbortSignal, fetcher: typeof fetch = fetch) => exchange(signal, request, fetcher);
