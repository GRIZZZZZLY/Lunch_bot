/**
 * BudgetService, статические методы: превращение результатов голосования в долги
 * и переходы их статусов. Это деньги, поэтому закреплены именно те свойства,
 * потеря которых стоит денег:
 *
 * - создание транзакций идемпотентно: повторный вызов не удваивает долги;
 * - ответственный не платит сам себе;
 * - переходы статусов атомарны (updateMany со статусом в условии), поэтому
 *   гонка не превращает PENDING в CONFIRMED «мимо» PAID;
 * - отменить подтверждение может только получатель и только в течение суток,
 *   и должнику об этом сообщают обязательно — ему уже сказали обратное.
 */
import { BudgetService } from '../../../services/budget.service';
import { PollService } from '../../../services/poll.service';
import { UserService } from '../../../services/user.service';
import { eventBus } from '../../../services/event-bus.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/poll.service', () => ({
  PollService: { getPollById: jest.fn() },
}));

jest.mock('../../../services/user.service', () => ({
  UserService: { getPaymentInfo: jest.fn(), getUserById: jest.fn() },
}));

jest.mock('../../../services/event-bus.service', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}));

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const pollService = asServiceMock(PollService);
const userService = asServiceMock(UserService);
const bus = asServiceMock(eventBus);
const botInstance = asMock(getBotInstance);

const NOW = new Date('2026-08-03T12:00:00.000Z');

/** Результаты голосования: Плов на двоих, один принёс своё. */
const RESULT_DATA = {
  winners: [
    {
      menuItemId: 1,
      menuItemName: 'Плов',
      voteCount: 2,
      menuItemSnapshot: { price: 250 },
      voters: [
        { userId: 1, firstName: 'Игорь' },
        { userId: 2, firstName: 'Аня' },
      ],
    },
  ],
  bringOwn: { count: 1, voters: [{ firstName: 'Оля' }] },
};

function pollFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    groupId: 100,
    result: { rouletteData: JSON.stringify(RESULT_DATA) },
    ...overrides,
  };
}

function txFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    pollId: 5,
    fromUserId: 1,
    toUserId: 2,
    amount: 250,
    status: 'PENDING',
    confirmedAt: null,
    debtMessageId: null,
    debtChatId: null,
    fromUser: { id: 1, firstName: 'Игорь', username: 'igor', telegramId: BigInt(555) },
    toUser: { id: 2, firstName: 'Аня', telegramId: BigInt(777) },
    menuItem: { id: 1, name: 'Плов', price: 250 },
    ...overrides,
  };
}

