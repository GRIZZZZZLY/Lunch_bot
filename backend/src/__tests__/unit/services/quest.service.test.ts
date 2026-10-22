/**
 * Выдача квестов: ветки, которых не видно через GET /api/gamification/quests
 * (пустой каталог, нет базового квеста, требование объектом).
 */
import { QuestService } from '../../../services/quest.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/gamification.service', () =>
  require('../../helpers/gamification-mock')
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/** Вторник — обычный день, weekly-квесты по понедельникам. */
const TUESDAY = new Date('2026-08-04T12:00:00.000Z');

function quest(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    key: 'DAILY_VOTE',
    type: 'DAILY',
    title: 'Проголосуй',
    category: 'GASTRO',
    xpReward: 25,
    requirement: JSON.stringify({ type: 'vote_count', target: 1 }),
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(TUESDAY);
  asMock(prismaMock.userQuest.findMany).mockResolvedValue([] as never);
  asMock(prismaMock.userQuest.create).mockResolvedValue({ id: 1 });
  asMock(prismaMock.userQuest.updateMany).mockResolvedValue({ count: 0 });
  asMock(prismaMock.userQuest.count).mockResolvedValue(0);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('assignDailyQuests', () => {
  it('чужие типы квестов не мешают выдать дневные', async () => {
    asMock(prismaMock.userQuest.findMany).mockResolvedValue([
      { id: 1, quest: quest({ type: 'WEEKLY' }) },
    ] as never);
    asMock(prismaMock.quest.findMany).mockResolvedValue([quest()] as never);

    await QuestService.assignDailyQuests(1);

    expect(prismaMock.userQuest.create).toHaveBeenCalledTimes(1);
  });

  it('без квестов в базе просто предупреждение', async () => {
    asMock(prismaMock.quest.findMany).mockResolvedValue([] as never);

    await QuestService.assignDailyQuests(1);

    expect(prismaMock.userQuest.create).not.toHaveBeenCalled();
  });

  it('без базового квеста выдаются только случайные', async () => {
    asMock(prismaMock.quest.findMany).mockResolvedValue([
      quest({ id: 2, key: 'DAILY_A' }),
      quest({ id: 3, key: 'DAILY_B' }),
    ] as never);

    await QuestService.assignDailyQuests(1);

    expect(prismaMock.userQuest.create).toHaveBeenCalledTimes(2);
  });

  it('требование объектом (не строкой) тоже читается', async () => {
    asMock(prismaMock.quest.findMany).mockResolvedValue([
      quest({ requirement: { type: 'vote_count', target: 5 } }),
    ] as never);

    await QuestService.assignDailyQuests(1);

    expect(prismaMock.userQuest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ target: 5 }),
    });
  });

});

describe('assignWeeklyQuests', () => {
  it('без недельных квестов в базе ничего не создаётся', async () => {
    asMock(prismaMock.quest.findMany).mockResolvedValue([] as never);

    await QuestService.assignWeeklyQuests(1);

    expect(prismaMock.userQuest.create).not.toHaveBeenCalled();
  });
});
