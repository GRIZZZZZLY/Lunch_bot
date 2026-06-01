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
