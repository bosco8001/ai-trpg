/** 隔離的記憶體驗收樣本；不讀取 .env、不連接資料庫、不提供遊戲寫入入口。 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { createTestGameState } from '../../src/server/test-game-state.js';
import { createSaveSnapshot } from '../../src/server/save-game/service.js';
import { registerDataDiagnosticsRoute } from '../../src/server/data-diagnostics.js';

if (process.env.NODE_ENV === 'production') throw new Error('此樣本只供本機驗收。');
const mode = process.argv[2] ?? 'normal';
if (!['normal', 'mixed', 'unsupported', 'blocked', 'unavailable'].includes(mode))
  throw new Error('請選擇 normal、mixed、unsupported、blocked 或 unavailable。');
const seed = createTestGameState();
const save = createSaveSnapshot(seed);
const slot = id => ({ slotId: id, formatVersion: save.formatVersion, sourceRevision: save.sourceRevision,
  snapshot: save.state, savedAt: '2026-10-01T00:00:00.000Z' });
const legacy = { activity: 'outside-combat', character: { ...seed.character, id: 'FORMAL-legacy-fixture' }, exploration: seed.exploration };
const records = mode === 'normal' ? [slot(1)] : [slot(1), { ...slot(2), formatVersion: 1, snapshot: legacy },
  mode === 'unsupported' ? { ...slot(3), formatVersion: 99 } : { ...slot(3), snapshot: {} }];
const app = Fastify();
registerDataDiagnosticsRoute(app, {
  async readCurrent() {
    if (mode === 'unavailable') throw new Error('模擬服務無法讀取。');
    return { kind: 'state', value: mode === 'blocked' ? { ...seed, phase26: { ...seed.phase26, characters: [] } } : seed };
  },
  async readSlot(id) {
    if (mode === 'unavailable') throw new Error('模擬服務無法讀取。');
    return records.find(record => record.slotId === id);
  },
}, 'memory');
app.get('/api/game-state', (_request, reply) => {
  if (mode === 'blocked' || mode === 'unavailable') return reply.code(mode === 'blocked' ? 500 : 503)
    .send({ error: mode === 'blocked' ? 'state-invalid' : 'state-unavailable', message: '隔離驗收樣本：遊戲狀態無法讀取。' });
  return { sandbox: false, storage: 'memory', state: seed };
});
app.get('/api/health', () => ({ status: 'ok', service: 'ai-trpg-api' }));
// 隔離樣本只提供健康檢查；存讀檔面板不提供操作或假空槽。
app.get('/api/save-slots', (_request, reply) => reply.code(503).send({ error: 'preview-read-only' }));
const webRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)), 'dist/web');
await app.register(fastifyStatic, { root: webRoot });
app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/')
  ? reply.code(404).send({ error: 'not-found' }) : reply.sendFile('index.html'));
const address = await app.listen({ host: '127.0.0.1', port: Number(process.env.PHASE28_PREVIEW_PORT ?? 3028) });
console.log(`Phase 28 隔離驗收樣本（${mode}）：${address}。停止後樣本會消失；沒有連接真實存檔。`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); });