let sendMessage: jest.Mock;
let editMessageText: jest.Mock;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  sendMessage = jest.fn().mockResolvedValue({ message_id: 42 });
  editMessageText = jest.fn().mockResolvedValue(undefined);
  botInstance.mockReturnValue({ api: { sendMessage, editMessageText } });

  pollService.getPollById.mockResolvedValue(pollFixture());
  userService.getPaymentInfo.mockResolvedValue({
    paymentCard: '1234567890123456',
    paymentPhone: '+79990001122',
    paymentDetails: 'СБП',
  });
  userService.getUserById.mockResolvedValue({
    id: 2,
    firstName: 'Аня',
    lastName: null,
    telegramId: BigInt(777),
  });

  asMock(prismaMock.transaction.count).mockResolvedValue(0);
  asMock(prismaMock.transaction.createMany).mockResolvedValue({
    count: 1,
  });
  asMock(prismaMock.transaction.findMany).mockResolvedValue([
    txFixture(),
  ] as never);
  asMock(prismaMock.transaction.updateMany).mockResolvedValue({
    count: 1,
  });
  asMock(prismaMock.transaction.updateManyAndReturn).mockResolvedValue([
    { id: 10 },
  ] as never);
  prismaMock.transaction.findUnique.mockResolvedValue(txFixture() as never);
  asMock(prismaMock.responsibleSelection.findUnique).mockResolvedValue({
    messageId: 42,
    chatId: BigInt(-1001),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createTransactionsFromPoll', () => {
  it('создаёт долг каждому, кроме ответственного', async () => {
    await BudgetService.createTransactionsFromPoll(5, 2);

    expect(prismaMock.transaction.createMany).toHaveBeenCalledWith({
      data: [
        {
          pollId: 5,
          fromUserId: 1,
          toUserId: 2,
          amount: 250,
          menuItemId: 1,
          status: 'PENDING',
        },
      ],
    });
  });

  it('повторный вызов не удваивает долги', async () => {
    asMock(prismaMock.transaction.count).mockResolvedValue(2);

    await BudgetService.createTransactionsFromPoll(5, 2);

    expect(prismaMock.transaction.createMany).not.toHaveBeenCalled();
  });

  it('без должников (все — ответственный) вставки нет', async () => {
    pollService.getPollById.mockResolvedValue(
      pollFixture({
        result: {
          rouletteData: JSON.stringify({
            winners: [
              {
                menuItemId: 1,
                menuItemName: 'Плов',
                voteCount: 1,
                menuItemSnapshot: { price: 250 },
                voters: [{ userId: 2, firstName: 'Аня' }],
              },
            ],
            bringOwn: { count: 0, voters: [] },
          }),
        },
      })
    );

    await BudgetService.createTransactionsFromPoll(5, 2);

    expect(prismaMock.transaction.createMany).not.toHaveBeenCalled();
  });

  it('без результатов голосования — понятная ошибка', async () => {
    pollService.getPollById.mockResolvedValue(pollFixture({ result: null }));

    await expect(
      BudgetService.createTransactionsFromPoll(5, 2)
    ).rejects.toThrow('Poll result data not found');
  });
});

describe('calculateTotals', () => {
  it('считает сумму заказа, долю ответственного и возврат', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ amount: 250 }),
    ] as never);

    const totals = await BudgetService.calculateTotals(5, 2);

    expect(totals).toEqual({
      totalOrder: 500,
      totalToReturn: 250,
      responsibleShare: 250,
      netCost: 250,
    });
  });

  it('ответственный без заказа имеет нулевую долю', async () => {
    const totals = await BudgetService.calculateTotals(5, 99);

    expect(totals.responsibleShare).toBe(0);
  });

  it('без результатов — ошибка', async () => {
    pollService.getPollById.mockResolvedValue(pollFixture({ result: null }));

    await expect(BudgetService.calculateTotals(5, 2)).rejects.toThrow(
      'Poll result data not found'
    );
  });
});

describe('processResponsibleSelected', () => {
  it('создаёт долги и рассылает уведомления', async () => {
    await BudgetService.processResponsibleSelected(5, 2);

    expect(prismaMock.transaction.createMany).toHaveBeenCalled();
    // Ответственному и должнику.
    expect(sendMessage).toHaveBeenCalled();
  });

  it('падение записи в базу выбрасывается наружу — вызывающий повторит', async () => {
    asMock(prismaMock.transaction.createMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      BudgetService.processResponsibleSelected(5, 2)
    ).rejects.toThrow('db down');
  });

  it('падение уведомлений не откатывает уже созданные долги', async () => {
    sendMessage.mockRejectedValue(new Error('telegram down'));

    await expect(
      BudgetService.processResponsibleSelected(5, 2)
    ).resolves.toBeUndefined();
    expect(prismaMock.transaction.createMany).toHaveBeenCalled();
  });
});

