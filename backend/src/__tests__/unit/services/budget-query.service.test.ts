/**
 * Чтения по транзакциям: свои долги, свои кредиты, статистика, поиск по id
 * (для проверки прав в других сервисах). Тесты закрепляют границы видимости
 * данных — какие реквизиты кому видны и куда девается долг участника,
 * вышедшего из группы.
 */
import { BudgetQueryService } from '../../../services/budget-query.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';
import { EncryptionService } from '../../../utils/encryption';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const NOW = new Date('2026-08-03T12:00:00.000Z');

let service: BudgetQueryService;

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
  service = new BudgetQueryService();
});

describe('getTransactionById', () => {
  it('запрашивает только поля, нужные для проверки прав', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ id: 10 } as never);

    await service.getTransactionById(10);

    expect(prismaMock.transaction.findUnique).toHaveBeenCalledWith({
      where: { id: 10 },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        status: true,
      },
    });
  });

  it('ошибка базы выбрасывается наружу', async () => {
    prismaMock.transaction.findUnique.mockRejectedValue(new Error('db down'));

    await expect(service.getTransactionById(10)).rejects.toThrow('db down');
  });
});

describe('getUserDebts', () => {
  beforeEach(() => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([tx()] as never);
  });

  it('берёт долги, где пользователь — плательщик', async () => {
    await service.getUserDebts(1);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fromUserId: 1 },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('реквизиты получателя запрашиваются — по ним человек и переводит', async () => {
    await service.getUserDebts(1);

    const include = (
      prismaMock.transaction.findMany.mock.calls[0][0] as {
        include: { toUser: { select: Record<string, boolean> } };
      }
    ).include;
    expect(include.toUser.select).toMatchObject({
      paymentPhone: true,
      paymentCard: true,
      paymentDetails: true,
    });
  });

  it('свои реквизиты в список долгов не попадают', async () => {
    await service.getUserDebts(1);

    const include = (
      prismaMock.transaction.findMany.mock.calls[0][0] as {
        include: { fromUser: { select: Record<string, boolean> } };
      }
    ).include;
    expect(include.fromUser.select).not.toHaveProperty('paymentCard');
    expect(include.fromUser.select).not.toHaveProperty('paymentPhone');
  });

  it('явный статус фильтрует выборку', async () => {
    await service.getUserDebts(1, 'CONFIRMED');

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fromUserId: 1, status: 'CONFIRMED' } })
    );
  });

  it('реквизиты получателя уходят клиенту расшифрованными, а не шифротекстом', async () => {
    const phoneCipher = EncryptionService.encrypt('+79990001122');
    const cardCipher = EncryptionService.encrypt('https://pay/anya');
    const detailsCipher = EncryptionService.encrypt('Аня, СБП Тинькофф');
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({
        toUser: {
          id: 2,
          firstName: 'Аня',
          telegramId: BigInt(777),
          paymentPhone: phoneCipher,
          paymentCard: cardCipher,
          paymentDetails: detailsCipher,
        },
      }),
    ] as never);

    const [debt] = await service.getUserDebts(1);

    expect(debt.toUser.paymentPhone).toBe('+79990001122');
    expect(debt.toUser.paymentCard).toBe('https://pay/anya');
    expect(debt.toUser.paymentDetails).toBe('Аня, СБП Тинькофф');
    // Шифротекст (формат IV:AuthTag:CipherText) не должен уйти клиенту ни в одном поле
    expect(debt.toUser.paymentPhone).not.toBe(phoneCipher);
    expect(debt.toUser.paymentCard).not.toBe(cardCipher);
    expect(debt.toUser.paymentDetails).not.toBe(detailsCipher);
  });

  it('legacy-реквизиты без шифрования (запись до внедрения EncryptionService) проходят как есть', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({
        toUser: {
          id: 2,
          firstName: 'Аня',
          telegramId: BigInt(777),
          paymentPhone: '89990001122',
          paymentCard: null,
          paymentDetails: null,
        },
      }),
    ] as never);

    const [debt] = await service.getUserDebts(1);

    expect(debt.toUser.paymentPhone).toBe('89990001122');
    expect(debt.toUser.paymentCard).toBeNull();
    expect(debt.toUser.paymentDetails).toBeNull();
  });

  it('activeOnly без статуса берёт незакрытые долги', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([] as never);

    await service.getUserDebts(1, undefined, true);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fromUserId: 1, status: { in: ['PENDING', 'PAID'] } },
      })
    );
  });

  it('activeOnly убирает долг тому, кто вышел из группы', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx(),
      tx({ id: 11, toUserId: 99 }),
    ] as never);
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { groupId: 100, userId: 2 },
    ] as never);

    const debts = await service.getUserDebts(1, undefined, true);

    expect(debts.map(d => d.id)).toEqual([10]);
  });

  /* Ни голосования, ни забега — группу такого долга определить нечем, и
     членство по нему не проверяется. Забег группу имеет, см. отдельный
     describe про область команды. */
  it('долг без обеих связей с группой не отфильтровывается', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 12, poll: null, storeRun: null, toUserId: 99 }),
      tx(),
    ] as never);
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { groupId: 100, userId: 2 },
    ] as never);

    const debts = await service.getUserDebts(1, undefined, true);

    expect(debts.map(d => d.id)).toEqual([12, 10]);
  });

  it('без известных членств фильтр не применяется', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([] as never);

    const debts = await service.getUserDebts(1, undefined, true);

    expect(debts).toHaveLength(1);
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getUserDebts(1)).rejects.toThrow('db down');
  });
});

