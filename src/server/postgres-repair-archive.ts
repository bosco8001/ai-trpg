import pg, { type Pool, type PoolClient } from "pg";
import { REPAIR_ARCHIVE_MAX_BYTES, REPAIR_BACKUP_MAX_BYTES, REPAIR_PAGE_SIZE, type RepairPreparationSummary } from "../shared/repair-preparation.js";
import { PreparationFailure, backupSummary, reuseBackup, verifiedBackup, type RepairArchive } from "./repair-archive.js";
import { withPgClient, type PgClientErrorReporter } from "./pg-client-operation.js";

export function createRepairArchivePool(connectionString: string): Pool {
  const url = new URL(connectionString);
  const options = url.searchParams.get("options") || process.env.PGOPTIONS || "";
  url.searchParams.set("options", `${options} -c default_transaction_read_only=off -c statement_timeout=2000 -c synchronous_commit=on`.trim());
  url.searchParams.set("statement_timeout", "2000");
  return new pg.Pool({ connectionString: url.href, max: 2, connectionTimeoutMillis: 1000 });
}
export class PostgresRepairArchive implements RepairArchive {
  constructor(readonly pool: Pick<Pool, "connect">, readonly maxBytes = REPAIR_BACKUP_MAX_BYTES,
    readonly capacityBytes = REPAIR_ARCHIVE_MAX_BYTES,
    private readonly reportConnectionError?: PgClientErrorReporter) {}
  private async connected<T>(signal: AbortSignal, work: (client: PoolClient) => Promise<T>): Promise<T> {
    return withPgClient(this.pool, signal, () => new PreparationFailure("unavailable"), work, this.reportConnectionError);
  }
  private async read(client: PoolClient, id: string, characterId: string): Promise<string | null> {
    const result = await client.query<{ backup_text: string | null }>(
      "SELECT CASE WHEN octet_length(backup_text) <= $3 THEN backup_text ELSE NULL END AS backup_text FROM repair_preparations WHERE repair_id=$1 AND character_id=$2",
      [id, characterId, this.maxBytes]);
    const row = result.rows[0];
    if (!row) return null;
    if (row.backup_text === null) throw new PreparationFailure("unavailable");
    const data = verifiedBackup(row.backup_text, characterId, id).data;
    if (data.storage !== "postgres") throw new PreparationFailure("unavailable");
    return row.backup_text;
  }
  get(id: string, characterId: string, signal: AbortSignal) {
    return this.connected(signal, client => this.read(client, id, characterId));
  }
  list(characterId: string, cursor: string | null, signal: AbortSignal) {
    return this.connected(signal, async client => {
      const ids = await client.query<{ repair_id: string }>(
        "SELECT repair_id FROM repair_preparations WHERE character_id=$1 AND ($2::uuid IS NULL OR repair_id < $2::uuid) ORDER BY repair_id DESC LIMIT $3",
        [characterId, cursor, REPAIR_PAGE_SIZE + 1]);
      const records: RepairPreparationSummary[] = [];
      for (const row of ids.rows.slice(0, REPAIR_PAGE_SIZE)) {
        signal.throwIfAborted();
        const text = await this.read(client, row.repair_id, characterId);
        if (text === null) throw new PreparationFailure("unavailable");
        records.push(backupSummary(text, characterId, ""));
      }
      return { records, nextCursor: ids.rows.length > REPAIR_PAGE_SIZE ? ids.rows[REPAIR_PAGE_SIZE - 1]!.repair_id : null };
    });
  }
  put(text: string, characterId: string, signal: AbortSignal) {
    const data = verifiedBackup(text, characterId).data;
    if (data.storage !== "postgres") throw new PreparationFailure("conflict");
    if (Buffer.byteLength(text) > this.maxBytes) throw new PreparationFailure("too-large");
    return this.connected(signal, async client => {
      await client.query("BEGIN");
      // These settings also defend direct/custom pool injection from unsafe inherited defaults.
      await client.query("SET LOCAL statement_timeout = '2s'");
      await client.query("SET LOCAL synchronous_commit = on");
      await client.query("SELECT pg_advisory_xact_lock(1790900031)");
      signal.throwIfAborted();
      const old = await this.read(client, data.repairId, characterId);
      if (old !== null) { const reused = reuseBackup(old, text, characterId); await client.query("COMMIT"); return reused; }
      const used = await client.query<{ used: string }>("SELECT COALESCE(sum(octet_length(backup_text) + octet_length(character_id) + 16),0)::text AS used FROM repair_preparations");
      if (BigInt(used.rows[0]!.used) + BigInt(Buffer.byteLength(text) + Buffer.byteLength(characterId) + 16) > BigInt(this.capacityBytes)) throw new PreparationFailure("capacity");
      signal.throwIfAborted();
      try { await client.query("INSERT INTO repair_preparations (repair_id,character_id,backup_text) VALUES ($1,$2,$3)", [data.repairId, characterId, text]); }
      catch (error) { if ((error as { code?: string }).code === "23505") throw new PreparationFailure("conflict"); throw error; }
      const saved = await this.read(client, data.repairId, characterId);
      if (saved !== text) throw new PreparationFailure("unavailable");
      signal.throwIfAborted();
      await client.query("COMMIT");
      // A committed transaction is the durable boundary; verify with a fresh statement too.
      const committed = await this.read(client, data.repairId, characterId);
      if (committed !== text) throw new PreparationFailure("unavailable");
      return committed;
    });
  }
}
