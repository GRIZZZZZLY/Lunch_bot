import express from 'express';
import request from 'supertest';
import { refreshTokenMiddleware } from '../../api/middleware/telegram-auth';
import { JwtService } from '../../services/jwt.service';
import { UserService } from '../../services/user.service';
import { cacheService } from '../../services/cache.service';

jest.mock('../../services/jwt.service', () => ({
  JwtService: {
    verifyToken: jest.fn(),
  },
}));

jest.mock('../../services/user.service', () => ({
  UserService: {
    getUserById: jest.fn(),
  },
}));

jest.mock('../../services/cache.service', () => ({
  cacheService: {
    setIfAbsent: jest.fn(),
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

const verifyToken = JwtService.verifyToken as jest.Mock;
const getUserById = UserService.getUserById as jest.Mock;
const setIfAbsent = cacheService.setIfAbsent as jest.Mock;

function createApp(): express.Application {
  const app = express();
  app.post('/refresh', refreshTokenMiddleware, (req, res) => {
    res.json({ userId: (req as any).user.id });
  });
  return app;
}

describe('refresh token replay protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    verifyToken.mockReturnValue({
      userId: 7,
      type: 'refresh',
      jti: 'refresh-id',
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    getUserById.mockResolvedValue({ id: 7, isActive: true });
  });

  it('consumes a refresh token once and authenticates its active user', async () => {
    setIfAbsent.mockResolvedValue('stored');

    const response = await request(createApp())
      .post('/refresh')
      .set('Authorization', 'Bearer refresh-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: 7 });
    expect(setIfAbsent).toHaveBeenCalledWith(
      'auth:refresh-used:refresh-id',
      true,
      expect.any(Number)
    );
  });

  it('rejects a repeated refresh token', async () => {
    setIfAbsent.mockResolvedValue('exists');

    const response = await request(createApp())
      .post('/refresh')
      .set('Authorization', 'Bearer refresh-token');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('REFRESH_TOKEN_REPLAY');
    expect(getUserById).not.toHaveBeenCalled();
  });

  it('fails closed in production if the replay store is unavailable', async () => {
    process.env.NODE_ENV = 'production';
    setIfAbsent.mockResolvedValue('unavailable');

    const response = await request(createApp())
      .post('/refresh')
      .set('Authorization', 'Bearer refresh-token');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('AUTH_SERVICE_UNAVAILABLE');
    expect(response.headers['retry-after']).toBe('5');
  });
});
