/**
 * Аналитика бюджета. Числа отсюда человек видит как факт о своих деньгах,
 * поэтому проверяется арифметика на границах: пустая история (ноль вместо
 * NaN и Infinity), один день (самый дорогой и самый дешёвый день — один и тот
 * же), группировка нескольких платежей в один день и порог тренда в 10%.
 *
 * Прогноз на месяц — это средний день × 30, а не сумма за период: перенос
 * этой формулы «как проще» завышал бы прогноз в разы.
 */
import { InsightsService } from '../../../services/insights.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');

const NOW = new Date('2026-08-03T12:00:00.000Z');
const TODAY = '2026-08-03';

interface TxInit {
  amount: number;
  day?: string;
  confirmedAt?: Date | null;
  createdAt?: Date;
}

function tx(init: TxInit) {
  const at = init.day ? new Date(`${init.day}T10:00:00.000Z`) : NOW;
  return {
    id: 1,
    amount: init.amount,
    confirmedAt: 'confirmedAt' in init ? init.confirmedAt : at,
    createdAt: init.createdAt ?? at,
  };
}

function withTransactions(rows: ReturnType<typeof tx>[]): void {
  asMock(prismaMock.transaction.findMany).mockResolvedValue(rows);
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
  withTransactions([]);
  asMock(prismaMock.vote.findMany).mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getBudgetInsights: пустая история', () => {
  it('всё по нулям, без NaN и Infinity', async () => {
    const insights = await InsightsService.getBudgetInsights(1);

    expect(insights).toEqual({
      totalSpent: 0,
      averagePerDay: 0,
      daysActive: 0,
      savingsVsExternal: 0,
      mostExpensiveDay: { date: TODAY, amount: 0 },
      cheapestDay: { date: TODAY, amount: 0 },
      trend: 'stable',
      projectedMonthly: 0,
    });
  });

  it('считаются только подтверждённые платежи за последние 30 дней', async () => {
    await InsightsService.getBudgetInsights(7);

    expect(asMock(prismaMock.transaction.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fromUserId: 7,
          status: 'CONFIRMED',
          confirmedAt: { gte: new Date('2026-07-04T12:00:00.000Z') },
        }),
      })
    );
  });
});

describe('getBudgetInsights: арифметика', () => {
  it('один день: он и самый дорогой, и самый дешёвый', async () => {
    withTransactions([tx({ amount: 300, day: '2026-08-01' })]);

    const insights = await InsightsService.getBudgetInsights(1);

    expect(insights).toMatchObject({
      totalSpent: 300,
      daysActive: 1,
      averagePerDay: 300,
      mostExpensiveDay: { date: '2026-08-01', amount: 300 },
      cheapestDay: { date: '2026-08-01', amount: 300 },
    });
  });

  it('несколько платежей за день складываются в один день активности', async () => {
    withTransactions([
      tx({ amount: 200, day: '2026-08-01' }),
      tx({ amount: 300, day: '2026-08-01' }),
    ]);

    const insights = await InsightsService.getBudgetInsights(1);

    expect(insights).toMatchObject({
      totalSpent: 500,
      daysActive: 1,
      averagePerDay: 500,
    });
  });

  it('самый дорогой и самый дешёвый день различаются', async () => {
    withTransactions([
      tx({ amount: 100, day: '2026-08-01' }),
      tx({ amount: 900, day: '2026-08-02' }),
    ]);

    const insights = await InsightsService.getBudgetInsights(1);

    expect(insights.mostExpensiveDay).toEqual({
      date: '2026-08-02',
      amount: 900,
    });
    expect(insights.cheapestDay).toEqual({ date: '2026-08-01', amount: 100 });
  });

  it('средний день округляется', async () => {
    withTransactions([
      tx({ amount: 100, day: '2026-08-01' }),
      tx({ amount: 101, day: '2026-08-02' }),
      tx({ amount: 100, day: '2026-08-03' }),
    ]);

    expect((await InsightsService.getBudgetInsights(1)).averagePerDay).toBe(100);
  });

  it('прогноз на месяц — это средний день × 30, а не сумма за период', async () => {
    withTransactions([
      tx({ amount: 300, day: '2026-08-01' }),
      tx({ amount: 300, day: '2026-08-02' }),
    ]);

    expect((await InsightsService.getBudgetInsights(1)).projectedMonthly).toBe(
      9000
    );
  });

  it('экономия против доставки — 30% от потраченного', async () => {
    withTransactions([tx({ amount: 1000, day: '2026-08-01' })]);

    expect((await InsightsService.getBudgetInsights(1)).savingsVsExternal).toBe(
      300
    );
  });

  it('день берётся из даты создания, если подтверждение не записано', async () => {
    withTransactions([
      tx({
        amount: 250,
        confirmedAt: null,
        createdAt: new Date('2026-07-20T09:00:00.000Z'),
      }),
    ]);

    expect(
      (await InsightsService.getBudgetInsights(1)).mostExpensiveDay.date
    ).toBe('2026-07-20');
  });

  it('дробные суммы округляются в итогах', async () => {
    withTransactions([tx({ amount: 300.4, day: '2026-08-01' })]);

    expect((await InsightsService.getBudgetInsights(1)).totalSpent).toBe(300);
  });
});

