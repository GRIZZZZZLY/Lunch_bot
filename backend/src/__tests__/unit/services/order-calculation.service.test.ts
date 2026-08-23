/**
 * Расчёт заказа: превращение введённых цен в долги конкретным людям. Здесь
 * ошибка выражается в деньгах, поэтому проверяется в первую очередь то, что
 * защищает суммы:
 *
 * 1. Финализировать можно только полный состав. Если хоть один участник не
 *    ввёл цену — или в заказе оказался посторонний, — расчёт отклоняется:
 *    иначе доставка и чаевые делятся не на всех и часть денег теряется.
 * 2. Финализация идемпотентна и атомарна. Повторный вызов не создаёт второй
 *    комплект долгов, а смена статуса и вставка транзакций живут в одной
 *    транзакции БД.
 * 3. Ответственный себе не должен: его позиция исключается из транзакций.
 * 4. Доли доставки, сервиса и чаевых делятся на всех участников, включая
 *    ответственного.
 */
import { OrderCalculationService } from '../../../services/order-calculation.service';
import { CategoryOrderService } from '../../../services/category-order.service';
import { UserService } from '../../../services/user.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/category-order.service', () => ({
  CategoryOrderService: {
    recalculateTotals: jest.fn(),
    getParticipants: jest.fn(),
  },
}));

jest.mock('../../../services/user.service', () => ({
  UserService: { getPaymentInfoMany: jest.fn() },
}));

jest.mock('../../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const categoryOrders = asServiceMock(CategoryOrderService);
const users = asServiceMock(UserService);
const { logger } = jest.requireMock('../../../utils/logger');

const api = {
  sendMessage: jest.fn(),
  editMessageText: jest.fn(),
};

interface OrderItemInit {
  userId: number;
  price: number;
  itemName?: string;
}

/** CategoryOrder в форме, которую возвращает findUnique в finalizeCalculation. */
function categoryOrder(over: Record<string, unknown> = {}) {
  const items = (over.items as OrderItemInit[]) ?? [
    { userId: 1, price: 300 },
    { userId: 2, price: 400 },
  ];
  delete over.items;
  return {
    id: 10,
    pollId: 5,
    category: 'Плов',
    participantCount: items.length,
    responsibleUserId: 1,
    deliveryCost: 0,
    serviceFee: 0,
    tip: 0,
    calculationStatus: 'IN_PROGRESS',
    participantMessages: null,
    orderItems: items.map((item, index) => ({
      id: 100 + index,
      categoryOrderId: 10,
      userId: item.userId,
      itemName: item.itemName ?? 'Плов',
      price: item.price,
      notes: null,
      user: { id: item.userId, firstName: `U${item.userId}` },
    })),
    poll: { id: 5 },
    ...over,
  };
}

/** Отдаёт транзакции, которые сервис попытался вставить через createMany. */
function insertedRows(): Array<Record<string, unknown>> {
  const call = asMock(prismaMock.transaction.createMany).mock.calls[0];
  return (call?.[0] as { data: Array<Record<string, unknown>> })?.data ?? [];
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();

  asMock(getBotInstance).mockReturnValue({ api });
  api.sendMessage.mockResolvedValue({ message_id: 900 });
  api.editMessageText.mockResolvedValue(true);

  categoryOrders.recalculateTotals.mockResolvedValue(undefined);
  categoryOrders.getParticipants.mockResolvedValue([1, 2]);
  users.getPaymentInfoMany.mockResolvedValue(
    new Map([[1, { paymentCard: '2200 1234', paymentPhone: null }]])
  );

  asMock(prismaMock.orderItem.findUnique).mockResolvedValue(null);
  asMock(prismaMock.orderItem.create).mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: 100, ...args.data })) as never);
  asMock(prismaMock.orderItem.update).mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: 100, ...args.data })) as never);
  asMock(prismaMock.orderItem.delete).mockResolvedValue({ id: 100 });
  asMock(prismaMock.orderItemEditLog.createMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.orderItemEditLog.findMany).mockResolvedValue([]);
  asMock(prismaMock.orderItem.findMany).mockResolvedValue([]);
  asMock(prismaMock.categoryOrder.updateMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.transaction.createMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.transaction.findMany).mockResolvedValue([]);
  asMock(prismaMock.transaction.update).mockResolvedValue({ id: 1 });
  asMock(prismaMock.user.findMany).mockResolvedValue([]);
});

