/**
 * Жизненный цикл планировщика автоголосований и письма админу.
 *
 * Ключевая защита — advisory-lock в PostgreSQL. Двойной деплой поднимал
 * два процесса с одним и тем же cron, и группа получала два автоголосования
 * (инцидент 2026-07-20). Лок держится на ВЫДЕЛЕННОМ соединении: если бы он
 * брался из пула, соединение вернулось бы в пул и лок снялся. Конкуренция при
 * старте и снятие лока при stop() проверяются на настоящей базе в
 * scheduler-poll.integration.test.ts.
 *
 * Обратная сторона: сбой захвата лока трактуется как fail-open (доступность
 * важнее — от дублей ещё защищает уникальный индекс на активное голосование).
 * Это тоже закреплено, чтобы «починка» на fail-closed не убила планировщик
 * молча.
 */
import cron from 'node-cron';
import { Client } from 'pg';
import {
  PollSchedulerService,
  SCHEDULER_ADVISORY_LOCK_KEY,
} from '../../../services/poll-scheduler.service';
import { RecurringPollService } from '../../../services/recurring-poll.service';
import { asMock, asServiceMock } from '../../helpers/mocks';
import { PollCompletionService } from '../../../services/poll-completion.service';

jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: jest.fn() },
  schedule: jest.fn(),
}));

jest.mock('pg', () => ({ Client: jest.fn() }));

jest.mock('../../../services/poll.service', () => ({
  PollService: {},
}));

jest.mock('../../../services/poll-completion.service', () => ({
  PollCompletionService: {
    findExpiredActivePolls: jest.fn(),
  },
}));

jest.mock('../../../services/poll-timer.service', () => ({
  closeExpiredPoll: jest.fn(),
  restoreActiveTimers: jest.fn(),
}));


jest.mock('../../../services/recurring-poll.service', () => ({
  RecurringPollService: {
    getActiveSchedules: jest.fn(),
    executeScheduledPoll: jest.fn(),
    getNextRunInfo: jest.fn().mockReturnValue('Завтра в 12:30'),
    getById: jest.fn(),
    checkAdminAccess: jest.fn(),
    toggleEnabled: jest.fn(),
  },
}));

jest.mock('../../../services/user.service', () => ({
  UserService: { getUserByTelegramId: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');
const pollCompletion = asServiceMock(PollCompletionService);
const recurring = asServiceMock(RecurringPollService);
const { closeExpiredPoll, restoreActiveTimers } = jest.requireMock(
  '../../../services/poll-timer.service'
);

/** Статическое состояние планировщика: сбрасывается между тестами. */
type Internals = {
  cronJob: unknown;
  lockClient: unknown;
  isRunning: boolean;
  botInstance: unknown;
};

const internals = PollSchedulerService as unknown as Internals;

const api = { sendMessage: jest.fn() };

/** Дать фоновой цепочке (`void ...` в `start()`) дойти до конца. */
const flushBackground = (): Promise<void> =>
  new Promise(resolve => setImmediate(resolve));

/** Достаёт функцию, переданную в cron.schedule, и вызывает её. */
async function tick(): Promise<void> {
  const [, job] = asMock(cron.schedule).mock.calls[0] as [
    string,
    () => Promise<void>,
  ];
  await job();
}

interface FakeClient {
  connect: jest.Mock;
  query: jest.Mock;
  end: jest.Mock;
  on: jest.Mock;
}

let client: FakeClient;

/** Соединение, на котором planner держит advisory-lock. */
function pgClient(over: Partial<FakeClient> = {}): FakeClient {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [{ locked: true }] }),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    ...over,
  };
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  envBackup = { ...process.env };
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

  internals.cronJob = null;
  internals.lockClient = null;
  internals.isRunning = false;
  internals.botInstance = null;

  client = pgClient();
  asMock(Client).mockImplementation(() => client as never);
  asMock(cron.schedule).mockReturnValue({ stop: jest.fn() });

  pollCompletion.findExpiredActivePolls.mockResolvedValue([]);
  closeExpiredPoll.mockResolvedValue('completed');
  restoreActiveTimers.mockResolvedValue(0);
  recurring.getActiveSchedules.mockResolvedValue([]);
  api.sendMessage.mockResolvedValue({ message_id: 1 });
});

