/**
 * Магазинные забеги («иду в магазин») через НАСТОЯЩИЙ API: express, PostgreSQL,
 * Prisma, Redis.
 *
 * Забег — это деньги: по его итогу участники становятся должниками
 * инициатора. До этого файла весь путь от HTTP до строки долга проверялся
 * только на подставной БД, где права, статусы и суммы задавал сам тест.
 * Здесь проверяется исход: ответ, код ошибки и то, что лежит в таблицах.
 *
 * Telegram — единственная внешняя граница, и он подменяется через
 * `setBotInstance` (как в `budget-lifecycle.redis.test.ts`): создание забега
 * спрашивает у Telegram, состоит ли бот в группе, а рассылки идут в стороне от
 * ответа.
 *
 * ОКРУЖЕНИЕ. Изменяющие маршруты забега объявлены с идемпотентностью
 * `required: true`, без Redis они отвечают 503 — поэтому файл `.redis.test.ts`.
 *
 *   REDIS_ENABLED=true REDIS_URL=redis://127.0.0.1:6379/0 \
 *   ENABLE_RATE_LIMIT=false npm test -- <этот файл>
 */
import request from 'supertest';
import { Prisma } from '@prisma/client';

import { prisma } from '../../../database/client';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { addMember, idemKey, tokenFor } from '../helpers/api';
import { setBotInstance } from '../../../bot/bot-instance';
import { StoreRunBudgetService } from '../../../services/store-run-budget.service';

/* Приложение поднимается лениво: без Redis файл не собирается вовсе
   (testPathIgnorePatterns), и создавать express незачем. */
let app: ReturnType<typeof createTestApp>;

const TG = {
  ivan: 700000301,
  maria: 700000302,
  petr: 700000303,
  olga: 700000304,
  stranger: 700000305,
  quiet: 700000306,
} as const;
type Who = keyof typeof TG;

const GROUP_A_CHAT = -1000000000301;
const GROUP_B_CHAT = -1000000000302;

type RunStatus = 'COLLECTING' | 'SHOPPING' | 'SETTLED' | 'CANCELLED';
type Method = 'get' | 'post' | 'patch' | 'delete';

interface World {
  id: Record<Who, number>;
  groupA: number;
  groupB: number;
}

/**
 * Команда А: Иван (инициатор забегов), Мария и Пётр — участники, Ольга из
 * группы вышла, Тихон в группе, но отказался от рассылок. Команда Б: чужой
 * человек и Мария — без второй команды нельзя проверить, что выбранная
 * команда сужает выборку.
 */
async function buildWorld(): Promise<World> {
  const id = {} as Record<Who, number>;
  for (const [who, telegramId] of Object.entries(TG) as Array<[Who, number]>) {
    const user = await prisma.user.create({
      data: { telegramId: BigInt(telegramId), firstName: who },
    });
    id[who] = user.id;
  }

  const groupA = await prisma.group.create({
    data: { telegramId: BigInt(GROUP_A_CHAT), title: 'Команда А' },
  });
  const groupB = await prisma.group.create({
    data: { telegramId: BigInt(GROUP_B_CHAT), title: 'Команда Б' },
  });

  await addMember(groupA.id, id.ivan, 'CREATOR');
  await addMember(groupA.id, id.maria);
  await addMember(groupA.id, id.petr);
  await addMember(groupA.id, id.olga, 'MEMBER', { isActive: false, leftAt: new Date() });
  await addMember(groupA.id, id.quiet, 'MEMBER', { participatesInPolls: false });
  await addMember(groupB.id, id.stranger, 'CREATOR');
  await addMember(groupB.id, id.maria);

  return { id, groupA: groupA.id, groupB: groupB.id };
}

interface FakeBot {
  sent: Array<{ chatId: number; messageId: number }>;
  deleted: Array<[number, number]>;
  edited: Array<[number, number]>;
}

/**
 * Поддельный Telegram. Запоминает, кому что ушло, и ничего не знает о тексте:
 * тексты сообщений здесь не проверяются.
 *
 * `inGroup: false` — бота выгнали из группы. `sendingFails` — Telegram
 * принимает запросы о членстве, но отправка, удаление и правка падают.
 */
function installBot(opts: { inGroup?: boolean; sendingFails?: boolean } = {}): FakeBot {
  const log: FakeBot = { sent: [], deleted: [], edited: [] };
  let nextMessageId = 5000;
  const down = (): never => {
    throw Object.assign(new Error('Bad Gateway'), { error_code: 502 });
  };
  setBotInstance({
    botInfo: { id: 1 },
    api: {
      getChatMember: async () => ({ status: opts.inGroup === false ? 'left' : 'member' }),
      sendMessage: async (chatId: number) => {
        if (opts.sendingFails) down();
        const messageId = nextMessageId++;
        log.sent.push({ chatId, messageId });
        return { message_id: messageId };
      },
      deleteMessage: async (chatId: number, messageId: number) => {
        if (opts.sendingFails) down();
        log.deleted.push([chatId, messageId]);
        return true;
      },
      editMessageText: async (chatId: number, messageId: number) => {
        if (opts.sendingFails) down();
        log.edited.push([chatId, messageId]);
        return true;
      },
    },
  } as unknown as Parameters<typeof setBotInstance>[0]);
  return log;
}

let world: World;
let token: Record<Who, string>;

function call(method: Method, path: string, who: Who, body?: object): request.Test {
  let req = request(app)[method](path).set('Authorization', `Bearer ${token[who]}`);
  if (method !== 'get') req = req.set('Idempotency-Key', idemKey(method));
  return body === undefined ? req : req.send(body);
}

const runPath = (runId: number) => `/api/store-runs/${runId}`;
const itemPath = (s: Seeded) => `/api/store-runs/${s.runId}/items/${s.itemId}`;

interface Seeded {
  runId: number;
  itemId: number;
}

/**
 * Забег Ивана в команде А в нужном состоянии, с позицией Марии. С покупки
 * позиция куплена за 100, после расчёта по ней есть долг.
 *
 * Состояния засеваются напрямую: таблицы прав и статусов проверяют отказ в
 * КОНКРЕТНОМ состоянии, а не путь к нему — путь целиком проходит тест
 * жизненного цикла.
 */
