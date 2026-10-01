/** 本機記憶體樣本；不載入 .env、不連資料庫、不提供遊戲寫入入口。 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { createTestGameState } from '../../src/server/test-game-state.js';
import { createSaveSnapshot } from '../../src/server/save-game/service.js';
import { createMemoryBackupReader, encodeRawBackup, registerRawBackupRoute } from '../../src/server/raw-data-backup.js';
import { rawBackupFilename } from '../../src/shared/raw-data-backup.js';

if (process.env.NODE_ENV === 'production') throw new Error('此樣本只供本機驗收。');
const mode = process.argv[2] ?? 'normal';
if (!['normal', 'blocked', 'unavailable', 'too-large', 'delayed', 'timeout', 'bad-checksum'].includes(mode))
  throw new Error('請選擇 normal、blocked、unavailable、too-large、delayed、timeout 或 bad-checksum。');
const seed = createTestGameState(), save = createSaveSnapshot(seed);
const invalid = { ...seed, phase26: { ...seed.phase26, characters: [] } };
const source = { current: mode === 'blocked' ? invalid : seed, slots: [
  { slotId: 1, formatVersion: 2, sourceRevision: 0, snapshot: save.state, savedAt: '2026-10-01T00:00:00.000Z' },
  { slotId: 2, formatVersion: 99, sourceRevision: -1, snapshot: { hp: -999 }, savedAt: 'bad-date' },
] };
const rawReader = createMemoryBackupReader('TEST-character', () => source);
let captures = 0;
const reader = { async capture(max, signal) {
  captures++;
  if (mode === 'unavailable') throw new Error('隔離樣本無法讀取。');
  const captured = rawReader.capture(max, signal);
  if (mode === 'delayed' || mode === 'timeout') await new Promise((resolve, reject) => {
    const timer = setTimeout(finish, mode === 'delayed' ? 2500 : 35000);
    function finish() { signal.removeEventListener('abort', cancel); resolve(); }
    function cancel() { clearTimeout(timer); reject(new Error('隔離樣本已取消。')); }
    signal.addEventListener('abort', cancel, { once: true });
  });
  return captured;
} };
const app = Fastify();
if (mode === 'bad-checksum') {
  app.get('/api/raw-data-backup', async (_request, reply) => {
    captures++;
    const text = encodeRawBackup(rawReader.capture(10485760, new AbortController().signal), 10485760);
    const value = JSON.parse(text); value.checksum.value = '0'.repeat(64);
    const broken = JSON.stringify(value);
    return reply.header('Cache-Control', 'no-store').header('X-Backup-Max-Bytes', '10485760')
      .header('Content-Disposition', `attachment; filename="${rawBackupFilename(new Date().toISOString())}"`)
      .header('Content-Length', String(Buffer.byteLength(broken))).type('application/json').send(broken);
  });
} else registerRawBackupRoute(app, reader, mode === 'too-large' ? 512 : 10485760);
app.get('/api/game-state', (_request, reply) => mode === 'blocked' || mode === 'unavailable'
  ? reply.code(503).send({ error: 'state-unavailable', message: '隔離驗收樣本：遊戲狀態無法讀取。' })
  : { sandbox: false, storage: 'memory', state: seed });
app.get('/api/health', () => ({ status: 'ok', service: 'ai-trpg-api' }));
app.get('/api/save-slots', (_request, reply) => reply.code(503).send({ error: 'preview-read-only' }));
app.get('/api/dev/phase29-preview-count', () => ({ captures }));
await app.register(fastifyStatic, { root: resolve(fileURLToPath(new URL('../../', import.meta.url)), 'dist/web') });
app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/')
  ? reply.code(404).send({ error: 'not-found' }) : reply.sendFile('index.html'));
const address = await app.listen({ host: '127.0.0.1', port: Number(process.env.PHASE29_PREVIEW_PORT ?? 3029) });
console.log(`Phase 29 隔離驗收樣本（${mode}）：${address}。沒有連接真實存檔。`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); });
