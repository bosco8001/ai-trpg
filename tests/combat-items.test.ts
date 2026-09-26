import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { advanceCombatTurn, getCurrentCombatItemOptions, startCombat, useCombatItem } from "../src/domain/combat.js";
import { createTestCombatInventory, TEST_COMBAT_CONSUMABLE_ID } from "../src/domain/combat-items.js";
import { createGameState, type GameState } from "../src/domain/game.js";
import { buildApp } from "../src/server/app.js";
import { createCombatFixtureRoller } from "../src/server/combat/dice.js";
import { TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createDomainSession, createPersistedDomainSession } from "../src/server/domain-session.js";
import { createTestGameState } from "../src/server/test-game-state.js";
import { CombatPage } from "../src/web/CombatPage.js";
import { hydrateStateRow, PostgresGameStateRepository } from "../src/server/postgres-game-state-repository.js";
import {
  isAuthoritativeGameStateResponse,
  isCombatItemOptionsResponse,
  isCombatItemUseResponse,
} from "../src/shared/game-state.js";
import { executeCombatItemUse, loadCombatItemOptions } from "../src/web/api.js";

function seed(characterId = "TEST-character", quantity = 2): GameState {
  const base = createTestGameState();
  return createGameState({
    ...base,
    character: { ...base.character, id: characterId },
    inventory: [{ itemId: TEST_COMBAT_CONSUMABLE_ID, quantity }],
  });
}

function requireOk<T extends { readonly ok: boolean }>(result: T): asserts result is Extract<T, { readonly ok: true }> {
  assert.equal(result.ok, true);
}

