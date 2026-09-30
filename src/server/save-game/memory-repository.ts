import { createGameState, gameStateContents } from "../../domain/game.js";
import type { SaveSlotId } from "../../shared/save-game.js";
import type {
  CurrentStateReader,
  SaveGameRepository,
  SaveRevisionGuard,
  SaveSnapshotV2,
  StoredSaveSlot,
} from "./contracts.js";

function copy(record: StoredSaveSlot): StoredSaveSlot {
  return { ...record, snapshot: structuredClone(record.snapshot) };
}

export class InMemorySaveGameRepository implements SaveGameRepository {
  private readonly records = new Map<SaveSlotId, StoredSaveSlot>();

  constructor(
    private readonly readCurrentState: CurrentStateReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(): Promise<readonly StoredSaveSlot[]> {
    return [...this.records.values()].sort((a, b) => a.slotId - b.slotId).map(copy);
  }

  async read(slotId: SaveSlotId): Promise<StoredSaveSlot | undefined> {
    const record = this.records.get(slotId);
    return record ? copy(record) : undefined;
  }

  async writeIfLiveRevision(
    slotId: SaveSlotId,
    snapshot: SaveSnapshotV2,
    guard: SaveRevisionGuard,
  ): Promise<StoredSaveSlot | undefined> {
    const current = createGameState(await this.readCurrentState());
    if (current.character.id !== guard.characterId || current.revision !== guard.expectedRevision) return undefined;
    const record: StoredSaveSlot = {
      slotId,
      formatVersion: snapshot.formatVersion,
      sourceRevision: snapshot.sourceRevision,
      snapshot: structuredClone(gameStateContents(current)),
      savedAt: this.now().toISOString(),
    };
    this.records.set(slotId, record);
    return copy(record);
  }
}
