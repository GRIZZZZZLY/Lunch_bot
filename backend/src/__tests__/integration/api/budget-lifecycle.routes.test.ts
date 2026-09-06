/**
 * Денежные сценарии через НАСТОЯЩИЙ API: express, PostgreSQL, Prisma.
 *
 * Модульные тесты бюджета работают на подставной БД и проверяют решения
 * сервиса. Здесь проверяется другое — что сохранённое состояние и права
 * согласованы на всём пути от HTTP до строки в таблице:
 *
 * 1. Полный цикл долга: отметка → подтверждение → отмена → повторное
 *    подтверждение. Повторное подтверждение — ЗАКОННОЕ второе событие, а не
 *    дубль первого, и очередь уведомлений обязана их различать.
 * 2. Ограничения ролей: подтвердить может только получатель, отметить —
 *    только должник. Проверяется по ответу И по тому, что запись не менялась.
 * 3. Изоляция команд: командный экран бюджета показывает ровно одну команду,
 *    а недоступная команда получает отказ, а не пустой список.
 *
 * Данные создаются здесь же, а не сценарием `e2e-seed`: тот обслуживает
 * браузерные проверки и живёт своей жизнью, а `cleanDatabase()` между тестами
 * всё равно уносит всё.
 *
 * ОКРУЖЕНИЕ. Нужен настоящий Redis: изменяющие маршруты бюджета объявлены
 * `required: true` в middleware идемпотентности, и без хранилища он отвечает
 * 503 — то есть без Redis эти сценарии не проверяли бы ничего. Лимитер
 * запросов выключается, как в CI-задании интеграции: каждый тест заново
 * получает токены (`cleanDatabase` меняет id пользователей), и настоящий
 * лимит на входе срабатывал бы посреди набора.
 *
 *   REDIS_ENABLED=true REDIS_URL=redis://127.0.0.1:6379/0 \
 *   ENABLE_RATE_LIMIT=false npm test -- <этот файл>
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { generateTelegramInitData } from '../helpers/authHelper';

const app = createTestApp();

const ANNA_TELEGRAM_ID = 700000201;
const BORIS_TELEGRAM_ID = 700000202;

interface World {
  annaId: number;
  borisId: number;
  teamAId: number;
  teamBId: number;
  teamCId: number;
  debtInA: number;
  debtInB: number;
}

/**
 * Три команды и два человека.
 *
 * Анна — должник в А и Б, Борис — получатель. В команде В Анны нет: без такой
 * команды нельзя отличить «здесь пусто» от «сюда нельзя».
 *
 * Долг в А связан с голосованием, долг в Б — с магазинным забегом: у долга
 * две возможные связи с командой, и обе должны учитываться при фильтрации.
 */
async function buildWorld(): Promise<World> {
  const anna = await prisma.user.create({
    data: { telegramId: BigInt(ANNA_TELEGRAM_ID), firstName: 'Анна' },
  });
  const boris = await prisma.user.create({
    data: { telegramId: BigInt(BORIS_TELEGRAM_ID), firstName: 'Борис' },
  });

  const [teamA, teamB, teamC] = await Promise.all([
    prisma.group.create({
      data: { telegramId: BigInt(-100000000101), title: 'Команда А' },
    }),
    prisma.group.create({
      data: { telegramId: BigInt(-100000000102), title: 'Команда Б' },
    }),
    prisma.group.create({
      data: { telegramId: BigInt(-100000000103), title: 'Команда В' },
    }),
  ]);

  await prisma.groupMember.createMany({
    data: [
      { groupId: teamA.id, userId: anna.id, role: 'CREATOR', isActive: true },
      { groupId: teamA.id, userId: boris.id, role: 'MEMBER', isActive: true },
      { groupId: teamB.id, userId: anna.id, role: 'MEMBER', isActive: true },
      { groupId: teamB.id, userId: boris.id, role: 'CREATOR', isActive: true },
      // Анны в команде В нет намеренно.
      { groupId: teamC.id, userId: boris.id, role: 'CREATOR', isActive: true },
    ],
  });

  const pollA = await prisma.poll.create({
    data: { groupId: teamA.id, status: 'COMPLETED', createdBy: anna.id },
  });
  const runB = await prisma.storeRun.create({
    data: {
      groupId: teamB.id,
      initiatorId: boris.id,
      storeName: 'Лента',
      status: 'SETTLED',
      collectUntil: new Date(Date.now() + 3_600_000),
    },
  });

  const debtInA = await prisma.transaction.create({
    data: {
      pollId: pollA.id,
      fromUserId: anna.id,
      toUserId: boris.id,
      amount: 390,
      status: 'PENDING',
    },
  });
  const debtInB = await prisma.transaction.create({
    data: {
      storeRunId: runB.id,
      fromUserId: anna.id,
      toUserId: boris.id,
      amount: 450,
      status: 'PENDING',
    },
  });

  return {
    annaId: anna.id,
    borisId: boris.id,
    teamAId: teamA.id,
    teamBId: teamB.id,
    teamCId: teamC.id,
    debtInA: debtInA.id,
    debtInB: debtInB.id,
  };
}

