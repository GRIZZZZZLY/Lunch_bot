import express from 'express';
import request from 'supertest';
import { cacheService } from '../../services/cache.service';
import { createIdempotencyMiddleware } from '../../api/middleware/idempotency';
import type { User } from '../../types/database.types';

jest.mock('../../services/cache.service', () => ({
  cacheService: {
    del: jest.fn().mockResolvedValue(1),
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
    setIfAbsent: jest.fn(),
  },
}));

jest.mock('../../services/metrics.service', () => ({
  metricsService: {
    incrementIdempotencyReplay: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockedCache = cacheService as jest.Mocked<typeof cacheService>;

function createApp(handler: jest.Mock): express.Application {
  const app = express();
  app.use(express.json());
  app.post(
    '/write',
    (req, _res, next) => {
      /* Заглушка аутентификации: идемпотентности нужен только id, остальные
         поля Prisma-модели User здесь не читает никто. `as unknown as User`,
         а не `as never`: `never` проглотил бы и будущее обязательное поле,
         которое middleware реально начнёт читать. */
      req.user = { id: 7 } as unknown as User;
      next();
    },
    createIdempotencyMiddleware({ scope: 'test', required: true }),
    handler
  );
  return app;
}

/* Без ключа — 400, повтор с тем же ключом — первый ответ, отказ 4xx не
   запоминается: проверено на настоящем Redis в
   integration/api/auth-security.redis.test.ts. */
describe('required idempotency middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCache.get.mockResolvedValue(undefined);
    mockedCache.set.mockResolvedValue(true);
  });

  it('fails closed when Redis is unavailable', async () => {
    mockedCache.setIfAbsent.mockResolvedValue('unavailable');
    const handler = jest.fn((_req, res) => res.status(201).json({ ok: true }));

    const response = await request(createApp(handler))
      .post('/write')
      .set('Idempotency-Key', 'request-123')
      .send({});

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('IDEMPOTENCY_UNAVAILABLE');
    expect(response.headers['retry-after']).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows only the atomic lock winner to execute', async () => {
    mockedCache.setIfAbsent.mockResolvedValue('stored');
    const handler = jest.fn((_req, res) => res.status(201).json({ ok: true }));

    const response = await request(createApp(handler))
      .post('/write')
      .set('Idempotency-Key', 'request-123')
      .send({});

    expect(response.status).toBe(201);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  /* Кешируется только успех: закешированный отказ сутки отдавался бы повторам
     вместо новой попытки (2026-08-24). */
  it('5xx не запоминается: повтор с тем же ключом снова доходит до обработчика', async () => {
    const store = new Map<string, unknown>();
    (mockedCache.get as jest.Mock).mockImplementation(async (key: string) => store.get(key));
    mockedCache.setIfAbsent.mockImplementation(async (key: string, value: unknown) => {
      if (store.has(key)) return 'exists';
      store.set(key, value);
      return 'stored';
    });
    (mockedCache.set as jest.Mock).mockImplementation(async (key: string, value: unknown) => {
      store.set(key, value);
      return true;
    });
    mockedCache.del.mockImplementation(async key => (store.delete(String(key)) ? 1 : 0));
    const handler = jest.fn((_req, res) => res.status(500).json({ error: 'boom' }));
    const app = createApp(handler);
    const send = () =>
      request(app).post('/write').set('Idempotency-Key', 'request-123').send({});

    expect((await send()).status).toBe(500);
    expect((await send()).status).toBe(500);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('rejects the loser of a concurrent acquisition', async () => {
    mockedCache.get
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ state: 'inflight', at: Date.now() });
    mockedCache.setIfAbsent.mockResolvedValue('exists');
    const handler = jest.fn((_req, res) => res.status(201).json({ ok: true }));

    const response = await request(createApp(handler))
      .post('/write')
      .set('Idempotency-Key', 'request-123')
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('IDEMPOTENCY_INFLIGHT');
    expect(handler).not.toHaveBeenCalled();
  });
});