describe('saveOrderItem', () => {
  const base = {
    categoryOrderId: 10,
    userId: 2,
    itemName: 'Плов',
    price: 350,
    enteredBy: 2,
  };

  it('новая позиция создаётся и итоги пересчитываются', async () => {
    await OrderCalculationService.saveOrderItem(base);

    expect(asMock(prismaMock.orderItem.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryOrderId: 10,
        userId: 2,
        itemName: 'Плов',
        price: 350,
        enteredBy: 2,
      }),
    });
    expect(categoryOrders.recalculateTotals).toHaveBeenCalledWith(10);
  });

  it('пробелы вокруг названия и заметки срезаются', async () => {
    await OrderCalculationService.saveOrderItem({
      ...base,
      itemName: '  Плов  ',
      notes: '  без лука  ',
    });

    expect(asMock(prismaMock.orderItem.create).mock.calls[0][0]).toMatchObject({
      data: { itemName: 'Плов', notes: 'без лука' },
    });
  });

  it('пустая заметка не сохраняется как пустая строка', async () => {
    await OrderCalculationService.saveOrderItem({ ...base, notes: '   ' });

    expect(
      (
        asMock(prismaMock.orderItem.create).mock.calls[0][0] as {
          data: { notes?: string };
        }
      ).data.notes
    ).toBeUndefined();
  });

  it('название из одних пробелов отклоняется до обращения к БД', async () => {
    await expect(
      OrderCalculationService.saveOrderItem({ ...base, itemName: '   ' })
    ).rejects.toThrow('Item name is required');

    expect(asMock(prismaMock.orderItem.findUnique)).not.toHaveBeenCalled();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001])(
    'цена %p отклоняется',
    async price => {
      await expect(
        OrderCalculationService.saveOrderItem({ ...base, price })
      ).rejects.toThrow('Price must be between');
    }
  );

  it('верхняя граница цены допустима', async () => {
    await expect(
      OrderCalculationService.saveOrderItem({ ...base, price: 1_000_000 })
    ).resolves.toBeDefined();
  });

  it('повторный ввод обновляет ту же позицию, а не создаёт вторую', async () => {
    asMock(prismaMock.orderItem.findUnique).mockResolvedValue({
      id: 100,
      itemName: 'Плов',
      price: 300,
      notes: null,
    });

    await OrderCalculationService.saveOrderItem({ ...base, price: 350 });

    expect(asMock(prismaMock.orderItem.create)).not.toHaveBeenCalled();
    expect(asMock(prismaMock.orderItem.update)).toHaveBeenCalledWith({
      where: { id: 100 },
      data: expect.objectContaining({ price: 350 }),
    });
  });

  it('позиция ищется по паре (заказ, участник) — по одной на человека', async () => {
    await OrderCalculationService.saveOrderItem(base);

    expect(asMock(prismaMock.orderItem.findUnique)).toHaveBeenCalledWith({
      where: { categoryOrderId_userId: { categoryOrderId: 10, userId: 2 } },
    });
  });

  it('сбой БД превращается в понятную ошибку', async () => {
    asMock(prismaMock.orderItem.create).mockRejectedValue(new Error('db down'));

    await expect(OrderCalculationService.saveOrderItem(base)).rejects.toThrow(
      'Failed to save order item'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error saving order item:',
      expect.any(Error)
    );
  });
});

