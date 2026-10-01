import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { FastifyInstance } from "fastify";
import { createGameState } from "../domain/game.js";
import { validResources, type PersistentCharacter } from "../domain/settlement.js";
import { decodeSaveSnapshot } from "./save-game/service.js";
import type { StoredSaveSlot } from "./save-game/contracts.js";
import { boundedJson, RawBackupFailure } from "./raw-data-backup.js";
import { REPAIR_MAX_RESPONSE_BYTES, REPAIR_MAX_SOURCE_BYTES, REPAIR_SOURCES, REPAIR_TIMEOUT_MS,
  isRepairPreviewReport, type RepairChange, type RepairIssueCode, type RepairPreviewReport,
  type RepairResult, type RepairSource } from "../shared/repair-preview.js";
import type { RepairPreviewReader, RepairRawRecord } from "./repair-preview-reader.js";

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const id = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.trim() === v;
class Blocked extends Error {
  constructor(readonly code: RepairIssueCode, readonly path: string) { super(code); }
}
function required(v: unknown, keys: readonly string[], path: string): asserts v is Record<string, unknown> {
  if (!object(v)) throw new Blocked("invalid-field", path);
  for (const key of keys) if (!Object.hasOwn(v, key)) throw new Blocked("missing-field", `${path}.${key}`);
}
/** 指紋涵蓋原始完整列，包括敘事與協調資訊；不以 revision 取代內容比對。 */
export function repairFingerprint(reader: Pick<RepairPreviewReader, "storage" | "characterId">, source: RepairSource, raw: string): string {
  return createHash("sha256").update(JSON.stringify([1, reader.storage, reader.characterId, source])).update("\n").update(raw, "utf8").digest("hex");
}
function base(source: RepairSource, capturedAt: string): RepairResult {
  return { source, capturedAt, status: "blocked", fingerprint: null, candidateFingerprint: null,
    revision: null, formatVersion: null, changes: [], issues: [] };
}
export function analyzeRepairRecord(reader: Pick<RepairPreviewReader, "storage" | "characterId">,
  source: RepairSource, input: RepairRawRecord): RepairResult {
  let result = base(source, input.capturedAt);
  if (input.raw === null) return source === "current"
    ? { ...result, status: "missing", issues: [{ code: "missing", path: "record" }] }
    : { ...result, status: "empty" };
  result = { ...result, fingerprint: repairFingerprint(reader, source, input.raw) };
  try {
    // 本版 domain 的所有數字都是安全整數。先拒絕精度可能丟失的數字，再做欄位驗證。
    const raw: unknown = JSON.parse(input.raw, (_key, value: unknown, context?: { source?: string }) => {
      if (typeof value === "number") {
        if (!Number.isSafeInteger(value) || !context?.source || context.source.length > 128) throw new Blocked("invalid-field", "record");
        // Node 24 的 reviver source 讓 1.00000000000000001 不能先被 JS 四捨五入成合法的 1。
        const parts = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(context.source);
        if (!parts) throw new Blocked("invalid-field", "record");
        const scale = Number(parts[4] ?? 0) - (parts[3]?.length ?? 0);
        if (Math.abs(scale) > 308) throw new Blocked("invalid-field", "record");
        const coefficient = BigInt(`${parts[1]}${parts[2]}${parts[3] ?? ""}`);
        const factor = 10n ** BigInt(Math.abs(scale));
        if (scale < 0 && coefficient % factor !== 0n
          || (scale < 0 ? coefficient / factor : coefficient * factor) !== BigInt(value)) throw new Blocked("invalid-field", "record");
      }
      return value;
    });
    if (!object(raw)) throw new Blocked("invalid-field", "record");
    let snapshot: unknown, revision: unknown, version: unknown, savedAt: unknown;
    if (source === "current") {
      if (reader.storage === "postgres") {
        required(raw, ["character_id", "revision", "snapshot"], "record");
        if (Object.keys(raw).length !== 3) throw new Blocked("invalid-field", "record");
        if (raw.character_id !== reader.characterId) throw new Blocked("identity-conflict", "record.character_id");
        snapshot = raw.snapshot; revision = raw.revision;
      } else { snapshot = raw; revision = raw.revision; }
    } else {
      const keys = reader.storage === "postgres"
        ? ["slot_id", "format_version", "source_revision", "snapshot", "saved_at"]
        : ["slotId", "formatVersion", "sourceRevision", "snapshot", "savedAt"];
      required(raw, keys, "record");
      if (Object.keys(raw).length !== keys.length) throw new Blocked("invalid-field", "record");
      if (raw[keys[0]!] !== source) throw new Blocked("identity-conflict", `record.${keys[0]}`);
      version = raw[keys[1]!]; revision = raw[keys[2]!]; snapshot = raw.snapshot; savedAt = raw[keys[4]!];
      if (integer(version) && version >= 1) result = { ...result, formatVersion: version };
      if (version !== 2) throw new Blocked("unsupported-version", `record.${keys[1]}`);
      if (typeof savedAt !== "string" || !Number.isFinite(Date.parse(savedAt))) throw new Blocked("invalid-field", `record.${keys[4]}`);
    }
    if (!integer(revision)) throw new Blocked("invalid-field", source === "current" ? "record.revision" : "record.sourceRevision");
    result = { ...result, revision };
    required(snapshot, ["activity", "character", "inventory", "partyMembers", "exploration", "combat", "phase26", ...(source === "current" && reader.storage === "memory" ? ["revision"] : [])], "snapshot");
    required(snapshot.character, ["id", "learnedActiveSkillIds", "equippedSkillIds", "currentMp", "raceId", "dragonBreathElement"], "snapshot.character");
    const character = snapshot.character;
    required(snapshot.phase26, ["schemaVersion", "runId", "worldId", "fixtureId", "characters", "encounters", "history",
      ...(source === "current" ? ["runtimeGeneration", "sequenceHighWater", "narrativeLedger"] : [])], "snapshot.phase26");
    const p = snapshot.phase26;
    if (integer(p.schemaVersion) && p.schemaVersion >= 1 && source === "current") result = { ...result, formatVersion: p.schemaVersion };
    if (p.schemaVersion !== 2) throw new Blocked("unsupported-version", "snapshot.phase26.schemaVersion");
    if (source === "current" && character.id !== reader.characterId) throw new Blocked("identity-conflict", "snapshot.character.id");
    if (!id(character.id) || !Array.isArray(p.characters)) throw new Blocked("identity-conflict", "snapshot.phase26.characters");
    if (snapshot.activity !== "in-combat" && snapshot.activity !== "outside-combat") throw new Blocked("invalid-field", "snapshot.activity");
    if (!integer(character.currentMp)) throw new Blocked("invalid-field", "snapshot.character.currentMp");
    // 先驗證證據欄位；任何非法長期資源都不能成為 MP 的主帳。
    const ids = new Set<string>();
    for (const [index, c] of p.characters.entries()) {
      if (!object(c) || !id(c.characterId) || ids.has(c.characterId)) throw new Blocked("identity-conflict", `snapshot.phase26.characters[${index}]`);
      ids.add(c.characterId);
      required(c, ["currentHp", "maxHp", "currentMp", "maxMp", "lifeState"], `snapshot.phase26.characters[${index}]`);
      if (!validResources(c as unknown as PersistentCharacter)
        || !(c.lifeState === "active" && (c.currentHp as number) > 0 || c.lifeState === "dead" && c.currentHp === 0))
        throw new Blocked("invalid-resource", `snapshot.phase26.characters[${index}]`);
    }
    const playerIndex = p.characters.findIndex(c => object(c) && c.characterId === character.id);
    if (playerIndex < 0) throw new Blocked("identity-conflict", "snapshot.phase26.characters");
    const player = p.characters[playerIndex] as PersistentCharacter;
    if (character.currentMp > player.maxMp) throw new Blocked("invalid-field", "snapshot.character.currentMp");
    if (snapshot.combat !== null) {
      required(snapshot.combat, ["lifecycle", "status", "endReason", "round", "currentTurnIndex", "currentActorId", "turnOrder",
        "participants", "lastAction", "skillCooldowns", "activeCastings", "racialAbilityCooldowns"], "snapshot.combat");
      if (!Array.isArray(snapshot.combat.participants)) throw new Blocked("invalid-field", "snapshot.combat.participants");
      for (const [index, participant] of snapshot.combat.participants.entries()) {
        required(participant, ["characterId", "health"], `snapshot.combat.participants[${index}]`);
        if (participant.side === "party") required(participant, ["mp"], `snapshot.combat.participants[${index}]`);
      }
    }
    const expectedActivity = snapshot.combat === null ? "outside-combat" : "in-combat";
    const changes: RepairChange[] = [];
    if (snapshot.activity !== expectedActivity) changes.push({ rule: "sync-activity", path: "activity", before: snapshot.activity,
      after: expectedActivity, evidence: { path: "combat.present", value: snapshot.combat !== null } });
    if (character.currentMp !== player.currentMp) changes.push({ rule: "sync-player-mp", path: "character.currentMp", before: character.currentMp,
      after: player.currentMp, evidence: { path: `phase26.characters[${playerIndex}].currentMp`, value: player.currentMp } });
    const patched = { ...snapshot, activity: expectedActivity, character: { ...character, currentMp: player.currentMp } };
    try {
      let normalized: unknown;
      if (source === "current") {
        const state = createGameState(reader.storage === "memory" ? patched : { ...patched, revision });
        if (reader.storage === "memory") normalized = state;
        else { const { revision: _revision, ...stored } = state; normalized = stored; }
      } else {
        const stored: StoredSaveSlot = { slotId: source, formatVersion: 2, sourceRevision: revision, snapshot: patched, savedAt: savedAt as string };
        normalized = decodeSaveSnapshot(stored).state;
      }
      // 既有 validator 可讀取舊欄位；候選禁止包含其隱式補值／正規化結果。
      if (!isDeepStrictEqual(patched, normalized)) throw new Blocked("normalization-required", "snapshot");
    } catch (error) {
      if (error instanceof Blocked) throw error;
      throw new Blocked("other-invalid", "snapshot");
    }
    const candidateRaw = reader.storage === "memory" && source === "current" ? patched : { ...raw, snapshot: patched };
    return { ...result, status: changes.length ? "candidate" : "unchanged", changes, issues: [],
      candidateFingerprint: changes.length ? repairFingerprint(reader, source, boundedJson(candidateRaw, REPAIR_MAX_SOURCE_BYTES)) : null };
  } catch (error) {
    const issue = error instanceof Blocked ? { code: error.code, path: error.path }
      : error instanceof RawBackupFailure && error.code === "too-large" ? { code: "too-large" as const, path: "record" }
      : { code: "invalid-field" as const, path: "record" };
    return { ...result, issues: [issue] };
  }
}

