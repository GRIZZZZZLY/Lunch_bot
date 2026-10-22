import { GroupService } from '../../../services/group.service';

jest.mock('../../../database/client', () => ({
  prisma: { group: { findMany: jest.fn(), update: jest.fn() } },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const getMe = jest.fn();
const getChatMember = jest.fn();
jest.mock('../../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(() => ({ api: { getMe, getChatMember } })),
}));

const { prisma } = require('../../../database/client');

const botInstance = require('../../../bot/bot-instance');

describe('GroupService.reconcileActiveGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getMe.mockResolvedValue({ id: 999 });
    botInstance.getBotInstance.mockReturnValue({
      api: { getMe, getChatMember },
    });
    prisma.group.update.mockResolvedValue({});
  });

  it('skips when the bot is not initialized', async () => {
    botInstance.getBotInstance.mockReturnValue(null);

    const ids = await GroupService.reconcileActiveGroups();

    expect(ids).toEqual([]);
    expect(prisma.group.findMany).not.toHaveBeenCalled();
  });
});
