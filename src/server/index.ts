import { fileURLToPath } from "node:url";
import pg from "pg";
import { buildApp } from "./app.js";
import { PostgresGameStateRepository } from "./postgres-game-state-repository.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT 必須是 1 至 65535 的整數。");
}

const domainSandbox = process.env.DOMAIN_SANDBOX === "1" && process.env.NODE_ENV !== "production";
const storage = process.env.DOMAIN_STORAGE ?? "memory";
if (domainSandbox && storage !== "memory" && storage !== "postgres") {
  throw new Error("DOMAIN_STORAGE 只接受 memory 或 postgres。");
}
if (domainSandbox && storage === "postgres" && !process.env.DATABASE_URL) {
  throw new Error("PostgreSQL 測試模式需要 DATABASE_URL。請建立 .env。");
}
const pool = domainSandbox && storage === "postgres"
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 3000 })
  : undefined;

const app = await buildApp({
  logger: true,
  domainSandbox,
  domainRepository: pool ? new PostgresGameStateRepository(pool) : undefined,
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
