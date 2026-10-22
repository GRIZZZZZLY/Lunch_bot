/* Лимитер запросов выключается ДО загрузки приложения: конфигурация читается
   при импорте сервера. Набор входит заново в каждом тесте (`cleanDatabase`
   меняет id пользователей), и лимит входа по IP сработал бы посреди файла в
   задании покрытия, где ENABLE_RATE_LIMIT не выставлен. Переменная живёт
   только в окружении этого файла: jest даёт каждому набору свою копию env. */
process.env.ENABLE_RATE_LIMIT = 'false';

/**
 * Меню через НАСТОЯЩИЙ API: express, PostgreSQL, Prisma.
 *
 * Меню — данные группы. Главные риски здесь не в форме ответа, а в границах:
 *
 * 1. Чтение. Шесть GET-маршрутов отдают меню только участнику выбранной
 *    группы (находка аудита F3: раньше любой вошедший читал меню любой группы
 *    по `?groupId`), и меню группы A никогда не содержит блюд группы B.
 * 2. Запись. Администратор группы A не правит, не переключает, не удаляет и
 *    не меняет массово блюда группы B, даже подставив в запрос свой `groupId`
 *    (находка F2), а `groupId` в теле правки не переносит блюдо в другую группу.
 * 3. История. Удаление блюда мягкое: голоса и победители завершённых опросов
 *    остаются, блюдо уходит из каталога.
 *
 * Изоляцию кэша активного меню проверяет `menu-cache.redis.test.ts`.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { cacheService } from '../../../services/cache.service';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { tokenFor } from '../helpers/api';

let app: ReturnType<typeof createTestApp>;

const TG = {
  anna: 700001001,
  boris: 700001002,
  vera: 700001003,
  gleb: 700001004,
} as const;
type Who = keyof typeof TG;

interface World {
  user: Record<Who, number>;
  groupA: number;
  groupB: number;
  groupC: number;
  /** Блюда группы A: два активных, одно выключенное, одно удалённое. */
  soup: number;
  peas: number;
  plov: number;
  removed: number;
  /** Блюдо группы B. Название пересекается с блюдом A намеренно — для поиска. */
  fish: number;
}

/**
 * Три группы и четыре человека.
 *
 * Анна — создатель A, админ C и РЯДОВОЙ участник B: так одна учётная запись
 * проверяет и «чужую группу», и «группу, где я не админ», и «две свои группы».
 * Борис — создатель B, в A его нет. Вера — рядовой участник A.
 * Глеб был в A и вышел: вышедший не должен читать меню наравне с участником.
 */
async function buildWorld(): Promise<World> {
  const user = {} as Record<Who, number>;
  for (const who of Object.keys(TG) as Who[]) {
    const created = await prisma.user.create({
      data: { telegramId: BigInt(TG[who]), firstName: who },
    });
    user[who] = created.id;
  }

  const group = (n: number, title: string) =>
    prisma.group.create({
      data: { telegramId: BigInt(-100000001000 - n), title },
    });
  const groupA = (await group(1, 'Команда А')).id;
  const groupB = (await group(2, 'Команда Б')).id;
  const groupC = (await group(3, 'Команда В')).id;

  await prisma.groupMember.createMany({
    data: [
      { groupId: groupA, userId: user.anna, role: 'CREATOR' },
      { groupId: groupA, userId: user.vera, role: 'MEMBER' },
      { groupId: groupA, userId: user.gleb, role: 'MEMBER', isActive: false, leftAt: new Date() },
      { groupId: groupB, userId: user.boris, role: 'CREATOR' },
      { groupId: groupB, userId: user.anna, role: 'MEMBER' },
      { groupId: groupC, userId: user.anna, role: 'ADMIN' },
    ],
  });

  const dish = async (
    groupId: number,
    name: string,
    price: number,
    extra: { isActive?: boolean; deletedAt?: Date } = {}
  ) =>
    (
      await prisma.menuItem.create({
        data: { name, price, groupId, createdBy: user.anna, ...extra },
      })
    ).id;

  return {
    user,
    groupA,
    groupB,
    groupC,
    soup: await dish(groupA, 'Суп куриный', 250.5),
    peas: await dish(groupA, 'Суп гороховый', 300, { isActive: false }),
    plov: await dish(groupA, 'Плов', 180),
    removed: await dish(groupA, 'Старое блюдо', 5000, { isActive: false, deletedAt: new Date() }),
    fish: await dish(groupB, 'Суп рыбный', 900),
  };
}