describe('sendBudgetNotifications', () => {
  it('ответственный получает список заказов и итоги', async () => {
    await BudgetService.sendBudgetNotifications(5, 2, [txFixture()]);

    const responsibleMessage = sendMessage.mock.calls[0][1] as string;
    expect(responsibleMessage).toContain('Ты оформляешь заказ');
    expect(responsibleMessage).toContain('Плов — 2 чел. (500.00₽)');
    expect(responsibleMessage).toContain('Своё: Оля');
    expect(responsibleMessage).toContain('Сумма заказа: 500.00₽');
  });

  it('карта ответственного показывается ему замаскированной', async () => {
    await BudgetService.sendBudgetNotifications(5, 2, [txFixture()]);

    const responsibleMessage = sendMessage.mock.calls[0][1] as string;
    expect(responsibleMessage).not.toContain('1234567890123456');
  });

  it('должник получает сумму и реквизиты', async () => {
    await BudgetService.sendBudgetNotifications(5, 2, [txFixture()]);

    const debtMessage = sendMessage.mock.calls[1][1] as string;
    expect(debtMessage).toContain('Твой заказ: Плов');
    expect(debtMessage).toContain('Ответственный:* Аня');
    expect(debtMessage).toContain('+79990001122');
    expect(debtMessage).toContain('СБП');
  });

  it('групповое сообщение обновляется итогами', async () => {
    await BudgetService.sendBudgetNotifications(5, 2, [txFixture()]);

    expect(editMessageText).toHaveBeenCalledWith(
      -1001,
      42,
      expect.stringContaining('Ответственный:* Аня'),
      { parse_mode: 'Markdown' }
    );
  });

  it('без сообщения выбора группу не правим', async () => {
    asMock(prismaMock.responsibleSelection.findUnique).mockResolvedValue(
      null
    );

    await BudgetService.sendBudgetNotifications(5, 2, [txFixture()]);

    expect(editMessageText).not.toHaveBeenCalled();
  });

  it('неизвестный ответственный останавливает рассылку', async () => {
    userService.getUserById.mockResolvedValue(null);

    await BudgetService.sendBudgetNotifications(5, 2, [txFixture()]);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('ответственный без реквизитов всё равно получает сводку', async () => {
    userService.getPaymentInfo.mockResolvedValue(null);

    await BudgetService.sendBudgetNotifications(5, 2, [txFixture()]);

    expect(sendMessage.mock.calls[0][1]).toContain('Ты оформляешь заказ');
  });
});

describe('markAsPaid', () => {
  it('должник отмечает оплату, получателю уходит кнопка подтверждения', async () => {
    await BudgetService.markAsPaid(10, 1);

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 10, fromUserId: 1, status: 'PENDING' },
      data: { status: 'PAID', paidAt: NOW },
    });
    expect(sendMessage).toHaveBeenCalledWith(
      777,
      expect.stringContaining('Получена оплата'),
      expect.objectContaining({
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Подтвердить ✅', callback_data: 'budget:confirm:10' }],
          ],
        },
      })
    );
  });

  it('событие об изменении долга адресовано обеим сторонам', async () => {
    await BudgetService.markAsPaid(10, 1);

    expect(bus.emit).toHaveBeenCalledWith(
      'debt_updated',
      expect.objectContaining({ transactionId: 10, audience: [1, 2] })
    );
  });

  it('повторная отметка идемпотентна', async () => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 0,
    });
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID' }) as never
    );

    await expect(BudgetService.markAsPaid(10, 1)).resolves.toMatchObject({
      status: 'PAID',
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('подтверждённый платёж менять нельзя', async () => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 0,
    });
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'CONFIRMED' }) as never
    );

    await expect(BudgetService.markAsPaid(10, 1)).rejects.toThrow(
      'Cannot modify confirmed payment'
    );
  });

  it('чужой долг отметить нельзя', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ fromUserId: 99 }) as never
    );

    await expect(BudgetService.markAsPaid(10, 1)).rejects.toThrow(
      'Access denied'
    );
  });

  it('транзакции нет — ошибка', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(BudgetService.markAsPaid(10, 1)).rejects.toThrow(
      'Transaction not found'
    );
  });

  it('неожиданный статус — гонка распознаётся', async () => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 0,
    });
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'FORGIVEN' }) as never
    );

    await expect(BudgetService.markAsPaid(10, 1)).rejects.toThrow(
      'Transaction state changed'
    );
  });
});

