import type { CreationRepository } from "./contracts.js";
import { creationRequestText, type CreationRequest, type CreationRecord } from "../../shared/character-creation.js";
import { CreationFailure } from "../../domain/character-creation.js";

/** Injectable test adapter only. Runtime memory mode does not offer character creation. */
export class MemoryCreationRepository implements CreationRepository {
  private record: CreationRecord | null = null;
  async read(signal: AbortSignal) { signal.throwIfAborted(); return structuredClone(this.record); }
  async create(request: CreationRequest, generate: () => CreationRecord, signal: AbortSignal) {
    signal.throwIfAborted();
    if (this.record) {
      if (this.record.request.requestId !== request.requestId) throw new CreationFailure("already-created");
      if (creationRequestText(this.record.request) !== creationRequestText(request)) throw new CreationFailure("request-conflict");
      return structuredClone(this.record);
    }
    // No await between guard and assignment, so concurrent calls cannot publish two records.
    this.record = structuredClone(generate());
    return structuredClone(this.record);
  }
}
