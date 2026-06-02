import { StoreRunService } from '../../../services/store-run.service';

jest.mock('../../../database/client', () => ({
  prisma: { storeRun: { updateManyAndReturn: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() } },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../../../database/client');

describe('StoreRunService.expireStaleShoppingRuns', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cancels SHOPPING runs older than the timeout via a single guarded update', async () => {
    prisma.storeRun.updateManyAndReturn.mockResolvedValue([{ id: 16 }, { id: 19 }]);

    const ids = await StoreRunService.expireStaleShoppingRuns();

    expect(ids).toEqual([16, 19]);
    expect(prisma.storeRun.updateManyAndReturn).toHaveBeenCalledTimes(1);
    const arg = prisma.storeRun.updateManyAndReturn.mock.calls[0][0];
    // status guard in the SAME write where-clause → race-safe, no blind update
    expect(arg.where.status).toBe('SHOPPING');
    expect(arg.where.shoppingAt.lt).toBeInstanceOf(Date);
    expect(arg.data.status).toBe('CANCELLED');
    // must not fall back to the racy findMany→updateMany pair
    expect(prisma.storeRun.updateMany).not.toHaveBeenCalled();
  });

  it('uses the configured timeout (cutoff = now - STORE_RUN_SHOPPING_TIMEOUT_MIN)', async () => {
    const prev = process.env.STORE_RUN_SHOPPING_TIMEOUT_MIN;
    process.env.STORE_RUN_SHOPPING_TIMEOUT_MIN = '60';
    prisma.storeRun.updateManyAndReturn.mockResolvedValue([]);

    const before = Date.now();
    await StoreRunService.expireStaleShoppingRuns();
    const after = Date.now();

    const cutoff = prisma.storeRun.updateManyAndReturn.mock.calls[0][0].where.shoppingAt.lt.getTime();
    // cutoff must be ~60 min before "now"
    expect(cutoff).toBeGreaterThanOrEqual(before - 60 * 60 * 1000 - 1000);
    expect(cutoff).toBeLessThanOrEqual(after - 60 * 60 * 1000 + 1000);

    process.env.STORE_RUN_SHOPPING_TIMEOUT_MIN = prev;
  });

  it('returns [] when nothing is stale', async () => {
    prisma.storeRun.updateManyAndReturn.mockResolvedValue([]);
    await expect(StoreRunService.expireStaleShoppingRuns()).resolves.toEqual([]);
  });
});
