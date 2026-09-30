import { createGameState, type GameState } from '../domain/game.js';
import { phase26, newIdentity, type NarrativeEntry } from '../domain/settlement.js';
export interface NarrativeReservation {
    readonly id: string;
    readonly runId: string;
    readonly generation: string;
    readonly sequence: number;
    readonly sourceStateRevision: number | null;
    readonly placementRevision?: number;
    readonly type: NarrativeEntry['type'];
    readonly sourceCombatId: string | null;
}
export function reserve(state: GameState, type: NarrativeEntry['type'], sourceCombatId: string | null = null) {
    const p = phase26(state);
    if (p.sequenceHighWater === Number.MAX_SAFE_INTEGER)
        return { state };
    const gameplay = type === 'post-combat' || type === 'exploration';
    const reservation: NarrativeReservation = { id: newIdentity(), runId: p.runId, generation: p.runtimeGeneration,
        sequence: p.sequenceHighWater + 1, sourceStateRevision: gameplay ? state.revision : null,
        ...(!gameplay ? { placementRevision: state.revision } : {}), type, sourceCombatId };
    return { state: createGameState({ ...state, phase26: { ...p, sequenceHighWater: reservation.sequence } }), reservation };
}
export type AppendOutcome = {
    status: 'saved';
    entry: NarrativeEntry;
} | {
    status: 'discarded';
};
export function append(state: GameState, r: NarrativeReservation, text: string, source: NarrativeEntry['source']) {
    const p = phase26(state);
    if (r.runId !== p.runId || r.generation !== p.runtimeGeneration)
        return { result: { status: 'discarded' } as AppendOutcome };
    const existing = p.narrativeLedger.find(e => e.id === r.id || r.type === 'post-combat' && e.type === r.type && e.sourceCombatId === r.sourceCombatId && e.sourceStateRevision === r.sourceStateRevision);
    if (existing)
        return { result: { status: 'saved', entry: existing } as AppendOutcome };
    if (r.sequence > p.sequenceHighWater || p.narrativeLedger.some(e => e.sequence === r.sequence))
        throw new Error('無效敘事保留序號。');
    const entry: NarrativeEntry = { id: r.id, type: r.type, text, source, category: 'placed', sequence: r.sequence,
        sourceStateRevision: r.sourceStateRevision, sourceCombatId: r.sourceCombatId, ...(r.placementRevision !== undefined ? { placementRevision: r.placementRevision } : {}) };
    const nextState = createGameState({ ...state, phase26: { ...p, history: [...p.history, entry], narrativeLedger: [...p.narrativeLedger, entry] } });
    return { nextState, result: { status: 'saved', entry } as AppendOutcome };
}
