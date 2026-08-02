/**
 * Квесты. Два свойства, за которыми стоит начисленный опыт:
 *
 * 1. Повторная выдача не должна дублировать квесты — иначе за один день
 *    человек получает четыре «проголосуй» и четыре награды.
 * 2. Завершение квеста начисляет XP с идемпотентным ключом на userQuest,
 *    и уже завершённый квест повторно не платит.
 */
import { QuestService, questService } from '../../../services/quest.service';
import { awardXP } from '../../helpers/gamification-mock';
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
const MONDAY = new Date('2026-08-03T12:00:00.000Z');

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
  it('выдаёт базовый квест и до трёх случайных', async () => {
    asMock(prismaMock.quest.findMany).mockResolvedValue([
      quest(),
      quest({ id: 2, key: 'DAILY_A' }),
      quest({ id: 3, key: 'DAILY_B' }),
      quest({ id: 4, key: 'DAILY_C' }),
      quest({ id: 5, key: 'DAILY_D' }),
    ] as never);

    await QuestService.assignDailyQuests(1);

    expect(prismaMock.userQuest.create).toHaveBeenCalledTimes(4);
    // Базовый квест всегда первый.
    expect(prismaMock.userQuest.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ userId: 1, questId: 1, target: 1 }),
    });
  });

  it('срок квеста — до конца суток', async () => {
    asMock(prismaMock.quest.findMany).mockResolvedValue([quest()] as never);

    await QuestService.assignDailyQuests(1);

    const data = (
      prismaMock.userQuest.create.mock.calls[0][0] as {
        data: { startedAt: Date; expiresAt: Date };
      }
    ).data;
    expect(data.expiresAt.getTime() - data.startedAt.getTime()).toBe(
      24 * 60 * 60 * 1000
    );
  });

  it('повторный вызов в тот же день ничего не выдаёт', async () => {
    asMock(prismaMock.userQuest.findMany).mockResolvedValue([
      { id: 1, quest: quest() },
    ] as never);

    await QuestService.assignDailyQuests(1);

    expect(prismaMock.userQuest.create).not.toHaveBeenCalled();
  });

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

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.quest.findMany).mockRejectedValue(new Error('db down'));

    await expect(QuestService.assignDailyQuests(1)).rejects.toThrow('db down');
  });
});

describe('assignWeeklyQuests', () => {
  it('выдаёт два случайных недельных квеста на неделю', async () => {
    asMock(prismaMock.quest.findMany).mockResolvedValue([
      quest({ id: 10, key: 'WEEKLY_A', type: 'WEEKLY' }),
      quest({ id: 11, key: 'WEEKLY_B', type: 'WEEKLY' }),
      quest({ id: 12, key: 'WEEKLY_C', type: 'WEEKLY' }),
    ] as never);

    await QuestService.assignWeeklyQuests(1);

    expect(prismaMock.userQuest.create).toHaveBeenCalledTimes(2);
  });

  it('срок недельного квеста — семь дней', async () => {
    asMock(prismaMock.quest.findMany).mockResolvedValue([
      quest({ id: 10, type: 'WEEKLY' }),
    ] as never);

    await QuestService.assignWeeklyQuests(1);

    const data = (
      prismaMock.userQuest.create.mock.calls[0][0] as {
        data: { startedAt: Date; expiresAt: Date };
      }
    ).data;
    expect(data.expiresAt.getTime() - data.startedAt.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000
    );
  });

  it('повторный вызов на той же неделе ничего не выдаёт', async () => {
    asMock(prismaMock.userQuest.findMany).mockResolvedValue([
      { id: 1, quest: quest({ type: 'WEEKLY' }) },
    ] as never);

    await QuestService.assignWeeklyQuests(1);

    expect(prismaMock.userQuest.create).not.toHaveBeenCalled();
  });

  it('без недельных квестов в базе ничего не создаётся', async () => {
    asMock(prismaMock.quest.findMany).mockResolvedValue([] as never);

    await QuestService.assignWeeklyQuests(1);

    expect(prismaMock.userQuest.create).not.toHaveBeenCalled();
  });

  it('в воскресенье неделя считается от прошлого понедельника', async () => {
    jest.setSystemTime(new Date('2026-08-09T12:00:00.000Z')); // воскресенье
    asMock(prismaMock.quest.findMany).mockResolvedValue([
      quest({ id: 10, type: 'WEEKLY' }),
    ] as never);

    await QuestService.assignWeeklyQuests(1);

    const data = (
      prismaMock.userQuest.create.mock.calls[0][0] as {
        data: { startedAt: Date };
      }
    ).data;
    expect(data.startedAt.getDay()).toBe(1);
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.quest.findMany).mockRejectedValue(new Error('db down'));

    await expect(QuestService.assignWeeklyQuests(1)).rejects.toThrow('db down');
  });
});

