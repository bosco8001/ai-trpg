import { registerSettlementRoutes } from "./combat/settlement-routes.js";
import type { SettlementNarrator } from "./combat/settlement-service.js";
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
import type { CombatParticipantSeed, DiceRoller } from "../domain/combat.js";
import { RandomD20Roller } from "./combat/dice.js";
import { PHASE22_TEST_COMBAT_PARTICIPANTS } from "./combat/fixtures.js";
import { createCombatService } from "./combat/service.js";
import { registerCombatActionRoutes, registerCombatSandbox } from "./combat/routes.js";
import type { CombatNarrationService } from "./combat/narration.js";
import { registerGameStateRoute } from "./game-state-route.js";
import { registerDataDiagnosticsRoute, type DataDiagnosticsReader } from "./data-diagnostics.js";
import { createMemoryBackupReader, registerRawBackupRoute, RawBackupFailure, type RawBackupReader } from "./raw-data-backup.js";

export async function buildApp(options: {
  webRoot?: string;
  logger?: boolean;
  domainSandbox?: boolean;
  domainRepository?: GameStateRepository;
  interpreter?: ActionInterpreter;
  domainSession?: GameStateSession;
  diagnosticsReader?: DataDiagnosticsReader;
  backupReader?: RawBackupReader;
  backupMaxBytes?: number;
  storage?: "memory" | "postgres";
  narrator?: ExplorationNarrator;
  saveGameRepository?: SaveGameRepository;
  combatSandbox?: boolean;
  combatRoller?: DiceRoller;
  combatRollerFactory?: () => DiceRoller;
  combatActionRoller?: DiceRoller;
  combatEscapeRoller?: DiceRoller;
  combatNarrator?: CombatNarrationService;
  settlementNarrator?: SettlementNarrator;
  /** Allows focused legacy three-participant tests to keep their original roster. */
  combatParticipants?: readonly CombatParticipantSeed[];
  /** Trusted server context; never accepted from a Start request. */
  combatStartContext?: import("../domain/combat.js").CombatStartContext;
} = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  const storage = options.storage ?? (options.domainRepository ? "postgres" : "memory");
  const session = options.domainSession ?? (options.domainRepository
    ? createPersistedDomainSession(options.domainRepository, createTestGameState())
    : createDomainSession(createTestGameState()));
  const saveGameRepository = options.saveGameRepository
    ?? new InMemorySaveGameRepository(() => session.getState());
  const combatSandboxEnabled = options.combatSandbox === true && options.domainSandbox === true && process.env.NODE_ENV !== "production";
  const combatService = createCombatService(
    session,
    options.combatParticipants ?? PHASE22_TEST_COMBAT_PARTICIPANTS,
    options.combatRoller ?? new RandomD20Roller(),
    options.combatActionRoller ?? new RandomD20Roller(),
    options.combatEscapeRoller ?? new RandomD20Roller(),
    options.combatStartContext,
    combatSandboxEnabled ? options.combatRollerFactory : undefined,
  );

  registerGameStateRoute(app, session, storage, combatSandboxEnabled);
  registerRawBackupRoute(app, options.backupReader ?? createMemoryBackupReader(createTestGameState().character.id, () => {
    if (storage !== "memory" || !session.readStateForBackup || !(saveGameRepository instanceof InMemorySaveGameRepository))
      throw new RawBackupFailure("unavailable");
    return { current: session.readStateForBackup(), slots: saveGameRepository.readAllForBackup() };
  }), options.backupMaxBytes);
  registerDataDiagnosticsRoute(app, options.diagnosticsReader ?? {
    async readCurrent() {
      if (!session.readStateForDiagnostics) throw new Error("缺少唯讀資料來源。");
      const state = await session.readStateForDiagnostics();
      return state === undefined ? undefined : { kind: "state", value: state };
    },
    readSlot: slotId => saveGameRepository.read(slotId),
  }, storage);
  registerSettlementRoutes(app,session,storage,combatSandboxEnabled,options.settlementNarrator);
  registerCombatActionRoutes(app, combatService, storage, combatSandboxEnabled, options.combatNarrator);

  if (options.domainSandbox && process.env.NODE_ENV !== "production") {
    registerDomainSandbox(app, session, storage);
  }
  if (combatSandboxEnabled) {
    registerCombatSandbox(app, combatService, storage, options.domainSandbox === true);
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
