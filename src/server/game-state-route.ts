import type { FastifyInstance } from "fastify";
import { createGameState } from "../domain/game.js";
import { isAuthoritativeGameStateResponse } from "../shared/game-state.js";
import type { GameStateSession } from "./domain-session.js";
import { InvalidPersistedStateError, PersistenceUnavailableError } from "./postgres-game-state-repository.js";

/** 前端切換探索／戰鬥畫面的唯讀權威快照；不接受任何 client state。 */
export function registerGameStateRoute(
  app: FastifyInstance,
  session: GameStateSession,
  storage: "memory" | "postgres",
  sandbox: boolean,
) {
  app.get("/api/game-state", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const response = { sandbox, storage, state: createGameState(await session.getState()) };
      if (!isAuthoritativeGameStateResponse(response)) throw new Error("權威狀態回應未通過 runtime validation。");
      return response;
    } catch (error) {
      app.log.error({ err: error }, "無法讀取權威遊戲狀態");
      if (error instanceof PersistenceUnavailableError) {
        return reply.code(503).send({ error: "state-unavailable", message: "目前無法讀取遊戲狀態。" });
      }
      if (error instanceof InvalidPersistedStateError) {
        return reply.code(500).send({ error: "state-invalid", message: "已保存的遊戲狀態無法安全讀取。" });
      }
      return reply.code(500).send({ error: "state-unavailable", message: "目前無法讀取遊戲狀態。" });
    }
  });
}
