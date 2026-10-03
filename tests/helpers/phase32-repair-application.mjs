/** Grok／使用者專用隔離樣本，尚未執行。不載入 .env，不連資料庫。 */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { createGameState } from '../../src/domain/game.js';
import { createTestGameState } from '../../src/server/test-game-state.js';
import { createDomainSession } from '../../src/server/domain-session.js';
import { createSaveSnapshot } from '../../src/server/save-game/service.js';
import { InMemorySaveGameRepository } from '../../src/server/save-game/memory-repository.js';
import { createMemoryRepairReader } from '../../src/server/repair-preview-reader.js';
import { registerRepairPreviewRoute } from '../../src/server/repair-preview.js';
import { FileRepairArchive } from '../../src/server/file-repair-archive.js';
import { createRepairPreparationService, registerRepairPreparationRoutes } from '../../src/server/repair-preparation.js';
import { MemoryRepairApplication } from '../../src/server/memory-repair-application.js';
import { registerRepairApplicationRoutes } from '../../src/server/repair-application-routes.js';
import { ApplicationFailure } from '../../src/server/repair-application-core.js';

if (process.env.NODE_ENV === 'production') throw new Error('此樣本只供本機驗收。');
const mode = process.argv[2] ?? 'normal';
if (!['normal', 'lost-response', 'timeout', 'report-failure', 'capacity'].includes(mode)) throw new Error('不支援的隔離樣本模式。');
const directory = resolve(tmpdir(), 'ai-trpg-phase32-review'), runtimeId = randomUUID();
const session = createDomainSession(createTestGameState());
session.repairRaw(raw => ({ result: undefined, nextState: { ...raw, activity: 'in-combat', character: { ...raw.character, currentMp: 1 } } }));
const slots = new InMemorySaveGameRepository(() => session.getState());
const saved = createSaveSnapshot(createTestGameState()).state;
for (const slotId of [1, 2, 3]) slots.repairRaw(slotId, () => ({ result: undefined, next: {
  slotId, formatVersion: 2, sourceRevision: 7, savedAt: '2026-10-04T00:00:00.123456Z',
  snapshot: { ...saved, activity: 'in-combat', character: { ...saved.character, currentMp: 1 },
    ...(slotId === 3 ? { inventory: [{ itemId: 'bad', quantity: -1 }] } : {}) },
} }));
const reader = createMemoryRepairReader('TEST-character', () => ({ current: session.readStateForBackup(), slots: slots.readAllForBackup() }),
  () => new Date(), source => {
    const guard = source === 'current' ? session.readRepairGuard() : slots.readRepairGuard(source);
    return guard ? `${runtimeId}:${guard}` : null;
  });
const archive = new FileRepairArchive(directory, undefined, mode === 'capacity' ? 1 : undefined);
const base = new MemoryRepairApplication(reader, archive, session, slots, runtimeId);
const publish = archive.publishAuxiliary.bind(archive);
let brokenReport = mode === 'report-failure', applyPosts = 0;
archive.publishAuxiliary = async (id, kind, text, signal) => {
  if (kind === 'report' && brokenReport) throw new ApplicationFailure('unavailable');
  return publish(id, kind, text, signal);
};
const backend = { bind: base.bind.bind(base), lookup: base.lookup.bind(base), download: base.download.bind(base), async apply(request, signal) {
  const result = await base.apply(request, signal);
  if (mode === 'lost-response') throw new ApplicationFailure('unavailable');
  if (mode === 'timeout') await new Promise((resolveWait, reject) => {
    const abort = () => { clearTimeout(timer); reject(new ApplicationFailure('unavailable')); };
    const timer = setTimeout(resolveWait, 35_000);
    signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
  });
  return result;
} };
const app = Fastify();
app.addHook('preHandler', async request => { if (request.method === 'POST' && request.url.startsWith('/api/repair-applications/')) applyPosts++; });
registerRepairPreviewRoute(app, reader);
registerRepairPreparationRoutes(app, createRepairPreparationService(reader, archive, undefined, runtimeId, () => new Date(), base.bind.bind(base)));
registerRepairApplicationRoutes(app, backend);
app.get('/api/game-state', (_request, reply) => {
  try { return { sandbox: false, storage: 'memory', state: createGameState(session.getState()) }; }
  catch { return reply.code(503).send({ error: 'state-unavailable', message: '隔離樣本：目前遊戲資料須先修復。' }); }
});
app.get('/api/save-slots', (_request, reply) => reply.code(503).send({ error: 'isolated-source' }));
app.get('/api/dev/phase32-count', () => ({ applyPosts }));
app.post('/api/dev/phase32-report-recover', () => { brokenReport = false; return { recovered: true }; });
app.post('/api/dev/phase32-change/:source', (request, reply) => {
  if (request.params.source === 'current') session.repairRaw(raw => ({ result: undefined, nextState: structuredClone(raw) }));
  else {
    const id = Number(request.params.source);
    if (![1, 2, 3].includes(id)) return reply.code(400).send({ error: 'invalid-source' });
    slots.repairRaw(id, raw => ({ result: undefined, ...(raw ? { next: structuredClone(raw) } : {}) }));
  }
  return { changed: true }; // Same bytes, different source guard (ABA/same-value coverage).
});
await app.register(fastifyStatic, { root: resolve(fileURLToPath(new URL('../../', import.meta.url)), 'dist/web') });
app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/') ? reply.code(404).send({ error: 'not-found' }) : reply.sendFile('index.html'));
const address = await app.listen({ host: '127.0.0.1', port: Number(process.env.PHASE32_PREVIEW_PORT ?? 3032) });
console.log(`Phase 32 隔離樣本（${mode}）：${address}。備份／報告：${directory}；重啟保留，不自動清理。`);
for (const event of ['SIGINT', 'SIGTERM']) process.once(event, async () => { await app.close(); });
