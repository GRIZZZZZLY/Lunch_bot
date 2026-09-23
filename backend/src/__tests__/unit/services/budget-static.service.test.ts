/**
 * BudgetService, статические методы: платёжный state-machine (переходы
 * статусов долга). Это деньги, поэтому закреплены именно те свойства,
 * потеря которых стоит денег:
 *
 * - переходы статусов атомарны (updateMany со статусом в условии), поэтому
 *   гонка не превращает PENDING в CONFIRMED «мимо» PAID;
 * - отменить подтверждение может только получатель и только в течение суток,
 *   и должнику об этом сообщают обязательно — ему уже сказали обратное.
 *
 * Создание долгов из голосования и уведомления о нём (processResponsibleSelected/
 * createTransactionsFromPoll/calculateTotals/sendBudgetNotifications) переехали
 * в PollFlowService — тесты в poll-flow.service.test.ts.
 */
import { BudgetService } from '../../../services/budget.service';
import { PollService } from '../../../services/poll.service';
import { UserService } from '../../../services/user.service';
import { eventBus } from '../../../services/event-bus.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';
import { PollQueryService } from '../../../services/poll-query.service';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/poll.service', () => ({
  PollService: { getPollById: jest.fn() },
}));

jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: {
    getPollById: jest.fn(),
  },
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
const pollQuery = asServiceMock(PollQueryService);
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

  pollQuery.getPollById.mockResolvedValue(pollFixture());
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
  /* Задание на уведомление ставится в той же транзакции, что и переход
     (см. outbox.service). Текст сообщения и кнопка проверяются в
     outbox.templates.test.ts, отправка — в outbox-worker.service.test.ts. */
  asMock(prismaMock.outboxEvent.createManyAndReturn).mockResolvedValue([
    { id: 501 },
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

describe('markAsPaid', () => {
  it('должник отмечает оплату, получателю уходит кнопка подтверждения', async () => {
    await BudgetService.markAsPaid(10, 1);

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 10, fromUserId: 1, status: 'PENDING' },
      data: {
        status: 'PAID',
        paidAt: NOW,
        /* Версия перехода — идентичность события уведомления: пара
           «id долга + статус» не различает два законных подтверждения
           в цепочке CONFIRMED → PAID → CONFIRMED. */
        transitionVersion: { increment: 1 },
      },
    });
  });

  /* Уведомление больше не уходит из этого метода напрямую: в транзакции
     перехода ставится ЗАДАНИЕ, а отправляет его обработчик очереди. Здесь
     проверяется адресат и данные события; текст и кнопка — в
     outbox.templates.test.ts, сама отправка — в outbox-worker.service.test.ts. */
  it('получателю ставится задание на уведомление в той же транзакции', async () => {
    await BudgetService.markAsPaid(10, 1);

    expect(prismaMock.outboxEvent.createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            entityType: 'TRANSACTION',
            entityId: 10,
            messageType: 'DEBT_MARKED_PAID',
            recipientChatId: '777',
            payload: expect.objectContaining({
              transactionId: 10,
              debtorFirstName: 'Игорь',
            }),
          }),
        ],
        skipDuplicates: true,
      })
    );
  });

  it('задание ставится тем же клиентом, что и переход статуса', async () => {
    await BudgetService.markAsPaid(10, 1);

    /* Иначе задание оказалось бы вне транзакции перехода, и весь смысл
       очереди пропал бы: переход мог откатиться, а уведомление уйти. */
    expect(prismaMock.$transaction).toHaveBeenCalled();
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

/**
 * Задания очереди, поставленные операцией.
 *
 * Уведомления всех переходов долга идут через очередь: задание ставится в той
 * же транзакции, что и переход, а Telegram вызывается потом. Поэтому здесь
 * проверяется переход и ЗАДАНИЕ. Текст и кнопки — outbox.templates.test.ts,
 * отправка и правка старого сообщения — outbox-worker.service.test.ts,
 * блокировки строк и доставка после сбоя — интеграционный набор на настоящей
 * PostgreSQL (budget-lifecycle.redis.test.ts).
 */
function queuedJobs(): Array<Record<string, unknown>> {
  return asMock(prismaMock.outboxEvent.createManyAndReturn).mock.calls.flatMap(
    call => (call[0] as { data: Array<Record<string, unknown>> }).data
  );
}

function queuedTypes(): unknown[] {
  return queuedJobs().map(job => job.messageType);
}

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
      data: {
        status: 'CONFIRMED',
        confirmedAt: NOW,
        transitionVersion: { increment: 1 },
      },
    });
  });

  it('должнику ставится задание «оплата подтверждена»', async () => {
    await BudgetService.confirmPayment(10, 2);

    expect(queuedJobs()).toContainEqual(
      expect.objectContaining({
        messageType: 'DEBT_CONFIRMED',
        recipientChatId: '555',
        payload: { payeeFirstName: 'Аня', amount: '250.00₽' },
      })
    );
  });

  it('задание несёт старое сообщение о долге, чтобы переписать его', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID', debtMessageId: 33, debtChatId: '555' }) as never
    );

    await BudgetService.confirmPayment(10, 2);

    expect(queuedJobs()).toContainEqual(
      expect.objectContaining({
        messageType: 'DEBT_CONFIRMED',
        payload: expect.objectContaining({ editChatId: '555', editMessageId: 33 }),
      })
    );
  });

  /* Решение «все оплатили» принимается внутри транзакции подтверждения, после
     блокировки опроса. Без блокировки два одновременных подтверждения
     последних долгов не дают итога никому — это проверяет интеграционный
     набор; здесь закреплено, что блокировка берётся. */
  it('берёт блокировку опроса до перехода', async () => {
    await BudgetService.confirmPayment(10, 2);

    const lock = asMock(prismaMock.$queryRaw).mock.invocationCallOrder[0];
    const transition = asMock(prismaMock.transaction.updateMany).mock
      .invocationCallOrder[0];
    expect(lock).toBeLessThan(transition);
    expect(String(asMock(prismaMock.$queryRaw).mock.calls[0][0])).toContain(
      'FOR NO KEY UPDATE'
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
    expect(queuedJobs()).toEqual([]);
  });

  it('повторное подтверждение идемпотентно и второго задания не ставит', async () => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 0,
    });
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'CONFIRMED' }) as never
    );

    await expect(BudgetService.confirmPayment(10, 2)).resolves.toMatchObject({
      status: 'CONFIRMED',
    });
    expect(queuedJobs()).toEqual([]);
  });

  it('подтвердить может только получатель', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID', toUserId: 99 }) as never
    );

    await expect(BudgetService.confirmPayment(10, 2)).rejects.toThrow(
      'Access denied'
    );
  });

  it('последний закрытый долг ставит сборщику «Все оплатили»', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ status: 'CONFIRMED' }),
    ] as never);

    await BudgetService.confirmPayment(10, 2);

    expect(queuedJobs()).toContainEqual(
      expect.objectContaining({
        messageType: 'DEBTS_ALL_CONFIRMED',
        recipientChatId: '777',
        payload: {
          forced: false,
          total: '250.00₽',
          lines: [{ name: 'Игорь', amount: '250.00₽' }],
        },
      })
    );
  });

  it('пока есть незакрытые долги — итога нет', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ status: 'CONFIRMED' }),
      txFixture({ id: 11, status: 'PAID' }),
    ] as never);

    await BudgetService.confirmPayment(10, 2);

    expect(queuedTypes()).toEqual(['DEBT_CONFIRMED']);
  });

  it('у магазинной транзакции (без pollId) итога и блокировки нет', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID', pollId: null }) as never
    );

    await BudgetService.confirmPayment(10, 2);

    expect(queuedTypes()).toEqual(['DEBT_CONFIRMED']);
    const pollLocks = asMock(prismaMock.$queryRaw).mock.calls.filter(call =>
      String(call[0]).includes('FROM polls')
    );
    expect(pollLocks).toEqual([]);
  });

  it('транзакции нет — ошибка', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(BudgetService.confirmPayment(10, 2)).rejects.toThrow(
      'Transaction not found'
    );
  });
});