async function seedRun(status: RunStatus, groupMessageId?: number): Promise<Seeded> {
  const run = await prisma.storeRun.create({
    data: {
      groupId: world.groupA,
      initiatorId: world.id.ivan,
      storeName: 'Лента',
      status,
      collectUntil: new Date(Date.now() + 20 * 60_000),
      ...(status === 'COLLECTING' ? {} : { shoppingAt: new Date() }),
      ...(groupMessageId ? { groupMessageId } : {}),
    },
  });
  const bought = status === 'SHOPPING' || status === 'SETTLED';
  const item = await prisma.storeItem.create({
    data: {
      storeRunId: run.id,
      userId: world.id.maria,
      name: 'Молоко',
      ...(bought ? { status: 'BOUGHT', price: new Prisma.Decimal(100) } : {}),
    },
  });
  if (status === 'SETTLED') {
    await prisma.transaction.create({
      data: {
        storeRunId: run.id,
        storeItemId: item.id,
        fromUserId: world.id.maria,
        toUserId: world.id.ivan,
        amount: 100,
        itemPrice: 100,
        status: 'PENDING',
      },
    });
  }
  return { runId: run.id, itemId: item.id };
}

/** Всё, что может испортить отказанный запрос: забеги, позиции, долги. */
async function snapshot(): Promise<string> {
  const [runs, items, debts] = await Promise.all([
    prisma.storeRun.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, status: true, storeName: true, initiatorId: true },
    }),
    prisma.storeItem.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, userId: true, name: true, quantity: true, notes: true, price: true, status: true },
    }),
    prisma.transaction.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, fromUserId: true, amount: true, status: true },
    }),
  ]);
  return JSON.stringify({ runs, items, debts });
}

async function runStatus(runId: number): Promise<string> {
  const run = await prisma.storeRun.findUniqueOrThrow({ where: { id: runId } });
  return run.status;
}

/** Долги забега в виде «позиция → должник и сумма». */
async function debtsOf(runId: number) {
  const rows = await prisma.transaction.findMany({
    where: { storeRunId: runId },
    include: { storeItem: true },
  });
  return Object.fromEntries(
    rows.map(row => [
      row.storeItem!.name,
      { from: row.fromUserId, to: row.toUserId, amount: Number(row.amount), status: row.status },
    ]),
  );
}

async function itemId(runId: number, name: string): Promise<number> {
  const item = await prisma.storeItem.findFirstOrThrow({ where: { storeRunId: runId, name } });
  return item.id;
}

/** Дождаться побочного действия, которое идёт в стороне от ответа. */
async function eventually(check: () => Promise<boolean> | boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('condition was not met in time');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  installBot();
  world = await buildWorld();
  token = {} as Record<Who, string>;
  for (const [who, telegramId] of Object.entries(TG) as Array<[Who, number]>) {
    token[who] = await tokenFor(app, telegramId);
  }
});

/* Рассылки идут в стороне от ответа. Пауза не даёт хвосту прошлого теста
   отправить сообщение через бота следующего и испортить его подсчёт. */
afterEach(() => sleep(60));

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('полный цикл: сбор → закупка → расчёт', () => {
  it('долги возникают только за купленное чужое, на цену строки, в пользу инициатора', async () => {
    const created = await call('post', '/api/store-runs', 'ivan', {
      groupId: world.groupA,
      storeName: 'Лента',
      collectMinutes: 20,
    }).expect(201);
    expect(created.body.data.status).toBe('COLLECTING');
    const runId: number = created.body.data.id;

    await call('post', `${runPath(runId)}/items`, 'maria', {
      items: [{ name: 'Молоко', quantity: 2 }, { name: 'Хлеб' }],
    }).expect(201);
    await call('post', `${runPath(runId)}/items`, 'petr', {
      items: [{ name: 'Сыр' }, { name: 'Икра' }],
    }).expect(201);
    await call('post', `${runPath(runId)}/items`, 'ivan', {
      items: [{ name: 'Кофе' }],
    }).expect(201);

    const started = await call('post', `${runPath(runId)}/start-shopping`, 'ivan').expect(200);
    expect(started.body.data.status).toBe('SHOPPING');

    const prices: Array<[string, number | null, 'BOUGHT' | 'NOT_FOUND']> = [
      ['Молоко', 180, 'BOUGHT'],
      ['Хлеб', 45.5, 'BOUGHT'],
      ['Сыр', 320, 'BOUGHT'],
      // Цена у ненайденного не хранится, даже если её прислали.
      ['Икра', 999, 'NOT_FOUND'],
      ['Кофе', 400, 'BOUGHT'],
    ];
    for (const [name, price, status] of prices) {
      const id = await itemId(runId, name);
      await call('post', `${runPath(runId)}/items/${id}/price`, 'ivan', { price, status }).expect(200);
    }

    const settled = await call('post', `${runPath(runId)}/settle`, 'ivan').expect(200);
    expect(settled.body.data.status).toBe('SETTLED');
    expect(await runStatus(runId)).toBe('SETTLED');

    /* Цена — за всю строку: «Молоко ×2» за 180 стоит 180, а не 360. Кофе
       купил сам инициатор, Икру не нашли — ни то, ни другое не долг. */
    const { ivan, maria, petr } = world.id;
    expect(await debtsOf(runId)).toEqual({
      Молоко: { from: maria, to: ivan, amount: 180, status: 'PENDING' },
      Хлеб: { from: maria, to: ivan, amount: 45.5, status: 'PENDING' },
      Сыр: { from: petr, to: ivan, amount: 320, status: 'PENDING' },
    });

    const caviar = await prisma.storeItem.findUniqueOrThrow({ where: { id: await itemId(runId, 'Икра') } });
    expect(caviar.status).toBe('NOT_FOUND');
    expect(caviar.price).toBeNull();
  });

  it('участник видит забег целиком, включая чужие позиции', async () => {
    const seeded = await seedRun('COLLECTING');
    await call('post', `${runPath(seeded.runId)}/items`, 'petr', { items: [{ name: 'Сыр' }] }).expect(201);

    const response = await call('get', runPath(seeded.runId), 'maria').expect(200);

    expect(response.body.data.items.map((i: { name: string }) => i.name).sort()).toEqual(['Молоко', 'Сыр']);
  });
});