describe('журнал правок', () => {
  const base = {
    categoryOrderId: 10,
    userId: 2,
    itemName: 'Плов',
    price: 350,
    enteredBy: 7,
  };

  function existing(over: Record<string, unknown> = {}) {
    asMock(prismaMock.orderItem.findUnique).mockResolvedValue({
      id: 100,
      itemName: 'Плов',
      price: 350,
      notes: null,
      ...over,
    });
  }

  function loggedFields(): string[] {
    const call = asMock(prismaMock.orderItemEditLog.createMany).mock.calls[0];
    const data = (call?.[0] as { data: Array<{ fieldChanged: string }> })?.data;
    return (data ?? []).map(row => row.fieldChanged);
  }

  it('смена цены фиксируется с прежним и новым значением', async () => {
    existing({ price: 300 });

    await OrderCalculationService.saveOrderItem(base);

    const [row] = (
      asMock(prismaMock.orderItemEditLog.createMany).mock.calls[0][0] as {
        data: Array<Record<string, unknown>>;
      }
    ).data;
    expect(row).toMatchObject({
      orderItemId: 100,
      editedBy: 7,
      fieldChanged: 'price',
      oldValue: '300',
      newValue: '350',
    });
  });

  it('смена названия фиксируется', async () => {
    existing({ itemName: 'Суп' });

    await OrderCalculationService.saveOrderItem(base);

    expect(loggedFields()).toContain('itemName');
  });

  it('появление заметки фиксируется', async () => {
    existing();

    await OrderCalculationService.saveOrderItem({ ...base, notes: 'без лука' });

    expect(loggedFields()).toContain('notes');
  });

  it('повторное сохранение без изменений журнал не пишет', async () => {
    existing();

    await OrderCalculationService.saveOrderItem(base);

    expect(asMock(prismaMock.orderItemEditLog.createMany)).not.toHaveBeenCalled();
  });

  it('несколько изменений пишутся одной вставкой', async () => {
    existing({ itemName: 'Суп', price: 300 });

    await OrderCalculationService.saveOrderItem({ ...base, notes: 'остро' });

    expect(asMock(prismaMock.orderItemEditLog.createMany)).toHaveBeenCalledTimes(1);
    expect(loggedFields()).toEqual(['itemName', 'price', 'notes']);
  });

  it('сбой журнала не отменяет сохранение цены', async () => {
    existing({ price: 300 });
    asMock(prismaMock.orderItemEditLog.createMany).mockRejectedValue(
      new Error('log table locked')
    );

    await expect(
      OrderCalculationService.saveOrderItem(base)
    ).resolves.toBeDefined();

    expect(asMock(prismaMock.orderItem.update)).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Error logging changes:',
      expect.any(Error)
    );
  });
});

describe('deleteOrderItem', () => {
  it('удаление пересчитывает итоги заказа', async () => {
    asMock(prismaMock.orderItem.findUnique).mockResolvedValue({
      categoryOrderId: 10,
    });

    await OrderCalculationService.deleteOrderItem(100);

    expect(asMock(prismaMock.orderItem.delete)).toHaveBeenCalledWith({
      where: { id: 100 },
    });
    expect(categoryOrders.recalculateTotals).toHaveBeenCalledWith(10);
  });

  it('удаление несуществующей позиции не пересчитывает итоги', async () => {
    asMock(prismaMock.orderItem.findUnique).mockResolvedValue(null);

    /* 404 со своим кодом вместо «Failed to delete order item»: до типизации
       удаление уже удалённой позиции выглядело как сбой сервера. */
    await expect(
      OrderCalculationService.deleteOrderItem(100)
    ).rejects.toMatchObject({
      message: 'OrderItem not found',
      statusCode: 404,
      code: 'ITEM_NOT_FOUND',
    });

    expect(categoryOrders.recalculateTotals).not.toHaveBeenCalled();
  });
});