describe('updateQuestProgress', () => {
  beforeEach(() => {
    asMock(prismaMock.quest.findUnique).mockResolvedValue(quest());
    asMock(prismaMock.userQuest.findFirst).mockResolvedValue({
      id: 50,
      progress: 0,
      target: 3,
      status: 'ACTIVE',
    });
    asMock(prismaMock.userQuest.update).mockResolvedValue({ id: 50 });
    asMock(prismaMock.userQuest.findUnique).mockResolvedValue({
      id: 50,
      status: 'ACTIVE',
      quest: quest(),
    });
  });

  it('увеличивает прогресс на указанную величину', async () => {
    await QuestService.updateQuestProgress(1, 'DAILY_VOTE', 2);

    expect(prismaMock.userQuest.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { progress: 2 },
    });
  });

  it('по умолчанию шаг равен единице', async () => {
    await QuestService.updateQuestProgress(1, 'DAILY_VOTE');

    expect(prismaMock.userQuest.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { progress: 1 },
    });
  });

  it('прогресс не превышает цель', async () => {
    await QuestService.updateQuestProgress(1, 'DAILY_VOTE', 99);

    expect(prismaMock.userQuest.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { progress: 3 },
    });
  });

  it('достижение цели завершает квест и начисляет XP', async () => {
    await QuestService.updateQuestProgress(1, 'DAILY_VOTE', 3);

    expect(awardXP).toHaveBeenCalledWith(
      1,
      25,
      'Выполнен квест: Проголосуй',
      'GASTRO',
      { questKey: 'DAILY_VOTE' },
      'quest:50:1'
    );
  });

  it('неизвестный ключ квеста игнорируется', async () => {
    asMock(prismaMock.quest.findUnique).mockResolvedValue(null);

    await QuestService.updateQuestProgress(1, 'НЕТ');

    expect(prismaMock.userQuest.update).not.toHaveBeenCalled();
  });

  it('квест не выдан пользователю — тихо выходим', async () => {
    asMock(prismaMock.userQuest.findFirst).mockResolvedValue(null);

    await QuestService.updateQuestProgress(1, 'DAILY_VOTE');

    expect(prismaMock.userQuest.update).not.toHaveBeenCalled();
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.userQuest.update).mockRejectedValue(new Error('db down'));

    await expect(
      QuestService.updateQuestProgress(1, 'DAILY_VOTE')
    ).rejects.toThrow('db down');
  });
});

describe('completeQuest', () => {
  beforeEach(() => {
    asMock(prismaMock.userQuest.findUnique).mockResolvedValue({
      id: 50,
      status: 'ACTIVE',
      quest: quest(),
    });
    asMock(prismaMock.userQuest.update).mockResolvedValue({ id: 50 });
  });

  it('помечает квест выполненным и платит опыт', async () => {
    await QuestService.completeQuest(1, 50);

    expect(prismaMock.userQuest.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { status: 'COMPLETED', completedAt: TUESDAY },
    });
    expect(awardXP).toHaveBeenCalledTimes(1);
  });

  it('уже выполненный квест повторно не платит', async () => {
    asMock(prismaMock.userQuest.findUnique).mockResolvedValue({
      id: 50,
      status: 'COMPLETED',
      quest: quest(),
    });

    await QuestService.completeQuest(1, 50);

    expect(awardXP).not.toHaveBeenCalled();
    expect(prismaMock.userQuest.update).not.toHaveBeenCalled();
  });

  it('отсутствующий квест игнорируется', async () => {
    asMock(prismaMock.userQuest.findUnique).mockResolvedValue(null);

    await QuestService.completeQuest(1, 50);

    expect(awardXP).not.toHaveBeenCalled();
  });

  it('ошибка начисления выбрасывается наружу', async () => {
    asMock(awardXP).mockRejectedValue(new Error('xp failed'));

    await expect(QuestService.completeQuest(1, 50)).rejects.toThrow('xp failed');
  });
});

