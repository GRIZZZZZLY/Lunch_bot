import {
  StoreRunService,
  StoreRunError,
} from '../../../services/store-run.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    storeRun: { findUnique: jest.fn() },
    groupMember: { findFirst: jest.fn() },
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

describe('StoreRunService.getStoreRunById membership gate (F4)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws FORBIDDEN when the requesting user is not a member of the run group', async () => {
    prisma.storeRun.findUnique.mockResolvedValue({
      id: 123,
      groupId: 9,
      items: [],
    });
    prisma.groupMember.findFirst.mockResolvedValue(null); // not a member

    await expect(StoreRunService.getStoreRunById(123, 7)).rejects.toMatchObject(
      {
        name: 'StoreRunError',
        code: 'FORBIDDEN',
      }
    );
  });

  it('returns the run when the requesting user is a member', async () => {
    const run = { id: 123, groupId: 9, items: [] };
    prisma.storeRun.findUnique.mockResolvedValue(run);
    prisma.groupMember.findFirst.mockResolvedValue({ id: 1 }); // member

    await expect(StoreRunService.getStoreRunById(123, 7)).resolves.toEqual(run);
  });

  it('returns null when the run does not exist (no membership check needed)', async () => {
    prisma.storeRun.findUnique.mockResolvedValue(null);
    await expect(StoreRunService.getStoreRunById(123, 7)).resolves.toBeNull();
  });
});
