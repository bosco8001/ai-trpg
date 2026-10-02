import { createSettlementNarrator, settlementFallback } from "./combat/settlement-service.js";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { FastifyBaseLogger } from "fastify";
import { buildApp } from "./app.js";
import { PostgresGameStateRepository } from "./postgres-game-state-repository.js";
import { createLanguageModel } from "./llm/language-model.js";
import { createActionInterpreter } from "./interpretation/interpreter.js";
import { FixtureInterpretationAdapter } from "./interpretation/fixture-adapter.js";
import { createExplorationNarrator } from "./narration/narrator.js";
import { createCombatNarrationService } from "./combat/narration.js";
import { FixtureCombatNarrationAdapter } from "./combat/narration-fixture-adapter.js";
import { FixtureNarrationAdapter, type NarrationFixtureMode } from "./narration/fixture-adapter.js";
import { PostgresSaveGameRepository } from "./save-game/postgres-repository.js";
import { createPostgresDiagnosticsPool, createPostgresDiagnosticsReader } from "./postgres-data-diagnostics.js";
import { createTestGameState } from "./test-game-state.js";
import { backupMaxBytes } from "./raw-data-backup.js";
import { createPostgresBackupReader } from "./postgres-raw-data-backup.js";
import { createPostgresRepairReader } from "./repair-preview-reader.js";
import { createRepairArchivePool, PostgresRepairArchive } from "./postgres-repair-archive.js";
import { repairArchiveLimit } from "./repair-archive.js";
import { REPAIR_ARCHIVE_MAX_BYTES, REPAIR_BACKUP_MAX_BYTES } from "../shared/repair-preparation.js";
import {
  createCombatActionFixtureRoller,
  createPhase22CombatFixtureRoller,
  createCombatEscapeFixtureRoller,
  type CombatActionRollFixtureMode,
  type CombatRollFixtureMode,
  type CombatEscapeRollFixtureMode,
} from "./combat/dice.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT 必須是 1 至 65535 的整數。");
}

const domainSandbox = process.env.DOMAIN_SANDBOX === "1" && process.env.NODE_ENV !== "production";
const combatSandbox = process.env.COMBAT_SANDBOX === "1" && process.env.NODE_ENV !== "production";
const storage = process.env.DOMAIN_STORAGE ?? "memory";
const narrationMode = process.env.NARRATION_FIXTURE_MODE ?? "normal";
const combatRollMode = process.env.COMBAT_ROLL_FIXTURE_MODE ?? "normal";
const combatActionRollMode = process.env.COMBAT_ACTION_ROLL_FIXTURE_MODE;
const combatEscapeRollMode = process.env.COMBAT_ESCAPE_ROLL_FIXTURE_MODE;
if (storage !== "memory" && storage !== "postgres") {
  throw new Error("DOMAIN_STORAGE 只接受 memory 或 postgres。");
}
if (storage === "postgres" && !process.env.DATABASE_URL) {
  throw new Error("PostgreSQL 測試模式需要 DATABASE_URL。請建立 .env。");
}
if (narrationMode !== "normal" && narrationMode !== "unavailable"
  && narrationMode !== "timeout" && narrationMode !== "malformed") {
  throw new Error("NARRATION_FIXTURE_MODE 只接受 normal、unavailable、timeout 或 malformed。");
}
if (combatSandbox && combatRollMode !== "normal" && combatRollMode !== "tie") {
  throw new Error("COMBAT_ROLL_FIXTURE_MODE 只接受 normal 或 tie。");
}
if (combatSandbox && combatActionRollMode !== undefined
  && combatActionRollMode !== "hit" && combatActionRollMode !== "miss"
  && combatActionRollMode !== "raw-one-hit") {
  throw new Error("COMBAT_ACTION_ROLL_FIXTURE_MODE 只接受 hit、miss 或 raw-one-hit。");
}
if (process.env.NODE_ENV === "production" && combatActionRollMode !== undefined) {
  throw new Error("正式服務不可啟用 COMBAT_ACTION_ROLL_FIXTURE_MODE。");
}
if (combatEscapeRollMode !== undefined && combatEscapeRollMode !== "success" && combatEscapeRollMode !== "failure") {
  throw new Error("COMBAT_ESCAPE_ROLL_FIXTURE_MODE 只接受 success 或 failure。");
}
if (process.env.NODE_ENV === "production" && combatEscapeRollMode !== undefined) {
  throw new Error("正式服務不可啟用 COMBAT_ESCAPE_ROLL_FIXTURE_MODE。");
}
const pool = storage === "postgres"
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 3000 })
  : undefined;
const diagnosticsPool = storage === "postgres"
  ? createPostgresDiagnosticsPool(process.env.DATABASE_URL!)
  : undefined;
const backupPool = storage === "postgres"
  ? createPostgresDiagnosticsPool(process.env.DATABASE_URL!)
  : undefined;
