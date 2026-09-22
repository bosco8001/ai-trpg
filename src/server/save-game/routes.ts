import type { FastifyInstance, FastifyReply } from "fastify";
import { isSaveOperationResponse, isSaveSlotId, isSaveSlotsResponse } from "../../shared/save-game.js";
import { SaveGameFailure } from "./contracts.js";
import type { SaveGameService } from "./service.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBody(value: unknown): value is { expectedRevision: number } {
  return isRecord(value) && Object.keys(value).length === 1
    && Object.hasOwn(value, "expectedRevision") && typeof value.expectedRevision === "number"
    && Number.isSafeInteger(value.expectedRevision) && value.expectedRevision >= 0;
}

function parseSlot(value: unknown) {
  if (typeof value !== "string" || !/^[123]$/.test(value)) return undefined;
  const slotId = Number(value);
  return isSaveSlotId(slotId) ? slotId : undefined;
}

function failureStatus(error: SaveGameFailure): number {
  if (error.code === "invalid-slot") return 400;
  if (error.code === "slot-empty") return 404;
  if (error.code === "stale-revision" || error.code === "revision-limit") return 409;
  if (error.code === "invalid-save" || error.code === "unsupported-format") return 422;
  return 503;
}

function handleFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  app.log.error({ err: error }, "存檔操作失敗");
  const failure = error instanceof SaveGameFailure ? error : new SaveGameFailure("unavailable", { cause: error });
  return reply.code(failureStatus(failure)).send({ error: failure.code, message: failure.message });
}

export function registerSaveGameRoutes(app: FastifyInstance, service: SaveGameService) {
  app.get("/api/save-slots", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const response = await service.list();
      if (!isSaveSlotsResponse(response)) throw new Error("存檔列表未通過 runtime validation。");
      return response;
    } catch (error) {
      return handleFailure(app, reply, error);
    }
  });

  app.put<{ Params: { slotId: string }; Body: unknown }>("/api/save-slots/:slotId", {
    bodyLimit: 1024,
    errorHandler: (_error, _request, reply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的存檔請求。" });
    },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const slotId = parseSlot(request.params.slotId);
    if (!slotId || !isBody(request.body)) {
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的存檔請求。" });
    }
    try {
      const response = await service.save(slotId, request.body.expectedRevision);
      if (!isSaveOperationResponse(response)) throw new Error("存檔回應未通過 runtime validation。");
      return response;
    } catch (error) {
      return handleFailure(app, reply, error);
    }
  });

  app.post<{ Params: { slotId: string }; Body: unknown }>("/api/save-slots/:slotId/load", {
    bodyLimit: 1024,
    errorHandler: (_error, _request, reply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的載入請求。" });
    },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const slotId = parseSlot(request.params.slotId);
    if (!slotId || !isBody(request.body)) {
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的載入請求。" });
    }
    try {
      const response = await service.load(slotId, request.body.expectedRevision);
      if (!isSaveOperationResponse(response)) throw new Error("載入回應未通過 runtime validation。");
      return response;
    } catch (error) {
      return handleFailure(app, reply, error);
    }
  });
}
