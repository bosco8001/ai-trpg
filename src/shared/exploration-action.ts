import { isCandidateAction, type CandidateAction } from "./interpretation.js";

export type ExplorationLocationId = "TEST-forest-edge" | "TEST-ruin-entrance";
export type ObservationTargetId = "TEST-stone-door";

export interface ExplorationStateSummary {
  readonly revision: number;
  readonly locationId: ExplorationLocationId;
  readonly lastObservationTargetId: ObservationTargetId | null;
  readonly storage: "memory" | "postgres";
}

export type AuthoritativeEffect =
  | { readonly type: "location-changed"; readonly locationId: ExplorationLocationId }
  | { readonly type: "target-inspected"; readonly targetId: ObservationTargetId };

export type ExplorationRuling =
  | { readonly accepted: true; readonly code: "accepted"; readonly effect: AuthoritativeEffect }
  | { readonly accepted: false; readonly code: "clarification-required" | "unsupported-action"
      | "target-not-found" | "stale-revision" | "invalid-candidate" | "action-not-allowed"
      | "revision-limit"; readonly message: string };

export type NarrationPresentation =
  | { readonly status: "ready"; readonly text: string }
  | { readonly status: "not-requested"; readonly text: null }
  | { readonly status: "timeout" | "unavailable" | "malformed-response"; readonly text: string };

export interface ExplorationActionResponse {
  readonly mode: "test-fixture";
  readonly candidate: CandidateAction;
  readonly ruling: ExplorationRuling;
  readonly state: ExplorationStateSummary;
  readonly narration: NarrationPresentation;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isExplorationStateSummary(value: unknown): value is ExplorationStateSummary {
  return isRecord(value) && exact(value,
    ["revision", "locationId", "lastObservationTargetId", "storage"])
    && isRevision(value.revision)
    && (value.locationId === "TEST-forest-edge" || value.locationId === "TEST-ruin-entrance")
    && (value.lastObservationTargetId === null || value.lastObservationTargetId === "TEST-stone-door")
    && (value.storage === "memory" || value.storage === "postgres");
}

function isEffect(value: unknown): value is AuthoritativeEffect {
  if (!isRecord(value)) return false;
  return value.type === "location-changed"
    ? exact(value, ["type", "locationId"])
      && (value.locationId === "TEST-forest-edge" || value.locationId === "TEST-ruin-entrance")
    : value.type === "target-inspected"
      && exact(value, ["type", "targetId"]) && value.targetId === "TEST-stone-door";
}

function isRuling(value: unknown): value is ExplorationRuling {
  if (!isRecord(value) || typeof value.accepted !== "boolean") return false;
  if (value.accepted) return exact(value, ["accepted", "code", "effect"])
    && value.code === "accepted" && isEffect(value.effect);
  const codes = ["clarification-required", "unsupported-action", "target-not-found", "stale-revision",
    "invalid-candidate", "action-not-allowed", "revision-limit"];
  return exact(value, ["accepted", "code", "message"])
    && typeof value.code === "string" && codes.includes(value.code)
    && typeof value.message === "string" && value.message.trim().length > 0;
}

function isNarration(value: unknown): value is NarrationPresentation {
  if (!isRecord(value) || !exact(value, ["status", "text"])) return false;
  if (value.status === "not-requested") return value.text === null;
  if (value.status !== "ready" && value.status !== "timeout" && value.status !== "unavailable"
    && value.status !== "malformed-response") return false;
  return typeof value.text === "string" && value.text.trim() === value.text
    && Array.from(value.text).length > 0 && Array.from(value.text).length <= 600;
}

export function isExplorationActionResponse(value: unknown): value is ExplorationActionResponse {
  return isRecord(value) && exact(value, ["mode", "candidate", "ruling", "state", "narration"])
    && value.mode === "test-fixture" && isCandidateAction(value.candidate)
    && isRuling(value.ruling) && isExplorationStateSummary(value.state)
    && isNarration(value.narration)
    && (value.ruling.accepted ? value.narration.status !== "not-requested"
      : value.narration.status === "not-requested");
}
