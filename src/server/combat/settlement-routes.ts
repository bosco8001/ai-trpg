import type { FastifyInstance } from 'fastify';
import type { GameStateSession } from '../domain-session.js';
import { createSettlementService, type SettlementNarrator } from './settlement-service.js';
import { InvalidPersistedStateError, PersistenceUnavailableError } from '../postgres-game-state-repository.js';
export function registerSettlementRoutes(app: FastifyInstance, session: GameStateSession, storage: 'memory' | 'postgres', sandbox: boolean, narrator?: SettlementNarrator) {
    const service = createSettlementService(session, narrator);
    app.post<{
        Body: unknown;
    }>('/api/combat/settle', { bodyLimit: 1024, errorHandler: (_error, _request, reply) => reply.code(400).send({ error: 'invalid-command', message: '請送出有效的結算請求。' }) }, async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        try {
            const result = await service.settle(request.body);
            if (!result.ok)
                return reply.code(result.code === 'invalid-command' ? 400 : 409).send({ error: result.code, message: result.message });
            const { ok, ...response } = result;
            return { sandbox, storage, ...response };
        }
        catch (error) {
            return reply.code(error instanceof PersistenceUnavailableError ? 503 : 500).send({ error: error instanceof InvalidPersistedStateError ? 'integrity-conflict' : 'state-unavailable', message: '目前無法確認結算狀態，請重新讀取或載入健康存檔。' });
        }
    });
    if (sandbox)
        app.post<{
            Body: unknown;
        }>('/api/dev/combat/reset', { bodyLimit: 1024 }, async (request, reply) => {
            reply.header('Cache-Control', 'no-store');
            try {
                const result = await session.resetTest(request.body);
                if (!result.ok)
                    return reply.code(409).send({ error: result.code, message: result.message });
                return { sandbox, storage, state: result.state };
            }
            catch {
                return reply.code(503).send({ error: 'state-unavailable', message: 'TEST 資料目前無法安全重建。' });
            }
        });
}
