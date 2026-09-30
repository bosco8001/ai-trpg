export interface NarrativeEntry {
    readonly id: string;
    readonly type: 'post-combat' | 'exploration' | 'system' | 'tutorial' | 'meta';
    readonly text: string;
    readonly source: 'model' | 'fallback';
    readonly category: 'placed' | 'legacy-unplaced';
    readonly sequence: number | null;
    readonly sourceStateRevision: number | null;
    readonly placementRevision?: number;
    readonly sourceCombatId: string | null;
}
export function orderedHistory(entries: readonly NarrativeEntry[]) {
    return entries.filter(e => e.category === 'placed').sort((a, b) => (a.sourceStateRevision ?? a.placementRevision!) - (b.sourceStateRevision ?? b.placementRevision!) || a.sequence! - b.sequence!);
}
