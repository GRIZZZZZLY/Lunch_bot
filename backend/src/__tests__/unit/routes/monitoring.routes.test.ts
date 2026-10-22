import express, { Router } from 'express';
import request from 'supertest';
import healthRoutes from '../../../api/routes/health.routes';
import { prisma } from '../../../database/client';

jest.mock('../../../database/client', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
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

/* /api/metrics за секретом операций проверен на настоящем API в
   integration/api/auth-surface.routes.test.ts. */
describe('health routes', () => {
  const app = createRouteApp('/health', healthRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns minimal service and database health', async () => {
    mockedPrisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        database: 'connected',
        status: 'healthy',
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

    expect(response.body.status).toBe('unhealthy');
  });
});
