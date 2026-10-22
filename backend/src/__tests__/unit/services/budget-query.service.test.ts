/**
 * Чтения по транзакциям: свои долги, свои кредиты, статистика. Видимость
 * реквизитов, фильтры статуса и область команды проверяет
 * integration/api/budget-lifecycle.redis.test.ts на настоящей БД; здесь
 * остались крайние случаи фильтра членства и арифметика статистики.
 */
import { BudgetQueryService } from '../../../services/budget-query.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

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

describe('getUserDebts', () => {
  beforeEach(() => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([tx()] as never);
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
});

describe('getUserCredits', () => {
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
});

describe('getUserStats', () => {
  beforeEach(() => {
    asMock(prismaMock.responsibleSelection.count).mockResolvedValue(3);
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
});

/**
 * Область команды. У долга две связи с командой, и учитываются обе:
 * обеденное голосование (`poll.groupId`) и магазинный забег
 * (`storeRun.groupId`).
 */
describe('область команды', () => {
  beforeEach(() => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([tx()] as never);
  });

  it('счётчик «был ответственным» тоже по выбранной команде', async () => {
    await service.getUserStats(1, undefined, undefined, 100);

    expect(prismaMock.responsibleSelection.count).toHaveBeenCalledWith({
      where: { selectedUserId: 1, poll: { groupId: 100 } },
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
