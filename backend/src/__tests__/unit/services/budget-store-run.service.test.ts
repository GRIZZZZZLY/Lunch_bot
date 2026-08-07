/**
 * Расчёт по забегу в магазин: «иду в магазин» → кто кому сколько должен.
 * Расходы по обеду закреплены в budget.service.test.ts и budget-static —
 * здесь магазинная часть.
 *
 * Смысловые правила, из-за которых это стоит тестов:
 *
 * 1. Инициатор себе не должен. Он потратил свои деньги, и его собственные
 *    позиции в долги не превращаются.
 * 2. Один забег → одна транзакция на товар, но уведомление одно на человека:
 *    люди переводят одной суммой за весь свой заказ, а не по позиции.
 * 3. Создание транзакций идемпотентно (createMany + skipDuplicates и
 *    уникальный индекс): двойной клик «завершить забег» не удваивает долги.
 * 4. Подтвердить оплату может только инициатор забега — иначе должник
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

const { logger } = jest.requireMock('../../../utils/logger');
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

function insertedRows(): Array<Record<string, unknown>> {
  const call = asMock(prismaMock.transaction.createMany).mock.calls[0];
  return (call?.[0] as { data: Array<Record<string, unknown>> })?.data ?? [];
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
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createTransactionsForStoreRun', () => {
  it('на каждый купленный товар создаётся долг в пользу инициатора', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      storeRun([
        { id: 10, userId: 2, price: 150 },
        { id: 11, userId: 3, price: 250 },
      ])
    );

    await StoreRunBudgetService.createTransactionsForStoreRun(30);

    expect(insertedRows()).toEqual([
      expect.objectContaining({
        storeItemId: 10,
        fromUserId: 2,
        toUserId: 1,
        amount: 150,
        status: 'PENDING',
      }),
      expect.objectContaining({ storeItemId: 11, fromUserId: 3, amount: 250 }),
    ]);
  });

  it('позиции инициатора в долги не превращаются', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      storeRun([
        { id: 10, userId: 1, price: 150 },
        { id: 11, userId: 2, price: 250 },
      ])
    );

    await StoreRunBudgetService.createTransactionsForStoreRun(30);

    expect(insertedRows()).toHaveLength(1);
    expect(insertedRows()[0]).toMatchObject({ fromUserId: 2 });
  });

  it('не купленные позиции не считаются', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      storeRun([
        { id: 10, userId: 2, status: 'NOT_FOUND' },
        { id: 11, userId: 2, status: 'BOUGHT' },
      ])
    );

    await StoreRunBudgetService.createTransactionsForStoreRun(30);

    expect(insertedRows().map(row => row.storeItemId)).toEqual([11]);
  });

  it('позиция без цены не создаёт долг на пустую сумму', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      storeRun([{ id: 10, userId: 2, price: null }])
    );

    await StoreRunBudgetService.createTransactionsForStoreRun(30);

    expect(asMock(prismaMock.transaction.createMany)).not.toHaveBeenCalled();
  });

  it('забег без чужих позиций возвращает пустой список', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      storeRun([{ id: 10, userId: 1 }])
    );

    await expect(
      StoreRunBudgetService.createTransactionsForStoreRun(30)
    ).resolves.toEqual([]);
    expect(logger.info).toHaveBeenCalledWith('No billable items for store run', {
      storeRunId: 30,
    });
  });

  it('вставка идемпотентна: повторный клик долги не удваивает', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      storeRun([{ id: 10, userId: 2 }])
    );
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      transaction({ fromUserId: 2 }),
    ]);

    const result = await StoreRunBudgetService.createTransactionsForStoreRun(30);

    expect(asMock(prismaMock.transaction.createMany)).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
    // Возвращается полный набор забега, кто бы его ни вставил.
    expect(result).toHaveLength(1);
  });

  it('несуществующий забег — ошибка', async () => {
    await expect(
      StoreRunBudgetService.createTransactionsForStoreRun(30)
    ).rejects.toThrow('Store run 30 not found');
  });

  it('работает внутри переданной транзакции БД', async () => {
    const tx = {
      storeRun: {
        findUnique: jest.fn().mockResolvedValue(storeRun([{ id: 10, userId: 2 }])),
      },
      transaction: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([transaction({ fromUserId: 2 })]),
      },
    };

    await StoreRunBudgetService.createTransactionsForStoreRun(30, tx as never);

    expect(tx.transaction.createMany).toHaveBeenCalled();
    expect(asMock(prismaMock.transaction.createMany)).not.toHaveBeenCalled();
  });

  it('сбой вставки пробрасывается наружу', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(
      storeRun([{ id: 10, userId: 2 }])
    );
    asMock(prismaMock.transaction.createMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      StoreRunBudgetService.createTransactionsForStoreRun(30)
    ).rejects.toThrow('db down');
  });
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
    expect(toDebtor).toContain('К оплате: 200');
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
    expect(text).toContain('Карта:');
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

  it('без реквизитов должнику прямо сказано уточнить лично', async () => {
    users.getPaymentInfo.mockResolvedValue(null);
    settled([{ fromUserId: 2 }]);

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    expect(sentTo(1002)).toContain('не заполнил реквизиты');
  });

  it('фамилия инициатора добавляется, если есть', async () => {
    settled([{ fromUserId: 2 }], {
      initiator: user(1, { lastName: 'Петров' }),
    });

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    expect(sentTo(1002)).toContain('U1 Петров');
  });

  it('инициатор получает сводку: сколько всего и кто сколько должен', async () => {
    settled([
      { id: 1, fromUserId: 2, amount: 150 },
      { id: 2, fromUserId: 3, amount: 250 },
    ]);

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    const summary = sentTo(1001) as string;
    expect(summary).toContain('Тебе вернут: 400');
    expect(summary).toContain('U2');
    expect(summary).toContain('U3');
  });

  it('без долгов рассылки нет', async () => {
    settled([]);

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'notifyStoreRunSettled: no pending transactions',
      { storeRunId: 30 }
    );
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

    await StoreRunBudgetService.notifyStoreRunSettled(30);

    expect(logger.error).toHaveBeenCalledWith(
      'notifyStoreRunSettled: bot not initialized',
      { storeRunId: 30 }
    );
    expect(asMock(prismaMock.storeRun.findUnique)).not.toHaveBeenCalled();
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
    expect(logger.error).toHaveBeenCalledWith(
      'Error sending store run debt notification:',
      expect.any(Error)
    );
  });

  it('сбой чтения долгов не пробрасывается наружу', async () => {
    asMock(prismaMock.storeRun.findUnique).mockResolvedValue(storeRun([]));
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      StoreRunBudgetService.notifyStoreRunSettled(30)
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Error sending store run settle notifications:',
      expect.any(Error)
    );
  });
});

describe('markStoreRunPaidByDebtor', () => {
  function debtorWith(txs: TxInit[]) {
    asMock(prismaMock.user.findFirst).mockResolvedValue(user(2));
    asMock(prismaMock.transaction.findMany).mockResolvedValue(
      txs.map(transaction)
    );
  }

  it('все долги должника по забегу переводятся в PAID одной операцией', async () => {
    debtorWith([
      { id: 1, fromUserId: 2, amount: 150 },
      { id: 2, fromUserId: 2, amount: 50 },
    ]);

    const result = await StoreRunBudgetService.markStoreRunPaidByDebtor(30, 1002);

    expect(asMock(prismaMock.transaction.updateMany)).toHaveBeenCalledWith({
      where: { storeRunId: 30, fromUserId: 2, status: 'PENDING' },
      data: { status: 'PAID', paidAt: NOW },
    });
    expect(result).toMatchObject({ count: 2 });
  });

  it('инициатор получает уведомление с кнопкой подтверждения', async () => {
    debtorWith([{ fromUserId: 2, amount: 150 }]);

    await StoreRunBudgetService.markStoreRunPaidByDebtor(30, 1002);

    expect(sentTo(1001)).toContain('Получена оплата по магазину');
    const call = api.sendMessage.mock.calls.find(c => c[0] === 1001);
    expect(JSON.stringify(call?.[2])).toContain('budget:srun_confirm:30:2');
  });

  it('незнакомый пользователь ничего не отмечает', async () => {
    await expect(
      StoreRunBudgetService.markStoreRunPaidByDebtor(30, 9999)
    ).resolves.toBeNull();
    expect(asMock(prismaMock.transaction.updateMany)).not.toHaveBeenCalled();
  });

  it('без непогашенных долгов отметка не проходит', async () => {
    asMock(prismaMock.user.findFirst).mockResolvedValue(user(2));
    asMock(prismaMock.transaction.findMany).mockResolvedValue([]);

    await expect(
      StoreRunBudgetService.markStoreRunPaidByDebtor(30, 1002)
    ).resolves.toBeNull();
    expect(asMock(prismaMock.transaction.updateMany)).not.toHaveBeenCalled();
  });

  it('без бота статус всё равно меняется', async () => {
    debtorWith([{ fromUserId: 2 }]);
    asMock(getBotInstance).mockReturnValue(null);

    await expect(
      StoreRunBudgetService.markStoreRunPaidByDebtor(30, 1002)
    ).resolves.toMatchObject({ count: 1 });
    expect(api.sendMessage).not.toHaveBeenCalled();
  });
});

describe('confirmStoreRunByDebtor', () => {
  function pending(txs: TxInit[]) {
    asMock(prismaMock.transaction.findMany).mockResolvedValue(
      txs.map(transaction)
    );
  }

  it('инициатор подтверждает — долги переходят в CONFIRMED', async () => {
    pending([
      { id: 1, fromUserId: 2, amount: 150 },
      { id: 2, fromUserId: 2, amount: 50 },
    ]);

    const result = await StoreRunBudgetService.confirmStoreRunByDebtor(30, 2, 1001);

    expect(asMock(prismaMock.transaction.updateMany)).toHaveBeenCalledWith({
      where: {
        storeRunId: 30,
        fromUserId: 2,
        status: { in: ['PENDING', 'PAID'] },
      },
      data: { status: 'CONFIRMED', confirmedAt: NOW },
    });
    expect(result).toEqual({ count: 2 });
  });

  it('подтверждать может только инициатор забега', async () => {
    pending([{ fromUserId: 2 }]);

    await expect(
      StoreRunBudgetService.confirmStoreRunByDebtor(30, 2, 1002)
    ).resolves.toEqual({ error: 'forbidden' });
    expect(asMock(prismaMock.transaction.updateMany)).not.toHaveBeenCalled();
  });

  it('без долгов подтверждать нечего', async () => {
    pending([]);

    await expect(
      StoreRunBudgetService.confirmStoreRunByDebtor(30, 2, 1001)
    ).resolves.toEqual({ error: 'no_tx' });
  });

  it('должник узнаёт о подтверждении', async () => {
    pending([{ fromUserId: 2, amount: 150 }]);

    await StoreRunBudgetService.confirmStoreRunByDebtor(30, 2, 1001);

    expect(sentTo(1002)).toContain('Оплата подтверждена');
  });

  it('без бота статус всё равно меняется', async () => {
    pending([{ fromUserId: 2 }]);
    asMock(getBotInstance).mockReturnValue(null);

    await expect(
      StoreRunBudgetService.confirmStoreRunByDebtor(30, 2, 1001)
    ).resolves.toEqual({ count: 1 });
    expect(api.sendMessage).not.toHaveBeenCalled();
  });
});
