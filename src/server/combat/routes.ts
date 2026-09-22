import type { FastifyInstance, FastifyReply } from "fastify";
import { createGameState } from "../../domain/game.js";
import type { CombatTransitionResult } from "../../domain/combat.js";
import { InvalidPersistedStateError, PersistenceUnavailableError } from "../postgres-game-state-repository.js";
import type { CombatService } from "./service.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRequest(value: unknown): value is { expectedRevision: number } {
  return isRecord(value) && Object.keys(value).length === 1
    && Object.hasOwn(value, "expectedRevision") && typeof value.expectedRevision === "number"
    && Number.isSafeInteger(value.expectedRevision) && value.expectedRevision >= 0;
}

function status(result: Extract<CombatTransitionResult, { ok: false }>): number {
  return result.code === "invalid-command" || result.code === "invalid-combat-setup" ? 400 : 409;
}

function safeFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  app.log.error({ err: error }, "TEST 戰鬥操作失敗");
  if (error instanceof PersistenceUnavailableError) {
    return reply.code(503).send({ error: "state-unavailable", message: "戰鬥狀態暫時無法使用，請稍後再試。" });
  }
  if (error instanceof InvalidPersistedStateError) {
    return reply.code(500).send({ error: "state-invalid", message: "已保存的戰鬥狀態無法安全讀取。" });
  }
  return reply.code(500).send({ error: "combat-failed", message: "目前無法處理 TEST 戰鬥操作。" });
}

function validatedState(value: unknown) {
  return createGameState(value);
}

export function registerCombatSandbox(
  app: FastifyInstance,
  service: CombatService,
  storage: "memory" | "postgres",
) {
  app.get("/api/dev/combat", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      return { sandbox: true, storage, state: validatedState(await service.getState()) };
    } catch (error) {
      return safeFailure(app, reply, error);
    }
  });

  const operation = (kind: "start" | "advance") => async (request: { body: unknown }, reply: FastifyReply) => {
    reply.header("Cache-Control", "no-store");
    if (!isRequest(request.body)) {
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的 TEST 戰鬥請求。" });
    }
    try {
      const result = kind === "start" ? await service.start(request.body) : await service.advance(request.body);
      if (!result.ok) return reply.code(status(result)).send(result);
      return { sandbox: true, storage, effect: result.effect, state: validatedState(result.state) };
    } catch (error) {
      return safeFailure(app, reply, error);
    }
  };

  const options = {
    bodyLimit: 1024,
    errorHandler: (_error: Error, _request: unknown, reply: FastifyReply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的 TEST 戰鬥請求。" });
    },
  };
  app.post<{ Body: unknown }>("/api/dev/combat/start", options, operation("start"));
  app.post<{ Body: unknown }>("/api/dev/combat/advance", options, operation("advance"));
}
