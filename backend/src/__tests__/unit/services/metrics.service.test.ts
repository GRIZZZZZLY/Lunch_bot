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

/** Сброс состояния синглтона между тестами (только подготовка, не проверка). */
const internals = metricsService as unknown as {
  responseTimes: number[];
  metrics: { errors24h: number };
};

/** Ответ prisma.<model>.count по условию, а не по порядку вызовов. */
function countByStatus(byStatus: Record<string, number>, otherwise: number) {
  return (async (args?: { where?: { status?: string } }) =>
    byStatus[args?.where?.status ?? ''] ?? otherwise) as never;
}

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
  /* Очередь уведомлений тоже читается из БД при каждом сборе показателей
     (OutboxService.stats): без этих ответов сбор падал бы на undefined. */
  asMock(prismaMock.outboxEvent.count).mockResolvedValue(0);
  asMock(prismaMock.outboxEvent.findFirst).mockResolvedValue(null);
});

describe('collectMetrics', () => {
  it('активные голосования и пользователи попадают в Prometheus', async () => {
    asMock(prismaMock.poll.count).mockImplementation(
      countByStatus({ ACTIVE: 3, COMPLETED: 7 }, 10)
    );
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
  });

  it('getMetrics отдаёт копию, а не сам снимок', () => {
    const first = metricsService.getMetrics();
    first.errors24h = 999;

    expect(metricsService.getMetrics().errors24h).not.toBe(999);
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

  it('окно ограничено: старые значения вытесняются', async () => {
    metricsService.recordResponseTime(1_000_000);
    for (let i = 0; i < 10_000; i++) {
      metricsService.recordResponseTime(0);
    }

    // Без вытеснения выброс дал бы среднее около 100.
    expect((await metricsService.collectMetrics()).avgResponseTime).toBe(0);
  });
});

describe('счётчики', () => {
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
  });

  it('HTTP-запрос учитывается и в счётчике, и в среднем времени', async () => {
    metricsService.recordHttpRequest('GET', '/api/polls', 200, 42);

    await expect(
      metricValue(
        'food_bot_http_requests_total',
        'method="GET",route="/api/polls",status="200"'
      )
    ).resolves.toBe(1);
    expect((await metricsService.collectMetrics()).avgResponseTime).toBe(42);
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
  it('среднее число голосов на голосование берётся из снимка', async () => {
    asMock(prismaMock.poll.count).mockImplementation(countByStatus({}, 4));
    asMock(prismaMock.vote.count).mockResolvedValue(10);
    await metricsService.collectMetrics();
    asMock(prismaMock.poll.count).mockResolvedValue(0);
    asMock(prismaMock.vote.count).mockResolvedValue(0);

    const stats = await metricsService.getDetailedStats();

    expect(stats?.avgVotesPerPoll).toBe(3);
  });

  it('без голосований среднее — ноль, а не деление на ноль', async () => {
    await metricsService.collectMetrics();

    expect((await metricsService.getDetailedStats())?.avgVotesPerPoll).toBe(0);
  });

  it('сбой БД отдаёт null, а не исключение', async () => {
    asMock(prismaMock.poll.count).mockRejectedValue(new Error('db down'));

    await expect(metricsService.getDetailedStats()).resolves.toBeNull();
  });
});

/**
 * Очередь исходящих уведомлений наружу.
 *
 * До этого реестр Prometheus заполнялся, но ни один маршрут его не отдавал —
 * считать показатель и никому его не показывать всё равно что не считать.
 * Здесь закреплено, что значения очереди попадают и в JSON, и в текстовый
 * экспорт для сборщика.
 */
describe('показатели очереди уведомлений', () => {
  beforeEach(() => {
    /* Ожидающие, упавшие и ожидающие с попытками различаются условием. */
    asMock(prismaMock.outboxEvent.count).mockImplementation((async (args: {
      where: { status: string; attempts?: unknown };
    }) => (args.where.status === 'FAILED' ? 2 : args.where.attempts ? 3 : 7)) as never);
    asMock(prismaMock.outboxEvent.findFirst).mockResolvedValue({
      createdAt: new Date(Date.now() - 90_000),
    });
  });

  it('попадают в снимок метрик', async () => {
    const snapshot = await metricsService.collectMetrics();

    expect(snapshot.outboxPending).toBe(7);
    expect(snapshot.outboxFailed).toBe(2);
    expect(snapshot.outboxRetrying).toBe(3);
    /* Возраст самого старого — тот показатель, по которому видно, что
       доставка встала. 90 секунд назад, допуск на время прогона. */
    expect(snapshot.outboxOldestPendingAgeSeconds).toBeGreaterThanOrEqual(89);
    expect(snapshot.outboxOldestPendingAgeSeconds).toBeLessThan(120);
  });

  it('попадают в экспорт для Prometheus', async () => {
    await metricsService.collectMetrics();

    await expect(metricValue('food_bot_outbox_pending')).resolves.toBe(7);
    await expect(metricValue('food_bot_outbox_failed')).resolves.toBe(2);
    await expect(metricValue('food_bot_outbox_retrying')).resolves.toBe(3);
    await expect(
      metricValue('food_bot_outbox_oldest_pending_age_seconds')
    ).resolves.toBeGreaterThanOrEqual(89);
  });

  it('пустая очередь даёт нули, а не отсутствие метрики', async () => {
    asMock(prismaMock.outboxEvent.count).mockReset().mockResolvedValue(0);
    asMock(prismaMock.outboxEvent.findFirst)
      .mockReset()
      .mockResolvedValue(null);

    await metricsService.collectMetrics();

    /* Пропавшая метрика и метрика со значением 0 — разные вещи для
       оповещения: по первой правило молча не срабатывает никогда. */
    await expect(metricValue('food_bot_outbox_pending')).resolves.toBe(0);
    await expect(
      metricValue('food_bot_outbox_oldest_pending_age_seconds')
    ).resolves.toBe(0);
  });
});
