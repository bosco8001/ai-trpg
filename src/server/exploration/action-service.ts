import { validateCandidateAction, type GameState, type RejectionCode } from "../../domain/game.js";
import type {
  ExplorationActionResponse,
  ExplorationRuling,
  ExplorationStateSummary,
  NarrationPresentation,
} from "../../shared/exploration-action.js";
import type { ActionInterpreter } from "../interpretation/interpreter.js";
import type { GameStateSession } from "../domain-session.js";
import { NarrationFailure, type ExplorationNarrator } from "../narration/contracts.js";

export interface ExplorationActionService {
  getState(): Promise<ExplorationStateSummary>;
  execute(text: unknown, expectedRevision: unknown): Promise<ExplorationActionResponse>;
}

function summary(state: GameState, storage: "memory" | "postgres"): ExplorationStateSummary {
  return {
    revision: state.revision,
    locationId: state.exploration.locationId,
    lastObservationTargetId: state.exploration.lastObservationTargetId,
    storage,
  };
}

function commandRejection(code: RejectionCode, message: string): ExplorationRuling {
  const publicCode = code === "in-combat" ? "action-not-allowed"
    : code === "invalid-command" ? "invalid-candidate"
      : code === "too-many-skills" || code === "duplicate-skill" || code === "skill-not-learned"
        ? "unsupported-action" : code;
  return { accepted: false, code: publicCode, message };
}

const noNarration = { status: "not-requested", text: null } as const;
const narrationFallbackText = "行動已完成，但探索敘事暫時無法產生。";

async function narrateTransition(
  narrator: ExplorationNarrator | undefined,
  before: GameState,
  transition: Extract<Awaited<ReturnType<GameStateSession["execute"]>>, { ok: true }>,
): Promise<NarrationPresentation> {
  if (!narrator) return { status: "unavailable", text: narrationFallbackText };
  try {
    const request = transition.effect.type === "location-changed"
      ? {
          type: "location-changed" as const,
          fromLocationId: before.exploration.locationId,
          toLocationId: transition.effect.locationId,
        }
      : transition.effect.type === "target-inspected"
        ? {
            type: "target-inspected" as const,
            locationId: transition.state.exploration.locationId,
            targetId: transition.effect.targetId,
          }
        : undefined;
    if (!request) throw new NarrationFailure("invalid-request");
    const result = await narrator.narrate(request);
    return { status: "ready", text: result.text };
  } catch (error) {
    const status = error instanceof NarrationFailure && error.code !== "invalid-request"
      ? error.code : "malformed-response";
    return { status, text: narrationFallbackText };
  }
}

/** Phase 7 只提供 candidate；本服務透過 deterministic domain boundary 才能改狀態。 */
export function createExplorationActionService(
  interpreter: ActionInterpreter,
  session: GameStateSession,
  storage: "memory" | "postgres",
  narrator?: ExplorationNarrator,
): ExplorationActionService {
  return {
    async getState() {
      return summary(await session.getState(), storage);
    },
    async execute(text: unknown, expectedRevision: unknown) {
      const candidate = await interpreter.interpret(text);
      const before = await session.getState();
      const validation = validateCandidateAction(before, candidate, expectedRevision);
      if (!validation.ok) {
        return {
          mode: "test-fixture", candidate,
          ruling: { accepted: false, code: validation.code, message: validation.message },
          state: summary(before, storage),
          narration: noNarration,
        };
      }
      const transition = await session.execute(validation.command);
      if (!transition.ok) {
        const current = transition.code === "stale-revision" ? await session.getState() : before;
        return {
          mode: "test-fixture", candidate,
          ruling: commandRejection(transition.code, transition.message),
          state: summary(current, storage),
          narration: noNarration,
        };
      }
      if (transition.effect.type !== "location-changed" && transition.effect.type !== "target-inspected") {
        throw new Error("探索命令產生非探索結果。");
      }
      let narration: NarrationPresentation = transition.reservation
        ? await narrateTransition(narrator,before,transition)
        : {status:'unavailable',text:'行動已完成；敘事目前無法保存。'};
      let narrativeDelivery: ExplorationActionResponse['narrativeDelivery'];
      if (transition.reservation) {
        try {
          const outcome=await session.appendNarrative(transition.reservation,narration.text!,narration.status === 'ready' ? 'model' : 'fallback');
          if (outcome.status === 'discarded') {
            narration={status:'not-requested',text:null};
            narrativeDelivery={status:'discarded',generation:transition.reservation.generation};
          } else {
            if(narration.status !== 'not-requested') narration={...narration,text:outcome.entry.text};
            narrativeDelivery={status:'saved',generation:transition.reservation.generation,entry:outcome.entry};
          }
        } catch {
          const current=await Promise.resolve(session.getState()).catch(()=>undefined);
          const discarded=!!current && current.phase26?.runtimeGeneration !== transition.reservation.generation;
          if(discarded) narration={status:'not-requested',text:null};
          narrativeDelivery={status:discarded?'discarded':'unsaved',generation:transition.reservation.generation};
        }
      }
      return {
        mode: "test-fixture", candidate,
        ruling: { accepted: true, code: "accepted", effect: transition.effect },
        state: summary(transition.state, storage),
        narration,
        ...(narrativeDelivery ? {narrativeDelivery} : {}),
      };
    },
  };
}