afterEach(() => {
  process.env = envBackup;
  internals.cronJob = null;
  internals.lockClient = null;
});

describe('start', () => {
  it('лок берётся на выделенном соединении, и оно НЕ закрывается', async () => {
    await PollSchedulerService.start();

    expect(client.query).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [SCHEDULER_ADVISORY_LOCK_KEY]
    );
    expect(client.end).not.toHaveBeenCalled();
    expect(internals.lockClient).toBe(client);
  });

  /* Таймеры завершения живут в памяти, и рестарт их теряет. Восстановление
     обязано идти ровно в том процессе, что держит лок: иначе каждый процесс
     поставит свой комплект таймеров на одни и те же голосования. */
  it('таймеры активных голосований восстанавливаются один раз', async () => {
    await PollSchedulerService.start();

    expect(restoreActiveTimers).toHaveBeenCalledTimes(1);
  });

  it('процесс без лока таймеры не восстанавливает', async () => {
    client.query.mockResolvedValue({ rows: [{ locked: false }] });

    await PollSchedulerService.start();

    expect(restoreActiveTimers).not.toHaveBeenCalled();
    expect(pollCompletion.findExpiredActivePolls).not.toHaveBeenCalled();
  });

  /* Восстановление просроченные не берёт (таймерный путь всегда завершает, а
     пустое голосование положено отменять), поэтому их закрывает старт — иначе
     после рестарта они ждали бы первого тика cron. */
  it('просроченные закрываются сразу при старте, не ожидая тика', async () => {
    const row = {
      id: 7,
      groupId: 9,
      endsAt: new Date('2026-09-02T12:00:00.000Z'),
      chatId: BigInt(-100900),
      messageId: 42,
      votesCount: 3,
    };
    pollCompletion.findExpiredActivePolls.mockResolvedValue([row]);

    await PollSchedulerService.start();

    /* Утверждение — «закрытие ЗАПУЩЕНО», а не «дождалось до cron.schedule»:
       ждать его старт не имеет права (см. тест ниже). */
    expect(pollCompletion.findExpiredActivePolls).toHaveBeenCalled();
    await flushBackground();
    expect(closeExpiredPoll).toHaveBeenCalledWith(row);
  });

  /* Прод — webhook-режим: `index.ts` делает `await PollSchedulerService.start()`
     ДО `process.send('ready')`, а PM2 держит `wait_ready: true` с
     `listen_timeout: 10000`. Закрытие просроченных — это транзакции, Telegram
     и заказы по категориям; дождись его в `start()`, и деплой в обеденное окно
     превысит десять секунд, после чего PM2 перезапустит воркер. */
  it('закрытие просроченных не задерживает готовность процесса', async () => {
    pollCompletion.findExpiredActivePolls.mockReturnValue(
      new Promise(() => undefined)
    );

    await PollSchedulerService.start();

    expect(asMock(cron.schedule)).toHaveBeenCalled();
  });

  /* Фоновая цепочка без обработчика стала бы необработанным отклонением и
     повалила бы процесс на строгих настройках Node. */
  it('сбой фонового закрытия не всплывает наружу и не мешает cron', async () => {
    pollCompletion.findExpiredActivePolls.mockImplementation(() => {
      throw new Error('db down');
    });

    await expect(PollSchedulerService.start()).resolves.toBeUndefined();
    await flushBackground();

    expect(asMock(cron.schedule)).toHaveBeenCalled();
  });

  it('сбой восстановления таймеров не мешает старту cron', async () => {
    restoreActiveTimers.mockRejectedValue(new Error('db down'));

    await PollSchedulerService.start();

    expect(asMock(cron.schedule)).toHaveBeenCalled();
  });

  it('повторный запуск второй cron не создаёт', async () => {
    await PollSchedulerService.start();
    asMock(cron.schedule).mockClear();

    await PollSchedulerService.start();

    expect(asMock(cron.schedule)).not.toHaveBeenCalled();
  });

  it('повторный старт после stop заново берёт лок', async () => {
    await PollSchedulerService.start();
    await PollSchedulerService.stop();
    asMock(cron.schedule).mockClear();

    await PollSchedulerService.start();

    expect(asMock(cron.schedule)).toHaveBeenCalled();
  });

  it('без DATABASE_URL планировщик всё равно поднимается (fail-open)', async () => {
    delete process.env.DATABASE_URL;

    await PollSchedulerService.start();

    expect(asMock(cron.schedule)).toHaveBeenCalled();
    expect(asMock(Client)).not.toHaveBeenCalled();
  });

  it('недоступная база не мешает старту, соединение закрывается', async () => {
    client.connect.mockRejectedValue(new Error('ECONNREFUSED'));

    await PollSchedulerService.start();

    expect(asMock(cron.schedule)).toHaveBeenCalled();
    expect(client.end).toHaveBeenCalled();
  });

  it('сбой при закрытии соединения после ошибки проглатывается', async () => {
    client.connect.mockRejectedValue(new Error('ECONNREFUSED'));
    client.end.mockRejectedValue(new Error('already closed'));

    await expect(PollSchedulerService.start()).resolves.toBeUndefined();

    expect(asMock(cron.schedule)).toHaveBeenCalled();
  });

  it('пустой ответ на запрос лока трактуется как «занято»', async () => {
    client.query.mockResolvedValue({ rows: [] });

    await PollSchedulerService.start();

    expect(asMock(cron.schedule)).not.toHaveBeenCalled();
  });

  /* У pg.Client без слушателя 'error' обрыв соединения валит процесс. */
  it('обрыв соединения с локом не роняет процесс', async () => {
    await PollSchedulerService.start();

    const onError = client.on.mock.calls.find(([event]) => event === 'error')?.[1] as
      | ((err: Error) => void)
      | undefined;

    expect(onError).toEqual(expect.any(Function));
    expect(() => onError?.(new Error('connection terminated'))).not.toThrow();
  });
});

