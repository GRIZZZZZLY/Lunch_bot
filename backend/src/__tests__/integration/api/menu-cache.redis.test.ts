/* Лимитер выключен до загрузки приложения — см. menu.routes.test.ts. */
process.env.ENABLE_RATE_LIMIT = 'false';

/**
 * Активное меню группы кэшируется в Redis на минуты. Ошибка в ключе или в
 * сбросе кэша не видна без настоящего Redis: без него каждый запрос идёт в
 * базу, и всё выглядит правильно. Поэтому файл собирается только при
 * REDIS_ENABLED=true (см. `testPathIgnorePatterns` в jest.config.js).
 *
 * Риски:
 * 1. Меню группы A, лежащее в кэше, не отдаётся группе B — и наоборот.
 * 2. Изменение меню через API видно сразу, а не после истечения кэша:
 *    выключенное блюдо не должно попадать в новое голосование.
 * 3. Тёплый кэш не обходит проверку членства.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { cacheService } from '../../../services/cache.service';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { tokenFor } from '../helpers/api';

let app: ReturnType<typeof createTestApp>;

const ANNA = 700001101;
const VERA = 700001102;

interface World {
  groupA: number;
  groupB: number;
  soupA: number;
}

/** Анна — создатель обеих групп, Вера — только участник A. */
async function buildWorld(): Promise<World> {
  const anna = await prisma.user.create({ data: { telegramId: BigInt(ANNA), firstName: 'Анна' } });
  const vera = await prisma.user.create({ data: { telegramId: BigInt(VERA), firstName: 'Вера' } });
  const groupA = await prisma.group.create({
    data: { telegramId: BigInt(-100000001101), title: 'Команда А' },
  });
  const groupB = await prisma.group.create({
    data: { telegramId: BigInt(-100000001102), title: 'Команда Б' },
  });
  await prisma.groupMember.createMany({
    data: [
      { groupId: groupA.id, userId: anna.id, role: 'CREATOR' },
      { groupId: groupA.id, userId: vera.id, role: 'MEMBER' },
      { groupId: groupB.id, userId: anna.id, role: 'CREATOR' },
    ],
  });
  const soupA = await prisma.menuItem.create({
    data: { name: 'Суп куриный', price: 250.5, groupId: groupA.id, createdBy: anna.id },
  });
  await prisma.menuItem.create({
    data: { name: 'Суп рыбный', price: 900, groupId: groupB.id, createdBy: anna.id },
  });
  return { groupA: groupA.id, groupB: groupB.id, soupA: soupA.id };
}

let w: World;
let annaAuth: string;

async function activeMenu(groupId: number, auth = annaAuth) {
  return request(app).get(`/api/menu/active?groupId=${groupId}`).set('Authorization', auth);
}

const menuOf = (res: request.Response) =>
  (res.body.data as Array<{ name: string; price: number }>)
    .map(item => [item.name, item.price])
    .sort();

beforeAll(async () => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
  /* Клиент Redis подключается асинхронно. Пока он не готов, кэш молча
     выключен — и набор проверял бы базу, а не кэш. */
  for (let i = 0; i < 50 && !(await cacheService.healthCheck()); i += 1) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  expect(await cacheService.healthCheck()).toBe(true);
});

beforeEach(async () => {
  await cleanDatabase();
  await cacheService.flush();
  w = await buildWorld();
  annaAuth = `Bearer ${await tokenFor(app, ANNA)}`;
});

afterAll(async () => {
  await cleanDatabase();
  await cacheService.flush();
  await prisma.$disconnect();
});

describe('кэш активного меню', () => {
  it('меню одной группы из кэша не попадает в другую', async () => {
    // Второй круг читается уже из кэша — цена там JSON-строкой, а не Decimal.
    for (let round = 0; round < 2; round += 1) {
      expect(menuOf(await activeMenu(w.groupA))).toEqual([['Суп куриный', 250.5]]);
      expect(menuOf(await activeMenu(w.groupB))).toEqual([['Суп рыбный', 900]]);
    }
  });

  it('изменение меню через API видно сразу, соседняя группа не задета', async () => {
    const send = (method: 'post' | 'patch' | 'delete', url: string, body: object) =>
      request(app)[method](url).set('Authorization', annaAuth).send(body);
    const namesA = async () => menuOf(await activeMenu(w.groupA)).map(([name]) => name);

    expect(await namesA()).toEqual(['Суп куриный']);
    await activeMenu(w.groupB);

    const created = await send('post', '/api/menu', { name: 'Плов', price: 180, groupIds: [w.groupA] });
    expect(created.status).toBe(201);
    const plov = created.body.data[0].id as number;
    expect(await namesA()).toEqual(['Плов', 'Суп куриный']);

    await send('patch', `/api/menu/${plov}/toggle`, { groupId: w.groupA }).expect(200);
    expect(await namesA()).toEqual(['Суп куриный']);

    await send('patch', '/api/menu/bulk-status', { groupId: w.groupA, ids: [plov], isActive: true }).expect(200);
    expect(await namesA()).toEqual(['Плов', 'Суп куриный']);

    await send('delete', `/api/menu/${w.soupA}`, { groupId: w.groupA }).expect(200);
    expect(await namesA()).toEqual(['Плов']);

    expect(menuOf(await activeMenu(w.groupB))).toEqual([['Суп рыбный', 900]]);
  });

  it('тёплый кэш не пускает постороннего', async () => {
    expect((await activeMenu(w.groupB)).status).toBe(200);

    const vera = `Bearer ${await tokenFor(app, VERA)}`;
    const res = await activeMenu(w.groupB, vera);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_MEMBER');
  });
});
