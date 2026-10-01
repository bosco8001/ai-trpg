import { createHash } from "node:crypto";
import { parseRepairBackup, type RepairBackupPayload, type RepairPreparationRequest, type RepairPreparationSummary,
  type PREPARATION_MESSAGES } from "../shared/repair-preparation.js";
export type PreparationFailureCode = keyof typeof PREPARATION_MESSAGES;
export class PreparationFailure extends Error {
  constructor(readonly code: PreparationFailureCode) { super(code); }
}
export interface RepairArchive {
  get(repairId: string, characterId: string, signal: AbortSignal): Promise<string | null>;
  list(characterId: string, cursor: string | null, signal: AbortSignal): Promise<{ records: RepairPreparationSummary[]; nextCursor: string | null }>;
  /** Must deduplicate inside its cross-process publication boundary. */
  put(text: string, characterId: string, signal: AbortSignal): Promise<string>;
}
export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
export function verifiedBackup(text: string, characterId: string, repairId?: string) {
  try {
    const parsed = parseRepairBackup(text);
    if (sha256(parsed.envelope.payload) !== parsed.envelope.checksum.value
      || sha256(JSON.stringify([1, parsed.data.storage, parsed.data.characterId, parsed.data.source]) + "\n" + parsed.data.raw) !== parsed.data.fingerprint
      || parsed.data.characterId !== characterId
      || repairId !== undefined && parsed.data.repairId !== repairId) throw new Error("scope");
    return parsed;
  } catch { throw new PreparationFailure("unavailable"); }
}
export function preparationBinding(value: RepairPreparationRequest, characterId: string): string {
  return JSON.stringify([value.repairId, characterId, value.storage, value.source, value.previewVersion,
    value.rulesVersion, value.fingerprint, value.candidateFingerprint]);
}
export function reuseBackup(existing: string, proposed: string, characterId: string): string {
  const old = verifiedBackup(existing, characterId), next = verifiedBackup(proposed, characterId);
  if (preparationBinding(old.data, characterId) !== preparationBinding(next.data, characterId)) throw new PreparationFailure("conflict");
  return existing;
}
export function backupSummary(text: string, characterId: string, runtimeId: string): RepairPreparationSummary {
  const { data, envelope } = verifiedBackup(text, characterId);
  const { raw: _raw, ...metadata } = data;
  return { ...metadata, status: "ready", applied: false, backupBytes: Buffer.byteLength(text),
    backupChecksum: envelope.checksum.value, sameRuntime: data.storage === "postgres" || data.runtimeId === runtimeId };
}
export function makeRepairBackup(data: RepairBackupPayload, maxBytes: number): string {
  const payload = JSON.stringify(data);
  const text = JSON.stringify({ backupVersion: 1, payload, checksum: { algorithm: "SHA-256", value: sha256(payload) } });
  if (Buffer.byteLength(text) > maxBytes) throw new PreparationFailure("too-large");
  verifiedBackup(text, data.characterId, data.repairId);
  return text;
}
export function repairArchiveLimit(value: string | undefined, defaultBytes: number, upperBytes = Number.MAX_SAFE_INTEGER): number {
  if (value === undefined) return defaultBytes;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > upperBytes)
    throw new Error("修復備份上限必須是範圍內的正整數。 ");
  return Number(value);
}