describe('расчёт: деньги не теряются и не удваиваются', () => {
  /* Главное денежное правило: купленное без цены в деньги не попадает, и
     молча закрыть забег значило бы потерять чужую позицию. */
  it('купленное без цены закрыть не даёт: забег остаётся в закупке, долгов нет', async () => {
    const seeded = await seedRun('SHOPPING');
    const unpriced = await prisma.storeItem.create({
      data: { storeRunId: seeded.runId, userId: world.id.petr, name: 'Сыр', status: 'BOUGHT' },
    });

    const refused = await call('post', `${runPath(seeded.runId)}/settle`, 'ivan');
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('INVALID_INPUT');
    expect(await runStatus(seeded.runId)).toBe('SHOPPING');
    expect(await prisma.transaction.count()).toBe(0);

    // Цену внесли — тот же забег закрывается, и учитываются обе позиции.
    await call('post', `${runPath(seeded.runId)}/items/${unpriced.id}/price`, 'ivan', {
      price: 50,
      status: 'BOUGHT',
    }).expect(200);
    await call('post', `${runPath(seeded.runId)}/settle`, 'ivan').expect(200);

    expect(await debtsOf(seeded.runId)).toEqual({
      Молоко: { from: world.id.maria, to: world.id.ivan, amount: 100, status: 'PENDING' },
      Сыр: { from: world.id.petr, to: world.id.ivan, amount: 50, status: 'PENDING' },
    });
  });

  it('повторный расчёт отклоняется и долгов не добавляет', async () => {
    const seeded = await seedRun('SHOPPING');
    await call('post', `${runPath(seeded.runId)}/settle`, 'ivan').expect(200);

    const again = await call('post', `${runPath(seeded.runId)}/settle`, 'ivan');

    expect(again.status).toBe(409);
    expect(again.body.code).toBe('WRONG_STATUS');
    expect(await prisma.transaction.count({ where: { storeRunId: seeded.runId } })).toBe(1);
  });

  /* Двойной тап «завершить» с двух вкладок: разные ключи идемпотентности,
     значит защищает только условный переход статуса в БД. */
  it('два одновременных расчёта дают один комплект долгов', async () => {
    const seeded = await seedRun('SHOPPING');

    const responses = await Promise.all([
      call('post', `${runPath(seeded.runId)}/settle`, 'ivan'),
      call('post', `${runPath(seeded.runId)}/settle`, 'ivan'),
    ]);

    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.transaction.count({ where: { storeRunId: seeded.runId } })).toBe(1);
  });

  it('два одновременных старта закупки дают один переход', async () => {
    const seeded = await seedRun('COLLECTING');

    const responses = await Promise.all([
      call('post', `${runPath(seeded.runId)}/start-shopping`, 'ivan'),
      call('post', `${runPath(seeded.runId)}/start-shopping`, 'ivan'),
    ]);

    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await runStatus(seeded.runId)).toBe('SHOPPING');
  });

  /* Переход в SETTLED и создание долгов — одна транзакция БД. Если их
     разнести, сбой на долгах оставит закрытый забег, по которому никто ничего
     не должен, а повторить расчёт будет уже нельзя. Настоящую ошибку БД
     внутри расчёта снаружи не вызвать, поэтому сбой подделан: долги
     НАСТОЯЩИМ кодом записываются, и только потом летит ошибка — откат обязан
     унести и их. */
  it('сбой при создании долгов оставляет забег в закупке и без долгов', async () => {
    const seeded = await seedRun('SHOPPING');
    const real = StoreRunBudgetService.createTransactionsForStoreRun.bind(StoreRunBudgetService);
    const failure = jest
      .spyOn(StoreRunBudgetService, 'createTransactionsForStoreRun')
      .mockImplementationOnce(async (runId, db) => {
        await real(runId, db);
        throw new Error('database went away');
      });

    try {
      const response = await call('post', `${runPath(seeded.runId)}/settle`, 'ivan');
      expect(response.status).toBe(500);
    } finally {
      failure.mockRestore();
    }

    expect(await runStatus(seeded.runId)).toBe('SHOPPING');
    expect(await prisma.transaction.count()).toBe(0);
  });
});

describe('цены и отметки покупки', () => {
  it.each<[string, { price: number | null; status: 'BOUGHT' | 'NOT_FOUND' }, string, string | null]>([
    ['куплено с ценой', { price: 180, status: 'BOUGHT' }, 'BOUGHT', '180'],
    // Отметка одним касанием в магазине, цену вносят потом по чеку.
    ['куплено без цены', { price: null, status: 'BOUGHT' }, 'BOUGHT', null],
    ['бесплатно', { price: 0, status: 'BOUGHT' }, 'BOUGHT', '0'],
    ['не нашли, хотя цену прислали', { price: 50, status: 'NOT_FOUND' }, 'NOT_FOUND', null],
  ])('%s', async (_label, body, expectedStatus, expectedPrice) => {
    const seeded = await seedRun('SHOPPING');

    await call('post', `${itemPath(seeded)}/price`, 'ivan', body).expect(200);

    const item = await prisma.storeItem.findUniqueOrThrow({ where: { id: seeded.itemId } });
    expect(item.status).toBe(expectedStatus);
    expect(item.price === null ? null : item.price.toString()).toBe(expectedPrice);
  });

  it('до расчёта цену можно поправить', async () => {
    const seeded = await seedRun('SHOPPING');

    await call('post', `${itemPath(seeded)}/price`, 'ivan', { price: 90, status: 'BOUGHT' }).expect(200);
    await call('post', `${runPath(seeded.runId)}/settle`, 'ivan').expect(200);

    expect((await debtsOf(seeded.runId)).Молоко.amount).toBe(90);
  });
});

