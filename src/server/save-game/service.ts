import { createGameState, gameStateContents } from "../../domain/game.js";
import { createTestCombatInventory } from "../../domain/combat-items.js";
import type { GameState } from "../../domain/game.js";
import type { ExplorationStateSummary } from "../../shared/exploration-action.js";
import {
  SAVE_FORMAT_VERSION,
  SAVE_SLOT_IDS,
  isSaveSlotId,
  type SaveOperationResponse,
  type SaveSlotId,
  type SaveSlotSummary,
  type SaveSlotsResponse,
} from "../../shared/save-game.js";
import type { GameStateSession } from "../domain-session.js";
import { InvalidPersistedStateError, PersistenceUnavailableError } from "../postgres-game-state-repository.js";
import {
  InvalidStoredSaveRecordError,
  SavePersistenceUnavailableError,
} from "./postgres-repository.js";
import {
  SaveGameFailure,
  type SaveGameRepository,
  type SaveSnapshotV2,
  type StoredSaveSlot,
} from "./contracts.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function summary(state: GameState, storage: "memory" | "postgres"): ExplorationStateSummary {
  return {
    revision: state.revision,
    locationId: state.exploration.locationId,
    lastObservationTargetId: state.exploration.lastObservationTargetId,
    storage,
  };
}

export function createSaveSnapshot(state: GameState): SaveSnapshotV2 {
  const validated = createGameState(state);
  if(!validated.phase26) throw new SaveGameFailure("migration-blocked");
  return {
    formatVersion: SAVE_FORMAT_VERSION,
    sourceRevision: validated.revision,
    state: gameStateContents(validated),
  };
}

export function decodeSaveSnapshot(record: StoredSaveSlot): SaveSnapshotV2 {
  if (!Number.isSafeInteger(record.formatVersion) || record.formatVersion < 1) {
    throw new SaveGameFailure("invalid-save");
  }
  if (record.formatVersion !== 1 && record.formatVersion !== SAVE_FORMAT_VERSION) throw new SaveGameFailure("unsupported-format");
  if (!Number.isSafeInteger(record.sourceRevision) || record.sourceRevision < 0
    || !isRecord(record.snapshot)) {
    throw new SaveGameFailure("invalid-save");
  }
  if (record.formatVersion === 2) {
    try {
      const p=record.snapshot.phase26;
      if (!isRecord(p) || Object.keys(p).some(k => ['runtimeGeneration','sequenceHighWater','narrativeLedger'].includes(k)) || !Array.isArray(p.history)) throw new Error('invalid');
      const state=createGameState({...record.snapshot,revision:record.sourceRevision,phase26:{...p,runtimeGeneration:'save-validation',
        sequenceHighWater:Math.max(0,...p.history.map(e => (e as {sequence?:number}).sequence ?? 0)),narrativeLedger:p.history}});
      return {formatVersion:2,sourceRevision:record.sourceRevision,state:gameStateContents(state)};
    } catch(error) {throw new SaveGameFailure('invalid-save',{cause:error});}
  }
  const legacy = exact(record.snapshot, ["activity", "character", "exploration"]);
  const current = exact(record.snapshot, ["activity", "character", "inventory", "exploration"]);
  if (!legacy && !current) throw new SaveGameFailure("invalid-save");
  const character = record.snapshot.character;
  if (!isRecord(character)) throw new SaveGameFailure("invalid-save");
  if (character.id !== "TEST-character") throw new SaveGameFailure("migration-blocked");
  try {
    const validated = createGameState({
      ...record.snapshot,
      ...(legacy ? { inventory: createTestCombatInventory() } : {}),
      revision: record.sourceRevision,
      combat: null,
    });
    return {
      formatVersion: SAVE_FORMAT_VERSION,
      sourceRevision: record.sourceRevision,
      state: gameStateContents(validated),
    };
  } catch (error) {
    throw new SaveGameFailure("invalid-save", { cause: error });
  }
}

function occupied(record: StoredSaveSlot, snapshot: SaveSnapshotV2): Extract<SaveSlotSummary, { empty: false }> {
  return {
    slotId: record.slotId,
    empty: false,
    formatVersion: SAVE_FORMAT_VERSION,
    sourceRevision: snapshot.sourceRevision,
    savedAt: record.savedAt,
    locationId: snapshot.state.exploration.locationId,
  };
}

function validateRequest(slotId: unknown, expectedRevision: unknown): asserts slotId is SaveSlotId {
  if (!isSaveSlotId(slotId)) throw new SaveGameFailure("invalid-slot");
  if (typeof expectedRevision !== "number" || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new SaveGameFailure("stale-revision");
  }
}

function safeFailure(error: unknown): never {
  if (error instanceof SaveGameFailure) throw error;
  if (error instanceof InvalidStoredSaveRecordError) {
    throw new SaveGameFailure("invalid-save", { cause: error });
  }
  if (error instanceof SavePersistenceUnavailableError
    || error instanceof PersistenceUnavailableError || error instanceof InvalidPersistedStateError) {
    throw new SaveGameFailure("unavailable", { cause: error });
  }
  throw new SaveGameFailure("unavailable", { cause: error });
}

export interface SaveGameService {
  list(): Promise<SaveSlotsResponse>;
  save(slotId: unknown, expectedRevision: unknown): Promise<SaveOperationResponse>;
  load(slotId: unknown, expectedRevision: unknown): Promise<SaveOperationResponse>;
}

export function createSaveGameService(
  repository: SaveGameRepository,
  session: GameStateSession,
  storage: "memory" | "postgres",
): SaveGameService {
  return {
    async list() {
      try {
        const records = await repository.list();
        const byId = new Map(records.map((record) => [record.slotId, record]));
        return {
          slots: SAVE_SLOT_IDS.map((slotId): SaveSlotSummary => {
            const record = byId.get(slotId);
            return record ? occupied(record, decodeSaveSnapshot(record)) : { slotId, empty: true };
          }),
        };
      } catch (error) {
        return safeFailure(error);
      }
    },
    async save(slotId: unknown, expectedRevision: unknown) {
      validateRequest(slotId, expectedRevision);
      try {
        const current = createGameState(await session.getState());
        if (current.revision !== expectedRevision) throw new SaveGameFailure("stale-revision");
        const snapshot = createSaveSnapshot(current);
        const record = await repository.writeIfLiveRevision(slotId, snapshot, {
          characterId: current.character.id,
          expectedRevision,
        });
        if (!record) throw new SaveGameFailure("stale-revision");
        return { slot: occupied(record, decodeSaveSnapshot(record)), state: summary(current, storage), authoritative:{sandbox:false,storage,state:current} };
      } catch (error) {
        return safeFailure(error);
      }
    },
    async load(slotId: unknown, expectedRevision: unknown) {
      validateRequest(slotId, expectedRevision);
      try {
        const current = createGameState(await session.getState());
        if (current.revision !== expectedRevision) throw new SaveGameFailure("stale-revision");
        const record = await repository.read(slotId);
        if (!record) throw new SaveGameFailure("slot-empty");
        const snapshot = decodeSaveSnapshot(record);
        const result = await session.replaceContents(expectedRevision, snapshot.state);
        if (!result.ok) {
          if (result.code === "stale-revision") throw new SaveGameFailure("stale-revision");
          if (result.code === "revision-limit") throw new SaveGameFailure("revision-limit");
          throw new SaveGameFailure("invalid-save");
        }
        return { slot: occupied(record, snapshot), state: summary(result.state, storage), authoritative:{sandbox:false,storage,state:result.state} };
      } catch (error) {
        return safeFailure(error);
      }
    },
  };
}
