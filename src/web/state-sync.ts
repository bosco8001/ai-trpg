import type { AuthoritativeGameStateResponse } from '../shared/game-state.js';
import { orderedHistory, type NarrativeEntry } from '../shared/narrative.js';
export function acceptState(current: AuthoritativeGameStateResponse | null, next: AuthoritativeGameStateResponse) {
    if (current && current.state.revision > next.state.revision)
        return current;
    if (current && current.state.revision === next.state.revision && current.state.phase26?.runtimeGeneration !== next.state.phase26?.runtimeGeneration)
        return current;
    const old = current?.state.phase26, incoming = next.state.phase26;
    if (old && incoming && old.runtimeGeneration === incoming.runtimeGeneration) {
        const merge = (a: readonly NarrativeEntry[], b: readonly NarrativeEntry[]) => [...new Map([...b, ...a].map(e => [e.id, e])).values()];
        return { ...next, state: { ...next.state, phase26: { ...incoming, history: merge(old.history, incoming.history),
                    narrativeLedger: merge(old.narrativeLedger, incoming.narrativeLedger), sequenceHighWater: Math.max(old.sequenceHighWater, incoming.sequenceHighWater) } } };
    }
    return next;
}
export function acceptHistory(current: AuthoritativeGameStateResponse | null, generation: string, entry: NarrativeEntry) {
    const p = current?.state.phase26;
    if (!current || !p || p.runtimeGeneration !== generation || p.history.some(e => e.id === entry.id || e.type === 'post-combat' && e.sourceCombatId === entry.sourceCombatId && e.sourceStateRevision === entry.sourceStateRevision))
        return current;
    return { ...current, state: { ...current.state, phase26: { ...p, history: [...orderedHistory([...p.history, entry]), ...p.history.filter(e => e.category === "legacy-unplaced")], narrativeLedger: p.narrativeLedger.some(e => e.id === entry.id) ? p.narrativeLedger : [...p.narrativeLedger, entry], sequenceHighWater: Math.max(p.sequenceHighWater, entry.sequence ?? 0) } } };
}
