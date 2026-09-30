import { createGameState, type GameState, type ExplorationState } from './game.js';
import type { CombatState, CombatParticipant } from './combat-state.js';
export interface PersistentCharacter {
    readonly characterId: string;
    readonly displayName: string;
    readonly currentHp: number;
    readonly maxHp: number;
    readonly currentMp: number;
    readonly maxMp: number;
    readonly lifeState: 'active' | 'dead';
    readonly equipmentIds: readonly string[];
}
export type { NarrativeEntry } from "../shared/narrative.js";
import type { NarrativeEntry } from "../shared/narrative.js";
export { orderedHistory } from "../shared/narrative.js";
export interface Phase26State {
    readonly schemaVersion: 2;
    readonly runId: string;
    readonly worldId: string;
    readonly fixtureId: string | null;
    readonly runtimeGeneration: string;
    readonly sequenceHighWater: number;
    readonly characters: readonly PersistentCharacter[];
    readonly encounters: readonly {
        encounterId: string;
        displayName: string;
        worldId: string;
        resolved: boolean;
    }[];
    readonly history: readonly NarrativeEntry[];
    /** Immutable identity ledger survives History rewind; infrastructure is excluded from Save. */
    readonly narrativeLedger: readonly NarrativeEntry[];
}
export interface CombatLifecycle {
    readonly combatId: string;
    readonly runId: string;
    readonly worldId: string;
    readonly fixtureId: string | null;
    readonly sourceEncounterId: string | null;
    readonly returnExplorationContext: ExplorationState;
    readonly rewardEligibleOnVictory: boolean;
}
export const newIdentity = () => globalThis.crypto.randomUUID();
export function phase26(state: GameState): Phase26State {
    if (!state.phase26)
        throw new Error('缺少可驗證的長期角色與世界資料。');
    return state.phase26;
}
export function validResources(value: Pick<PersistentCharacter, 'currentHp' | 'maxHp' | 'currentMp' | 'maxMp'>): boolean {
    return Number.isSafeInteger(value.maxHp) && value.maxHp >= 1 && Number.isSafeInteger(value.currentHp)
        && value.currentHp >= 0 && value.currentHp <= value.maxHp && Number.isSafeInteger(value.maxMp)
        && value.maxMp >= 0 && Number.isSafeInteger(value.currentMp) && value.currentMp >= 0 && value.currentMp <= value.maxMp;
}
const id = (v: unknown): v is string => typeof v === 'string' && v.trim() === v && v.length > 0;
const exactKeys = (value: object, keys: readonly string[], optional: readonly string[] = []) => keys.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => keys.includes(k) || optional.includes(k));
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export function validatePhase26(state: GameState, p: Phase26State): void {
    if (!exactKeys(p, ['schemaVersion', 'runId', 'worldId', 'fixtureId', 'runtimeGeneration', 'sequenceHighWater', 'characters', 'encounters', 'history', 'narrativeLedger']) || p.schemaVersion !== 2 || !id(p.runId) || !id(p.worldId) || !id(p.runtimeGeneration)
        || !(p.fixtureId === null || id(p.fixtureId)) || !integer(p.sequenceHighWater)
        || !Array.isArray(p.characters) || !Array.isArray(p.encounters) || !Array.isArray(p.history) || !Array.isArray(p.narrativeLedger))
        throw new Error('長期資料格式不正確。');
    const unique = (ids: readonly string[]) => new Set(ids).size === ids.length;
    if (!unique(p.characters.map(c => c.characterId)) || !unique(p.encounters.map(e => e.encounterId)))
        throw new Error('識別碼重複。');
    for (const c of p.characters)
        if (!exactKeys(c, ['characterId', 'displayName', 'currentHp', 'maxHp', 'currentMp', 'maxMp', 'lifeState', 'equipmentIds']) || !id(c.characterId) || !id(c.displayName) || !validResources(c)
            || !(c.lifeState === 'active' && c.currentHp > 0 || c.lifeState === 'dead' && c.currentHp === 0)
            || !Array.isArray(c.equipmentIds) || !c.equipmentIds.every(id))
            throw new Error('長期角色資源不合法。');
    const player = p.characters.find(c => c.characterId === state.character.id);
    if (!player || player.currentMp !== state.character.currentMp)
        throw new Error('玩家長期資源不一致。');
    const partyIds = [state.character.id, ...state.partyMembers.map(m => m.id)];
    if (!unique(partyIds) || partyIds.some(i => !p.characters.some(c => c.characterId === i && c.lifeState === 'active')))
        throw new Error('隊伍引用不合法。');
    for (const e of p.encounters)
        if (!exactKeys(e, ['encounterId', 'displayName', 'worldId', 'resolved']) || !id(e.encounterId) || !id(e.displayName) || e.worldId !== p.worldId || typeof e.resolved !== 'boolean')
            throw new Error('遭遇引用不合法。');
    for (const entries of [p.history, p.narrativeLedger]) {
        if (!unique(entries.map(e => e.id)))
            throw new Error('敘事識別碼重複。');
        const sequences: number[] = [];
        const events: string[] = [];
        for (const e of entries) {
            if (!exactKeys(e, ['id', 'type', 'text', 'source', 'category', 'sequence', 'sourceStateRevision', 'sourceCombatId'], ['placementRevision']) || !id(e.id) || !id(e.text) || Array.from(e.text).length > 2000 || !['post-combat', 'exploration', 'system', 'tutorial', 'meta'].includes(e.type)
                || !['model', 'fallback'].includes(e.source) || !(e.sourceCombatId === null || id(e.sourceCombatId)))
                throw new Error('敘事資料不合法。');
            if (e.category === 'legacy-unplaced') {
                if (e.sequence !== null && !integer(e.sequence) || e.sourceStateRevision !== null || e.placementRevision !== undefined)
                    throw new Error('舊版紀錄位置不合法。');
            }
            else if (e.category === 'placed') {
                if (!integer(e.sequence) || e.sequence < 1 || e.sequence > p.sequenceHighWater)
                    throw new Error('敘事序號不合法。');
                sequences.push(e.sequence);
                if (e.type === 'post-combat' || e.type === 'exploration') {
                    if (!integer(e.sourceStateRevision) || e.placementRevision !== undefined || e.type === 'post-combat' && !id(e.sourceCombatId))
                        throw new Error('敘事來源不合法。');
                }
                else if (e.sourceStateRevision !== null || !integer(e.placementRevision))
                    throw new Error('敘事位置不合法。');
            }
            else
                throw new Error('敘事分類不合法。');
            if (e.type === 'post-combat')
                events.push(`${e.sourceCombatId}:${e.sourceStateRevision}`);
        }
        if (!unique(sequences.map(String)) || !unique(events))
            throw new Error('敘事事件重複。');
    }
    for (const e of p.history) {
        const known = p.narrativeLedger.find(k => k.id === e.id);
        if (!known || canonicalEntry(known) !== canonicalEntry(e))
            throw new Error('敘事身分衝突。');
    }
    if (state.combat?.lifecycle)
        validateCombatReferences(state);
}
export const canonicalEntry = (e: NarrativeEntry) => JSON.stringify([e.id, e.type, e.text, e.source, e.category, e.sequence, e.sourceStateRevision, e.placementRevision ?? null, e.sourceCombatId]);
export function validateCombatReferences(state: GameState): void {
    const p = phase26(state), combat = state.combat, l = combat?.lifecycle;
    if (!combat || !l || !id(l.combatId) || l.runId !== p.runId || l.worldId !== p.worldId || l.fixtureId !== p.fixtureId
        || typeof l.rewardEligibleOnVictory !== 'boolean' || p.fixtureId !== null && l.rewardEligibleOnVictory
        || !(l.sourceEncounterId === null || id(l.sourceEncounterId))
        || !l.returnExplorationContext || !['TEST-forest-edge', 'TEST-ruin-entrance'].includes(l.returnExplorationContext.locationId)
        || !(l.returnExplorationContext.lastObservationTargetId === null || l.returnExplorationContext.lastObservationTargetId === 'TEST-stone-door'))
        throw new Error('戰鬥世界引用不合法。');
    if (l.sourceEncounterId !== null && !p.encounters.some(e => e.encounterId === l.sourceEncounterId && e.worldId === p.worldId && !e.resolved))
        throw new Error('來源遭遇無法結算。');
    const expected = [state.character.id, ...state.partyMembers.map(m => m.id)];
    const members = combat.participants.filter(c => c.side === 'party');
    if (members.length !== expected.length || new Set(members.map(c => c.characterId)).size !== members.length
        || expected.some(i => !members.some(c => c.characterId === i))
        || members.filter(c => c.characterId === state.character.id && c.controlledBy !== 'companion').length !== 1
        || members.some(c => c.characterId !== state.character.id && c.controlledBy !== 'companion' || !c.mp || !p.characters.some(r => r.characterId === c.characterId)))
        throw new Error('戰鬥與長期隊伍映射不完整。');
    for (const c of members) {
        const record = p.characters.find(r => r.characterId === c.characterId)!;
        const adjustment = c.capacityAdjustment;
        if (adjustment && (p.fixtureId !== 'phase26-test-v1' || adjustment.ruleId !== 'TEST-temporary-capacity'
            || !Number.isSafeInteger(adjustment.hpDelta) || !Number.isSafeInteger(adjustment.mpDelta)))
            throw new Error('缺少正式 capacity modifier 規則。');
        if (c.health.maxHp !== record.maxHp + (adjustment?.hpDelta ?? 0) || c.mp!.maxMp !== record.maxMp + (adjustment?.mpDelta ?? 0))
            throw new Error('戰鬥資源上限缺少合法來源。');
    }
    if (combat.participants.some(c => c.side === 'enemy' && c.characterId !== null))
        throw new Error('敵方不能映射長期角色。');
}
export function migrateKnownTest(state: GameState): Phase26State | undefined {
    if (state.character.id !== 'TEST-character')
        return undefined;
    if (state.partyMembers.some(m => m.id !== 'TEST-companion-1'))
        throw new Error('舊版隊伍缺少可驗證角色資源。');
    return {
        schemaVersion: 2, runId: 'TEST-run-v1', worldId: 'TEST-world-v1', fixtureId: 'phase26-test-v1',
        runtimeGeneration: 'legacy-TEST-generation-v1', sequenceHighWater: 0,
        characters: [{ characterId: state.character.id, displayName: 'TEST 玩家', maxHp: 10, currentHp: 10,
                maxMp: 24, currentMp: state.character.currentMp, lifeState: 'active', equipmentIds: [] },
            ...state.partyMembers.map(m => ({ characterId: m.id, displayName: m.displayName, maxHp: 8, currentHp: 8,
                maxMp: 0, currentMp: 0, lifeState: 'active' as const, equipmentIds: [] }))],
        encounters: [{ encounterId: 'TEST-encounter-1', displayName: 'TEST 遭遇', worldId: 'TEST-world-v1', resolved: false }], history: [], narrativeLedger: [],
    };
}
export type ResourcesResult = Pick<PersistentCharacter, 'currentHp' | 'maxHp' | 'currentMp' | 'maxMp'> & {
    readonly lifeState: 'active' | 'dying' | 'dead';
    readonly activePartyMember: boolean;
};
export interface SettlementResult {
    readonly combatId: string;
    readonly settlementRevision: number;
    readonly result: 'victory' | 'escaped';
    readonly rewardEligible: boolean;
    readonly partyResults: readonly {
        characterId: string;
        displayName: string;
        before: ResourcesResult;
        after: ResourcesResult;
    }[];
    readonly enemyResults: readonly {
        participantId: string;
        displayName: string;
        finalLifeState: string;
        currentHp: number;
        maxHp: number;
        currentMp?: number;
        maxMp?: number;
    }[];
    readonly encounterResult: {
        encounterId: string;
        displayName: string;
        before: {
            resolved: boolean;
        };
        after: {
            resolved: boolean;
        };
    } | null;
    readonly returnExplorationContext: ExplorationState & {
        displayName: string;
    };
    readonly lastConfirmedCombatAction: {
        actionType: string;
        actor: {
            id: string;
            displayName: string;
        };
        targets: readonly {
            id: string;
            displayName: string;
        }[];
        confirmedOutcome: unknown;
    } | null;
}
export type SettlementTransition = {
    ok: true;
    state: GameState;
    settlementResult: SettlementResult;
} | {
    ok: false;
    code: 'invalid-command' | 'stale-revision' | 'revision-limit' | 'not-settleable' | 'integrity-conflict';
    message: string;
};
export function settleCombat(state: GameState, input: unknown): SettlementTransition {
    const fail = (code: Extract<SettlementTransition, {
        ok: false;
    }>['code']): SettlementTransition => ({ ok: false, code, message: code === 'stale-revision' ? '狀態已更新，請重新讀取。' : '目前戰鬥無法安全結算，請重新讀取或載入健康存檔。' });
    if (!input || typeof input !== 'object' || Object.keys(input).length !== 1 || !('expectedRevision' in input)
        || !integer(input.expectedRevision))
        return fail('invalid-command');
    if (input.expectedRevision !== state.revision)
        return fail('stale-revision');
    if (state.revision === Number.MAX_SAFE_INTEGER)
        return fail('revision-limit');
    const combat = state.combat;
    if (!combat || combat.status !== 'ended' || combat.endReason === 'party-defeat')
        return fail('not-settleable');
    try {
        createGameState(state);
        validateCombatReferences(state);
        const p = phase26(state), l = combat.lifecycle!;
        const party = combat.participants.filter(c => c.side === 'party');
        if (party.some(c => c.characterId === state.character.id && c.health.lifeState === 'dead') || !party.some(c => c.health.lifeState === 'active')
            || combat.endReason === 'victory' && combat.participants.some(c => c.side === 'enemy' && c.health.lifeState !== 'dead'))
            return fail('integrity-conflict');
        const order = [state.character.id, ...state.partyMembers.map(m => m.id)];
        const characters = p.characters.map(c => {
            const participant = party.find(m => m.characterId === c.characterId);
            if (!participant)
                return c;
            return { ...c, currentHp: Math.min(c.maxHp, participant.health.lifeState === 'dying' ? 1 : participant.health.currentHp),
                currentMp: Math.min(c.maxMp, participant.mp!.currentMp), lifeState: participant.health.lifeState === 'dead' ? 'dead' as const : 'active' as const };
        });
        const partyMembers = state.partyMembers.filter(m => characters.find(c => c.characterId === m.id)!.lifeState === 'active');
        const encounter = l.sourceEncounterId === null ? null : p.encounters.find(e => e.encounterId === l.sourceEncounterId)!;
        const encounters = p.encounters.map(e => e === encounter && combat.endReason === 'victory' ? { ...e, resolved: true } : e);
        const next = createGameState({ ...state, revision: state.revision + 1, activity: 'outside-combat', combat: null,
            character: { ...state.character, currentMp: characters.find(c => c.characterId === state.character.id)!.currentMp }, partyMembers,
            exploration: l.returnExplorationContext, phase26: { ...p, characters, encounters } });
        const action = combat.lastAction;
        const label = (i: string) => { const c = combat.participants.find(c => c.id === i)!; return { id: i, displayName: c.displayName }; };
        const result: SettlementResult = {
            combatId: l.combatId, settlementRevision: next.revision, result: combat.endReason,
            rewardEligible: combat.endReason === 'victory' && l.rewardEligibleOnVictory,
            partyResults: order.map(i => {
                const c = characters.find(c => c.characterId === i)!, m = party.find(m => m.characterId === i)!;
                return { characterId: i, displayName: c.displayName, before: { currentHp: m.health.currentHp, maxHp: m.health.maxHp, ...m.mp!, lifeState: m.health.lifeState, activePartyMember: true },
                    after: { currentHp: c.currentHp, maxHp: c.maxHp, currentMp: c.currentMp, maxMp: c.maxMp, lifeState: c.lifeState, activePartyMember: i === state.character.id || partyMembers.some(m => m.id === i) } };
            }),
            enemyResults: combat.participants.filter(c => c.side === 'enemy').map(c => ({ participantId: c.id, displayName: c.displayName, finalLifeState: c.health.lifeState, currentHp: c.health.currentHp, maxHp: c.health.maxHp, ...c.mp })),
            encounterResult: encounter ? { encounterId: encounter.encounterId, displayName: encounter.displayName, before: { resolved: encounter.resolved }, after: { resolved: combat.endReason === 'victory' } } : null,
            returnExplorationContext: { ...l.returnExplorationContext, displayName: l.returnExplorationContext.locationId === 'TEST-forest-edge' ? 'TEST 森林邊緣' : 'TEST 廢墟入口' },
            lastConfirmedCombatAction: action ? { actionType: action.type, actor: label(action.actorId), targets: 'targetId' in action ? [label(action.targetId)] : action.type === 'dragon-breath' ? action.results.map(r => label(r.targetId)) : [], confirmedOutcome: 'outcome' in action ? action.outcome : action.type === 'dragon-breath' ? action.results.map(r => ({ targetId: r.targetId, outcome: r.outcome, critical: r.critical })) : action.type === 'rescue' ? { currentHp: 1, lifeState: 'active' } : action.type === 'item-use' ? { itemId: action.itemId, quantityAfter: action.quantityAfter } : action.type.startsWith('casting-') ? { type: action.type } : { type: action.type } } : null,
        };
        return { ok: true, state: next, settlementResult: result };
    }
    catch {
        return fail('integrity-conflict');
    }
}
/** Domain support only; no new player command or permanent capacity mechanic is introduced. */
export function changePermanentCapacity(state: GameState, expectedRevision: number, characterId: string, maxHp: number, maxMp: number): SettlementTransition | {
    ok: true;
    state: GameState;
} {
    const fail = () => ({ ok: false as const, code: 'integrity-conflict' as const, message: '資源上限變更不符合已支援規則。' });
    if (expectedRevision !== state.revision)
        return { ok: false, code: 'stale-revision', message: '狀態已更新，請重新讀取。' };
    if (state.revision === Number.MAX_SAFE_INTEGER)
        return fail();
    try {
        createGameState(state);
        const p = phase26(state), before = p.characters.find(c => c.characterId === characterId);
        if (!before || !Number.isSafeInteger(maxHp) || maxHp < 1 || !integer(maxMp))
            return fail();
        const after = { ...before, maxHp, maxMp, currentHp: Math.min(before.currentHp, maxHp), currentMp: Math.min(before.currentMp, maxMp) };
        const combat = state.combat ? { ...state.combat, participants: state.combat.participants.map(c => {
                if (c.characterId !== characterId)
                    return c;
                const hp = maxHp + (c.capacityAdjustment?.hpDelta ?? 0), mp = maxMp + (c.capacityAdjustment?.mpDelta ?? 0);
                if (hp < 1 || mp < 0)
                    throw new Error('不支援生命狀態轉換。');
                return { ...c, health: { ...c.health, maxHp: hp, currentHp: Math.min(c.health.currentHp, hp) }, mp: { currentMp: Math.min(c.mp!.currentMp, mp), maxMp: mp } };
            }) } : null;
        return { ok: true, state: createGameState({ ...state, revision: state.revision + 1, combat,
                character: characterId === state.character.id ? { ...state.character, currentMp: after.currentMp } : state.character,
                phase26: { ...p, characters: p.characters.map(c => c === before ? after : c) } }) };
    }
    catch {
        return fail();
    }
}
