/**
 * Опыт, достижения, квесты, рейтинги и сезоны через НАСТОЯЩИЙ API:
 * express, PostgreSQL, Redis.
 *
 * Прежние контроллерные тесты подменяли `GamificationService`, `SeasonService`
 * и `GroupService.isUserGroupMember`: «посторонний — 403» был ответом мока, а
 * не правилом членства, и ни один тест не видел, кто на самом деле попадает в
 * рейтинг группы. Здесь проверяется исход — ответ и строки в базе:
 *
 * 1. Рейтинги (общий и сезонный) видны только участникам группы и содержат
 *    только её действующих участников, в порядке выбранной категории.
 * 2. Чужая сезонная статистика — только при общей действующей группе.
 * 3. Служебные операции (начисление опыта, пересчёт, ротация и создание
 *    сезона) закрыты секретом X-Operations-Secret на маршруте; начисление
 *    идемпотентно на уровне HTTP; ротация даёт ровно один активный сезон с
 *    очередным номером и не удваивает призы.
 * 4. Квесты выдаются при чтении по дню недели; истёкшие не показываются.
 *
 * Redis обязателен: служебные маршруты и голосование объявлены
 * `required: true` в middleware идемпотентности и без хранилища отвечают 503.
 * Лимитер выключается (`ENABLE_RATE_LIMIT=false`), как в CI-задании.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { setBotInstance } from '../../../bot/bot-instance';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { addMember, idemKey, tokenFor } from '../helpers/api';

/* Призы сезона `SeasonService` подтягивает динамическим импортом
   './gamification.service.js'. В собранном приложении такой файл есть, а jest
   работает с исходниками .ts и путь с расширением .js не находит — призы молча
   не выдавались бы (ошибку гасит сам сервис). Это не подмена: путь .js ведёт на
   тот же настоящий модуль. */
jest.mock(
  '../../../services/gamification.service.js',
  () => jest.requireActual('../../../services/gamification.service'),
  { virtual: true }
);

let app: ReturnType<typeof createTestApp>;

const TG = {
  anna: 750000101, // участница группы А
  boris: 750000102, // участник А
  dima: 750000103, // участник А
  lena: 750000104, // вышла из А: членство неактивно
  oleg: 750000105, // только в группе Б, с А ничего общего; флаг users.is_admin (бывший «глобальный админ»)
  ops: 750000106, // оператор: ни в одной группе, право даёт только секрет
  ops2: 750000107, // второй оператор
} as const;
type Person = keyof typeof TG;

const OPS_SECRET = 'integration-operations-secret-0123456789';
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);
const daysAhead = (days: number) => new Date(Date.now() + days * DAY_MS);

interface World {
  user: Record<Person, number>;
  groupA: number;
  groupB: number;
}

/**
 * Две группы и семь человек.
 *
 * У Лены (вышла из А) и Олега (чужая группа) опыта на порядок больше, чем у
 * участников А: просочись любой из них в рейтинг А — он оказался бы первым, и
 * это сразу видно по порядку.
 *
 * Рейтинги по категориям разведены так, что у каждой категории свой порядок:
 * сортировка не по той колонке меняет ответ.
 */
async function buildWorld(): Promise<World> {
  const user = {} as Record<Person, number>;
  for (const [name, telegramId] of Object.entries(TG) as Array<[Person, number]>) {
    const row = await prisma.user.create({
      data: { telegramId: BigInt(telegramId), firstName: name, isAdmin: name === 'oleg' },
    });
    user[name] = row.id;
  }

  const groupA = (
    await prisma.group.create({ data: { telegramId: BigInt(-100000000501), title: 'Группа А' } })
  ).id;
  const groupB = (
    await prisma.group.create({ data: { telegramId: BigInt(-100000000502), title: 'Группа Б' } })
  ).id;

  await addMember(groupA, user.anna, 'CREATOR');
  await addMember(groupA, user.boris, 'MEMBER');
  await addMember(groupA, user.dima, 'MEMBER');
  await addMember(groupA, user.lena, 'MEMBER', { isActive: false, leftAt: daysAgo(3) });
  await addMember(groupB, user.oleg, 'CREATOR');

  const stats = (
    userId: number,
    totalXP: number,
    level: number,
    gastroRating: number,
    responsibleRating: number,
    socialRating: number,
    explorerRating: number
  ) => ({ userId, totalXP, level, gastroRating, responsibleRating, socialRating, explorerRating });

  await prisma.userStats.createMany({
    data: [
      stats(user.anna, 500, 2, 10, 300, 50, 5),
      stats(user.boris, 300, 2, 90, 20, 200, 70),
      stats(user.dima, 100, 1, 40, 100, 10, 150),
      stats(user.lena, 9000, 20, 9000, 9000, 9000, 9000),
      stats(user.oleg, 8000, 18, 8000, 8000, 8000, 8000),
    ],
  });

  return { user, groupA, groupB };
}