/** Токен настоящего входа: тот же путь, которым идёт приложение. */
async function tokenFor(telegramId: number): Promise<string> {
  const response = await request(app)
    .post('/api/auth/validate')
    .send({ initData: generateTelegramInitData(telegramId) })
    .expect(200);

  return response.body.accessToken as string;
}

/** Ключ идемпотентности обязателен на изменяющих маршрутах бюджета. */
function uniqueKey(label: string): string {
  return `test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function statusOf(id: number): Promise<string> {
  const row = await prisma.transaction.findUnique({ where: { id } });
  return row!.status;
}

let world: World;
let annaToken: string;
let borisToken: string;

/**
 * Без Redis набор пропускается, а не падает.
 *
 * Иначе обычный `npm test` на машине без Redis показывал бы 503 и 429 как
 * дефекты кода. В CI Redis поднят (`ci.yml`, задание Backend quality),
 * поэтому там набор выполняется. Пропуск объявлен явно и виден в отчёте —
 * молчаливого «зелёного» здесь не возникает.
 */
const redisAvailable = process.env.REDIS_ENABLED === 'true';
const describeWithRedis = redisAvailable ? describe : describe.skip;

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  if (!redisAvailable) {
     
    console.warn(
      'budget-lifecycle: пропущено, нужен REDIS_ENABLED=true и ENABLE_RATE_LIMIT=false'
    );
  }
});

beforeEach(async () => {
  if (!redisAvailable) return;
  await cleanDatabase();
  world = await buildWorld();
  annaToken = await tokenFor(ANNA_TELEGRAM_ID);
  borisToken = await tokenFor(BORIS_TELEGRAM_ID);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
  /* Redis закрывает общий хук в `__tests__/setup.ts`: соединение может
     открыть любой набор, поднимающий приложение. */
});

describeWithRedis('жизненный цикл долга', () => {
  it('отметка → подтверждение → отмена → повторное подтверждение', async () => {
    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('mark'))
      .send({ transactionId: world.debtInA })
      .expect(200);
    expect(await statusOf(world.debtInA)).toBe('PAID');

    await request(app)
      .post('/api/budget/confirm-payment')
      .set('Authorization', `Bearer ${borisToken}`)
      .set('Idempotency-Key', uniqueKey('confirm'))
      .send({ transactionId: world.debtInA })
      .expect(200);
    expect(await statusOf(world.debtInA)).toBe('CONFIRMED');

    await request(app)
      .post('/api/budget/undo-confirmation')
      .set('Authorization', `Bearer ${borisToken}`)
      .set('Idempotency-Key', uniqueKey('undo'))
      .send({ transactionId: world.debtInA })
      .expect(200);
    expect(await statusOf(world.debtInA)).toBe('PAID');

    /* Второе подтверждение — законное СОБЫТИЕ, а не дубль первого. Ровно
       поэтому идентичность уведомления считается по версии перехода, а не по
       паре «id долга + статус». */
    await request(app)
      .post('/api/budget/confirm-payment')
      .set('Authorization', `Bearer ${borisToken}`)
      .set('Idempotency-Key', uniqueKey('confirm-again'))
      .send({ transactionId: world.debtInA })
      .expect(200);
    expect(await statusOf(world.debtInA)).toBe('CONFIRMED');
  });

  /* Отметка оплаты переведена на очередь уведомлений: задание должно
     появиться в той же транзакции, что и переход. */
  it('отметка оплаты оставляет задание на уведомление', async () => {
    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('mark'))
      .send({ transactionId: world.debtInA })
      .expect(200);

    const events = await prisma.outboxEvent.findMany({
      where: { entityType: 'TRANSACTION', entityId: world.debtInA },
    });
    expect(events).toHaveLength(1);
    expect(events[0].messageType).toBe('DEBT_MARKED_PAID');
    /* Адресат — получатель денег, а не должник. */
    expect(events[0].recipientChatId).toBe(String(BORIS_TELEGRAM_ID));
  });

  it('версия перехода растёт с каждой сменой статуса', async () => {
    const before = await prisma.transaction.findUnique({
      where: { id: world.debtInA },
    });

    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('mark'))
      .send({ transactionId: world.debtInA })
      .expect(200);

    const after = await prisma.transaction.findUnique({
      where: { id: world.debtInA },
    });
    expect(after!.transitionVersion).toBe(before!.transitionVersion + 1);
  });
});

describeWithRedis('ограничения ролей', () => {
  it('подтвердить может только получатель', async () => {
    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('mark'))
      .send({ transactionId: world.debtInA })
      .expect(200);

    const response = await request(app)
      .post('/api/budget/confirm-payment')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('confirm-by-debtor'))
      .send({ transactionId: world.debtInA });

    expect(response.status).toBe(403);
    /* Ответ — половина дела: статус в БД не должен был измениться. */
    expect(await statusOf(world.debtInA)).toBe('PAID');
  });

  it('отметить оплату может только должник', async () => {
    const response = await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${borisToken}`)
      .set('Idempotency-Key', uniqueKey('mark-by-payee'))
      .send({ transactionId: world.debtInA });

    expect(response.status).toBe(403);
    expect(await statusOf(world.debtInA)).toBe('PENDING');
  });

  it('неоплаченный долг подтвердить нельзя', async () => {
    const response = await request(app)
      .post('/api/budget/confirm-payment')
      .set('Authorization', `Bearer ${borisToken}`)
      .set('Idempotency-Key', uniqueKey('confirm-pending'))
      .send({ transactionId: world.debtInA });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await statusOf(world.debtInA)).toBe('PENDING');
  });
});

