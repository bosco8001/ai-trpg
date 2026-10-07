import type { Pool, PoolClient } from "pg";
import { createHash } from "node:crypto";
import { withPgClient, type PgClientErrorReporter } from "../pg-client-operation.js";
import { CreationFailure } from "../../domain/character-creation.js";
import { creationRequestText, isCreationRecord, type CreationRecord, type CreationRequest } from "../../shared/character-creation.js";
import type { CreationRepository } from "./contracts.js";

const owner = "local-player"; // Trusted current single-service scope, never an HTTP body or TEST character ID.
const digest = (r: CreationRequest) => createHash("sha256").update(creationRequestText(r)).digest("hex");
function decode(row: Record<string, unknown>): CreationRecord {
  const value = row.record;
  if (!isCreationRecord(value) || row.owner_key !== owner || row.character_id !== value.characterId
    || row.request_id !== value.request.requestId || row.request_hash !== digest(value.request))
    throw new CreationFailure("invalid-record");
  return value;
}
async function select(client: PoolClient) {
  const result = await client.query("SELECT owner_key, character_id, request_id, request_hash, record FROM character_creation_records WHERE owner_key = $1", [owner]);
  if (result.rows.length > 1) throw new CreationFailure("invalid-record");
  return result.rows[0] ? decode(result.rows[0] as Record<string, unknown>) : null;
}
export class PostgresCreationRepository implements CreationRepository {
  constructor(private readonly pool: Pick<Pool, "connect">, private readonly report?: PgClientErrorReporter) {}
  private async transaction<T>(signal: AbortSignal, work: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await withPgClient(this.pool, signal, () => new CreationFailure("unavailable"), async client => {
        await client.query("BEGIN");
        try {
          await client.query("SET LOCAL statement_timeout = '3000ms'; SET LOCAL lock_timeout = '3000ms'; SET LOCAL idle_in_transaction_session_timeout = '10000ms'");
          const value = await work(client);
          await client.query("COMMIT");
          return value;
        } catch (error) {
          try { await client.query("ROLLBACK"); } catch { /* Outcome may be unknown; request identity remains reusable. */ }
          throw error;
        }
      }, this.report);
    } catch (error) {
      if (error instanceof CreationFailure) throw error;
      throw new CreationFailure("unavailable"); // No raw pg errors, SQL, paths or connection parameters.
    }
  }
  async read(signal: AbortSignal) { return this.transaction(signal, select); }
  async create(request: CreationRequest, generate: () => CreationRecord, signal: AbortSignal) {
    return this.transaction(signal, async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["character-creation:" + owner]);
      const existing = await select(client);
      if (existing) {
        if (existing.request.requestId !== request.requestId) throw new CreationFailure("already-created");
        if (digest(existing.request) !== digest(request)) throw new CreationFailure("request-conflict");
        return existing;
      }
      const record = generate();
      await client.query("INSERT INTO character_creation_records (character_id, owner_key, request_id, request_hash, record) VALUES ($1, $2, $3, $4, $5::jsonb)",
        [record.characterId, owner, request.requestId, digest(request), JSON.stringify(record)]);
      return record;
    });
  }
}
