import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGameState, gameStateContents, replaceGameStateContents, type GameState } from '../src/domain/game.js';
import { applyCombatDamage, startCombat, runFromCombat, startCasting } from '../src/domain/combat.js';
import { settleCombat, phase26, changePermanentCapacity, newIdentity, orderedHistory } from '../src/domain/settlement.js';
import { createTestGameState } from '../src/server/test-game-state.js';
import { PHASE22_TEST_COMBAT_PARTICIPANTS } from '../src/server/combat/fixtures.js';
import { createPhase22CombatFixtureRoller, SequenceD20Roller } from '../src/server/combat/dice.js';
import { createDomainSession, createPersistedDomainSession } from '../src/server/domain-session.js';
import { createSettlementService, settlementFallback, createSettlementNarrator } from '../src/server/combat/settlement-service.js';
import { PostgresGameStateRepository } from '../src/server/postgres-game-state-repository.js';
import { PostgresSaveGameRepository } from '../src/server/save-game/postgres-repository.js';
import { createSaveGameService, createSaveSnapshot, decodeSaveSnapshot } from '../src/server/save-game/service.js';
import { InMemorySaveGameRepository } from '../src/server/save-game/memory-repository.js';
import { buildApp } from '../src/server/app.js';
import { isSettlementResponse } from '../src/shared/settlement.js';
import { CombatPage } from '../src/web/CombatPage.js';
import { acceptState, acceptHistory } from '../src/web/state-sync.js';
import { executeSettlement } from '../src/web/api.js';
function ok<T extends {
    ok: boolean;
}>(v: T): asserts v is Extract<T, {
    ok: true;
}> { assert.equal(v.ok, true, JSON.stringify(v)); }
function battle(sourceEncounterId: string | null = null, initial = createTestGameState()) {
    const r = startCombat(initial, { expectedRevision: initial.revision }, PHASE22_TEST_COMBAT_PARTICIPANTS, createPhase22CombatFixtureRoller('normal'), { sourceEncounterId, rewardEligibleOnVictory: true });
    ok(r);
    return r.state;
}
function damage(s: GameState, targetId: string, amount: number) { const r = applyCombatDamage(s, { expectedRevision: s.revision, targetId, amount }); ok(r); return r.state; }
function victory(s = battle()) { return damage(damage(s, 'TEST-enemy-1', 6), 'TEST-enemy-2', 6); }
function escaped(s = battle()) {
    const player = s.combat!.participants.find(p => p.id === 'TEST-player')!;
    const r = runFromCombat(createGameState({ ...s, combat: { ...s.combat, currentTurnIndex: s.combat!.turnOrder.indexOf(player.id), currentActorId: player.id } }), { expectedRevision: s.revision }, new SequenceD20Roller([20]));
    ok(r);
    return r.state;
}
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function view(state: GameState) { return { sandbox: true, storage: 'memory' as const, state }; }
test('Victory stabilizes dying and preserves remaining resources, references and Encounter atomically', () => {
    let s = battle('TEST-encounter-1');
    s = damage(s, 'TEST-player', 3);
    s = damage(s, 'TEST-companion-1', 8);
    s = victory(s);
    const before = structuredClone(s);
    const r = settleCombat(s, { expectedRevision: s.revision });
    ok(r);
    assert.deepEqual(s, before);
    assert.equal(r.state.revision, s.revision + 1);
    assert.equal(r.state.combat, null);
    assert.deepEqual(r.state.exploration, s.combat!.lifecycle!.returnExplorationContext);
    assert.equal(phase26(r.state).characters[0]!.currentHp, 7);
    assert.equal(phase26(r.state).characters[1]!.currentHp, 1);
    assert.equal(phase26(r.state).encounters[0]!.resolved, true);
    assert.equal(r.settlementResult.rewardEligible, false);
    assert.equal(r.settlementResult.partyResults[1]!.before.currentHp, 0);
    assert.equal(r.settlementResult.partyResults[1]!.before.lifeState, 'dying');
    assert.equal(r.settlementResult.settlementRevision, r.state.revision);
});
test('Escape keeps Encounter unresolved, does not restart and next Combat inherits HP/MP with a new ID', () => {
    let s = damage(battle('TEST-encounter-1'), 'TEST-player', 4);
    s = escaped(s);
    const r = settleCombat(s, { expectedRevision: s.revision });
    ok(r);
    assert.equal(phase26(r.state).encounters[0]!.resolved, false);
    const next = battle('TEST-encounter-1', r.state);
    assert.equal(next.combat!.participants[0]!.health.currentHp, 6);
    assert.notEqual(next.combat!.lifecycle!.combatId, s.combat!.lifecycle!.combatId);
});
test('Dead Companion leaves Party without losing character, MP, equipment or inventory', () => {
    let s = battle();
    const p = phase26(s);
    s = createGameState({ ...s, phase26: { ...p, characters: p.characters.map(c => c.characterId === 'TEST-companion-1' ? { ...c, maxMp: 4, currentMp: 4, equipmentIds: ['TEST-kept-equipment'] } : c) },
        combat: { ...s.combat, participants: s.combat!.participants.map(c => c.id === 'TEST-companion-1' ? { ...c, health: { ...c.health, currentHp: 0, lifeState: 'dead', dyingTurnsRemaining: null }, mp: { maxMp: 4, currentMp: 2 } } : c) } });
    s = victory(s);
    const r = settleCombat(s, { expectedRevision: s.revision });
    ok(r);
    assert.equal(r.state.partyMembers.length, 0);
    assert.equal(phase26(r.state).characters[1]!.currentMp, 2);
    assert.deepEqual(phase26(r.state).characters[1]!.equipmentIds, ['TEST-kept-equipment']);
    assert.deepEqual(r.state.inventory, s.inventory);
    assert.equal(r.settlementResult.partyResults[1]!.after.activePartyMember, false);
});
test('Party Defeat retains Combat authority and supports complete Save/Load without settlement', async () => {
    const s = damage(damage(battle(), 'TEST-companion-1', 8), 'TEST-player', 10);
    assert.equal(s.combat!.endReason, 'party-defeat');
    const session = createDomainSession(s), repo = new InMemorySaveGameRepository(() => session.getState()), service = createSaveGameService(repo, session, 'memory');
    const rejected = await session.settleCombat({ expectedRevision: s.revision });
    assert.equal(rejected.ok, false);
    assert.deepEqual(session.getState(), s);
    await service.save(1, s.revision);
    const loaded = await service.load(1, s.revision);
    assert.equal(loaded.authoritative!.state.combat!.endReason, 'party-defeat');
    assert.equal(loaded.state.revision, s.revision + 1);
    assert.equal(loaded.authoritative!.state.combat!.participants[0]!.health.currentHp, 0);
    assert.equal(phase26(session.getState()).characters[0]!.currentHp, 10);
});
test('Temporary capacity clamps only at settlement; invalid current and unproven capacity reject', () => {
    let s = battle();
    s = createGameState({ ...s, combat: { ...s.combat, participants: s.combat!.participants.map(c => c.id === 'TEST-player' ? { ...c, health: { ...c.health, maxHp: 15, currentHp: 14 }, mp: { maxMp: 30, currentMp: 28 }, capacityAdjustment: { ruleId: 'TEST-temporary-capacity', hpDelta: 5, mpDelta: 6 } } : c) } });
    s = victory(s);
    const r = settleCombat(s, { expectedRevision: s.revision });
    ok(r);
    assert.equal(phase26(r.state).characters[0]!.currentHp, 10);
    assert.equal(phase26(r.state).characters[0]!.currentMp, 24);
    for (const modified of [{ ...s.combat, participants: s.combat!.participants.map(c => c.id === 'TEST-player' ? { ...c, health: { ...c.health, currentHp: 16 } } : c) },
        { ...s.combat, participants: s.combat!.participants.map(c => c.id === 'TEST-player' ? { ...c, capacityAdjustment: undefined } : c) }]) {
        const result = settleCombat({ ...s, combat: modified } as GameState, { expectedRevision: s.revision });
        assert.equal(result.ok, false);
    }
});
test('Permanent capacity updates both authorities without healing and survives Defeat', () => {
    let s = damage(battle(), 'TEST-player', 3);
    let r = changePermanentCapacity(s, s.revision, 'TEST-character', 8, 20);
    ok(r);
    s = r.state;
    assert.equal(phase26(s).characters[0]!.currentHp, 8);
    assert.equal(s.combat!.participants[0]!.health.currentHp, 7);
    assert.equal(s.combat!.participants[0]!.health.maxHp, 8);
    r = changePermanentCapacity(s, s.revision, 'TEST-character', 15, 30);
    ok(r);
    assert.equal(r.state.combat!.participants[0]!.health.currentHp, 7);
    assert.equal(phase26(r.state).characters[0]!.currentHp, 8);
    const dead = damage(damage(r.state, 'TEST-companion-1', 8), 'TEST-player', 15);
    assert.equal(dead.combat!.endReason, 'party-defeat');
    assert.equal(phase26(dead).characters[0]!.maxHp, 15);
});
test('References, duplicate mapping, already resolved Encounter and illegal life facts fail with zero mutation', () => {
    const s = victory(battle('TEST-encounter-1'));
    const badStates: GameState[] = [{ ...s, combat: { ...s.combat!, lifecycle: { ...s.combat!.lifecycle!, worldId: 'wrong-world' } } },
        { ...s, combat: { ...s.combat!, lifecycle: { ...s.combat!.lifecycle!, sourceEncounterId: 'missing' } } },
        { ...s, combat: { ...s.combat!, lifecycle: { ...s.combat!.lifecycle!, returnExplorationContext: null as never } } },
        { ...s, combat: { ...s.combat!, participants: s.combat!.participants.map(c => c.id === 'TEST-companion-1' ? { ...c, characterId: 'TEST-character' } : c) } },
        { ...s, phase26: { ...phase26(s), encounters: phase26(s).encounters.map(e => ({ ...e, resolved: true })) } }];
    for (const bad of badStates) {
        const before = structuredClone(bad);
        const r = settleCombat(bad, { expectedRevision: bad.revision });
        assert.equal(r.ok, false);
        assert.deepEqual(bad, before);
    }
    const initial = createTestGameState(), p = phase26(initial);
    const resolved = createGameState({ ...initial, phase26: { ...p, encounters: p.encounters.map(e => ({ ...e, resolved: true })) } });
    assert.throws(() => battle('TEST-encounter-1', resolved));
});
test('Concurrent Continue commits at most once; stale cannot mutate and GET is current state only', async () => {
    const s = victory(), session = createDomainSession(s), service = createSettlementService(session);
    const [a, b] = await Promise.all([service.settle({ expectedRevision: s.revision }), service.settle({ expectedRevision: s.revision })]);
    assert.deepEqual([a.ok, b.ok].sort(), [false, true]);
    assert.equal(session.getState().revision, s.revision + 1);
    assert.equal(phase26(session.getState()).history.length, 1);
});
test('Delayed narration may append after later gameplay and is ordered by source revision', async () => {
    const s = victory(), session = createDomainSession(s), gate = deferred<void>(), started = deferred<void>();
    const task = createSettlementService(session, { async narrate(f) { started.resolve(); await gate.promise; return { text: settlementFallback(f), source: 'model' }; } }).settle({ expectedRevision: s.revision });
    await started.promise;
    const committed = session.getState();
    assert.equal(committed.combat, null);
    const next = session.execute({ type: 'approach-target', expectedRevision: committed.revision, targetId: 'TEST-ruin-entrance' });
    ok(next);
    const system = await session.reserveNarrative('system');
    await session.appendNarrative(system!, 'TEST 系統事件', 'fallback');
    gate.resolve();
    const response = await task;
    ok(response);
    assert.equal(response.state.revision, s.revision + 1);
    assert.equal(response.settlementResult.settlementRevision, response.state.revision);
    assert.equal(session.getState().revision, s.revision + 2);
    assert.equal(orderedHistory(phase26(session.getState()).history)[0]!.type, 'post-combat');
});
test('Load invalidates pending narrator at atomic append and restores exact History', async () => {
    const s = victory(), session = createDomainSession(s), gate = deferred<void>(), started = deferred<void>(), saved = gameStateContents(s);
    const task = createSettlementService(session, { async narrate(f) { started.resolve(); await gate.promise; return { text: settlementFallback(f), source: 'model' }; } }).settle({ expectedRevision: s.revision });
    await started.promise;
    const replaced = await session.replaceContents(session.getState().revision, saved);
    ok(replaced);
    gate.resolve();
    const response = await task;
    ok(response);
    assert.equal(response.narration.status, 'discarded');
    assert.equal(phase26(session.getState()).history.length, 0);
    assert.equal(session.getState().combat!.lifecycle!.combatId, s.combat!.lifecycle!.combatId);
});
test('Reset invalidates callbacks, retains allocator and verifies explicit fixture ownership', async () => {
    const session = createDomainSession(victory()), token = await session.reserveNarrative('system'), before = session.getState();
    const reset = await session.resetTest({ expectedRevision: before.revision });
    ok(reset);
    assert.equal(reset.state.revision, before.revision + 1);
    assert.equal(phase26(reset.state).sequenceHighWater, token!.sequence);
    assert.equal((await session.appendNarrative(token!, '不應保存', 'fallback')).status, 'discarded');
    const other = createDomainSession(createGameState({ ...createTestGameState(), phase26: { ...phase26(createTestGameState()), fixtureId: null } }));
    assert.equal((await other.resetTest({ expectedRevision: 0 })).ok, false);
});
test('First write wins across model/fallback, same Combat replay has distinct revision event identity', async () => {
    const s = victory(), session = createDomainSession(s), snapshot = gameStateContents(s), r = await session.settleCombat({ expectedRevision: s.revision });
    ok(r);
    const first = await session.appendNarrative(r.reservation!, settlementFallback(r.settlementResult), 'fallback');
    const duplicate = await session.appendNarrative(r.reservation!, '後到模型不可取代', 'model');
    assert.deepEqual(duplicate, first);
    const loaded = await session.replaceContents(session.getState().revision, snapshot);
    ok(loaded);
    const replay = await createSettlementService(session).settle({ expectedRevision: loaded.state.revision });
    ok(replay);
    assert.equal(replay.settlementResult.combatId, r.settlementResult.combatId);
    assert.notEqual(replay.settlementResult.settlementRevision, r.settlementResult.settlementRevision);
    assert.equal(phase26(session.getState()).narrativeLedger.length, 2);
    assert.equal(phase26(session.getState()).history.length, 1);
    assert.ok(phase26(session.getState()).history[0]!.sequence! > r.reservation!.sequence);
});
test('Save during pending narration captures only persisted History and Load cannot roll allocator backwards', async () => {
    const s = victory(), session = createDomainSession(s), repo = new InMemorySaveGameRepository(() => session.getState()), save = createSaveGameService(repo, session, 'memory');
    const r = await session.settleCombat({ expectedRevision: s.revision });
    ok(r);
    await save.save(1, r.state.revision);
    await session.appendNarrative(r.reservation!, settlementFallback(r.settlementResult), 'fallback');
    const high = phase26(session.getState()).sequenceHighWater;
    await save.load(1, session.getState().revision);
    assert.equal(phase26(session.getState()).history.length, 0);
    assert.equal(phase26(session.getState()).sequenceHighWater, high);
});
test('Narrative save failure is unsaved gameplay success; missing reservation skips provider', async () => {
    const s = victory(), session = createDomainSession(s);
    let calls = 0;
    const broken = { ...session, async appendNarrative() { throw new Error('db unavailable'); } };
    const response = await createSettlementService(broken, { async narrate(f) { calls++; return { text: settlementFallback(f), source: 'model' }; } }).settle({ expectedRevision: s.revision });
    ok(response);
    assert.equal(response.narration.status, 'unsaved');
    assert.equal(session.getState().combat, null);
    assert.equal(calls, 1);
    const limited = createDomainSession(createGameState({ ...s, phase26: { ...phase26(s), sequenceHighWater: Number.MAX_SAFE_INTEGER } }));
    const noToken = await createSettlementService(limited, { async narrate() { throw new Error('must not call'); } }).settle({ expectedRevision: s.revision });
    ok(noToken);
    assert.equal(noToken.narration.status, 'unavailable');
});
test('Post-combat model is limited to confirmed facts; timeout fallback closes late model publishing', async () => {
    const s = victory(), r = settleCombat(s, { expectedRevision: s.revision });
    ok(r);
    let input = '';
    const model = createSettlementNarrator({ async generateText(req) { input = req.input; return { text: JSON.stringify({ text: '獲得神器並復活隊友。' }) }; } });
    assert.equal((await model.narrate(r.settlementResult)).source, 'fallback');
    assert.equal(JSON.parse(input).facts.combatId, r.settlementResult.combatId);
    const session = createDomainSession(s), gate = deferred<{
        text: string;
        source: 'model';
    }>();
    const response = await createSettlementService(session, { narrate: () => gate.promise }, 1).settle({ expectedRevision: s.revision });
    ok(response);
    assert.equal(response.narration.status, 'saved');
    gate.resolve({ text: settlementFallback(r.settlementResult), source: 'model' });
    await gate.promise;
    assert.equal(phase26(session.getState()).history[0]!.source, 'fallback');
    assert.equal(phase26(session.getState()).history.length, 1);
});
test('Version 1 known TEST Save migrates without modifying original; missing world references and cross-run block', () => {
    const source = { slotId: 1 as const, formatVersion: 1, sourceRevision: 3, savedAt: new Date().toISOString(), snapshot: { activity: 'outside-combat', character: { id: 'TEST-character', learnedActiveSkillIds: [], equippedSkillIds: [] }, exploration: { locationId: 'TEST-forest-edge', lastObservationTargetId: null } } };
    const before = structuredClone(source), decoded = decodeSaveSnapshot(source);
    assert.equal(decoded.formatVersion, 2);
    assert.deepEqual(source, before);
    const current = createTestGameState();
    const loaded = replaceGameStateContents(current, 0, decoded.state);
    ok(loaded);
    assert.equal(loaded.state.revision, 1);
    assert.throws(() => decodeSaveSnapshot({ ...source, snapshot: { ...source.snapshot, character: { ...source.snapshot.character, id: 'unknown' } } }));
    assert.equal(replaceGameStateContents(current, 0, { ...decoded.state, phase26: { ...decoded.state.phase26!, runId: 'other-run' } }).ok, false);
});
test('Save preserves Entry identities and legacy-unplaced ordering; identity conflict rejects replacement', async () => {
    let state = createTestGameState();
    const legacy = { id: 'legacy-kept', type: 'system' as const, text: '原有文字', source: 'fallback' as const, category: 'legacy-unplaced' as const, sequence: null, sourceStateRevision: null, sourceCombatId: null };
    state = createGameState({ ...state, phase26: { ...phase26(state), history: [legacy], narrativeLedger: [legacy] } });
    const session = createDomainSession(state), token = await session.reserveNarrative('system');
    await session.appendNarrative(token!, '已排定事件', 'fallback');
    const saved = gameStateContents(session.getState());
    const loaded = await session.replaceContents(0, saved);
    ok(loaded);
    assert.deepEqual(phase26(loaded.state).history, saved.phase26!.history);
    const bad = { ...saved, phase26: { ...saved.phase26!, history: saved.phase26!.history.map(e => e.id === legacy.id ? { ...e, text: '竄改文字' } : e) } };
    assert.equal((await session.replaceContents(loaded.state.revision, bad)).ok, false);
});
test('Start preserves HP/MP; Combat blocks exploration/loadout, duplicate Start and injected settle facts', () => {
    const initial = createTestGameState(), p = phase26(initial);
    const depleted = createGameState({ ...initial, character: { ...initial.character, currentMp: 9 }, phase26: { ...p, characters: p.characters.map((c, i) => i === 0 ? { ...c, currentHp: 4, currentMp: 9 } : c) } });
    const s = battle(null, depleted);
    assert.equal(s.combat!.participants[0]!.health.currentHp, 4);
    assert.equal(s.combat!.participants[0]!.mp!.currentMp, 9);
    const session = createDomainSession(s);
    assert.equal(session.execute({ type: 'approach-target', expectedRevision: s.revision, targetId: 'TEST-ruin-entrance' }).ok, false);
    assert.equal(startCombat(s, { expectedRevision: s.revision }, PHASE22_TEST_COMBAT_PARTICIPANTS, createPhase22CombatFixtureRoller('normal')).ok, false);
    assert.equal(settleCombat(victory(), { expectedRevision: 3, hp: 999 }).ok, false);
});
test('API Continue returns exact commit snapshot, minimal intent, stable errors and both sandbox gate', async () => {
    const s = victory(), session = createDomainSession(s), app = await buildApp({ domainSession: session, domainSandbox: true, combatSandbox: true });
    try {
        const response = await app.inject({ method: 'POST', url: '/api/combat/settle', payload: { expectedRevision: s.revision } });
        assert.equal(response.statusCode, 200);
        assert.equal(isSettlementResponse(response.json()), true);
        const retry = await app.inject({ method: 'POST', url: '/api/combat/settle', payload: { expectedRevision: s.revision } });
        assert.equal(retry.statusCode, 409);
        assert.doesNotMatch(retry.body, /SELECT|UPDATE|Users\//);
    }
    finally {
        await app.close();
    }
    const disabled = await buildApp({ combatSandbox: true });
    try {
        assert.equal((await disabled.inject({ method: 'POST', url: '/api/dev/combat/reset', payload: { expectedRevision: 0 } })).statusCode, 404);
    }
    finally {
        await disabled.close();
    }
});
test('Frontend late state cannot regress, valid old history inserts without switching scene, old generation discarded', async () => {
    const s = victory(), session = createDomainSession(s), r = await createSettlementService(session).settle({ expectedRevision: s.revision });
    ok(r);
    assert.equal(r.narration.status, 'saved');
    const next = session.execute({ type: 'approach-target', expectedRevision: r.state.revision, targetId: 'TEST-ruin-entrance' });
    ok(next);
    const current = view(next.state);
    assert.deepEqual(acceptState(current, view(r.state)), current);
    if (r.narration.status === 'saved') {
        const clean = view(createGameState({ ...next.state, phase26: { ...phase26(next.state), history: [], narrativeLedger: [] } }));
        const inserted = acceptHistory(clean, phase26(next.state).runtimeGeneration, r.narration.entry)!;
        assert.equal(inserted.state.exploration.locationId, 'TEST-ruin-entrance');
        assert.equal(inserted.state.revision, next.state.revision);
        assert.equal(acceptHistory(clean, 'obsolete', r.narration.entry), clean);
    }
});
test('Frontend timeout never resends mutation; results show Continue and Game Over only offers recovery', async () => {
    let calls = 0;
    await assert.rejects(() => executeSettlement(3, (async () => { calls++; throw new Error('response lost'); }) as typeof fetch));
    assert.equal(calls, 1);
    for (const s of [victory(), damage(damage(battle(), 'TEST-companion-1', 8), 'TEST-player', 10)]) {
        const html = renderToStaticMarkup(createElement(CombatPage, { gameState: view(s), stateError: null, onStateUpdate: () => { }, onRetryState: async () => view(s) }));
        assert.match(html, /系統／存檔/);
        assert.match(html, /重新讀取/);
        if (s.combat!.endReason === 'party-defeat') {
            assert.match(html, /Game Over/);
            assert.doesNotMatch(html, />繼續<\/button>/);
        }
        else
            assert.match(html, />繼續<\/button>/);
    }
});
const pgOptions = { skip: !process.env.TEST_DATABASE_URL && '需要隔離 TEST_DATABASE_URL' };
async function isolatedDatabase() {
    const base = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL }), schema = `phase26_${randomUUID().replaceAll('-', '')}`;
    await base.query(`CREATE SCHEMA ${schema}`);
    await base.query(`CREATE TABLE ${schema}.game_states (LIKE public.game_states INCLUDING ALL)`);
    await base.query(`CREATE TABLE ${schema}.save_slots (LIKE public.save_slots INCLUDING ALL)`);
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}`, max: 6 });
    return { pool, schema, async close() { await pool.end(); await base.query(`DROP SCHEMA ${schema} CASCADE`); await base.end(); } };
}
test('PostgreSQL concurrent Settlement, restart, atomic callback/Load and allocator survive rewind', pgOptions, async () => {
    const db = await isolatedDatabase();
    try {
        const s = victory(battle('TEST-encounter-1')), repository = new PostgresGameStateRepository(db.pool), a = createPersistedDomainSession(repository, s), b = createPersistedDomainSession(new PostgresGameStateRepository(db.pool), s);
        await a.getState();
        const [x, y] = await Promise.all([a.settleCombat({ expectedRevision: s.revision }), b.settleCombat({ expectedRevision: s.revision })]);
        assert.deepEqual([x.ok, y.ok].sort(), [false, true]);
        const winner = x.ok ? x : y;
        ok(winner);
        await a.appendNarrative(winner.reservation!, settlementFallback(winner.settlementResult), 'fallback');
        const live = await a.getState();
        const restarted = new PostgresGameStateRepository(db.pool);
        assert.deepEqual(await restarted.load(s.character.id), live);
        const reset = await b.replaceContents(live.revision, gameStateContents(s));
        ok(reset);
        assert.equal((await a.appendNarrative(winner.reservation!, '舊世界不可寫入', 'model')).status, 'discarded');
        assert.equal(phase26(await a.getState()).history.length, 0);
        const replay = await createSettlementService(b).settle({ expectedRevision: reset.state.revision });
        ok(replay);
        assert.equal(replay.settlementResult.combatId, winner.settlementResult.combatId);
        assert.ok(phase26(await a.getState()).sequenceHighWater > winner.reservation!.sequence);
    }
    finally {
        await db.close();
    }
});
test('PostgreSQL History append and Save share a coherent cut; gameplay writes never overwrite History', pgOptions, async () => {
    const db = await isolatedDatabase();
    try {
        const seed = createTestGameState(), repository = new PostgresGameStateRepository(db.pool), session = createPersistedDomainSession(repository, seed);
        await session.getState();
        const token = await session.reserveNarrative('system');
        await session.appendNarrative(token!, '已保存事件', 'fallback');
        const staleSnapshot = createSaveSnapshot(seed), saveRepo = new PostgresSaveGameRepository(db.pool);
        // Same gameplay revision, newer persisted History: repository must capture live JSONB, not the stale argument.
        const saved = await saveRepo.writeIfLiveRevision(1, staleSnapshot, { characterId: seed.character.id, expectedRevision: 0 });
        assert.equal(decodeSaveSnapshot(saved!).state.phase26!.history.length, 1);
        const moved = await session.execute({ type: 'approach-target', expectedRevision: 0, targetId: 'TEST-ruin-entrance' });
        ok(moved);
        assert.equal(phase26(await session.getState()).history.length, 1);
        const save = createSaveGameService(saveRepo, session, 'postgres');
        await save.load(1, 1);
        assert.equal((await session.getState()).exploration.locationId, 'TEST-forest-edge');
        assert.equal(phase26(await session.getState()).history[0]!.id, token!.id);
    }
    finally {
        await db.close();
    }
});
test('PostgreSQL rollback leaves full ended Combat unchanged on persistence failure', pgOptions, async () => {
    const db = await isolatedDatabase();
    try {
        const s = victory(), repository = new PostgresGameStateRepository(db.pool), session = createPersistedDomainSession(repository, s);
        await session.getState();
        await db.pool.query(`ALTER TABLE game_states ADD CONSTRAINT test_no_transition CHECK (revision = ${s.revision})`);
        await assert.rejects(() => session.settleCombat({ expectedRevision: s.revision }));
        assert.deepEqual(await repository.load(s.character.id), s);
    }
    finally {
        await db.close();
    }
});
test('Explicit Character mapping supports different Companion participant IDs and preserves Party order', () => {
    const base = createTestGameState(), p = phase26(base), comp = p.characters[1]!;
    const seed = createGameState({ ...base, partyMembers: [...base.partyMembers, { id: 'TEST-companion-2', displayName: '第二位隊友', tacticPreferenceId: 'TEST-tactic-a' }],
        phase26: { ...p, characters: [...p.characters, { ...comp, characterId: 'TEST-companion-2', displayName: '第二位隊友' }] } });
    const roster = PHASE22_TEST_COMBAT_PARTICIPANTS.map(c => c.controlledBy === 'companion' ? { ...c, id: 'PARTICIPANT-one', characterId: 'TEST-companion-1' } : c);
    roster.push({ ...roster.find(c => c.controlledBy === 'companion')!, id: 'PARTICIPANT-two', characterId: 'TEST-companion-2' });
    const started = startCombat(seed, { expectedRevision: 0 }, roster, new SequenceD20Roller([10, 9, 8, 7, 6]));
    ok(started);
    const settled = settleCombat(victory(started.state), { expectedRevision: 3 });
    ok(settled);
    assert.deepEqual(settled.state.partyMembers.map(m => m.id), ['TEST-companion-1', 'TEST-companion-2']);
    assert.deepEqual(settled.settlementResult.partyResults.map(m => m.characterId), ['TEST-character', 'TEST-companion-1', 'TEST-companion-2']);
});
test('Timed-out client reads while original intent remains running; explicit retry commits at most once', async () => {
    const seed = victory(), session = createDomainSession(seed), gate = deferred<void>(), entered = deferred<void>();
    const original = (async () => { entered.resolve(); await gate.promise; return session.settleCombat({ expectedRevision: seed.revision }); })();
    await entered.promise;
    let requests = 0;
    await assert.rejects(() => executeSettlement(seed.revision, (async () => { requests++; throw new DOMException('timeout', 'TimeoutError'); }) as typeof fetch));
    assert.equal(requests, 1);
    assert.deepEqual(session.getState(), seed);
    const retry = await session.settleCombat({ expectedRevision: session.getState().revision });
    ok(retry);
    gate.resolve();
    const late = await original;
    assert.equal(late.ok, false);
    assert.equal(session.getState().revision, seed.revision + 1);
});
test('PostgreSQL pending AI coordinates with Load and Reset at controlled boundaries', pgOptions, async () => {
    const db = await isolatedDatabase();
    try {
        const seed = victory(), session = createPersistedDomainSession(new PostgresGameStateRepository(db.pool), seed);
        for (const replacement of ['load', 'reset'] as const) {
            const before = await session.getState();
            if (!before.combat) {
                const restored = await session.replaceContents(before.revision, gameStateContents(seed));
                ok(restored);
            }
            const ended = await session.getState(), entered = deferred<void>(), release = deferred<void>();
            const pending = createSettlementService(session, { async narrate(f) { entered.resolve(); await release.promise; return { text: settlementFallback(f), source: 'model' }; } }).settle({ expectedRevision: ended.revision });
            await entered.promise;
            const committed = await session.getState(), generation = phase26(committed).runtimeGeneration;
            const replaced = replacement === 'load' ? await session.replaceContents(committed.revision, gameStateContents(seed)) : await session.resetTest({ expectedRevision: committed.revision });
            ok(replaced);
            assert.notEqual(phase26(replaced.state).runtimeGeneration, generation);
            release.resolve();
            const result = await pending;
            ok(result);
            assert.equal(result.narration.status, 'discarded');
            assert.equal(phase26(await session.getState()).history.length, 0);
            assert.equal(phase26(await session.getState()).sequenceHighWater, phase26(committed).sequenceHighWater);
        }
    }
    finally {
        await db.close();
    }
});
test('PostgreSQL constraint rejects duplicate post-combat event independently of application guards', pgOptions, async () => {
    const db = await isolatedDatabase();
    try {
        const seed = victory(), session = createPersistedDomainSession(new PostgresGameStateRepository(db.pool), seed);
        const result = await createSettlementService(session).settle({ expectedRevision: seed.revision });
        ok(result);
        const state = await session.getState(), p = phase26(state), duplicate = { ...p.history[0]!, id: newIdentity(), sequence: p.sequenceHighWater + 1 };
        await assert.rejects(() => db.pool.query("UPDATE game_states SET snapshot=jsonb_set(snapshot,'{phase26,history}',$1::jsonb)", [JSON.stringify([...p.history, duplicate])]), { code: '23514' });
        assert.deepEqual(await session.getState(), state);
    }
    finally {
        await db.close();
    }
});
test('Commit snapshots cannot erase already delivered same-generation History; Load still restores exact snapshot', async () => {
    const session = createDomainSession(victory()), result = await session.settleCombat({ expectedRevision: 3 });
    ok(result);
    const saved = await session.appendNarrative(result.reservation!, settlementFallback(result.settlementResult), 'fallback');
    assert.equal(saved.status, 'saved');
    const withHistory = acceptHistory(view(result.state), phase26(result.state).runtimeGeneration, saved.status === 'saved' ? saved.entry : null!);
    const sameCommit = acceptState(withHistory, view(result.state));
    assert.equal(sameCommit.state.phase26!.history.length, 1);
    const loaded = await session.replaceContents(session.getState().revision, gameStateContents(result.state));
    ok(loaded);
    assert.equal(acceptState(sameCommit, view(loaded.state)).state.phase26!.history.length, 0);
});
test('PostgreSQL versioned legacy Save migration preserves the original row and blocks unknown ownership', pgOptions, async () => {
    const db = await isolatedDatabase();
    try {
        const seed = createTestGameState(), session = createPersistedDomainSession(new PostgresGameStateRepository(db.pool), seed);
        await session.getState();
        const legacy = { activity: 'outside-combat', character: seed.character, inventory: seed.inventory, exploration: seed.exploration };
        await db.pool.query("INSERT INTO save_slots(slot_id,format_version,source_revision,snapshot) VALUES(1,1,0,$1::jsonb)", [JSON.stringify(legacy)]);
        const original = (await db.pool.query('SELECT * FROM save_slots WHERE slot_id=1')).rows[0];
        const save = createSaveGameService(new PostgresSaveGameRepository(db.pool), session, 'postgres');
        const loaded = await save.load(1, 0);
        assert.equal(loaded.authoritative!.state.revision, 1);
        assert.equal(loaded.authoritative!.state.phase26!.schemaVersion, 2);
        assert.deepEqual((await db.pool.query('SELECT * FROM save_slots WHERE slot_id=1')).rows[0], original);
        const unknown = { ...legacy, character: { ...legacy.character, id: 'FORMAL-unknown' } };
        await db.pool.query("INSERT INTO save_slots(slot_id,format_version,source_revision,snapshot) VALUES(2,1,0,$1::jsonb)", [JSON.stringify(unknown)]);
        const before = await session.getState();
        await assert.rejects(() => save.load(2, before.revision), { code: 'migration-blocked' });
        assert.deepEqual(await session.getState(), before);
        assert.deepEqual((await db.pool.query('SELECT snapshot FROM save_slots WHERE slot_id=2')).rows[0].snapshot, unknown);
    }
    finally {
        await db.close();
    }
});
test('The same TEST API starts a second Combat with fresh initiative fixture and inherited resources', async (t) => {
    const session = createDomainSession(createTestGameState());
    let calls = 0;
    const app = await buildApp({ domainSession: session, domainSandbox: true, combatSandbox: true, combatRollerFactory: () => { calls++; return createPhase22CombatFixtureRoller('normal'); } });
    t.after(() => app.close());
    const post = (url: string, payload: Record<string, string | number>) => app.inject({ method: 'POST', url, payload });
    assert.equal((await post('/api/dev/combat/start', { expectedRevision: 0 })).statusCode, 200);
    for (const [targetId, amount] of [['TEST-player', 3], ['TEST-enemy-1', 6], ['TEST-enemy-2', 6]] as const)
        assert.equal((await post('/api/dev/combat/apply-damage', { expectedRevision: session.getState().revision, targetId, amount })).statusCode, 200);
    const oldId = session.getState().combat!.lifecycle!.combatId;
    assert.equal((await post('/api/combat/settle', { expectedRevision: 4 })).statusCode, 200);
    const next = await post('/api/dev/combat/start', { expectedRevision: 5 });
    assert.equal(next.statusCode, 200);
    assert.equal(next.json().state.combat.participants[0].health.currentHp, 7);
    assert.notEqual(next.json().state.combat.lifecycle.combatId, oldId);
    assert.equal(calls, 2);
});
