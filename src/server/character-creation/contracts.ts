import type { CreationRequest, CreationRecord } from "../../shared/character-creation.js";

/** Independent creation records, never the live domain or SaveSlot repository. */
export interface CreationRepository {
  read(signal: AbortSignal): Promise<unknown | null>;
  /** Check replay and single-role guard before invoking generate. Atomically publish the complete record. */
  create(request: CreationRequest, generate: () => CreationRecord, signal: AbortSignal): Promise<unknown>;
}
