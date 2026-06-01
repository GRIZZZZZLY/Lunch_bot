import { NotificationService } from '../notification.service';
import { prisma } from '../../database/client';

jest.mock('../../database/client', () => ({
  prisma: {
    group: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockGroup = prisma.group.findUnique as jest.Mock;

function makeBot(getChatMemberImpl: jest.Mock) {
  return {
    botInfo: { id: 999 },
    api: { getChatMember: getChatMemberImpl },
  };
}

describe('NotificationService.botCanPostToGroup', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
    mockGroup.mockResolvedValue({ telegramId: BigInt('-1002512649185') });
  });

  it('returns false when bot is not initialized', async () => {
    const result = await service.botCanPostToGroup(2);
    expect(result).toBe(false);
  });

  it('returns false when group not found', async () => {
    mockGroup.mockResolvedValue(null);
    service.initialize(makeBot(jest.fn()) as any);
    const result = await service.botCanPostToGroup(2);
    expect(result).toBe(false);
  });

  it('returns true when bot is a regular member', async () => {
    const getChatMember = jest.fn().mockResolvedValue({ status: 'member' });
    service.initialize(makeBot(getChatMember) as any);
    const result = await service.botCanPostToGroup(2);
    expect(result).toBe(true);
    expect(getChatMember).toHaveBeenCalledWith(-1002512649185, 999);
  });

  it('returns true when bot is an administrator', async () => {
    service.initialize(makeBot(jest.fn().mockResolvedValue({ status: 'administrator' })) as any);
    expect(await service.botCanPostToGroup(2)).toBe(true);
  });

  it('returns false when bot status is left', async () => {
    service.initialize(makeBot(jest.fn().mockResolvedValue({ status: 'left' })) as any);
    expect(await service.botCanPostToGroup(2)).toBe(false);
  });

  it('returns false when bot status is kicked', async () => {
    service.initialize(makeBot(jest.fn().mockResolvedValue({ status: 'kicked' })) as any);
    expect(await service.botCanPostToGroup(2)).toBe(false);
  });

  it('returns false when getChatMember throws (403 kicked)', async () => {
    const getChatMember = jest.fn().mockRejectedValue(
      new Error("Forbidden: bot was kicked from the supergroup chat"),
    );
    service.initialize(makeBot(getChatMember) as any);
    expect(await service.botCanPostToGroup(2)).toBe(false);
  });
});
