import { cacheService } from '../../services/cache.service';
import { withDistributedLock } from '../../utils/distributed-lock';

jest.mock('../../services/cache.service', () => ({
  cacheService: {
    setIfAbsent: jest.fn(),
    deleteIfValueMatches: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockedCache = cacheService as jest.Mocked<typeof cacheService>;

describe('withDistributedLock', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  it('не запускает второй экземпляр той же фоновой задачи', async () => {
    mockedCache.setIfAbsent.mockResolvedValue('exists');
    const work = jest.fn();

    const executed = await withDistributedLock('job:test', 60, work);

    expect(executed).toBe(false);
    expect(work).not.toHaveBeenCalled();
  });

  it('в production запрещает работу без хранилища блокировок', async () => {
    process.env.NODE_ENV = 'production';
    mockedCache.setIfAbsent.mockResolvedValue('unavailable');

    await expect(
      withDistributedLock('job:test', 60, jest.fn())
    ).rejects.toThrow('Distributed lock storage unavailable');
  });

  it('снимает только принадлежащую экземпляру блокировку', async () => {
    mockedCache.setIfAbsent.mockResolvedValue('stored');
    mockedCache.deleteIfValueMatches.mockResolvedValue(true);
    const work = jest.fn().mockResolvedValue(undefined);

    const executed = await withDistributedLock('job:test', 60, work);

    expect(executed).toBe(true);
    expect(work).toHaveBeenCalledTimes(1);
    expect(mockedCache.deleteIfValueMatches).toHaveBeenCalledWith(
      'job:test',
      expect.any(String)
    );
  });
});
