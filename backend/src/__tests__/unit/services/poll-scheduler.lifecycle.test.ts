/**
 * Жизненный цикл планировщика автоголосований и письма админу.
 * Сам тик расписания разобран в poll-scheduler.service.test.ts.
 *
 * Ключевая защита здесь — advisory-lock в PostgreSQL. Двойной деплой поднимал
 * два процесса с одним и тем же cron, и группа получала два автоголосования
 * (инцидент 2026-07-20). Лок держится на ВЫДЕЛЕННОМ соединении: если бы он
 * брался из пула, соединение вернулось бы в пул и лок снялся. Поэтому
 * проверяется, что соединение сохраняется, а не закрывается, и что при отказе
 * лока cron не поднимается вовсе.
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

/** Приватная часть планировщика: статика и внутренние методы. */
type Internals = {
  cronJob: unknown;
  lockClient: unknown;
  isRunning: boolean;
  botInstance: unknown;
  notifyAdmin(
    schedule: unknown,
    result: {
      success: boolean;
      pollId?: number;
      status: string;
      message: string;
    }
  ): Promise<void>;
};

const internals = PollSchedulerService as unknown as Internals;

const api = { sendMessage: jest.fn() };

/** Дать фоновой цепочке (`void ...` в `start()`) дойти до конца. */
const flushBackground = (): Promise<void> =>
  new Promise(resolve => setImmediate(resolve));

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

const SCHEDULE = {
  id: 4,
  groupId: 9,
  timeOfDay: '12:30',
  duration: 30,
  selectedMenuItemIds: JSON.stringify([1, 2]),
  creator: { id: 5, telegramId: 500n },
  group: { id: 9, title: 'Обеденная' },
};

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

describe('initialize', () => {
  it('запоминает бота для писем админу', () => {
    PollSchedulerService.initialize({ api });

    expect(internals.botInstance).toEqual({ api });
    expect(logger.info).toHaveBeenCalledWith(
      'PollSchedulerService bot instance initialized'
    );
  });
});

describe('start', () => {
  it('cron поднимается каждую минуту в московском времени', async () => {
    await PollSchedulerService.start();

    expect(asMock(cron.schedule)).toHaveBeenCalledWith(
      '* * * * *',
      expect.any(Function),
      { timezone: 'Europe/Moscow' }
    );
  });

  it('лок берётся на выделенном соединении, и оно НЕ закрывается', async () => {
    await PollSchedulerService.start();

    expect(client.query).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [SCHEDULER_ADVISORY_LOCK_KEY]
    );
    expect(client.end).not.toHaveBeenCalled();
    expect(internals.lockClient).toBe(client);
  });

  it('если лок держит другой процесс, cron не поднимается', async () => {
    client.query.mockResolvedValue({ rows: [{ locked: false }] });

    await PollSchedulerService.start();

    expect(asMock(cron.schedule)).not.toHaveBeenCalled();
    expect(client.end).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Poll scheduler not started: another instance holds the advisory lock'
    );
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
  it('сбой фонового закрытия логируется, а не всплывает наружу', async () => {
    pollCompletion.findExpiredActivePolls.mockImplementation(() => {
      throw new Error('db down');
    });

    await expect(PollSchedulerService.start()).resolves.toBeUndefined();
    await flushBackground();

    expect(asMock(cron.schedule)).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Poll scheduler: findExpiredActivePolls failed',
      expect.any(Error)
    );
  });

  it('сбой восстановления таймеров не мешает старту cron', async () => {
    restoreActiveTimers.mockRejectedValue(new Error('db down'));

    await PollSchedulerService.start();

    expect(asMock(cron.schedule)).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Poll scheduler: restoreActiveTimers failed',
      expect.any(Error)
    );
  });

  it('повторный запуск второй cron не создаёт', async () => {
    await PollSchedulerService.start();
    asMock(cron.schedule).mockClear();

    await PollSchedulerService.start();

    expect(asMock(cron.schedule)).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('Poll scheduler already running');
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
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('DATABASE_URL not set')
    );
  });

  it('недоступная база не мешает старту, соединение закрывается', async () => {
    client.connect.mockRejectedValue(new Error('ECONNREFUSED'));

    await PollSchedulerService.start();

    expect(asMock(cron.schedule)).toHaveBeenCalled();
    expect(client.end).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('acquireSingletonLock failed'),
      expect.any(Error)
    );
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

  it('обрыв соединения с локом логируется, а не роняет процесс', async () => {
    await PollSchedulerService.start();

    const [, handler] = client.on.mock.calls[0];
    handler(new Error('connection terminated'));

    expect(logger.error).toHaveBeenCalledWith(
      'Scheduler lock client error',
      expect.any(Error)
    );
  });
});

