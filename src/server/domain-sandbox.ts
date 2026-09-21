import type { FastifyInstance } from "fastify";
import type { GameStateSession } from "./domain-session.js";
import { PersistenceUnavailableError } from "./postgres-game-state-repository.js";

/** 全部為工程測試資料，不代表正式角色或職業起始技能。 */
export function registerDomainSandbox(
  app: FastifyInstance,
  session: GameStateSession,
  storage: "memory" | "postgres",
) {

  function sendSafeError(reply: import("fastify").FastifyReply, error: unknown) {
    app.log.error({ err: error }, "無法處理 domain 測試請求");
    const unavailable = error instanceof PersistenceUnavailableError;
    const status = unavailable ? 503 : 500;
    const code = unavailable ? "state_unavailable" : "state_error";
    const message = unavailable
      ? "暫時無法連接遊戲狀態儲存服務，請稍後重試。"
      : "目前無法讀取遊戲狀態，請聯絡開發人員檢查記錄。";
    return reply.code(status).send({ error: code, message });
  }

  app.get("/api/dev/domain", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      return {
        sandbox: true,
        notice: storage === "postgres" ? "僅供工程測試；狀態由 PostgreSQL 保存。" : "僅供工程測試；重啟即清空。",
        state: await session.getState(),
      };
    } catch (error) {
      return sendSafeError(reply, error);
    }
  });

  app.post<{ Body: unknown }>("/api/dev/domain/commands", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await session.execute(request.body);
      if (!result.ok) {
        reply.code(result.code === "invalid-command" ? 400 : 409);
      }
      return result;
    } catch (error) {
      return sendSafeError(reply, error);
    }
  });
}
