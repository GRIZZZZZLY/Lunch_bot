import { prisma } from '../../database/client';
import { GamificationService } from '../../services/gamification.service';

describe('GamificationService: атомарность и идемпотентность опыта', () => {
  let userId: number;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        telegramId: BigInt(
          `91${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 9)}`
        ),
        firstName: 'XP test',
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('одно событие, доставленное одновременно дважды, начисляется один раз', async () => {
    const key = `xp-test-duplicate:${userId}`;

    await Promise.all([
      GamificationService.awardXP(
        userId,
        5,
        'Проверка повтора',
        'SOCIAL',
        { test: true },
        key
      ),
      GamificationService.awardXP(
        userId,
        5,
        'Проверка повтора',
        'SOCIAL',
        { test: true },
        key
      ),
    ]);

    const [stats, historyCount] = await Promise.all([
      prisma.userStats.findUniqueOrThrow({ where: { userId } }),
      prisma.xPHistory.count({ where: { userId } }),
    ]);
    expect(stats.totalXP).toBe(5);
    expect(historyCount).toBe(1);
  });

  it('параллельные разные события не теряют начисления', async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        GamificationService.awardXP(
          userId,
          3,
          'Параллельное начисление',
          'SOCIAL',
          { index },
          `xp-test-concurrent:${userId}:${index}`
        )
      )
    );

    const [stats, historyCount] = await Promise.all([
      prisma.userStats.findUniqueOrThrow({ where: { userId } }),
      prisma.xPHistory.count({ where: { userId } }),
    ]);
    expect(stats.totalXP).toBe(24);
    expect(historyCount).toBe(8);
  });
});
