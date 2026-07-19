import { StoreRunService } from '../../../services/store-run.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    storeRun: {
      updateManyAndReturn: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
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

describe('StoreRunService.autoCloseExpired (F5 race-free)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses a single conditional returning update guarded by status=COLLECTING', async () => {
    prisma.storeRun.updateManyAndReturn.mockResolvedValue([
      { id: 5 },
      { id: 8 },
    ]);

    const ids = await StoreRunService.autoCloseExpired();

    expect(ids).toEqual([5, 8]);
    expect(prisma.storeRun.updateManyAndReturn).toHaveBeenCalledTimes(1);
    const arg = prisma.storeRun.updateManyAndReturn.mock.calls[0][0];
    expect(arg.where.status).toBe('COLLECTING');
    expect(arg.data.status).toBe('SHOPPING');
    // must NOT do the old read-then-blind-update pair
    expect(prisma.storeRun.updateMany).not.toHaveBeenCalled();
  });

  it('returns [] when nothing matched', async () => {
    prisma.storeRun.updateManyAndReturn.mockResolvedValue([]);
    await expect(StoreRunService.autoCloseExpired()).resolves.toEqual([]);
  });
});
