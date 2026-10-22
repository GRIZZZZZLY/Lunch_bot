/**
 * Аналитика расходов через НАСТОЯЩИЙ API: express, PostgreSQL, Prisma.
 *
 * Прежние тесты подменяли `InsightsService` и сверяли, с каким id его позвали.
 * Здесь проверяется то, ради чего экран существует: какие деньги попали в
 * итог (только мои подтверждённые долги за 30 дней) и кому эти цифры видны
 * (только мне самому — это личные финансовые данные).
 *
 * Redis маршрутам аналитики не нужен: изменяющих запросов здесь нет.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { addMember, tokenFor } from '../helpers/api';

let app: ReturnType<typeof createTestApp>;

const TG = {
  anna: 720000101, // должник, чью аналитику смотрим
  boris: 720000102, // получатель её долгов, сам тоже платит
  igor: 720000103, // админ общей группы И с флагом users.is_admin
} as const;
type Person = keyof typeof TG;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);
const isoDay = (date: Date) => date.toISOString().split('T')[0];

interface World {
  user: Record<Person, number>;
  /** Два дня с подтверждёнными платежами Анны — их даты ждём в ответе. */
  busyDay: Date;
  quietDay: Date;
}

/**
 * Анна должна Борису. В её истории намеренно лежит всё, что в итог попасть НЕ
 * должно: неподтверждённый и списанный долги, подтверждённый, но старше 30 дней, деньги,
 * которые должны ей (она получатель), и чужой платёж Бориса. Без этого
 * «итог 620» был бы верен и при снятом любом из фильтров.
 */
async function buildWorld(): Promise<World> {
  const user = {} as Record<Person, number>;
  for (const [name, telegramId] of Object.entries(TG) as Array<[Person, number]>) {
    const row = await prisma.user.create({
      data: { telegramId: BigInt(telegramId), firstName: name, isAdmin: name === 'igor' },
    });
    user[name] = row.id;
  }

  const group = await prisma.group.create({
    data: { telegramId: BigInt(-100000000301), title: 'Офис' },
  });
  await addMember(group.id, user.anna, 'MEMBER');
  await addMember(group.id, user.boris, 'CREATOR');
  await addMember(group.id, user.igor, 'ADMIN');

  const busyDay = daysAgo(2);
  const quietDay = daysAgo(5);
  const debt = (
    fromUserId: number,
    toUserId: number,
    amount: number,
    status: string,
    confirmedAt: Date | null
  ) => ({ fromUserId, toUserId, amount, status, confirmedAt });

  await prisma.transaction.createMany({
    data: [
      // В итог: 300 + 120 в один день и 200 в другой.
      debt(user.anna, user.boris, 300, 'CONFIRMED', busyDay),
      debt(user.anna, user.boris, 120, 'CONFIRMED', busyDay),
      debt(user.anna, user.boris, 200, 'CONFIRMED', quietDay),
      // Мимо итога.
      debt(user.anna, user.boris, 150, 'PENDING', null),
      /* Списанный админом долг: дата подтверждения у него есть, но денег Анна
         не тратила. Без этой строки фильтр по статусу ничем не проверялся бы. */
      debt(user.anna, user.boris, 800, 'FORGIVEN', daysAgo(1)),
      debt(user.anna, user.boris, 1000, 'CONFIRMED', daysAgo(40)),
      debt(user.boris, user.anna, 500, 'CONFIRMED', daysAgo(1)),
      debt(user.boris, user.igor, 700, 'CONFIRMED', daysAgo(3)),
    ],
  });

  return { user, busyDay, quietDay };
}

let w: World;
const token = {} as Record<Person, string>;
const as = (who: Person) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token[who]}`),
});

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  w = await buildWorld();
  for (const name of Object.keys(TG) as Person[]) {
    token[name] = await tokenFor(app, TG[name]);
  }
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('GET /api/insights/budget — мои расходы', () => {
  it('в итог входят только мои подтверждённые долги за последние 30 дней', async () => {
    const response = await as('anna').get('/api/insights/budget').expect(200);

    expect(response.body.data).toEqual({
      totalSpent: 620,
      daysActive: 2,
      averagePerDay: 310,
      projectedMonthly: 9300,
      savingsVsExternal: 186,
      mostExpensiveDay: { date: isoDay(w.busyDay), amount: 420 },
      cheapestDay: { date: isoDay(w.quietDay), amount: 200 },
      trend: 'stable',
    });
  });

  it('человек без подтверждённых платежей получает нули, а не чужие цифры', async () => {
    const response = await as('igor').get('/api/insights/budget').expect(200);

    expect(response.body.data).toMatchObject({
      totalSpent: 0,
      daysActive: 0,
      averagePerDay: 0,
      projectedMonthly: 0,
    });
  });
});

describe('GET /api/insights/budget/:userId — только свои данные', () => {
  it('свой id отдаёт ту же аналитику, что и /budget', async () => {
    const response = await as('anna').get(`/api/insights/budget/${w.user.anna}`).expect(200);

    expect(response.body.data.totalSpent).toBe(620);
  });

  /* [BUG] в прошлом: чужой кошелёк открывал глобальный флаг users.is_admin.
     Такого понятия больше нет, и роль в общей группе права на чужие расходы
     тоже не даёт. Игорь — и админ общей группы, и с флагом is_admin. */
  it.each<[string, Person]>([
    ['получатель её долгов из той же группы', 'boris'],
    ['админ общей группы с флагом users.is_admin', 'igor'],
  ])('чужую аналитику не отдают: %s — 403 без цифр', async (_name, who) => {
    const response = await as(who).get(`/api/insights/budget/${w.user.anna}`);

    expect(response.status).toBe(403);
    expect(response.body.data).toBeUndefined();
  });

  it('нечисловой userId — 400', async () => {
    const response = await as('anna').get('/api/insights/budget/abc');

    expect(response.status).toBe(400);
  });
});

describe('GET /api/insights/categories — мои любимые блюда', () => {
  it('считает только мои голоса за 30 дней, по убыванию числа голосов', async () => {
    const group = await prisma.group.findFirstOrThrow();
    const dish = (name: string) =>
      prisma.menuItem.create({
        data: { name, price: 300, groupId: group.id, createdBy: w.user.boris },
      });
    const [pilaf, soup] = [await dish('Плов'), await dish('Суп')];
    const poll = () =>
      prisma.poll.create({
        data: { groupId: group.id, createdBy: w.user.boris, status: 'COMPLETED' },
      });
    const vote = async (userId: number, menuItemId: number, createdAt: Date) =>
      prisma.vote.create({
        data: { pollId: (await poll()).id, userId, menuItemId, createdAt },
      });

    await vote(w.user.anna, pilaf.id, daysAgo(3));
    await vote(w.user.anna, pilaf.id, daysAgo(10));
    await vote(w.user.anna, soup.id, daysAgo(1));
    await vote(w.user.anna, soup.id, daysAgo(40)); // за окном
    await vote(w.user.boris, soup.id, daysAgo(1)); // чужой
    await vote(w.user.boris, soup.id, daysAgo(2)); // чужой

    const response = await as('anna').get('/api/insights/categories').expect(200);

    expect(response.body.data).toEqual({
      totalVotes: 3,
      favoriteCategory: 'Плов',
      categories: [
        { category: 'Плов', count: 2, percentage: 67, items: ['Плов'] },
        { category: 'Суп', count: 1, percentage: 33, items: ['Суп'] },
      ],
    });
  });
});
