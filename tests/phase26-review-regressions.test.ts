import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SaveSlotsPanel } from '../src/web/SaveSlotsPanel.js';
import { isSaveSlotsResponse, isSaveOperationResponse } from '../src/shared/save-game.js';
import { applyCommand, createGameState, type GameState } from '../src/domain/game.js';
import { advanceCombatTurn, startCasting, startCombat } from '../src/domain/combat.js';
import { createTestGameState } from '../src/server/test-game-state.js';
import { PHASE22_TEST_COMBAT_PARTICIPANTS } from '../src/server/combat/fixtures.js';
import { createPhase22CombatFixtureRoller } from '../src/server/combat/dice.js';
import { createDomainSession, createPersistedDomainSession } from '../src/server/domain-session.js';
import { buildApp } from '../src/server/app.js';
import { hydrateStateRow, PostgresGameStateRepository } from '../src/server/postgres-game-state-repository.js';
import { createSaveSnapshot, createSaveGameService } from '../src/server/save-game/service.js';
import { PostgresSaveGameRepository } from '../src/server/save-game/postgres-repository.js';
import type { SaveGameRepository, StoredSaveSlot } from '../src/server/save-game/contracts.js';
function success<T extends {
    ok: boolean;
}>(value: T): asserts value is Extract<T, {
    ok: true;
}> { assert.equal(value.ok, true, JSON.stringify(value)); }
function castingState(): GameState {
    const equipped = applyCommand(createTestGameState(), { type: 'set-equipped-skills', skillIds: ['TEST-skill-2'], expectedRevision: 0 });
    success(equipped);
    const started = startCombat(equipped.state, { expectedRevision: 1 }, PHASE22_TEST_COMBAT_PARTICIPANTS, createPhase22CombatFixtureRoller('normal'));
    success(started);
    const advanced = advanceCombatTurn(started.state, { expectedRevision: 2 });
    success(advanced);
    const casting = startCasting(advanced.state, { expectedRevision: 3, skillId: 'TEST-skill-2' });
    success(casting);
    return casting.state;
}
function legacyEndedSnapshot() {
    const s = castingState(), { revision, phase26, ...snapshot } = s;
    const { lifecycle, ...combat } = s.combat!;
    return { character_id: s.character.id, revision: String(revision + 2), snapshot: { ...snapshot, character: { ...s.character, currentMp: 18 }, combat: { ...combat, status: 'ended', endReason: 'victory', currentActorId: null, currentTurnIndex: null,
                participants: combat.participants.map(({ characterId, mp, capacityAdjustment, ...p }) => p.side === 'enemy' ? { ...p, health: { ...p.health, currentHp: 0, lifeState: 'dead', dyingTurnsRemaining: null } } : p) } } };
}
test('H1: ending victory during casting clears casting without refund and writes MP on Continue', async (t) => {
    const session = createDomainSession(castingState()), app = await buildApp({ domainSession: session, domainSandbox: true, combatSandbox: true });
    t.after(() => app.close());
    for (const targetId of ['TEST-enemy-1', 'TEST-enemy-2']) {
        const response = await app.inject({ method: 'POST', url: '/api/dev/combat/apply-damage', payload: { expectedRevision: session.getState().revision, targetId, amount: 6 } });
        assert.equal(response.statusCode, 200, response.body);
    }
    const ended = session.getState();
    assert.equal(ended.combat!.status, 'ended');
    assert.deepEqual(ended.combat!.activeCastings, []);
    assert.equal(ended.combat!.participants[0]!.mp!.currentMp, 18);
    assert.equal(ended.character.currentMp, 24);
    const settled = await app.inject({ method: 'POST', url: '/api/combat/settle', payload: { expectedRevision: ended.revision } });
    assert.equal(settled.statusCode, 200, settled.body);
    assert.equal(settled.json().state.character.currentMp, 18);
});
test('M1: known legacy ended casting snapshot hydrates without refund or source mutation', async (t) => {
    const row = legacyEndedSnapshot(), original = structuredClone(row);
    const repository = { async load() { return hydrateStateRow(row); }, async createIfAbsent() { return hydrateStateRow(row); }, async saveIfRevision() { return false; } };
    const app = await buildApp({ domainRepository: repository, domainSandbox: true, combatSandbox: true });
    t.after(() => app.close());
    const response = await app.inject('/api/game-state');
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json().state.combat.activeCastings, []);
    assert.equal(response.json().state.combat.participants[0].mp.currentMp, 18);
    assert.equal(response.json().state.revision, Number(row.revision));
    assert.deepEqual(row, original);
});
test('M2: one migration-blocked slot cannot hide the healthy slot or prevent its Load', async (t) => {
    const session = createDomainSession(createTestGameState()), good = createSaveSnapshot(session.getState());
    const records: StoredSaveSlot[] = [{ slotId: 1, formatVersion: 2, sourceRevision: 0, snapshot: good.state, savedAt: '2026-09-30T00:00:00Z' },
        { slotId: 2, formatVersion: 1, sourceRevision: 0, snapshot: { activity: 'outside-combat', character: { ...session.getState().character, id: 'FORMAL-legacy' }, inventory: session.getState().inventory, exploration: session.getState().exploration }, savedAt: '2026-09-30T00:00:00Z' }];
    const original = structuredClone(records);
    const saves: SaveGameRepository = { async list() { return records; }, async read(id) { return records.find(r => r.slotId === id); }, async writeIfLiveRevision() { throw new Error('not used'); } };
    const app = await buildApp({ domainSession: session, saveGameRepository: saves });
    t.after(() => app.close());
    const list = await app.inject('/api/save-slots');
    assert.equal(list.statusCode, 200, list.body);
    assert.equal(list.json().slots[0].slotId, 1);
    assert.equal(list.json().slots[0].empty, false);
    assert.equal(list.json().slots[1].issue, 'migration-blocked');
    assert.equal(list.json().slots[1].loadable, false);
    const loaded = await app.inject({ method: 'POST', url: '/api/save-slots/1/load', payload: { expectedRevision: 0 } });
    assert.equal(loaded.statusCode, 200, loaded.body);
    assert.equal(session.getState().revision, 1);
    assert.deepEqual(records, original);
});
test('L1: v2 Load cannot establish unknown legacy-unplaced identities', async (t) => {
    const session = createDomainSession(createTestGameState()), snapshot = createSaveSnapshot(session.getState());
    const injected = { ...snapshot.state, phase26: { ...snapshot.state.phase26!, history: [{ id: 'unproven-legacy', type: 'exploration', text: '未知來源的舊文字', source: 'model', category: 'legacy-unplaced', sequence: null, sourceStateRevision: null, sourceCombatId: null }] } };
    const record: StoredSaveSlot = { slotId: 1, formatVersion: 2, sourceRevision: 0, snapshot: injected, savedAt: '2026-09-30T00:00:00Z' };
    const saves: SaveGameRepository = { async list() { return [record]; }, async read() { return record; }, async writeIfLiveRevision() { throw new Error('not used'); } };
    const app = await buildApp({ domainSession: session, saveGameRepository: saves });
    t.after(() => app.close());
    const original = session.getState(), loaded = await app.inject({ method: 'POST', url: '/api/save-slots/1/load', payload: { expectedRevision: 0 } });
    assert.equal(loaded.statusCode, 422, loaded.body);
    assert.deepEqual(session.getState(), original);
});
test('M1: version mapping rejects malformed casting and unknown rosters; v2 remains strict', () => {
    const original = legacyEndedSnapshot();
    for (const change of ['mp', 'actor', 'roster', 'extension']) {
        const row = structuredClone(original);
        if (change === 'mp')
            row.snapshot.combat.activeCastings = row.snapshot.combat.activeCastings.map(e => ({ ...e, mpSpent: 5 }));
        if (change === 'actor')
            row.snapshot.combat.activeCastings = row.snapshot.combat.activeCastings.map(e => ({ ...e, actorId: 'missing' }));
        if (change === 'roster')
            row.snapshot.combat.participants[0] = { ...row.snapshot.combat.participants[0]!, displayName: '未知玩家' };
        if (change === 'extension')
            Object.assign(row.snapshot.combat.participants[0]!, { mp: { currentMp: 18, maxMp: 24 }, characterId: 'TEST-character' });
        assert.throws(() => hydrateStateRow(row), change);
    }
    const active = castingState();
    assert.throws(() => createGameState({ ...active, combat: { ...active.combat, status: 'ended', endReason: 'victory', currentActorId: null, currentTurnIndex: null,
            participants: active.combat!.participants.map(p => p.side === 'enemy' ? { ...p, health: { ...p.health, currentHp: 0, lifeState: 'dead', dyingTurnsRemaining: null } } : p) } }));
});
test('M2: corrupt and future slots remain isolated in API, runtime contract and panel markup', async (t) => {
    const session = createDomainSession(createTestGameState()), good = createSaveSnapshot(session.getState());
    const records: StoredSaveSlot[] = [{ slotId: 1, formatVersion: 2, sourceRevision: 0, snapshot: good.state, savedAt: '2026-09-30T00:00:00Z' },
        { slotId: 2, formatVersion: 2, sourceRevision: 0, snapshot: {}, savedAt: '2026-09-30T00:00:00Z' },
        { slotId: 3, formatVersion: 999, sourceRevision: 0, snapshot: {}, savedAt: '2026-09-30T00:00:00Z' }];
    const saves: SaveGameRepository = { async list() { return records; }, async read(id) { return records.find(r => r.slotId === id); }, async writeIfLiveRevision() { throw new Error('not used'); } };
    const app = await buildApp({ domainSession: session, saveGameRepository: saves });
    t.after(() => app.close());
    const response = await app.inject('/api/save-slots'), body = response.json();
    assert.equal(response.statusCode, 200);
    assert.equal(isSaveSlotsResponse(body), true);
    assert.equal(body.slots[1].issue, 'invalid-save');
    assert.equal(body.slots[2].issue, 'unsupported-format');
    assert.equal(isSaveOperationResponse({ slot: body.slots[1], state: { revision: 0, locationId: 'TEST-forest-edge', lastObservationTargetId: null, storage: 'memory' } }), false);
    const markup = renderToStaticMarkup(createElement(SaveSlotsPanel, { slots: body.slots, loading: false, busySlotId: null, feedback: '', confirmation: null, onSave() { }, onLoad() { }, onConfirm() { }, onCancel() { } }));
    assert.equal((markup.match(/>載入</g) ?? []).length, 1);
    assert.equal((markup.match(/無法載入/g) ?? []).length, 2);
    assert.match(markup, /原存檔仍保留/);
    assert.doesNotMatch(markup, /undefined/);
    for (const slotId of [2, 3]) {
        const result = await app.inject({ method: 'POST', url: `/api/save-slots/${slotId}/load`, payload: { expectedRevision: 0 } });
        assert.equal(result.statusCode, 422);
        assert.equal(session.getState().revision, 0);
    }
});
const pgOptions = { skip: !process.env.TEST_DATABASE_URL && '需提供隔離 TEST_DATABASE_URL。' };
async function isolatedSchema() {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    assert.ok(url.pathname.startsWith('/ai_trpg_phase26_'), '只能使用 Phase 26 隔離測試資料庫。');
    const base = new pg.Pool({ connectionString: url.href }), schema = `phase26_review_${randomUUID().replaceAll('-', '')}`;
    await base.query(`CREATE SCHEMA ${schema}`);
    await base.query(`CREATE TABLE ${schema}.game_states (LIKE public.game_states INCLUDING ALL)`);
    await base.query(`CREATE TABLE ${schema}.save_slots (LIKE public.save_slots INCLUDING ALL)`);
    const pool = new pg.Pool({ connectionString: url.href, options: `-c search_path=${schema},public`, max: 4 });
    return { pool, async close() { await pool.end(); await base.query(`DROP SCHEMA ${schema} CASCADE`); await base.end(); } };
}
test('PostgreSQL H1: ended casting Save/Load/restart and Settlement retain spent MP for next Start', pgOptions, async () => {
    const db = await isolatedSchema();
    let app: Awaited<ReturnType<typeof buildApp>> | undefined;
    try {
        const repository = new PostgresGameStateRepository(db.pool), session = createPersistedDomainSession(repository, castingState());
        const saves = new PostgresSaveGameRepository(db.pool);
        app = await buildApp({ domainSession: session, saveGameRepository: saves, domainSandbox: true, combatSandbox: true });
        for (const targetId of ['TEST-enemy-1', 'TEST-enemy-2']) {
            const state: GameState = await session.getState();
            const result: {
                statusCode: number;
                body: string;
            } = await app.inject({ method: 'POST', url: '/api/dev/combat/apply-damage', payload: { expectedRevision: state.revision, targetId, amount: 6 } });
            assert.equal(result.statusCode, 200, result.body);
        }
        const ended = await session.getState(), service = createSaveGameService(saves, session, 'postgres');
        await service.save(1, ended.revision);
        const restarted = createPersistedDomainSession(new PostgresGameStateRepository(db.pool), createTestGameState());
        assert.deepEqual(await restarted.getState(), ended);
        const loaded = await createSaveGameService(saves, restarted, 'postgres').load(1, ended.revision);
        assert.deepEqual(loaded.authoritative!.state.combat!.activeCastings, []);
        assert.equal(loaded.authoritative!.state.combat!.participants[0]!.mp!.currentMp, 18);
        const settled = await restarted.settleCombat({ expectedRevision: loaded.state.revision });
        success(settled);
        assert.equal(settled.state.character.currentMp, 18);
        assert.equal(settled.state.revision, loaded.state.revision + 1);
        const next = startCombat(settled.state, { expectedRevision: settled.state.revision }, PHASE22_TEST_COMBAT_PARTICIPANTS, createPhase22CombatFixtureRoller('normal'));
        success(next);
        assert.equal(next.state.combat!.participants[0]!.mp!.currentMp, 18);
        assert.notEqual(next.state.combat!.lifecycle!.combatId, ended.combat!.lifecycle!.combatId);
        assert.equal((await new PostgresGameStateRepository(db.pool).load('TEST-character'))!.character.currentMp, 18);
    }
    finally {
        await app?.close();
        await db.close();
    }
});
test('PostgreSQL M1: upgrade known ended casting once, keep revision/MP and persist stable identity', pgOptions, async () => {
    const db = await isolatedSchema();
    let app: Awaited<ReturnType<typeof buildApp>> | undefined;
    try {
        const row = legacyEndedSnapshot(), original = structuredClone(row);
        await db.pool.query('INSERT INTO game_states(character_id,revision,snapshot) VALUES($1,$2,$3::jsonb)', [row.character_id, row.revision, JSON.stringify(row.snapshot)]);
        app = await buildApp({ domainRepository: new PostgresGameStateRepository(db.pool), domainSandbox: true, combatSandbox: true });
        const response = await app.inject('/api/game-state');
        assert.equal(response.statusCode, 200, response.body);
        const migrated = response.json().state;
        assert.equal(migrated.revision, Number(row.revision));
        assert.equal(migrated.character.currentMp, 18);
        assert.deepEqual(migrated.combat.activeCastings, []);
        const restarted = createPersistedDomainSession(new PostgresGameStateRepository(db.pool), createTestGameState());
        assert.deepEqual(await restarted.getState(), migrated);
        assert.deepEqual(row, original);
        const settled = await restarted.settleCombat({ expectedRevision: migrated.revision });
        success(settled);
        assert.equal(settled.state.character.currentMp, 18);
    }
    finally {
        await app?.close();
        await db.close();
    }
});
test('PostgreSQL M2: healthy v2 and blocked v1 coexist; list/healthy Load never rewrite blocked source', pgOptions, async () => {
    const db = await isolatedSchema();
    let app: Awaited<ReturnType<typeof buildApp>> | undefined;
    try {
        const session = createPersistedDomainSession(new PostgresGameStateRepository(db.pool), createTestGameState()), saves = new PostgresSaveGameRepository(db.pool);
        const initial = await session.getState();
        await createSaveGameService(saves, session, 'postgres').save(1, initial.revision);
        const unknown = { activity: 'outside-combat', character: { ...initial.character, id: 'FORMAL-legacy' }, inventory: initial.inventory, exploration: initial.exploration };
        await db.pool.query('INSERT INTO save_slots(slot_id,format_version,source_revision,snapshot) VALUES(3,1,0,$1::jsonb)', [JSON.stringify(unknown)]);
        const before = (await db.pool.query('SELECT * FROM save_slots WHERE slot_id=3')).rows[0];
        app = await buildApp({ domainSession: session, saveGameRepository: saves });
        const response = await app.inject('/api/save-slots');
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.json().slots[2].issue, 'migration-blocked');
        const loaded = await app.inject({ method: 'POST', url: '/api/save-slots/1/load', payload: { expectedRevision: initial.revision } });
        assert.equal(loaded.statusCode, 200, loaded.body);
        assert.equal(loaded.json().state.revision, initial.revision + 1);
        assert.deepEqual((await db.pool.query('SELECT * FROM save_slots WHERE slot_id=3')).rows[0], before);
    }
    finally {
        await app?.close();
        await db.close();
    }
});