describe('getProgress', () => {
  function progressRow(participantCount: number, orderItems: number) {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue({
      participantCount,
      _count: { orderItems },
    });
  }

  it('считает процент заполненности', async () => {
    progressRow(4, 1);

    await expect(OrderCalculationService.getProgress(10)).resolves.toEqual({
      total: 4,
      filled: 1,
      isComplete: false,
      percentage: 25,
    });
  });

  it('полностью заполненный заказ помечается готовым', async () => {
    progressRow(3, 3);

    const progress = await OrderCalculationService.getProgress(10);

    expect(progress).toMatchObject({ isComplete: true, percentage: 100 });
  });

  it('заказ без участников не считается готовым при нуле позиций', async () => {
    progressRow(0, 0);

    const progress = await OrderCalculationService.getProgress(10);

    expect(progress).toMatchObject({ isComplete: false, percentage: 0 });
  });

  it('процент округляется', async () => {
    progressRow(3, 1);

    expect((await OrderCalculationService.getProgress(10)).percentage).toBe(33);
  });

  it('несуществующий заказ — 404 NOT_FOUND', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue(null);

    await expect(OrderCalculationService.getProgress(10)).rejects.toMatchObject({
      message: 'CategoryOrder not found',
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});

describe('finalizeCalculation: кто с кем рассчитывается', () => {
  function setup(over: Record<string, unknown> = {}) {
    const order = categoryOrder(over);
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue(order);
    return order;
  }

  it('ответственный себе долг не выставляет', async () => {
    setup();
    asMock(prismaMock.transaction.findMany).mockResolvedValue([]);

    await OrderCalculationService.finalizeCalculation(10);

    const rows = insertedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fromUserId: 2, toUserId: 1, amount: 400 });
  });

  it('доли доставки, сервиса и чаевых делятся на всех, включая ответственного', async () => {
    setup({ deliveryCost: 200, serviceFee: 100, tip: 50 });

    await OrderCalculationService.finalizeCalculation(10);

    const [row] = insertedRows();
    expect(row).toMatchObject({
      itemPrice: 400,
      deliveryShare: 100,
      serviceShare: 50,
      tipShare: 25,
      amount: 575,
    });
  });

  it('транзакции создаются со статусом PENDING и ссылкой на голосование', async () => {
    setup();

    await OrderCalculationService.finalizeCalculation(10);

    expect(insertedRows()[0]).toMatchObject({
      status: 'PENDING',
      pollId: 5,
      categoryOrderId: 10,
    });
  });

  it('возвращает число созданных транзакций и состав', async () => {
    setup();
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      { id: 1, fromUserId: 2, toUserId: 1, amount: 400 },
    ]);

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).resolves.toEqual({
      transactionsCreated: 1,
      participantCount: 2,
      orderItemsCount: 2,
    });
  });

  it('заказ из одного человека, он же ответственный, транзакций не создаёт', async () => {
    categoryOrders.getParticipants.mockResolvedValue([1]);
    setup({ items: [{ userId: 1, price: 300 }] });

    await OrderCalculationService.finalizeCalculation(10);

    expect(asMock(prismaMock.transaction.createMany)).not.toHaveBeenCalled();
  });
});

describe('finalizeCalculation: отказы', () => {
  function setup(over: Record<string, unknown> = {}) {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue(
      categoryOrder(over)
    );
  }

  it('несуществующий заказ', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue(null);

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).rejects.toThrow('CategoryOrder not found');
  });

  it('кто-то не ввёл цену — расчёт отклоняется', async () => {
    categoryOrders.getParticipants.mockResolvedValue([1, 2, 3]);
    setup();

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).rejects.toThrow('must exactly match category participants');
  });

  it('посторонний в заказе — расчёт отклоняется', async () => {
    categoryOrders.getParticipants.mockResolvedValue([1, 2]);
    setup({ items: [{ userId: 1, price: 300 }, { userId: 99, price: 400 }] });

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).rejects.toThrow('must exactly match category participants');
  });

  it('пустой список участников — расчёт отклоняется', async () => {
    categoryOrders.getParticipants.mockResolvedValue([]);
    setup({ items: [], participantCount: 0 });

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).rejects.toThrow('must exactly match category participants');
  });

  it('participantCount, разошедшийся с составом, — расчёт отклоняется', async () => {
    setup({ participantCount: 5 });

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).rejects.toThrow('must exactly match category participants');
  });

  it('без ответственного расчёт невозможен: некому платить', async () => {
    setup({ responsibleUserId: null });

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).rejects.toThrow('Responsible user is not selected yet');
  });

  it.each([
    ['отрицательная доставка', { deliveryCost: -1 }],
    ['доставка сверх лимита', { deliveryCost: 1_000_001 }],
    ['отрицательные чаевые', { tip: -5 }],
    ['нечисловой сервисный сбор', { serviceFee: Number.NaN }],
  ])('%s — расчёт отклоняется', async (_name, over) => {
    setup(over);

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).rejects.toThrow('Additional costs are outside the allowed range');
  });

  it('нулевая цена позиции — расчёт отклоняется', async () => {
    setup({ items: [{ userId: 1, price: 300 }, { userId: 2, price: 0 }] });

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).rejects.toThrow('Order item price is outside the allowed range');
  });

  it('цена позиции сверх лимита — расчёт отклоняется', async () => {
    setup({
      items: [{ userId: 1, price: 300 }, { userId: 2, price: 1_000_001 }],
    });

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).rejects.toThrow('Order item price is outside the allowed range');
  });

  it('ни одна проверка не доходит до записи в БД', async () => {
    setup({ responsibleUserId: null });

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).rejects.toThrow();

    expect(asMock(prismaMock.transaction.createMany)).not.toHaveBeenCalled();
    expect(asMock(prismaMock.categoryOrder.updateMany)).not.toHaveBeenCalled();
  });
});