describe('undoConfirmation', () => {
  const confirmed = (overrides: Record<string, unknown> = {}) =>
    txFixture({
      status: 'CONFIRMED',
      confirmedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      ...overrides,
    });

  beforeEach(() => {
    prismaMock.transaction.findUnique.mockResolvedValue(confirmed() as never);
    prismaMock.transaction.findUniqueOrThrow.mockResolvedValue(
      confirmed({ status: 'PAID' }) as never
    );
  });

  it('получатель отменяет подтверждение в течение суток', async () => {
    await BudgetService.undoConfirmation(10, 2);

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 10, toUserId: 2, status: 'CONFIRMED' },
      data: {
        status: 'PAID',
        confirmedAt: null,
        transitionVersion: { increment: 1 },
      },
    });
  });

  it('должнику ставится задание обязательно — ему уже сказали обратное', async () => {
    await BudgetService.undoConfirmation(10, 2);

    expect(queuedJobs()).toEqual([
      expect.objectContaining({
        messageType: 'DEBT_CONFIRMATION_UNDONE',
        recipientChatId: '555',
      }),
    ]);
  });

  it('задание несёт противоречащее старое сообщение, чтобы переписать его', async () => {
    prismaMock.transaction.findUniqueOrThrow.mockResolvedValue(
      confirmed({ status: 'PAID', debtMessageId: 33, debtChatId: '555' }) as never
    );

    await BudgetService.undoConfirmation(10, 2);

    expect(queuedJobs()[0]).toMatchObject({
      payload: expect.objectContaining({ editChatId: '555', editMessageId: 33 }),
    });
  });

  it('окно отмены — сутки', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      confirmed({ confirmedAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000) }) as never
    );

    await expect(BudgetService.undoConfirmation(10, 2)).rejects.toThrow(
      'Undo window has expired'
    );
  });

  it('без времени подтверждения отмена невозможна', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      confirmed({ confirmedAt: null }) as never
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
      confirmed({ toUserId: 99 }) as never
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

  it('гонка на записи распознаётся, задания нет', async () => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 0,
    });

    await expect(BudgetService.undoConfirmation(10, 2)).rejects.toThrow(
      'Transaction state changed'
    );
    expect(queuedJobs()).toEqual([]);
  });
});

