import { useEffect, useRef, useState } from "react";
import type { AuthoritativeGameStateResponse, CompanionActResponse, CombatLifeResponse } from "../shared/game-state.js";
import { browserCombatPacingDependencies, CombatPacingController } from "./combat-pacing.js";

export function useCombatPacing(
  gameState: AuthoritativeGameStateResponse,
  blocked: boolean,
  onStateUpdate: (next: AuthoritativeGameStateResponse) => void,
  onRetryState: () => Promise<AuthoritativeGameStateResponse>,
  onCompanionResult: (response: CompanionActResponse) => void,
  onDyingResult: (response: CombatLifeResponse) => void,
) {
  const callbacks = useRef({ onStateUpdate, onRetryState, onCompanionResult, onDyingResult });
  callbacks.current = { onStateUpdate, onRetryState, onCompanionResult, onDyingResult };
  const controllerRef = useRef<CombatPacingController | null>(null);
  if (!controllerRef.current) controllerRef.current = new CombatPacingController({
    ...browserCombatPacingDependencies,
    hydrate: () => callbacks.current.onRetryState(),
    commit: (response) => callbacks.current.onStateUpdate(response),
    showCompanionResult: (response) => callbacks.current.onCompanionResult(response),
    showDyingResult: (response) => callbacks.current.onDyingResult(response),
  });
  const controller = controllerRef.current;
  const [view, setView] = useState(controller.state);
  useEffect(() => controller.subscribe(setView), [controller]);
  useEffect(() => { controller.observe(gameState, blocked); }, [controller, gameState, blocked]);
  return { ...view, retry: () => controller.retry(), isMutationInFlight: () => controller.state.inFlight };
}
