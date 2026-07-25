import { NotificationService } from '../notification.service';
import { prisma } from '../../database/client';

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

const mockStoreRun = prisma.storeRun.findUnique as jest.Mock;

function makeDeleteBot(deleteMessageImpl: jest.Mock) {
  return {
    botInfo: { id: 999 },
    api: { deleteMessage: deleteMessageImpl, getChatMember: jest.fn() },
  };
}

describe('NotificationService.deleteStoreRunMessages', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
  });

  it('does nothing when bot is not initialized', async () => {
    await expect(service.deleteStoreRunMessages(5)).resolves.toBeUndefined();
    expect(mockStoreRun).not.toHaveBeenCalled();
  });

  it('does not throw when run not found', async () => {
    mockStoreRun.mockResolvedValue(null);
    const del = jest.fn();
    service.initialize(makeDeleteBot(del) as any);
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
    service.initialize(makeDeleteBot(del) as any);

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
    service.initialize(makeDeleteBot(del) as any);

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
    service.initialize(makeDeleteBot(del) as any);

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
    service.initialize(makeDeleteBot(del) as any);

    await expect(service.deleteStoreRunMessages(5)).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith(-1002512649185, 1327);
  });
});

function makeEditBot(editImpl: jest.Mock) {
  return { botInfo: { id: 999 }, api: { editMessageText: editImpl } };
}

describe('NotificationService.markStoreRunGroupCompleted', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
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
    service.initialize(makeEditBot(edit) as any);
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
    service.initialize(makeEditBot(edit) as any);

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
    service.initialize(makeEditBot(edit) as any);
    await expect(service.markStoreRunGroupCompleted(5)).resolves.toBeUndefined();
  });

  it('does not throw when run not found', async () => {
    mockStoreRun.mockResolvedValue(null);
    const edit = jest.fn();
    service.initialize(makeEditBot(edit) as any);
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

describe('NotificationService.notifyStoreRunParticipantsNoDebt', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
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
    service.initialize(makeSendBot(send) as any);

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
    service.initialize(makeSendBot(send) as any);

    await service.notifyStoreRunParticipantsNoDebt(5);
    expect(mockUsers).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('returns early when every participant is a debtor', async () => {
    mockStoreRun.mockResolvedValue({ initiatorId: 2, storeName: 'КБ' });
    mockItems.mockResolvedValue([{ userId: 111 }, { userId: 222 }]);
    mockTx.mockResolvedValue([{ fromUserId: 111 }, { fromUserId: 222 }]);
    const send = jest.fn();
    service.initialize(makeSendBot(send) as any);

    await service.notifyStoreRunParticipantsNoDebt(5);
    expect(mockUsers).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('returns [] without throwing when run not found', async () => {
    mockStoreRun.mockResolvedValue(null);
    const send = jest.fn();
    service.initialize(makeSendBot(send) as any);
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
    service.initialize(makeSendBot(send) as any);

    await expect(service.notifyStoreRunParticipantsNoDebt(5)).resolves.toHaveLength(2);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