function playerTurnState(initial = seed()): GameState {
  const started = startCombat(initial, { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
  requireOk(started);
  const player = advanceCombatTurn(started.state, { expectedRevision: 1 });
  requireOk(player);
  return player.state;
}

function inventoryQuantity(state: GameState): number | undefined {
  return state.inventory.find((stack) => stack.itemId === TEST_COMBAT_CONSUMABLE_ID)?.quantity;
}

test("TEST fixture 初始有兩件物品；inventory 驗證拒絕負數、未知、重複與格式錯誤", () => {
  assert.equal(inventoryQuantity(createTestGameState()), 2);
  const validZero = createGameState({ ...seed(), inventory: [{ itemId: TEST_COMBAT_CONSUMABLE_ID, quantity: 0 }] });
  assert.equal(inventoryQuantity(validZero), 0);
  for (const inventory of [
    [{ itemId: TEST_COMBAT_CONSUMABLE_ID, quantity: -1 }],
    [{ itemId: "TEST-unknown-item", quantity: 1 }],
    [{ itemId: "toString", quantity: 1 }],
    [{ itemId: TEST_COMBAT_CONSUMABLE_ID, quantity: 1.5 }],
    [{ itemId: TEST_COMBAT_CONSUMABLE_ID, quantity: 1, hp: 20 }],
    [
      { itemId: TEST_COMBAT_CONSUMABLE_ID, quantity: 1 },
      { itemId: TEST_COMBAT_CONSUMABLE_ID, quantity: 2 },
    ],
  ]) assert.throws(() => createGameState({ ...seed(), inventory }));
});

test("已知 TEST-character 的 legacy JSONB 快照只補工程背包；未知角色缺欄位會拒絕", () => {
  const old = seed();
  const hydrated = hydrateStateRow({
    character_id: "TEST-character",
    revision: "7",
    snapshot: {
      activity: old.activity,
      character: old.character,
      exploration: old.exploration,
      combat: null,
    },
  });
  assert.equal(inventoryQuantity(hydrated), 2);
  assert.equal(hydrated.revision, 7);
  assert.throws(() => hydrateStateRow({
    character_id: "TEST-production-character",
    revision: "7",
    snapshot: {
      activity: old.activity,
      character: { ...old.character, id: "TEST-production-character" },
      exploration: old.exploration,
      combat: null,
    },
  }));
  assert.throws(() => hydrateStateRow({
    character_id: "TEST-character",
    revision: "7",
    snapshot: {
      activity: old.activity,
      character: old.character,
      inventory: [{ itemId: TEST_COMBAT_CONSUMABLE_ID, quantity: -1 }],
      exploration: old.exploration,
      combat: null,
    },
  }));
});

test("options read 可在 enemy Turn 查看但不改 revision、actor、Round 或 lastAction", () => {
  const started = startCombat(seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
  requireOk(started);
  const before = structuredClone(started.state);
  const result = getCurrentCombatItemOptions(started.state);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result, {
    ok: true,
    revision: 1,
    options: {
      currentActorId: "TEST-enemy-1",
      items: [{
        itemId: TEST_COMBAT_CONSUMABLE_ID,
        displayName: "TEST 戰鬥消耗品",
        quantity: 2,
        usable: false,
        unavailableReason: "not-player-turn",
      }],
    },
  });
  assert.deepEqual(started.state, before);
});

test("使用 TEST 物品扣一件、保存 item-use、只增加一次 revision 並推進 Turn", () => {
  const player = playerTurnState();
  const result = useCombatItem(player, { expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID });
  requireOk(result);
  assert.equal(inventoryQuantity(result.state), 1);
  assert.equal(result.state.revision, 3);
  assert.deepEqual([
    result.state.combat?.round,
    result.state.combat?.currentActorId,
    result.state.combat?.lastAction,
  ], [1, "TEST-enemy-2", {
    type: "item-use",
    actorId: "TEST-player",
    round: 1,
    itemId: TEST_COMBAT_CONSUMABLE_ID,
    quantityBefore: 2,
    quantityAfter: 1,
  }]);
  assert.equal(result.effect.type, "combat-item-used");
  assert.throws(() => createGameState({ ...result.state,
    inventory: [{ itemId: TEST_COMBAT_CONSUMABLE_ID, quantity: 2 }],
  }));

  const wrap = advanceCombatTurn(result.state, { expectedRevision: 3 });
  requireOk(wrap);
  const next = advanceCombatTurn(wrap.state, { expectedRevision: 4 });
  requireOk(next);
  const second = useCombatItem(next.state, { expectedRevision: 5, itemId: TEST_COMBAT_CONSUMABLE_ID });
  requireOk(second);
  assert.deepEqual([
    inventoryQuantity(second.state),
    second.state.revision,
    second.state.combat?.round,
    second.state.combat?.currentActorId,
    second.state.combat?.lastAction?.type,
  ], [0, 6, 2, "TEST-enemy-2", "item-use"]);
  assert.equal(second.state.combat?.lastAction?.type === "item-use"
    ? second.state.combat.lastAction.quantityAfter : -1, 0);
});

test("enemy turn, stale, unknown, depleted, malformed and no-combat uses all reject without mutation", () => {
  const enemy = (() => {
    const result = startCombat(seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
    requireOk(result);
    return result.state;
  })();
  const depleted = playerTurnState(createGameState({ ...seed(), inventory: [{ itemId: TEST_COMBAT_CONSUMABLE_ID, quantity: 0 }] }));
  const cases: readonly [GameState, unknown, string][] = [
    [enemy, { expectedRevision: 1, itemId: TEST_COMBAT_CONSUMABLE_ID }, "not-player-turn"],
    [playerTurnState(), { expectedRevision: 1, itemId: TEST_COMBAT_CONSUMABLE_ID }, "stale-revision"],
    [playerTurnState(), { expectedRevision: 2, itemId: "TEST-does-not-exist" }, "unsupported-item"],
    [depleted, { expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID }, "item-unavailable"],
    [playerTurnState(), { expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID, actorId: "TEST-player" }, "invalid-command"],
    [playerTurnState(), { expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID, targetId: "TEST-enemy-1" }, "invalid-command"],
    [playerTurnState(), { expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID, quantity: 1 }, "invalid-command"],
    [playerTurnState(), { expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID, effect: "healing" }, "invalid-command"],
    [seed(), { expectedRevision: 0, itemId: TEST_COMBAT_CONSUMABLE_ID }, "not-in-combat"],
  ];
  for (const [state, input, code] of cases) {
    const before = structuredClone(state);
    const result = useCombatItem(state, input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
    assert.deepEqual(state, before);
  }
});

test("combat item GET/POST routes validate unknown input and return server-derived state and options", async (t) => {
  const session = createDomainSession(seed());
  const app = await buildApp({ domainSession: session, combatSandbox: true, combatParticipants: TEST_COMBAT_PARTICIPANTS, combatRoller: createCombatFixtureRoller("normal") });
  t.after(() => app.close());
  assert.equal((await app.inject({ method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 0 } })).statusCode, 200);
  const before = structuredClone(session.getState());
  const enemyOptions = await app.inject("/api/combat/items/options");
  assert.equal(enemyOptions.statusCode, 200);
  assert.equal(enemyOptions.headers["cache-control"], "no-store");
  assert.equal(isCombatItemOptionsResponse(enemyOptions.json()), true);
  assert.equal(enemyOptions.json().revision, 1);
  assert.equal(enemyOptions.json().currentActorId, "TEST-enemy-1");
  assert.equal(enemyOptions.json().items[0].usable, false);
  assert.deepEqual(session.getState(), before);

  await app.inject({ method: "POST", url: "/api/dev/combat/advance", payload: { expectedRevision: 1 } });
  const playerOptions = await app.inject("/api/combat/items/options");
  assert.equal(playerOptions.json().currentActorId, "TEST-player");
  assert.equal(playerOptions.json().items[0].usable, true);
  assert.equal(session.getState().revision, 2);
  assert.equal(inventoryQuantity(session.getState()), 2);

  const used = await app.inject({
    method: "POST",
    url: "/api/combat/items/use",
    payload: { expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID },
  });
  assert.equal(used.statusCode, 200);
  assert.equal(isCombatItemUseResponse(used.json()), true);
  assert.equal(used.json().state.revision, 3);
  assert.equal(used.json().state.combat.currentActorId, "TEST-enemy-2");
  assert.equal(used.json().state.inventory[0].quantity, 1);
  assert.equal(used.json().options.revision, 3);

  const afterUse = structuredClone(session.getState());
  const bad = await app.inject({
    method: "POST",
    url: "/api/combat/items/use",
    payload: { expectedRevision: 3, itemId: TEST_COMBAT_CONSUMABLE_ID, hp: 20 },
  });
  assert.equal(bad.statusCode, 400);
  assert.deepEqual(session.getState(), afterUse);
});

test("browser API 把 JSON 視為 unknown、送 exact request 並安全處理失敗", async () => {
  const optionsPayload = {
    revision: 2,
    currentActorId: "TEST-player",
    items: [{ itemId: TEST_COMBAT_CONSUMABLE_ID, displayName: "TEST 戰鬥消耗品", quantity: 2, usable: true }],
  };
  const options = await loadCombatItemOptions(async (url, init) => {
    assert.equal(url, "/api/combat/items/options");
    assert.equal(init?.cache, "no-store");
    return Response.json(optionsPayload);
  });
  assert.equal(options.items[0]?.quantity, 2);
  await assert.rejects(loadCombatItemOptions(async () => Response.json({ quantity: 2 })), /格式不正確/);

  const usedState = useCombatItem(playerTurnState(), { expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID });
  requireOk(usedState);
  const apiPayload = {
    sandbox: true,
    storage: "memory" as const,
    effect: { type: "combat-item-used" as const },
    state: usedState.state,
    options: {
      revision: 3,
      currentActorId: "TEST-enemy-2",
      items: [{
        itemId: TEST_COMBAT_CONSUMABLE_ID,
        displayName: "TEST 戰鬥消耗品",
        quantity: 1,
        usable: false,
        unavailableReason: "not-player-turn" as const,
      }],
    },
  };
  const apiResponse = await executeCombatItemUse(2, TEST_COMBAT_CONSUMABLE_ID, async (url, init) => {
    assert.equal(url, "/api/combat/items/use");
    assert.equal(init?.method, "POST");
    assert.equal(init?.body, JSON.stringify({ expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID }));
    return Response.json(apiPayload);
  });
  assert.equal(apiResponse.state.revision, 3);
  assert.equal(isAuthoritativeGameStateResponse({ sandbox: true, storage: "memory", state: apiResponse.state }), true);
  await assert.rejects(executeCombatItemUse(2, TEST_COMBAT_CONSUMABLE_ID, async () => {
    throw new TypeError("private fetch details");
  }), /重新讀取戰鬥狀態/);
});

test("戰鬥 UI 在敵方回合仍提供背包入口，item-use recent action 只顯示物品與數量事實", () => {
  const enemy = startCombat(seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
  requireOk(enemy);
  const enemyPage = renderToStaticMarkup(createElement(CombatPage, {
    gameState: { sandbox: true, storage: "memory", state: enemy.state },
    stateError: null,
    onStateUpdate: () => undefined,
    onRetryState: async () => ({ sandbox: true, storage: "memory" as const, state: enemy.state }),
  }));
  assert.match(enemyPage, /data-command="inventory"/);
  assert.doesNotMatch(enemyPage, /data-command="inventory"[^>]*disabled=""/);

  const player = playerTurnState();
  const used = useCombatItem(player, { expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID });
  requireOk(used);
  const page = renderToStaticMarkup(createElement(CombatPage, {
    gameState: { sandbox: true, storage: "memory", state: used.state },
    stateError: null,
    onStateUpdate: () => undefined,
    onRetryState: async () => ({ sandbox: true, storage: "memory" as const, state: used.state }),
  }));
  assert.match(page, /TEST 玩家/);
  assert.match(page, /使用：TEST 戰鬥消耗品/);
  assert.match(page, /數量：2 → 1/);
  assert.match(page, /結果：物品已使用/);
  assert.doesNotMatch(page, /HP\s*\+|治療|傷害|buff|debuff/i);
});

test("物品 domain 與權威 combat service 不連接 interpretation、narration 或 LLM", async () => {
  for (const file of [
    "../src/domain/combat-items.ts",
    "../src/domain/combat.ts",
    "../src/server/combat/service.ts",
  ]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from\s+["'][^"']*(interpretation|narration|\/llm\/)/i);
  }
});

test("TEST_DATABASE_URL 下並行同 revision 只能扣除一次，並可從新 repository 讀回", {
  skip: !process.env.TEST_DATABASE_URL && "需提供隔離的 TEST_DATABASE_URL，並先執行 migration。",
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
  const id = `TEST-combat-item-${randomUUID()}`;
  const repository = new PostgresGameStateRepository(pool);
  try {
    const initial = seed(id, 1);
    const sessionA = createPersistedDomainSession(repository, initial);
    const sessionB = createPersistedDomainSession(new PostgresGameStateRepository(pool), initial);
    const started = await sessionA.startCombat(
      { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"),
    );
    requireOk(started);
    const player = await sessionA.advanceCombat({ expectedRevision: 1 });
    requireOk(player);
    const [a, b] = await Promise.all([
      sessionA.useCombatItem({ expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID }),
      sessionB.useCombatItem({ expectedRevision: 2, itemId: TEST_COMBAT_CONSUMABLE_ID }),
    ]);
    assert.deepEqual([a.ok, b.ok].sort(), [false, true]);
    for (const result of [a, b]) if (!result.ok) assert.equal(result.code, "stale-revision");
    const loaded = await new PostgresGameStateRepository(pool).load(id);
    assert.equal(loaded?.revision, 3);
    assert.equal(inventoryQuantity(loaded!), 0);
    assert.equal(loaded?.combat?.lastAction?.type, "item-use");
    assert.equal(loaded?.combat?.currentActorId, "TEST-enemy-2");
  } finally {
    await pool.query("DELETE FROM game_states WHERE character_id = $1", [id]).catch(() => undefined);
    await pool.end();
  }
});
