import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { createGameState, type GameState } from "../domain/game.js";
import { boundedJson } from "./raw-data-backup.js";
import { analyzeRepairRecord } from "./repair-preview.js";
import type { RepairRawRecord, RepairPreviewReader } from "./repair-preview-reader.js";
import { backupSummary, preparationBinding, sha256, verifiedBackup } from "./repair-archive.js";
import { isPreparationSummary, type RepairPreparationSummary } from "../shared/repair-preparation.js";
import { REPAIR_MAX_SOURCE_BYTES } from "../shared/repair-preview.js";
import { REPAIR_REPORT_MAX_BYTES, parseRepairReport, type ApplicationCode, type RepairApplication,
  type RepairApplyRequest, type RepairEffects, type RepairReport } from "../shared/repair-application.js";

export class ApplicationFailure extends Error {
  constructor(readonly code: ApplicationCode) { super(code); }
}
export interface RepairCertificate { readonly certificateVersion: 1; readonly preparation: RepairPreparationSummary; readonly sourceGuard: string }
export function makeCertificate(backup: string, guard: string, characterId: string, runtimeId: string): string {
  if (!guard || guard.length > 256) throw new ApplicationFailure("ineligible");
  const data: RepairCertificate = { certificateVersion: 1, preparation: backupSummary(backup, characterId, runtimeId), sourceGuard: guard };
  const payload = JSON.stringify(data);
  return JSON.stringify({ payload, checksum: sha256(payload) });
}
export function certificateOf(text: string, characterId: string, id?: string): RepairCertificate {
  try {
    if (Buffer.byteLength(text) > REPAIR_REPORT_MAX_BYTES) throw new Error();
    const v = JSON.parse(text), data = JSON.parse(v.payload);
    if (Object.keys(v).length !== 2 || sha256(v.payload) !== v.checksum || Object.keys(data).length !== 3
      || data.certificateVersion !== 1 || !isPreparationSummary(data.preparation)
      || data.preparation.characterId !== characterId || id !== undefined && data.preparation.repairId !== id
      || typeof data.sourceGuard !== "string" || !data.sourceGuard || data.sourceGuard.length > 256) throw new Error();
    return data;
  } catch { throw new ApplicationFailure("unavailable"); }
}
export function matchesCertificate(c: RepairCertificate, request: RepairApplyRequest, backup: string) {
  const parsed = verifiedBackup(backup, c.preparation.characterId, request.repairId);
  if (preparationBinding(request, c.preparation.characterId) !== preparationBinding(c.preparation, c.preparation.characterId)
    || parsed.envelope.checksum.value !== c.preparation.backupChecksum
    || parsed.data.runtimeId !== c.preparation.runtimeId) throw new ApplicationFailure("conflict");
}
export function reportText(report: RepairReport): string {
  const payload = JSON.stringify(report), text = JSON.stringify({ reportVersion: 1, payload, checksum: { algorithm: "SHA-256", value: sha256(payload) } });
  if (Buffer.byteLength(text) > REPAIR_REPORT_MAX_BYTES) throw new ApplicationFailure("capacity");
  verifiedReport(text, report.preparation.characterId, report.preparation.repairId);
  return text;
}
export function verifiedReport(text: string, characterId: string, id: string) {
  try {
    const value = parseRepairReport(text);
    if (sha256(value.payload) !== value.checksum || value.report.preparation.characterId !== characterId || value.report.preparation.repairId !== id) throw new Error();
    return value;
  } catch { throw new ApplicationFailure("unavailable"); }
}
export function applicationState(id: string, status: RepairApplication["status"], text: string | null = null, characterId = ""): RepairApplication {
  const completed = text === null ? null : verifiedReport(text, characterId, id);
  return { applicationVersion: 1, repairId: id, status: completed?.report.status ?? status, canApply: !completed && status === "ready",
    report: completed?.report ?? null, reportChecksum: completed?.checksum ?? null };
}
export interface RepairPlan { readonly report: RepairReport; readonly snapshot?: unknown; readonly current?: GameState }
/** Raw source only. The existing R02 validator proves there are no hidden defaults. */
export function planRepair(reader: Pick<RepairPreviewReader, "storage" | "characterId">, c: RepairCertificate,
  input: RepairRawRecord, guard: string | null, startedAt: string): RepairPlan {
  const p = c.preparation, checks: RepairReport["checks"][number][] = ["backup"];
  let effects: RepairEffects = { revisionBefore: p.revision, revisionAfter: null, generationBefore: null, generationAfter: null, savedAt: null, sourceRevision: null };
  const finish = (status: RepairReport["status"], reason: ApplicationCode | null): RepairReport => ({ reportVersion: 1,
    preparation: p, sourceGuard: c.sourceGuard, startedAt, completedAt: new Date().toISOString(), status, reason, checks: [...checks], effects });
  const reject = (reason: ApplicationCode): RepairPlan => ({ report: finish("rejected", reason) });
  if (guard !== c.sourceGuard || input.raw === null) return reject("stale");
  const result = analyzeRepairRecord(reader, p.source, input);
  if (result.fingerprint !== p.fingerprint) return reject("stale");
  checks.push("source");
  if (result.status !== "candidate") return reject("blocked");
  if (result.candidateFingerprint !== p.candidateFingerprint || !isDeepStrictEqual(result.changes, p.changes)) return reject("stale");
  const raw = JSON.parse(input.raw), snapshot = p.source === "current" && reader.storage === "memory" ? raw : raw.snapshot;
  if (snapshot.character.id !== reader.characterId) return reject("identity-conflict");
  checks.push("candidate");
  const patched = { ...snapshot, activity: snapshot.combat === null ? "outside-combat" : "in-combat",
    character: { ...snapshot.character, currentMp: snapshot.phase26.characters.find((v: { characterId: string }) => v.characterId === snapshot.character.id).currentMp } };
  if (p.source === "current") {
    if (p.revision === Number.MAX_SAFE_INTEGER) return reject("revision-limit");
    const generation = randomUUID();
    const next = { ...patched, revision: p.revision + 1, phase26: { ...patched.phase26, runtimeGeneration: generation } };
    const validated = createGameState(next);
    if (!isDeepStrictEqual(next, validated)) return reject("blocked");
    effects = { ...effects, revisionAfter: next.revision, generationBefore: snapshot.phase26.runtimeGeneration, generationAfter: generation };
    checks.push("final");
    const { revision: _revision, ...stored } = validated;
    boundedJson(validated, REPAIR_MAX_SOURCE_BYTES);
    return { report: finish("applied", null), current: validated, snapshot: stored };
  }
  // R02 has already validated the entire patched slot without normalization.
  effects = { ...effects, savedAt: reader.storage === "postgres" ? raw.saved_at : raw.savedAt, sourceRevision: p.revision };
  checks.push("final");
  boundedJson(patched, REPAIR_MAX_SOURCE_BYTES);
  return { report: finish("applied", null), snapshot: patched };
}