describe('тик планировщика', () => {
  /** Достаёт функцию, переданную в cron.schedule, и вызывает её. */
  async function tick(): Promise<void> {
    const [, job] = asMock(cron.schedule).mock.calls[0] as [
      string,
      () => Promise<void>,
    ];
    await job();
  }

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

    await tick();

    expect(closeExpiredPoll).toHaveBeenCalledWith(EXPIRED_ROW);
    expect(logger.info).toHaveBeenCalledWith(
      'Poll scheduler: expired poll 7 (group 9) → completed'
    );
  });

  it('когда закрывать нечего, лог не засоряется', async () => {
    await PollSchedulerService.start();

    await tick();

    expect(closeExpiredPoll).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('expired poll')
    );
  });

  it('сбой выборки просроченных не рвёт тик', async () => {
    pollCompletion.findExpiredActivePolls.mockRejectedValue(
      new Error('db down')
    );
    await PollSchedulerService.start();

    await expect(tick()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Poll scheduler: findExpiredActivePolls failed',
      expect.any(Error)
    );
  });

  /* `failed` — «голосование осталось ACTIVE»: путь завершения проглотил
     ошибку. Такое обязано быть видно как ошибка, иначе тихий сбой уедет в
     обычный info-лог и никто его не заметит. */
  it('исход failed логируется как ошибка, а не как обычный исход', async () => {
    pollCompletion.findExpiredActivePolls.mockResolvedValue([EXPIRED_ROW]);
    closeExpiredPoll.mockResolvedValue('failed');
    await PollSchedulerService.start();

    await tick();

    expect(logger.error).toHaveBeenCalledWith(
      'Poll scheduler: expired poll 7 (group 9) → failed'
    );
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('→ failed')
    );
  });

  it('сбой закрытия одного голосования не рвёт тик', async () => {
    pollCompletion.findExpiredActivePolls.mockResolvedValue([EXPIRED_ROW]);
    closeExpiredPoll.mockRejectedValue(new Error('telegram down'));
    await PollSchedulerService.start();

    await expect(tick()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Poll scheduler: failed to close expired poll 7',
      expect.any(Error)
    );
  });

  it('пока предыдущий тик не закончил, новый не начинается', async () => {
    internals.isRunning = true;
    await PollSchedulerService.start();

    await tick();

    expect(recurring.getActiveSchedules).not.toHaveBeenCalled();
  });
});

describe('stop', () => {
  it('cron останавливается, а лок снимается явно', async () => {
    await PollSchedulerService.start();

    await PollSchedulerService.stop();

    expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [
      SCHEDULER_ADVISORY_LOCK_KEY,
    ]);
    expect(client.end).toHaveBeenCalled();
    expect(internals.lockClient).toBeNull();
    expect(logger.info).toHaveBeenCalledWith('Poll scheduler stopped');
  });

  it('остановка незапущенного планировщика ничего не делает', async () => {
    await expect(PollSchedulerService.stop()).resolves.toBeUndefined();

    expect(logger.info).not.toHaveBeenCalledWith('Poll scheduler stopped');
  });

  it('отвалившееся соединение не мешает остановке: лок снимется сам', async () => {
    await PollSchedulerService.start();
    client.query.mockRejectedValue(new Error('connection closed'));

    await expect(PollSchedulerService.stop()).resolves.toBeUndefined();

    expect(internals.lockClient).toBeNull();
  });

  it('сбой закрытия соединения не мешает остановке', async () => {
    await PollSchedulerService.start();
    client.end.mockRejectedValue(new Error('already ended'));

    await expect(PollSchedulerService.stop()).resolves.toBeUndefined();

    expect(internals.lockClient).toBeNull();
  });
});

