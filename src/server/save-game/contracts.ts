import type { GameState, GameStateContents } from "../../domain/game.js";
import type { SaveSlotId } from "../../shared/save-game.js";

export interface SaveSnapshotV1 {
  readonly formatVersion: 1;
  readonly sourceRevision: number;
  readonly state: GameStateContents;
}

/** Repository 讀回的 snapshot 仍是 unknown，必須由 service 解碼。 */
export interface StoredSaveSlot {
  readonly slotId: SaveSlotId;
  readonly formatVersion: number;
  readonly sourceRevision: number;
  readonly snapshot: unknown;
  readonly savedAt: string;
}

export interface SaveRevisionGuard {
  readonly characterId: string;
  readonly expectedRevision: number;
}

export interface SaveGameRepository {
  list(): Promise<readonly StoredSaveSlot[]>;
  read(slotId: SaveSlotId): Promise<StoredSaveSlot | undefined>;
  /** PostgreSQL 實作會在同一個 statement 驗證 live game_states revision。 */
  writeIfLiveRevision(
    slotId: SaveSlotId,
    snapshot: SaveSnapshotV1,
    guard: SaveRevisionGuard,
  ): Promise<StoredSaveSlot | undefined>;
}

export type CurrentStateReader = () => GameState | Promise<GameState>;

export type SaveGameFailureCode = "invalid-slot" | "stale-revision" | "slot-empty"
  | "invalid-save" | "unsupported-format" | "revision-limit" | "unavailable";

const failureMessages: Record<SaveGameFailureCode, string> = {
  "invalid-slot": "只支援存檔 1、2、3。",
  "stale-revision": "遊戲狀態已更新，請重新開啟系統面板後再試。",
  "slot-empty": "這個存檔槽目前沒有存檔。",
  "invalid-save": "此存檔內容已損壞或不符合目前格式。",
  "unsupported-format": "此存檔版本目前無法讀取。",
  "revision-limit": "狀態版本已達工程上限，無法載入存檔。",
  unavailable: "存檔服務暫時無法使用，請稍後再試。",
};

export class SaveGameFailure extends Error {
  constructor(readonly code: SaveGameFailureCode, options?: ErrorOptions) {
    super(failureMessages[code], options);
  }
}
