/**
 * Расчёт заказа: превращение введённых цен в долги конкретным людям.
 * Основной путь (позиции, финализация, долги в копейках, идемпотентность)
 * проверяется на настоящей БД в integration/api/category-orders.redis.test.ts.
 * Здесь остаются чистое деление на копейки, отказы финализации и ветки сбоев
 * рассылки, которые через HTTP не воспроизвести.
 */
import {
  OrderCalculationService,
  splitIntoKopecks,
} from '../../../services/order-calculation.service';
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
  asMock(prismaMock.orderItemEditLog.createMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.categoryOrder.updateMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.transaction.createMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.transaction.findMany).mockResolvedValue([]);
  asMock(prismaMock.transaction.update).mockResolvedValue({ id: 1 });
  asMock(prismaMock.user.findMany).mockResolvedValue([]);
});

/**
 * Деньги — в целых копейках, и доли в сумме дают ровно исходную сумму.
 * Раньше доля считалась делением в плавающей точке: 100 ₽ доставки на троих
 * записывались как 33.333333333333336, и сборщик недополучал копейку.
 */
describe('splitIntoKopecks', () => {
  it.each([
    [100, 3, [3334, 3333, 3333]],
    [90, 3, [3000, 3000, 3000]],
    [10.1, 3, [337, 337, 336]],
    [0.05, 3, [2, 2, 1]],
    [7.01, 1, [701]],
    [0, 2, [0, 0]],
  ])('%p ₽ на %p → %p коп.', (total, parts, expected) => {
    expect(splitIntoKopecks(total, parts)).toEqual(expected);
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
    ).resolves.toMatchObject({ price: 350 });
  });
});

describe('getProgress', () => {
  it('процент округляется', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue({
      participantCount: 3,
      _count: { orderItems: 1 },
    });

    expect((await OrderCalculationService.getProgress(10)).percentage).toBe(33);
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

  it('должник получает сообщение с суммой к оплате', async () => {
    setup();

    await OrderCalculationService.finalizeCalculation(10);

    expect(api.sendMessage).toHaveBeenCalledWith(
      '222',
      expect.any(String),
      expect.objectContaining({ reply_markup: expect.any(Object) })
    );
    expect(sentText()).toContain('575');
  });

  /* Ссылка СБП уходит кнопкой рядом с «Оплатил», а не текстом под подписью
     «Карта»; legacy-номер остаётся в тексте только маской. */
  it.each([
    { card: 'https://qr.nspk.ru/AS1A00', linkButtons: ['https://qr.nspk.ru/AS1A00'] },
    { card: '2200 1234', linkButtons: [] },
  ])('реквизиты $card: ссылка только кнопкой, номер только маской', async ({ card, linkButtons }) => {
    users.getPaymentInfoMany.mockResolvedValue(
      new Map([[1, { paymentCard: card, paymentPhone: null }]])
    );
    setup();

    await OrderCalculationService.finalizeCalculation(10);

    expect(sentText()).not.toContain(card);
    const markup = api.sendMessage.mock.calls[0][2] as {
      reply_markup: { inline_keyboard: { url?: string; callback_data?: string }[][] };
    };
    const buttons = markup.reply_markup.inline_keyboard.flat();
    expect(buttons.flatMap(button => (button.url ? [button.url] : []))).toEqual(linkButtons);
    expect(buttons.map(button => button.callback_data)).toContain('budget:mark_paid:500');
  });

  it('телефон показывается вместо карты, если карты нет', async () => {
    users.getPaymentInfoMany.mockResolvedValue(
      new Map([[1, { paymentCard: null, paymentPhone: '+7 999 000' }]])
    );
    setup();

    await OrderCalculationService.finalizeCalculation(10);

    expect(sentText()).toContain('+7 999 000');
  });

  /* Ответственного нет в карте — это и есть «реквизитов нет». */
  it('без реквизитов ответственного сообщение всё равно уходит', async () => {
    users.getPaymentInfoMany.mockResolvedValue(new Map());
    setup();

    await OrderCalculationService.finalizeCalculation(10);

    expect(api.sendMessage).toHaveBeenCalled();
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

  /* Раньше проверка `if (!botInstance)` была недостижима, и отсутствие бота
     проявлялось падением рассылки. Расчёт уже записан, ошибки быть не должно. */
  it('отсутствие бота не отменяет уже записанные долги', async () => {
    asMock(getBotInstance).mockReturnValue(null);
    setup();

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).resolves.toMatchObject({ transactionsCreated: 1 });
  });

  it('сбой рассылки не отменяет расчёт', async () => {
    api.sendMessage.mockRejectedValue(new Error('bot blocked by user'));
    setup();

    await expect(
      OrderCalculationService.finalizeCalculation(10)
    ).resolves.toMatchObject({ transactionsCreated: 1 });
  });
});
