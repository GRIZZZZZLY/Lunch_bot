import { StoreRunService } from '../../../services/store-run.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    storeRun: {
      updateManyAndReturn: jest.fn(),
    },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const { prisma } = require('../../../database/client');

describe('StoreRunService.expireStaleShoppingRuns', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the configured timeout (cutoff = now - STORE_RUN_SHOPPING_TIMEOUT_MIN)', async () => {
    const prev = process.env.STORE_RUN_SHOPPING_TIMEOUT_MIN;
    process.env.STORE_RUN_SHOPPING_TIMEOUT_MIN = '60';
    prisma.storeRun.updateManyAndReturn.mockResolvedValue([]);

    const before = Date.now();
    await StoreRunService.expireStaleShoppingRuns();
    const after = Date.now();

    const cutoff =
      prisma.storeRun.updateManyAndReturn.mock.calls[0][0].where.shoppingAt.lt.getTime();
    // cutoff must be ~60 min before "now"
    expect(cutoff).toBeGreaterThanOrEqual(before - 60 * 60 * 1000 - 1000);
    expect(cutoff).toBeLessThanOrEqual(after - 60 * 60 * 1000 + 1000);

    process.env.STORE_RUN_SHOPPING_TIMEOUT_MIN = prev;
  });
});
