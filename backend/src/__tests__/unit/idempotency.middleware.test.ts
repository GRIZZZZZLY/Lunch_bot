import express from 'express';
import request from 'supertest';
import { cacheService } from '../../services/cache.service';
import { createIdempotencyMiddleware } from '../../api/middleware/idempotency';

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
      (req as any).user = { id: 7 };
      next();
    },
    createIdempotencyMiddleware({ scope: 'test', required: true }),
    handler
  );
  return app;
}

describe('required idempotency middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCache.get.mockResolvedValue(undefined);
    mockedCache.set.mockResolvedValue(true);
  });

  it('rejects a write without a key', async () => {
    const handler = jest.fn((_req, res) => res.status(201).json({ ok: true }));

    const response = await request(createApp(handler)).post('/write').send({});

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(handler).not.toHaveBeenCalled();
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
    expect(response.headers['retry-after']).toBe('5');
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
    expect(mockedCache.setIfAbsent).toHaveBeenCalledTimes(1);
  });

  it('replays a completed response without executing the handler', async () => {
    mockedCache.get.mockResolvedValue({
      state: 'done',
      at: Date.now(),
      response: {
        status: 201,
        body: { ok: true },
        contentType: 'application/json',
      },
    });
    const handler = jest.fn((_req, res) => res.status(201).json({ ok: false }));

    const response = await request(createApp(handler))
      .post('/write')
      .set('Idempotency-Key', 'request-123')
      .send({});

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers['x-idempotent-replayed']).toBe('true');
    expect(handler).not.toHaveBeenCalled();
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
