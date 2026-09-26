import type { AuthoritativeGameStateResponse, CompanionActResponse, CombatSandboxAdvanceResponse, CombatLifeResponse } from "../shared/game-state.js";
import { ApiRequestError, advanceTestCombatTurn, executeCompanionTurn, executeDyingTurn } from "./api.js";

// Provisional presentation values. These are not combat rules or persistent state.
export const COMBAT_PACING = Object.freeze({
  beforeNpcActionMs: 650,
  afterTestAdvanceMs: 400,
  afterCompanionResultMs: 1800,
  turnTransitionMs: 320,
});

export type CombatPacingPhase = "idle" | "pre-action" | "resolving" | "showing-result" | "post-action" | "transitioning" | "error";
export interface CombatPacingView {
  readonly phase: CombatPacingPhase;
  readonly visualActorId: string | null;
  readonly error: string | null;
  readonly inFlight: boolean;
}
export interface CombatPacingDependencies {
  advance: (revision: number) => Promise<CombatSandboxAdvanceResponse>;
  companion: (revision: number) => Promise<CompanionActResponse>;
  dying?: (revision: number) => Promise<CombatLifeResponse>;
  hydrate: () => Promise<AuthoritativeGameStateResponse>;
  commit: (response: AuthoritativeGameStateResponse) => void;
  showCompanionResult: (response: CompanionActResponse) => void;
  showDyingResult?: (response: CombatLifeResponse) => void;
  schedule: (callback: () => void, delay: number) => number;
  cancel: (timer: number) => void;
  timing: { readonly beforeNpcActionMs: number; readonly afterTestAdvanceMs: number;
    readonly afterCompanionResultMs: number; readonly turnTransitionMs: number };
}

export function classifyPacingActor(response: AuthoritativeGameStateResponse): "player" | "companion" | "test-enemy" | "dying" | "unsupported" | "ended" {
  const combat = response.state.combat;
  if (!combat || combat.status === "ended") return "ended";
  const actor = combat.participants.find((entry) => entry.id === combat.currentActorId);
  if (!actor) return "unsupported";
  if (actor.health.lifeState === "dying") return "dying";
  if (actor.controlledBy === "companion") return "companion";
  if (actor.side === "enemy") return response.sandbox && actor.id.startsWith("TEST-enemy-") ? "test-enemy" : "unsupported";
  return actor.side === "party" && actor.normalAttack !== null ? "player" : "unsupported";
}

/** Owns presentation timing only. Every mutation still goes to the existing authoritative endpoint. */
export class CombatPacingController {
  private latest: AuthoritativeGameStateResponse | null = null;
  private timer: number | null = null;
  private scheduledKey: string | null = null;
  private issued = new Set<string>();
  private holdingRevision: number | null = null;
  private blocked = false;
  private active = false;
  private requestInFlight = false;
  private rehydrating = false;
  private view: CombatPacingView = { phase: "idle", visualActorId: null, error: null, inFlight: false };
  private listener: (view: CombatPacingView) => void = () => undefined;