describe('тик планировщика', () => {
  const EXPIRED_ROW = {
    id: 7,
    groupId: 9,
    endsAt: new Date('2026-09-02T12:00:00.000Z'),
    chatId: BigInt(-100900),
    messageId: 42,
    votesCount: 3,
  };

  it('на каждом тике истёкшие голосования закрываются', async () => {
    pollCompletion.findExpiredActivePolls.mockResolvedValue([EXPIRED_ROW]);
    await PollSchedulerService.start();
    await flushBackground();
    closeExpiredPoll.mockClear();

    await tick();

    expect(closeExpiredPoll).toHaveBeenCalledWith(EXPIRED_ROW);
  });

  it('сбой выборки просроченных не рвёт тик', async () => {
    pollCompletion.findExpiredActivePolls.mockRejectedValue(
      new Error('db down')
    );
    await PollSchedulerService.start();

    await expect(tick()).resolves.toBeUndefined();
  });

  /* `failed` — «голосование осталось ACTIVE»: путь завершения проглотил
     ошибку. Такое обязано быть видно как ошибка, иначе тихий сбой уедет в
     обычный info-лог и никто его не заметит. */
  it('исход failed логируется как ошибка, а не как обычный исход', async () => {
    pollCompletion.findExpiredActivePolls.mockResolvedValue([EXPIRED_ROW]);
    closeExpiredPoll.mockResolvedValue('failed');
    await PollSchedulerService.start();
    await flushBackground();
    logger.error.mockClear();
    logger.info.mockClear();

    await tick();

    expect(logger.error).toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('сбой закрытия одного голосования не рвёт тик', async () => {
    pollCompletion.findExpiredActivePolls.mockResolvedValue([EXPIRED_ROW]);
    closeExpiredPoll.mockRejectedValue(new Error('telegram down'));
    await PollSchedulerService.start();

    await expect(tick()).resolves.toBeUndefined();
  });

  it('пока предыдущий тик не закончил, новый не начинается', async () => {
    let release!: (schedules: never[]) => void;
    recurring.getActiveSchedules.mockReturnValueOnce(
      new Promise(resolve => {
        release = resolve;
      })
    );
    await PollSchedulerService.start();

    const first = tick();
    await tick();

    expect(recurring.getActiveSchedules).toHaveBeenCalledTimes(1);
    release([]);
    await first;
  });
});

describe('stop', () => {
  it.each<[string, (c: FakeClient) => void]>([
    ['снятие лока падает (соединение отвалилось)', c => c.query.mockRejectedValue(new Error('connection closed'))],
    ['закрытие соединения падает', c => c.end.mockRejectedValue(new Error('already ended'))],
  ])('%s — остановка проходит, новый старт берёт лок на новом соединении', async (_label, breakConnection) => {
    await PollSchedulerService.start();
    breakConnection(client);

    await expect(PollSchedulerService.stop()).resolves.toBeUndefined();

    const fresh = pgClient();
    client = fresh;
    asMock(cron.schedule).mockClear();
    await PollSchedulerService.start();

    expect(fresh.connect).toHaveBeenCalled();
    expect(asMock(cron.schedule)).toHaveBeenCalled();
  });
});

describe('письмо админу о результате автоголосования', () => {
  const NOW = new Date('2026-09-02T09:30:00.000Z');

  /** Расписание, которое срабатывает на тике в момент NOW (по местному времени). */
  const dueSchedule = () => ({
    id: 4,
    groupId: 9,
    daysOfWeek: JSON.stringify([NOW.getDay()]),
    timeOfDay: NOW.toTimeString().slice(0, 5),
    duration: 30,
    lastRunAt: null,
    selectedMenuItemIds: JSON.stringify([1, 2]),
    creator: { id: 5, telegramId: 500n },
    group: { id: 9, title: 'Обеденная' },
  });

  async function runTickWith(result: Record<string, unknown>): Promise<void> {
    recurring.getActiveSchedules.mockResolvedValue([dueSchedule()]);
    recurring.executeScheduledPoll.mockResolvedValue(result);
    await PollSchedulerService.start();
    await tick();
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    PollSchedulerService.initialize({ api });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each<[string, Record<string, unknown>, string | null]>([
    ['голосование создано', { success: true, pollId: 42, status: 'CREATED', message: 'ok' }, '42'],
    ['пропуск из-за активного голосования', { success: false, status: 'SKIPPED_CONFLICT', message: 'active poll exists' }, 'Завтра в 12:30'],
    ['прочая ошибка', { success: false, status: 'FAILED_ERROR', message: 'menu service exploded' }, 'menu service exploded'],
    ['успех без номера голосования', { success: true, status: 'CREATED', message: 'ok' }, null],
    ['незнакомый статус', { success: false, status: 'SOMETHING_NEW', message: 'hm' }, null],
  ])('%s', async (_label, result, mentions) => {
    await runTickWith(result);

    if (mentions === null) {
      expect(api.sendMessage).not.toHaveBeenCalled();
      return;
    }
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    const [chatId, text] = api.sendMessage.mock.calls[0] as [number, string];
    expect(chatId).toBe(500);
    expect(text).toContain(mentions);
  });

  it('без бота письмо не отправляется', async () => {
    internals.botInstance = null;

    await runTickWith({ success: true, pollId: 42, status: 'CREATED', message: 'ok' });

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('админ, заблокировавший бота, не роняет планировщик', async () => {
    api.sendMessage.mockRejectedValue(new Error('bot blocked by user'));

    await expect(
      runTickWith({ success: true, pollId: 42, status: 'CREATED', message: 'ok' })
    ).resolves.toBeUndefined();
  });
});
