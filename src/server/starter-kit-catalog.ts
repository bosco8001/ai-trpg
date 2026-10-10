import type { FastifyInstance, FastifyReply } from "fastify";
import { isOfficialStarterKitCatalog, STARTER_MESSAGES } from "../shared/starter-kit-catalog.js";
import { OFFICIAL_STARTER_KITS_V1 } from "./content/starter-kits-v1.js";
import { createOfficialClassCatalog } from "./class-catalog.js";

export class StarterKitCatalogFailure extends Error {
  constructor(readonly code: keyof typeof STARTER_MESSAGES) { super(STARTER_MESSAGES[code]); }
}
function freeze(value: object): void {
  for (const child of Object.values(value)) if (child !== null && typeof child === "object") freeze(child);
  Object.freeze(value);
}
export function createOfficialStarterKitCatalog(value: unknown = OFFICIAL_STARTER_KITS_V1) {
  let copied: unknown;
  try { copied = structuredClone(value); }
  catch { throw new Error("正式起始配套名冊格式不合法，未載入任何配套。"); }
  if (!isOfficialStarterKitCatalog(copied)) throw new Error("正式起始配套名冊格式不合法，未載入任何配套。");
  const classes = createOfficialClassCatalog();
  for (const kit of copied.kits) classes.resolve("class", kit.classId, copied.classCatalogVersion);
  freeze(copied);
  const catalog = copied;
  const items = new Map(catalog.items.map(e => [e.id as string, e]));
  const abilities = new Map(catalog.abilities.map(e => [e.id as string, e]));
  const kits = new Map(catalog.kits.map(e => [e.id as string, e]));
  return Object.freeze({ catalog, resolve(kind: string, id: string, version: number) {
    if (version !== catalog.catalogVersion) throw new StarterKitCatalogFailure("unsupported-version");
    const definition = kind === "item" ? items.get(id) : kind === "kit" ? kits.get(id)
      : kind === "skill" || kind === "spell" ? abilities.get(id) : undefined;
    if (!definition || ((kind === "skill" || kind === "spell")
      && (!id.startsWith(`${kind}.`)))) throw new StarterKitCatalogFailure("unknown-content");
    return definition;
  } });
}
export function registerStarterKitCatalogRoutes(app: FastifyInstance) {
  const service = createOfficialStarterKitCatalog();
  function failure(reply: FastifyReply, code: keyof typeof STARTER_MESSAGES) {
    return reply.code(code === "invalid-request" ? 400 : code === "unsupported-version" ? 409 : 404)
      .send({ code, message: STARTER_MESSAGES[code] });
  }
  app.get("/api/starter-kit-catalog", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (Object.keys(request.query as Record<string, unknown>).length !== 0) return failure(reply, "invalid-request");
    return service.catalog;
  });
  app.get("/api/starter-kit-catalog/resolve", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const q = request.query as Record<string, unknown>;
    if (Object.keys(q).length !== 3 || !["kind", "id", "version"].every(k => Object.hasOwn(q, k))
      || !["item", "skill", "spell", "kit"].includes(q.kind as string)
      || typeof q.id !== "string" || q.id.length < 1 || q.id.length > 80 || q.id.trim() !== q.id
      || typeof q.version !== "string" || !/^[1-9]\d{0,8}$/.test(q.version)) return failure(reply, "invalid-request");
    try { return { catalogVersion: service.catalog.catalogVersion, namespace: "official", kind: q.kind,
      definition: service.resolve(q.kind as string, q.id, Number(q.version)) }; }
    catch (error) { if (error instanceof StarterKitCatalogFailure) return failure(reply, error.code); throw error; }
  });
}