  constructor(private readonly deps: CombatPacingDependencies) {}
  get state(): CombatPacingView { return this.view; }
  subscribe(listener: (view: CombatPacingView) => void): () => void {
    this.listener = listener;
    this.active = true;
    // A remounted effect may have cancelled a presentation timer after a committed response.
    // Resume from the authoritative actor; never leave a cancelled post-result hold latched.
    if (this.holdingRevision !== null && this.timer === null && !this.requestInFlight) {
      this.holdingRevision = null;
      this.setView({ phase: "idle", visualActorId: this.latest?.state.combat?.currentActorId ?? null });
    }
    listener(this.view);
    this.evaluate();
    return () => {
      this.active = false;
      this.clearTimer();
      this.listener = () => undefined;
    };
  }
  observe(response: AuthoritativeGameStateResponse, blocked = false): void {
    const previous = this.latest;
    if (previous && response.state.revision < previous.state.revision) return;
    this.latest = response;
    this.blocked = blocked;
    const combat = response.state.combat;
    const actor = combat?.status === "active" ? combat.currentActorId : null;
    if (!previous || this.view.visualActorId === null) this.setView({ visualActorId: actor });
    if (!combat || combat.status === "ended") {
      this.clearTimer(); this.holdingRevision = null;
      this.setView({ phase: "idle", visualActorId: null, error: null });
      return;
    }
    if (this.holdingRevision !== null && response.state.revision > this.holdingRevision) {
      this.clearTimer(); this.holdingRevision = null;
      this.setView({ phase: "idle", visualActorId: actor });
    }
    if (this.holdingRevision !== null || this.requestInFlight) return;
    if (previous && response.state.revision !== previous.state.revision) {
      this.clearTimer();
      this.setView({ phase: "idle", visualActorId: actor, error: null });
    }
    this.evaluate();
  }
  /** A manual retry always rehydrates first; ambiguous network failures never auto resend. */
  async retry(): Promise<void> {
    if (this.requestInFlight || this.rehydrating) return;
    this.rehydrating = true;
    this.clearTimer(); this.setView({ phase: "idle", error: null });
    try {
      const response = await this.deps.hydrate();
      if (!this.active) return;
      if (this.latest && response.state.revision < this.latest.state.revision) {
        this.setView({ phase: "error", error: "讀回的版本低於目前畫面；若 Memory API 已重啟，請刷新整個頁面。" });
        return;
      }
      const key = this.key(response);
      if (key) this.issued.delete(key);
      this.observe(response);
      this.deps.commit(response);
    } catch {
      this.setView({ phase: "error", error: "目前無法重新讀取權威戰鬥狀態。請確認 API 後再試。" });
    } finally {
      this.rehydrating = false;
    }
  }
  private key(response: AuthoritativeGameStateResponse): string | null {
    const combat = response.state.combat;
    return combat?.status === "active" ? `${response.state.revision}:${combat.currentActorId}` : null;
  }
  private setView(change: Partial<CombatPacingView>): void {
    this.view = { ...this.view, ...change, inFlight: this.requestInFlight };
    if (this.active) this.listener(this.view);
  }
  private clearTimer(): void {
    if (this.timer !== null) this.deps.cancel(this.timer);
    this.timer = null;
    this.scheduledKey = null;
  }
  private delay(callback: () => void, ms: number): void {
    this.clearTimer();
    this.timer = this.deps.schedule(() => { this.timer = null; callback(); }, ms);
  }
  private evaluate(): void {
    if (!this.active || !this.latest || this.blocked || this.requestInFlight || this.holdingRevision !== null
      || this.view.phase === "error" || this.timer !== null) return;
    const kind = classifyPacingActor(this.latest);
    if (kind === "ended" || kind === "player") {
      this.setView({ phase: "idle", visualActorId: this.latest.state.combat?.currentActorId ?? null });
      return;
    }
    if (kind === "unsupported") {
      this.setView({ phase: "error", error: "目前角色沒有可用的自動回合處理，戰鬥已暫停。" });
      return;
    }
    const key = this.key(this.latest);
    if (!key || this.issued.has(key) || this.scheduledKey === key) return;
    this.scheduledKey = key;
    this.setView({ phase: "pre-action", visualActorId: this.latest.state.combat?.currentActorId ?? null });
    this.delay(() => { void this.execute(key, kind); }, this.deps.timing.beforeNpcActionMs);
    this.scheduledKey = key;
  }
  private async execute(key: string, kind: "companion" | "test-enemy" | "dying"): Promise<void> {
    if (!this.active || !this.latest || this.blocked || this.key(this.latest) !== key || this.issued.has(key)
      || this.requestInFlight || this.latest.state.combat?.status !== "active") return;
    const revision = this.latest.state.revision;
    this.issued.add(key);
    this.requestInFlight = true;
    this.setView({ phase: "resolving" });
    try {
      const response = kind === "companion" ? await this.deps.companion(revision)
        : kind === "dying" ? await this.deps.dying!(revision) : await this.deps.advance(revision);
      if (!this.active || !this.latest) return;
      if (response.state.revision !== revision + 1 || response.state.combat === null) throw new Error("NPC 回合回應格式不正確。");
      // A newer response or hydration wins. The old result can never roll the UI backward.
      if (this.latest.state.revision > revision) return;
      this.holdingRevision = response.state.revision;
      this.latest = response;
      this.deps.commit(response);
      if (kind === "companion") this.deps.showCompanionResult(response as CompanionActResponse);
      if (kind === "dying") this.deps.showDyingResult?.(response as CombatLifeResponse);
      if (response.state.combat.status === "ended") {
        this.holdingRevision = null;
        this.setView({ phase: "idle", visualActorId: null });
        return;
      }
      this.setView({ phase: "showing-result" });
      this.delay(() => {
        if (!this.active || this.latest?.state.revision !== response.state.revision) return;
        this.setView({ phase: "post-action" });
        this.delay(() => {
          if (!this.active || this.latest?.state.revision !== response.state.revision) return;
          const next = response.state.combat?.status === "active" ? response.state.combat.currentActorId : null;
          this.setView({ phase: "transitioning", visualActorId: next });
          this.delay(() => {
            this.holdingRevision = null;
            this.setView({ phase: "idle" });
            this.evaluate();
          }, this.deps.timing.turnTransitionMs);
        }, kind === "companion" || (kind === "dying" && (response as CombatLifeResponse).event.lifeState === "dead")
          ? this.deps.timing.afterCompanionResultMs : this.deps.timing.afterTestAdvanceMs);
      }, 0);
    } catch (error) {
      if (!this.active || !this.latest || this.latest.state.revision > revision) return;
      if (error instanceof ApiRequestError && error.code === "stale-revision") {
        try {
          const fresh = await this.deps.hydrate();
          if (!this.active) return;
          this.observe(fresh);
          this.deps.commit(fresh);
          if (fresh.state.revision <= revision) this.setView({ phase: "error", error: "回合版本已變更，但無法取得更新的版本。請重新讀取。" });
        } catch {
          this.setView({ phase: "error", error: "回合版本已變更；目前無法重新讀取權威狀態。" });
        }
      } else {
        this.setView({ phase: "error", error: error instanceof Error ? error.message : "NPC 回合暫時無法完成。請重新讀取。" });
      }
    } finally {
      this.requestInFlight = false;
      this.setView({});
      this.evaluate();
    }
  }
}

export const browserCombatPacingDependencies = {
  advance: advanceTestCombatTurn,
  companion: executeCompanionTurn,
  dying: executeDyingTurn,
  schedule: (callback: () => void, ms: number) => window.setTimeout(callback, ms),
  cancel: (timer: number) => window.clearTimeout(timer),
  timing: COMBAT_PACING,
};
