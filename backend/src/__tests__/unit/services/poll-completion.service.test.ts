/**
 * Автозакрытие голосования по кворуму.
 *
 * Правило приехало из контроллера (задача 06): там оно жило локальной функцией
 * `autoCompleteIfQuorumReached`, действовало для одного эндпоинта и проверялось
 * через HTTP-моки. Главное свойство — «сбой закрытия не отменяет уже поданный
 * голос» — на уровне контроллера проверить было нельзя честно: сервис был
 * замокан, то есть тест проверял собственную заглушку.
 *
 * Остальное завершение (`completePoll`, `completePollMultiWinner`, отмена
 * истёкших) закреплено в `poll.service.test.ts` — тесты переехали вместе с
 * методами и вызывают их по новому адресу.
 */
import { PollCompletionService } from '../../../services/poll-completion.service';
import { GroupService } from '../../../services/group.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/cache.service', () => ({
  cacheService: { get: jest.fn(), set: jest.fn(), del: jest.fn(), getOrSet: jest.fn() },
  CacheInvalidator: { invalidatePoll: jest.fn(), invalidateVote: jest.fn() },
  CACHE_KEYS: { ACTIVE_POLLS: 'active_polls' },
  CACHE_TTL: { ACTIVE_POLLS: 30 },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { getGroupSettings: jest.fn() },
}));

jest.mock('../../../services/poll-notification.service', () => ({
  pollNotificationService: { sendPollCompletionNotifications: jest.fn() },
}));

jest.mock('../../../services/gamification.service', () => ({
  GamificationService: { awardXP: jest.fn() },
}));

jest.mock('../../../services/category-order.service', () => ({
  CategoryOrderService: { createCategoryOrders: jest.fn() },
}));

jest.mock('../../../services/multi-category-responsible.service', () => ({
  MultiCategoryResponsibleService: { startMultiCategorySelection: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const groups = asServiceMock(GroupService);
const { logger } = jest.requireMock('../../../utils/logger');

/**
 * Голосование, готовое к автозакрытию: активно, автозавершение включено.
 *
 * `votes` и `group` в фикстуре обязательны: завершение читает голосование с
 * включёнными связями, и мок без них уводит тест в ветку «сбой закрытия»,
 * которая проходит по любому утверждению про false.
 */
function activePoll(): void {
  asMock(prismaMock.poll.findUnique).mockResolvedValue({
    id: 5,
    status: 'ACTIVE',
    groupId: 100,
    votes: [],
    group: { id: 100, title: 'Команда' },
  });
  groups.getGroupSettings.mockResolvedValue({ autoCompleteEnabled: true });
}

/** Кто ожидается и кто проголосовал. */
function participants(expected: number[], voted: number[]): void {
  asMock(prismaMock.pollParticipant.findMany).mockResolvedValue(
    expected.map(userId => ({ userId }))
  );
  asMock(prismaMock.vote.findMany).mockResolvedValue(
    voted.map(userId => ({ userId }))
  );
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  activePoll();
});

describe('completeIfQuorumReached', () => {
  it('пока проголосовали не все — голосование не закрывается', async () => {
    participants([1, 2], [1]);

    await expect(
      PollCompletionService.completeIfQuorumReached(5, 1)
    ).resolves.toBe(false);
    expect(asMock(prismaMock.poll.updateMany)).not.toHaveBeenCalled();
  });

  it('когда проголосовали все ожидаемые — закрывает и отдаёт true', async () => {
    participants([1, 2], [1, 2]);
    asMock(prismaMock.poll.updateMany).mockResolvedValue({ count: 1 });
    asMock(prismaMock.pollResult.create).mockResolvedValue({ id: 700 });

    await expect(
      PollCompletionService.completeIfQuorumReached(5, 1)
    ).resolves.toBe(true);
    expect(asMock(prismaMock.pollResult.create)).toHaveBeenCalled();
  });

  /**
   * То, ради чего правило и переехало из контроллера: голос уже записан, и
   * падение закрытия не имеет права превратиться в ошибку ответа. Раньше это
   * проверялось на замоканном сервисе, то есть не проверялось вовсе.
   */
  it('сбой закрытия не пробрасывается наружу — голос остаётся в силе', async () => {
    participants([1], [1]);
    asMock(prismaMock.poll.updateMany).mockRejectedValue(new Error('db down'));

    await expect(
      PollCompletionService.completeIfQuorumReached(5, 1)
    ).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  it('выключенное в группе автозавершение не закрывает голосование', async () => {
    groups.getGroupSettings.mockResolvedValue({
      autoCompleteEnabled: false,
    });
    participants([1], [1]);

    await expect(
      PollCompletionService.completeIfQuorumReached(5, 1)
    ).resolves.toBe(false);
    expect(asMock(prismaMock.poll.updateMany)).not.toHaveBeenCalled();
  });

  /* Пустой снимок ожидаемых участников — не кворум: иначе голосование в группе,
     где никого не ждут, закрывалось бы сразу после создания. */
  it('пустой снимок участников не считается кворумом', async () => {
    participants([], [1]);

    await expect(
      PollCompletionService.completeIfQuorumReached(5, 1)
    ).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no EXPECTED participants')
    );
  });

  it('неактивное голосование не проверяется', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      id: 5,
      status: 'COMPLETED',
      groupId: 100,
    });

    await expect(
      PollCompletionService.completeIfQuorumReached(5, 1)
    ).resolves.toBe(false);
    expect(asMock(prismaMock.pollParticipant.findMany)).not.toHaveBeenCalled();
  });

  /* Закрытие идёт в режиме НЕСКОЛЬКИХ победителей — так работает подача голоса
     через `/api/polls/:id/vote`. Второй путь (`checkQuorumAndComplete`,
     vote.controller) закрывает с одним победителем; расхождение зафиксировано
     в `tech_debt/06`. */
  it('закрывает в режиме нескольких победителей, с итогами в rouletteData', async () => {
    participants([1], [1]);
    asMock(prismaMock.poll.updateMany).mockResolvedValue({ count: 1 });
    asMock(prismaMock.pollResult.create).mockResolvedValue({ id: 700 });

    await PollCompletionService.completeIfQuorumReached(5, 42);

    const call = asMock(prismaMock.pollResult.create).mock.calls[0][0] as {
      data: { responsibleUserId: number; rouletteData?: string };
    };
    expect(call.data.responsibleUserId).toBe(42);
    expect(JSON.parse(call.data.rouletteData!)).toMatchObject({
      mode: 'multi-winner',
    });
  });
});