describe('getBudgetInsights: тренд', () => {
  function daily(amounts: number[]) {
    return amounts.map((amount, index) =>
      tx({ amount, day: `2026-08-${String(index + 1).padStart(2, '0')}` })
    );
  }

  it('меньше четырёх платежей — данных мало, тренд стабилен', async () => {
    withTransactions(daily([100, 900, 900]));

    expect((await InsightsService.getBudgetInsights(1)).trend).toBe('stable');
  });

  it('рост больше 10% — тренд вверх', async () => {
    withTransactions(daily([100, 100, 200, 200]));

    expect((await InsightsService.getBudgetInsights(1)).trend).toBe('up');
  });

  it('падение больше 10% — тренд вниз', async () => {
    withTransactions(daily([200, 200, 100, 100]));

    expect((await InsightsService.getBudgetInsights(1)).trend).toBe('down');
  });

  it('изменение внутри 10% трендом не считается', async () => {
    withTransactions(daily([100, 100, 105, 105]));

    expect((await InsightsService.getBudgetInsights(1)).trend).toBe('stable');
  });

  it('ровно 10% роста трендом не считается: порог строгий', async () => {
    withTransactions(daily([100, 100, 110, 110]));

    expect((await InsightsService.getBudgetInsights(1)).trend).toBe('stable');
  });
});

describe('getCategoryInsights', () => {
  function vote(name: string | null, over: Record<string, unknown> = {}) {
    return {
      id: 1,
      menuItem: name === null ? null : { id: 1, name },
      ...over,
    };
  }

  it('без голосов возвращает честную заглушку вместо пустого имени', async () => {
    const insights = await InsightsService.getCategoryInsights(1);

    expect(insights).toEqual({
      totalVotes: 0,
      categories: [],
      favoriteCategory: 'Пока нет данных',
    });
  });

  it('блюда сортируются по числу голосов', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      vote('Плов'),
      vote('Суп'),
      vote('Плов'),
      vote('Плов'),
    ]);

    const insights = await InsightsService.getCategoryInsights(1);

    expect(insights.categories.map((c: { category: string }) => c.category)).toEqual([
      'Плов',
      'Суп',
    ]);
    expect(insights.favoriteCategory).toBe('Плов');
  });

  it('доля считается от общего числа голосов', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      vote('Плов'),
      vote('Плов'),
      vote('Суп'),
      vote('Салат'),
    ]);

    const insights = await InsightsService.getCategoryInsights(1);

    expect(insights.categories[0]).toMatchObject({
      category: 'Плов',
      count: 2,
      percentage: 50,
    });
  });

  it('голос за удалённое блюдо в статистику не попадает', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      vote('Плов'),
      vote(null),
    ]);

    const insights = await InsightsService.getCategoryInsights(1);

    expect(insights.totalVotes).toBe(2);
    expect(insights.categories).toHaveLength(1);
  });

  it('блюдо без названия пропускается', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([vote('')]);

    expect((await InsightsService.getCategoryInsights(1)).categories).toEqual([]);
  });

  it('окно — последние 30 дней', async () => {
    await InsightsService.getCategoryInsights(9);

    expect(asMock(prismaMock.vote.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 9,
          createdAt: { gte: new Date('2026-07-04T12:00:00.000Z') },
        },
        include: { menuItem: true },
      })
    );
  });
});

describe('сбои БД', () => {
  it('ошибка в аналитике бюджета пробрасывается и логируется', async () => {
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(InsightsService.getBudgetInsights(1)).rejects.toThrow('db down');
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting budget insights:',
      expect.any(Error)
    );
  });

  it('ошибка в статистике блюд пробрасывается и логируется', async () => {
    asMock(prismaMock.vote.findMany).mockRejectedValue(new Error('db down'));

    await expect(InsightsService.getCategoryInsights(1)).rejects.toThrow(
      'db down'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting category insights:',
      expect.any(Error)
    );
  });
});
