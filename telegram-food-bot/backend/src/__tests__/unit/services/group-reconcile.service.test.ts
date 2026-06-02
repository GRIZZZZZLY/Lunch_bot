import { GroupService } from '../../../services/group.service';

jest.mock('../../../database/client', () => ({
  prisma: { group: { findMany: jest.fn(), update: jest.fn() } },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const getMe = jest.fn();
const getChatMember = jest.fn();
jest.mock('../../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(() => ({ api: { getMe, getChatMember } })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../../../database/client');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const botInstance = require('../../../bot/bot-instance');

describe('GroupService.reconcileActiveGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getMe.mockResolvedValue({ id: 999 });
    botInstance.getBotInstance.mockReturnValue({ api: { getMe, getChatMember } });
    prisma.group.update.mockResolvedValue({});
  });

  it('deactivates groups where the bot was kicked, keeps the rest', async () => {
    prisma.group.findMany.mockResolvedValue([
      { id: 1, telegramId: 111n },
      { id: 2, telegramId: 222n },
    ]);
    getChatMember.mockImplementation((chatId: number) => {
      if (chatId === 222) {
        return Promise.reject(
          Object.assign(new Error('kicked'), {
            error_code: 403,
            description: 'Forbidden: bot was kicked from the supergroup chat',
          }),
        );
      }
      return Promise.resolve({ status: 'administrator' });
    });

    const ids = await GroupService.reconcileActiveGroups();

    expect(ids).toEqual([2]);
    expect(prisma.group.update).toHaveBeenCalledTimes(1);
    expect(prisma.group.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 2 } }),
    );
  });

  it("deactivates when getChatMember returns status 'left'", async () => {
    prisma.group.findMany.mockResolvedValue([{ id: 5, telegramId: 555n }]);
    getChatMember.mockResolvedValue({ status: 'left' });

    const ids = await GroupService.reconcileActiveGroups();

    expect(ids).toEqual([5]);
  });

  it('keeps the group active on a transient (non-403) error', async () => {
    prisma.group.findMany.mockResolvedValue([{ id: 7, telegramId: 777n }]);
    getChatMember.mockRejectedValue(Object.assign(new Error('timeout'), { error_code: 500 }));

    const ids = await GroupService.reconcileActiveGroups();

    expect(ids).toEqual([]);
    expect(prisma.group.update).not.toHaveBeenCalled();
  });

  it('skips when the bot is not initialized', async () => {
    botInstance.getBotInstance.mockReturnValue(null);

    const ids = await GroupService.reconcileActiveGroups();

    expect(ids).toEqual([]);
    expect(prisma.group.findMany).not.toHaveBeenCalled();
  });
});
