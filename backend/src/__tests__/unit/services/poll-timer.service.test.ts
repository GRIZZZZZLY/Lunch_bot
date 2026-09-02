/**
 * Таймер автозавершения голосования.
 *
 * Здесь закрепляются две вещи, из-за которых у группы пропадал обед:
 *
 * 1. Просроченное голосование С ГОЛОСАМИ обязано ЗАВЕРШАТЬСЯ (итоги, заказы,
 *    долги), а не отменяться. Отменяется только пустое. Решение живёт в одной
 *    функции `closeExpiredPoll` — её зовут и планировщик, и ручной скрипт.
 * 2. Таймер живёт в памяти процесса, поэтому после рестарта его ставит заново
 *    `restoreActiveTimers`. Просроченному ставится нулевая задержка: он
 *    закроется сразу, а не через минуту cron'а.
 */
import {
  closeExpiredPoll,
  restoreActiveTimers,
} from '../../../services/poll-timer.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);
jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('../../../services/poll-completion.service', () => ({
  PollCompletionService: {
    completePoll: jest.fn().mockResolvedValue({ totalVotes: 0 }),
    cancelIfStillActive: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: {
    getPollById: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
  },
}));
jest.mock('../../../services/poll-announce.service', () => ({
  announceCompletion: jest.fn(),
  notifyParticipantsLegacy: jest.fn(),
}));
jest.mock('../../../services/poll-stats.service', () => ({
  PollStatsService: {},
}));
jest.mock('../../../services/poll.service', () => ({ PollService: {} }));
jest.mock('../../../services/category-order.service', () => ({
  CategoryOrderService: {},
}));
jest.mock('../../../services/multi-category-responsible.service', () => ({
  MultiCategoryResponsibleService: {},
}));

describe('closeExpiredPoll', () => {
  const base = { id: 1, groupId: 10, endsAt: new Date('2026-09-02T12:00:00Z') };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('с голосами и chat/message — завершает через таймерный путь', async () => {
    const { announceCompletion } = jest.requireMock(
      '../../../services/poll-announce.service'
    );

    const outcome = await closeExpiredPoll({
      ...base,
      chatId: BigInt(-100),
      messageId: 42,
      votesCount: 3,
    });

    expect(outcome).toBe('completed');
    expect(announceCompletion).toHaveBeenCalledWith({
      pollId: 1,
      chatId: -100,
      messageId: 42,
    });
  });

  /* Голосование, созданное не через бота: дописывать итоги некуда, но результат
     и долги всё равно должны появиться. */
  it('с голосами, но без chat/message — завершает без объявления в группу', async () => {
    const { PollCompletionService } = jest.requireMock(
      '../../../services/poll-completion.service'
    );
    const { announceCompletion } = jest.requireMock(
      '../../../services/poll-announce.service'
    );

    const outcome = await closeExpiredPoll({
      ...base,
      chatId: null,
      messageId: null,
      votesCount: 2,
    });

    expect(outcome).toBe('completed');
    expect(PollCompletionService.completePoll).toHaveBeenCalledWith(1);
    expect(announceCompletion).not.toHaveBeenCalled();
  });

  it('без голосов — отменяет и не завершает', async () => {
    const { PollCompletionService } = jest.requireMock(
      '../../../services/poll-completion.service'
    );
    PollCompletionService.cancelIfStillActive.mockResolvedValue(true);

    const outcome = await closeExpiredPoll({
      ...base,
      chatId: BigInt(-100),
      messageId: 42,
      votesCount: 0,
    });

    expect(outcome).toBe('cancelled');
    expect(PollCompletionService.completePoll).not.toHaveBeenCalled();
  });

  /* Оптимистичная блокировка по статусу: count = 0 значит «закрыл кто-то
     другой» — восстановленный таймер, человек, параллельный процесс. */
  it('если голосование успел закрыть кто-то другой — skipped', async () => {
    const { PollCompletionService } = jest.requireMock(
      '../../../services/poll-completion.service'
    );
    PollCompletionService.cancelIfStillActive.mockResolvedValue(false);

    const outcome = await closeExpiredPoll({
      ...base,
      chatId: null,
      messageId: null,
      votesCount: 0,
    });

    expect(outcome).toBe('skipped');
  });
});

describe('restoreActiveTimers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrismaMock();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ставит таймер на остаток времени и сразу на просроченные', async () => {
    const now = new Date('2026-09-02T12:00:00Z');
    prismaMock.poll.findMany.mockResolvedValue([
      {
        id: 1,
        chatId: BigInt(-1),
        messageId: 5,
        startedAt: new Date('2026-09-02T11:50:00Z'),
        duration: 30,
      },
      {
        id: 2,
        chatId: BigInt(-1),
        messageId: 6,
        startedAt: new Date('2026-09-02T10:00:00Z'),
        duration: 30,
      },
    ] as never);
    const spy = jest.spyOn(global, 'setTimeout');

    const restored = await restoreActiveTimers(now);

    expect(restored).toBe(2);
    const delays = spy.mock.calls
      .map(([, ms]) => ms)
      .sort((a, b) => Number(a) - Number(b));
    expect(delays).toEqual([0, 20 * 60 * 1000]);
  });

  it('голосования без chatId/messageId пропускает — их закроет планировщик', async () => {
    prismaMock.poll.findMany.mockResolvedValue([] as never);

    expect(await restoreActiveTimers()).toBe(0);
    expect(prismaMock.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          chatId: { not: null },
          messageId: { not: null },
        },
      })
    );
  });
});