describe('создание забега', () => {
  it('инициатор берётся из токена, а окно сбора считается от текущего момента', async () => {
    const before = Date.now();
    const response = await call('post', '/api/store-runs', 'ivan', {
      groupId: world.groupA,
      storeName: 'Лента',
      collectMinutes: 20,
      // Подложенный в тело инициатор ничего не меняет.
      initiatorId: world.id.maria,
    }).expect(201);

    const run = await prisma.storeRun.findUniqueOrThrow({ where: { id: response.body.data.id } });
    expect(run.initiatorId).toBe(world.id.ivan);
    expect(run.status).toBe('COLLECTING');
    const window = run.collectUntil.getTime() - before;
    expect(window).toBeGreaterThanOrEqual(20 * 60_000 - 1000);
    expect(window).toBeLessThanOrEqual(20 * 60_000 + 5000);
  });

  it('второй активный забег того же человека не создаётся', async () => {
    await seedRun('SHOPPING');

    const response = await call('post', '/api/store-runs', 'ivan', {
      groupId: world.groupA,
      storeName: 'Ашан',
      collectMinutes: 10,
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ACTIVE_RUN_EXISTS');
    expect(await prisma.storeRun.count()).toBe(1);
  });

  /* Двойной тап «иду в магазин»: разные ключи идемпотентности, обе проверки
     «активного забега нет» проходят одновременно. Держит только уникальный
     индекс, и его отказ должен стать 409, а не 500. */
  it('два одновременных создания дают один забег', async () => {
    /* Магазин уже в справочнике: гонка за НОВЫЙ магазин — отдельный случай
       (см. «двое одновременно заводят один новый магазин»). */
    await prisma.groupStore.create({
      data: { groupId: world.groupA, createdById: world.id.ivan, name: 'Лента', normalizedName: 'лента' },
    });
    const body = { groupId: world.groupA, storeName: 'Лента', collectMinutes: 10 };

    const responses = await Promise.all([
      call('post', '/api/store-runs', 'ivan', body),
      call('post', '/api/store-runs', 'ivan', body),
    ]);

    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.storeRun.count()).toBe(1);
  });

  it('отменённый забег освобождает место для нового', async () => {
    const seeded = await seedRun('COLLECTING');
    const cancelled = await call('post', `${runPath(seeded.runId)}/cancel`, 'ivan').expect(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(await runStatus(seeded.runId)).toBe('CANCELLED');

    await call('post', '/api/store-runs', 'ivan', {
      groupId: world.groupA,
      storeName: 'Ашан',
      collectMinutes: 10,
    }).expect(201);
  });

  it.each<[string, Who]>([
    ['посторонний', 'stranger'],
    ['вышедшая из группы', 'olga'],
  ])('%s забег в группе не запускает', async (_label, who) => {
    const response = await call('post', '/api/store-runs', who, {
      groupId: world.groupA,
      storeName: 'Лента',
      collectMinutes: 10,
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(await prisma.storeRun.count()).toBe(0);
  });

  /* Без бота в группе приглашение не дойдёт до тех, кто не открывал бота
     лично, и забег никто не увидит. Отказ — до записи в БД. */
  it.each<[string, () => void]>([
    ['бота выгнали из группы', () => installBot({ inGroup: false })],
    ['бот не запущен', () => setBotInstance(null as unknown as Parameters<typeof setBotInstance>[0])],
  ])('%s — 409 BOT_NOT_IN_GROUP, забег и магазин не созданы', async (_label, arrange) => {
    arrange();

    const response = await call('post', '/api/store-runs', 'ivan', {
      groupId: world.groupA,
      storeName: 'Лента',
      collectMinutes: 10,
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('BOT_NOT_IN_GROUP');
    expect(await prisma.storeRun.count()).toBe(0);
    expect(await prisma.groupStore.count()).toBe(0);
  });
});

describe('справочник магазинов при создании забега', () => {
  it('введённое имя заводит магазин, а другое написание того же имени его находит', async () => {
    const first = await call('post', '/api/store-runs', 'ivan', {
      groupId: world.groupA,
      storeName: '  Пятёрочка  ',
      collectMinutes: 10,
    }).expect(201);
    expect(first.body.data.storeName).toBe('Пятёрочка');

    /* «пятерочка» без ё и в другом регистре — тот же магазин. Имя в
       справочнике при этом не переписывается: для этого есть переименование. */
    const second = await call('post', '/api/store-runs', 'maria', {
      groupId: world.groupA,
      storeName: 'ПЯТЕРОЧКА',
      collectMinutes: 10,
    }).expect(201);

    const stores = await prisma.groupStore.findMany({ where: { groupId: world.groupA } });
    expect(stores).toHaveLength(1);
    expect(stores[0].name).toBe('Пятёрочка');
    expect(stores[0].usageCount).toBe(2);
    expect(second.body.data.storeId).toBe(stores[0].id);
    expect(second.body.data.storeName).toBe('Пятёрочка');
  });

  /* Двое одновременно заводят один и тот же новый магазин (или один человек
     дважды тапнул «иду в магазин» с новым именем). Сервис ловит отказ
     уникального индекса и перечитывает строку соперника — но внутри уже
     прерванной транзакции PostgreSQL, и второй запрос получает 500. */
  // BUG: GroupStoreService.resolveForRun восстанавливается после P2002 запросом в прерванной транзакции (25P02) — второй забег падает с 500.
  it.failing('двое одновременно заводят один новый магазин — оба забега создаются на одной записи', async () => {
    const people: Who[] = ['ivan', 'maria'];
    /* Столкновение воспроизводится замком, а не удачей расписания: таблица
       справочника заперта на запись, оба запроса успевают убедиться, что
       магазина нет, и встают на вставке. Снятие замка отпускает их вместе. */
    const { requests } = await prisma.$transaction(
      async tx => {
        await tx.$executeRawUnsafe('LOCK TABLE group_stores IN SHARE MODE');
        const started = Promise.all(
          people.map(who =>
            call('post', '/api/store-runs', who, { groupId: world.groupA, storeName: 'Окей', collectMinutes: 10 }),
          ),
        );
        await eventually(async () => {
          const [{ waiting }] = await prisma.$queryRaw<Array<{ waiting: bigint }>>`
            SELECT count(*) AS waiting FROM pg_locks l JOIN pg_class c ON c.oid = l.relation
            WHERE c.relname = 'group_stores' AND NOT l.granted`;
          return Number(waiting) >= people.length;
        }, 10_000);
        // Обёртка: вернув сам промис, транзакция ждала бы ответов и не сняла бы замок.
        return { requests: started };
      },
      { timeout: 20_000 },
    );
    const responses = await requests;

    expect(responses.map(r => r.status)).toEqual([201, 201]);
    const stores = await prisma.groupStore.findMany({ where: { groupId: world.groupA } });
    expect(stores).toHaveLength(1);
    const runs = await prisma.storeRun.findMany();
    expect(runs.map(r => r.storeId)).toEqual(people.map(() => stores[0].id));
  });

  it('выбор из справочника даёт имя магазина', async () => {
    const store = await prisma.groupStore.create({
      data: { groupId: world.groupA, createdById: world.id.maria, name: 'Ашан', normalizedName: 'ашан' },
    });

    const response = await call('post', '/api/store-runs', 'ivan', {
      groupId: world.groupA,
      storeId: store.id,
      collectMinutes: 10,
    }).expect(201);

    expect(response.body.data.storeId).toBe(store.id);
    expect(response.body.data.storeName).toBe('Ашан');
  });

  /* Чужая группа и скрытый магазин отвечают одинаково: клиент работает по
     устаревшему списку, и для него это одно и то же «магазина нет». */
  it.each<[string, 'foreign' | 'archived']>([
    ['магазин чужой группы', 'foreign'],
    ['скрытый магазин', 'archived'],
  ])('%s — 404, забег не создан', async (_label, kind) => {
    const store = await prisma.groupStore.create({
      data: {
        groupId: kind === 'foreign' ? world.groupB : world.groupA,
        createdById: world.id.ivan,
        name: 'Магнит',
        normalizedName: 'магнит',
        ...(kind === 'archived' ? { archivedAt: new Date() } : {}),
      },
    });

    const response = await call('post', '/api/store-runs', 'ivan', {
      groupId: world.groupA,
      storeId: store.id,
      collectMinutes: 10,
    });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
    expect(await prisma.storeRun.count()).toBe(0);
  });

  it('скрытый магазин возвращается в список, если его имя ввели снова', async () => {
    const store = await prisma.groupStore.create({
      data: {
        groupId: world.groupA,
        createdById: world.id.ivan,
        name: 'Магнит',
        normalizedName: 'магнит',
        archivedAt: new Date(),
      },
    });

    const response = await call('post', '/api/store-runs', 'ivan', {
      groupId: world.groupA,
      storeName: 'магнит',
      collectMinutes: 10,
    }).expect(201);

    expect(response.body.data.storeId).toBe(store.id);
    const after = await prisma.groupStore.findUniqueOrThrow({ where: { id: store.id } });
    expect(after.archivedAt).toBeNull();
  });
});

describe('позиции', () => {
  it('годные позиции сохраняются с автором из токена, пустые отбрасываются', async () => {
    const seeded = await seedRun('COLLECTING');

    const response = await call('post', `${runPath(seeded.runId)}/items`, 'petr', {
      items: [
        { name: '  Сыр  ', quantity: 2, notes: '  тильзитер  ' },
        { name: '   ' },
        { name: 'Хлеб', notes: '   ' },
      ],
    }).expect(201);
    expect(response.body.data).toHaveLength(2);

    const items = await prisma.storeItem.findMany({
      where: { storeRunId: seeded.runId, userId: world.id.petr },
      orderBy: { id: 'asc' },
      select: { name: true, quantity: true, notes: true, status: true },
    });
    expect(items).toEqual([
      { name: 'Сыр', quantity: 2, notes: 'тильзитер', status: 'REQUESTED' },
      { name: 'Хлеб', quantity: 1, notes: null, status: 'REQUESTED' },
    ]);
  });

  it('правка меняет только переданное', async () => {
    const seeded = await seedRun('COLLECTING');
    await prisma.storeItem.update({ where: { id: seeded.itemId }, data: { notes: '2,5%' } });

    await call('patch', itemPath(seeded), 'maria', { quantity: 3 }).expect(200);

    const item = await prisma.storeItem.findUniqueOrThrow({ where: { id: seeded.itemId } });
    expect(item).toMatchObject({ name: 'Молоко', quantity: 3, notes: '2,5%' });
  });

  it.each<[string, string | null]>([
    ['null', null],
    ['строка из пробелов', '   '],
  ])('заметка стирается: %s', async (_label, notes) => {
    const seeded = await seedRun('COLLECTING');
    await prisma.storeItem.update({ where: { id: seeded.itemId }, data: { notes: '2,5%' } });

    await call('patch', itemPath(seeded), 'maria', { notes }).expect(200);

    expect((await prisma.storeItem.findUniqueOrThrow({ where: { id: seeded.itemId } })).notes).toBeNull();
  });

  it('свою позицию можно удалить до закупки', async () => {
    const seeded = await seedRun('COLLECTING');

    const response = await call('delete', itemPath(seeded), 'maria').expect(204);

    expect(response.body).toEqual({});
    expect(await prisma.storeItem.count({ where: { id: seeded.itemId } })).toBe(0);
  });
});

/**
 * Кто что может. Каждая строка — отказ 403 FORBIDDEN, и после него в БД не
 * изменилось ничего: ни статус забега, ни позиции, ни долги.
 */
describe('права', () => {
  type Row = [string, Who, RunStatus, Method, (s: Seeded) => string, object?];
  const rows: Row[] = [
    ['посторонний открывает забег', 'stranger', 'COLLECTING', 'get', s => runPath(s.runId)],
    ['вышедшая из группы открывает забег', 'olga', 'COLLECTING', 'get', s => runPath(s.runId)],
    ['посторонний добавляет позицию', 'stranger', 'COLLECTING', 'post', s => `${runPath(s.runId)}/items`, { items: [{ name: 'Хлеб' }] }],
    ['вышедшая из группы добавляет позицию', 'olga', 'COLLECTING', 'post', s => `${runPath(s.runId)}/items`, { items: [{ name: 'Хлеб' }] }],
    ['участник начинает закупку за инициатора', 'maria', 'COLLECTING', 'post', s => `${runPath(s.runId)}/start-shopping`],
    ['участник отменяет чужой забег', 'maria', 'COLLECTING', 'post', s => `${runPath(s.runId)}/cancel`],
    ['участник ставит цену', 'maria', 'SHOPPING', 'post', s => `${itemPath(s)}/price`, { price: 1, status: 'BOUGHT' }],
    ['участник закрывает забег', 'maria', 'SHOPPING', 'post', s => `${runPath(s.runId)}/settle`],
    ['посторонний закрывает забег', 'stranger', 'SHOPPING', 'post', s => `${runPath(s.runId)}/settle`],
    ['другой участник правит чужую позицию', 'petr', 'COLLECTING', 'patch', itemPath, { quantity: 5 }],
    // Инициатор отвечает за покупку, а не за чужой заказ.
    ['инициатор правит чужую позицию', 'ivan', 'COLLECTING', 'patch', itemPath, { quantity: 5 }],
    ['другой участник удаляет чужую позицию', 'petr', 'COLLECTING', 'delete', itemPath],
  ];

  /* Строки без тела короче функции: при обычном списке параметров jest принял
     бы лишний параметр за колбэк `done` и ждал бы его до тайм-аута. */
  it.each(rows)('%s — 403', async (...[, who, status, method, path, body]: Row) => {
    const seeded = await seedRun(status);
    const before = await snapshot();

    const response = await call(method, path(seeded), who, body);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(await snapshot()).toBe(before);
  });
});

/**
 * Действие не в своём состоянии: 409 WRONG_STATUS, БД не тронута.
 */
describe('статусы', () => {
  type Row = [string, RunStatus, Who, Method, (s: Seeded) => string, object?];
  const rows: Row[] = [
    ['позиция в забег, который уже в магазине', 'SHOPPING', 'petr', 'post', s => `${runPath(s.runId)}/items`, { items: [{ name: 'Хлеб' }] }],
    ['позиция в отменённый забег', 'CANCELLED', 'petr', 'post', s => `${runPath(s.runId)}/items`, { items: [{ name: 'Хлеб' }] }],
    ['правка своей позиции после начала закупки', 'SHOPPING', 'maria', 'patch', itemPath, { quantity: 3 }],
    ['удаление своей позиции после начала закупки', 'SHOPPING', 'maria', 'delete', itemPath],
    ['повторный старт закупки', 'SHOPPING', 'ivan', 'post', s => `${runPath(s.runId)}/start-shopping`],
    ['старт закупки отменённого забега', 'CANCELLED', 'ivan', 'post', s => `${runPath(s.runId)}/start-shopping`],
    // Деньги уже потрачены: отмена стёрла бы основание для долгов.
    ['отмена забега в закупке', 'SHOPPING', 'ivan', 'post', s => `${runPath(s.runId)}/cancel`],
    ['цена до начала закупки', 'COLLECTING', 'ivan', 'post', s => `${itemPath(s)}/price`, { price: 50, status: 'BOUGHT' }],
    // Долги уже посчитаны по старой цене.
    ['цена после расчёта', 'SETTLED', 'ivan', 'post', s => `${itemPath(s)}/price`, { price: 50, status: 'BOUGHT' }],
    ['расчёт до начала закупки', 'COLLECTING', 'ivan', 'post', s => `${runPath(s.runId)}/settle`],
    ['расчёт отменённого забега', 'CANCELLED', 'ivan', 'post', s => `${runPath(s.runId)}/settle`],
  ];

  it.each(rows)('%s — 409', async (...[, status, who, method, path, body]: Row) => {
    const seeded = await seedRun(status);
    const before = await snapshot();

    const response = await call(method, path(seeded), who, body);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('WRONG_STATUS');
    expect(await snapshot()).toBe(before);
  });
});

describe('несуществующие забег и позиция', () => {
  const MISSING = 987654;
  type Row = [string, Who, Method, string, object?];
  const rows: Row[] = [
    ['забег', 'maria', 'get', runPath(MISSING)],
    ['позиции в забег', 'maria', 'post', `${runPath(MISSING)}/items`, { items: [{ name: 'Хлеб' }] }],
    ['правка позиции', 'maria', 'patch', `${runPath(MISSING)}/items/${MISSING}`, { quantity: 2 }],
    ['удаление позиции', 'maria', 'delete', `${runPath(MISSING)}/items/${MISSING}`],
    ['цена позиции', 'ivan', 'post', `${runPath(MISSING)}/items/${MISSING}/price`, { price: 1, status: 'BOUGHT' }],
    ['старт закупки', 'ivan', 'post', `${runPath(MISSING)}/start-shopping`],
    ['расчёт', 'ivan', 'post', `${runPath(MISSING)}/settle`],
    ['отмена', 'ivan', 'post', `${runPath(MISSING)}/cancel`],
  ];

  it.each(rows)('%s — 404', async (...[, who, method, path, body]: Row) => {
    const response = await call(method, path, who, body);

    expect(response.status).toBe(404);
  });
});

/**
 * Границы входа: 400, БД не тронута. Форму тела отсекает схема
 * (VALIDATION_ERROR), строку из одних пробелов схема пропускает, и её
 * отклоняет сервис (INVALID_INPUT).
 *
 * Для тела забега ответ ещё и называет поле: раньше этот контроллер отвечал
 * `{ error, issues }` без `code`, и фронт не мог выбрать по ответу текст.
 */
describe('проверка входа', () => {
  type Row = [string, RunStatus, Method, (s: Seeded) => string, () => object, string, string?];
  const create = () => '/api/store-runs';
  const items = (s: Seeded) => `${runPath(s.runId)}/items`;
  const price = (s: Seeded) => `${itemPath(s)}/price`;
  const run = (over: object) => () => ({ groupId: world.groupA, storeName: 'Лента', collectMinutes: 10, ...over });
  const V = 'VALIDATION_ERROR';
  const rows: Row[] = [
    ['groupId строкой', 'CANCELLED', 'post', create, () => ({ groupId: String(world.groupA), storeName: 'Лента', collectMinutes: 10 }), V, 'groupId'],
    ['забег без магазина', 'CANCELLED', 'post', create, () => ({ groupId: world.groupA, collectMinutes: 10 }), V, 'storeName'],
    ['пустое имя магазина', 'CANCELLED', 'post', create, run({ storeName: '' }), V, 'storeName'],
    ['имя магазина длиннее 100', 'CANCELLED', 'post', create, run({ storeName: 'м'.repeat(101) }), V, 'storeName'],
    ['имя магазина из пробелов', 'CANCELLED', 'post', create, run({ storeName: '   ' }), 'INVALID_INPUT'],
    ['окно сбора короче 3 минут', 'CANCELLED', 'post', create, run({ collectMinutes: 2 }), V, 'collectMinutes'],
    ['окно сбора длиннее 30 минут', 'CANCELLED', 'post', create, run({ collectMinutes: 31 }), V, 'collectMinutes'],
    ['пустой список позиций', 'COLLECTING', 'post', items, () => ({ items: [] }), V],
    ['больше 20 позиций', 'COLLECTING', 'post', items, () => ({ items: Array.from({ length: 21 }, () => ({ name: 'x' })) }), V],
    ['позиция без имени', 'COLLECTING', 'post', items, () => ({ items: [{ name: '' }] }), V],
    ['позиция с именем из пробелов', 'COLLECTING', 'post', items, () => ({ items: [{ name: '   ' }] }), 'INVALID_INPUT'],
    ['имя позиции длиннее 200', 'COLLECTING', 'post', items, () => ({ items: [{ name: 'х'.repeat(201) }] }), V],
    ['количество 0', 'COLLECTING', 'post', items, () => ({ items: [{ name: 'Хлеб', quantity: 0 }] }), V],
    ['дробное количество', 'COLLECTING', 'post', items, () => ({ items: [{ name: 'Хлеб', quantity: 1.5 }] }), V],
    ['количество 100', 'COLLECTING', 'post', items, () => ({ items: [{ name: 'Хлеб', quantity: 100 }] }), V],
    ['правка: количество 100', 'COLLECTING', 'patch', itemPath, () => ({ quantity: 100 }), V],
    ['правка: имя длиннее 200', 'COLLECTING', 'patch', itemPath, () => ({ name: 'х'.repeat(201) }), V],
    ['правка: имя из пробелов', 'COLLECTING', 'patch', itemPath, () => ({ name: '   ' }), 'INVALID_INPUT'],
    ['отрицательная цена', 'SHOPPING', 'post', price, () => ({ price: -1, status: 'BOUGHT' }), V],
    ['цена выше 100 000', 'SHOPPING', 'post', price, () => ({ price: 100_001, status: 'BOUGHT' }), V],
    ['неизвестная отметка покупки', 'SHOPPING', 'post', price, () => ({ price: 10, status: 'LOST' }), V],
    ['цена без отметки покупки', 'SHOPPING', 'post', price, () => ({ price: 10 }), V],
  ];

  it.each(rows)('%s — 400', async (...[, status, method, path, body, code, field]: Row) => {
    const seeded = await seedRun(status);
    const before = await snapshot();
    // Позиция принадлежит Марии: правку чужой позиции раньше проверки входа отсёк бы запрет.
    const who: Who = method === 'patch' ? 'maria' : 'ivan';

    const response = await call(method, path(seeded), who, body());

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(code);
    if (field) {
      expect(response.body.errors.map((e: { field: string }) => e.field)).toContain(field);
    }
    expect(await snapshot()).toBe(before);
  });
});

describe('активные забеги на Главной', () => {
  async function activeIds(who: Who, groupId?: number) {
    const response = await call('get', '/api/store-runs/active', who).query(groupId ? { groupId } : {});
    return response;
  }

  async function seedActiveInBothTeams() {
    const inA = await seedRun('COLLECTING');
    await prisma.storeItem.create({ data: { storeRunId: inA.runId, userId: world.id.petr, name: 'Сыр' } });
    const inB = await prisma.storeRun.create({
      data: {
        groupId: world.groupB,
        initiatorId: world.id.stranger,
        storeName: 'Ашан',
        status: 'SHOPPING',
        collectUntil: new Date(),
      },
    });
    // Завершённый забег в той же команде в списке активных не нужен.
    await prisma.storeRun.create({
      data: {
        groupId: world.groupA,
        initiatorId: world.id.petr,
        storeName: 'Магнит',
        status: 'SETTLED',
        collectUntil: new Date(),
      },
    });
    return { runA: inA.runId, runB: inB.id };
  }

  /* [BUG] Главная показывала рядом с выбранной командой забег другой команды
     человека: `groupId` не сужал выборку. */
  it('выбранная команда сужает список до своих забегов', async () => {
    const { runA, runB } = await seedActiveInBothTeams();

    const inA = await activeIds('maria', world.groupA);
    const inB = await activeIds('maria', world.groupB);
    const all = await activeIds('maria');

    expect(inA.body.data.map((r: { id: number }) => r.id)).toEqual([runA]);
    expect(inB.body.data.map((r: { id: number }) => r.id)).toEqual([runB]);
    expect(all.body.data.map((r: { id: number }) => r.id).sort()).toEqual([runA, runB].sort());
  });

  // Чужие заказы в карточке Главной не показываются.
  it('в списке видны только свои позиции', async () => {
    const { runA } = await seedActiveInBothTeams();

    const response = await activeIds('maria', world.groupA);

    const run = response.body.data.find((r: { id: number }) => r.id === runA);
    expect(run.items.map((i: { name: string }) => i.name)).toEqual(['Молоко']);
  });

  it('без выбранной команды человеку без активных членств не достаётся ничего', async () => {
    await seedActiveInBothTeams();

    const response = await activeIds('olga');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  /* Отказ, а не пустой список: пустой ответ не отличить от «забегов нет». */
  it.each<[string, Who, 'A' | 'B']>([
    ['посторонний', 'stranger', 'A'],
    ['вышедшая из группы', 'olga', 'A'],
    ['участник другой команды', 'petr', 'B'],
  ])('%s получает отказ по чужой команде', async (_label, who, team) => {
    await seedActiveInBothTeams();

    const response = await activeIds(who, team === 'A' ? world.groupA : world.groupB);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });
});

describe('личный список товаров пополняется из позиций', () => {
  async function presetsOf(who: Who) {
    const response = await call('get', '/api/user/item-presets', who).expect(200);
    return response.body.data as Array<{ name: string; quantity: number; notes: string | null; pinned: boolean }>;
  }

  it('добавление заводит пресет, другое написание того же товара его обновляет', async () => {
    const seeded = await seedRun('COLLECTING');
    await call('post', `${runPath(seeded.runId)}/items`, 'petr', {
      items: [{ name: '  Сыр ', quantity: 2, notes: 'тильзитер' }],
    }).expect(201);
    await call('post', `${runPath(seeded.runId)}/items`, 'petr', {
      items: [{ name: 'СЫР' }],
    }).expect(201);

    /* Пресет хранит последнее состояние позиции, в том числе написание. */
    expect(await presetsOf('petr')).toEqual([
      expect.objectContaining({ name: 'СЫР', quantity: 1, notes: null }),
    ]);
    expect(await presetsOf('maria')).toEqual([]);
  });

  it('правка позиции обновляет пресет целиком', async () => {
    const seeded = await seedRun('COLLECTING');
    await call('post', `${runPath(seeded.runId)}/items`, 'petr', {
      items: [{ name: 'Сыр', notes: 'тильзитер' }],
    }).expect(201);
    const cheese = await itemId(seeded.runId, 'Сыр');

    await call('patch', `${runPath(seeded.runId)}/items/${cheese}`, 'petr', { quantity: 3 }).expect(200);

    expect(await presetsOf('petr')).toEqual([
      expect.objectContaining({ name: 'Сыр', quantity: 3, notes: 'тильзитер' }),
    ]);
  });

  /* Разовые покупки не должны вытеснять постоянные: сверх лимита уходят самые
     давние НЕзакреплённые, закреплённое остаётся при любом возрасте. */
  it('сверх лимита вытесняется самый давний незакреплённый, закреплённый остаётся', async () => {
    const seeded = await seedRun('COLLECTING');
    const dayMs = 86_400_000;
    await prisma.userItemPreset.createMany({
      data: [
        ...Array.from({ length: 50 }, (_, i) => ({
          userId: world.id.petr,
          name: `Товар ${i + 1}`,
          normalizedName: `товар ${i + 1}`,
          lastUsedAt: new Date(Date.now() - (i + 1) * dayMs),
        })),
        {
          userId: world.id.petr,
          name: 'Кофе',
          normalizedName: 'кофе',
          pinned: true,
          lastUsedAt: new Date(Date.now() - 365 * dayMs),
        },
      ],
    });

    await call('post', `${runPath(seeded.runId)}/items`, 'petr', { items: [{ name: 'Новинка' }] }).expect(201);

    const names = (await prisma.userItemPreset.findMany({ where: { userId: world.id.petr } })).map(p => p.name);
    expect(names).toHaveLength(51);
    expect(names).toEqual(expect.arrayContaining(['Новинка', 'Кофе', 'Товар 49']));
    expect(names).not.toContain('Товар 50');
  });
});

/**
 * Рассылки через поддельный Telegram. Проверяется, КОМУ ушло сообщение, а не
 * что в нём написано.
 */
describe('уведомления', () => {
  const chat = (who: Who) => TG[who];

  it('приглашение уходит активным участникам кроме инициатора, пост — в группу; id запоминаются', async () => {
    const bot = installBot();

    const response = await call('post', '/api/store-runs', 'ivan', {
      groupId: world.groupA,
      storeName: 'Лента',
      collectMinutes: 10,
    }).expect(201);
    const runId: number = response.body.data.id;

    await eventually(async () => {
      const run = await prisma.storeRun.findUniqueOrThrow({ where: { id: runId } });
      return run.groupMessageId != null && run.dmMessages != null;
    });

    /* Ольга вышла, Тихон отказался от рассылок, Иван — сам инициатор. */
    expect(bot.sent.map(m => m.chatId).sort()).toEqual([GROUP_A_CHAT, chat('maria'), chat('petr')].sort());

    const run = await prisma.storeRun.findUniqueOrThrow({ where: { id: runId } });
    const groupPost = bot.sent.find(m => m.chatId === GROUP_A_CHAT)!;
    expect(run.groupMessageId).toBe(groupPost.messageId);
    const dms = JSON.parse(run.dmMessages!) as Array<{ chatId: number; messageId: number }>;
    expect(dms.map(d => d.chatId).sort()).toEqual([chat('maria'), chat('petr')].sort());
  });

  it('отмена убирает групповой пост и личные приглашения', async () => {
    const bot = installBot();
    const response = await call('post', '/api/store-runs', 'ivan', {
      groupId: world.groupA,
      storeName: 'Лента',
      collectMinutes: 10,
    }).expect(201);
    const runId: number = response.body.data.id;
    await eventually(async () => {
      const run = await prisma.storeRun.findUniqueOrThrow({ where: { id: runId } });
      return run.groupMessageId != null && run.dmMessages != null;
    });

    await call('post', `${runPath(runId)}/cancel`, 'ivan').expect(200);

    await eventually(() => bot.deleted.length >= 3);
    expect([...bot.deleted].sort()).toEqual(
      bot.sent.map(m => [m.chatId, m.messageId] as [number, number]).sort(),
    );
  });

  it('о начале закупки узнают только те, кто что-то заказал', async () => {
    const seeded = await seedRun('COLLECTING');
    await prisma.storeItem.create({ data: { storeRunId: seeded.runId, userId: world.id.ivan, name: 'Кофе' } });
    const bot = installBot();

    await call('post', `${runPath(seeded.runId)}/start-shopping`, 'ivan').expect(200);

    await eventually(() => bot.sent.length >= 1);
    await sleep(100);
    expect(bot.sent.map(m => m.chatId)).toEqual([chat('maria')]);
  });

  it('после расчёта: должнику одно сообщение на весь заказ, инициатору сводка, без долга — «платить не надо»', async () => {
    const seeded = await seedRun('SHOPPING', 777);
    await prisma.storeItem.createMany({
      data: [
        { storeRunId: seeded.runId, userId: world.id.maria, name: 'Хлеб', status: 'BOUGHT', price: 50 },
        { storeRunId: seeded.runId, userId: world.id.petr, name: 'Икра', status: 'NOT_FOUND' },
      ],
    });
    const bot = installBot();

    await call('post', `${runPath(seeded.runId)}/settle`, 'ivan').expect(200);

    await eventually(() => bot.sent.length >= 3 && bot.edited.length >= 1);
    await sleep(100);
    expect(bot.sent.map(m => m.chatId).sort()).toEqual([chat('ivan'), chat('maria'), chat('petr')].sort());
    expect(bot.edited).toEqual([[GROUP_A_CHAT, 777]]);
  });

  /* Рассылки идут после сохранения и не могут сделать совершённое действие
     неуспешным: забег создан, отменён, закрыт — даже если Telegram лежит. */
  it('сбой Telegram не меняет ответы и состояние забега', async () => {
    installBot({ sendingFails: true });

    const created = await call('post', '/api/store-runs', 'ivan', {
      groupId: world.groupA,
      storeName: 'Лента',
      collectMinutes: 10,
    }).expect(201);
    /* Недоставленные приглашения в список на удаление не попадают: удалять
       нечего. */
    await eventually(async () => {
      const run = await prisma.storeRun.findUniqueOrThrow({ where: { id: created.body.data.id } });
      return run.dmMessages != null;
    });
    expect((await prisma.storeRun.findUniqueOrThrow({ where: { id: created.body.data.id } })).dmMessages).toBe('[]');
    await call('post', `${runPath(created.body.data.id)}/cancel`, 'ivan').expect(200);

    const seeded = await seedRun('COLLECTING');
    await call('post', `${runPath(seeded.runId)}/start-shopping`, 'ivan').expect(200);
    await call('post', `${itemPath(seeded)}/price`, 'ivan', { price: 100, status: 'BOUGHT' }).expect(200);
    await call('post', `${runPath(seeded.runId)}/settle`, 'ivan').expect(200);

    expect(await runStatus(created.body.data.id)).toBe('CANCELLED');
    expect(await runStatus(seeded.runId)).toBe('SETTLED');
    expect(await prisma.transaction.count({ where: { storeRunId: seeded.runId } })).toBe(1);
  });
});
