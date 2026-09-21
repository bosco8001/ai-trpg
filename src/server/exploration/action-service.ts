import { validateCandidateAction, type GameState, type RejectionCode } from "../../domain/game.js";
import type {
  ExplorationActionResponse,
  ExplorationRuling,
  ExplorationStateSummary,
} from "../../shared/exploration-action.js";
import type { ActionInterpreter } from "../interpretation/interpreter.js";
import type { GameStateSession } from "../domain-session.js";

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

/** Phase 7 只提供 candidate；本服務透過 deterministic domain boundary 才能改狀態。 */
export function createExplorationActionService(
  interpreter: ActionInterpreter,
  session: GameStateSession,
  storage: "memory" | "postgres",
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
        };
      }
      const transition = await session.execute(validation.command);
      if (!transition.ok) {
        const current = transition.code === "stale-revision" ? await session.getState() : before;
        return {
          mode: "test-fixture", candidate,
          ruling: commandRejection(transition.code, transition.message),
          state: summary(current, storage),
        };
      }
      if (transition.effect.type !== "location-changed" && transition.effect.type !== "target-inspected") {
        throw new Error("探索命令產生非探索結果。");
      }
      return {
        mode: "test-fixture", candidate,
        ruling: { accepted: true, code: "accepted", effect: transition.effect },
        state: summary(transition.state, storage),
      };
    },
  };
}
