import type { FastifyInstance } from "fastify";
import { createGameState } from "../domain/game.js";
import { SAVE_SLOT_IDS, type SaveSlotId } from "../shared/save-game.js";
import { isDataDiagnosticsReport, type DataDiagnosticResult, type DataDiagnosticStatus, type DataDiagnosticsReport } from "../shared/data-diagnostics.js";
import { hydrateStateRow, InvalidPersistedStateError } from "./postgres-game-state-repository.js";
import { InvalidStoredSaveRecordError } from "./save-game/postgres-repository.js";
import { decodeSaveSnapshot } from "./save-game/service.js";
import { SaveGameFailure, type StoredSaveSlot } from "./save-game/contracts.js";

export type DiagnosticCurrentRecord =
  | { readonly kind: "state"; readonly value: unknown }
  | { readonly kind: "row"; readonly value: unknown };

/** Implementations must only read. Never call createIfAbsent, Load, Reset or a mutation boundary. */
export interface DataDiagnosticsReader {
  readCurrent(): Promise<DiagnosticCurrentRecord | undefined>;
  readSlot(slotId: SaveSlotId): Promise<StoredSaveSlot | undefined>;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function status(status: DataDiagnosticStatus, revision: number | null = null,
  formatVersion: number | null = null): DataDiagnosticResult {
  return { status, revision, formatVersion };
}

function schemaIssue(value: unknown): DataDiagnosticResult | undefined {
  if (!record(value) || !record(value.phase26)) return undefined;
  const version = value.phase26.schemaVersion;
  if (typeof version === "number" && Number.isSafeInteger(version) && version > 0 && version !== 2)
    return status("unsupported-version", null, version);
  return undefined;
}

function inspectCurrent(input: DiagnosticCurrentRecord | undefined): DataDiagnosticResult {
  if (!input) return status("missing-data");
  const value = input.value;
  const snapshot = input.kind === "row" && record(value) ? value.snapshot : value;
  const unsupported = schemaIssue(snapshot);
  if (unsupported) return unsupported;
  if (record(snapshot) && !Object.hasOwn(snapshot, "phase26") && record(snapshot.character)
    && snapshot.character.id !== "TEST-character") return status("missing-data");
  try {
    const state = input.kind === "row" && record(value)
      ? hydrateStateRow({ character_id: value.character_id, revision: value.revision, snapshot: value.snapshot })
      : createGameState(value);
    if (!state.phase26) return status("missing-data");
    return status("healthy", state.revision, state.phase26.schemaVersion);
  } catch {
    return status("invalid-data");
  }
}

function failure(error: unknown): DataDiagnosticResult {
  if (error instanceof SaveGameFailure) {
    if (error.code === "migration-blocked") return status("missing-data");
    if (error.code === "unsupported-format") return status("unsupported-version");
    if (error.code === "invalid-save") return status("invalid-data");
  }
  if (error instanceof InvalidPersistedStateError || error instanceof InvalidStoredSaveRecordError)
    return status("invalid-data");
  return status("unavailable");
}

export async function inspectData(reader: DataDiagnosticsReader, storage: "memory" | "postgres",
  now: () => Date = () => new Date()): Promise<DataDiagnosticsReport> {
  // Each item has its own failure boundary; a broken row cannot hide healthy slots.
  const current = async () => {
    try { return inspectCurrent(await reader.readCurrent()); }
    catch (error) { return failure(error); }
  };
  const slot = async (slotId: SaveSlotId) => {
    try {
      const saved = await reader.readSlot(slotId);
      if (!saved) return { slotId, ...status("empty") };
      if (saved.slotId !== slotId || typeof saved.savedAt !== "string" || Number.isNaN(Date.parse(saved.savedAt)))
        return { slotId, ...status("invalid-data") };
      const decoded = decodeSaveSnapshot(saved);
      return { slotId, ...status("healthy", decoded.sourceRevision, saved.formatVersion) };
    } catch (error) {
      return { slotId, ...failure(error) };
    }
  };
  const [currentResult, slots] = await Promise.all([current(), Promise.all(SAVE_SLOT_IDS.map(slot))]);
  return { readOnly: true, storage, checkedAt: now().toISOString(), current: currentResult, slots };
}

export function registerDataDiagnosticsRoute(app: FastifyInstance, reader: DataDiagnosticsReader,
  storage: "memory" | "postgres") {
  app.get("/api/data-diagnostics", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    const report = await inspectData(reader, storage);
    if (!isDataDiagnosticsReport(report)) throw new Error("資料檢查報告格式不正確。");
    return report;
  });
}