describe('finalizeCalculation: идемпотентность', () => {
  beforeEach(() => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue(
      categoryOrder()
    );
  });

  it('статус переводится только из PENDING или IN_PROGRESS', async () => {
    await OrderCalculationService.finalizeCalculation(10);

    expect(asMock(prismaMock.categoryOrder.updateMany)).toHaveBeenCalledWith({
      where: {
        id: 10,
        calculationStatus: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      data: expect.objectContaining({ calculationStatus: 'COMPLETED' }),
    });
  });

  it('повторная финализация не создаёт второй комплект долгов', async () => {
    asMock(prismaMock.categoryOrder.updateMany).mockResolvedValue({ count: 0 });
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      { id: 1, fromUserId: 2, toUserId: 1, amount: 400 },
    ]);
    // Внутри транзакции сервис перечитывает статус — он уже COMPLETED.
    asMock(prismaMock.categoryOrder.findUnique)
      .mockResolvedValueOnce(categoryOrder())
      .mockResolvedValue({ calculationStatus: 'COMPLETED' });

    const result = await OrderCalculationService.finalizeCalculation(10);

    expect(asMock(prismaMock.transaction.createMany)).not.toHaveBeenCalled();
    expect(result.transactionsCreated).toBe(1);
  });

  it('повторная финализация не рассылает уведомления второй раз', async () => {
    asMock(prismaMock.categoryOrder.updateMany).mockResolvedValue({ count: 0 });
    asMock(prismaMock.categoryOrder.findUnique)
      .mockResolvedValueOnce(categoryOrder())
      .mockResolvedValue({ calculationStatus: 'COMPLETED' });
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      { id: 1, fromUserId: 2, toUserId: 1, amount: 400 },
    ]);

    await OrderCalculationService.finalizeCalculation(10);

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('гонка со сторонним изменением статуса прерывает расчёт', async () => {
    asMock(prismaMock.categoryOrder.updateMany).mockResolvedValue({ count: 0 });
    asMock(prismaMock.categoryOrder.findUnique)
      .mockResolvedValueOnce(categoryOrder())
      .mockResolvedValue({ calculationStatus: 'CANCELLED' });

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).rejects.toThrow('Category order state changed during finalization');
  });

  it('вставка транзакций терпит дубликаты: повтор внутри одной попытки безопасен', async () => {
    await OrderCalculationService.finalizeCalculation(10);

    expect(asMock(prismaMock.transaction.createMany)).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });
});