/**
 * `PRODUCT.md`: любой экран показывает данные ровно одной группы. Здесь это
 * проверяется на настоящей выборке, а не на моке Prisma.
 */
describeWithRedis('изоляция команд в бюджете', () => {
  async function debts(token: string, groupId?: number) {
    const response = await request(app)
      .get('/api/budget/debts')
      .query(groupId === undefined ? {} : { groupId })
      .set('Authorization', `Bearer ${token}`);
    return response;
  }

  it('команда А показывает только свой долг', async () => {
    const response = await debts(annaToken, world.teamAId);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(Number(response.body.data[0].amount)).toBe(390);
  });

  /* Долг команды Б связан с командой через магазинный забег, а не через
     голосование. Раньше эта связь не учитывалась вовсе. */
  it('команда Б показывает свой долг, связанный через забег', async () => {
    const response = await debts(annaToken, world.teamBId);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(Number(response.body.data[0].amount)).toBe(450);
  });

  it('без указания команды виден личный итог по всем командам', async () => {
    const response = await debts(annaToken);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  /* Отказ, а не пустой список: иначе клиент не отличит «здесь ничего нет» от
     «этой команды я не вижу». */
  it('чужая команда получает отказ', async () => {
    const response = await debts(annaToken, world.teamCId);

    expect(response.status).toBe(403);
  });

  it('несуществующая команда тоже получает отказ', async () => {
    const response = await debts(annaToken, 999999);

    expect(response.status).toBe(403);
  });
});

/**
 * Повтор запроса с тем же ключом идемпотентности.
 *
 * Клиент повторяет операцию с ПРЕЖНИМ ключом, когда исход неизвестен: сеть
 * оборвалась или сервер ответил 5xx (`frontend-new/src/services/api.service.ts`).
 * Сервер обязан вернуть ответ первой попытки, а не выполнить действие второй
 * раз. Проверяется на настоящем Redis: без него middleware отвечает 503, и
 * до этой правки ни один изменяющий запрос бюджета в интеграционном
 * окружении не выполнялся вообще.
 */
describeWithRedis('повтор запроса с тем же ключом', () => {
  it('второй запрос получает ответ первого и помечен как replay', async () => {
    const key = uniqueKey('replay');

    const first = await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', key)
      .send({ transactionId: world.debtInA })
      .expect(200);

    const second = await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', key)
      .send({ transactionId: world.debtInA })
      .expect(200);

    expect(second.body).toEqual(first.body);
    expect(second.headers['x-idempotent-replayed']).toBe('true');
  });

  /* Второе задание на уведомление — это второе сообщение человеку об одном и
     том же событии. Ключ идемпотентности не должен его допустить, и даже если
     обработчик до него доберётся, уникальный индекс события его не создаст. */
  it('повтор не создаёт второе задание на уведомление', async () => {
    const key = uniqueKey('replay-outbox');

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(app)
        .post('/api/budget/mark-paid')
        .set('Authorization', `Bearer ${annaToken}`)
        .set('Idempotency-Key', key)
        .send({ transactionId: world.debtInA })
        .expect(200);
    }

    const events = await prisma.outboxEvent.count({
      where: { entityType: 'TRANSACTION', entityId: world.debtInA },
    });
    expect(events).toBe(1);
  });

  /* Даже с НОВЫМ ключом повтор уже совершённого перехода не должен давать
     второго уведомления: статус уже PAID, менять нечего. */
  it('новый ключ на уже отмеченном долге не создаёт второго задания', async () => {
    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('mark-first'))
      .send({ transactionId: world.debtInA })
      .expect(200);

    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('mark-second'))
      .send({ transactionId: world.debtInA })
      .expect(200);

    expect(await statusOf(world.debtInA)).toBe('PAID');
    const events = await prisma.outboxEvent.count({
      where: { entityType: 'TRANSACTION', entityId: world.debtInA },
    });
    expect(events).toBe(1);
  });

  it('без ключа идемпотентности запрос отклоняется', async () => {
    const response = await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .send({ transactionId: world.debtInA });

    expect(response.status).toBe(400);
    expect(await statusOf(world.debtInA)).toBe('PENDING');
  });
});