describe('confirmPayment', () => {
  beforeEach(() => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID' }) as never
    );
  });

  it('получатель подтверждает оплату', async () => {
    await BudgetService.confirmPayment(10, 2);

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 10, toUserId: 2, status: 'PAID' },
      data: { status: 'CONFIRMED', confirmedAt: NOW },
    });
  });

  it('старое сообщение о долге переписывается, дубля не будет', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID', debtMessageId: 33, debtChatId: 555 }) as never
    );

    await BudgetService.confirmPayment(10, 2);

    expect(editMessageText).toHaveBeenCalledWith(
      555,
      33,
      expect.stringContaining('Оплата подтверждена'),
      { reply_markup: { inline_keyboard: [] } }
    );
    expect(sendMessage).not.toHaveBeenCalledWith(
      555,
      expect.stringContaining('Оплата подтверждена')
    );
  });

  it('если старое сообщение не поправить — отправляется новое', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID', debtMessageId: 33, debtChatId: 555 }) as never
    );
    editMessageText.mockRejectedValue(new Error('message not found'));

    await BudgetService.confirmPayment(10, 2);

    expect(sendMessage).toHaveBeenCalledWith(
      555,
      expect.stringContaining('Оплата подтверждена')
    );
  });

  it('неоплаченный долг подтвердить нельзя', async () => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 0,
    });
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PENDING' }) as never
    );

    await expect(BudgetService.confirmPayment(10, 2)).rejects.toThrow(
      'Cannot confirm unpaid transaction'
    );
  });

  it('повторное подтверждение идемпотентно', async () => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 0,
    });
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'CONFIRMED' }) as never
    );

    await expect(BudgetService.confirmPayment(10, 2)).resolves.toMatchObject({
      status: 'CONFIRMED',
    });
  });

  it('подтвердить может только получатель', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID', toUserId: 99 }) as never
    );

    await expect(BudgetService.confirmPayment(10, 2)).rejects.toThrow(
      'Access denied'
    );
  });

  it('после подтверждения проверяется, все ли закрыли долг', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ status: 'CONFIRMED' }),
    ] as never);

    await BudgetService.confirmPayment(10, 2);

    expect(sendMessage).toHaveBeenCalledWith(
      777,
      expect.stringContaining('Все оплатили'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
  });

  it('у магазинной транзакции (без pollId) проверки «все оплатили» нет', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID', pollId: null }) as never
    );

    await BudgetService.confirmPayment(10, 2);

    expect(sendMessage).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Все оплатили'),
      expect.anything()
    );
  });
});

describe('undoConfirmation', () => {
  const confirmed = () =>
    txFixture({
      status: 'CONFIRMED',
      confirmedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
    });

  beforeEach(() => {
    prismaMock.transaction.findUnique.mockResolvedValue(confirmed() as never);
  });

  it('получатель отменяет подтверждение в течение суток', async () => {
    await BudgetService.undoConfirmation(10, 2);

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 10, toUserId: 2, status: 'CONFIRMED' },
      data: { status: 'PAID', confirmedAt: null },
    });
  });

  it('должнику сообщают обязательно — ему уже сказали обратное', async () => {
    await BudgetService.undoConfirmation(10, 2);

    expect(sendMessage).toHaveBeenCalledWith(
      555,
      expect.stringContaining('Подтверждение оплаты отменено')
    );
  });

  it('противоречащее старое сообщение переписывается', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({
        status: 'CONFIRMED',
        confirmedAt: NOW,
        debtMessageId: 33,
        debtChatId: 555,
      }) as never
    );

    await BudgetService.undoConfirmation(10, 2);

    expect(editMessageText).toHaveBeenCalledWith(
      555,
      33,
      expect.stringContaining('отменено'),
      { reply_markup: { inline_keyboard: [] } }
    );
  });

  it('окно отмены — сутки', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({
        status: 'CONFIRMED',
        confirmedAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000),
      }) as never
    );

    await expect(BudgetService.undoConfirmation(10, 2)).rejects.toThrow(
      'Undo window has expired'
    );
  });

  it('без времени подтверждения отмена невозможна', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'CONFIRMED', confirmedAt: null }) as never
    );

    await expect(BudgetService.undoConfirmation(10, 2)).rejects.toThrow(
      'Undo window has expired'
    );
  });

  it('неподтверждённый платёж отменять нечего', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID' }) as never
    );

    await expect(BudgetService.undoConfirmation(10, 2)).rejects.toThrow(
      'Only a confirmed payment can be undone'
    );
  });

  it('отменить может только получатель', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'CONFIRMED', confirmedAt: NOW, toUserId: 99 }) as never
    );

    await expect(BudgetService.undoConfirmation(10, 2)).rejects.toThrow(
      'Access denied'
    );
  });

  it('транзакции нет — ошибка', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(BudgetService.undoConfirmation(10, 2)).rejects.toThrow(
      'Transaction not found'
    );
  });

  it('гонка на записи распознаётся', async () => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 0,
    });

    await expect(BudgetService.undoConfirmation(10, 2)).rejects.toThrow(
      'Transaction state changed'
    );
  });

  it('недоставленное уведомление не отменяет саму отмену', async () => {
    sendMessage.mockRejectedValue(new Error('bot blocked'));

    await expect(BudgetService.undoConfirmation(10, 2)).resolves.toBeDefined();
  });
});

