/**
 * Ручные напоминания о долге: одному человеку или всем должникам заказа сразу.
 * Тесты закрепляют границы прав (напомнить может только получатель платежа) и
 * то, что счётчик напоминаний растёт только по факту доставки — недоставленное
 * напоминание не должно выглядеть как отправленное.
 */
import { ReminderService } from '../../../services/reminder.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const botInstance = asMock(getBotInstance);

const NOW = new Date('2026-08-03T12:00:00.000Z');

let service: ReminderService;
let sendMessage: jest.Mock;

/** Транзакция: должник 1 → получатель 2. */
function tx(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    fromUserId: 1,
    toUserId: 2,
    amount: 250,
    status: 'PENDING',
    createdAt: NOW,
    fromUser: { id: 1, firstName: 'Игорь', telegramId: BigInt(555) },
    toUser: {
      id: 2,
      firstName: 'Аня',
      telegramId: BigInt(777),
      paymentPhone: '+79990001122',
      paymentCard: 'https://pay/anya',
    },
    menuItem: { id: 1, name: 'Плов', price: 200 },
    poll: { id: 5, groupId: 100, group: { id: 100, title: 'Команда' } },
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  sendMessage = jest.fn().mockResolvedValue(undefined);
  botInstance.mockReturnValue({ api: { sendMessage } });

  service = new ReminderService();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('sendReminder', () => {
  beforeEach(() => {
    prismaMock.transaction.findUnique.mockResolvedValue(tx() as never);
    asMock(prismaMock.paymentReminder.create).mockResolvedValue({
      id: 1,
    });
    asMock(prismaMock.transaction.update).mockResolvedValue(tx());
  });

  it('получатель отправляет напоминание должнику', async () => {
    const result = await service.sendReminder(10, 2);

    expect(result).toEqual({ success: true });
    const [chatId, message] = sendMessage.mock.calls[0];
    expect(chatId).toBe(555);
    expect(message).toContain('Аня напоминает о платеже');
    expect(message).toContain('250.00₽');
    expect(message).toContain('Заказ в Команда');
    expect(message).toContain('СБП: +79990001122');
  });

  it('напоминание фиксируется и увеличивает счётчик', async () => {
    await service.sendReminder(10, 2);

    expect(prismaMock.paymentReminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transactionId: 10,
        type: 'MANUAL',
        sentBy: 2,
      }),
    });
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { reminderCount: { increment: 1 }, lastReminderAt: NOW },
    });
  });

  it('напомнить может только получатель платежа', async () => {
    const result = await service.sendReminder(10, 1);

    expect(result).toMatchObject({
      success: false,
      error: 'Only creditor can send reminders',
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('транзакции нет — понятный отказ', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(service.sendReminder(10, 2)).resolves.toMatchObject({
      success: false,
      error: 'Transaction not found',
    });
  });

  it('заблокированный бот классифицируется и счётчик не растёт', async () => {
    sendMessage.mockRejectedValue(
      Object.assign(new Error('Forbidden: bot was blocked by the user'), {
        error_code: 403,
      })
    );

    const result = await service.sendReminder(10, 2);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('bot_blocked');
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });

  it('без группы в заказе название подставляется общим словом', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      tx({ poll: null }) as never
    );

    await service.sendReminder(10, 2);

    expect(sendMessage.mock.calls[0][1]).toContain('Заказ в группа');
  });

  it('ошибка записи в базу превращается во внутреннюю ошибку', async () => {
    asMock(prismaMock.paymentReminder.create).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.sendReminder(10, 2)).resolves.toMatchObject({
      success: false,
      error: 'Internal error',
    });
  });
});

describe('sendRemindersToAll', () => {
  beforeEach(() => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx(),
      tx({ id: 11, fromUser: { id: 3, firstName: 'Оля', telegramId: BigInt(888) } }),
    ] as never);
    asMock(prismaMock.paymentReminder.createMany).mockResolvedValue({
      count: 2,
    });
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 2,
    });
  });

  it('рассылает всем должникам заказа и считает результат', async () => {
    const result = await service.sendRemindersToAll(5, 2);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pollId: 5, toUserId: 2, status: 'PENDING' },
      })
    );
    expect(result).toMatchObject({
      sentCount: 2,
      failedCount: 0,
      totalCount: 2,
      failedUsers: [],
    });
  });

  it('счётчики обновляются одной пачкой', async () => {
    await service.sendRemindersToAll(5, 2);

    expect(prismaMock.paymentReminder.createMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [10, 11] } },
      data: { reminderCount: { increment: 1 }, lastReminderAt: NOW },
    });
  });

  it('недоставленные перечисляются с причиной, счётчик им не растёт', async () => {
    sendMessage
      .mockRejectedValueOnce(
        Object.assign(new Error('Forbidden: bot was blocked by the user'), {
          error_code: 403,
        })
      )
      .mockResolvedValueOnce(undefined);

    const result = await service.sendRemindersToAll(5, 2);

    expect(result).toMatchObject({ sentCount: 1, failedCount: 1 });
    expect(result.failedUsers[0]).toMatchObject({
      id: 1,
      firstName: 'Игорь',
      errorCode: 'bot_blocked',
    });
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [11] } } })
    );
  });

  it('никому не доставлено — пачка не пишется', async () => {
    sendMessage.mockRejectedValue(new Error('network'));

    const result = await service.sendRemindersToAll(5, 2);

    expect(result).toMatchObject({ sentCount: 0, failedCount: 2 });
    expect(prismaMock.paymentReminder.createMany).not.toHaveBeenCalled();
    expect(prismaMock.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('без должников результат пустой', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);

    await expect(service.sendRemindersToAll(5, 2)).resolves.toMatchObject({
      totalCount: 0,
      sentCount: 0,
    });
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.sendRemindersToAll(5, 2)).rejects.toThrow('db down');
  });
});

describe('remindAllDebtors', () => {
  it('сообщает, сколько напоминаний ушло', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([tx()] as never);
    asMock(prismaMock.paymentReminder.createMany).mockResolvedValue({
      count: 1,
    });

    const reply = await ReminderService.remindAllDebtors(5, 2);

    expect(reply).toContain('Напоминания отправлены: 1 из 1');
  });

  it('нет должников — так и говорит', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);

    await expect(ReminderService.remindAllDebtors(5, 2)).resolves.toContain(
      'Все уже оплатили'
    );
  });

  it('недоставленные перечисляются по именам', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([tx()] as never);
    sendMessage.mockRejectedValue(new Error('bot blocked'));

    const reply = await ReminderService.remindAllDebtors(5, 2);

    expect(reply).toContain('Не удалось отправить: Игорь');
  });
});
