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

  /* Уведомления этого сервиса подставляют имя должника в Markdown. `_` в
     имени — обычное дело для Telegram, и без экранирования ответственный не
     узнаёт об оплате вообще. Для markAsPaid экранирование переехало в шаблон
     очереди (outbox.templates.test.ts): в задании лежит СЫРОЕ имя. */
  it('имя должника экранируется в остальных уведомлениях об оплате', async () => {
    const withOddName = txFixture({
      fromUser: {
        id: 1,
        firstName: 'Соус_острый',
        username: 'igor',
        telegramId: BigInt(555),
      },
    });
    prismaMock.transaction.findUnique.mockResolvedValue(withOddName as never);
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      withOddName,
    ] as never);

    await BudgetService.markAllPaidByResponsible(5, 2);
    const allPaid = sendMessage.mock.calls
      .map(call => call[1] as string)
      .join('\n');
    expect(allPaid).toContain('Соус\\_острый');

    sendMessage.mockClear();
    prismaMock.transaction.findUnique.mockResolvedValue({
      ...withOddName,
      status: 'PAID',
    } as never);
    await new BudgetService().cancelMarkAsPaid(10, 1);
    expect(sendMessage.mock.calls[0][1]).toContain('Соус\\_острый');
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

/**
 * `checkAllPaid` проверял ССЫЛКУ на локальный хелпер `botInstance` (не
 * результат вызова), поэтому ветка «бота нет» была недостижима и метод падал
 * на `botInstance()!.api` с TypeError. Переход статуса при этом уже записан —
 * уведомление обязано быть best-effort.
 */
describe('бота нет', () => {
  beforeEach(() => {
    botInstance.mockReturnValue(null);
  });

  it('markAsPaid переводит долг в PAID и без бота', async () => {
    await expect(BudgetService.markAsPaid(10, 1)).resolves.toMatchObject({
      id: 10,
    });

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

  it('checkAllPaid не бросает и ничего не отправляет', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ status: 'CONFIRMED' }),
    ] as never);

    await expect(BudgetService.checkAllPaid(5, 2)).resolves.toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('markAllPaidByResponsible подтверждает долги и без бота', async () => {
    await expect(
      BudgetService.markAllPaidByResponsible(5, 2)
    ).resolves.toBeUndefined();

    expect(prismaMock.transaction.updateManyAndReturn).toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

/**
 * Telegram недоступен, а статус долга уже записан в PostgreSQL.
 *
 * Раньше сбой отправки пробрасывался наружу, и клиент получал ошибку на
 * операции, которая на самом деле сохранена: интерфейс откатывал
 * оптимистическое изменение и показывал «Не удалось отметить оплату», а после
 * перезагрузки — новый статус. Повтор запроса видел сохранённый статус и
 * завершался успехом, уже не отправив уведомление.
 *
 * Здесь закреплена граница: недоступность Telegram ПОСЛЕ фиксации не делает
 * операцию неуспешной, но ошибка самой записи в БД по-прежнему идёт наружу.
 */
describe('Telegram недоступен после фиксации статуса', () => {
  /** Так выглядит недоступность Telegram, а не отказ адресата. */
  function telegramDown(): Error {
    return Object.assign(new Error('Bad Gateway'), { error_code: 502 });
  }

  it('markAsPaid возвращает сохранённый PAID, а не ошибку', async () => {
    sendMessage.mockRejectedValue(telegramDown());

    await expect(BudgetService.markAsPaid(10, 1)).resolves.toMatchObject({
      id: 10,
      status: 'PENDING', // статус в прочитанной записи; переход подтверждён ниже
    });

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

  it('confirmPayment возвращает результат, а не ошибку', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID' }) as never
    );
    sendMessage.mockRejectedValue(telegramDown());

    await expect(BudgetService.confirmPayment(10, 2)).resolves.toMatchObject({
      id: 10,
    });

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 10, toUserId: 2, status: 'PAID' },
      data: { status: 'CONFIRMED', confirmedAt: NOW },
    });
  });

  /* Проверка «все оплатили» стояла ПОСЛЕ личного уведомления и при его сбое
     не выполнялась: последний закрытый долг не давал сборщику итог. */
  it('«все оплатили» проверяется, даже если личное уведомление не ушло', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'PAID' }) as never
    );
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ status: 'CONFIRMED' }),
    ] as never);
    // Личное уведомление должнику падает, сводка сборщику проходит.
    sendMessage
      .mockRejectedValueOnce(telegramDown())
      .mockResolvedValue({ message_id: 43 });

    await BudgetService.confirmPayment(10, 2);

    expect(sendMessage).toHaveBeenCalledWith(
      777,
      expect.stringContaining('Все оплатили'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
  });

  it('undoConfirmation отменяет подтверждение и без доставки', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      txFixture({ status: 'CONFIRMED', confirmedAt: NOW }) as never
    );
    sendMessage.mockRejectedValue(telegramDown());

    await expect(
      BudgetService.undoConfirmation(10, 2)
    ).resolves.toMatchObject({ id: 10 });

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 10, toUserId: 2, status: 'CONFIRMED' },
      data: { status: 'PAID', confirmedAt: null },
    });
  });

  /* Частичная неудача: один должник заблокировал бота, остальные должны
     узнать, а сборщик — получить сводку. */
  it('недоставка одному должнику не отменяет остальных и сводку', async () => {
    asMock(prismaMock.transaction.updateManyAndReturn).mockResolvedValue([
      { id: 10 },
      { id: 11 },
    ] as never);
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ id: 10 }),
      txFixture({
        id: 11,
        fromUser: {
          id: 3,
          firstName: 'Оля',
          username: 'olya',
          telegramId: BigInt(888),
        },
      }),
    ] as never);
    sendMessage
      .mockRejectedValueOnce(
        Object.assign(new Error('Forbidden'), { error_code: 403 })
      )
      .mockResolvedValue({ message_id: 44 });

    await expect(
      BudgetService.markAllPaidByResponsible(5, 2)
    ).resolves.toBeUndefined();

    // Второй должник и сводка сборщику — после сбоя на первом.
    expect(sendMessage).toHaveBeenCalledWith(
      888,
      expect.stringContaining('Оплата подтверждена')
    );
    expect(sendMessage).toHaveBeenCalledWith(
      777,
      expect.stringContaining('Все оплатили'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
  });

  it('checkAllPaid не бросает, когда сводка не ушла', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      txFixture({ status: 'CONFIRMED' }),
    ] as never);
    sendMessage.mockRejectedValue(telegramDown());

    await expect(BudgetService.checkAllPaid(5, 2)).resolves.toBeUndefined();
  });

  /* Обратная граница: изоляция уведомлений не должна проглатывать отказ
     самой записи. Иначе клиент получил бы успех на несохранённом переходе. */
  it('ошибка записи в БД по-прежнему идёт наружу', async () => {
    asMock(prismaMock.transaction.updateMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(BudgetService.markAsPaid(10, 1)).rejects.toThrow('db down');
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
