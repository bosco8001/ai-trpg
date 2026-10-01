/** Grok／使用者專用隔離樣本：不載入 .env、不連 DB，只保存至獨立 tmp 目錄。尚未執行。 */
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { createTestGameState } from '../../src/server/test-game-state.js';
import { createSaveSnapshot } from '../../src/server/save-game/service.js';
import { createMemoryRepairReader } from '../../src/server/repair-preview-reader.js';
import { registerRepairPreviewRoute } from '../../src/server/repair-preview.js';
import { FileRepairArchive } from '../../src/server/file-repair-archive.js';
import { PreparationFailure } from '../../src/server/repair-archive.js';
import { createRepairPreparationService, registerRepairPreparationRoutes } from '../../src/server/repair-preparation.js';

if (process.env.NODE_ENV === 'production') throw new Error('此樣本只供本機驗收。');
const mode = process.argv[2] ?? 'normal';
if (!['normal', 'state-failure', 'capacity', 'lost-response', 'delayed', 'timeout', 'unavailable'].includes(mode)) throw new Error('不支援的隔離樣本模式。');
const directory = resolve(tmpdir(), 'ai-trpg-phase31-review');
const seed = createTestGameState(), saved = createSaveSnapshot(seed).state;
const source = { current: { ...seed, activity: 'in-combat', character: { ...seed.character, currentMp: 1 } }, slots: [
  { slotId: 1, formatVersion: 2, sourceRevision: 0, savedAt: new Date().toISOString(), snapshot: { ...saved, activity: 'in-combat' } },
  { slotId: 2, formatVersion: 2, sourceRevision: 0, savedAt: new Date().toISOString(), snapshot: { ...saved, activity: 'in-combat', character: { ...saved.character, id: 'OTHER-character' },
    phase26: { ...saved.phase26, characters: saved.phase26.characters.map(c => c.characterId === seed.character.id ? { ...c, characterId: 'OTHER-character' } : c) } } },
  { slotId: 3, formatVersion: 2, sourceRevision: 0, savedAt: new Date().toISOString(), snapshot: { ...saved, activity: 'in-combat', inventory: [{ itemId: 'bad', quantity: -1 }] } },
] };
const reader = createMemoryRepairReader(seed.character.id, () => source);
const base = new FileRepairArchive(directory, 32 * 1024 * 1024, mode === 'capacity' ? 1 : 1024 * 1024 * 1024);
let posts = 0;
const archive = { get: base.get.bind(base), list: base.list.bind(base), async put(text, characterId, signal) {
  if (mode === 'unavailable') throw new PreparationFailure('unavailable');
  const stored = await base.put(text, characterId, signal);
  if (mode === 'lost-response') throw new PreparationFailure('unavailable');
  if (mode === 'delayed' || mode === 'timeout') await new Promise((resolveWait, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new PreparationFailure('unavailable')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolveWait(); }, mode === 'delayed' ? 2500 : 35000);
    signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
  });
  return stored;
} };
const app = Fastify();
app.addHook('preHandler', async request => { if (request.method === 'POST' && request.url === '/api/repair-preparations') posts++; });
registerRepairPreviewRoute(app, reader);
registerRepairPreparationRoutes(app, createRepairPreparationService(reader, archive));
app.get('/api/game-state', (_request, reply) => mode === 'state-failure' ? reply.code(503).send({ error: 'state-unavailable', message: '隔離樣本：目前遊戲資料讀取失敗。' }) : { sandbox: false, storage: 'memory', state: seed });
app.get('/api/save-slots', (_request, reply) => reply.code(503).send({ error: 'isolated-source' }));
app.get('/api/dev/phase31-count', () => ({ posts }));
app.post('/api/dev/phase31-change/:source', async (request, reply) => {
  if (request.params.source === 'current') source.current = { ...source.current, revision: source.current.revision + 1 };
  else {
    const slot = source.slots.find(item => String(item.slotId) === request.params.source);
    if (!slot) return reply.code(400).send({ error: 'invalid-source' });
    slot.sourceRevision++; slot.savedAt = new Date().toISOString();
  }
  return { changed: true };
});
await app.register(fastifyStatic, { root: resolve(fileURLToPath(new URL('../../', import.meta.url)), 'dist/web') });
app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/') ? reply.code(404).send({ error: 'not-found' }) : reply.sendFile('index.html'));
const address = await app.listen({ host: '127.0.0.1', port: Number(process.env.PHASE31_PREVIEW_PORT ?? 3031) });
console.log(`Phase 31 隔離樣本（${mode}）：${address}。備份目錄：${directory}；重啟保留，不自動清理。沒有修復套用入口。`);
for (const event of ['SIGINT', 'SIGTERM']) process.once(event, async () => { await app.close(); });