/**
 * Одновременные запросы.
 *
 * Двойной тап и две открытые вкладки — обычное дело на телефоне. Переход
 * статуса защищён условием в `updateMany`, поэтому второй запрос не должен
 * ни сменить статус повторно, ни создать второе уведомление.
 */
describeWithRedis('одновременные запросы', () => {
  it('две одновременные отметки дают один переход и одно задание', async () => {
    const [first, second] = await Promise.all([
      request(app)
        .post('/api/budget/mark-paid')
        .set('Authorization', `Bearer ${annaToken}`)
        .set('Idempotency-Key', uniqueKey('race-a'))
        .send({ transactionId: world.debtInA }),
      request(app)
        .post('/api/budget/mark-paid')
        .set('Authorization', `Bearer ${annaToken}`)
        .set('Idempotency-Key', uniqueKey('race-b'))
        .send({ transactionId: world.debtInA }),
    ]);

    /* Оба запроса законны: разные ключи, значит это два разных нажатия.
       Оба отвечают успехом, потому что итог один и тот же — долг отмечен. */
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await statusOf(world.debtInA)).toBe('PAID');

    const events = await prisma.outboxEvent.count({
      where: { entityType: 'TRANSACTION', entityId: world.debtInA },
    });
    expect(events).toBe(1);

    const row = await prisma.transaction.findUnique({
      where: { id: world.debtInA },
    });
    /* Версия выросла ровно один раз: второй запрос не нашёл PENDING. */
    expect(row!.transitionVersion).toBe(1);
  });
});