describe('письмо админу о результате', () => {
  beforeEach(() => {
    PollSchedulerService.initialize({ api });
  });

  function notify(result: {
    success: boolean;
    pollId?: number;
    status: string;
    message: string;
  }) {
    return internals.notifyAdmin(SCHEDULE, result);
  }

  function sentText(): string {
    return api.sendMessage.mock.calls[0][1] as string;
  }

  it('успех: названы группа, время, число блюд и номер голосования', async () => {
    await notify({ success: true, pollId: 42, status: 'CREATED', message: 'ok' });

    expect(api.sendMessage.mock.calls[0][0]).toBe(500);
    const text = sentText();
    expect(text).toContain('Обеденная');
    expect(text).toContain('12:30');
    expect(text).toContain('Блюд: 2');
    expect(text).toContain('Голосование #42');
  });

  it('расписание без выбранных блюд подписано «все активные»', async () => {
    await internals.notifyAdmin(
      { ...SCHEDULE, selectedMenuItemIds: null },
      { success: true, pollId: 42, status: 'CREATED', message: 'ok' }
    );

    expect(sentText()).toContain('все активные');
  });

  it('конфликт: сказано про активное голосование и когда следующая попытка', async () => {
    await notify({
      success: false,
      status: 'SKIPPED_CONFLICT',
      message: 'active poll exists',
    });

    const text = sentText();
    expect(text).toContain('пропущено');
    expect(text).toContain('Уже есть активное голосование');
    expect(text).toContain('Завтра в 12:30');
  });

  it('пустое меню: даны кнопки «настроить меню» и «отключить авто»', async () => {
    process.env.WEBAPP_URL = 'https://app.example.com';

    await notify({
      success: false,
      status: 'FAILED_NO_MENU',
      message: 'no menu items',
    });

    const markup = JSON.stringify(api.sendMessage.mock.calls[0][2]);
    expect(markup).toContain('https://app.example.com/menu');
    expect(markup).toContain('recurring:disable:4');
    expect(sentText()).toContain('минимум 2');
  });

  it('без WEBAPP_URL кнопка меню всё равно формируется', async () => {
    delete process.env.WEBAPP_URL;

    await notify({
      success: false,
      status: 'FAILED_NO_MENU',
      message: 'no menu items',
    });

    expect(JSON.stringify(api.sendMessage.mock.calls[0][2])).toContain('/menu');
  });

  it('прочая ошибка передаёт админу её текст', async () => {
    await notify({
      success: false,
      status: 'FAILED_ERROR',
      message: 'menu service exploded',
    });

    expect(sentText()).toContain('menu service exploded');
  });

  it('успех без номера голосования письма не порождает', async () => {
    await notify({ success: true, status: 'CREATED', message: 'ok' });

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('незнакомый статус письма не порождает', async () => {
    await notify({ success: false, status: 'SOMETHING_NEW', message: 'hm' });

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('без бота письмо не отправляется', async () => {
    internals.botInstance = null;

    await expect(
      notify({ success: true, pollId: 42, status: 'CREATED', message: 'ok' })
    ).resolves.toBeUndefined();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('админ, заблокировавший бота, не роняет планировщик', async () => {
    api.sendMessage.mockRejectedValue(new Error('bot blocked by user'));

    await expect(
      notify({ success: true, pollId: 42, status: 'CREATED', message: 'ok' })
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Error notifying admin:',
      expect.any(Error)
    );
  });
});
