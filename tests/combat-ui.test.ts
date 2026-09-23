import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { advanceCombatTurn, startCombat } from "../src/domain/combat.js";
import { createGameState, type GameState } from "../src/domain/game.js";
import { createTestCombatInventory } from "../src/domain/combat-items.js";
import { buildApp } from "../src/server/app.js";
import { createCombatFixtureRoller } from "../src/server/combat/dice.js";
import { TEST_COMBAT_PARTICIPANTS } from "../src/server/combat/fixtures.js";
import { createDomainSession } from "../src/server/domain-session.js";
import {
  isAuthoritativeGameStateResponse,
  type AuthoritativeGameStateResponse,
} from "../src/shared/game-state.js";
import { advanceTestCombatTurn, loadAuthoritativeGameState } from "../src/web/api.js";
import { CombatPage } from "../src/web/CombatPage.js";
import {
  applicationMode,
  disabledCombatCommands,
  getCombatPresentationLanes,
  getTurnOrderEntries,
  initiativeDetail,
} from "../src/web/combat-ui.js";

function seed(): GameState {
  return createGameState({
    revision: 0,
    activity: "outside-combat",
    character: {
      id: "TEST-character",
      learnedActiveSkillIds: ["TEST-skill-1", "TEST-skill-2"],
      equippedSkillIds: ["TEST-skill-1"],
    },
    inventory: createTestCombatInventory(),
    exploration: { locationId: "TEST-forest-edge", lastObservationTargetId: null },
    combat: null,
  });
}

