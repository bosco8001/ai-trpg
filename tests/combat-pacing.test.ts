import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { advanceCombatTurn, resolveCompanionTurn, startCombat } from "../src/domain/combat.js";
import { createPhase22CombatFixtureRoller } from "../src/server/combat/dice.js";
import { PHASE22_TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import type { GameState } from "../src/domain/game.js";
import type { AuthoritativeGameStateResponse, CompanionActResponse, CombatSandboxAdvanceResponse } from "../src/shared/game-state.js";
import { ApiRequestError } from "../src/web/api.js";
import { CombatPage } from "../src/web/CombatPage.js";
import { CombatPacingController, classifyPacingActor, type CombatPacingDependencies } from "../src/web/combat-pacing.js";
import { getVisualTurnOrderEntries } from "../src/web/combat-ui.js";

function start(): AuthoritativeGameStateResponse {
  const result = startCombat(createTestGameState(), { expectedRevision: 0 }, PHASE22_TEST_COMBAT_PARTICIPANTS,
    createPhase22CombatFixtureRoller("normal"));
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("start failed");
  return { sandbox: true, storage: "memory", state: result.state };
}
function advance(response: AuthoritativeGameStateResponse): CombatSandboxAdvanceResponse {
  const result = advanceCombatTurn(response.state as GameState, { expectedRevision: response.state.revision });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("advance failed");
  return { ...response, state: result.state, effect: { type: "combat-turn-advanced" } };
}
function companion(response: AuthoritativeGameStateResponse, source: "model" | "fallback" = "model"): CompanionActResponse {
  const result = resolveCompanionTurn(response.state as GameState, { expectedRevision: response.state.revision },
    createPhase22CombatFixtureRoller("normal"));
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("companion failed");
  return { ...response, state: result.state, effect: result.effect, narration: { source, text: "TEST 隊友完成行動。" } };
}
class FakeClock {
  now = 0;
  next = 1;
  tasks = new Map<number, { due: number; run: () => void }>();
  schedule = (run: () => void, ms: number) => { const id = this.next++; this.tasks.set(id, { due: this.now + ms, run }); return id; };
  cancel = (id: number) => { this.tasks.delete(id); };
  tick(ms: number) {
    const target = this.now + ms;
    while (true) {
      const next = [...this.tasks].sort((a, b) => a[1].due - b[1].due)[0];
      if (!next || next[1].due > target) break;
      this.now = next[1].due;
      this.tasks.delete(next[0]); next[1].run();
    }
    this.now = target;
  }
}
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

function harness(initial = start(), overrides: Partial<CombatPacingDependencies> = {}) {
  const clock = new FakeClock();
  let current = initial;
  const actions: string[] = [];
  const narrations: string[] = [];
  let controller: CombatPacingController;
  const deps: CombatPacingDependencies = {
    advance: async (revision) => {
      actions.push(`enemy:${revision}`);
      assert.equal(current.state.revision, revision);
      return advance(current);
    },
    companion: async (revision) => {
      actions.push(`companion:${revision}`);
      assert.equal(current.state.revision, revision);
      return companion(current);
    },
    hydrate: async () => current,
    commit: (response) => { current = response; controller.observe(response); },
    showCompanionResult: (response) => { narrations.push(response.narration?.text ?? ""); },
    schedule: clock.schedule, cancel: clock.cancel,
    timing: { beforeNpcActionMs: 10, afterTestAdvanceMs: 20, afterCompanionResultMs: 20, turnTransitionMs: 5 },
    ...overrides,
  };
  controller = new CombatPacingController(deps);
  const unsubscribe = controller.subscribe(() => undefined);
  controller.observe(current);
  async function step() { clock.tick(10); await settle(); clock.tick(0); await settle(); clock.tick(20); await settle(); clock.tick(5); await settle(); }
  return { controller, clock, actions, narrations, step, unsubscribe, get current() { return current; },
    inject: (response: AuthoritativeGameStateResponse) => { current = response; controller.observe(response); } };
}

test("TEST enemy waits, advances exactly once without narration, and stops at player", async () => {
  const h = harness();
  assert.equal(h.controller.state.phase, "pre-action");
  h.clock.tick(9); await settle(); assert.deepEqual(h.actions, []);
  h.clock.tick(1); await settle();
  assert.deepEqual(h.actions, ["enemy:1"]);
  assert.equal(h.current.state.revision, 2);
  assert.deepEqual(h.narrations, []);
  assert.equal(h.controller.state.visualActorId, "TEST-enemy-1");
  h.clock.tick(20); await settle();
  assert.equal(h.controller.state.visualActorId, "TEST-player");
  h.clock.tick(5); await settle();
  assert.equal(h.controller.state.phase, "idle");
  h.controller.observe(h.current); h.clock.tick(100);
  assert.deepEqual(h.actions, ["enemy:1"]);
  h.unsubscribe();
});

test("player action starts enemy → companion → enemy chain and stops at next player", async () => {
  const h = harness(advance(start()));
  assert.equal(h.controller.state.phase, "idle");
  h.inject(advance(h.current)); // authoritative successful player action ends turn
  assert.equal(h.controller.state.phase, "pre-action");
  await h.step(); await h.step(); await h.step();
  assert.deepEqual(h.actions, ["enemy:3", "companion:4", "enemy:5"]);
  assert.equal(h.current.state.revision, 6);
  assert.equal(h.current.state.combat?.round, 2);
  assert.equal(h.current.state.combat?.currentActorId, "TEST-player");
  assert.equal(h.narrations.length, 1);
  assert.equal(h.controller.state.phase, "idle");
  h.unsubscribe();
});

test("StrictMode cleanup/mount, rerender, and repeated revision never duplicate companion POST", async () => {
  const h = harness(advance(advance(advance(start()))));
  h.unsubscribe();
  const stop = h.controller.subscribe(() => undefined);
  h.controller.observe(h.current); h.controller.observe(h.current);
  await h.step();
  h.controller.observe(h.current); h.clock.tick(100); await settle();
  assert.deepEqual(h.actions, ["companion:4", "enemy:5"]);
  stop();
});

test("model and fallback companion narration remain visible before the next request", async () => {
  for (const source of ["model", "fallback"] as const) {
    const h = harness(advance(advance(advance(start()))), {
      companion: async (revision) => {
        h.actions.push(`companion:${revision}`);
        return companion(h.current, source);
      },
      showCompanionResult: (response) => h.narrations.push(`${response.narration?.source}:${response.narration?.text}`),
    });
    h.clock.tick(10); await settle(); h.clock.tick(0); await settle();
    assert.equal(h.current.state.combat?.round, 2);
    assert.equal(h.controller.state.visualActorId, "TEST-companion-1");
    assert.equal(h.controller.state.phase, "post-action");
    assert.deepEqual(h.narrations, [`${source}:TEST 隊友完成行動。`]);
    h.clock.tick(19); await settle(); assert.deepEqual(h.actions, ["companion:4"]);
    h.clock.tick(1); await settle(); assert.equal(h.controller.state.visualActorId, "TEST-enemy-1");
    h.clock.tick(5); await settle(); assert.equal(h.controller.state.phase, "pre-action");
    h.unsubscribe();
  }
});

test("StrictMode remount during the result pause cannot strand the sequence", async () => {
  const h = harness(advance(advance(advance(start()))));
  h.clock.tick(10); await settle(); h.clock.tick(0); await settle();
  assert.equal(h.controller.state.phase, "post-action");
  h.unsubscribe();
  const stop = h.controller.subscribe(() => undefined);
  assert.equal(h.controller.state.visualActorId, "TEST-enemy-1");
  await h.step();
  assert.deepEqual(h.actions, ["companion:4", "enemy:5"]);
  stop();
});

test("in-flight request excludes a second POST; newer state wins over old response", async () => {
  let release!: (value: CombatSandboxAdvanceResponse) => void;
  const pending = new Promise<CombatSandboxAdvanceResponse>((resolve) => { release = resolve; });
  const h = harness(start(), { advance: async (revision) => { h.actions.push(`enemy:${revision}`); return pending; } });
  h.clock.tick(10); await settle();
  h.controller.observe(h.current); h.clock.tick(100); await settle();
  assert.deepEqual(h.actions, ["enemy:1"]);
  const newer = advance(advance(h.current));
  h.inject(newer);
  release(advance(start())); await settle();
  assert.equal(h.current.state.revision, 3);
  assert.equal(h.controller.state.phase, "pre-action");
  h.unsubscribe();
});

test("old timer is cancelled by newer revision and by ended combat", async () => {
  const h = harness();
  h.inject(advance(h.current));
  h.clock.tick(100); await settle();
  assert.deepEqual(h.actions, []);
  h.unsubscribe();
  const ended = { ...start(), state: { ...start().state, combat: {
    ...start().state.combat!, status: "ended", endReason: "escaped", currentTurnIndex: null,
    currentActorId: null, lastAction: { type: "run", actorId: "TEST-player", round: 1, rawD20: 8,
      dexterityModifier: 2, racialModifier: 0, total: 10, dc: 8, outcome: "success" },
  } } } as AuthoritativeGameStateResponse;
  const e = harness(ended); e.clock.tick(100); await settle(); assert.deepEqual(e.actions, []); e.unsubscribe();
});

test("stale revision rehydrates without blind retry; network and invalid response stop", async () => {
  let hydrateCount = 0;
  const h = harness(start(), {
    advance: async () => { throw new ApiRequestError("版本已變更", "stale-revision"); },
    hydrate: async () => { hydrateCount++; return advance(start()); },
  });
  h.clock.tick(10); await settle();
  assert.equal(hydrateCount, 1);
  assert.equal(h.controller.state.phase, "idle");
  h.clock.tick(100); await settle(); assert.deepEqual(h.actions, []); h.unsubscribe();
  const network = harness(start(), { advance: async () => { throw new Error("目前無法連線。"); } });
  network.clock.tick(10); await settle();
  assert.equal(network.controller.state.phase, "error");
  network.clock.tick(100); assert.equal(network.controller.state.phase, "error"); network.unsubscribe();
  const invalid = harness(start(), { advance: async () => start() as CombatSandboxAdvanceResponse });
  invalid.clock.tick(10); await settle(); assert.equal(invalid.controller.state.phase, "error"); invalid.unsubscribe();
});

test("explicit recovery rehydrates before retrying an ambiguous failure", async () => {
  let attempts = 0;
  let reads = 0;
  const h = harness(start(), {
    advance: async () => { attempts++; throw new Error("連線中斷"); },
    hydrate: async () => { reads++; return advance(start()); },
  });
  h.clock.tick(10); await settle();
  assert.equal(attempts, 1);
  h.clock.tick(100); await settle(); assert.equal(attempts, 1);
  await h.controller.retry(); await settle();
  assert.equal(reads, 1);
  assert.equal(h.controller.state.phase, "idle");
  assert.equal(h.current.state.revision, 2);
  h.unsubscribe();
});

test("Memory API reset cannot silently replace a newer observed revision", async () => {
  const h = harness(advance(start()), { hydrate: async () => start() });
  await h.controller.retry();
  assert.equal(h.current.state.revision, 2);
  assert.equal(h.controller.state.phase, "error");
  assert.match(h.controller.state.error ?? "", /刷新整個頁面/);
  h.unsubscribe();
});

test("production enemy is unsupported and visual carousel rotates without changing server order", () => {
  const initial = start();
  const production = { ...initial, sandbox: false };
  assert.equal(classifyPacingActor(production), "unsupported");
  const h = harness(production);
  assert.equal(h.controller.state.phase, "error");
  assert.deepEqual(h.actions, []); h.unsubscribe();
  const player = advance(initial);
  const combat = player.state.combat!;
  const before = [...combat.turnOrder];
  assert.deepEqual(getVisualTurnOrderEntries(combat).map((item) => item.participant.id),
    ["TEST-player", "TEST-enemy-2", "TEST-companion-1", "TEST-enemy-1"]);
  assert.deepEqual(combat.turnOrder, before);
  const html = renderToStaticMarkup(createElement(CombatPage, { gameState: player, stateError: null,
    onStateUpdate: () => undefined, onRetryState: async () => player }));
  assert.match(html, /data-actor-id="TEST-player" data-current="true" aria-current="step"/);
  assert.match(html, /data-side="party" data-row="front" data-current="true"/);
});
