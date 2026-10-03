import { randomUUID } from "node:crypto";
import type { GameStateSession } from "./domain-session.js";
import { InMemorySaveGameRepository } from "./save-game/memory-repository.js";
import type { StoredSaveSlot } from "./save-game/contracts.js";
import { FileRepairArchive } from "./file-repair-archive.js";
import type { RepairPreviewReader, RepairRawRecord } from "./repair-preview-reader.js";
import type { RepairApplicationBackend } from "./repair-application-backend.js";
import { ApplicationFailure, applicationState, certificateOf, makeCertificate, matchesCertificate, planRepair, reportText,
  verifiedReport, type RepairCertificate } from "./repair-application-core.js";
import { boundedJson } from "./raw-data-backup.js";
import { sha256 } from "./repair-archive.js";
import { REPAIR_MAX_SOURCE_BYTES } from "../shared/repair-preview.js";
import { REPAIR_REPORT_MAX_BYTES, type RepairApplyRequest, type RepairApplication } from "../shared/repair-application.js";

export class MemoryRepairApplication implements RepairApplicationBackend {
  private readonly completed = new Map<string, string>();
  constructor(private readonly reader: RepairPreviewReader, private readonly archive: FileRepairArchive,
    private readonly session: GameStateSession, private readonly slots: InMemorySaveGameRepository,
    readonly runtimeId: string) {}
  async bind(backup: string, source: RepairRawRecord, signal: AbortSignal) {
    if (!source.sourceGuard) return; // Legacy/custom readers can archive, but cannot authorize apply.
    const c = makeCertificate(backup, source.sourceGuard, this.reader.characterId, this.runtimeId);
    const id = certificateOf(c, this.reader.characterId).preparation.repairId;
    await this.archive.withWriteLock(signal, async () => {
      const old = await this.archive.readAuxiliary(id, "guard", signal);
      if (old !== null) { if (old !== c) throw new ApplicationFailure("conflict"); return; }
      if (await this.archive.usedBytes() + BigInt(Buffer.byteLength(c) + 4096) > BigInt(this.archive.capacityBytes)) throw new ApplicationFailure("capacity");
      await this.archive.publishAuxiliary(id, "guard", c, signal);
    });
  }
  private async certificate(id: string, signal: AbortSignal) {
    const text = await this.archive.readAuxiliary(id, "guard", signal);
    return text === null ? null : { text, value: certificateOf(text, this.reader.characterId, id) };
  }
  private startOf(text: string, c: { text: string; value: RepairCertificate }) {
    try {
      const s = JSON.parse(text), p = c.value.preparation;
      if (Object.keys(s).length !== 6 || s.startVersion !== 1 || s.repairId !== p.repairId || s.characterId !== p.characterId
        || s.certificateChecksum !== sha256(c.text) || typeof s.startedAt !== "string" || !Number.isFinite(Date.parse(s.startedAt))
        || typeof s.owner !== "string" || !/^[a-f0-9-]{36}$/.test(s.owner)) throw new Error();
      return s as { startedAt: string };
    } catch { throw new ApplicationFailure("unavailable"); }
  }
  private async saveResult(id: string, text: string, signal: AbortSignal) {
    await this.archive.withWriteLock(signal, async () => {
      const old = await this.archive.readAuxiliary(id, "report", signal);
      if (old !== null) { if (old !== text) throw new ApplicationFailure("conflict"); return; }
      await this.archive.publishAuxiliary(id, "report", text, signal);
    });
    this.completed.delete(id);
  }
  async lookup(id: string, signal: AbortSignal): Promise<RepairApplication> {
    const backup = await this.archive.get(id, this.reader.characterId, signal);
    if (backup === null) throw new ApplicationFailure("not-found");
    const c = await this.certificate(id, signal);
    if (!c) return applicationState(id, "ineligible");
    if (this.completed.has(id)) await this.saveResult(id, this.completed.get(id)!, signal);
    const result = await this.archive.readAuxiliary(id, "report", signal);
    if (result !== null) {
      const parsed = verifiedReport(result, this.reader.characterId, id);
      if (parsed.report.preparation.backupChecksum !== c.value.preparation.backupChecksum || parsed.report.sourceGuard !== c.value.sourceGuard) throw new ApplicationFailure("unavailable");
      return applicationState(id, parsed.report.status, result, this.reader.characterId);
    }
    const start = await this.archive.readAuxiliary(id, "started", signal);
    if (start !== null) { this.startOf(start, c); return applicationState(id, "unknown"); }
    return applicationState(id, c.value.preparation.runtimeId === this.runtimeId ? "ready" : "ineligible");
  }
  async apply(request: RepairApplyRequest, signal: AbortSignal) {
    const backup = await this.archive.get(request.repairId, this.reader.characterId, signal);
    if (backup === null) throw new ApplicationFailure("not-found");
    const certificate = await this.certificate(request.repairId, signal);
    if (!certificate) return applicationState(request.repairId, "ineligible");
    const c = certificate.value;
    matchesCertificate(c, request, backup);
    if (c.preparation.runtimeId !== this.runtimeId) return this.lookup(request.repairId, signal);
    const start = { startVersion: 1, repairId: request.repairId, characterId: this.reader.characterId,
      certificateChecksum: sha256(certificate.text), startedAt: new Date().toISOString(), owner: randomUUID() };
    const owned = await this.archive.withWriteLock(signal, async () => {
      const existing = await this.archive.readAuxiliary(request.repairId, "started", signal);
      if (existing !== null) { this.startOf(existing, certificate); return false; }
      const text = JSON.stringify(start);
      if (await this.archive.usedBytes() + BigInt(Buffer.byteLength(text) + REPAIR_REPORT_MAX_BYTES + 4096) > BigInt(this.archive.capacityBytes)) throw new ApplicationFailure("capacity");
      await this.archive.publishAuxiliary(request.repairId, "started", text, signal);
      return true;
    });
    if (!owned) return this.lookup(request.repairId, signal);
    signal.throwIfAborted();
    // There is no await between reading the selected source and its complete replacement.
    let text: string;
    if (request.source === "current") {
      if (!this.session.repairRaw) throw new ApplicationFailure("unavailable");
      text = this.session.repairRaw((raw, guard) => {
        const plan = planRepair(this.reader, c, { capturedAt: start.startedAt, raw: boundedJson(raw, REPAIR_MAX_SOURCE_BYTES) }, `${this.runtimeId}:${guard}`, start.startedAt);
        const result = reportText(plan.report); // Validate/reserve report size before source changes.
        return { result, ...(plan.current ? { nextState: plan.current } : {}) };
      });
    } else {
      text = this.slots.repairRaw(request.source, (raw, guard) => {
        const plan = planRepair(this.reader, c, { capturedAt: start.startedAt, raw: raw === undefined ? null : boundedJson(raw, REPAIR_MAX_SOURCE_BYTES) }, guard === null ? null : `${this.runtimeId}:${guard}`, start.startedAt);
        const result = reportText(plan.report);
        return { result, ...(plan.snapshot !== undefined && raw ? { next: { ...raw, snapshot: plan.snapshot } as StoredSaveSlot } : {}) };
      });
    }
    this.completed.set(request.repairId, text);
    await this.saveResult(request.repairId, text, signal);
    return applicationState(request.repairId, "unknown", text, this.reader.characterId);
  }
  async download(id: string, signal: AbortSignal) {
    const state = await this.lookup(id, signal);
    if (!state.report) throw new ApplicationFailure("unavailable");
    const text = await this.archive.readAuxiliary(id, "report", signal);
    if (text === null) throw new ApplicationFailure("unavailable");
    verifiedReport(text, this.reader.characterId, id); return text;
  }
}
