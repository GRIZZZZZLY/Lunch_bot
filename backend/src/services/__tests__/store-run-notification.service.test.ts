/**
 * Домен «иду в магазин»: уборка разосланных сообщений, правка группового поста
 * и расчёт с теми, у кого долга не возникло. Выделено из
 * `notification.service.test.ts` вместе с кодом.
 */
import { StoreRunNotificationService } from '../store-run-notification.service';
import { prisma } from '../../database/client';
import { getBotInstance } from '../../bot/bot-instance';

jest.mock('../../database/client', () => ({
  prisma: {
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

const mockStoreRun = prisma.storeRun.findUnique as jest.Mock;

function makeDeleteBot(deleteMessageImpl: jest.Mock) {
  return {
    botInfo: { id: 999 },
    api: { deleteMessage: deleteMessageImpl, getChatMember: jest.fn() },
  };
}

describe('StoreRunNotificationService.deleteStoreRunMessages', () => {
  let service: StoreRunNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StoreRunNotificationService();
    // Каждый тест сам решает, поднят ли бот: синглтон общий на файл.
    mockedGetBotInstance.mockReturnValue(null);
  });

  it('does nothing when bot is not initialized', async () => {
    await expect(service.deleteStoreRunMessages(5)).resolves.toBeUndefined();
    expect(mockStoreRun).not.toHaveBeenCalled();
  });

  it('does not throw when run not found', async () => {
    mockStoreRun.mockResolvedValue(null);
    const del = jest.fn();
    useBot(makeDeleteBot(del));
    await expect(service.deleteStoreRunMessages(5)).resolves.toBeUndefined();
    expect(del).not.toHaveBeenCalled();
  });

  it('deletes the group post and every DM', async () => {
    mockStoreRun.mockResolvedValue({
      groupMessageId: 1327,
      dmMessages: JSON.stringify([
        { chatId: 111, messageId: 5 },
        { chatId: 222, messageId: 6 },
      ]),
      group: { telegramId: BigInt('-1002512649185') },
    });
    const del = jest.fn().mockResolvedValue(true);
    useBot(makeDeleteBot(del));

    await service.deleteStoreRunMessages(5);

    expect(del).toHaveBeenCalledTimes(3);
    expect(del).toHaveBeenCalledWith(-1002512649185, 1327);
    expect(del).toHaveBeenCalledWith(111, 5);
    expect(del).toHaveBeenCalledWith(222, 6);
  });

  it('tolerates a deleteMessage failure and still deletes the rest', async () => {
    mockStoreRun.mockResolvedValue({
      groupMessageId: 1327,
      dmMessages: JSON.stringify([{ chatId: 111, messageId: 5 }]),
      group: { telegramId: BigInt('-1002512649185') },
    });
    const del = jest
      .fn()
      .mockRejectedValueOnce(new Error('message to delete not found'))
      .mockResolvedValue(true);
    useBot(makeDeleteBot(del));

    await expect(service.deleteStoreRunMessages(5)).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledTimes(2);
  });

  it('skips deletion when there are no stored message ids', async () => {
    mockStoreRun.mockResolvedValue({
      groupMessageId: null,
      dmMessages: null,
      group: { telegramId: BigInt('-1002512649185') },
    });
    const del = jest.fn();
    useBot(makeDeleteBot(del));

    await service.deleteStoreRunMessages(5);
    expect(del).not.toHaveBeenCalled();
  });

  it('does not throw on invalid dmMessages JSON, still deletes group post', async () => {
    mockStoreRun.mockResolvedValue({
      groupMessageId: 1327,
      dmMessages: 'not-json',
      group: { telegramId: BigInt('-1002512649185') },
    });
    const del = jest.fn().mockResolvedValue(true);
    useBot(makeDeleteBot(del));

    await expect(service.deleteStoreRunMessages(5)).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith(-1002512649185, 1327);
  });
});

function makeEditBot(editImpl: jest.Mock) {
  return { botInfo: { id: 999 }, api: { editMessageText: editImpl } };
}

describe('StoreRunNotificationService.markStoreRunGroupCompleted', () => {
  let service: StoreRunNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StoreRunNotificationService();
    // Каждый тест сам решает, поднят ли бот: синглтон общий на файл.
    mockedGetBotInstance.mockReturnValue(null);
  });

  it('does nothing when bot is not initialized', async () => {
    await expect(service.markStoreRunGroupCompleted(5)).resolves.toBeUndefined();
    expect(mockStoreRun).not.toHaveBeenCalled();
  });

  it('skips when there is no group message id', async () => {
    mockStoreRun.mockResolvedValue({
      groupMessageId: null,
      storeName: 'КБ',
      group: { telegramId: BigInt('-1002512649185') },
    });
    const edit = jest.fn();
    useBot(makeEditBot(edit));
    await service.markStoreRunGroupCompleted(5);
    expect(edit).not.toHaveBeenCalled();
  });

  it('edits the group post and drops the inline button', async () => {
    mockStoreRun.mockResolvedValue({
      groupMessageId: 1327,
      storeName: 'КБ',
      group: { telegramId: BigInt('-1002512649185') },
    });
    const edit = jest.fn().mockResolvedValue(true);
    useBot(makeEditBot(edit));

    await service.markStoreRunGroupCompleted(5);

    expect(edit).toHaveBeenCalledTimes(1);
    const [chatId, messageId, text, other] = edit.mock.calls[0];
    expect(chatId).toBe(-1002512649185);
    expect(messageId).toBe(1327);
    expect(text).toContain('завершён');
    expect(other).toEqual({ parse_mode: 'HTML' });
    expect(other.reply_markup).toBeUndefined();
  });

  it('does not throw when editMessageText fails', async () => {
    mockStoreRun.mockResolvedValue({
      groupMessageId: 1327,
      storeName: 'КБ',
      group: { telegramId: BigInt('-1002512649185') },
    });
    const edit = jest.fn().mockRejectedValue(new Error('message is not modified'));
    useBot(makeEditBot(edit));
    await expect(service.markStoreRunGroupCompleted(5)).resolves.toBeUndefined();
  });

  it('does not throw when run not found', async () => {
    mockStoreRun.mockResolvedValue(null);
    const edit = jest.fn();
    useBot(makeEditBot(edit));
    await expect(service.markStoreRunGroupCompleted(5)).resolves.toBeUndefined();
    expect(edit).not.toHaveBeenCalled();
  });
});

