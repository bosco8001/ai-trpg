/** Explicit engineering fixture migration for older action tests; never used by production. */
import { createGameState as validate, type GameState } from '../../src/domain/game.js';
import { createTestGameState as fullTestState } from '../../src/server/test-game-state.js';
import { createDomainSession } from '../../src/server/domain-session.js';
import { buildApp as app } from '../../src/server/app.js';
export * from '../../src/domain/game.js';
export function createGameState(input: unknown): GameState {
    const seed = structuredClone(input) as GameState;
    if (seed.phase26) {
        const p = seed.phase26, player = p.characters.find(c => c.displayName === 'TEST 玩家')!;
        return validate({ ...seed, phase26: { ...p, runId: seed.character.id === 'TEST-character' ? p.runId : `fixture-run-${seed.character.id}`,
                characters: [...p.characters.map(c => c === player ? { ...c, characterId: seed.character.id, currentMp: seed.character.currentMp, maxMp: Math.max(c.maxMp, seed.character.currentMp) } : c), ...seed.partyMembers.filter(m => !p.characters.some(c => c.characterId === m.id)).map(m => ({ characterId: m.id, displayName: m.displayName, currentHp: 8, maxHp: 8, currentMp: 0, maxMp: 0, lifeState: "active" as const, equipmentIds: [] }))] } });
    }
    if (seed.character.id === 'TEST-character')
        return validate({ ...seed, partyMembers: seed.partyMembers ?? [] });
    const base = validate(seed);
    const sample = fullTestState().phase26!;
    return validate({ ...base, phase26: { ...sample, runId: `fixture-run-${seed.character.id}`,
            characters: [{ ...sample.characters[0]!, characterId: seed.character.id, currentMp: seed.character.currentMp },
                ...base.partyMembers.map(m => ({ ...sample.characters[1]!, characterId: m.id, displayName: m.displayName }))] } });
}
export function createTestGameState() { const base = fullTestState(); return createGameState({ ...base, partyMembers: [], phase26: { ...base.phase26!, characters: [base.phase26!.characters[0]!] } }); }
export async function buildApp(options: Parameters<typeof app>[0] = {}) {
    return app({ ...options, ...(options.combatSandbox && options.domainSandbox === undefined ? { domainSandbox: true } : {}),
        ...(!options.domainSession && !options.domainRepository && options.combatParticipants && !options.combatParticipants.some(c => c.controlledBy === 'companion') ? { domainSession: createDomainSession(createTestGameState()) } : {}) });
}
