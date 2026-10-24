/**
 * Расчёт по забегу в магазин: уведомления и кнопки бота.
 * Создание долгов (инициатор себе не должен, двойное завершение не удваивает)
 * проверяется на настоящей БД в integration/api/store-runs.redis.test.ts.
 *
 * Смысловые правила, из-за которых это стоит тестов:
 *
 * 1. Уведомление одно на человека: люди переводят одной суммой за весь свой
 *    заказ, а не по позиции.
 * 2. Подтвердить оплату может только инициатор забега — иначе должник
 *    закрывал бы долг сам себе.
 */
import { StoreRunBudgetService } from '../../../services/store-run-budget.service';
import { UserService } from '../../../services/user.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/user.service', () => ({
  UserService: { getPaymentInfo: jest.fn() },
}));

jest.mock('../../../services/poll.service', () => ({
  PollService: { getPollById: jest.fn() },
}));

jest.mock('../../../services/event-bus.service', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}));

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const users = asServiceMock(UserService);

const api = { sendMessage: jest.fn() };

const NOW = new Date('2026-08-03T12:00:00.000Z');

function user(id: number, over: Record<string, unknown> = {}) {
  return {
    id,
    telegramId: BigInt(1000 + id),
    firstName: `U${id}`,
    lastName: null,
    ...over,
  };
}

interface ItemInit {
  id: number;
  userId: number;
  price?: number | null;
  status?: string;
  name?: string;
}

function storeRun(items: ItemInit[], over: Record<string, unknown> = {}) {
  return {
    id: 30,
    storeName: 'Пятёрочка',
    initiatorId: 1,
    initiator: user(1),
    items: items.map(item => ({
      id: item.id,
      userId: item.userId,
      price: 'price' in item ? item.price : 100,
      status: item.status ?? 'BOUGHT',
      name: item.name ?? `Товар ${item.id}`,
    })),
    ...over,
  };
}

interface TxInit {
  id?: number;
  fromUserId: number;
  amount?: number;
  itemName?: string;
}

function transaction(init: TxInit) {
  return {
    id: init.id ?? 500,
    storeRunId: 30,
    fromUserId: init.fromUserId,
    toUserId: 1,
    amount: init.amount ?? 100,
    status: 'PENDING',
    fromUser: user(init.fromUserId),
    toUser: user(1),
    storeItem: { name: init.itemName ?? 'Хлеб' },
  };
}