const tokens = new Map<Who, string>();

/** Клиент от имени человека: токен настоящего входа, один на тест. */
async function as(who: Who) {
  if (!tokens.has(who)) tokens.set(who, await tokenFor(app, TG[who]));
  const auth = `Bearer ${tokens.get(who)}`;
  return {
    get: (url: string) => request(app).get(url).set('Authorization', auth),
    post: (url: string, body: object) =>
      request(app).post(url).set('Authorization', auth).send(body),
    put: (url: string, body: object) =>
      request(app).put(url).set('Authorization', auth).send(body),
    patch: (url: string, body: object) =>
      request(app).patch(url).set('Authorization', auth).send(body),
    delete: (url: string, body: object) =>
      request(app).delete(url).set('Authorization', auth).send(body),
  };
}

const row = (id: number) => prisma.menuItem.findUnique({ where: { id } });
const names = (body: { data: Array<{ name: string }> }) =>
  body.data.map(item => item.name).sort();

let w: World;

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  /* Без Redis — пустая операция. С Redis убирает меню, закэшированное
     прошлым прогоном под тем же id группы. */
  await cacheService.flush();
  tokens.clear();
  w = await buildWorld();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

const withGroup = (url: string, groupId: number) =>
  `${url}${url.includes('?') ? '&' : '?'}groupId=${groupId}`;

describe('чтение меню: только участнику выбранной группы (F3)', () => {
  const READS = [
    ['список', '/api/menu'],
    ['активные', '/api/menu/active'],
    ['популярные', '/api/menu/popular'],
    ['статистика', '/api/menu/stats'],
    ['поиск', '/api/menu/search?q=Суп'],
  ];

  /* F3: эти маршруты принимали любой `?groupId` и отдавали меню чужой группы
     всякому вошедшему. */
  it.each(READS)(
    '%s: без groupId — 400, посторонний и вышедший — 403, участник — 200',
    async (_name, url) => {
      const noGroup = await (await as('vera')).get(url);
      expect(noGroup.status).toBe(400);
      expect(noGroup.body.code).toBe('MISSING_GROUP_ID');

      for (const stranger of ['boris', 'gleb'] as const) {
        const refused = await (await as(stranger)).get(withGroup(url, w.groupA));
        expect(refused.status).toBe(403);
        expect(refused.body.code).toBe('NOT_MEMBER');
      }

      const member = await (await as('vera')).get(withGroup(url, w.groupA));
      expect(member.status).toBe(200);
    }
  );
});