describe('getUserCredits', () => {
  beforeEach(() => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([tx()] as never);
  });

  it('берёт долги, где пользователь — получатель', async () => {
    await service.getUserCredits(2);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { toUserId: 2 } })
    );
  });

  it('реквизиты должника сборщику не отдаются — деньги идут в другую сторону', async () => {
    await service.getUserCredits(2);

    const include = (
      prismaMock.transaction.findMany.mock.calls[0][0] as {
        include: { fromUser: { select: Record<string, boolean> } };
      }
    ).include;
    expect(include.fromUser.select).toEqual({
      id: true,
      firstName: true,
      username: true,
    });
  });

  it('явный статус фильтрует выборку', async () => {
    await service.getUserCredits(2, 'PAID');

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { toUserId: 2, status: 'PAID' } })
    );
  });

  it('activeOnly убирает долги вышедших из группы должников', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx(),
      tx({ id: 11, fromUserId: 99 }),
    ] as never);
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { groupId: 100, userId: 1 },
    ] as never);

    const credits = await service.getUserCredits(2, undefined, true);

    expect(credits.map(c => c.id)).toEqual([10]);
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getUserCredits(2)).rejects.toThrow('db down');
  });
});

describe('getUserStats', () => {
  beforeEach(() => {
    asMock(prismaMock.responsibleSelection.count).mockResolvedValue(3);
  });

  it('считает траты, поступления и баланс', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 1, amount: 100, status: 'CONFIRMED' }),
      tx({ id: 2, amount: 200, status: 'PENDING' }),
      tx({ id: 3, fromUserId: 2, toUserId: 1, amount: 50 }),
    ] as never);

    const stats = await service.getUserStats(1);

    expect(stats).toMatchObject({
      totalSpent: 300,
      totalReceived: 50,
      balance: -250,
      totalOrders: 2,
      confirmedOrders: 1,
      pendingOrders: 1,
      timesResponsible: 3,
    });
  });

  it('средний чек считается по подтверждённым заказам', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 1, amount: 100, status: 'CONFIRMED' }),
      tx({ id: 2, amount: 200, status: 'CONFIRMED' }),
    ] as never);

    const stats = await service.getUserStats(1);

    expect(stats.averagePerOrder).toBe(150);
  });

  it('без подтверждённых заказов средний чек — ноль, а не деление на ноль', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ amount: 100, status: 'PENDING' }),
    ] as never);

    const stats = await service.getUserStats(1);

    expect(stats.averagePerOrder).toBe(0);
  });

  it('топ блюд отсортирован по сумме и ограничен пятью', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue(
      [
        tx({ id: 1, amount: 100, menuItem: { name: 'Плов', price: 100 } }),
        tx({ id: 2, amount: 100, menuItem: { name: 'Плов', price: 100 } }),
        tx({ id: 3, amount: 500, menuItem: { name: 'Стейк', price: 500 } }),
        tx({ id: 4, amount: 10, menuItem: { name: 'Чай', price: 10 } }),
        tx({ id: 5, amount: 20, menuItem: { name: 'Кофе', price: 20 } }),
        tx({ id: 6, amount: 30, menuItem: { name: 'Сок', price: 30 } }),
        tx({ id: 7, amount: 40, menuItem: { name: 'Суп', price: 40 } }),
      ] as never
    );

    const stats = await service.getUserStats(1);

    expect(stats.topDishes).toHaveLength(5);
    expect(stats.topDishes[0]).toMatchObject({ name: 'Стейк', total: 500 });
    expect(stats.topDishes[1]).toMatchObject({ name: 'Плов', count: 2, total: 200 });
  });

  it('транзакции без блюда в топ не попадают', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ menuItem: null }),
    ] as never);

    const stats = await service.getUserStats(1);

    expect(stats.topDishes).toEqual([]);
  });

  it('диапазон дат уходит в запрос', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);
    const from = new Date('2026-07-01T00:00:00.000Z');
    const to = new Date('2026-08-01T00:00:00.000Z');

    await service.getUserStats(1, from, to);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: from, lte: to } }),
      })
    );
  });

  it('только нижняя граница тоже работает', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);
    const from = new Date('2026-07-01T00:00:00.000Z');

    await service.getUserStats(1, from);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: from } }),
      })
    );
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getUserStats(1)).rejects.toThrow('db down');
  });
});