describe('getUserQuests', () => {
  it('отдаёт активные неистёкшие квесты с процентом выполнения', async () => {
    asMock(prismaMock.userQuest.findMany).mockResolvedValue([
      {
        progress: 1,
        target: 3,
        status: 'ACTIVE',
        startedAt: TUESDAY,
        expiresAt: TUESDAY,
        quest: quest(),
      },
    ] as never);

    const quests = await QuestService.getUserQuests(1);

    expect(quests[0]).toMatchObject({
      key: 'DAILY_VOTE',
      progress: 1,
      target: 3,
      progressPercent: 33,
    });
  });

  it('выборка ограничена активными и неистёкшими', async () => {
    await QuestService.getUserQuests(1);

    expect(prismaMock.userQuest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1, status: 'ACTIVE', expiresAt: { gt: TUESDAY } },
      })
    );
  });
});

describe('expireOldQuests', () => {
  it('переводит истёкшие квесты в EXPIRED', async () => {
    asMock(prismaMock.userQuest.updateMany).mockResolvedValue({
      count: 3,
    });

    await QuestService.expireOldQuests();

    expect(prismaMock.userQuest.updateMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', expiresAt: { lt: TUESDAY } },
      data: { status: 'EXPIRED' },
    });
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.userQuest.updateMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(QuestService.expireOldQuests()).rejects.toThrow('db down');
  });
});

describe('autoAssignQuests', () => {
  beforeEach(() => {
    asMock(prismaMock.quest.findMany).mockResolvedValue([quest()] as never);
  });

  it('сначала гасит истёкшие, потом выдаёт дневные', async () => {
    await QuestService.autoAssignQuests(1);

    expect(prismaMock.userQuest.updateMany).toHaveBeenCalled();
    expect(prismaMock.userQuest.create).toHaveBeenCalled();
  });

  it('во вторник недельные квесты не выдаются', async () => {
    await QuestService.autoAssignQuests(1);

    // Дневные квесты запрашиваются один раз; недельных запросов нет.
    expect(prismaMock.quest.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.quest.findMany).toHaveBeenCalledWith({
      where: { type: 'DAILY' },
    });
  });

  it('в понедельник выдаются и недельные', async () => {
    jest.setSystemTime(MONDAY);

    await QuestService.autoAssignQuests(1);

    expect(prismaMock.quest.findMany).toHaveBeenCalledWith({
      where: { type: 'WEEKLY' },
    });
  });

  it('ошибка внутри выбрасывается наружу', async () => {
    asMock(prismaMock.userQuest.updateMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(QuestService.autoAssignQuests(1)).rejects.toThrow('db down');
  });
});

describe('getQuestStats', () => {
  it('считает выполненные по типам и активные', async () => {
    asMock(prismaMock.userQuest.count)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4);

    await expect(QuestService.getQuestStats(1)).resolves.toEqual({
      totalCompleted: 10,
      dailyCompleted: 7,
      weeklyCompleted: 3,
      activeQuests: 4,
    });
  });
});

describe('фасад questService', () => {
  it('делегирует вызовы в статические методы', async () => {
    asMock(prismaMock.quest.findMany).mockResolvedValue([quest()] as never);
    asMock(prismaMock.quest.findUnique).mockResolvedValue(quest());
    asMock(prismaMock.userQuest.findFirst).mockResolvedValue(null);

    await questService.assignDailyQuests(1);
    await questService.assignWeeklyQuests(1);
    await questService.updateQuestProgress(1, 'DAILY_VOTE', 1);
    await questService.getUserQuests(1);
    await questService.autoAssignQuests(1);

    expect(prismaMock.quest.findMany).toHaveBeenCalled();
    expect(prismaMock.userQuest.findMany).toHaveBeenCalled();
  });
});
