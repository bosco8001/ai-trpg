import type { FastifyInstance } from "fastify";
import { createOfficialContentCatalog, ContentCatalogFailure } from "./content-catalog.js";
import { createOfficialClassCatalog, ClassCatalogFailure } from "./class-catalog.js";
import { deriveCharacterSample, previewResourceCapacity, DerivationFailure } from "../domain/character-derivation.js";
import { DERIVATION_MESSAGES, derivationObject, derivationKeys, isDerivationSample, isSampleResources,
  type DerivationResult } from "../shared/character-derivation.js";

/** Owns no session/repository/LLM. A request only derives the supplied sample. */
export function createCharacterDerivationService() {
  const races = createOfficialContentCatalog(), classes = createOfficialClassCatalog();
  return Object.freeze({ calculate(value: unknown): DerivationResult {
    try { value = structuredClone(value); }
    catch { throw new DerivationFailure("invalid-request"); }
    if (!derivationObject(value) || !derivationKeys(value, ["schemaVersion", "raceCatalogVersion", "classCatalogVersion", "sample", "resources"]))
      throw new DerivationFailure("invalid-request");
    if (value.schemaVersion !== 1 || value.raceCatalogVersion !== races.catalog.catalogVersion
      || value.classCatalogVersion !== classes.catalog.catalogVersion) throw new DerivationFailure("unsupported-version");
    if (!isDerivationSample(value.sample)) throw new DerivationFailure("invalid-sample");
    if (!isSampleResources(value.resources)) throw new DerivationFailure("invalid-resources");
    try {
      const race = races.resolve("race", value.sample.raceId, value.raceCatalogVersion);
      const profession = classes.resolve("class", value.sample.classId, value.classCatalogVersion);
      const result = deriveCharacterSample(value.sample, race, profession);
      return Object.freeze({ schemaVersion: 1, raceCatalogVersion: 2, classCatalogVersion: 1,
        scope: "character-derivation-sample", sample: result.sample,
        identity: Object.freeze({ raceName: race.name, className: profession.name }),
        attributes: result.attributes, aptitudeBonus: result.aptitudeBonus,
        before: Object.freeze({ ...value.resources }), after: previewResourceCapacity(value.resources, result.maxHp, result.maxMp) });
    } catch (error) {
      if (error instanceof ContentCatalogFailure || error instanceof ClassCatalogFailure)
        throw new DerivationFailure(error.code === "unsupported-version" ? "unsupported-version" : "unknown-content");
      throw error;
    }
  } });
}
export function registerCharacterDerivationRoutes(app: FastifyInstance) {
  const service = createCharacterDerivationService();
  app.post("/api/character-derivation/preview", { bodyLimit: 4096,
    errorHandler(error, _request, reply) {
      const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500;
      reply.header("Cache-Control", "no-store").code(status).send(status < 500
        ? { code: "invalid-request", message: DERIVATION_MESSAGES["invalid-request"] }
        : { code: "unavailable", message: "目前無法完成核對，請重試；原樣本仍保留。" });
    },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (Object.keys(request.query as Record<string, unknown>).length !== 0)
      return reply.code(400).send({ code: "invalid-request", message: DERIVATION_MESSAGES["invalid-request"] });
    try { return service.calculate(request.body); }
    catch (error) {
      if (error instanceof DerivationFailure) return reply.code(error.code === "unsupported-version" ? 409
        : error.code === "unknown-content" ? 404 : 400).send({ code: error.code, message: DERIVATION_MESSAGES[error.code] });
      throw error;
    }
  });
}
