/**
 * Метрики. Ценность этого модуля — в том, что он не мешает работать: он висит
 * на каждом HTTP-запросе, и сбой сбора не имеет права стать сбоем запроса.
 * Поэтому проверяется, что при недоступной БД возвращается прошлый снимок, а не
 * исключение.
 *
 * Второе: окно средних времён ограничено, иначе массив растёт бесконечно и
 * средним становится «за всё время работы процесса», а не «сейчас».
 */
import { metricsService } from '../../../services/metrics.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');

/** Приватное состояние: окно времён ответа и накопленный снимок. */
const internals = metricsService as unknown as {
  responseTimes: number[];
  MAX_RESPONSE_TIMES: number;
  metrics: { errors24h: number; totalPolls: number; totalVotes: number };
};

/** Значение метрики Prometheus по имени, из текстового экспорта. */
async function metricValue(name: string, labels = ''): Promise<number | null> {
  const text = await metricsService.getPrometheusMetrics();
  const needle = labels ? `${name}{${labels}}` : name;
  const line = text
    .split('\n')
    .find(row => row.startsWith(needle) && !row.startsWith('#'));
  return line ? Number(line.slice(line.lastIndexOf(' ') + 1)) : null;
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();

  internals.responseTimes.length = 0;
  internals.metrics.errors24h = 0;

  asMock(prismaMock.poll.count).mockResolvedValue(0);
  asMock(prismaMock.vote.count).mockResolvedValue(0);
  asMock(prismaMock.user.count).mockResolvedValue(0);
  asMock(prismaMock.transaction.count).mockResolvedValue(0);
});

