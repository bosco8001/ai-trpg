import { fileURLToPath } from "node:url";
import pg from "pg";
import { buildApp } from "./app.js";
import { PostgresGameStateRepository } from "./postgres-game-state-repository.js";
import { createLanguageModel } from "./llm/language-model.js";
import { createActionInterpreter } from "./interpretation/interpreter.js";
import { FixtureInterpretationAdapter } from "./interpretation/fixture-adapter.js";
import { createExplorationNarrator } from "./narration/narrator.js";
import { FixtureNarrationAdapter, type NarrationFixtureMode } from "./narration/fixture-adapter.js";
import { PostgresSaveGameRepository } from "./save-game/postgres-repository.js";
import { createCombatFixtureRoller, type CombatRollFixtureMode } from "./combat/dice.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT 必須是 1 至 65535 的整數。");
}

const domainSandbox = process.env.DOMAIN_SANDBOX === "1" && process.env.NODE_ENV !== "production";
const combatSandbox = process.env.COMBAT_SANDBOX === "1" && process.env.NODE_ENV !== "production";
const storage = process.env.DOMAIN_STORAGE ?? "memory";
const narrationMode = process.env.NARRATION_FIXTURE_MODE ?? "normal";
const combatRollMode = process.env.COMBAT_ROLL_FIXTURE_MODE ?? "normal";
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
const pool = storage === "postgres"
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 3000 })
  : undefined;

const app = await buildApp({
  logger: true,
  domainSandbox,
  combatSandbox,
  combatRoller: combatSandbox
    ? createCombatFixtureRoller(combatRollMode as CombatRollFixtureMode)
    : undefined,
  domainRepository: pool ? new PostgresGameStateRepository(pool) : undefined,
  saveGameRepository: pool ? new PostgresSaveGameRepository(pool) : undefined,
  storage,
  interpreter: createActionInterpreter(createLanguageModel(
    new FixtureInterpretationAdapter(), { timeoutMs: 1_000 },
  )),
  narrator: createExplorationNarrator(createLanguageModel(
    new FixtureNarrationAdapter(narrationMode as NarrationFixtureMode), { timeoutMs: 250 },
  )),
  webRoot: process.env.NODE_ENV === "production"
    ? fileURLToPath(new URL("../web/", import.meta.url))
    : undefined,
});
if (pool) {
  pool.on("error", (error) => {
    app.log.error({ err: error }, "PostgreSQL 閒置連線中斷");
  });
  app.addHook("onClose", async () => {
    await pool.end();
  });
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