let w: World;
const token = {} as Record<Person, string>;

const get = (who: Person, url: string) =>
  request(app).get(url).set('Authorization', `Bearer ${token[who]}`);

/** Служебный запрос: по умолчанию с верным секретом и свежим ключом. */
function ops(
  who: Person,
  url: string,
  body: Record<string, unknown> = {},
  { secret = OPS_SECRET, key = idemKey('ops') }: { secret?: string | null; key?: string } = {}
) {
  let req = request(app)
    .post(url)
    .set('Authorization', `Bearer ${token[who]}`)
    .set('Idempotency-Key', key);
  if (secret !== null) req = req.set('X-Operations-Secret', secret);
  return req.send(body);
}

const totalXpOf = async (userId: number) =>
  (await prisma.userStats.findUniqueOrThrow({ where: { userId } })).totalXP;

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  process.env.ENABLE_OPERATIONS_API = 'true';
  process.env.OPERATIONS_API_SECRET = OPS_SECRET;
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  /* Голосование шлёт обновления в группу; Telegram в этих тестах не нужен. */
  setBotInstance({
    api: { sendMessage: async () => ({ message_id: 1 }) },
  } as unknown as Parameters<typeof setBotInstance>[0]);
  w = await buildWorld();
  for (const name of Object.keys(TG) as Person[]) {
    token[name] = await tokenFor(app, TG[name]);
  }
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------- рейтинг

