/**
 * Транспорт: проверка «может ли бот вообще писать в эту группу». Осталась в
 * `notification.service`, потому что её спрашивают оба домена — забеги перед
 * созданием и регулярные голосования перед постановкой.
 */
import { NotificationService } from '../notification.service';
import { prisma } from '../../database/client';
import { getBotInstance } from '../../bot/bot-instance';

jest.mock('../../database/client', () => ({
  prisma: {
    group: {
      findUnique: jest.fn(),
    },
    storeRun: {
      findUnique: jest.fn(),
    },
    storeItem: {
      findMany: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

/**
 * Бот берётся из общего синглтона, а не из `initialize(bot)` на экземпляре.
 * Поэтому «бот не поднят» здесь — пустой синглтон, а поднятый бот
 * подставляется через `useBot(...)`.
 */
jest.mock('../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(),
}));

const mockedGetBotInstance = getBotInstance as jest.MockedFunction<
  typeof getBotInstance
>;

function useBot(bot: unknown): void {
  mockedGetBotInstance.mockReturnValue(bot as never);
}

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
    // Каждый тест сам решает, поднят ли бот: синглтон общий на файл.
    mockedGetBotInstance.mockReturnValue(null);
    mockGroup.mockResolvedValue({ telegramId: BigInt('-1002512649185') });
  });

  it('returns false when bot is not initialized', async () => {
    const result = await service.botCanPostToGroup(2);
    expect(result).toBe(false);
  });

  it('returns false when group not found', async () => {
    mockGroup.mockResolvedValue(null);
    useBot(makeBot(jest.fn()));
    const result = await service.botCanPostToGroup(2);
    expect(result).toBe(false);
  });

  it('returns true when bot is a regular member', async () => {
    const getChatMember = jest.fn().mockResolvedValue({ status: 'member' });
    useBot(makeBot(getChatMember));
    const result = await service.botCanPostToGroup(2);
    expect(result).toBe(true);
    expect(getChatMember).toHaveBeenCalledWith(-1002512649185, 999);
  });

  it('returns true when bot is an administrator', async () => {
    useBot(makeBot(jest.fn().mockResolvedValue({ status: 'administrator' })));
    expect(await service.botCanPostToGroup(2)).toBe(true);
  });

  it('returns false when bot status is left', async () => {
    useBot(makeBot(jest.fn().mockResolvedValue({ status: 'left' })));
    expect(await service.botCanPostToGroup(2)).toBe(false);
  });

  it('returns false when bot status is kicked', async () => {
    useBot(makeBot(jest.fn().mockResolvedValue({ status: 'kicked' })));
    expect(await service.botCanPostToGroup(2)).toBe(false);
  });

  it('returns false when getChatMember throws (403 kicked)', async () => {
    const getChatMember = jest.fn().mockRejectedValue(
      new Error("Forbidden: bot was kicked from the supergroup chat"),
    );
    useBot(makeBot(getChatMember));
    expect(await service.botCanPostToGroup(2)).toBe(false);
  });
});
