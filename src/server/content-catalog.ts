import type { FastifyInstance } from "fastify";
import { CONTENT_KINDS, CONTENT_MESSAGES, isOfficialContentCatalog, type ContentKind } from "../shared/content-catalog.js";
import { OFFICIAL_RACES_V1 } from "./content/races-v1.js";

export class ContentCatalogFailure extends Error {
  constructor(readonly code: keyof typeof CONTENT_MESSAGES) { super(CONTENT_MESSAGES[code]); }
}
export function createOfficialContentCatalog(value: unknown = OFFICIAL_RACES_V1) {
  // Validate the detached snapshot that will be loaded, including values produced by getters.
  let copied: unknown;
  try { copied = structuredClone(value); }
  catch { throw new Error("正式內容名冊格式不合法，未載入任何內容。"); }
  if (!isOfficialContentCatalog(copied)) throw new Error("正式內容名冊格式不合法，未載入任何內容。");
  for (const race of copied.races) {
    Object.freeze(race.attributeModifiers); Object.freeze(race.aptitudePercent); Object.freeze(race);
  }
  Object.freeze(copied.races); Object.freeze(copied.pendingKinds); Object.freeze(copied);
  const races = new Map(copied.races.map(race => [race.id, race]));
  return {
    catalog: copied,
    resolve(kind: ContentKind, id: string, version: number) {
      if (version !== copied.catalogVersion) throw new ContentCatalogFailure("unsupported-version");
      // Unapproved categories are intentionally empty; never consult the TEST catalogs.
      const race = kind === "race" ? races.get(id) : undefined;
      if (!race) throw new ContentCatalogFailure("unknown-content");
      return race;
    },
  };
}
export function registerContentCatalogRoutes(app: FastifyInstance) {
  const service = createOfficialContentCatalog();
  const empty = (value: unknown) => value !== null && typeof value === "object" && Object.keys(value).length === 0;
  function failure(reply: import("fastify").FastifyReply, code: keyof typeof CONTENT_MESSAGES) {
    return reply.code(code === "invalid-request" ? 400 : code === "unsupported-version" ? 409 : 404)
      .send({ code, message: CONTENT_MESSAGES[code] });
  }
  app.get("/api/content-catalog", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!empty(request.query)) return failure(reply, "invalid-request");
    return service.catalog;
  });
  app.get("/api/content-catalog/resolve", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const q = request.query as Record<string, unknown>;
    if (Object.keys(q).length !== 3 || !["kind", "id", "version"].every(k => Object.hasOwn(q, k))
      || typeof q.kind !== "string" || !CONTENT_KINDS.includes(q.kind as ContentKind)
      || typeof q.id !== "string" || q.id.length < 1 || q.id.length > 80 || q.id.trim() !== q.id
      || typeof q.version !== "string" || !/^[1-9]\d{0,8}$/.test(q.version)) return failure(reply, "invalid-request");
    try {
      return { catalogVersion: service.catalog.catalogVersion, namespace: "official",
        kind: q.kind, definition: service.resolve(q.kind as ContentKind, q.id, Number(q.version)) };
    } catch (error) {
      if (error instanceof ContentCatalogFailure) return failure(reply, error.code);
      throw error;
    }
  });
}