describe('collectMetrics', () => {
  it('снимок собирается одним пакетом запросов', async () => {
    asMock(prismaMock.poll.count)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(8);
    asMock(prismaMock.vote.count).mockResolvedValue(40);
    asMock(prismaMock.user.count).mockResolvedValue(7);
    asMock(prismaMock.transaction.count).mockResolvedValue(12);

    const metrics = await metricsService.collectMetrics();

    expect(metrics).toMatchObject({
      totalPolls: 10,
      activePolls: 2,
      completedPolls: 8,
      totalVotes: 40,
      totalUsers: 7,
      totalTransactions: 12,
    });
    expect(metrics.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('активные голосования и пользователи попадают в Prometheus', async () => {
    asMock(prismaMock.poll.count)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(7);
    asMock(prismaMock.user.count).mockResolvedValue(5);

    await metricsService.collectMetrics();

    await expect(metricValue('food_bot_active_polls')).resolves.toBe(3);
    await expect(metricValue('food_bot_users_total')).resolves.toBe(5);
  });

  it('недоступная БД не роняет запрос: возвращается прошлый снимок', async () => {
    asMock(prismaMock.poll.count).mockResolvedValue(4);
    await metricsService.collectMetrics();
    asMock(prismaMock.poll.count).mockRejectedValue(new Error('db down'));

    const metrics = await metricsService.collectMetrics();

    expect(metrics.totalPolls).toBe(4);
    expect(logger.error).toHaveBeenCalledWith('Failed to collect metrics', {
      error: expect.any(Error),
    });
  });

  it('getMetrics отдаёт копию, а не сам снимок', () => {
    const first = metricsService.getMetrics();
    first.errors24h = 999;

    expect(metricsService.getMetrics().errors24h).not.toBe(999);
  });

  it('registry доступен для экспорта', () => {
    expect(metricsService.getRegistry()).toBeDefined();
  });
});

describe('время ответа', () => {
  it('среднее считается по записанным значениям', async () => {
    metricsService.recordResponseTime(100);
    metricsService.recordResponseTime(200);

    const metrics = await metricsService.collectMetrics();

    expect(metrics.avgResponseTime).toBe(150);
  });

  it('без записей среднее — ноль, а не NaN', async () => {
    const metrics = await metricsService.collectMetrics();

    expect(metrics.avgResponseTime).toBe(0);
  });

  it('среднее округляется', async () => {
    metricsService.recordResponseTime(100);
    metricsService.recordResponseTime(101);

    expect((await metricsService.collectMetrics()).avgResponseTime).toBe(101);
  });

  it('окно ограничено: старые значения вытесняются', () => {
    const limit = internals.MAX_RESPONSE_TIMES;

    for (let i = 0; i < limit + 10; i++) {
      metricsService.recordResponseTime(i);
    }

    expect(internals.responseTimes).toHaveLength(limit);
    // Первые 10 значений вытеснены — окно скользящее.
    expect(internals.responseTimes[0]).toBe(10);
  });
});

describe('счётчики', () => {
  it('созданные голосования считаются', async () => {
    const before = (await metricValue('food_bot_polls_created_total')) ?? 0;

    metricsService.incrementPollsCreated();

    await expect(metricValue('food_bot_polls_created_total')).resolves.toBe(
      before + 1
    );
  });

  it('голоса считаются', async () => {
    const before = (await metricValue('food_bot_votes_total')) ?? 0;

    metricsService.incrementVotes();

    await expect(metricValue('food_bot_votes_total')).resolves.toBe(before + 1);
  });

  it('ошибки считаются и попадают в суточный счётчик', async () => {
    metricsService.incrementErrors('db');
    metricsService.incrementErrors('db');

    expect(metricsService.getMetrics().errors24h).toBe(2);
    await expect(
      metricValue('food_bot_errors_total', 'type="db"')
    ).resolves.toBe(2);
  });

  it('ошибка без типа помечается unknown', async () => {
    const before =
      (await metricValue('food_bot_errors_total', 'type="unknown"')) ?? 0;

    metricsService.incrementErrors();

    await expect(
      metricValue('food_bot_errors_total', 'type="unknown"')
    ).resolves.toBe(before + 1);
  });

  it('суточный счётчик сбрасывается', () => {
    metricsService.incrementErrors();

    metricsService.resetErrorCount();

    expect(metricsService.getMetrics().errors24h).toBe(0);
    expect(logger.info).toHaveBeenCalledWith('Error count reset');
  });

  it('HTTP-запрос учитывается и в счётчике, и в среднем времени', async () => {
    metricsService.recordHttpRequest('GET', '/api/polls', 200, 42);

    await expect(
      metricValue(
        'food_bot_http_requests_total',
        'method="GET",route="/api/polls",status="200"'
      )
    ).resolves.toBe(1);
    expect(internals.responseTimes).toContain(42);
  });

  it('срезы rate-limit разложены по корзинам', async () => {
    metricsService.incrementRateLimit429('auth', '/api/auth');

    await expect(
      metricValue(
        'food_bot_rate_limit_429_total',
        'bucket="auth",route="/api/auth"'
      )
    ).resolves.toBe(1);
  });

  it('повторы идемпотентных запросов разложены по виду', async () => {
    metricsService.incrementIdempotencyReplay('vote', 'replay');
    metricsService.incrementIdempotencyReplay('vote', 'inflight');

    await expect(
      metricValue(
        'food_bot_idempotency_replay_total',
        'scope="vote",kind="replay"'
      )
    ).resolves.toBe(1);
    await expect(
      metricValue(
        'food_bot_idempotency_replay_total',
        'scope="vote",kind="inflight"'
      )
    ).resolves.toBe(1);
  });
});

describe('getDetailedStats', () => {
  it('считает срезы за сутки и за неделю', async () => {
    asMock(prismaMock.poll.count)
      .mockResolvedValueOnce(2) // polls 24h
      .mockResolvedValueOnce(9); // polls 7d
    asMock(prismaMock.vote.count)
      .mockResolvedValueOnce(8) // votes 24h
      .mockResolvedValueOnce(30); // votes 7d
    asMock(prismaMock.user.count).mockResolvedValue(1);

    await expect(metricsService.getDetailedStats()).resolves.toMatchObject({
      last24h: { polls: 2, votes: 8, users: 1 },
      last7d: { polls: 9, votes: 30 },
    });
  });

  it('среднее число голосов на голосование берётся из снимка', async () => {
    internals.metrics.totalPolls = 4;
    internals.metrics.totalVotes = 10;

    const stats = await metricsService.getDetailedStats();

    expect(stats?.avgVotesPerPoll).toBe(3);
  });

  it('без голосований среднее — ноль, а не деление на ноль', async () => {
    internals.metrics.totalPolls = 0;

    expect((await metricsService.getDetailedStats())?.avgVotesPerPoll).toBe(0);
  });

  it('сбой БД отдаёт null, а не исключение', async () => {
    asMock(prismaMock.poll.count).mockRejectedValue(new Error('db down'));

    await expect(metricsService.getDetailedStats()).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith('Failed to get detailed stats', {
      error: expect.any(Error),
    });
  });
});
