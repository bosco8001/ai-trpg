import { isAuthoritativeGameStateResponse, type AuthoritativeGameStateResponse } from "./game-state.js";
import { isExplorationStateSummary, type ExplorationLocationId, type ExplorationStateSummary } from "./exploration-action.js";

export const SAVE_FORMAT_VERSION = 2 as const;
export const SAVE_SLOT_IDS = [1, 2, 3] as const;
export type SaveSlotId = typeof SAVE_SLOT_IDS[number];

export type SaveSlotSummary =
  | { readonly slotId: SaveSlotId; readonly empty: true }
  | {
      readonly slotId: SaveSlotId;
      readonly empty: false;
      readonly formatVersion: 1 | typeof SAVE_FORMAT_VERSION;
      readonly sourceRevision: number;
      readonly savedAt: string;
      readonly locationId: ExplorationLocationId;
    };

export interface SaveSlotsResponse {
  readonly slots: readonly SaveSlotSummary[];
}

export interface SaveOperationResponse {
  readonly authoritative?: AuthoritativeGameStateResponse;
  readonly slot: Extract<SaveSlotSummary, { empty: false }>;
  readonly state: ExplorationStateSummary;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

export function isSaveSlotId(value: unknown): value is SaveSlotId {
  return value === 1 || value === 2 || value === 3;
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isSaveSlotSummary(value: unknown): value is SaveSlotSummary {
  if (!isRecord(value) || !isSaveSlotId(value.slotId) || typeof value.empty !== "boolean") return false;
  if (value.empty) return exact(value, ["slotId", "empty"]);
  return exact(value, ["slotId", "empty", "formatVersion", "sourceRevision", "savedAt", "locationId"])
    && (value.formatVersion === 1 || value.formatVersion === SAVE_FORMAT_VERSION) && isRevision(value.sourceRevision)
    && typeof value.savedAt === "string" && !Number.isNaN(Date.parse(value.savedAt))
    && (value.locationId === "TEST-forest-edge" || value.locationId === "TEST-ruin-entrance");
}

export function isSaveSlotsResponse(value: unknown): value is SaveSlotsResponse {
  return isRecord(value) && exact(value, ["slots"]) && Array.isArray(value.slots)
    && value.slots.length === 3 && value.slots.every(isSaveSlotSummary)
    && value.slots.every((slot, index) => slot.slotId === SAVE_SLOT_IDS[index]);
}

export function isSaveOperationResponse(value: unknown): value is SaveOperationResponse {
  return isRecord(value) && (exact(value, ["slot", "state"]) || exact(value,["slot","state","authoritative"]) && isAuthoritativeGameStateResponse(value.authoritative))
    && isSaveSlotSummary(value.slot) && !value.slot.empty && isExplorationStateSummary(value.state);
}
