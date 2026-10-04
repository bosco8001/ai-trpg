import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { REPAIR_MAX_RESPONSE_BYTES, REPAIR_MAX_SOURCE_BYTES, REPAIR_TIMEOUT_MS } from "../shared/repair-preview.js";
import { PREPARATION_MESSAGES, REPAIR_BACKUP_MAX_BYTES, isPreparationRequest, repairIdValid,
  type RepairPreparationRequest } from "../shared/repair-preparation.js";
import { analyzeRepairRecord } from "./repair-preview.js";
import type { RepairPreviewReader } from "./repair-preview-reader.js";
import { RawBackupFailure, boundedJson } from "./raw-data-backup.js";
import { ApplicationFailure } from "./repair-application-core.js";
import { PreparationFailure, backupSummary, makeRepairBackup, preparationBinding, verifiedBackup, type RepairArchive } from "./repair-archive.js";

export function createRepairPreparationService(reader: RepairPreviewReader, archive: RepairArchive,
  maxBytes = REPAIR_BACKUP_MAX_BYTES, runtimeId = randomUUID(), now: () => Date = () => new Date(),
  onPrepared?: (backup: string, source: import("./repair-preview-reader.js").RepairRawRecord, signal: AbortSignal) => Promise<void>) {
  const characterId = reader.characterId;
  return {
    async prepare(request: RepairPreparationRequest, signal: AbortSignal) {
      if (request.storage !== reader.storage) throw new PreparationFailure("stale");
      const old = await archive.get(request.repairId, characterId, signal);
      if (old !== null) {
        const data = verifiedBackup(old, characterId, request.repairId).data;
        if (preparationBinding(data, characterId) !== preparationBinding(request, characterId)) throw new PreparationFailure("conflict");
        return backupSummary(old, characterId, runtimeId);
      }
      const record = reader.readGuarded ? await reader.readGuarded(request.source, REPAIR_MAX_SOURCE_BYTES, signal)
        : await reader.read(request.source, REPAIR_MAX_SOURCE_BYTES, signal);
      signal.throwIfAborted();
      if (record.raw !== null && Buffer.byteLength(record.raw) > REPAIR_MAX_SOURCE_BYTES) throw new PreparationFailure("too-large");
      const result = analyzeRepairRecord(reader, request.source, record);
      if (result.fingerprint !== request.fingerprint) throw new PreparationFailure("stale");
      if (result.status !== "candidate" || record.raw === null || result.revision === null || result.formatVersion !== 2)
        throw new PreparationFailure("blocked");
      if (result.candidateFingerprint !== request.candidateFingerprint) throw new PreparationFailure("stale");
      // R02 allowed global slots for read-only diagnosis; R03 preparation requires the configured player.
      if (request.source !== "current") {
        const row = JSON.parse(record.raw) as { snapshot: { character: { id: string } } };
        if (row.snapshot.character.id !== characterId) throw new PreparationFailure("identity-conflict");
      }
      const text = makeRepairBackup({ ...request, characterId, runtimeId: reader.storage === "memory" ? runtimeId : null,
        capturedAt: record.capturedAt, preparedAt: now().toISOString(), revision: result.revision, formatVersion: 2,
        changes: result.changes, raw: record.raw }, maxBytes);
      signal.throwIfAborted();
      const saved = await archive.put(text, characterId, signal);
      signal.throwIfAborted();
      // A concurrent publisher may have won this ID with an earlier capture.
      // Never attach a later guard to that earlier immutable backup (including ABA).
      if (saved === text) {
        try { await onPrepared?.(saved, record, signal); }
        catch (error) {
          if (error instanceof ApplicationFailure) throw new PreparationFailure(
            error.code === "capacity" ? "capacity-after-backup" : error.code === "conflict" ? "conflict" : "unavailable");
          throw error;
        }
      }
      signal.throwIfAborted();
      return backupSummary(saved, characterId, runtimeId);
    },
    async lookup(id: string, signal: AbortSignal) {
      const text = await archive.get(id, characterId, signal);
      if (text === null) throw new PreparationFailure("not-found");
      return backupSummary(text, characterId, runtimeId);
    },
    async download(id: string, signal: AbortSignal) {
      const text = await archive.get(id, characterId, signal);
      if (text === null) throw new PreparationFailure("not-found");
      verifiedBackup(text, characterId, id);
      return text;
    },
    async list(cursor: string | null, signal: AbortSignal) {
      const page = await archive.list(characterId, cursor, signal);
      return { records: page.records.map(record => ({ ...record, sameRuntime: record.storage === "postgres" || record.runtimeId === runtimeId })), nextCursor: page.nextCursor };
    },
  };
}
export type RepairPreparationService = ReturnType<typeof createRepairPreparationService>;
/** Client disconnect/timeout ends waiting, not a claim that a publication/COMMIT was undone. */
function abortable<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(new PreparationFailure("unavailable")); };
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => { signal.throwIfAborted(); return work(); }).then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
export function registerRepairPreparationRoutes(app: FastifyInstance, service: RepairPreparationService,
  maxBytes = REPAIR_BACKUP_MAX_BYTES, timeoutMs = REPAIR_TIMEOUT_MS) {
  const status = { "invalid-request": 400, stale: 409, blocked: 409, "identity-conflict": 409,
    conflict: 409, capacity: 507, "capacity-after-backup": 507, "too-large": 413, "not-found": 404, unavailable: 503 };
  function route<T extends FastifyRequest = FastifyRequest>(operation: (request: T, signal: AbortSignal) => Promise<unknown>, download = false) {
    return async (request: T, reply: import("fastify").FastifyReply) => {
      reply.header("Cache-Control", "no-store");
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
      const closed = () => { if (!reply.raw.writableEnded) controller.abort(); };
      reply.raw.on("close", closed);
      try {
        const result = await abortable(() => operation(request, controller.signal), controller.signal);
        const text = download ? result as string : boundedJson(result, REPAIR_MAX_RESPONSE_BYTES);
        if (download && Buffer.byteLength(text) > maxBytes) throw new PreparationFailure("too-large");
        if (download) reply.header("X-Repair-Backup-Max-Bytes", String(maxBytes))
          .header("Content-Disposition", `attachment; filename="ai-trpg-repair-${(request as { params: { id: string } }).params.id}.json"`);
        return reply.type("application/json").header("Content-Length", String(Buffer.byteLength(text))).send(text);
      } catch (error) {
        const code = error instanceof PreparationFailure ? error.code
          : error instanceof RawBackupFailure && error.code === "too-large" ? "too-large" : "unavailable";
        const text = JSON.stringify({ code, message: PREPARATION_MESSAGES[code] });
        return reply.code(status[code]).type("application/json").header("Content-Length", String(Buffer.byteLength(text))).send(text);
      } finally { clearTimeout(timer); reply.raw.removeListener("close", closed); }
    };
  }
  const noQuery = (v: unknown) => v !== null && typeof v === "object" && Object.keys(v).length === 0;
  app.post("/api/repair-preparations", { bodyLimit: 4096 }, route(async (request, signal) => {
    if (!noQuery(request.query) || !isPreparationRequest(request.body)) throw new PreparationFailure("invalid-request");
    return service.prepare(request.body, signal);
  }));
  app.get("/api/repair-preparations", route(async (request, signal) => {
    const query = request.query as Record<string, unknown>;
    if (Object.keys(query).some(k => k !== "cursor") || query.cursor !== undefined && !repairIdValid(query.cursor)) throw new PreparationFailure("invalid-request");
    return service.list(query.cursor as string | undefined ?? null, signal);
  }));
  app.get<{ Params: { id: string } }>("/api/repair-preparations/:id", route<FastifyRequest<{ Params: { id: string } }>>(async (request, signal) => {
    if (!noQuery(request.query) || !repairIdValid(request.params.id)) throw new PreparationFailure("invalid-request");
    return service.lookup(request.params.id, signal);
  }));
  app.get<{ Params: { id: string } }>("/api/repair-preparations/:id/backup", route<FastifyRequest<{ Params: { id: string } }>>(async (request, signal) => {
    if (!noQuery(request.query) || !repairIdValid(request.params.id)) throw new PreparationFailure("invalid-request");
    return service.download(request.params.id, signal);
  }, true));
}
