import type { FastifyInstance, FastifyReply } from "fastify";
import { CLASS_MESSAGES, isOfficialClassCatalog, type OfficialClassDefinition } from "../shared/class-catalog.js";
import { OFFICIAL_CLASSES_V1 } from "./content/classes-v1.js";

export class ClassCatalogFailure extends Error {
  constructor(readonly code: keyof typeof CLASS_MESSAGES) { super(CLASS_MESSAGES[code]); }
}
export function createOfficialClassCatalog(value: unknown = OFFICIAL_CLASSES_V1) {
  let copied: unknown;
  try { copied = structuredClone(value); }
  catch { throw new Error("正式職業名冊格式不合法，未載入任何職業。"); }
  if (!isOfficialClassCatalog(copied)) throw new Error("正式職業名冊格式不合法，未載入任何職業。");
  for (const entry of copied.classes) {
    if (entry.passive.effect.kind === "qualified-casting-total-mp") Object.freeze(entry.passive.effect.sources);
    Object.freeze(entry.passive.effect); Object.freeze(entry.passive); Object.freeze(entry.attributeMultipliers); Object.freeze(entry);
  }
  Object.freeze(copied.classes); Object.freeze(copied);
  const catalog = copied;
  const classes = new Map<string, OfficialClassDefinition>(catalog.classes.map(c => [c.id, c]));
  return Object.freeze({ catalog, resolve(kind: string, id: string, version: number) {
    if (version !== catalog.catalogVersion) throw new ClassCatalogFailure("unsupported-version");
    const entry = kind === "class" ? classes.get(id) : undefined;
    if (!entry) throw new ClassCatalogFailure("unknown-content");
    return entry;
  } });
}
export function registerClassCatalogRoutes(app: FastifyInstance) {
  const service = createOfficialClassCatalog();
  function failure(reply: FastifyReply, code: keyof typeof CLASS_MESSAGES) {
    return reply.code(code === "invalid-request" ? 400 : code === "unsupported-version" ? 409 : 404)
      .send({ code, message: CLASS_MESSAGES[code] });
  }
  app.get("/api/class-catalog", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (Object.keys(request.query as Record<string, unknown>).length !== 0) return failure(reply, "invalid-request");
    return service.catalog;
  });
  app.get("/api/class-catalog/resolve", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const q = request.query as Record<string, unknown>;
    if (Object.keys(q).length !== 3 || !["kind", "id", "version"].every(k => Object.hasOwn(q, k))
      || q.kind !== "class" || typeof q.id !== "string" || q.id.length < 1 || q.id.length > 80 || q.id.trim() !== q.id
      || typeof q.version !== "string" || !/^[1-9]\d{0,8}$/.test(q.version)) return failure(reply, "invalid-request");
    try { return { catalogVersion: service.catalog.catalogVersion, namespace: "official", kind: "class",
      definition: service.resolve("class", q.id, Number(q.version)) }; }
    catch (error) { if (error instanceof ClassCatalogFailure) return failure(reply, error.code); throw error; }
  });
}
