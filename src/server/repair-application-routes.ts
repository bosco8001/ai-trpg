import type { FastifyInstance, FastifyRequest } from "fastify";
import { APPLICATION_MESSAGES, REPAIR_REPORT_MAX_BYTES, isRepairApplyRequest } from "../shared/repair-application.js";
import { repairIdValid } from "../shared/repair-preparation.js";
import { REPAIR_MAX_RESPONSE_BYTES, REPAIR_TIMEOUT_MS } from "../shared/repair-preview.js";
import type { RepairApplicationBackend } from "./repair-application-backend.js";
import { ApplicationFailure } from "./repair-application-core.js";
import { boundedJson } from "./raw-data-backup.js";
import { PreparationFailure } from "./repair-archive.js";

export function registerRepairApplicationRoutes(app: FastifyInstance, backend: RepairApplicationBackend, timeoutMs = REPAIR_TIMEOUT_MS) {
  type Request = FastifyRequest<{ Params: { id: string } }>;
  const statuses = { stale: 409, ineligible: 409, blocked: 409, "identity-conflict": 409, "revision-limit": 409,
    conflict: 409, capacity: 507, unavailable: 503, "not-found": 404, "invalid-request": 400 };
  const noQuery = (query: unknown) => query !== null && typeof query === "object" && Object.keys(query).length === 0;
  function route(work: (request: Request, signal: AbortSignal) => Promise<unknown>, download = false) {
    return async (request: Request, reply: import("fastify").FastifyReply) => {
      reply.header("Cache-Control", "no-store");
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
      const closed = () => { if (!reply.raw.writableEnded) controller.abort(); };
      reply.raw.on("close", closed);
      let stopped!: () => void;
      try {
        if (!repairIdValid(request.params.id) || !noQuery(request.query)) throw new ApplicationFailure("invalid-request");
        const abort = new Promise<never>((_resolve, reject) => {
          stopped = () => reject(new ApplicationFailure("unavailable"));
          controller.signal.addEventListener("abort", stopped, { once: true });
        });
        const result = await Promise.race([work(request, controller.signal), abort]);
        controller.signal.throwIfAborted();
        const text = download ? result as string : boundedJson(result, REPAIR_MAX_RESPONSE_BYTES);
        if (download && Buffer.byteLength(text) > REPAIR_REPORT_MAX_BYTES) throw new ApplicationFailure("unavailable");
        if (download) reply.header("X-Repair-Report-Max-Bytes", String(REPAIR_REPORT_MAX_BYTES))
          .header("Content-Disposition", `attachment; filename="ai-trpg-repair-report-${request.params.id}.json"`);
        return reply.type("application/json").header("Content-Length", String(Buffer.byteLength(text))).send(text);
      } catch (failure) {
        const code = failure instanceof ApplicationFailure ? failure.code
          : failure instanceof PreparationFailure && Object.hasOwn(APPLICATION_MESSAGES, failure.code)
            ? failure.code as keyof typeof APPLICATION_MESSAGES : "unavailable";
        const text = JSON.stringify({ code, message: APPLICATION_MESSAGES[code] });
        return reply.code(statuses[code]).type("application/json").header("Content-Length", String(Buffer.byteLength(text))).send(text);
      } finally {
        clearTimeout(timer); reply.raw.removeListener("close", closed);
        if (stopped) controller.signal.removeEventListener("abort", stopped);
      }
    };
  }
  app.get<{ Params: { id: string } }>("/api/repair-applications/:id", route((request, signal) => backend.lookup(request.params.id, signal)));
  app.post<{ Params: { id: string } }>("/api/repair-applications/:id", { bodyLimit: 4096 }, route((request, signal) => {
    if (!isRepairApplyRequest(request.body) || request.body.repairId !== request.params.id) throw new ApplicationFailure("invalid-request");
    return backend.apply(request.body, signal);
  }));
  app.get<{ Params: { id: string } }>("/api/repair-applications/:id/report", route((request, signal) => backend.download(request.params.id, signal), true));
}