function sentTo(telegramId: number): string | undefined {
  const call = api.sendMessage.mock.calls.find(c => c[0] === telegramId);
  return call?.[1] as string | undefined;
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  asMock(getBotInstance).mockReturnValue({ api });
  api.sendMessage.mockResolvedValue({ message_id: 1 });

  users.getPaymentInfo.mockResolvedValue({
    paymentCard: '2200123456789012',
    paymentPhone: null,
    paymentDetails: null,
  });

  asMock(prismaMock.storeRun.findUnique).mockResolvedValue(null);
  asMock(prismaMock.transaction.createMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.transaction.findMany).mockResolvedValue([]);
  asMock(prismaMock.transaction.updateMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.user.findFirst).mockResolvedValue(null);
  asMock(prismaMock.outboxEvent.createManyAndReturn).mockResolvedValue([
    { id: 1 },
  ] as never);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('notifyStoreRunSettled', () => {
  function settled(txs: TxInit[], over: Record<string, unknown> = {}) {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      storeRun([], over)
    );
    asMock(prismaMock.transaction.findMany).mockResolvedValue(
      txs.map(transaction)
    );
  }

  it('каждый должник получает одно письмо со всеми своими позициями', async () => {
    settled([
      { id: 1, fromUserId: 2, amount: 150, itemName: 'Хлеб' },
      { id: 2, fromUserId: 2, amount: 50, itemName: 'Молоко' },
      { id: 3, fromUserId: 3, amount: 300, itemName: 'Сыр' },
    ]);

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    // По одному письму каждому должнику плюс сводка инициатору.
    expect(api.sendMessage).toHaveBeenCalledTimes(3);
    const toDebtor = sentTo(1002) as string;
    expect(toDebtor).toContain('Хлеб');
    expect(toDebtor).toContain('Молоко');
    expect(toDebtor).toContain('200');
  });

  it('в письме есть название магазина, получатель и кнопка «Оплатил»', async () => {
    settled([{ fromUserId: 2, amount: 150 }]);

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    expect(sentTo(1002)).toContain('Пятёрочка');
    expect(sentTo(1002)).toContain('U1');
    const call = api.sendMessage.mock.calls.find(c => c[0] === 1002);
    expect(JSON.stringify(call?.[2])).toContain('budget:srun_paid:30');
  });

  it('номер карты приходит замаскированным', async () => {
    settled([{ fromUserId: 2 }]);

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    const text = sentTo(1002) as string;
    expect(text).not.toContain('2200123456789012');
    expect(text).toContain('9012');
  });

  /* Ссылка СБП — не номер карты: раньше её маскировали в «**** …» из
     случайных символов адреса, а подчёркивания ломали legacy-Markdown. Ссылка
     уходит только кнопкой, текст несёт фиксированную строку. */
  it('ссылка СБП приходит кнопкой с точным адресом, без маски и без адреса в тексте', async () => {
    const link = 'https://www.tinkoff.ru/rm/ivanov_ivan1/Ab3_x9';
    users.getPaymentInfo.mockResolvedValue({
      paymentCard: link,
      paymentPhone: null,
      paymentDetails: null,
    });
    settled([{ fromUserId: 2 }]);

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    const call = api.sendMessage.mock.calls.find(c => c[0] === 1002);
    const text = call?.[1] as string;
    expect(text).not.toContain('****');
    expect(text).not.toContain(link);
    const buttons = (call?.[2] as { reply_markup: { inline_keyboard: Array<Array<{ url?: string }>> } })
      .reply_markup.inline_keyboard.flat();
    expect(buttons.find(b => b.url)?.url).toBe(link);
  });

  it('телефон и свободное описание тоже попадают в реквизиты', async () => {
    users.getPaymentInfo.mockResolvedValue({
      paymentCard: null,
      paymentPhone: '+79990001122',
      paymentDetails: 'Сбер, СБП',
    });
    settled([{ fromUserId: 2 }]);

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    const text = sentTo(1002) as string;
    expect(text).toContain('+79990001122');
    expect(text).toContain('Сбер, СБП');
  });

  /* Сводка обещала разосланные реквизиты и тогда, когда их не было. Без
     реквизитов инициатору дают кнопку их указать, с реквизитами — нет. */
  it.each([
    ['без реквизитов получает кнопку их указать', null, true],
    [
      'с реквизитами лишней кнопки не получает',
      { paymentCard: '2200123456789012', paymentPhone: null, paymentDetails: null },
      false,
    ],
  ])('инициатор %s', async (_case, paymentInfo, expectButton) => {
    process.env.WEBAPP_URL = 'https://app.example.com';
    users.getPaymentInfo.mockResolvedValue(paymentInfo);
    settled([{ fromUserId: 2 }]);

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    const call = api.sendMessage.mock.calls.find(c => c[0] === 1001);
    const keyboard =
      (call?.[2] as { reply_markup?: { inline_keyboard: { web_app?: { url: string } }[][] } })
        ?.reply_markup?.inline_keyboard ?? [];
    const webAppUrls = keyboard.flat().flatMap(b => (b.web_app ? [b.web_app.url] : []));
    expect(webAppUrls).toEqual(
      expectButton ? [expect.stringMatching(/\/profile\?edit=payment$/)] : []
    );
  });

  /**
   * Название магазина и названия позиций пишет сам пользователь, реквизиты —
   * тоже. Всё это уходит на Markdown, причём реквизиты инициатора попадают в
   * ЛС ДРУГИМ участникам: `[текст](ссылка)` из чужого профиля стал бы там
   * кликабельной ссылкой.
   */
  it('магазин, позиции, имена и реквизиты экранируются', async () => {
    users.getPaymentInfo.mockResolvedValue({
      paymentCard: null,
      paymentPhone: '+7_999',
      paymentDetails: 'СБП [тут](https://evil.example)',
    });
    settled([{ fromUserId: 2, itemName: 'Соус_острый' }], {
      storeName: 'Пятёрочка_на *углу*',
      initiator: user(1, { firstName: 'Аня_К', lastName: 'С*ова' }),
    });

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    const toDebtor = sentTo(1002) as string;
    expect(toDebtor).toContain('Пятёрочка\\_на \\*углу\\*');
    expect(toDebtor).toContain('Соус\\_острый');
    expect(toDebtor).toContain('Аня\\_К С\\*ова');
    expect(toDebtor).toContain('+7\\_999');
    expect(toDebtor).toContain('СБП \\[тут](https://evil.example)');

    // Сводка инициатору: магазин и имя должника.
    const toInitiator = sentTo(1001) as string;
    expect(toInitiator).toContain('Пятёрочка\\_на \\*углу\\*');
  });

  it('инициатор получает сводку: сколько всего и кто сколько должен', async () => {
    settled([
      { id: 1, fromUserId: 2, amount: 150 },
      { id: 2, fromUserId: 3, amount: 250 },
    ]);

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    const summary = sentTo(1001) as string;
    expect(summary).toContain('400');
    expect(summary).toContain('U2');
    expect(summary).toContain('U3');
  });

  it('без долгов рассылки нет', async () => {
    settled([]);

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('несуществующий забег рассылки не порождает', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(null);

    await expect(
      StoreRunBudgetService.notifyStoreRunSettled(30)
    ).resolves.toBeUndefined();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('без бота рассылка не запускается', async () => {
    asMock(getBotInstance).mockReturnValue(null);
    settled([{ fromUserId: 2 }]);

    await expect(
      StoreRunBudgetService.notifyStoreRunSettled(30)
    ).resolves.toBeUndefined();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('заблокировавший бота должник не мешает уведомить остальных', async () => {
    settled([
      { id: 1, fromUserId: 2 },
      { id: 2, fromUserId: 3 },
    ]);
    api.sendMessage
      .mockRejectedValueOnce(new Error('bot blocked by user'))
      .mockResolvedValue({ message_id: 1 });

    await expect(
      StoreRunBudgetService.notifyStoreRunSettled(30)
    ).resolves.toBeUndefined();
    expect(api.sendMessage).toHaveBeenCalledTimes(3);
  });

  it('сбой чтения долгов не пробрасывается наружу', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(storeRun([]));
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      StoreRunBudgetService.notifyStoreRunSettled(30)
    ).resolves.toBeUndefined();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });
});

/**
 * Кнопки бота для магазинных долгов.
 *
 * Уведомления этих переходов идут через очередь: задание ставится в той же
 * транзакции, что и переход, а отправляется потом. Поэтому здесь проверяется
 * переход и ЗАДАНИЕ, а не вызов Telegram — его в операции больше нет, и сбой
 * Telegram не может превратить сохранённую отметку в ошибку. Доставку,
 * блокировки строк и устаревание проверяет интеграционный набор на настоящей
 * PostgreSQL (`budget-lifecycle.redis.test.ts`); текст и кнопки —
 * `outbox.templates.test.ts`.
 */
function queuedJobs(): Array<Record<string, unknown>> {
  return asMock(prismaMock.outboxEvent.createManyAndReturn).mock.calls.flatMap(
    call => (call[0] as { data: Array<Record<string, unknown>> }).data
  );
}

describe('markStoreRunPaidByDebtor', () => {
  function debtorWith(rows: Array<{ id: number; amount: number }>) {
    asMock(prismaMock.user.findFirst).mockResolvedValue(user(2));
    asMock(prismaMock.transaction.updateManyAndReturn).mockResolvedValue(
      rows.map(row => ({ ...row, toUserId: 1, transitionVersion: 1 }))
    );
    asMock(prismaMock.user.findUniqueOrThrow).mockResolvedValue(user(1));
  }

  it('все долги должника по забегу переводятся в PAID одной операцией', async () => {
    debtorWith([
      { id: 1, amount: 150 },
      { id: 2, amount: 50 },
    ]);

    const result = await StoreRunBudgetService.markStoreRunPaidByDebtor(30, 1002);

    expect(result).toEqual({ count: 2, total: '200.00₽' });
  });

  it('инициатору ставится одно задание на весь заказ должника', async () => {
    debtorWith([
      { id: 7, amount: 150 },
      { id: 3, amount: 50 },
    ]);

    await StoreRunBudgetService.markStoreRunPaidByDebtor(30, 1002);

    expect(queuedJobs()).toEqual([
      expect.objectContaining({
        messageType: 'STORE_RUN_MARKED_PAID',
        recipientChatId: '1001',
        /* Привязка к первой по id позиции: все позиции меняют статус вместе. */
        entityId: 3,
        payload: {
          storeRunId: 30,
          debtorId: 2,
          debtorFirstName: 'U2',
          amount: '200.00₽',
        },
      }),
    ]);
  });

  it('незнакомый пользователь ничего не отмечает', async () => {
    await expect(
      StoreRunBudgetService.markStoreRunPaidByDebtor(30, 9999)
    ).resolves.toBeNull();
    expect(asMock(prismaMock.transaction.updateManyAndReturn)).not.toHaveBeenCalled();
  });

  /* Второе нажатие «Оплатил»: переход уже сделан первым, PENDING не осталось. */
  it('без непогашенных долгов отметка не проходит и задание не ставится', async () => {
    debtorWith([]);

    await expect(
      StoreRunBudgetService.markStoreRunPaidByDebtor(30, 1002)
    ).resolves.toBeNull();
    expect(queuedJobs()).toEqual([]);
  });

  it('сбой Telegram не касается операции: отправки внутри неё нет', async () => {
    debtorWith([{ id: 1, amount: 150 }]);
    api.sendMessage.mockRejectedValue(new Error('Bad Gateway'));

    await expect(
      StoreRunBudgetService.markStoreRunPaidByDebtor(30, 1002)
    ).resolves.toMatchObject({ count: 1 });
  });

  /* Обратная граница: отказ самой записи должен остаться видимым. */
  it('ошибка записи в БД идёт наружу', async () => {
    asMock(prismaMock.user.findFirst).mockResolvedValue(user(2));
    asMock(prismaMock.transaction.updateManyAndReturn).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      StoreRunBudgetService.markStoreRunPaidByDebtor(30, 1002)
    ).rejects.toThrow('db down');
  });
});

describe('confirmStoreRunByDebtor', () => {
  function payable(rows: Array<{ id: number; amount: number }>) {
    asMock(prismaMock.transaction.findFirst).mockResolvedValue(
      (rows.length > 0 ? transaction({ fromUserId: 2 }) : null)
    );
    asMock(prismaMock.transaction.updateManyAndReturn).mockResolvedValue(
      rows.map(row => ({ ...row, transitionVersion: 2 }))
    );
  }

  it('подтверждать может только инициатор забега', async () => {
    payable([{ id: 1, amount: 150 }]);

    await expect(
      StoreRunBudgetService.confirmStoreRunByDebtor(30, 2, 1002)
    ).resolves.toEqual({ error: 'forbidden' });
    expect(asMock(prismaMock.transaction.updateManyAndReturn)).not.toHaveBeenCalled();
  });

  it('без долгов подтверждать нечего', async () => {
    payable([]);

    await expect(
      StoreRunBudgetService.confirmStoreRunByDebtor(30, 2, 1001)
    ).resolves.toEqual({ error: 'no_tx' });
  });

  /* Между проверкой и переходом долг успели подтвердить другим нажатием. */
  it('если переход уже сделан, повторного задания нет', async () => {
    asMock(prismaMock.transaction.findFirst).mockResolvedValue(
      transaction({ fromUserId: 2 })
    );
    asMock(prismaMock.transaction.updateManyAndReturn).mockResolvedValue([]);

    await expect(
      StoreRunBudgetService.confirmStoreRunByDebtor(30, 2, 1001)
    ).resolves.toEqual({ error: 'no_tx' });
    expect(queuedJobs()).toEqual([]);
  });
});
