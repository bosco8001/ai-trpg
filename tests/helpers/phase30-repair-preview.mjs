/** 隔離記憶體樣本：不載入 .env、不連資料庫、不修改真實存檔。 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { createTestGameState } from '../../src/server/test-game-state.js';
import { createDomainSession } from '../../src/server/domain-session.js';
import { createSaveSnapshot } from '../../src/server/save-game/service.js';
import { InMemorySaveGameRepository } from '../../src/server/save-game/memory-repository.js';
import { buildApp } from '../../src/server/app.js';
import { createMemoryRepairReader } from '../../src/server/repair-preview-reader.js';
import { registerRepairPreviewRoute } from '../../src/server/repair-preview.js';
import { startCombat, advanceCombatTurn, startCasting } from '../../src/domain/combat.js';
import { applyCommand } from '../../src/domain/game.js';
import { PHASE22_TEST_COMBAT_PARTICIPANTS } from '../../src/server/combat/fixtures.js';
import { createPhase22CombatFixtureRoller } from '../../src/server/combat/dice.js';

if (process.env.NODE_ENV === 'production') throw new Error('此樣本只供本機驗收。');
const mode = process.argv[2] ?? 'normal';
if (!['normal', 'blocked', 'combat', 'unavailable', 'too-large', 'delayed', 'timeout', 'live'].includes(mode))
  throw new Error('請選擇 normal、blocked、combat、unavailable、too-large、delayed、timeout 或 live。');
const webRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)), 'dist/web');
let seed = createTestGameState();
if (mode === 'combat') {
  const unwrap = result => { if (!result.ok) throw new Error('無法建立隔離戰鬥樣本。'); return result.state; };
  seed = unwrap(applyCommand(seed, { type: 'set-equipped-skills', skillIds: ['TEST-skill-2'], expectedRevision: 0 }));
  seed = unwrap(startCombat(seed, { expectedRevision: 1 }, PHASE22_TEST_COMBAT_PARTICIPANTS, createPhase22CombatFixtureRoller('normal')));
  seed = unwrap(advanceCombatTurn(seed, { expectedRevision: 2 }));
  seed = unwrap(startCasting(seed, { expectedRevision: 3, skillId: 'TEST-skill-2' }));
}
let app, reads = 0;
if (mode === 'live') {
  // 這個模式允許既有 Save／Load，但只操作本程序的隔離記憶體。
  const session = createDomainSession(seed), repository = new InMemorySaveGameRepository(() => session.getState());
  await repository.writeIfLiveRevision(1, createSaveSnapshot(seed), { characterId: seed.character.id, expectedRevision: seed.revision });
  app = await buildApp({ webRoot, domainSession: session, saveGameRepository: repository });
} else {
  const saved = createSaveSnapshot(seed), now = new Date().toISOString();
  const source = { current: mode === 'blocked' || mode === 'combat'
    ? { ...seed, activity: seed.combat ? 'outside-combat' : 'in-combat', character: { ...seed.character, currentMp: 1 } } : seed,
    slots: [
      { slotId: 1, formatVersion: 2, sourceRevision: seed.revision, savedAt: now,
        snapshot: { ...saved.state, activity: seed.combat ? 'outside-combat' : 'in-combat', character: { ...seed.character, currentMp: 1 } } },
      { slotId: 2, formatVersion: 2, sourceRevision: seed.revision, savedAt: now,
        snapshot: { ...saved.state, activity: 'in-combat', phase26: { ...saved.state.phase26,
          characters: saved.state.phase26.characters.map((c, i) => i === 0 ? { ...c, currentMp: -1 } : c) } } },
    ] };
  if (mode === 'too-large') source.current = { text: '字'.repeat(4 * 1024 * 1024) };
  const original = createMemoryRepairReader(seed.character.id, () => source);
  const reader = { ...original, async read(item, max, signal) {
    reads++;
    if (mode === 'unavailable') throw new Error('隔離樣本無法讀取。');
    const captured = original.read(item, max, signal);
    if (mode === 'delayed' || mode === 'timeout') await new Promise((resolve, reject) => {
      const timer = setTimeout(finish, mode === 'delayed' ? 2500 : 35000);
      function finish() { signal.removeEventListener('abort', cancel); resolve(); }
      function cancel() { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(new Error('隔離樣本已取消。')); }
      signal.addEventListener('abort', cancel, { once: true });
    });
    return captured;
  } };
  app = Fastify(); registerRepairPreviewRoute(app, reader);
  app.get('/api/game-state', (_request, reply) => mode === 'blocked' || mode === 'unavailable' || mode === 'too-large'
    ? reply.code(503).send({ error: 'state-unavailable', message: '隔離樣本：目前遊戲狀態無法讀取。' })
    : { sandbox: false, storage: 'memory', state: seed });
  app.get('/api/health', () => ({ status: 'ok', service: 'ai-trpg-api' }));
  app.get('/api/save-slots', (_request, reply) => reply.code(503).send({ error: 'preview-read-only' }));
  await app.register(fastifyStatic, { root: webRoot });
  app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/') ? reply.code(404).send({ error: 'not-found' }) : reply.sendFile('index.html'));
}
app.get('/api/dev/phase30-preview-count', () => ({ reads }));
const address = await app.listen({ host: '127.0.0.1', port: Number(process.env.PHASE30_PREVIEW_PORT ?? 3030) });
console.log(`Phase 30 隔離樣本（${mode}）：${address}。${mode === 'live' ? 'Save／Load 只影響本程序記憶體。' : '沒有遊戲寫入入口。'}沒有連接真實存檔。`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); });
