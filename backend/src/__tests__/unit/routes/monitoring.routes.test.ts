import express, { Router } from 'express';
import request from 'supertest';
import healthRoutes from '../../../api/routes/health.routes';
import metricsRoutes from '../../../api/routes/metrics.routes';
import { telegramAuthMiddleware } from '../../../api/middleware/telegram-auth';
import { operationsApiMiddleware } from '../../../api/middleware/operations-api';
import { getSSEConnectionCount } from '../../../api/controllers/sse.controller';
import { prisma } from '../../../database/client';
import { metricsService } from '../../../services/metrics.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock('../../../services/metrics.service', () => ({
  metricsService: {
    collectMetrics: jest.fn(),
    getDetailedStats: jest.fn(),
    getMetrics: jest.fn(),
  },
}));

jest.mock('../../../api/middleware/telegram-auth', () => ({
  telegramAuthMiddleware: jest.fn((_req, _res, next) => next()),
}));

jest.mock('../../../api/middleware/operations-api', () => ({
  operationsApiMiddleware: jest.fn((_req, _res, next) => next()),
}));

jest.mock('../../../api/controllers/sse.controller', () => ({
  getSSEConnectionCount: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const createRouteApp = (mountPath: string, router: Router): express.Application => {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  return app;
};

const mockedPrisma = prisma as unknown as {
  $queryRaw: jest.Mock;
};
const mockedMetricsService = metricsService as jest.Mocked<
  typeof metricsService
>;
const mockedGetSSEConnectionCount =
  getSSEConnectionCount as jest.MockedFunction<typeof getSSEConnectionCount>;
const mockedTelegramAuthMiddleware =
  telegramAuthMiddleware as jest.MockedFunction<typeof telegramAuthMiddleware>;
/* Метрики относятся к инстансу, а не к группе, поэтому закрыты отдельным
   секретом, а не бывшим глобальным флагом администратора. */
const mockedOperationsMiddleware =
  operationsApiMiddleware as jest.MockedFunction<
    typeof operationsApiMiddleware
  >;

const baseMetrics = {
  activePolls: 2,
  avgResponseTime: 45,
  completedPolls: 4,
  errors24h: 0,
  timestamp: '2026-07-01T12:00:00.000Z',
  totalPolls: 6,
  totalTransactions: 3,
  totalUsers: 5,
  totalVotes: 12,
};

describe('monitoring routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('health routes', () => {
    const app = createRouteApp('/health', healthRoutes);

    it('returns minimal service and database health', async () => {
      mockedPrisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

      const response = await request(app).get('/health').expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          database: 'connected',
          status: 'healthy',
          timestamp: expect.any(String),
          uptime: expect.any(String),
          uptimeSeconds: expect.any(Number),
        })
      );
      expect(response.body.environment).toBeUndefined();
      expect(response.body.memory).toBeUndefined();
    });

    it('returns readiness and liveness checks', async () => {
      mockedPrisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

      await request(app).get('/health/ready').expect(200, { ready: true });
      await request(app).get('/health/live').expect(200, { alive: true });
    });

    it('returns 503 when database readiness check fails', async () => {
      mockedPrisma.$queryRaw.mockRejectedValue(new Error('db is down'));

      const response = await request(app).get('/health').expect(503);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Database connection failed',
          status: 'unhealthy',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('metrics routes', () => {
    const app = createRouteApp('/api/metrics', metricsRoutes);

    it('returns current metrics behind auth and the operations secret', async () => {
      mockedMetricsService.collectMetrics.mockResolvedValue(baseMetrics);

      const response = await request(app).get('/api/metrics').expect(200);

      expect(response.body).toEqual(baseMetrics);
      expect(mockedTelegramAuthMiddleware).toHaveBeenCalled();
      expect(mockedOperationsMiddleware).toHaveBeenCalled();
    });

    it('returns detailed metrics combined with the latest in-memory counters', async () => {
      mockedMetricsService.getMetrics.mockReturnValue(baseMetrics);
      mockedMetricsService.getDetailedStats.mockResolvedValue({
        avgVotesPerPoll: 2,
        last24h: { polls: 1, users: 2, votes: 3 },
        last7d: { polls: 4, votes: 5 },
      });

      const response = await request(app)
        .get('/api/metrics/detailed')
        .expect(200);

      expect(response.body).toEqual({
        ...baseMetrics,
        detailed: {
          avgVotesPerPoll: 2,
          last24h: { polls: 1, users: 2, votes: 3 },
          last7d: { polls: 4, votes: 5 },
        },
      });
    });

    it('returns current SSE connection metrics', async () => {
      /* personal — счётчик персональных потоков (деньги). Маршрут отдаёт объект
         счётчика целиком, поэтому поле обязано доехать до ответа: без него
         дежурный не видит, сколько человек висит на своих долгах. */
      mockedGetSSEConnectionCount.mockReturnValue({
        byPoll: { 7: 2, 8: 1 },
        personal: 4,
        total: 3,
      });

      const response = await request(app).get('/api/metrics/sse').expect(200);

      expect(response.body).toEqual({
        data: {
          byPoll: { '7': 2, '8': 1 },
          personal: 4,
          total: 3,
        },
        success: true,
        timestamp: expect.any(String),
      });
    });
  });
});
