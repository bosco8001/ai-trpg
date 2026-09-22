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
import type { SaveGameRepository } from "./save-game/contracts.js";
import { InMemorySaveGameRepository } from "./save-game/memory-repository.js";
import { createSaveGameService } from "./save-game/service.js";
import { registerSaveGameRoutes } from "./save-game/routes.js";
import type { DiceRoller } from "../domain/combat.js";
import { RandomD20Roller } from "./combat/dice.js";
import { TEST_COMBAT_PARTICIPANTS } from "./combat/fixtures.js";
import { createCombatService } from "./combat/service.js";
import { registerCombatSandbox } from "./combat/routes.js";
import { registerGameStateRoute } from "./game-state-route.js";

export async function buildApp(options: {
  webRoot?: string;
  logger?: boolean;
  domainSandbox?: boolean;
  domainRepository?: GameStateRepository;
  interpreter?: ActionInterpreter;
  domainSession?: GameStateSession;
  storage?: "memory" | "postgres";
  narrator?: ExplorationNarrator;
  saveGameRepository?: SaveGameRepository;
  combatSandbox?: boolean;
  combatRoller?: DiceRoller;
} = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  const storage = options.storage ?? (options.domainRepository ? "postgres" : "memory");
  const session = options.domainSession ?? (options.domainRepository
    ? createPersistedDomainSession(options.domainRepository, createTestGameState())
    : createDomainSession(createTestGameState()));
  const saveGameRepository = options.saveGameRepository
    ?? new InMemorySaveGameRepository(() => session.getState());
  const combatSandboxEnabled = options.combatSandbox === true && process.env.NODE_ENV !== "production";

  registerGameStateRoute(app, session, storage, combatSandboxEnabled);

  if (options.domainSandbox && process.env.NODE_ENV !== "production") {
    registerDomainSandbox(app, session, storage);
  }
  if (combatSandboxEnabled) {
    registerCombatSandbox(app, createCombatService(
      session,
      TEST_COMBAT_PARTICIPANTS,
      options.combatRoller ?? new RandomD20Roller(),
    ), storage);
  }
  if (options.interpreter) {
    registerInterpretationRoute(app, options.interpreter);
    registerExplorationRoutes(app, createExplorationActionService(
      options.interpreter, session, storage, options.narrator,
    ));
  }
  registerSaveGameRoutes(app, createSaveGameService(saveGameRepository, session, storage));

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
