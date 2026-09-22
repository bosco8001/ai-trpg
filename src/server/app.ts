import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import type { HealthResponse } from "../shared/health.js";
import type { GameStateRepository } from "../domain/game-state-repository.js";
import { registerDomainSandbox } from "./domain-sandbox.js";
import { registerInterpretationRoute } from "./interpretation/routes.js";
import type { ActionInterpreter } from "./interpretation/interpreter.js";
import { createDomainSession, createPersistedDomainSession, type GameStateSession } from "./domain-session.js";
import { createTestGameState } from "./test-game-state.js";
import { createExplorationActionService } from "./exploration/action-service.js";
import { registerExplorationRoutes } from "./exploration/routes.js";
import type { ExplorationNarrator } from "./narration/contracts.js";

export async function buildApp(options: {
  webRoot?: string;
  logger?: boolean;
  domainSandbox?: boolean;
  domainRepository?: GameStateRepository;
  interpreter?: ActionInterpreter;
  domainSession?: GameStateSession;
  storage?: "memory" | "postgres";
  narrator?: ExplorationNarrator;
} = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  const storage = options.storage ?? (options.domainRepository ? "postgres" : "memory");
  const session = options.domainSession ?? (options.domainRepository
    ? createPersistedDomainSession(options.domainRepository, createTestGameState())
    : createDomainSession(createTestGameState()));

  if (options.domainSandbox && process.env.NODE_ENV !== "production") {
    registerDomainSandbox(app, session, storage);
  }
  if (options.interpreter) {
    registerInterpretationRoute(app, options.interpreter);
    registerExplorationRoutes(app, createExplorationActionService(
      options.interpreter, session, storage, options.narrator,
    ));
  }

  app.get<{ Reply: HealthResponse }>("/api/health", {
    schema: {
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          required: ["status", "service"],
          properties: {
            status: { type: "string", const: "ok" },
            service: { type: "string", const: "ai-trpg-api" },
          },
        },
      },
    },
  }, async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return { status: "ok", service: "ai-trpg-api" };
  });

  if (options.webRoot) {
    await app.register(fastifyStatic, { root: options.webRoot });
  }
  return app;
}