const mockItems = prisma.storeItem.findMany as jest.Mock;
const mockTx = prisma.transaction.findMany as jest.Mock;
const mockUsers = prisma.user.findMany as jest.Mock;
const mockUserUnique = prisma.user.findUnique as jest.Mock;

function makeSendBot(sendImpl: jest.Mock) {
  return { botInfo: { id: 999 }, api: { sendMessage: sendImpl } };
}

describe('StoreRunNotificationService.notifyStoreRunParticipantsNoDebt', () => {
  let service: StoreRunNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StoreRunNotificationService();
    // Каждый тест сам решает, поднят ли бот: синглтон общий на файл.
    mockedGetBotInstance.mockReturnValue(null);
    mockUserUnique.mockResolvedValue({ isActive: true });
  });

  it('notifies participants without a debt, excluding initiator and debtors', async () => {
    mockStoreRun.mockResolvedValue({ initiatorId: 2, storeName: 'КБ' });
    mockItems.mockResolvedValue([
      { userId: 111 },
      { userId: 222 },
      { userId: 333 },
      { userId: 2 },
    ]);
    mockTx.mockResolvedValue([{ fromUserId: 111 }]);
    mockUsers.mockResolvedValue([
      { id: 222, telegramId: BigInt(2220) },
      { id: 333, telegramId: BigInt(3330) },
    ]);
    const send = jest.fn().mockResolvedValue({ message_id: 1 });
    useBot(makeSendBot(send));

    await service.notifyStoreRunParticipantsNoDebt(5);

    const whereArg = mockUsers.mock.calls[0][0].where;
    expect([...whereArg.id.in].sort((a: number, b: number) => a - b)).toEqual([222, 333]);
    expect(whereArg.isActive).toBe(true);
    expect(whereArg.participatesInPolls).toBeUndefined();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(2220, expect.stringContaining('завершён'), expect.any(Object));
    expect(send).toHaveBeenCalledWith(3330, expect.stringContaining('платить не надо'), expect.any(Object));
  });

  it('returns early when there are no participants (only initiator)', async () => {
    mockStoreRun.mockResolvedValue({ initiatorId: 2, storeName: 'КБ' });
    mockItems.mockResolvedValue([{ userId: 2 }]);
    const send = jest.fn();
    useBot(makeSendBot(send));

    await service.notifyStoreRunParticipantsNoDebt(5);
    expect(mockUsers).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('returns early when every participant is a debtor', async () => {
    mockStoreRun.mockResolvedValue({ initiatorId: 2, storeName: 'КБ' });
    mockItems.mockResolvedValue([{ userId: 111 }, { userId: 222 }]);
    mockTx.mockResolvedValue([{ fromUserId: 111 }, { fromUserId: 222 }]);
    const send = jest.fn();
    useBot(makeSendBot(send));

    await service.notifyStoreRunParticipantsNoDebt(5);
    expect(mockUsers).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('returns [] without throwing when run not found', async () => {
    mockStoreRun.mockResolvedValue(null);
    const send = jest.fn();
    useBot(makeSendBot(send));
    await expect(service.notifyStoreRunParticipantsNoDebt(5)).resolves.toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it('tolerates a send failure and still returns a result per recipient', async () => {
    mockStoreRun.mockResolvedValue({ initiatorId: 2, storeName: 'КБ' });
    mockItems.mockResolvedValue([{ userId: 222 }, { userId: 333 }]);
    mockTx.mockResolvedValue([]);
    mockUsers.mockResolvedValue([
      { id: 222, telegramId: BigInt(2220) },
      { id: 333, telegramId: BigInt(3330) },
    ]);
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('bot blocked by user'))
      .mockResolvedValue({ message_id: 1 });
    useBot(makeSendBot(send));

    await expect(service.notifyStoreRunParticipantsNoDebt(5)).resolves.toHaveLength(2);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