describe('уведомления о долге', () => {
  const TX = {
    id: 500,
    fromUserId: 2,
    toUserId: 1,
    amount: 575,
    itemPrice: 400,
    deliveryShare: 100,
    serviceShare: 50,
    tipShare: 25,
  };

  function setup(over: Record<string, unknown> = {}) {
    asMock(prismaMock.categoryOrder.findUnique)
      .mockResolvedValueOnce(categoryOrder(over))
      .mockResolvedValue({
        participantMessages: (over.participantMessages as string) ?? null,
      });
    asMock(prismaMock.transaction.findMany).mockResolvedValue([TX]);
    asMock(prismaMock.user.findMany)
      .mockResolvedValueOnce([{ id: 2, telegramId: 222n, firstName: 'Пётр' }])
      .mockResolvedValueOnce([
        {
          id: 1,
          firstName: 'Иван',
          username: 'ivan',
          paymentCard: '2200 1234',
          paymentPhone: null,
        },
      ]);
  }

  function sentText(): string {
    return api.sendMessage.mock.calls[0][1] as string;
  }

  it('должник получает сумму, разбивку и реквизиты', async () => {
    setup();

    await OrderCalculationService.finalizeCalculation(10);

    expect(api.sendMessage).toHaveBeenCalledWith(
      '222',
      expect.any(String),
      expect.objectContaining({ reply_markup: expect.any(Object) })
    );
    const text = sentText();
    expect(text).toContain('Плов');
    expect(text).toContain('Блюдо: 400.00₽');
    expect(text).toContain('Доставка: 100.00₽');
    expect(text).toContain('Сервис: 50.00₽');
    expect(text).toContain('Чаевые: 25.00₽');
    expect(text).toContain('2200 1234');
    expect(text).toContain('@ivan');
  });

  it('кнопка «Оплатил» несёт id транзакции', async () => {
    setup();

    await OrderCalculationService.finalizeCalculation(10);

    const markup = JSON.stringify(api.sendMessage.mock.calls[0][2]);
    expect(markup).toContain('budget:mark_paid:500');
  });

  it('нулевые доли в разбивку не попадают', async () => {
    setup();
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      { ...TX, deliveryShare: 0, serviceShare: 0, tipShare: 0, amount: 400 },
    ]);

    await OrderCalculationService.finalizeCalculation(10);

    const text = sentText();
    expect(text).not.toContain('Доставка');
    expect(text).not.toContain('Чаевые');
  });

  it('телефон показывается вместо карты, если карты нет', async () => {
    users.getPaymentInfoMany.mockResolvedValue(
      new Map([[1, { paymentCard: null, paymentPhone: '+7 999 000' }]])
    );
    setup();

    await OrderCalculationService.finalizeCalculation(10);

    expect(sentText()).toContain('+7 999 000');
  });

  /* Ответственного нет в карте — это и есть «реквизитов нет»: одиночный
     вариант отдавал бы здесь null. */
  it('без реквизитов ответственного остаётся предупреждение в логе', async () => {
    users.getPaymentInfoMany.mockResolvedValue(new Map());
    setup();

    await OrderCalculationService.finalizeCalculation(10);

    expect(logger.warn).toHaveBeenCalledWith(
      'Responsible has no payment details',
      expect.objectContaining({ responsibleId: 1 })
    );
    expect(api.sendMessage).toHaveBeenCalled();
  });

  it('ответственный без username помечается прямо в сообщении', async () => {
    setup();
    asMock(prismaMock.user.findMany)
      .mockReset()
      .mockResolvedValueOnce([{ id: 2, telegramId: 222n, firstName: 'Пётр' }])
      .mockResolvedValueOnce([{ id: 1, firstName: 'Иван', username: null }]);

    await OrderCalculationService.finalizeCalculation(10);

    expect(sentText()).toContain('тег не указан');
  });

  /* Реквизиты берутся ДО цикла, одним запросом на всех ответственных. Раньше
     запрос был внутри цикла по должникам, и от повторов спасал только Map —
     то есть цена рассылки росла от числа разных ответственных. */
  it('реквизиты запрашиваются одним вызовом, не по должнику', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      TX,
      { ...TX, id: 501, fromUserId: 3 },
    ]);
    asMock(prismaMock.categoryOrder.findUnique)
      .mockResolvedValueOnce(categoryOrder())
      .mockResolvedValue({ participantMessages: null });
    asMock(prismaMock.user.findMany)
      .mockResolvedValueOnce([
        { id: 2, telegramId: 222n, firstName: 'Пётр' },
        { id: 3, telegramId: 333n, firstName: 'Анна' },
      ])
      .mockResolvedValueOnce([{ id: 1, firstName: 'Иван', username: 'ivan' }]);

    await OrderCalculationService.finalizeCalculation(10);

    expect(users.getPaymentInfoMany).toHaveBeenCalledTimes(1);
    expect(users.getPaymentInfoMany).toHaveBeenCalledWith([1]);
    expect(api.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('сообщение «ожидаем расчёт» редактируется, а не дублируется новым', async () => {
    setup({
      participantMessages: JSON.stringify({
        '2': { messageId: 77, chatId: '222' },
      }),
    });

    await OrderCalculationService.finalizeCalculation(10);

    expect(api.editMessageText).toHaveBeenCalledWith(
      '222',
      77,
      expect.stringContaining('Сумма к оплате'),
      expect.any(Object)
    );
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('если правка не удалась, уходит новое сообщение', async () => {
    api.editMessageText.mockRejectedValue(new Error('message too old'));
    setup({
      participantMessages: JSON.stringify({
        '2': { messageId: 77, chatId: '222' },
      }),
    });

    await OrderCalculationService.finalizeCalculation(10);

    expect(api.sendMessage).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to edit waiting message, sending new one',
      expect.any(Object)
    );
  });

  it('id отправленного сообщения сохраняется на транзакции', async () => {
    setup();

    await OrderCalculationService.finalizeCalculation(10);

    expect(asMock(prismaMock.transaction.update)).toHaveBeenCalledWith({
      where: { id: 500 },
      data: { debtMessageId: 900, debtChatId: '222' },
    });
  });

  it('должник, которого нет в БД, пропускается без падения рассылки', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([TX]);
    asMock(prismaMock.categoryOrder.findUnique)
      .mockResolvedValueOnce(categoryOrder())
      .mockResolvedValue({ participantMessages: null });
    asMock(prismaMock.user.findMany).mockResolvedValue([]);

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).resolves.toMatchObject({ transactionsCreated: 1 });

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('ответственный, которого нет в БД, пропускается', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([TX]);
    asMock(prismaMock.categoryOrder.findUnique)
      .mockResolvedValueOnce(categoryOrder())
      .mockResolvedValue({ participantMessages: null });
    asMock(prismaMock.user.findMany)
      .mockResolvedValueOnce([{ id: 2, telegramId: 222n, firstName: 'Пётр' }])
      .mockResolvedValueOnce([]);

    await OrderCalculationService.finalizeCalculation(10);

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  /**
   * Раньше проверка `if (!botInstance)` была недостижима — botInstance был
   * функцией и всегда правдив, — поэтому отсутствие бота проявлялось падением
   * на `.api` и попадало в логи как ошибка рассылки. Теперь это штатный
   * пропуск: расчёт уже записан, ошибки быть не должно.
   */
  it('отсутствие бота не отменяет уже записанные долги', async () => {
    asMock(getBotInstance).mockReturnValue(null);
    setup();

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).resolves.toMatchObject({ transactionsCreated: 1 });

    expect(logger.warn).toHaveBeenCalledWith(
      'Bot instance not initialized, skipping debt notifications'
    );
    expect(logger.error).not.toHaveBeenCalledWith(
      'Error sending debt notifications:',
      expect.any(Error)
    );
  });

  it('сбой рассылки не отменяет расчёт', async () => {
    api.sendMessage.mockRejectedValue(new Error('bot blocked by user'));
    setup();

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).resolves.toMatchObject({ transactionsCreated: 1 });
  });

  it('битый JSON в participantMessages не ломает рассылку', async () => {
    setup({ participantMessages: '{not json' });

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).resolves.toMatchObject({ transactionsCreated: 1 });

    expect(logger.error).toHaveBeenCalledWith(
      'Error sending debt notifications:',
      expect.any(Error)
    );
  });
});

