/**
 * Справочник магазинов группы (`/api/groups/:groupId/stores`) и личный список
 * товаров (`/api/user/item-presets`) через НАСТОЯЩИЙ API и PostgreSQL.
 *
 * Оба ресурса копятся сами из работы с забегами (это проверяет
 * `store-runs.redis.test.ts`), а здесь — то, что пользователь делает с ними
 * руками: читает, переименовывает, скрывает, закрепляет, удаляет. Главные
 * риски — чужой доступ (посторонний не трогает справочник группы, чужой пресет
 * не виден) и уникальность имени на настоящем индексе.
 *
 * Redis не нужен: у этих маршрутов нет обязательной идемпотентности.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { addMember, tokenFor } from '../helpers/api';

let app: ReturnType<typeof createTestApp>;

const TG = { ivan: 700000401, maria: 700000402, olga: 700000403, stranger: 700000404 } as const;
type Who = keyof typeof TG;

interface World {
  id: Record<Who, number>;
  groupA: number;
  groupB: number;
}

let world: World;
let token: Record<Who, string>;

/** Команда А: Иван и Мария, Ольга вышла. Команда Б — только посторонний. */
async function buildWorld(): Promise<World> {
  const id = {} as Record<Who, number>;
  for (const [who, telegramId] of Object.entries(TG) as Array<[Who, number]>) {
    const user = await prisma.user.create({ data: { telegramId: BigInt(telegramId), firstName: who } });
    id[who] = user.id;
  }
  const groupA = await prisma.group.create({ data: { telegramId: BigInt(-1000000000401), title: 'А' } });
  const groupB = await prisma.group.create({ data: { telegramId: BigInt(-1000000000402), title: 'Б' } });
  await addMember(groupA.id, id.ivan, 'CREATOR');
  await addMember(groupA.id, id.maria);
  await addMember(groupA.id, id.olga, 'MEMBER', { isActive: false, leftAt: new Date() });
  await addMember(groupB.id, id.stranger, 'CREATOR');
  return { id, groupA: groupA.id, groupB: groupB.id };
}

function call(method: 'get' | 'patch' | 'delete', path: string, who: Who, body?: object): request.Test {
  const req = request(app)[method](path).set('Authorization', `Bearer ${token[who]}`);
  return body === undefined ? req : req.send(body);
}

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

async function store(groupId: number, name: string, extra: { lastUsedAt?: Date; archivedAt?: Date } = {}) {
  return prisma.groupStore.create({
    data: {
      groupId,
      createdById: world.id.ivan,
      name,
      normalizedName: name.toLowerCase().replace(/ё/g, 'е'),
      ...extra,
    },
  });
}

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  world = await buildWorld();
  token = {} as Record<Who, string>;
  for (const [who, telegramId] of Object.entries(TG) as Array<[Who, number]>) {
    token[who] = await tokenFor(app, telegramId);
  }
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('справочник магазинов: чтение', () => {
  it('отдаёт только видимые магазины своей группы, свежие первыми', async () => {
    await store(world.groupA, 'Лента', { lastUsedAt: daysAgo(2) });
    await store(world.groupA, 'Ашан', { lastUsedAt: daysAgo(1) });
    await store(world.groupA, 'Магнит', { archivedAt: new Date() });
    await store(world.groupB, 'Перекрёсток');

    const response = await call('get', `/api/groups/${world.groupA}/stores`, 'maria').expect(200);

    expect(response.body.data.map((s: { name: string }) => s.name)).toEqual(['Ашан', 'Лента']);
  });

  it.each<[string, Who]>([
    ['посторонний', 'stranger'],
    ['вышедшая из группы', 'olga'],
  ])('%s получает отказ', async (_label, who) => {
    await store(world.groupA, 'Лента');

    const response = await call('get', `/api/groups/${world.groupA}/stores`, who);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });
});