describe('markAllPaidByResponsible', () => {
  it('закрывает все незакрытые долги заказа', async () => {
    await BudgetService.markAllPaidByResponsible(5, 2);

    expect(prismaMock.transaction.updateManyAndReturn).toHaveBeenCalledWith({
      where: { pollId: 5, toUserId: 2, status: { in: ['PENDING', 'PAID'] } },
      data: { status: 'CONFIRMED', confirmedAt: NOW },
      select: { id: true },
    });
  });

  it('каждому должнику сообщают, сборщику — сводку', async () => {
    await BudgetService.markAllPaidByResponsible(5, 2);

    expect(sendMessage).toHaveBeenCalledWith(
      555,
      expect.stringContaining('Оплата подтверждена')
    );
    expect(sendMessage).toHaveBeenCalledWith(
      777,
      expect.stringContaining('Все оплатили'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
  });

  it('старое сообщение о долге правится, если известно', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ debtMessageId: 33, debtChatId: 555 }),
    ] as never);

    await BudgetService.markAllPaidByResponsible(5, 2);

    expect(editMessageText).toHaveBeenCalledWith(
      555,
      33,
      expect.stringContaining('Оплата подтверждена'),
      { reply_markup: { inline_keyboard: [] } }
    );
  });

  it('нечего закрывать — уведомлений нет', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);

    await BudgetService.markAllPaidByResponsible(5, 2);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.updateManyAndReturn).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      BudgetService.markAllPaidByResponsible(5, 2)
    ).rejects.toThrow('db down');
  });
});

describe('checkAllPaid', () => {
  it('когда все подтверждены — сборщику приходит сводка', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ status: 'CONFIRMED' }),
    ] as never);

    await BudgetService.checkAllPaid(5, 2);

    expect(sendMessage).toHaveBeenCalledWith(
      777,
      expect.stringContaining('Получено: 250.00₽'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
  });

  it('пока есть неоплаченные — молчим', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ status: 'CONFIRMED' }),
      txFixture({ id: 11, status: 'PENDING' }),
    ] as never);

    await BudgetService.checkAllPaid(5, 2);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('без транзакций молчим', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);

    await BudgetService.checkAllPaid(5, 2);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('ошибка базы не выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(BudgetService.checkAllPaid(5, 2)).resolves.toBeUndefined();
  });
});

describe('remindAllDebtors', () => {
  it('сообщает, сколько напоминаний ушло', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture(),
    ] as never);
    asMock(prismaMock.paymentReminder.createMany).mockResolvedValue({
      count: 1,
    });

    const reply = await BudgetService.remindAllDebtors(5, 2);

    expect(reply).toContain('Напоминания отправлены: 1 из 1');
  });

  it('нет должников — так и говорит', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);

    await expect(BudgetService.remindAllDebtors(5, 2)).resolves.toContain(
      'Все уже оплатили'
    );
  });

  it('недоставленные перечисляются по именам', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture(),
    ] as never);
    sendMessage.mockRejectedValue(new Error('bot blocked'));

    const reply = await BudgetService.remindAllDebtors(5, 2);

    expect(reply).toContain('Не удалось отправить: Игорь');
  });
});
