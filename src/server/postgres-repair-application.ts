import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { PostgresRepairArchive, repairArchiveUsedBytes } from "./postgres-repair-archive.js";
import { withPgClient, type PgClientErrorReporter } from "./pg-client-operation.js";
import type { RepairApplicationBackend } from "./repair-application-backend.js";
import type { RepairPreviewReader, RepairRawRecord } from "./repair-preview-reader.js";
import { REPAIR_MAX_SOURCE_BYTES } from "../shared/repair-preview.js";
import { REPAIR_REPORT_MAX_BYTES, type RepairApplyRequest, type RepairApplication } from "../shared/repair-application.js";
import { ApplicationFailure, applicationState, certificateOf, makeCertificate, matchesCertificate, planRepair,
  reportText, verifiedReport } from "./repair-application-core.js";

interface ApplicationRow { certificate_text: string | null; owner_token: string | null; started_at: string | null; report_text: string | null; epoch: string }
export class PostgresRepairApplication implements RepairApplicationBackend {
  constructor(private readonly reader: RepairPreviewReader, private readonly archive: PostgresRepairArchive,
    private readonly reportConnectionError?: PgClientErrorReporter) {}
  private connected<T>(signal: AbortSignal, work: (client: PoolClient) => Promise<T>) {
    return withPgClient(this.archive.pool, signal, () => new ApplicationFailure("unavailable"), work, this.reportConnectionError);
  }
  private async row(client: PoolClient, id: string, lock = false): Promise<ApplicationRow | null> {
    const result = await client.query<ApplicationRow>(`SELECT
      CASE WHEN octet_length(certificate_text) <= 65536 THEN certificate_text ELSE NULL END AS certificate_text,
      owner_token::text, started_at, report_text,
      (SELECT token::text FROM repair_apply_epoch WHERE singleton) AS epoch
      FROM repair_applications WHERE repair_id = $1 AND character_id = $2 ${lock ? "FOR UPDATE" : ""}`, [id, this.reader.characterId]);
    const row = result.rows[0];
    if (!row) return null;
    if (!row.certificate_text || !row.epoch || (row.owner_token === null) !== (row.started_at === null)) throw new ApplicationFailure("unavailable");
    certificateOf(row.certificate_text, this.reader.characterId, id);
    return row;
  }
  private state(id: string, row: ApplicationRow | null): RepairApplication {
    if (!row) return applicationState(id, "ineligible");
    const c = certificateOf(row.certificate_text!, this.reader.characterId, id);
    if (row.report_text !== null) {
      const result = verifiedReport(row.report_text, this.reader.characterId, id);
      if (result.report.sourceGuard !== c.sourceGuard || result.report.preparation.backupChecksum !== c.preparation.backupChecksum) throw new ApplicationFailure("unavailable");
      return applicationState(id, result.report.status, row.report_text, this.reader.characterId);
    }
    if (row.owner_token !== null) return applicationState(id, "unknown");
    return applicationState(id, c.sourceGuard.startsWith(`${row.epoch}:`) ? "ready" : "ineligible");
  }
  async bind(backup: string, source: RepairRawRecord, signal: AbortSignal) {
    if (!source.sourceGuard) return;
    const text = makeCertificate(backup, source.sourceGuard, this.reader.characterId, "");
    const c = certificateOf(text, this.reader.characterId);
    await this.connected(signal, async client => {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '2s'");
      await client.query("SET LOCAL synchronous_commit = on");
      await client.query("SELECT pg_advisory_xact_lock(1790900031)");
      const old = await this.row(client, c.preparation.repairId);
      if (old !== null) {
        if (old.certificate_text !== text) throw new ApplicationFailure("conflict");
      } else {
        if (await repairArchiveUsedBytes(client) + BigInt(Buffer.byteLength(text) + Buffer.byteLength(this.reader.characterId) + 16) > BigInt(this.archive.capacityBytes)) throw new ApplicationFailure("capacity");
        signal.throwIfAborted();
        await client.query("INSERT INTO repair_applications (repair_id, character_id, certificate_text) VALUES ($1,$2,$3)", [c.preparation.repairId, this.reader.characterId, text]);
      }
      signal.throwIfAborted();
      await client.query("COMMIT");
      if ((await this.row(client, c.preparation.repairId))?.certificate_text !== text) throw new ApplicationFailure("unavailable");
    });
  }
  async lookup(id: string, signal: AbortSignal) {
    if (await this.archive.get(id, this.reader.characterId, signal) === null) throw new ApplicationFailure("not-found");
    return this.connected(signal, async client => this.state(id, await this.row(client, id)));
  }
  async apply(request: RepairApplyRequest, signal: AbortSignal): Promise<RepairApplication> {
    const backup = await this.archive.get(request.repairId, this.reader.characterId, signal);
    if (backup === null) throw new ApplicationFailure("not-found");
    const owner = randomUUID(), startedAt = new Date().toISOString();
    const begun = await this.connected(signal, async client => {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '2s'");
      await client.query("SET LOCAL synchronous_commit = on");
      await client.query("SELECT pg_advisory_xact_lock(1790900031)");
      const row = await this.row(client, request.repairId, true);
      const state = this.state(request.repairId, row);
      if (!row) { await client.query("COMMIT"); return { state, certificate: null }; }
      const certificate = certificateOf(row.certificate_text!, this.reader.characterId, request.repairId);
      matchesCertificate(certificate, request, backup);
      if (!state.canApply) { await client.query("COMMIT"); return { state, certificate: null }; }
      if (await repairArchiveUsedBytes(client) + BigInt(REPAIR_REPORT_MAX_BYTES + 128) > BigInt(this.archive.capacityBytes)) throw new ApplicationFailure("capacity");
      signal.throwIfAborted();
      await client.query("UPDATE repair_applications SET owner_token=$3, started_at=$4, reserved_bytes=$5 WHERE repair_id=$1 AND character_id=$2", [request.repairId, this.reader.characterId, owner, startedAt, REPAIR_REPORT_MAX_BYTES]);
      signal.throwIfAborted();
      await client.query("COMMIT"); // The claim survives every later source transaction failure.
      return { state: applicationState(request.repairId, "unknown"), certificate };
    });
    if (!begun.certificate) return begun.state;
    const c = begun.certificate;
    return this.connected(signal, async client => {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '2s'");
      await client.query("SET LOCAL synchronous_commit = on");
      const application = await this.row(client, request.repairId, true);
      if (!application || application.owner_token !== owner || application.report_text !== null) throw new ApplicationFailure("unavailable");
      // Raw row lock: no createIfAbsent, hydrate, Load or time conversion.
      const selection = request.source === "current"
        ? "SELECT character_id, revision, snapshot FROM game_states WHERE character_id=$1 FOR UPDATE"
        : "SELECT slot_id, format_version, source_revision, snapshot, saved_at FROM save_slots WHERE slot_id=$1 FOR UPDATE";
      const raw = await client.query<{ raw: string | null; too_large: boolean }>(`WITH original AS MATERIALIZED (${selection}),
        encoded AS MATERIALIZED (SELECT row_to_json(original)::text AS text FROM original)
        SELECT CASE WHEN octet_length(text) <= $2 THEN text ELSE NULL END AS raw,
          octet_length(text) > $2 AS too_large FROM encoded`,
        [request.source === "current" ? this.reader.characterId : request.source, REPAIR_MAX_SOURCE_BYTES]);
      if (raw.rows[0]?.too_large) throw new ApplicationFailure("unavailable");
      const guard = await client.query<{ token: string }>(`SELECT e.token::text || ':' || v.token::text AS token
        FROM repair_apply_epoch e CROSS JOIN repair_source_versions v
        WHERE e.singleton AND v.source_key=$1 FOR SHARE OF e,v`, [request.source === "current" ? `current:${this.reader.characterId}` : `slot:${request.source}`]);
      signal.throwIfAborted();
      const plan = planRepair(this.reader, c, { capturedAt: startedAt, raw: raw.rows[0]?.raw ?? null }, guard.rows[0]?.token ?? null, startedAt);
      const text = reportText(plan.report); // Entire result is validated before touching the source.
      if (plan.snapshot !== undefined) {
        signal.throwIfAborted();
        const written = request.source === "current"
          ? await client.query("UPDATE game_states SET revision=$2, snapshot=$3::jsonb WHERE character_id=$1", [this.reader.characterId, plan.current!.revision, JSON.stringify(plan.snapshot)])
          : await client.query("UPDATE save_slots SET snapshot=$2::jsonb WHERE slot_id=$1", [request.source, JSON.stringify(plan.snapshot)]);
        if (written.rowCount !== 1) throw new ApplicationFailure("unavailable");
      }
      signal.throwIfAborted();
      const saved = await client.query("UPDATE repair_applications SET report_text=$3, reserved_bytes=0 WHERE repair_id=$1 AND owner_token=$2", [request.repairId, owner, text]);
      if (saved.rowCount !== 1) throw new ApplicationFailure("unavailable");
      signal.throwIfAborted();
      await client.query("COMMIT");
      return applicationState(request.repairId, plan.report.status, text, this.reader.characterId);
    });
  }
  async download(id: string, signal: AbortSignal) {
    const state = await this.lookup(id, signal);
    if (!state.report) throw new ApplicationFailure("unavailable");
    return this.connected(signal, async client => {
      const text = (await this.row(client, id))?.report_text;
      if (!text) throw new ApplicationFailure("unavailable");
      verifiedReport(text, this.reader.characterId, id); return text;
    });
  }
}
