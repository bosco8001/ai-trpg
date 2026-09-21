import type { FastifyInstance } from "fastify";
import { isExplorationActionResponse } from "../../shared/exploration-action.js";
import { InterpretationFailure } from "../interpretation/interpreter.js";
import { InvalidPersistedStateError, PersistenceUnavailableError } from "../postgres-game-state-repository.js";
import type { ExplorationActionService } from "./action-service.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRequest(value: unknown): value is { text: string; expectedRevision: number } {
  return isRecord(value) && Object.keys(value).length === 2
    && Object.hasOwn(value, "text") && typeof value.text === "string"
    && Object.hasOwn(value, "expectedRevision") && typeof value.expectedRevision === "number"
    && Number.isSafeInteger(value.expectedRevision) && value.expectedRevision >= 0;
}

function safeFailure(error: unknown): { status: number; error: string; message: string } {
  if (error instanceof InterpretationFailure) {
    const status = error.code === "invalid-input" ? 400 : error.code === "timeout" ? 504
      : error.code === "unavailable" ? 503 : 502;
    return { status, error: error.code, message: error.message };
  }
  if (error instanceof PersistenceUnavailableError) {
    return { status: 503, error: "state-unavailable", message: "遊戲狀態暫時無法使用，請稍後再試。" };
  }
  if (error instanceof InvalidPersistedStateError) {
    return { status: 500, error: "state-invalid", message: "已保存的遊戲狀態無法安全讀取。" };
  }
  return { status: 500, error: "action-failed", message: "目前無法處理探索行動，請稍後再試。" };
}

export function registerExplorationRoutes(app: FastifyInstance, service: ExplorationActionService) {
  app.get("/api/exploration/state", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      return await service.getState();
    } catch (error) {
      app.log.error({ err: error }, "無法讀取探索狀態");
      const failure = safeFailure(error);
      return reply.code(failure.status).send({ error: failure.error, message: failure.message });
    }
  });

  app.post<{ Body: unknown }>("/api/exploration/actions", {
    bodyLimit: 4096,
    errorHandler: (_error, _request, reply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的探索行動請求。" });
    },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!isRequest(request.body)) {
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的探索行動請求。" });
    }
    try {
      const response = await service.execute(request.body.text, request.body.expectedRevision);
      if (!isExplorationActionResponse(response)) throw new Error("探索回應未通過 runtime validation。");
      if (!response.ruling.accepted && response.ruling.code === "stale-revision") reply.code(409);
      return response;
    } catch (error) {
      app.log.error({ err: error }, "無法處理探索行動");
      const failure = safeFailure(error);
      return reply.code(failure.status).send({ error: failure.error, message: failure.message });
    }
  });
}
