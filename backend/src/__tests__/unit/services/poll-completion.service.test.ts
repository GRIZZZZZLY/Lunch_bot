/**
 * Автозакрытие голосования по кворуму: ветки, которые не видны через HTTP.
 * Само правило кворума (все ожидаемые проголосовали, выключенное автозавершение,
 * режим нескольких победителей) проверяется на настоящей БД в
 * integration/api/votes.redis.test.ts.
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
  });

  /* Пустой снимок ожидаемых участников — не кворум: иначе голосование в группе,
     где никого не ждут, закрывалось бы сразу после создания. */
  it('пустой снимок участников не считается кворумом', async () => {
    participants([], [1]);

    await expect(
      PollCompletionService.completeIfQuorumReached(5, 1)
    ).resolves.toBe(false);
    expect(asMock(prismaMock.poll.updateMany)).not.toHaveBeenCalled();
  });
});