function combatResponse(sandbox = true): AuthoritativeGameStateResponse {
  const result = startCombat(seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("TEST combat 無法開始。");
  return { sandbox, storage: "memory", state: result.state };
}

test("權威 activity 決定頁面模式；Combat UI 不自行排序 turn order", () => {
  const combat = combatResponse();
  assert.equal(applicationMode(combat), "combat");
  assert.equal(applicationMode({ ...combat, state: seed() }), "exploration");
  assert.deepEqual(getTurnOrderEntries(combat.state.combat!).map((entry) => entry.participant.id), [
    "TEST-enemy-1", "TEST-player", "TEST-enemy-2",
  ]);
  assert.equal(initiativeDetail(combat.state.combat!.participants[0]!), "12 + 2 = 14");
});

test("四排位置直接讀取權威 row，不改 GameState 或 revision", () => {
  const response = combatResponse();
  const before = structuredClone(response.state);
  const lanes = getCombatPresentationLanes(response.state.combat!.participants);
  assert.deepEqual(lanes.map((lane) => [lane.id, lane.participants.map((participant) => participant.id)]), [
    ["enemy-back", ["TEST-enemy-2"]],
    ["enemy-front", ["TEST-enemy-1"]],
    ["party-front", ["TEST-player"]],
    ["party-back", []],
  ]);
  assert.deepEqual(response.state, before);
  assert.equal(response.state.revision, 1);
});

test("CombatPage 呈現權威 Round、actor、四排、唯讀技能與 disabled command", () => {
  const page = renderToStaticMarkup(createElement(CombatPage, {
    gameState: combatResponse(),
    stateError: null,
    onStateUpdate: () => undefined,
    onRetryState: async () => combatResponse(),
  }));
  for (const text of ["TEST 戰鬥", "第 1 回合", "目前行動：", "TEST 敵人 1", "敵方後排", "敵方前排", "我方前排", "我方後排", "戰鬥敘事", "尚未接入", "TEST-skill-1", "目前行動"]) {
    assert.match(page, new RegExp(text));
  }
  for (const command of disabledCombatCommands) {
    assert.match(page, new RegExp(`data-command=\\"${command.id}\\"[^>]*disabled=\\"\\"`));
  }
  assert.match(page, /TEST：推進下一回合/);
  assert.match(page, /目前是敵方回合/);
  assert.doesNotMatch(page, /HP\s*\d|MP\s*\d|選擇目標|攻擊成功/);
});

test("前端排位只使用 participant.side 與 participant.row，並在玩家回合啟用普通攻擊", () => {
  const started = startCombat(seed(), { expectedRevision: 0 }, TEST_COMBAT_PARTICIPANTS, createCombatFixtureRoller("normal"));
  assert.equal(started.ok, true);
  if (!started.ok) return;
  const playerTurn = advanceCombatTurn(started.state, { expectedRevision: 1 });
  assert.equal(playerTurn.ok, true);
  if (!playerTurn.ok) return;
  const lanes = getCombatPresentationLanes(playerTurn.state.combat!.participants);
  assert.deepEqual(lanes.map((lane) => [lane.id, lane.participants.map((participant) => participant.id)]), [
    ["enemy-back", ["TEST-enemy-2"]],
    ["enemy-front", ["TEST-enemy-1"]],
    ["party-front", ["TEST-player"]],
    ["party-back", []],
  ]);
  const page = renderToStaticMarkup(createElement(CombatPage, {
    gameState: { sandbox: true, storage: "memory", state: playerTurn.state },
    stateError: null,
    onStateUpdate: () => undefined,
    onRetryState: async () => combatResponse(),
  }));
  assert.match(page, /data-command="attack"/);
  assert.doesNotMatch(page, /data-command="attack"[^>]*disabled=""/);
  assert.doesNotMatch(page, /選擇此目標/);
});

test("sandbox 關閉時不呈現 TEST advance control；participant 卡不是 target button", () => {
  const page = renderToStaticMarkup(createElement(CombatPage, {
    gameState: combatResponse(false),
    stateError: null,
    onStateUpdate: () => undefined,
    onRetryState: async () => combatResponse(false),
  }));
  assert.doesNotMatch(page, /TEST：推進下一回合/);
  assert.match(page, /<article class=\"combat-participant/);
  assert.doesNotMatch(page, /data-target/);
});

test("shared runtime boundary 拒絕 malformed state 與被注入的權威欄位", () => {
  const valid = combatResponse();
  assert.equal(isAuthoritativeGameStateResponse(valid), true);
  assert.equal(isAuthoritativeGameStateResponse({ ...valid, debug: true }), false);
  assert.equal(isAuthoritativeGameStateResponse({
    ...valid,
    state: {
      ...valid.state,
      combat: {
        ...valid.state.combat!,
        participants: valid.state.combat!.participants.map((participant, index) => index === 0
          ? { ...participant, hp: 999 } : participant),
      },
    },
  }), false);
});

test("唯讀 game-state API 回傳經驗證的 activity 與 CombatState，並禁止快取", async (t) => {
  const session = createDomainSession(seed());
  const app = await buildApp({
    domainSession: session,
    combatSandbox: true,
    combatRoller: createCombatFixtureRoller("normal"),
  });
  t.after(() => app.close());
  const initial = await app.inject("/api/game-state");
  assert.equal(initial.statusCode, 200);
  assert.equal(initial.headers["cache-control"], "no-store");
  assert.equal(isAuthoritativeGameStateResponse(initial.json()), true);
  assert.equal(initial.json().state.activity, "outside-combat");

  const started = await app.inject({ method: "POST", url: "/api/dev/combat/start", payload: { expectedRevision: 0 } });
  assert.equal(started.statusCode, 200);
  const active = await app.inject("/api/game-state");
  assert.equal(isAuthoritativeGameStateResponse(active.json()), true);
  assert.equal(active.json().sandbox, true);
  assert.equal(active.json().state.activity, "in-combat");
  assert.equal(active.json().state.combat.currentActorId, "TEST-enemy-1");
});

test("frontend 以目前 revision 呼叫 TEST advance，並只採用後端回傳 state", async () => {
  const current = combatResponse();
  const advanced = {
    sandbox: true,
    storage: "memory" as const,
    effect: { type: "combat-turn-advanced" as const },
    state: {
      ...current.state,
      revision: 2,
      combat: { ...current.state.combat!, currentTurnIndex: 1, currentActorId: "TEST-player" },
    },
  };
  const response = await advanceTestCombatTurn(1, async (url, init) => {
    assert.equal(url, "/api/dev/combat/advance");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.body, '{"expectedRevision":1}');
    return Response.json(advanced);
  });
  assert.equal(response.state.revision, 2);
  assert.equal(response.state.combat?.currentActorId, "TEST-player");
});

test("前端安全拒絕 malformed 或不可用的戰鬥回應", async () => {
  await assert.rejects(loadAuthoritativeGameState(async () => Response.json({})), /格式不正確/);
  await assert.rejects(loadAuthoritativeGameState(async () => { throw new TypeError("network detail"); }), /目前無法讀取戰鬥狀態/);
  await assert.rejects(advanceTestCombatTurn(1, async () => Response.json({ error: "stale-revision", message: "安全訊息" }, { status: 409 })), /安全訊息/);
});

test("Combat UI 不匯入 domain、LLM 或 exploration narration；disabled commands 沒有 action API", async () => {
  for (const file of ["CombatPage.tsx", "combat-ui.ts"]) {
    const source = await readFile(new URL(`../src/web/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from\s+["'][^"']*(?:\/domain\/|\/server\/llm\/|narration)/);
  }
  const source = await readFile(new URL("../src/web/CombatPage.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /executeExplorationAction|fetch\(|attack.*fetch/i);
});
