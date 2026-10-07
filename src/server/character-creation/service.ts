import { randomInt, randomUUID } from "node:crypto";
import { createOfficialContentCatalog } from "../content-catalog.js";
import { createOfficialClassCatalog } from "../class-catalog.js";
import { generateCreationRecord, CreationFailure, type CreationRandom } from "../../domain/character-creation.js";
import { derivationObject } from "../../shared/character-derivation.js";
import { isCreationRequest, isCreationRecord, sameCreationDefinition, creationRequestText, type CreationState, type CreationRecord } from "../../shared/character-creation.js";
import type { CreationRepository } from "./contracts.js";

export function createCharacterCreationService(repository: CreationRepository | undefined, storage: "memory" | "postgres",
  random: CreationRandom = max => randomInt(max), newId: () => string = randomUUID, now: () => string = () => new Date().toISOString()) {
  const races = createOfficialContentCatalog(), classes = createOfficialClassCatalog();
  function available(): CreationRepository {
    if (storage !== "postgres") throw new CreationFailure("postgres-required");
    if (!repository) throw new CreationFailure("unavailable");
    return repository;
  }
  function verified(value: unknown): CreationRecord {
    if (!isCreationRecord(value)) throw new CreationFailure("invalid-record");
    try {
      if (!sameCreationDefinition(value.race, races.resolve("race", value.request.raceId, value.request.raceCatalogVersion))
        || !sameCreationDefinition(value.profession, classes.resolve("class", value.request.classId, value.request.classCatalogVersion)))
        throw new CreationFailure("invalid-record");
    } catch { throw new CreationFailure("invalid-record"); }
    return structuredClone(value);
  }
  return {
    async read(signal: AbortSignal): Promise<CreationState> {
      signal.throwIfAborted();
      const value = await available().read(signal);
      signal.throwIfAborted();
      return { schemaVersion: 1, storage: "postgres", state: value === null ? "empty" : "created", record: value === null ? null : verified(value) };
    },
    async create(input: unknown, signal: AbortSignal): Promise<CreationState> {
      signal.throwIfAborted();
      const repo = available();
      if (!derivationObject(input)) throw new CreationFailure("invalid-request");
      if (input.schemaVersion !== 1 || input.raceCatalogVersion !== 2 || input.classCatalogVersion !== 1)
        throw new CreationFailure("unsupported-version");
      if (!isCreationRequest(input)) throw new CreationFailure("invalid-request");
      const request = structuredClone(input);
      const race = races.resolve("race", request.raceId, request.raceCatalogVersion);
      const profession = classes.resolve("class", request.classId, request.classCatalogVersion);
      const value = await repo.create(request, () => generateCreationRecord(request, race, profession, random, newId(), now()), signal);
      signal.throwIfAborted();
      const record = verified(value);
      if (creationRequestText(record.request) !== creationRequestText(request)) throw new CreationFailure("invalid-record");
      return { schemaVersion: 1, storage: "postgres", state: "created", record };
    },
  };
}