const rawBackupMaxBytes = backupMaxBytes(process.env.RAW_BACKUP_MAX_BYTES);
const repairPreviewPool = storage === "postgres" ? createPostgresDiagnosticsPool(process.env.DATABASE_URL!) : undefined;
const repairArchivePool = storage === "postgres" ? createRepairArchivePool(process.env.DATABASE_URL!) : undefined;
const repairBackupMaxBytes = repairArchiveLimit(process.env.REPAIR_BACKUP_MAX_BYTES, REPAIR_BACKUP_MAX_BYTES, REPAIR_BACKUP_MAX_BYTES);
const repairArchiveMaxBytes = repairArchiveLimit(process.env.REPAIR_ARCHIVE_MAX_BYTES, REPAIR_ARCHIVE_MAX_BYTES);

let pgOperationLogger: Pick<FastifyBaseLogger, "error"> | undefined;
function logPgConnectionError(operation: "main" | "diagnostics" | "raw-backup" | "repair-preview" | "repair-archive", state: "borrowed" | "idle") {
  pgOperationLogger?.error({ event: "pg_connection_error", operation, state }, "PostgreSQL 連線中斷");
}

const app = await buildApp({
  logger: true,
  domainSandbox,
  combatSandbox,
  combatStartContext: domainSandbox && combatSandbox && process.env.COMBAT_ENCOUNTER_FIXTURE === "1"
    ? {sourceEncounterId:"TEST-encounter-1",rewardEligibleOnVictory:false} : undefined,
  combatRollerFactory: combatSandbox
    ? () => createPhase22CombatFixtureRoller(combatRollMode as CombatRollFixtureMode)
    : undefined,
  combatActionRoller: combatSandbox && combatActionRollMode
    ? createCombatActionFixtureRoller(combatActionRollMode as CombatActionRollFixtureMode)
    : undefined,
  combatEscapeRoller: combatSandbox && combatEscapeRollMode
    ? createCombatEscapeFixtureRoller(combatEscapeRollMode as CombatEscapeRollFixtureMode)
    : undefined,
  domainRepository: pool ? new PostgresGameStateRepository(pool) : undefined,
  saveGameRepository: pool ? new PostgresSaveGameRepository(pool) : undefined,
  diagnosticsReader: diagnosticsPool ? createPostgresDiagnosticsReader(diagnosticsPool, createTestGameState().character.id) : undefined,
  backupReader: backupPool ? createPostgresBackupReader(backupPool, createTestGameState().character.id,
    () => logPgConnectionError("raw-backup", "borrowed")) : undefined,
  backupMaxBytes: rawBackupMaxBytes,
  repairPreviewReader: repairPreviewPool ? createPostgresRepairReader(repairPreviewPool, createTestGameState().character.id,
    () => logPgConnectionError("repair-preview", "borrowed")) : undefined,
  repairArchive: repairArchivePool ? new PostgresRepairArchive(repairArchivePool, repairBackupMaxBytes, repairArchiveMaxBytes,
    () => logPgConnectionError("repair-archive", "borrowed")) : undefined,
  repairBackupDirectory: process.env.REPAIR_BACKUP_DIRECTORY,
  repairBackupMaxBytes,
  repairArchiveMaxBytes,
  storage,
  interpreter: createActionInterpreter(createLanguageModel(
    new FixtureInterpretationAdapter(), { timeoutMs: 1_000 },
  )),
  narrator: createExplorationNarrator(createLanguageModel(
    new FixtureNarrationAdapter(narrationMode as NarrationFixtureMode), { timeoutMs: 250 },
  )),
  combatNarrator: createCombatNarrationService(createLanguageModel(
    new FixtureCombatNarrationAdapter(narrationMode as NarrationFixtureMode), { timeoutMs: 250 },
  )),
  settlementNarrator: createSettlementNarrator(createLanguageModel({
    async generateText(request, signal) {
      if(narrationMode === 'unavailable') throw new Error('fixture');
      if(narrationMode === 'timeout') {await new Promise<void>((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('fixture')), {once:true});});}
      const input=JSON.parse(request.input);
      return {text:narrationMode === 'malformed' ? '{' : JSON.stringify({text:input.allowed[0]})};
    },
  },{timeoutMs:250})),
  webRoot: process.env.NODE_ENV === "production"
    ? fileURLToPath(new URL("../web/", import.meta.url))
    : undefined,
});
pgOperationLogger = app.log;
if (pool) {
  pool.on("error", () => logPgConnectionError("main", "idle"));
  app.addHook("onClose", async () => {
    await pool.end();
  });
}
if (diagnosticsPool) {
  diagnosticsPool.on("error", () => logPgConnectionError("diagnostics", "idle"));
  app.addHook("onClose", async () => {
    await diagnosticsPool.end();
  });
}
if (backupPool) {
  backupPool.on("error", () => logPgConnectionError("raw-backup", "idle"));
  app.addHook("onClose", async () => { await backupPool.end(); });
}
if (repairPreviewPool) {
  repairPreviewPool.on("error", () => logPgConnectionError("repair-preview", "idle"));
  app.addHook("onClose", async () => { await repairPreviewPool.end(); });
}
if (repairArchivePool) {
  repairArchivePool.on("error", () => logPgConnectionError("repair-archive", "idle"));
  app.addHook("onClose", async () => { await repairArchivePool.end(); });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().catch((error: unknown) => {
      app.log.error(error);
      process.exitCode = 1;
    });
  });
}

try {
  await app.listen({ host: "127.0.0.1", port });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