describe('GET /api/gamification/leaderboard — рейтинг группы', () => {
  it.each<[string, string | undefined, Person[]]>([
    ['по умолчанию — общий опыт', undefined, ['anna', 'boris', 'dima']],
    ['TOTAL', 'TOTAL', ['anna', 'boris', 'dima']],
    ['GASTRO', 'GASTRO', ['boris', 'dima', 'anna']],
    ['RESPONSIBLE', 'RESPONSIBLE', ['anna', 'dima', 'boris']],
    ['SOCIAL', 'SOCIAL', ['boris', 'anna', 'dima']],
    ['EXPLORER', 'EXPLORER', ['dima', 'boris', 'anna']],
  ])('%s: только действующие участники группы, по убыванию категории', async (_name, category, order) => {
    const query = category ? `&category=${category}` : '';

    const response = await get('anna', `/api/gamification/leaderboard?groupId=${w.groupA}${query}`)
      .expect(200);

    const rows = response.body.data as Array<{ userId: number; position: number }>;
    expect(rows.map(r => r.userId)).toEqual(order.map(name => w.user[name]));
    expect(rows.map(r => r.position)).toEqual([1, 2, 3]);
  });

  /* [BUG] в прошлом: рейтинг чужой группы открывался посторонним (и прежнему
     глобальному админу). Доступ решает только действующее членство. */
  it.each<[string, Person]>([
    ['участник чужой группы, хоть и с флагом users.is_admin', 'oleg'],
    ['вышедший из группы', 'lena'],
  ])('%s — 403 FORBIDDEN', async (_name, who) => {
    const response = await get(who, `/api/gamification/leaderboard?groupId=${w.groupA}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(response.body.data).toBeUndefined();
  });

  it.each([
    ['без groupId', ''],
    ['нечисловой groupId', '?groupId=нет'],
    ['нулевой groupId', '?groupId=0'],
  ])('%s — 400 MISSING_GROUP_ID, а не рейтинг всех пользователей', async (_name, query) => {
    const response = await get('anna', `/api/gamification/leaderboard${encodeURI(query)}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('MISSING_GROUP_ID');
  });

  it('неизвестная категория — 400', async () => {
    const response = await get(
      'anna',
      `/api/gamification/leaderboard?groupId=${w.groupA}&category=MONEY`
    );

    expect(response.status).toBe(400);
  });
});

// ------------------------------------------------------------ свои данные

describe('GET /api/gamification/user/* — свои опыт и достижения', () => {
  it('статистика берётся по токену и показывает прогресс до следующего уровня', async () => {
    const response = await get('anna', '/api/gamification/user/stats').expect(200);

    /* 500 XP на уровне 2: порог уровня 2 — 282, уровня 3 — 519. */
    expect(response.body.data).toMatchObject({
      userId: w.user.anna,
      totalXP: 500,
      level: 2,
      xpProgress: 218,
      xpRequired: 237,
    });
  });

  it('у человека без статистики она заводится с нуля', async () => {
    const response = await get('ops', '/api/gamification/user/stats').expect(200);

    expect(response.body.data).toMatchObject({ userId: w.user.ops, totalXP: 0, level: 1 });
    expect(await totalXpOf(w.user.ops)).toBe(0);
  });

  it('история опыта — только своя, от новой к старой, с лимитом', async () => {
    await prisma.xPHistory.createMany({
      data: [
        { userId: w.user.anna, amount: 10, reason: 'a', category: 'SOCIAL', createdAt: daysAgo(3) },
        { userId: w.user.anna, amount: 20, reason: 'b', category: 'GASTRO', createdAt: daysAgo(2) },
        { userId: w.user.anna, amount: 30, reason: 'c', category: 'SOCIAL', createdAt: daysAgo(1) },
        { userId: w.user.boris, amount: 99, reason: 'чужое', category: 'SOCIAL' },
      ],
    });

    const all = await get('anna', '/api/gamification/user/xp-history').expect(200);
    expect(all.body.data.map((x: { amount: number }) => x.amount)).toEqual([30, 20, 10]);

    const limited = await get('anna', '/api/gamification/user/xp-history?limit=2').expect(200);
    expect(limited.body.data.map((x: { amount: number }) => x.amount)).toEqual([30, 20]);
  });

  describe('достижения', () => {
    async function seedAchievements() {
      const make = (key: string, extra: { isHidden?: boolean; isActive?: boolean } = {}) =>
        prisma.achievement.create({
          data: {
            key,
            title: key,
            description: key,
            icon: '*',
            category: 'SOCIAL',
            requirement: JSON.stringify({ type: 'custom' }),
            ...extra,
          },
        });
      const a = {
        firstVote: await make('FIRST_VOTE'),
        gourmet: await make('GOURMET'),
        secretLocked: await make('SECRET_LOCKED', { isHidden: true }),
        secretEarned: await make('SECRET_EARNED', { isHidden: true }),
        retired: await make('RETIRED', { isActive: false }),
      };
      await prisma.userAchievement.createMany({
        data: [
          { userId: w.user.anna, achievementId: a.firstVote.id },
          { userId: w.user.anna, achievementId: a.secretEarned.id },
          // Чужое открытие не должно отметить достижение открытым у Анны.
          { userId: w.user.boris, achievementId: a.gourmet.id },
        ],
      });
    }

    const byKey = (rows: Array<{ key: string; unlocked: boolean }>) =>
      Object.fromEntries(rows.map(r => [r.key, r.unlocked]));

    it('открытые помечены по своим открытиям; скрытое неполученное и выключенное не видны', async () => {
      await seedAchievements();

      const response = await get('anna', '/api/gamification/user/achievements').expect(200);

      const seen = byKey(response.body.data);
      expect(seen.FIRST_VOTE).toBe(true);
      expect(seen.GOURMET).toBe(false);
      expect(seen).not.toHaveProperty('SECRET_LOCKED');
      expect(seen).not.toHaveProperty('RETIRED');
    });

    // BUG: скрытые достижения отфильтрованы всегда (isHidden: false в выборке) — полученное скрытое не видно никогда.
    it.failing('полученное скрытое достижение показывается как открытое', async () => {
      await seedAchievements();

      const response = await get('anna', '/api/gamification/user/achievements').expect(200);

      expect(byKey(response.body.data).SECRET_EARNED).toBe(true);
    });
  });
});

// ----------------------------------------------------------------- квесты

describe('GET /api/gamification/user/quests — выдача при чтении', () => {
  /* Только Date: таймеры, от которых зависят Prisma, Redis и supertest,
     остаются настоящими. */
  function setLocalClock(date: Date): void {
    jest.useFakeTimers({
      now: date,
      advanceTimers: true,
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    });
  }

  const MONDAY = new Date(2026, 9, 19, 12, 0, 0);
  const TUESDAY = new Date(2026, 9, 20, 12, 0, 0);

  /** Пул: базовый дневной, ровно три прочих дневных и ровно два недельных — выбор «случайных» однозначен. */
  async function seedQuests() {
    const quest = (key: string, type: 'DAILY' | 'WEEKLY', target: number) =>
      prisma.quest.create({
        data: {
          key,
          type,
          title: key,
          description: key,
          category: 'SOCIAL',
          icon: '*',
          xpReward: 10,
          requirement: JSON.stringify({ type: 'vote_count', target }),
        },
      });
    return {
      dailyVote: await quest('DAILY_VOTE', 'DAILY', 2),
      d2: await quest('DAILY_2', 'DAILY', 1),
      d3: await quest('DAILY_3', 'DAILY', 1),
      d4: await quest('DAILY_4', 'DAILY', 1),
      w1: await quest('WEEKLY_1', 'WEEKLY', 5),
      w2: await quest('WEEKLY_2', 'WEEKLY', 5),
    };
  }

  const keysOf = (body: { data: { quests: Array<{ key: string }> } }) =>
    body.data.quests.map(q => q.key).sort();
  const expiriesOf = (body: { data: { quests: Array<{ expiresAt: string }> } }) =>
    new Set(body.data.quests.map(q => q.expiresAt));
  const localIso = (year: number, month: number, day: number) =>
    new Date(year, month, day, 0, 0, 0).toISOString();

  it('во вторник выдаются только дневные; повторное чтение не дублирует', async () => {
    await seedQuests();
    setLocalClock(TUESDAY);

    const first = await get('anna', '/api/gamification/user/quests').expect(200);
    await get('anna', '/api/gamification/user/quests').expect(200);

    expect(keysOf(first.body)).toEqual(['DAILY_2', 'DAILY_3', 'DAILY_4', 'DAILY_VOTE']);
    expect(first.body.data.stats.activeQuests).toBe(4);
    expect(await prisma.userQuest.count({ where: { userId: w.user.anna } })).toBe(4);
    // Дневной квест живёт до ближайшей местной полуночи.
    expect(expiriesOf(first.body)).toEqual(new Set([localIso(2026, 9, 21)]));
  });

  it('в понедельник к дневным добавляются недельные; повторное чтение не дублирует', async () => {
    await seedQuests();
    setLocalClock(MONDAY);

    const response = await get('anna', '/api/gamification/user/quests').expect(200);
    await get('anna', '/api/gamification/user/quests').expect(200);

    expect(keysOf(response.body)).toEqual([
      'DAILY_2',
      'DAILY_3',
      'DAILY_4',
      'DAILY_VOTE',
      'WEEKLY_1',
      'WEEKLY_2',
    ]);
    expect(await prisma.userQuest.count({ where: { userId: w.user.anna } })).toBe(6);
    // Дневные — до полуночи вторника, недельные — до полуночи следующего понедельника.
    expect(expiriesOf(response.body)).toEqual(
      new Set([localIso(2026, 9, 20), localIso(2026, 9, 26)])
    );
  });

  it('истёкший квест не показывается и гасится в EXPIRED', async () => {
    const q = await seedQuests();
    setLocalClock(TUESDAY);
    const lastMonday = new Date(2026, 9, 12, 0, 0, 0);
    const stale = await prisma.userQuest.create({
      data: {
        userId: w.user.anna,
        questId: q.w1.id,
        status: 'ACTIVE',
        progress: 3,
        target: 5,
        startedAt: lastMonday,
        expiresAt: new Date(2026, 9, 19, 0, 0, 0),
      },
    });

    const response = await get('anna', '/api/gamification/user/quests').expect(200);

    expect(keysOf(response.body)).not.toContain('WEEKLY_1');
    expect(response.body.data.stats.activeQuests).toBe(4);
    expect((await prisma.userQuest.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe(
      'EXPIRED'
    );
  });
});

describe('голос через API → геймификация', () => {
  /**
   * Анна голосует за единственное блюдо открытого голосования группы А.
   * `/vote` — маршрут, который зовёт Mini App (`usePolls`), `/vote-multiple` —
   * выбор нескольких блюд; у них разные пути в сервисе голосов.
   */
  async function voteAsAnna(route: 'vote' | 'vote-multiple'): Promise<void> {
    const dish = await prisma.menuItem.create({
      data: { name: 'Плов', price: 300, groupId: w.groupA, createdBy: w.user.anna },
    });
    const poll = await prisma.poll.create({
      data: {
        groupId: w.groupA,
        createdBy: w.user.anna,
        status: 'ACTIVE',
        selectedMenuItemIds: JSON.stringify([dish.id]),
      },
    });
    await prisma.pollParticipant.create({
      data: { pollId: poll.id, userId: w.user.anna, status: 'EXPECTED' },
    });

    await request(app)
      .post(`/api/polls/${poll.id}/${route}`)
      .set('Authorization', `Bearer ${token.anna}`)
      .set('Idempotency-Key', idemKey('vote'))
      .send(route === 'vote' ? { menuItemId: dish.id } : { menuItemIds: [dish.id] })
      .expect(200);
  }

  async function expectVoteXpEarned(): Promise<void> {
    const history = await get('anna', '/api/gamification/user/xp-history').expect(200);
    expect(history.body.data).toHaveLength(1);
    const earned = history.body.data[0].amount as number;
    expect(earned).toBeGreaterThan(0);

    const stats = await get('anna', '/api/gamification/user/stats').expect(200);
    expect(stats.body.data.totalXP).toBe(500 + earned);
  }

  it('голос через /vote-multiple начисляет опыт: он виден в истории и в статистике', async () => {
    await voteAsAnna('vote-multiple');

    await expectVoteXpEarned();
  });

  // Регрессия: upsertVote (маршрут /vote, который зовёт Mini App) не начислял опыт.
  it('голос через /vote тоже начисляет опыт', async () => {
    await voteAsAnna('vote');

    await expectVoteXpEarned();
  });

  // Регрессия: updateQuestProgress и updateStreak никто не вызывал, квест и серия голосов не менялись.
  it('голос продвигает квест DAILY_VOTE и серию голосов', async () => {
    await prisma.quest.create({
      data: {
        key: 'DAILY_VOTE',
        type: 'DAILY',
        title: 'Проголосуй',
        description: 'Проголосуй',
        category: 'SOCIAL',
        icon: '*',
        xpReward: 10,
        requirement: JSON.stringify({ type: 'vote_count', target: 2 }),
      },
    });
    await get('anna', '/api/gamification/user/quests').expect(200);

    /* Путь, который до геймификации доходит (опыт за него начисляется — тест
       выше), чтобы падение здесь говорило о квестах и серии, а не о голосе. */
    await voteAsAnna('vote-multiple');

    const quests = await get('anna', '/api/gamification/user/quests').expect(200);
    const dailyVote = quests.body.data.quests.find((q: { key: string }) => q.key === 'DAILY_VOTE');
    expect(dailyVote.progress).toBe(1);

    const stats = await get('anna', '/api/gamification/user/stats').expect(200);
    expect(stats.body.data.currentStreak).toBe(1);
  });
});

// ------------------------------------------------------- сезоны: чтение

/** Сезон и опыт за него: `[кто, сколько, категория]`. */
async function seasonWithXp(
  number: number,
  xp: Array<[Person, number, string]>,
  { isActive = true, endDate = daysAhead(20) } = {}
) {
  const season = await prisma.season.create({
    data: {
      number,
      name: `Сезон ${number}`,
      startDate: daysAgo(10),
      endDate,
      isActive,
      rewards: JSON.stringify({
        top3: [{ xp: 500 }, { xp: 300 }, { xp: 200 }],
        top10: { xp: 100 },
        participant: { xp: 50 },
      }),
    },
  });
  await prisma.xPHistory.createMany({
    data: xp.map(([who, amount, category]) => ({
      userId: w.user[who],
      amount,
      category,
      reason: 'сезон',
      seasonId: season.id,
    })),
  });
  return season;
}

describe('GET /api/seasons/* — сезонные рейтинг и статистика', () => {
  async function seasonsWorld() {
    const s1 = await seasonWithXp(1, [
      ['anna', 120, 'GASTRO'],
      ['boris', 150, 'GASTRO'],
      ['boris', 50, 'SOCIAL'],
      ['dima', 50, 'EXPLORER'],
      ['lena', 999, 'SOCIAL'],
      ['oleg', 999, 'SOCIAL'],
    ]);
    // Опыт другого сезона в рейтинг первого не входит.
    await seasonWithXp(2, [['dima', 1000, 'SOCIAL']], { isActive: false });
    return s1;
  }

  it('рейтинг сезона: действующие участники группы по сумме опыта за этот сезон', async () => {
    const s1 = await seasonsWorld();

    const response = await get('anna', `/api/seasons/${s1.id}/leaderboard?groupId=${w.groupA}`)
      .expect(200);

    expect(
      response.body.data.map((r: { userId: number; totalXP: number; position: number }) => [
        r.userId,
        r.totalXP,
        r.position,
      ])
    ).toEqual([
      [w.user.boris, 200, 1],
      [w.user.anna, 120, 2],
      [w.user.dima, 50, 3],
    ]);

    const top2 = await get('anna', `/api/seasons/${s1.id}/leaderboard?groupId=${w.groupA}&limit=2`)
      .expect(200);
    expect(top2.body.data.map((r: { userId: number }) => r.userId)).toEqual([
      w.user.boris,
      w.user.anna,
    ]);
  });

  it.each<[string, Person]>([
    ['участник чужой группы, хоть и с флагом users.is_admin', 'oleg'],
    ['вышедший из группы', 'lena'],
  ])('рейтинг сезона закрыт: %s — 403', async (_name, who) => {
    const s1 = await seasonsWorld();

    const response = await get(who, `/api/seasons/${s1.id}/leaderboard?groupId=${w.groupA}`);

    expect(response.status).toBe(403);
    expect(response.body.data).toBeUndefined();
  });

  it.each([
    ['без groupId', ''],
    ['нечисловой groupId', '?groupId=нет'],
    ['нулевой groupId', '?groupId=0'],
  ])('рейтинг сезона: %s — 400 MISSING_GROUP_ID', async (_name, query) => {
    const s1 = await seasonsWorld();

    const response = await get('anna', `/api/seasons/${s1.id}/leaderboard${encodeURI(query)}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('MISSING_GROUP_ID');
  });

  it('статистику участника общей группы видно: сумма и разбивка за сезон', async () => {
    const s1 = await seasonsWorld();

    const bySeason = await get('anna', `/api/seasons/${s1.id}/stats/${w.user.boris}`).expect(200);
    const current = await get('anna', `/api/seasons/current/stats/${w.user.boris}`).expect(200);

    for (const response of [bySeason, current]) {
      expect(response.body.data).toMatchObject({
        seasonId: s1.id,
        totalXP: 200,
        categoriesBreakdown: { GASTRO: 150, RESPONSIBLE: 0, SOCIAL: 50, EXPLORER: 0 },
      });
    }
  });

  it.each<[string, Person, Person]>([
    ['нет общей группы', 'anna', 'oleg'],
    ['общая группа была, но человек из неё вышел', 'anna', 'lena'],
    ['посторонний смотрит участника', 'oleg', 'boris'],
  ])('чужая статистика закрыта: %s — 403', async (_name, who, whom) => {
    const s1 = await seasonsWorld();

    const bySeason = await get(who, `/api/seasons/${s1.id}/stats/${w.user[whom]}`);
    const current = await get(who, `/api/seasons/current/stats/${w.user[whom]}`);

    expect([bySeason.status, current.status]).toEqual([403, 403]);
    expect(bySeason.body.data).toBeUndefined();
    expect(current.body.data).toBeUndefined();
  });

  it('свою статистику человек видит без общей группы', async () => {
    const s1 = await seasonsWorld();

    const response = await get('oleg', `/api/seasons/${s1.id}/stats/${w.user.oleg}`).expect(200);

    expect(response.body.data.totalXP).toBe(999);
  });

  it('текущий сезон и список: активный — текущий, список от нового к старому', async () => {
    await seasonWithXp(1, [], { isActive: false, endDate: daysAgo(1) });
    const s2 = await seasonWithXp(2, []);

    const current = await get('anna', '/api/seasons/current').expect(200);
    const list = await get('anna', '/api/seasons').expect(200);
    const byId = await get('anna', `/api/seasons/${s2.id}`).expect(200);

    expect(current.body.data.id).toBe(s2.id);
    expect(list.body.data.map((s: { number: number }) => s.number)).toEqual([2, 1]);
    expect(byId.body.data.number).toBe(2);
  });

  it('нет активного сезона и неизвестный сезон — 404', async () => {
    await seasonWithXp(1, [], { isActive: false, endDate: daysAgo(1) });

    expect((await get('anna', '/api/seasons/current')).status).toBe(404);
    expect((await get('anna', '/api/seasons/999999')).status).toBe(404);
    expect((await get('anna', `/api/seasons/999999/stats/${w.user.anna}`)).status).toBe(404);
    expect((await get('anna', `/api/seasons/current/stats/${w.user.anna}`)).status).toBe(404);
  });
});

// ---------------------------------------------------- служебные операции

describe('служебные операции: X-Operations-Secret на маршруте', () => {
  const OPS_ROUTES: Array<[string, (x: World) => Record<string, unknown>]> = [
    ['/api/gamification/admin/award-xp', x => ({ userId: x.user.dima, amount: 50, reason: 'r', category: 'SOCIAL' })],
    ['/api/gamification/admin/recalculate-ratings', x => ({ userId: x.user.anna })],
    ['/api/seasons/rotate', () => ({})],
    ['/api/seasons/create', () => ({})],
  ];

  /** Всё, что служебные операции могли бы изменить. */
  const snapshot = async () => ({
    xp: await prisma.xPHistory.findMany({ orderBy: { id: 'asc' } }),
    stats: await prisma.userStats.findMany({ orderBy: { userId: 'asc' } }),
    seasons: await prisma.season.findMany({ orderBy: { id: 'asc' } }),
  });

  /* Закончившийся сезон с опытом: ротация, пропусти её отказ, изменила бы и
     сезоны, и опыт. А у Анны записанные рейтинги не совпадают с формулой —
     пересчёт их бы переписал. */
  const endedSeason = () =>
    seasonWithXp(1, [['boris', 100, 'SOCIAL']], { endDate: daysAgo(1) });

  it.each(
    OPS_ROUTES.flatMap(([url, body]) => [
      [url, 'без секрета', body, null] as const,
      [url, 'с чужим секретом', body, 'x'.repeat(OPS_SECRET.length)] as const,
    ])
  )('%s %s — 403 OPERATIONS_ACCESS_DENIED, в базе ничего не меняется', async (url, _name, body, secret) => {
    await endedSeason();
    const before = await snapshot();

    const response = await ops('anna', url, body(w), { secret });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('OPERATIONS_ACCESS_DENIED');
    expect(await snapshot()).toEqual(before);
  });

  it.each(OPS_ROUTES)('%s выключен без ENABLE_OPERATIONS_API — 404 и даже с секретом ничего не меняет', async (url, body) => {
    await endedSeason();
    const before = await snapshot();
    process.env.ENABLE_OPERATIONS_API = 'false';
    try {
      const response = await ops('anna', url, body(w));

      expect(response.status).toBe(404);
      expect(await snapshot()).toEqual(before);
    } finally {
      process.env.ENABLE_OPERATIONS_API = 'true';
    }
  });
});

describe('POST /api/gamification/admin/award-xp', () => {
  const award = (body: Record<string, unknown> = {}) => ({
    userId: w.user.dima,
    amount: 150,
    reason: 'За помощь',
    category: 'SOCIAL',
    ...body,
  });
  const historyOf = (userId: number) => prisma.xPHistory.findMany({ where: { userId } });

  it('с секретом начисляет: строка истории в нужной категории и рост опыта', async () => {
    const response = await ops('ops', '/api/gamification/admin/award-xp', award()).expect(200);

    expect(response.body.data.applied).toBe(true);
    expect(await historyOf(w.user.dima)).toEqual([
      expect.objectContaining({ amount: 150, category: 'SOCIAL' }),
    ]);
    expect(await totalXpOf(w.user.dima)).toBe(250);
  });

  it('повтор с тем же Idempotency-Key — одна строка истории и одно начисление', async () => {
    const key = idemKey('award');

    await ops('ops', '/api/gamification/admin/award-xp', award(), { key }).expect(200);
    await ops('ops', '/api/gamification/admin/award-xp', award(), { key }).expect(200);

    expect(await historyOf(w.user.dima)).toHaveLength(1);
    expect(await totalXpOf(w.user.dima)).toBe(250);
  });

  /* Кэш ответов в Redis разделён по тому, кто спрашивает, поэтому тот же ключ
     от второго оператора доходит до сервиса. Дубль ловит уже ключ события в
     базе: начисление адресату — одно. */
  it('тот же ключ от другого оператора — тоже одно начисление', async () => {
    const key = idemKey('award');

    await ops('ops', '/api/gamification/admin/award-xp', award(), { key }).expect(200);
    const second = await ops('ops2', '/api/gamification/admin/award-xp', award(), { key })
      .expect(200);

    expect(second.body.data.applied).toBe(false);
    expect(await historyOf(w.user.dima)).toHaveLength(1);
    expect(await totalXpOf(w.user.dima)).toBe(250);
  });

  /* TOTAL — не категория начисления, а сумма всех: начисление «в TOTAL»
     записало бы опыт, который не попадает ни в один рейтинг по категориям. */
  it.each<[string, (x: World) => Record<string, unknown>]>([
    ['категория TOTAL', () => ({ category: 'TOTAL' })],
    ['неизвестная категория', () => ({ category: 'MONEY' })],
    ['ноль опыта', () => ({ amount: 0 })],
    ['отрицательный опыт', () => ({ amount: -10 })],
    ['дробный опыт', () => ({ amount: 1.5 })],
    ['больше 100 000', () => ({ amount: 100001 })],
    ['пустая причина', () => ({ reason: '   ' })],
    ['причина длиннее 300', () => ({ reason: 'x'.repeat(301) })],
    ['нет адресата', () => ({ userId: undefined })],
    ['адресат строкой', x => ({ userId: String(x.user.dima) })],
  ])('%s — 400, опыт не начислен', async (_name, override) => {
    const response = await ops('ops', '/api/gamification/admin/award-xp', award(override(w)));

    expect(response.status).toBe(400);
    expect(await historyOf(w.user.dima)).toEqual([]);
    expect(await totalXpOf(w.user.dima)).toBe(100);
  });

  it('начисление засчитывается в активный сезон и видно в его рейтинге', async () => {
    const season = await seasonWithXp(1, []);

    await ops('ops', '/api/gamification/admin/award-xp', award()).expect(200);

    const response = await get('anna', `/api/seasons/${season.id}/leaderboard?groupId=${w.groupA}`)
      .expect(200);
    expect(response.body.data.map((r: { userId: number; totalXP: number }) => [r.userId, r.totalXP]))
      .toEqual([[w.user.dima, 150]]);
  });

  it('рост уровня открывает достижение за уровень — один раз и с его наградой', async () => {
    await prisma.achievement.create({
      data: {
        key: 'LEVEL_3',
        title: 'Третий уровень',
        description: 'Дойти до третьего уровня',
        icon: '*',
        category: 'SOCIAL',
        xpReward: 40,
        requirement: JSON.stringify({ type: 'level', value: 3 }),
      },
    });

    // 100 + 500 = 600 XP — уровень 3 (порог 519); награда достижения сверху.
    await ops('ops', '/api/gamification/admin/award-xp', award({ amount: 500 })).expect(200);

    const achievements = await get('dima', '/api/gamification/user/achievements').expect(200);
    expect(achievements.body.data).toEqual([
      expect.objectContaining({ key: 'LEVEL_3', unlocked: true }),
    ]);
    expect(await totalXpOf(w.user.dima)).toBe(600 + 40);

    // Следующий рост уровня награду за уже открытое достижение не повторяет.
    await ops('ops', '/api/gamification/admin/award-xp', award({ amount: 600 })).expect(200);

    expect(await totalXpOf(w.user.dima)).toBe(640 + 600);
    expect(await prisma.userAchievement.count({ where: { userId: w.user.dima } })).toBe(1);
  });
});

describe('POST /api/gamification/admin/recalculate-ratings', () => {
  it('пересчитывает рейтинги по накопленным счётчикам', async () => {
    await prisma.userStats.update({
      where: { userId: w.user.anna },
      data: {
        pollsWon: 2,
        pollsParticipated: 5,
        categoriesTried: 1,
        timesResponsible: 1,
        timesVolunteer: 1,
        ordersReceived: 2,
        currentStreak: 3,
        longestStreak: 4,
        paymentsOnTime: 2,
        newDishesDiscovered: 2,
        menuItemsAdded: 1,
      },
    });

    await ops('ops', '/api/gamification/admin/recalculate-ratings', { userId: w.user.anna })
      .expect(200);

    expect(await prisma.userStats.findUniqueOrThrow({ where: { userId: w.user.anna } })).toMatchObject({
      gastroRating: 2 * 10 + 5 * 2 + 1 * 20,
      responsibleRating: 1 * 50 + 1 * 100 + 2 * 30,
      socialRating: 3 * 20 + 4 * 10 + 2 * 15,
      explorerRating: 2 * 10 + 1 * 50 + 1 * 30,
    });
  });

  it('без userId — 400, рейтинги не тронуты', async () => {
    const before = await prisma.userStats.findMany({ orderBy: { userId: 'asc' } });

    const response = await ops('ops', '/api/gamification/admin/recalculate-ratings', {});

    expect(response.status).toBe(400);
    expect(await prisma.userStats.findMany({ orderBy: { userId: 'asc' } })).toEqual(before);
  });
});

describe('POST /api/seasons/rotate и /create — смена сезона', () => {
  const seasons = () =>
    prisma.season.findMany({ orderBy: { number: 'asc' }, select: { number: true, isActive: true } });

  it('create: прежний сезон гаснет, новый получает следующий номер — активный ровно один', async () => {
    await seasonWithXp(1, []);

    const response = await ops('ops', '/api/seasons/create').expect(200);

    expect(response.body.data.number).toBe(2);
    expect(await seasons()).toEqual([
      { number: 1, isActive: false },
      { number: 2, isActive: true },
    ]);
  });

  it('rotate без единого сезона заводит первый', async () => {
    await ops('ops', '/api/seasons/rotate').expect(200);

    expect(await seasons()).toEqual([{ number: 1, isActive: true }]);
  });

  it('rotate закончившегося сезона: призы по местам, новый сезон с очередным номером', async () => {
    await seasonWithXp(
      1,
      [
        ['boris', 200, 'GASTRO'],
        ['anna', 120, 'SOCIAL'],
        ['dima', 50, 'SOCIAL'],
        ['oleg', 10, 'SOCIAL'],
      ],
      { endDate: daysAgo(1) }
    );

    const response = await ops('ops', '/api/seasons/rotate').expect(200);

    expect(response.body.data.number).toBe(2);
    expect(await seasons()).toEqual([
      { number: 1, isActive: false },
      { number: 2, isActive: true },
    ]);
    // Призы из настроек сезона: 500/300/200 за первые три места, 100 — топ-10.
    expect(await totalXpOf(w.user.boris)).toBe(300 + 500);
    expect(await totalXpOf(w.user.anna)).toBe(500 + 300);
    expect(await totalXpOf(w.user.dima)).toBe(100 + 200);
    expect(await totalXpOf(w.user.oleg)).toBe(8000 + 100);
  });

  it('повторная ротация не удваивает призы и не плодит сезоны', async () => {
    await seasonWithXp(1, [['boris', 200, 'GASTRO']], { endDate: daysAgo(1) });
    await ops('ops', '/api/seasons/rotate').expect(200);
    const xpAfterFirst = await totalXpOf(w.user.boris);

    await ops('ops', '/api/seasons/rotate');

    expect(await totalXpOf(w.user.boris)).toBe(xpAfterFirst);
    expect(await seasons()).toEqual([
      { number: 1, isActive: false },
      { number: 2, isActive: true },
    ]);
  });

  // BUG: rotateSeason заворачивает «Season has not ended yet» в общую ошибку, и контроллер отвечает 500 вместо 400.
  it.failing('rotate незакончившегося сезона — 400', async () => {
    await seasonWithXp(1, []);

    const response = await ops('ops', '/api/seasons/rotate');

    expect(response.status).toBe(400);
  });
});