describe('справочник магазинов: переименование', () => {
  /* Активные забеги на экранах прямо сейчас и получают новое имя. Имя в
     завершённых — снимок на момент похода, его правка переписала бы историю. */
  it('новое имя получают только активные забеги', async () => {
    const lenta = await store(world.groupA, 'Лента');
    const runs: Record<string, number> = {};
    const plan: Array<['COLLECTING' | 'SHOPPING' | 'SETTLED' | 'CANCELLED', Who]> = [
      ['COLLECTING', 'ivan'],
      ['SHOPPING', 'maria'],
      ['SETTLED', 'ivan'],
      ['CANCELLED', 'ivan'],
    ];
    for (const [status, who] of plan) {
      const run = await prisma.storeRun.create({
        data: {
          groupId: world.groupA,
          initiatorId: world.id[who],
          storeId: lenta.id,
          storeName: 'Лента',
          status,
          collectUntil: new Date(),
        },
      });
      runs[status] = run.id;
    }

    const response = await call('patch', `/api/groups/${world.groupA}/stores/${lenta.id}`, 'maria', {
      name: '  Лента Гипер  ',
    }).expect(200);
    expect(response.body.data.name).toBe('Лента Гипер');

    const names = Object.fromEntries(
      await Promise.all(
        Object.entries(runs).map(async ([status, id]) => [
          status,
          (await prisma.storeRun.findUniqueOrThrow({ where: { id } })).storeName,
        ]),
      ),
    );
    expect(names).toEqual({
      COLLECTING: 'Лента Гипер',
      SHOPPING: 'Лента Гипер',
      SETTLED: 'Лента',
      CANCELLED: 'Лента',
    });
  });

  it('занятое в группе имя в другом написании — 409, магазин не изменился', async () => {
    const lenta = await store(world.groupA, 'Лента');
    await store(world.groupA, 'Пятёрочка');

    const response = await call('patch', `/api/groups/${world.groupA}/stores/${lenta.id}`, 'maria', {
      name: 'пятерочка',
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('STORE_EXISTS');
    expect((await prisma.groupStore.findUniqueOrThrow({ where: { id: lenta.id } })).name).toBe('Лента');
  });

  it('поправить написание того же имени можно', async () => {
    const shop = await store(world.groupA, 'пятерочка');

    await call('patch', `/api/groups/${world.groupA}/stores/${shop.id}`, 'maria', { name: 'Пятёрочка' }).expect(200);

    expect((await prisma.groupStore.findUniqueOrThrow({ where: { id: shop.id } })).name).toBe('Пятёрочка');
  });

  it.each<[string, object, string]>([
    ['пустое имя', { name: '' }, 'VALIDATION_ERROR'],
    ['имя длиннее 100', { name: 'м'.repeat(101) }, 'VALIDATION_ERROR'],
    ['имя не строкой', { name: 42 }, 'VALIDATION_ERROR'],
    // Схема пропускает пробелы, их отклоняет сервис.
    ['имя из одних пробелов', { name: '   ' }, 'INVALID_INPUT'],
  ])('%s — 400, магазин не изменился', async (_label, body, code) => {
    const lenta = await store(world.groupA, 'Лента');

    const response = await call('patch', `/api/groups/${world.groupA}/stores/${lenta.id}`, 'maria', body);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(code);
    expect((await prisma.groupStore.findUniqueOrThrow({ where: { id: lenta.id } })).name).toBe('Лента');
  });

  it.each<[string, Who]>([
    ['посторонний', 'stranger'],
    ['вышедшая из группы', 'olga'],
  ])('%s переименовать не может', async (_label, who) => {
    const lenta = await store(world.groupA, 'Лента');

    const response = await call('patch', `/api/groups/${world.groupA}/stores/${lenta.id}`, who, { name: 'Чужое' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect((await prisma.groupStore.findUniqueOrThrow({ where: { id: lenta.id } })).name).toBe('Лента');
  });

  it('несуществующий магазин — 404', async () => {
    const response = await call('patch', `/api/groups/${world.groupA}/stores/987654`, 'maria', { name: 'Лента' });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});

describe('справочник магазинов: скрытие', () => {
  it('магазин пропадает из подсказок, забеги не меняются, повтор ничего не сдвигает', async () => {
    const lenta = await store(world.groupA, 'Лента');
    const run = await prisma.storeRun.create({
      data: {
        groupId: world.groupA,
        initiatorId: world.id.ivan,
        storeId: lenta.id,
        storeName: 'Лента',
        status: 'SETTLED',
        collectUntil: new Date(),
      },
    });

    await call('delete', `/api/groups/${world.groupA}/stores/${lenta.id}`, 'maria').expect(200);
    const archivedAt = (await prisma.groupStore.findUniqueOrThrow({ where: { id: lenta.id } })).archivedAt;
    expect(archivedAt).not.toBeNull();

    const list = await call('get', `/api/groups/${world.groupA}/stores`, 'maria').expect(200);
    expect(list.body.data).toEqual([]);
    const after = await prisma.storeRun.findUniqueOrThrow({ where: { id: run.id } });
    expect([after.storeId, after.storeName]).toEqual([lenta.id, 'Лента']);

    // Повторное скрытие — успех без сдвига момента архивации.
    await call('delete', `/api/groups/${world.groupA}/stores/${lenta.id}`, 'maria').expect(200);
    expect((await prisma.groupStore.findUniqueOrThrow({ where: { id: lenta.id } })).archivedAt).toEqual(archivedAt);
  });

  it('посторонний скрыть не может', async () => {
    const lenta = await store(world.groupA, 'Лента');

    const response = await call('delete', `/api/groups/${world.groupA}/stores/${lenta.id}`, 'stranger');

    expect(response.status).toBe(403);
    expect((await prisma.groupStore.findUniqueOrThrow({ where: { id: lenta.id } })).archivedAt).toBeNull();
  });
});

describe('личный список товаров', () => {
  async function preset(who: Who, name: string, extra: { pinned?: boolean; lastUsedAt?: Date } = {}) {
    return prisma.userItemPreset.create({
      data: { userId: world.id[who], name, normalizedName: name.toLowerCase(), ...extra },
    });
  }

  async function names(who: Who, query: Record<string, string | number> = {}) {
    const response = await call('get', '/api/user/item-presets', who).query(query).expect(200);
    return response.body.data.map((p: { name: string }) => p.name) as string[];
  }

  /* Порядок ярусов: закреплённое → брал в этом магазине → брал в этой группе →
     по свежести. Возраст записей подобран так, что одна свежесть дала бы
     обратный порядок. */
  it('ранжирует: закреплённое, этот магазин, эта группа, остальное', async () => {
    const lenta = await store(world.groupA, 'Лента');
    const ashan = await store(world.groupA, 'Ашан');
    await preset('maria', 'Кофе', { pinned: true, lastUsedAt: daysAgo(30) });
    await preset('maria', 'Сыр', { lastUsedAt: daysAgo(20) });
    await preset('maria', 'Хлеб', { lastUsedAt: daysAgo(10) });
    await preset('maria', 'Вода', { lastUsedAt: daysAgo(1) });
    for (const [storeId, item] of [[lenta.id, 'Сыр'], [ashan.id, 'Хлеб']] as const) {
      const run = await prisma.storeRun.create({
        data: {
          groupId: world.groupA,
          initiatorId: world.id.ivan,
          storeId,
          storeName: 'x',
          status: 'SETTLED',
          collectUntil: new Date(),
        },
      });
      await prisma.storeItem.create({ data: { storeRunId: run.id, userId: world.id.maria, name: item } });
    }

    expect(await names('maria', { storeId: lenta.id, groupId: world.groupA })).toEqual(['Кофе', 'Сыр', 'Хлеб', 'Вода']);
    // Без магазина ярус группы один: оба взятых в группе выше невзятого, между собой — по свежести.
    expect(await names('maria', { groupId: world.groupA })).toEqual(['Кофе', 'Хлеб', 'Сыр', 'Вода']);
    expect(await names('maria')).toEqual(['Кофе', 'Вода', 'Хлеб', 'Сыр']);
    // Пустой storeId из формы не превращается в магазин с id 0 и не ломает список.
    expect(await names('maria', { storeId: '' })).toEqual(['Кофе', 'Вода', 'Хлеб', 'Сыр']);
  });

  /* Раньше отсечка по свежести шла ДО ранжирования, и давний закреплённый
     товар за пределами полусотни свежих не доезжал до списка вовсе. */
  it('давний закреплённый виден, даже когда свежих больше полусотни', async () => {
    await prisma.userItemPreset.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        userId: world.id.maria,
        name: `Товар ${i}`,
        normalizedName: `товар ${i}`,
        lastUsedAt: daysAgo(i + 1),
      })),
    });
    await preset('maria', 'Кофе', { pinned: true, lastUsedAt: daysAgo(400) });

    expect((await names('maria'))[0]).toBe('Кофе');
  });

  it('чужие пресеты не видны', async () => {
    await preset('ivan', 'Кофе');

    expect(await names('maria')).toEqual([]);
  });

  it('свой пресет закрепляется', async () => {
    const coffee = await preset('maria', 'Кофе');

    await call('patch', `/api/user/item-presets/${coffee.id}`, 'maria', { pinned: true }).expect(200);

    expect((await prisma.userItemPreset.findUniqueOrThrow({ where: { id: coffee.id } })).pinned).toBe(true);
  });

  it('переименование пересчитывает ключ, по которому склеиваются написания', async () => {
    const cheese = await preset('maria', 'Сыр');

    await call('patch', `/api/user/item-presets/${cheese.id}`, 'maria', { name: '  Сыр  Российский ' }).expect(200);

    const after = await prisma.userItemPreset.findUniqueOrThrow({ where: { id: cheese.id } });
    expect(after.name).toBe('Сыр  Российский');
    expect(after.normalizedName).toBe('сыр российский');
  });

  it('свой пресет удаляется насовсем', async () => {
    const coffee = await preset('maria', 'Кофе');

    await call('delete', `/api/user/item-presets/${coffee.id}`, 'maria').expect(200);

    expect(await prisma.userItemPreset.count({ where: { id: coffee.id } })).toBe(0);
  });

  /* Чужой пресет отвечает 404, а не 403: подтверждать существование чужой
     записи по id незачем. */
  it.each<[string, 'patch' | 'delete', object?]>([
    ['правка', 'patch', { pinned: true }],
    ['удаление', 'delete', undefined],
  ])('%s чужого пресета — 404, запись не тронута', async (_label, method, body) => {
    const coffee = await preset('ivan', 'Кофе');

    const response = await call(method, `/api/user/item-presets/${coffee.id}`, 'maria', body);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
    expect(await prisma.userItemPreset.findUniqueOrThrow({ where: { id: coffee.id } })).toMatchObject({
      pinned: false,
      name: 'Кофе',
    });
  });

  it.each<[string, object, string]>([
    ['количество 0', { quantity: 0 }, 'VALIDATION_ERROR'],
    ['количество 100', { quantity: 100 }, 'VALIDATION_ERROR'],
    ['имя длиннее 200', { name: 'м'.repeat(201) }, 'VALIDATION_ERROR'],
    ['заметка длиннее 500', { notes: 'з'.repeat(501) }, 'VALIDATION_ERROR'],
    ['pinned строкой', { pinned: 'yes' }, 'VALIDATION_ERROR'],
    ['имя из одних пробелов', { name: '   ' }, 'INVALID_INPUT'],
  ])('%s — 400, пресет не изменился', async (_label, body, code) => {
    const coffee = await preset('maria', 'Кофе');

    const response = await call('patch', `/api/user/item-presets/${coffee.id}`, 'maria', body);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(code);
    expect(await prisma.userItemPreset.findUniqueOrThrow({ where: { id: coffee.id } })).toMatchObject({
      name: 'Кофе',
      quantity: 1,
      notes: null,
      pinned: false,
    });
  });

  // BUG: переименование в имя другого своего пресета падает на уникальном индексе (userId, normalizedName) и отвечает 500 вместо отказа 4xx.
  it.failing('переименование в имя другого своего пресета — отказ клиенту, а не 500', async () => {
    await preset('maria', 'Кофе');
    const tea = await preset('maria', 'Чай');

    const response = await call('patch', `/api/user/item-presets/${tea.id}`, 'maria', { name: 'КОФЕ' });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect((await prisma.userItemPreset.findUniqueOrThrow({ where: { id: tea.id } })).name).toBe('Чай');
  });
});
