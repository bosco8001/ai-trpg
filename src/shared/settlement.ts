import { isAuthoritativeGameStateResponse, type AuthoritativeGameStateResponse } from './game-state.js';
import { validResources } from '../domain/settlement.js';
import type { SettlementResult } from '../domain/settlement.js';
import type { SettlementNarrationOutcome } from '../server/combat/settlement-service.js';
export interface SettlementResponse extends AuthoritativeGameStateResponse {
    readonly settlementResult: SettlementResult;
    readonly narration: SettlementNarrationOutcome;
}
export function isSettlementResponse(value: unknown): value is SettlementResponse {
    try {
        return validateSettlementResponse(value);
    }
    catch {
        return false;
    }
}
function validateSettlementResponse(value: unknown): value is SettlementResponse {
    if (!value || typeof value !== 'object')
        return false;
    const v = value as SettlementResponse;
    const { settlementResult: r, narration: n, ...base } = v;
    if (!isAuthoritativeGameStateResponse(base) || !r || !n || v.state.combat !== null || v.state.activity !== 'outside-combat'
        || r.settlementRevision !== v.state.revision || typeof r.combatId !== 'string' || !['victory', 'escaped'].includes(r.result)
        || typeof r.rewardEligible !== 'boolean' || !Array.isArray(r.partyResults) || !Array.isArray(r.enemyResults)
        || !['saved', 'unsaved', 'discarded', 'unavailable'].includes(n.status))
        return false;
    const partyIds = [v.state.character.id, ...v.state.partyMembers.map(m => m.id)];
    const p = v.state.phase26;
    if (!p || !r.partyResults.length || new Set(r.partyResults.map(c => c.characterId)).size !== r.partyResults.length
        || partyIds.some(id => !r.partyResults.some(c => c.characterId === id))
        || r.partyResults.some(c => !c || typeof c.displayName !== 'string' || !c.displayName.trim() || !c.before || !c.after
            || !validResources(c.before) || !validResources(c.after) || c.before.activePartyMember !== true
            || !['active', 'dying', 'dead'].includes(c.before.lifeState) || !['active', 'dead'].includes(c.after.lifeState)
            || c.after.activePartyMember !== partyIds.includes(c.characterId)
            || !p.characters.some(record => record.characterId === c.characterId && record.displayName === c.displayName
                && record.currentHp === c.after.currentHp && record.maxHp === c.after.maxHp && record.currentMp === c.after.currentMp
                && record.maxMp === c.after.maxMp && record.lifeState === c.after.lifeState))
        || !r.enemyResults.length || r.enemyResults.some(c => !c || typeof c.participantId !== 'string' || !c.participantId
        || typeof c.displayName !== 'string' || !['active', 'dying', 'dead'].includes(c.finalLifeState)
        || !Number.isSafeInteger(c.maxHp) || c.maxHp < 1 || !Number.isSafeInteger(c.currentHp) || c.currentHp < 0 || c.currentHp > c.maxHp
        || r.result === 'victory' && c.finalLifeState !== 'dead')
        || r.rewardEligible && p.fixtureId !== null
        || !r.returnExplorationContext || r.returnExplorationContext.locationId !== v.state.exploration.locationId
        || r.returnExplorationContext.lastObservationTargetId !== v.state.exploration.lastObservationTargetId
        || typeof r.returnExplorationContext.displayName !== 'string'
        || r.encounterResult !== null && (!r.encounterResult || r.encounterResult.before?.resolved !== false
            || r.encounterResult.after?.resolved !== (r.result === 'victory')
            || !p.encounters.some(e => e.encounterId === r.encounterResult?.encounterId && e.resolved === r.encounterResult.after.resolved)))
        return false;
    if (n.status === 'saved' || n.status === 'unsaved') {
        if (typeof n.text !== 'string' || !n.text.trim() || !['model', 'fallback'].includes(n.source))
            return false;
        if (n.status === 'saved' && (!n.entry || n.entry.text !== n.text || n.entry.type !== 'post-combat' || n.entry.sourceCombatId !== r.combatId || n.entry.sourceStateRevision !== r.settlementRevision))
            return false;
    }
    else if (n.text !== null)
        return false;
    return true;
}
