import { cacheService } from '../../services/cache.service';
import { withDistributedLock } from '../../utils/distributed-lock';

jest.mock('../../services/cache.service', () => ({
  cacheService: {
    setIfAbsent: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockedCache = cacheService as jest.Mocked<typeof cacheService>;

/* Второй претендент и чужой токен проверены на настоящем Redis в
   integration/api/auth-security.redis.test.ts. */
describe('withDistributedLock', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  it('в production запрещает работу без хранилища блокировок', async () => {
    process.env.NODE_ENV = 'production';
    mockedCache.setIfAbsent.mockResolvedValue('unavailable');

    await expect(
      withDistributedLock('job:test', 60, jest.fn())
    ).rejects.toThrow();
  });
});
