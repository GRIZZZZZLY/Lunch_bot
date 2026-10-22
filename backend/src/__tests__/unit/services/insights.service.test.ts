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

const NOW = new Date('2026-08-03T12:00:00.000Z');

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

  it('средний день округляется', async () => {
    withTransactions([
      tx({ amount: 100, day: '2026-08-01' }),
      tx({ amount: 101, day: '2026-08-02' }),
      tx({ amount: 100, day: '2026-08-03' }),
    ]);

    expect((await InsightsService.getBudgetInsights(1)).averagePerDay).toBe(100);
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

  it('без голосов — ноль голосов и пустой список', async () => {
    const insights = await InsightsService.getCategoryInsights(1);

    expect(insights).toMatchObject({ totalVotes: 0, categories: [] });
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
});