describe('изоляция групп и цена числом', () => {
  /* Анна состоит и в A, и в B: если чтение потеряет фильтр по группе,
     блюдо B просочится в ответ, и права это не остановят. Цена в базе —
     Decimal; клиент считает деньги и ждёт число, а не строку или объект. */
  it.each([
    ['список: всё неудалённое', '/api/menu', ['Плов', 'Суп гороховый', 'Суп куриный']],
    ['активные', '/api/menu/active', ['Плов', 'Суп куриный']],
    ['популярные', '/api/menu/popular', ['Плов', 'Суп куриный']],
    ['поиск «Суп»', '/api/menu/search?q=Суп', ['Суп куриный']],
  ])('%s группы A — только её блюда', async (_name, url, expected) => {
    const res = await (await as('anna')).get(withGroup(url, w.groupA));

    expect(res.status).toBe(200);
    expect(names(res.body)).toEqual(expected);
    const soup = res.body.data.find((item: { id: number }) => item.id === w.soup);
    expect(soup.price).toBe(250.5);
  });

  it('статистика считает только живые блюда своей группы', async () => {
    const res = await (await as('vera')).get(`/api/menu/stats?groupId=${w.groupA}`);

    expect(res.status).toBe(200);
    // Средняя — по активным с ценой: (250.5 + 180) / 2. Удалённое и блюдо B не в счёт.
    expect(res.body.data).toEqual({ total: 3, active: 2, averagePrice: 215.25 });
  });

  it('популярные идут по числу голосов, со счётчиком', async () => {
    const poll = await prisma.poll.create({
      data: { groupId: w.groupA, createdBy: w.user.anna, status: 'COMPLETED' },
    });
    await prisma.vote.createMany({
      data: [
        { pollId: poll.id, userId: w.user.anna, menuItemId: w.plov },
        { pollId: poll.id, userId: w.user.vera, menuItemId: w.plov },
        { pollId: poll.id, userId: w.user.anna, menuItemId: w.soup },
      ],
    });

    const res = await (await as('vera')).get(`/api/menu/popular?groupId=${w.groupA}`);

    expect(res.status).toBe(200);
    expect(
      res.body.data.map((item: { name: string; voteCount: number }) => [item.name, item.voteCount])
    ).toEqual([
      ['Плов', 2],
      ['Суп куриный', 1],
    ]);
  });

  it.each(['', ' ', ' я '])('поисковый запрос «%s» короче двух знаков — 400', async q => {
    const res = await (await as('vera')).get(
      `/api/menu/search?q=${encodeURIComponent(q)}&groupId=${w.groupA}`
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_QUERY');
  });
});

describe('GET /api/menu/:id — блюдо по прямой ссылке', () => {
  it('участник группы блюда получает его, цена — число', async () => {
    const res = await (await as('vera')).get(`/api/menu/${w.soup}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: w.soup, groupId: w.groupA, price: 250.5 });
  });

  // IDOR: id блюда перебирается, право решает группа самого блюда.
  it('блюдо чужой группы — 403', async () => {
    const res = await (await as('vera')).get(`/api/menu/${w.fish}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_MEMBER');
  });

  it('несуществующее блюдо — 404', async () => {
    const res = await (await as('vera')).get(`/api/menu/${w.fish + 1000}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ITEM_NOT_FOUND');
  });
});

describe('POST /api/menu — создание', () => {
  const countNamed = (name: string) => prisma.menuItem.count({ where: { name } });

  it('админ двух групп создаёт блюдо в обеих, повтор группы копию не плодит', async () => {
    const res = await (await as('anna')).post('/api/menu', {
      name: 'Лагман',
      price: 420,
      groupIds: [w.groupA, w.groupC, w.groupA],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.map((item: { price: number }) => item.price)).toEqual([420, 420]);
    const rows = await prisma.menuItem.findMany({ where: { name: 'Лагман' } });
    expect(rows.map(r => r.groupId).sort()).toEqual([w.groupA, w.groupC].sort());
  });

  // Старый клиент шлёт одиночный groupId; он должен по-прежнему работать.
  it('старый контракт с одиночным groupId создаёт блюдо в этой группе', async () => {
    const res = await (await as('anna')).post('/api/menu', {
      name: 'Манты',
      price: 350,
      groupId: w.groupA,
    });

    expect(res.status).toBe(201);
    const menu = await (await as('vera')).get(`/api/menu?groupId=${w.groupA}`);
    expect(names(menu.body)).toContain('Манты');
  });

  /* На маршруте нет общей проверки админа: права проверяет сервис по
     КАЖДОЙ группе, и создание идёт по принципу «всё или ничего». */
  it.each<[string, Who, (x: World) => number[]]>([
    ['админ A, но рядовой в B', 'anna', x => [x.groupA, x.groupB]],
    ['рядовой участник', 'vera', x => [x.groupA]],
    ['посторонний', 'boris', x => [x.groupA]],
  ])('%s — 403, и не создано ни одной копии', async (_name, who, groups) => {
    const res = await (await as(who)).post('/api/menu', {
      name: 'Самса',
      price: 120,
      groupIds: groups(w),
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_ADMIN');
    expect(await countNamed('Самса')).toBe(0);
  });

  it.each([
    ['без группы', {}],
    ['пустой список групп', { groupIds: [] }],
  ])('%s — 400, ничего не создано', async (_name, extra) => {
    const res = await (await as('anna')).post('/api/menu', { name: 'Самса', ...extra });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await countNamed('Самса')).toBe(0);
  });
});

describe('PUT /api/menu/:id — правка', () => {
  it('админ группы правит блюдо своей группы', async () => {
    const res = await (await as('anna')).put(`/api/menu/${w.plov}`, {
      groupId: w.groupA,
      name: 'Плов узбекский',
      price: 199.9,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(199.9);
    const saved = await row(w.plov);
    expect(saved?.name).toBe('Плов узбекский');
    expect(Number(saved?.price)).toBe(199.9);
  });

  /* F2: `groupId` в теле правки служил и для проверки прав, и попадал в
     update — администратор двух групп мог «перевезти» блюдо, а форма с лишним
     полем — переписать группу. */
  it('groupId в теле не переносит блюдо в другую группу', async () => {
    const res = await (await as('anna')).put(`/api/menu/${w.plov}`, {
      groupId: w.groupC,
      groupIds: [w.groupC],
      name: 'Плов праздничный',
    });

    expect(res.status).toBe(200);
    const saved = await row(w.plov);
    expect(saved?.groupId).toBe(w.groupA);
    expect(saved?.name).toBe('Плов праздничный');
  });
});

describe('запись в чужое меню (F2)', () => {
  /* Админ A подставляет свой groupId и проходит проверку маршрута — решать
     должна группа самого блюда. Рядовой участник не меняет ничего. */
  it.each<[string, Who, (x: World) => number, (x: World) => number]>([
    ['правка: админ A, блюдо B', 'anna', x => x.fish, x => x.groupA],
    ['правка: рядовой участник', 'vera', x => x.soup, x => x.groupA],
  ])('%s — 403, строка не изменилась', async (_name, who, target, groupId) => {
    const before = await row(target(w));

    const res = await (await as(who)).put(`/api/menu/${target(w)}`, {
      groupId: groupId(w),
      name: 'Взлом',
    });

    expect(res.status).toBe(403);
    expect(await row(target(w))).toEqual(before);
  });

  it.each<[string, 'patch' | 'delete', string, Who, (x: World) => number, (x: World) => number]>([
    ['переключение: админ A, блюдо B', 'patch', '/toggle', 'anna', x => x.fish, x => x.groupA],
    ['переключение: рядовой участник', 'patch', '/toggle', 'vera', x => x.soup, x => x.groupA],
    ['удаление: админ A, блюдо B', 'delete', '', 'anna', x => x.fish, x => x.groupA],
    ['удаление: рядовой участник', 'delete', '', 'vera', x => x.soup, x => x.groupA],
  ])('%s — 403, строка не изменилась', async (_name, method, suffix, who, target, groupId) => {
    const before = await row(target(w));

    const res = await (await as(who))[method](`/api/menu/${target(w)}${suffix}`, {
      groupId: groupId(w),
    });

    expect(res.status).toBe(403);
    expect(await row(target(w))).toEqual(before);
  });

  it('массовая смена с блюдом чужой группы — 403, не тронуто ни одно', async () => {
    const res = await (await as('anna')).patch('/api/menu/bulk-status', {
      groupId: w.groupA,
      ids: [w.soup, w.fish],
      isActive: false,
    });

    expect(res.status).toBe(403);
    expect((await row(w.soup))?.isActive).toBe(true);
    expect((await row(w.fish))?.isActive).toBe(true);
  });
});

describe('переключатель и массовая смена статуса', () => {
  it('переключатель меняет активность на противоположную', async () => {
    const anna = await as('anna');

    const off = await anna.patch(`/api/menu/${w.plov}/toggle`, { groupId: w.groupA });
    expect(off.status).toBe(200);
    expect(off.body.data.isActive).toBe(false);
    expect((await row(w.plov))?.isActive).toBe(false);

    const on = await anna.patch(`/api/menu/${w.plov}/toggle`, { groupId: w.groupA });
    expect(on.body.data.isActive).toBe(true);
    expect((await row(w.plov))?.isActive).toBe(true);
  });

  it('админ массово выключает блюда своей группы', async () => {
    const res = await (await as('anna')).patch('/api/menu/bulk-status', {
      groupId: w.groupA,
      ids: [w.soup, w.plov],
      isActive: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.updatedCount).toBe(2);
    expect((await row(w.soup))?.isActive).toBe(false);
    expect((await row(w.plov))?.isActive).toBe(false);
  });

  it.each<[string, (x: World) => object, string]>([
    ['пустой список id', () => ({ ids: [], isActive: false }), 'INVALID_IDS'],
    ['статус строкой, а не булевым', x => ({ ids: [x.soup], isActive: 'false' }), 'INVALID_STATUS'],
  ])('%s — 400, блюда не тронуты', async (_name, body, code) => {
    const res = await (await as('anna')).patch('/api/menu/bulk-status', {
      groupId: w.groupA,
      ...body(w),
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
    expect((await row(w.soup))?.isActive).toBe(true);
  });
});

describe('мягкое удаление', () => {
  /* Регрессия: удаление блюда обнуляло menuItemId у голосов и
     winnerMenuItemId у результатов, и у завершённых опросов всей группы
     пропадали победители. */
  it('удаление блюда не стирает историю: голоса и победитель опроса остаются', async () => {
    const poll = await prisma.poll.create({
      data: { groupId: w.groupA, createdBy: w.user.anna, status: 'COMPLETED', endedAt: new Date() },
    });
    await prisma.vote.createMany({
      data: [
        { pollId: poll.id, userId: w.user.anna, menuItemId: w.plov },
        { pollId: poll.id, userId: w.user.vera, menuItemId: w.plov },
      ],
    });
    await prisma.pollResult.create({
      data: { pollId: poll.id, winnerMenuItemId: w.plov, responsibleUserId: w.user.anna, totalVotes: 2 },
    });

    const res = await (await as('anna')).delete(`/api/menu/${w.plov}`, { groupId: w.groupA });

    expect(res.status).toBe(200);
    expect(await prisma.vote.count({ where: { menuItemId: w.plov } })).toBe(2);
    const result = await prisma.pollResult.findUnique({ where: { pollId: poll.id } });
    expect(result?.winnerMenuItemId).toBe(w.plov);
    const saved = await row(w.plov);
    expect(saved?.deletedAt).not.toBeNull();
    expect(saved?.isActive).toBe(false);
  });

  it('удалённое блюдо пропадает из каталога, правка и переключатель на нём — 404', async () => {
    const anna = await as('anna');
    // Активное меню прочитано ДО удаления: с Redis оно лежит в кэше.
    await anna.get(`/api/menu/active?groupId=${w.groupA}`).expect(200);

    await anna.delete(`/api/menu/${w.plov}`, { groupId: w.groupA }).expect(200);

    const all = await anna.get(`/api/menu?groupId=${w.groupA}`);
    expect(names(all.body)).not.toContain('Плов');
    const active = await anna.get(`/api/menu/active?groupId=${w.groupA}`);
    expect(names(active.body)).not.toContain('Плов');

    const byId = await anna.get(`/api/menu/${w.plov}`);
    expect(byId.status).toBe(404);

    const edit = await anna.put(`/api/menu/${w.plov}`, { groupId: w.groupA, name: 'Плов 2' });
    expect(edit.status).toBe(404);
    expect(edit.body.code).toBe('ITEM_NOT_FOUND');

    // Переключатель не должен вернуть удалённое блюдо в голосование.
    const toggle = await anna.patch(`/api/menu/${w.plov}/toggle`, { groupId: w.groupA });
    expect(toggle.status).toBe(404);
    const saved = await row(w.plov);
    expect(saved?.isActive).toBe(false);
    expect(saved?.name).toBe('Плов');
  });
});