describe('markAllPaidByResponsible', () => {
  it('закрывает все незакрытые долги заказа', async () => {
    await BudgetService.markAllPaidByResponsible(5, 2);

    expect(prismaMock.transaction.updateManyAndReturn).toHaveBeenCalledWith({
      where: { pollId: 5, toUserId: 2, status: { in: ['PENDING', 'PAID'] } },
      data: {
        status: 'CONFIRMED',
        confirmedAt: NOW,
        transitionVersion: { increment: 1 },
      },
      select: { id: true },
    });
  });

  /* Каждому должнику — своё задание: недоставленное одному не мешает
     остальным и не отменяет сводку сборщику. */
  it('каждому должнику своё задание, сборщику — сводка', async () => {
    asMock(prismaMock.transaction.updateManyAndReturn).mockResolvedValue([
      { id: 10 },
      { id: 11 },
    ] as never);
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ id: 10 }),
      txFixture({
        id: 11,
        fromUser: { id: 3, firstName: 'Оля', username: 'olya', telegramId: BigInt(888) },
      }),
    ] as never);

    await BudgetService.markAllPaidByResponsible(5, 2);

    expect(queuedJobs().map(job => [job.messageType, job.recipientChatId])).toEqual([
      ['DEBT_CONFIRMED', '555'],
      ['DEBT_CONFIRMED', '888'],
      ['DEBTS_ALL_CONFIRMED', '777'],
    ]);
    expect(queuedJobs()[2]).toMatchObject({
      payload: expect.objectContaining({ forced: true, total: '500.00₽' }),
    });
  });

  it('нечего закрывать — заданий нет', async () => {
    asMock(prismaMock.transaction.updateManyAndReturn).mockResolvedValue([] as never);

    await BudgetService.markAllPaidByResponsible(5, 2);

    expect(queuedJobs()).toEqual([]);
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

/**
 * Telegram недоступен или бота нет, а статус долга уже записан в PostgreSQL.
 *
 * Раньше сбой отправки пробрасывался наружу, и клиент получал ошибку на
 * операции, которая на самом деле сохранена. Теперь Telegram внутри операции
 * не вызывается вовсе: отправка идёт из очереди после фиксации. Здесь
 * закреплена граница: ни бот, ни его сбой не влияют на результат операции,
 * а ошибка самой записи и отказ в доступе по-прежнему идут наружу.
 */
describe('Telegram недоступен после фиксации статуса', () => {
  function telegramDown(): Error {
    return Object.assign(new Error('Bad Gateway'), { error_code: 502 });
  }

  it('без бота все операции проходят', async () => {
    botInstance.mockReturnValue(null);

    await expect(BudgetService.markAsPaid(10, 1)).resolves.toMatchObject({ id: 10 });
    await expect(BudgetService.markAllPaidByResponsible(5, 2)).resolves.toBeUndefined();
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID' }) as never
    );
    await expect(BudgetService.confirmPayment(10, 2)).resolves.toMatchObject({ id: 10 });
  });

  it('confirmPayment возвращает результат, а не ошибку', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID' }) as never
    );
    sendMessage.mockRejectedValue(telegramDown());
    editMessageText.mockRejectedValue(telegramDown());

    await expect(BudgetService.confirmPayment(10, 2)).resolves.toMatchObject({
      id: 10,
    });
  });

  it('undoConfirmation отменяет подтверждение и без доставки', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'CONFIRMED', confirmedAt: NOW }) as never
    );
    prismaMock.transaction.findUniqueOrThrow.mockResolvedValue(
      txFixture({ status: 'PAID' }) as never
    );
    sendMessage.mockRejectedValue(telegramDown());

    await expect(
      BudgetService.undoConfirmation(10, 2)
    ).resolves.toMatchObject({ id: 10 });
  });

  /* Обратная граница: очередь не должна проглатывать отказ самой записи.
     Иначе клиент получил бы успех на несохранённом переходе. */
  it('ошибка записи в БД по-прежнему идёт наружу', async () => {
    asMock(prismaMock.transaction.updateMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(BudgetService.markAsPaid(10, 1)).rejects.toThrow('db down');
  });

  /* Задание пишется в той же транзакции: его отказ откатывает и переход. */
  it('ошибка постановки задания идёт наружу', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID' }) as never
    );
    asMock(prismaMock.outboxEvent.createManyAndReturn).mockRejectedValue(
      new Error('outbox insert failed')
    );

    await expect(BudgetService.confirmPayment(10, 2)).rejects.toThrow(
      'outbox insert failed'
    );
  });

  it('отказ в доступе по-прежнему идёт наружу', async () => {
    sendMessage.mockRejectedValue(telegramDown());
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ fromUserId: 999 }) as never
    );

    await expect(BudgetService.markAsPaid(10, 1)).rejects.toThrow(
      'Access denied'
    );
  });
});