describe('чтение истории и позиций', () => {
  it('история правок сортируется от новых к старым', async () => {
    asMock(prismaMock.orderItemEditLog.findMany).mockResolvedValue([
      { id: 2, fieldChanged: 'price' },
    ]);

    await expect(OrderCalculationService.getEditHistory(100)).resolves.toHaveLength(1);
    expect(asMock(prismaMock.orderItemEditLog.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderItemId: 100 },
        orderBy: { timestamp: 'desc' },
      })
    );
  });

  it('сбой чтения истории превращается в понятную ошибку', async () => {
    asMock(prismaMock.orderItemEditLog.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(OrderCalculationService.getEditHistory(100)).rejects.toThrow(
      'Failed to get edit history'
    );
  });

  it('позиции заказа отдаются с авторами', async () => {
    asMock(prismaMock.orderItem.findMany).mockResolvedValue([{ id: 100 }]);

    await expect(OrderCalculationService.getOrderItems(10)).resolves.toHaveLength(1);
    expect(asMock(prismaMock.orderItem.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { categoryOrderId: 10 },
        orderBy: { userId: 'asc' },
      })
    );
  });

  it('сбой чтения позиций превращается в понятную ошибку', async () => {
    asMock(prismaMock.orderItem.findMany).mockRejectedValue(new Error('db down'));

    await expect(OrderCalculationService.getOrderItems(10)).rejects.toThrow(
      'Failed to get order items'
    );
  });
});