/**
 * Область команды в чтениях бюджета.
 *
 * Раньше выборка велась только по человеку: командный экран показывал его
 * долги по ВСЕМ командам сразу, а `PRODUCT.md` требует обратного — «любой
 * экран показывает данные ровно одной группы».
 *
 * У долга две связи с командой, и учитываются обе: обеденное голосование
 * (`poll.groupId`) и магазинный забег (`storeRun.groupId`). Долги без обеих
 * связей ни к одной команде не относятся — под фильтром их не видно, в
 * личном итоге по всем командам видно.
 */
describe('область команды', () => {
  /** Условие команды, как оно уходит в Prisma. */
  const groupCondition = (groupId: number) => ({
    OR: [{ poll: { groupId } }, { storeRun: { groupId } }],
  });

  function whereOf(): Record<string, unknown> {
    const call = prismaMock.transaction.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    return call.where;
  }

  beforeEach(() => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([tx()] as never);
  });

  it('долги сужаются по обеим связям с командой', async () => {
    await service.getUserDebts(1, undefined, false, 100);

    expect(whereOf()).toEqual({
      fromUserId: 1,
      AND: [groupCondition(100)],
    });
  });

  it('кредиты сужаются по обеим связям с командой', async () => {
    await service.getUserCredits(2, undefined, false, 100);

    expect(whereOf()).toEqual({
      toUserId: 2,
      AND: [groupCondition(100)],
    });
  });

  /* Через AND, а не разворотом в where: у статистики уже есть свой OR по
     участию человека. Разворот затёр бы его, и статистика поехала бы по всем
     людям сразу — это была бы утечка чужих сумм, а не просто неверное число. */
  it('в статистике фильтр команды не затирает OR по участию', async () => {
    await service.getUserStats(1, undefined, undefined, 100);

    expect(whereOf()).toEqual({
      OR: [{ fromUserId: 1 }, { toUserId: 1 }],
      AND: [groupCondition(100)],
    });
  });

  it('счётчик «был ответственным» тоже по выбранной команде', async () => {
    await service.getUserStats(1, undefined, undefined, 100);

    expect(prismaMock.responsibleSelection.count).toHaveBeenCalledWith({
      where: { selectedUserId: 1, poll: { groupId: 100 } },
    });
  });

  it('без groupId условия команды в запросе нет', async () => {
    await service.getUserDebts(1);

    expect(whereOf()).toEqual({ fromUserId: 1 });
  });

  it('без groupId счётчик ответственного считает все команды', async () => {
    await service.getUserStats(1);

    expect(prismaMock.responsibleSelection.count).toHaveBeenCalledWith({
      where: { selectedUserId: 1 },
    });
  });

  it('фильтр команды сочетается с фильтром статуса', async () => {
    await service.getUserDebts(1, 'PENDING', false, 100);

    expect(whereOf()).toEqual({
      fromUserId: 1,
      status: 'PENDING',
      AND: [groupCondition(100)],
    });
  });

  /* Долг по забегу — полноправный долг команды: его владелец, вышедший из
     группы, должен исчезать из списка так же, как обеденный. Раньше
     `storeRun.groupId` не запрашивался вовсе, и такой долг не проверялся. */
  it('магазинный долг фильтруется по членству в группе забега', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 13, poll: null, storeRun: { id: 3, storeName: 'Лента', groupId: 200 }, toUserId: 99 }),
      tx({ id: 14, poll: null, storeRun: { id: 3, storeName: 'Лента', groupId: 200 }, toUserId: 2 }),
    ] as never);
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { groupId: 200, userId: 2 },
    ] as never);

    const debts = await service.getUserDebts(1, undefined, true);

    expect(debts.map(d => d.id)).toEqual([14]);
  });
});