export async function inspectRepairPreview(reader: RepairPreviewReader, signal: AbortSignal,
  maxBytes = REPAIR_MAX_SOURCE_BYTES): Promise<RepairPreviewReport> {
  const results = await Promise.all(REPAIR_SOURCES.map(async source => {
    try {
      // Race 有明確取消邊界；即使自訂 reader 未合作，也不讓 HTTP 無限等待。
      const input = await new Promise<RepairRawRecord>((resolve, reject) => {
        const abort = () => { signal.removeEventListener("abort", abort); reject(new Error("cancelled")); };
        signal.addEventListener("abort", abort, { once: true });
        Promise.resolve().then(() => { signal.throwIfAborted(); return reader.read(source, maxBytes, signal); })
          .then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
      });
      signal.throwIfAborted();
      if (input.raw !== null && Buffer.byteLength(input.raw, "utf8") > maxBytes) throw new RawBackupFailure("too-large");
      return analyzeRepairRecord(reader, source, input);
    } catch (error) {
      return { ...base(source, new Date().toISOString()), status: "unavailable" as const,
        issues: [{ code: error instanceof RawBackupFailure && error.code === "too-large" ? "too-large" as const : "unavailable" as const, path: "record" }] };
    }
  }));
  return { previewVersion: 1, readOnly: true, storage: reader.storage, results };
}
export function registerRepairPreviewRoute(app: FastifyInstance, reader: RepairPreviewReader,
  timeoutMs = REPAIR_TIMEOUT_MS, maxBytes = REPAIR_MAX_SOURCE_BYTES) {
  app.get("/api/repair-preview", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (Object.keys(request.query as object).length) return reply.code(400).send({ error: "invalid-preview", message: "預覽不接受指定其他角色或資料來源。" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const closed = () => { if (!reply.raw.writableEnded) controller.abort(); };
    reply.raw.on("close", closed);
    try {
      const report = await inspectRepairPreview(reader, controller.signal, maxBytes);
      if (!isRepairPreviewReport(report)) throw new Error("invalid report");
      const text = boundedJson(report, REPAIR_MAX_RESPONSE_BYTES);
      return reply.header("Content-Length", String(Buffer.byteLength(text))).type("application/json").send(text);
    } catch {
      return reply.code(503).send({ error: "preview-unavailable", message: "目前無法取得候選預覽，請手動重試。" });
    } finally { clearTimeout(timer); reply.raw.removeListener("close", closed); }
  });
}
