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
import { setBotInstance } from '../../../bot/bot-instance';
import { OutboxWorkerService } from '../../../services/outbox-worker.service';
import { StoreRunBudgetService } from '../../../services/store-run-budget.service';

/* Приложение поднимается ЛЕНИВО: без Redis набор пропускается целиком, и
   создавать express, временный каталог фронтенда и клиент Prisma незачем.
   Раньше это делалось в модульной области — файл выполнял работу даже когда
   все его тесты пропущены, и прогон в CI завершался кодом 1 без единого
   сообщения (проверено пробными ветками: без этого файла CI зелёный). */
let app: ReturnType<typeof createTestApp>;

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

/**
 * Дать доставке завершиться.
 *
 * Немедленная попытка после операции идёт В СТОРОНЕ от ответа (иначе
 * медленный Telegram задерживал бы клиента), поэтому к моменту утверждения
 * она может быть ещё в полёте — и уже держать задание захваченным, из-за чего
 * проход обработчика ничего не найдёт. Сначала ждём её, потом добираем
 * обработчиком то, что она не забрала.
 */
async function settleDelivery(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 150));
  await OutboxWorkerService.tick();
}

async function statusOf(id: number): Promise<string> {
  const row = await prisma.transaction.findUnique({ where: { id } });
  return row!.status;
}

let world: World;
let annaToken: string;
let borisToken: string;

/* Файл собирается только при `REDIS_ENABLED=true` — за это отвечает
   `testPathIgnorePatterns` в jest.config.js. Отдельной проверки внутри файла
   нет намеренно: два механизма пропуска для одного условия расходятся. */
beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
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

describe('жизненный цикл долга', () => {
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

describe('ограничения ролей', () => {
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
describe('изоляция команд в бюджете', () => {
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
describe('повтор запроса с тем же ключом', () => {
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
describe('одновременные запросы', () => {
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

/**
 * Telegram недоступен, затем восстановлен.
 *
 * Сценарий из плана целиком, на настоящем API: операция должна пройти при
 * лежащем Telegram, задание — сохраниться, а после восстановления связи
 * обработчик обязан доставить сообщение сам, без повторного нажатия
 * человеком. Здесь встречаются оба исправления: изоляция сбоя доставки
 * (`utils/post-commit.ts`) и очередь (`services/outbox.service.ts`).
 *
 * Бот подменяется настоящим `setBotInstance`, а не моком модуля: так путь от
 * контроллера до отправки остаётся тем же, каким он идёт в бою.
 */
describe('Telegram недоступен, затем восстановлен', () => {
  /** Бот, у которого отправка падает недоступностью Telegram. */
  function brokenBot(): { calls: number } {
    const state = { calls: 0 };
    setBotInstance({
      api: {
        sendMessage: async () => {
          state.calls += 1;
          throw Object.assign(new Error('Bad Gateway'), { error_code: 502 });
        },
      },
    } as unknown as Parameters<typeof setBotInstance>[0]);
    return state;
  }

  /** Восстановившийся бот: запоминает, что и кому ушло. */
  function workingBot(): { sent: Array<{ chatId: number; text: string }> } {
    const sent: Array<{ chatId: number; text: string }> = [];
    setBotInstance({
      api: {
        sendMessage: async (chatId: number, text: string) => {
          sent.push({ chatId, text });
          return { message_id: 4242 };
        },
      },
    } as unknown as Parameters<typeof setBotInstance>[0]);
    return { sent };
  }

  /* Сбрасывать экземпляр между тестами не нужно: реестр модулей у каждого
     файла тестов свой, а внутри файла каждый тест ставит своего бота первым
     же действием. */

  it('операция проходит, задание сохраняется, доставка догоняет позже', async () => {
    const broken = brokenBot();

    /* 1. Telegram лежит. Операция обязана вернуть успех: статус уже сохранён,
          и ошибка отправки не делает его неуспешным. */
    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('telegram-down'))
      .send({ transactionId: world.debtInA })
      .expect(200);

    expect(await statusOf(world.debtInA)).toBe('PAID');

    /* 2. Задание пережило сбой и ждёт повтора, а не потеряно.

       Проход обработчика запускается ЯВНО: немедленная попытка после
       операции больше не ожидается (иначе медленный Telegram задерживал бы
       ответ клиенту), поэтому к этому моменту она могла ещё не случиться. */
    await settleDelivery();
    expect(broken.calls).toBeGreaterThan(0);

    const pending = await prisma.outboxEvent.findMany({
      where: { entityType: 'TRANSACTION', entityId: world.debtInA },
    });
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('PENDING');
    expect(pending[0].lastErrorCategory).toBe('telegram_unavailable');

    /* 3. Связь восстановилась. Отсрочку после неудачной попытки убираем:
          обработчик по делу ждал бы паузу backoff. */
    const working = workingBot();
    await prisma.outboxEvent.updateMany({
      where: { id: pending[0].id },
      data: { nextAttemptAt: new Date(Date.now() - 1_000) },
    });

    await OutboxWorkerService.tick();

    /* 4. Сообщение ушло само, без участия человека. */
    expect(working.sent).toHaveLength(1);
    expect(working.sent[0].chatId).toBe(BORIS_TELEGRAM_ID);

    const delivered = await prisma.outboxEvent.findUnique({
      where: { id: pending[0].id },
    });
    expect(delivered!.status).toBe('SENT');
    expect(delivered!.sentMessageId).toBe(4242);
  });

  /* Повторный проход обработчика не должен отправить то же сообщение снова:
     задание уже SENT. */
  it('повторный проход обработчика не шлёт сообщение второй раз', async () => {
    const working = workingBot();

    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('deliver-once'))
      .send({ transactionId: world.debtInA })
      .expect(200);

    /* Немедленная попытка идёт в стороне от ответа, поэтому даём ей
       завершиться, а затем проверяем, что ПОВТОРНЫЕ проходы ничего не
       добавляют: задание уже SENT, кто бы его ни доставил. */
    await settleDelivery();
    expect(working.sent).toHaveLength(1);

    await OutboxWorkerService.tick();
    await OutboxWorkerService.tick();

    expect(working.sent).toHaveLength(1);
  });

  /* Отказ адресата — конечное состояние: человек заблокировал бота, и
     повторять бессмысленно. Операция при этом всё равно успешна. */
  it('заблокировавший бота адресат уводит задание в конечное состояние', async () => {
    setBotInstance({
      api: {
        sendMessage: async () => {
          throw Object.assign(new Error('Forbidden'), { error_code: 403 });
        },
      },
    } as unknown as Parameters<typeof setBotInstance>[0]);

    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('blocked'))
      .send({ transactionId: world.debtInA })
      .expect(200);

    expect(await statusOf(world.debtInA)).toBe('PAID');

    await settleDelivery();

    const [event] = await prisma.outboxEvent.findMany({
      where: { entityType: 'TRANSACTION', entityId: world.debtInA },
    });
    expect(event.status).toBe('FAILED');
    expect(event.lastErrorCategory).toBe('blocked_by_recipient');
  });
});

/**
 * Устаревшее уведомление после отмены — через НАСТОЯЩИЕ методы приложения.
 *
 * Ровно тот сценарий, который прошлый тест устаревания не поймал: он поднимал
 * `transitionVersion` руками в БД и потому не замечал, что сама отмена этого
 * не делает. Версию поднимает каждый переход состояния — проверяем это
 * последовательностью операций, а не подменой поля.
 *
 * Последовательность: отметить оплату при лежащем Telegram → отменить отметку
 * → Telegram восстановился → обработчик очереди. Сообщение «получена оплата»
 * отправиться НЕ должно: долг снова PENDING.
 */
describe('отмена отметки отменяет и уведомление о ней', () => {
  function silentBot(): { sent: string[] } {
    const sent: string[] = [];
    setBotInstance({
      api: {
        sendMessage: async (_chatId: number, text: string) => {
          sent.push(text);
          return { message_id: 1 };
        },
      },
    } as unknown as Parameters<typeof setBotInstance>[0]);
    return { sent };
  }

  it('каждый переход состояния поднимает версию', async () => {
    const versions: number[] = [];
    const readVersion = async () =>
      (await prisma.transaction.findUnique({ where: { id: world.debtInA } }))!
        .transitionVersion;

    versions.push(await readVersion());

    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('v-mark'))
      .send({ transactionId: world.debtInA })
      .expect(200);
    versions.push(await readVersion());

    await request(app)
      .post('/api/budget/cancel-mark')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('v-cancel'))
      .send({ transactionId: world.debtInA })
      .expect(200);
    versions.push(await readVersion());

    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('v-mark-2'))
      .send({ transactionId: world.debtInA })
      .expect(200);
    versions.push(await readVersion());

    await request(app)
      .post('/api/budget/confirm-payment')
      .set('Authorization', `Bearer ${borisToken}`)
      .set('Idempotency-Key', uniqueKey('v-confirm'))
      .send({ transactionId: world.debtInA })
      .expect(200);
    versions.push(await readVersion());

    await request(app)
      .post('/api/budget/undo-confirmation')
      .set('Authorization', `Bearer ${borisToken}`)
      .set('Idempotency-Key', uniqueKey('v-undo'))
      .send({ transactionId: world.debtInA })
      .expect(200);
    versions.push(await readVersion());

    /* Строго возрастает на каждом шаге: отметка, отмена отметки, повторная
       отметка, подтверждение, отмена подтверждения. */
    expect(versions).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('после отмены отметки старое «получена оплата» не уходит', async () => {
    /* 1. Telegram лежит: задание остаётся в очереди. */
    setBotInstance({
      api: {
        sendMessage: async () => {
          throw Object.assign(new Error('Bad Gateway'), { error_code: 502 });
        },
      },
    } as unknown as Parameters<typeof setBotInstance>[0]);

    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('stale-mark'))
      .send({ transactionId: world.debtInA })
      .expect(200);

    const [job] = await prisma.outboxEvent.findMany({
      where: { entityType: 'TRANSACTION', entityId: world.debtInA },
    });
    expect(job.status).toBe('PENDING');

    /* 2. Человек передумал и снял отметку. */
    await request(app)
      .post('/api/budget/cancel-mark')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('stale-cancel'))
      .send({ transactionId: world.debtInA })
      .expect(200);
    expect(await statusOf(world.debtInA)).toBe('PENDING');

    /* 3. Telegram восстановился, очередь дошла до заданий. Немедленная
       попытка отправить уведомление об отмене могла успеть в сломанный
       Telegram раньше замены бота — тогда оно тоже ждёт повтора. Раньше тест
       делал готовым только первое задание и падал на таком порядке. Ждём
       конца немедленных попыток и делаем готовыми все задания этого долга:
       при любом порядке уведомление об отмене уходит ровно один раз. */
    const bot = silentBot();
    for (let i = 0; i < 40; i++) {
      const inFlight = await prisma.outboxEvent.count({
        where: { entityType: 'TRANSACTION', entityId: world.debtInA, claimedUntil: { not: null } },
      });
      if (inFlight === 0) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await prisma.outboxEvent.updateMany({
      where: { entityType: 'TRANSACTION', entityId: world.debtInA, status: 'PENDING' },
      data: { nextAttemptAt: new Date(Date.now() - 1_000) },
    });

    await settleDelivery();

    /* Сообщение об оплате не ушло: долг больше не оплачен. Уходит только
       уведомление о самой отмене — оно тоже идёт через очередь. Какое
       сообщение ушло, видно по заданию, а не по тексту шаблона. */
    expect(bot.sent).toHaveLength(1);
    const settled = await prisma.outboxEvent.findUnique({
      where: { id: job.id },
    });
    expect(settled!.status).toBe('SUPERSEDED');
    const [cancelled] = await prisma.outboxEvent.findMany({
      where: { entityId: world.debtInA, messageType: 'DEBT_MARK_CANCELLED' },
    });
    expect(cancelled.status).toBe('SENT');
  });
});

/**
 * Медленный Telegram не должен задерживать ответ.
 *
 * Клиент обрывает запрос через 10 секунд (`frontend-new/src/services/
 * api.service.ts`). Пока отправка ожидалась внутри операции, медленный ответ
 * Telegram давал человеку «Request timeout» на уже сохранённой отметке —
 * тот же ложный отказ, что и при быстром сбое, только по другой причине.
 */
describe('медленный Telegram не задерживает ответ', () => {
  it('ответ приходит, не дожидаясь отправки', async () => {
    let release: (() => void) | undefined;
    const hanging = new Promise<void>(resolve => {
      release = resolve;
    });

    setBotInstance({
      api: {
        sendMessage: async () => {
          await hanging;
          return { message_id: 1 };
        },
      },
    } as unknown as Parameters<typeof setBotInstance>[0]);

    const started = Date.now();
    await request(app)
      .post('/api/budget/mark-paid')
      .set('Authorization', `Bearer ${annaToken}`)
      .set('Idempotency-Key', uniqueKey('slow'))
      .send({ transactionId: world.debtInA })
      .expect(200);
    const elapsed = Date.now() - started;

    /* Отправка всё ещё висит, а ответ уже получен. Порог с большим запасом:
       важно, что ожидания отправки НЕТ, а не точная величина. */
    expect(elapsed).toBeLessThan(5_000);
    expect(await statusOf(world.debtInA)).toBe('PAID');

    release?.();
  });
});

/**
 * Остальные переходы долга — через ту же очередь, что и отметка оплаты.
 *
 * До перевода подтверждение, обе отмены, массовое подтверждение и магазинные
 * долги уведомляли напрямую: сбой Telegram не проваливал операцию, но
 * сообщение терялось без следа и без повтора. Здесь для каждого перехода
 * проверяется одно и то же свойство: задание появляется в БД вместе с
 * переходом и доходит до адресата после восстановления Telegram.
 */
describe('остальные переходы долга идут через очередь', () => {
  const DEBT_MESSAGE_ID = 555;

  interface Sent {
    chatId: number;
    text: string;
  }
  interface Edited {
    chatId: string;
    messageId: number;
    text: string;
  }

  /** Бот, который запоминает и новые сообщения, и правки старых. */
  function recordingBot(): { sent: Sent[]; edited: Edited[] } {
    const sent: Sent[] = [];
    const edited: Edited[] = [];
    setBotInstance({
      api: {
        sendMessage: async (chatId: number, text: string) => {
          sent.push({ chatId: Number(chatId), text });
          return { message_id: 9000 + sent.length };
        },
        editMessageText: async (chatId: string, messageId: number, text: string) => {
          edited.push({ chatId: String(chatId), messageId, text });
          return true;
        },
      },
    } as unknown as Parameters<typeof setBotInstance>[0]);
    return { sent, edited };
  }

  /** Telegram лежит: и отправка, и правка падают недоступностью. */
  function downBot(): void {
    const unavailable = async () => {
      throw Object.assign(new Error('Bad Gateway'), { error_code: 502 });
    };
    setBotInstance({
      api: { sendMessage: unavailable, editMessageText: unavailable },
    } as unknown as Parameters<typeof setBotInstance>[0]);
  }

  /**
   * Все ожидающие задания — к отправке сейчас, без паузы backoff.
   *
   * Сначала ждём немедленную попытку после операции: она идёт в стороне от
   * ответа и, пока в полёте, держит задание захваченным — проход обработчика
   * его пропустил бы, и тест падал бы через раз.
   */
  async function makeQueueDue(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 150));
    await prisma.outboxEvent.updateMany({
      where: { status: 'PENDING' },
      data: { nextAttemptAt: new Date(Date.now() - 1_000) },
    });
  }

  async function eventsOf(messageType: string) {
    return prisma.outboxEvent.findMany({
      where: { messageType },
      orderBy: { id: 'asc' },
    });
  }

  async function post(path: string, token: string, body: object) {
    return request(app)
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', uniqueKey('transition'))
      .send(body)
      .expect(200);
  }

  async function markAndConfirm(txId: number): Promise<void> {
    await post('/api/budget/mark-paid', annaToken, { transactionId: txId });
    await post('/api/budget/confirm-payment', borisToken, { transactionId: txId });
  }

  /** У долга есть сообщение, которое бот прислал при расчёте заказа. */
  async function attachDebtMessage(txId: number): Promise<void> {
    await prisma.transaction.update({
      where: { id: txId },
      data: {
        debtMessageId: DEBT_MESSAGE_ID,
        debtChatId: String(ANNA_TELEGRAM_ID),
      },
    });
  }

  async function pollOf(txId: number): Promise<number> {
    return (await prisma.transaction.findUnique({ where: { id: txId } }))!.pollId!;
  }

  it('подтверждение при лежащем Telegram сохраняется, должник узнаёт позже', async () => {
    downBot();
    await markAndConfirm(world.debtInA);
    expect(await statusOf(world.debtInA)).toBe('CONFIRMED');

    await settleDelivery();
    const [job] = await eventsOf('DEBT_CONFIRMED');
    expect(job.status).toBe('PENDING');
    expect(job.recipientChatId).toBe(String(ANNA_TELEGRAM_ID));

    const bot = recordingBot();
    await makeQueueDue();
    await OutboxWorkerService.tick();

    const toAnna = bot.sent.filter(m => m.chatId === ANNA_TELEGRAM_ID);
    expect(toAnna).toHaveLength(1);
    const [delivered] = await eventsOf('DEBT_CONFIRMED');
    expect(delivered.status).toBe('SENT');
  });

  it('подтверждение правит сохранённое сообщение о долге, а не шлёт новое', async () => {
    await attachDebtMessage(world.debtInA);
    const bot = recordingBot();

    await markAndConfirm(world.debtInA);
    await settleDelivery();

    expect(bot.edited).toEqual([
      expect.objectContaining({
        chatId: String(ANNA_TELEGRAM_ID),
        messageId: DEBT_MESSAGE_ID,
      }),
    ]);
    expect(bot.sent.filter(m => m.chatId === ANNA_TELEGRAM_ID)).toHaveLength(0);
    const [confirmed] = await eventsOf('DEBT_CONFIRMED');
    expect(confirmed.status).toBe('SENT');
    expect(confirmed.sentMessageId).toBe(DEBT_MESSAGE_ID);
  });

  it('повтор подтверждения не создаёт второе задание', async () => {
    recordingBot();
    await markAndConfirm(world.debtInA);
    await post('/api/budget/confirm-payment', borisToken, {
      transactionId: world.debtInA,
    });

    expect(await eventsOf('DEBT_CONFIRMED')).toHaveLength(1);
  });

  it('последнее подтверждение ставит «Все оплатили» получателю', async () => {
    downBot();
    await markAndConfirm(world.debtInA);

    const [summary] = await eventsOf('DEBTS_ALL_CONFIRMED');
    expect(summary.recipientChatId).toBe(String(BORIS_TELEGRAM_ID));

    const bot = recordingBot();
    await makeQueueDue();
    await OutboxWorkerService.tick();

    /* «Получена оплата» к этому времени устарело: Борис уже подтвердил. До него
       доходит одна сводка, и в ней сумма закрытых долгов. */
    const toBoris = bot.sent.filter(m => m.chatId === BORIS_TELEGRAM_ID);
    expect(toBoris).toHaveLength(1);
    const [sent] = await eventsOf('DEBTS_ALL_CONFIRMED');
    expect(sent.status).toBe('SENT');
    expect(Number.parseFloat((sent.payload as { total: string }).total)).toBe(390);
  });

  it('пока есть незакрытый долг, сводки «Все оплатили» нет', async () => {
    recordingBot();
    const vera = await prisma.user.create({
      data: { telegramId: BigInt(700000203), firstName: 'Вера' },
    });
    await prisma.transaction.create({
      data: {
        pollId: await pollOf(world.debtInA),
        fromUserId: vera.id,
        toUserId: world.borisId,
        amount: 210,
        status: 'PENDING',
      },
    });

    await markAndConfirm(world.debtInA);

    expect(await eventsOf('DEBT_CONFIRMED')).toHaveLength(1);
    expect(await eventsOf('DEBTS_ALL_CONFIRMED')).toHaveLength(0);
  });

  /* Два последних долга подтверждаются одновременно. Проверка «все ли
     подтверждены» в каждой транзакции видит чужой долг ещё неподтверждённым,
     если транзакции не упорядочены, — и итоговое сообщение не получает никто.
     Проверка после фиксации дала бы обратное: два одинаковых сообщения. */
  it('одновременные подтверждения двух последних долгов дают одно «Все оплатили»', async () => {
    recordingBot();
    const vera = await prisma.user.create({
      data: { telegramId: BigInt(700000203), firstName: 'Вера' },
    });
    const veraDebt = await prisma.transaction.create({
      data: {
        pollId: await pollOf(world.debtInA),
        fromUserId: vera.id,
        toUserId: world.borisId,
        amount: 210,
        status: 'PAID',
      },
    });
    await prisma.transaction.update({
      where: { id: world.debtInA },
      data: { status: 'PAID' },
    });

    await Promise.all([
      post('/api/budget/confirm-payment', borisToken, { transactionId: world.debtInA }),
      post('/api/budget/confirm-payment', borisToken, { transactionId: veraDebt.id }),
    ]);

    expect(await statusOf(world.debtInA)).toBe('CONFIRMED');
    expect(await statusOf(veraDebt.id)).toBe('CONFIRMED');
    expect(await eventsOf('DEBTS_ALL_CONFIRMED')).toHaveLength(1);
  });

  it('отмена отметки ставит уведомление получателю', async () => {
    downBot();
    await post('/api/budget/mark-paid', annaToken, { transactionId: world.debtInA });
    await post('/api/budget/cancel-mark', annaToken, { transactionId: world.debtInA });

    const [job] = await eventsOf('DEBT_MARK_CANCELLED');
    expect(job.recipientChatId).toBe(String(BORIS_TELEGRAM_ID));

    const bot = recordingBot();
    await makeQueueDue();
    await OutboxWorkerService.tick();

    /* «Получена оплата» устарело и не уходит; уходит только отмена. */
    expect(bot.sent).toHaveLength(1);
    const [cancelled] = await eventsOf('DEBT_MARK_CANCELLED');
    expect(cancelled.status).toBe('SENT');
    const [marked] = await eventsOf('DEBT_MARKED_PAID');
    expect(marked.status).toBe('SUPERSEDED');
  });

  /* Старое сообщение «оплата подтверждена» переписывается, И должник
     получает новое: ему уже сказали, что долг закрыт. */
  it('отмена подтверждения правит старое сообщение и шлёт новое', async () => {
    await attachDebtMessage(world.debtInA);
    recordingBot();
    await markAndConfirm(world.debtInA);
    await settleDelivery();

    const bot = recordingBot();
    await post('/api/budget/undo-confirmation', borisToken, {
      transactionId: world.debtInA,
    });
    await settleDelivery();

    expect(bot.edited).toEqual([
      expect.objectContaining({ messageId: DEBT_MESSAGE_ID }),
    ]);
    const toAnna = bot.sent.filter(m => m.chatId === ANNA_TELEGRAM_ID);
    expect(toAnna).toHaveLength(1);
    const [undone] = await eventsOf('DEBT_CONFIRMATION_UNDONE');
    expect(undone.status).toBe('SENT');
  });

  it('кнопка «Все оплатили» ставит уведомление каждому должнику и сводку', async () => {
    downBot();
    await post('/api/budget/mark-all-paid', borisToken, {
      pollId: await pollOf(world.debtInA),
    });
    expect(await statusOf(world.debtInA)).toBe('CONFIRMED');

    const [confirmed] = await eventsOf('DEBT_CONFIRMED');
    expect(confirmed.recipientChatId).toBe(String(ANNA_TELEGRAM_ID));
    const [summary] = await eventsOf('DEBTS_ALL_CONFIRMED');
    expect(summary.recipientChatId).toBe(String(BORIS_TELEGRAM_ID));

    const bot = recordingBot();
    await makeQueueDue();
    await OutboxWorkerService.tick();

    expect(bot.sent.filter(m => m.chatId === BORIS_TELEGRAM_ID)).toHaveLength(1);
    expect(bot.sent.filter(m => m.chatId === ANNA_TELEGRAM_ID)).toHaveLength(1);
    expect((await eventsOf('DEBTS_ALL_CONFIRMED'))[0].status).toBe('SENT');
    expect((await eventsOf('DEBT_CONFIRMED'))[0].status).toBe('SENT');
  });

  /* Два должника: каждому своё задание, получателю — одна сводка на всю сумму. */
  it('«Все оплатили» на двух должников: два задания и сводка на 600', async () => {
    recordingBot();
    const vera = await prisma.user.create({
      data: { telegramId: BigInt(700000203), firstName: 'Вера' },
    });
    const veraDebt = await prisma.transaction.create({
      data: {
        pollId: await pollOf(world.debtInA),
        fromUserId: vera.id,
        toUserId: world.borisId,
        amount: 210,
        status: 'PAID',
      },
    });

    await post('/api/budget/mark-all-paid', borisToken, {
      pollId: await pollOf(world.debtInA),
    });

    expect(await statusOf(world.debtInA)).toBe('CONFIRMED');
    expect(await statusOf(veraDebt.id)).toBe('CONFIRMED');
    const confirmed = await eventsOf('DEBT_CONFIRMED');
    expect(confirmed.map(e => e.recipientChatId).sort()).toEqual(
      [String(ANNA_TELEGRAM_ID), '700000203'].sort()
    );
    const summaries = await eventsOf('DEBTS_ALL_CONFIRMED');
    expect(summaries).toHaveLength(1);
    expect(Number.parseFloat((summaries[0].payload as { total: string }).total)).toBe(600);

    // Повторное нажатие: закрывать нечего, новых заданий нет.
    await post('/api/budget/mark-all-paid', borisToken, {
      pollId: await pollOf(world.debtInA),
    });
    expect(await prisma.outboxEvent.count()).toBe(3);
  });

  /* Анна не сборщик этого заказа: её нажатие не закрывает чужие долги.
     Маршрут отвечает успехом (закрывать «своё» нечего), но в базе ничего не
     меняется — это и проверяется. */
  it('«Все оплатили» от не-сборщика долгов не закрывает', async () => {
    recordingBot();

    await post('/api/budget/mark-all-paid', annaToken, {
      pollId: await pollOf(world.debtInA),
    });

    expect(await statusOf(world.debtInA)).toBe('PENDING');
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  describe('магазинные долги из кнопок бота', () => {
    async function storeRunOf(txId: number): Promise<number> {
      return (await prisma.transaction.findUnique({ where: { id: txId } }))!
        .storeRunId!;
    }

    async function versionOf(txId: number): Promise<number> {
      return (await prisma.transaction.findUnique({ where: { id: txId } }))!
        .transitionVersion;
    }

    it('отметка и подтверждение поднимают версию и идут через очередь', async () => {
      downBot();
      const runB = await storeRunOf(world.debtInB);

      await expect(
        StoreRunBudgetService.markStoreRunPaidByDebtor(runB, ANNA_TELEGRAM_ID)
      ).resolves.toEqual(expect.objectContaining({ count: 1 }));
      expect(await statusOf(world.debtInB)).toBe('PAID');
      expect(await versionOf(world.debtInB)).toBe(1);

      const [marked] = await eventsOf('STORE_RUN_MARKED_PAID');
      expect(marked.recipientChatId).toBe(String(BORIS_TELEGRAM_ID));

      await expect(
        StoreRunBudgetService.confirmStoreRunByDebtor(
          runB,
          world.annaId,
          BORIS_TELEGRAM_ID
        )
      ).resolves.toEqual({ count: 1 });
      expect(await statusOf(world.debtInB)).toBe('CONFIRMED');
      expect(await versionOf(world.debtInB)).toBe(2);

      /* Текст тот же, что у подтверждения долга по опросу, — и тип тот же. */
      const [confirmed] = await eventsOf('DEBT_CONFIRMED');
      expect(confirmed.recipientChatId).toBe(String(ANNA_TELEGRAM_ID));

      /* Telegram восстановился. Должник узнаёт о подтверждении, а устаревшее
         «получена оплата, подтверди» инициатору уже не уходит: он подтвердил. */
      const bot = recordingBot();
      await makeQueueDue();
      await OutboxWorkerService.tick();

      expect(bot.sent).toEqual([expect.objectContaining({ chatId: ANNA_TELEGRAM_ID })]);
      const delivered = await prisma.outboxEvent.findUnique({ where: { id: confirmed.id } });
      expect(delivered!.status).toBe('SENT');
      const stale = await prisma.outboxEvent.findUnique({ where: { id: marked.id } });
      expect(stale!.status).toBe('SUPERSEDED');
    });

    it('двойное нажатие «Оплатил» даёт одно задание', async () => {
      recordingBot();
      const runB = await storeRunOf(world.debtInB);

      const results = await Promise.all([
        StoreRunBudgetService.markStoreRunPaidByDebtor(runB, ANNA_TELEGRAM_ID),
        StoreRunBudgetService.markStoreRunPaidByDebtor(runB, ANNA_TELEGRAM_ID),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await eventsOf('STORE_RUN_MARKED_PAID')).toHaveLength(1);
    });
  });
});

/** Изменяющий запрос бюджета без `.expect`: отказы проверяются по ответу. */
function budgetPost(path: string, token: string, body: object) {
  return request(app)
    .post(path)
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', uniqueKey('budget'))
    .send(body);
}

async function setDebt(id: number, data: { status: string; confirmedAt?: Date | null }) {
  await prisma.transaction.update({
    where: { id },
    data: { paidAt: new Date(), ...data },
  });
}

/**
 * Отказы на переходах долга, которых нет в «ограничениях ролей».
 *
 * Каждый отказ проверяется и по ответу, и по строке в базе: ответ без
 * неизменной строки — половина дела.
 */
describe('отказы на переходах долга', () => {
  it.each([
    '/api/budget/mark-paid',
    '/api/budget/confirm-payment',
    '/api/budget/undo-confirmation',
    '/api/budget/cancel-mark',
    '/api/budget/send-reminder',
  ])('%s: неизвестный долг — 404', async path => {
    const response = await budgetPost(path, borisToken, { transactionId: 999_999 });

    expect(response.status).toBe(404);
  });

  it('отменить подтверждение должник не может — 403', async () => {
    await setDebt(world.debtInA, { status: 'CONFIRMED', confirmedAt: new Date() });

    const response = await budgetPost('/api/budget/undo-confirmation', annaToken, {
      transactionId: world.debtInA,
    });

    expect(response.status).toBe(403);
    expect(await statusOf(world.debtInA)).toBe('CONFIRMED');
  });

  /* Окно — сутки с подтверждения: позже это уже переписывание истории. Время
     подтверждения засеяно в базе, часы не подменяются. Без времени
     подтверждения окно не открывается вовсе. */
  it.each([
    ['25 часов назад', new Date(Date.now() - 25 * 60 * 60 * 1000)],
    ['неизвестно когда', null],
  ])('подтверждение %s не отменить — 409 UNDO_WINDOW_EXPIRED', async (_label, confirmedAt) => {
    await setDebt(world.debtInA, { status: 'CONFIRMED', confirmedAt });

    const response = await budgetPost('/api/budget/undo-confirmation', borisToken, {
      transactionId: world.debtInA,
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('UNDO_WINDOW_EXPIRED');
    expect(await statusOf(world.debtInA)).toBe('CONFIRMED');
  });

  it('неподтверждённый долг отменять нечего — 409 WRONG_STATUS', async () => {
    await setDebt(world.debtInA, { status: 'PAID' });

    const response = await budgetPost('/api/budget/undo-confirmation', borisToken, {
      transactionId: world.debtInA,
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('WRONG_STATUS');
    expect(await statusOf(world.debtInA)).toBe('PAID');
  });

  it('снять отметку может только должник — 403', async () => {
    await setDebt(world.debtInA, { status: 'PAID' });

    const response = await budgetPost('/api/budget/cancel-mark', borisToken, {
      transactionId: world.debtInA,
    });

    expect(response.status).toBe(403);
    expect(await statusOf(world.debtInA)).toBe('PAID');
  });

  it('с подтверждённого долга отметку не снять', async () => {
    await setDebt(world.debtInA, { status: 'CONFIRMED', confirmedAt: new Date() });

    const response = await budgetPost('/api/budget/cancel-mark', annaToken, {
      transactionId: world.debtInA,
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await statusOf(world.debtInA)).toBe('CONFIRMED');
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('повторное снятие отметки не повторяет уведомление', async () => {
    await budgetPost('/api/budget/mark-paid', annaToken, { transactionId: world.debtInA }).expect(200);
    await budgetPost('/api/budget/cancel-mark', annaToken, { transactionId: world.debtInA }).expect(200);
    await budgetPost('/api/budget/cancel-mark', annaToken, { transactionId: world.debtInA }).expect(200);

    expect(await statusOf(world.debtInA)).toBe('PENDING');
    expect(
      await prisma.outboxEvent.count({ where: { messageType: 'DEBT_MARK_CANCELLED' } })
    ).toBe(1);
  });

  it.each(['CONFIRMED', 'FORGIVEN'])(
    'закрытый долг (%s) снова отметить оплаченным нельзя',
    async status => {
      await setDebt(world.debtInA, { status, confirmedAt: new Date() });

      const response = await budgetPost('/api/budget/mark-paid', annaToken, {
        transactionId: world.debtInA,
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await statusOf(world.debtInA)).toBe(status);
      expect(await prisma.outboxEvent.count()).toBe(0);
    }
  );

  // BUG: ожидаемый отказ на закрытом долге отвечает 500 «Failed to mark as paid» — как поломка сервера, а не 4xx.
  it.failing.each(['CONFIRMED', 'FORGIVEN'])(
    'закрытый долг (%s): отказ — ошибка клиента, а не сервера',
    async status => {
      await setDebt(world.debtInA, { status, confirmedAt: new Date() });

      const response = await budgetPost('/api/budget/mark-paid', annaToken, {
        transactionId: world.debtInA,
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    }
  );
});

/**
 * Ручное напоминание должнику. Telegram подменён на границе: фальшивый бот
 * сериализует запрос, как настоящий клиент, и может «быть заблокирован».
 */
describe('напоминание должнику', () => {
  interface Reminder {
    chatId: unknown;
    text: string;
    keyboard?: Array<Array<{ url?: string }>>;
  }

  function reminderBot(blockedChatId?: number): Reminder[] {
    const sent: Reminder[] = [];
    setBotInstance({
      api: {
        sendMessage: async (
          chatId: unknown,
          text: string,
          options?: { reply_markup?: { inline_keyboard: Array<Array<{ url?: string }>> } }
        ) => {
          JSON.stringify({ chat_id: chatId, text, ...options });
          if (Number(chatId) === blockedChatId) {
            throw Object.assign(new Error('Forbidden: bot was blocked by the user'), {
              error_code: 403,
            });
          }
          sent.push({ chatId, text, keyboard: options?.reply_markup?.inline_keyboard });
          return { message_id: sent.length };
        },
      },
    } as unknown as Parameters<typeof setBotInstance>[0]);
    return sent;
  }

  function remind(token: string, transactionId: number) {
    return budgetPost('/api/budget/send-reminder', token, { transactionId });
  }

  const debtRow = (id: number) => prisma.transaction.findUniqueOrThrow({ where: { id } });

  it('получатель напоминает: сообщение должнику, счётчик и запись', async () => {
    const sent = reminderBot();

    const response = await remind(borisToken, world.debtInA);

    expect(response.status).toBe(200);
    expect(sent.map(m => m.chatId)).toEqual([ANNA_TELEGRAM_ID]);
    const row = await debtRow(world.debtInA);
    expect(row.reminderCount).toBe(1);
    expect(row.lastReminderAt).not.toBeNull();
    expect(await prisma.paymentReminder.count({ where: { transactionId: world.debtInA } })).toBe(1);
  });

  it('должник напомнить не может — 403, ничего не уходит', async () => {
    const sent = reminderBot();

    const response = await remind(annaToken, world.debtInA);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(sent).toHaveLength(0);
    expect((await debtRow(world.debtInA)).reminderCount).toBe(0);
  });

  it('повтор раньше 6 часов — 429, второго сообщения нет', async () => {
    const sent = reminderBot();
    await remind(borisToken, world.debtInA).expect(200);

    const again = await remind(borisToken, world.debtInA);

    expect(again.status).toBe(429);
    expect(again.body.code).toBe('REMINDER_COOLDOWN');
    expect(sent).toHaveLength(1);
    expect((await debtRow(world.debtInA)).reminderCount).toBe(1);

    /* Чужой получает отказ по правам, а не паузу: иначе по ответу он узнал бы,
       когда напоминали последний раз. */
    const outsider = await remind(annaToken, world.debtInA);
    expect(outsider.status).toBe(403);
  });

  it('через 6 часов напомнить снова можно', async () => {
    const sent = reminderBot();
    await prisma.transaction.update({
      where: { id: world.debtInA },
      data: { reminderCount: 1, lastReminderAt: new Date(Date.now() - 7 * 60 * 60 * 1000) },
    });

    await remind(borisToken, world.debtInA).expect(200);

    expect(sent).toHaveLength(1);
    expect((await debtRow(world.debtInA)).reminderCount).toBe(2);
  });

  /* Раньше результат отправки не читался: заблокированный бот отвечал
     «Reminder sent», и приложение писало «Напоминание отправлено». */
  it('недоставленное напоминание — 422, счётчик не растёт', async () => {
    reminderBot(ANNA_TELEGRAM_ID);

    const response = await remind(borisToken, world.debtInA);

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('REMINDER_UNDELIVERABLE');
    const row = await debtRow(world.debtInA);
    expect(row.reminderCount).toBe(0);
    expect(row.lastReminderAt).toBeNull();
    expect(await prisma.paymentReminder.count()).toBe(0);
  });

  /* Реквизиты в базе зашифрованы: пока напоминание брало их сырыми, должник
     получал шифротекст. Ссылка СБП уходит кнопкой — в legacy-Markdown тексте
     ссылку не кладём. */
  it('реквизиты получателя уходят расшифрованными, ссылка — кнопкой', async () => {
    const link = 'https://qr.nspk.ru/AS1000TEST';
    await request(app)
      .put('/api/user/payment-info')
      .set('Authorization', `Bearer ${borisToken}`)
      .send({ paymentPhone: '+7 999 123-45-67', paymentCard: link })
      .expect(200);
    const sent = reminderBot();

    await remind(borisToken, world.debtInA).expect(200);

    expect(sent[0].text).toContain('+7 999 123-45-67');
    expect(sent[0].text).not.toContain(link);
    expect(sent[0].keyboard?.flat().map(button => button.url)).toEqual([link]);
  });

  /* Номер карты из времён до шифрования лежит открытым текстом. Полностью в
     сообщение он не попадает, и кнопки перевода у него нет. */
  it('старый номер карты маскируется и кнопки не даёт', async () => {
    await prisma.user.update({
      where: { id: world.borisId },
      data: { paymentCard: '4276123456789012' },
    });
    const sent = reminderBot();

    await remind(borisToken, world.debtInA).expect(200);

    expect(sent[0].text).not.toContain('4276123456789012');
    expect(sent[0].text).toContain('9012');
    expect(sent[0].keyboard).toBeUndefined();
  });

  it('без бота — отказ, и напоминание не засчитывается', async () => {
    setBotInstance(null as unknown as Parameters<typeof setBotInstance>[0]);

    const response = await remind(borisToken, world.debtInA);

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect((await debtRow(world.debtInA)).reminderCount).toBe(0);
    expect(await prisma.paymentReminder.count()).toBe(0);
  });

  it('всем должникам заказа: счётчик растёт только у доставленных', async () => {
    const vera = await prisma.user.create({
      data: { telegramId: BigInt(700000203), firstName: 'Вера' },
    });
    const pollId = (await prisma.transaction.findUniqueOrThrow({ where: { id: world.debtInA } }))
      .pollId!;
    const veraDebt = await prisma.transaction.create({
      data: { pollId, fromUserId: vera.id, toUserId: world.borisId, amount: 210, status: 'PENDING' },
    });
    reminderBot(700000203);

    const response = await budgetPost('/api/budget/send-reminders-all', borisToken, { pollId });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ sentCount: 1, failedCount: 1, totalCount: 2 });
    expect(response.body.failedUsers.map((u: { id: number }) => u.id)).toEqual([vera.id]);
    expect((await debtRow(world.debtInA)).reminderCount).toBe(1);
    expect((await debtRow(veraDebt.id)).reminderCount).toBe(0);
  });
});

/**
 * Чтения бюджета: приватность реквизитов и область команды.
 *
 * «Изоляция команд» выше проверяет `/debts`; здесь то же для `/credits` и
 * `/stats`, плюс реквизиты — они в базе зашифрованы и ходят только в одну
 * сторону: должник видит реквизиты получателя, и больше никто ничьи.
 */
describe('чтение бюджета: реквизиты и область команды', () => {
  const BORIS_PHONE = '+7 999 123-45-67';
  const ANNA_PHONE = '+7 911 000-00-00';

  async function setPhone(token: string, paymentPhone: string, paymentDetails?: string) {
    await request(app)
      .put('/api/user/payment-info')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentPhone, ...(paymentDetails ? { paymentDetails } : {}) })
      .expect(200);
  }

  async function storedPhone(userId: number): Promise<string> {
    return (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).paymentPhone!;
  }

  function get(path: string, token: string, query: Record<string, unknown> = {}) {
    return request(app).get(path).query(query).set('Authorization', `Bearer ${token}`);
  }

  it('в долгах реквизиты получателя расшифрованы, своих реквизитов нет', async () => {
    await setPhone(borisToken, BORIS_PHONE, 'Т-Банк');
    await setPhone(annaToken, ANNA_PHONE);
    // В базе шифротекст — иначе проверка расшифровки ничего бы не доказывала.
    expect(await storedPhone(world.borisId)).not.toBe(BORIS_PHONE);

    const response = await get('/api/budget/debts', annaToken, { groupId: world.teamAId });

    expect(response.status).toBe(200);
    expect(response.body.data[0].toUser).toMatchObject({
      paymentPhone: BORIS_PHONE,
      paymentDetails: 'Т-Банк',
    });
    const body = JSON.stringify(response.body);
    expect(body).not.toContain(ANNA_PHONE);
    expect(body).not.toContain(await storedPhone(world.annaId));
  });

  it('в кредитах реквизитов должника нет ни в каком виде', async () => {
    await setPhone(annaToken, ANNA_PHONE);

    const response = await get('/api/budget/credits', borisToken);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    const body = JSON.stringify(response.body);
    expect(body).not.toContain(ANNA_PHONE);
    expect(body).not.toContain(await storedPhone(world.annaId));
  });

  it('кредиты по команде: ровно эта команда, чужая — 403', async () => {
    const teamA = await get('/api/budget/credits', borisToken, { groupId: world.teamAId });
    const teamB = await get('/api/budget/credits', borisToken, { groupId: world.teamBId });
    const foreign = await get('/api/budget/credits', annaToken, { groupId: world.teamCId });

    expect(teamA.body.data.map((tx: { amount: string }) => Number(tx.amount))).toEqual([390]);
    expect(teamB.body.data.map((tx: { amount: string }) => Number(tx.amount))).toEqual([450]);
    expect(foreign.status).toBe(403);
  });

  /* Долг Анны в команде Б (450) в статистику команды А не входит. */
  it('статистика по команде: только эта команда, чужая — 403', async () => {
    const teamA = await get('/api/budget/stats', annaToken, { groupId: world.teamAId });
    const all = await get('/api/budget/stats', annaToken);
    const foreign = await get('/api/budget/stats', annaToken, { groupId: world.teamCId });

    expect(teamA.body.data).toMatchObject({ totalSpent: 390, totalReceived: 0, totalOrders: 1 });
    expect(all.body.data).toMatchObject({ totalSpent: 840, totalOrders: 2 });
    expect(foreign.status).toBe(403);
  });

  it('диапазон дат ограничивает статистику', async () => {
    await prisma.transaction.update({
      where: { id: world.debtInB },
      data: { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    });

    const response = await get('/api/budget/stats', annaToken, {
      from: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(response.body.data).toMatchObject({ totalSpent: 390, totalOrders: 1 });
  });

  /* Реквизиты из времён до шифрования лежат открытым текстом и должны дойти
     до должника как есть. */
  it('реквизиты без шифрования отдаются как есть', async () => {
    await prisma.user.update({
      where: { id: world.borisId },
      data: { paymentDetails: 'Сбер, Борис' },
    });

    const response = await get('/api/budget/debts', annaToken, { groupId: world.teamAId });

    expect(response.body.data[0].toUser.paymentDetails).toBe('Сбер, Борис');
  });

  /* Магазинный долг без названия позиции показывал на экране одно имя и сумму. */
  it('магазинный долг приходит с названием и количеством позиции', async () => {
    const storeRunId = (await prisma.transaction.findUniqueOrThrow({ where: { id: world.debtInB } }))
      .storeRunId!;
    const item = await prisma.storeItem.create({
      data: { storeRunId, userId: world.annaId, name: 'Молоко', quantity: 2, status: 'BOUGHT' },
    });
    await prisma.transaction.update({ where: { id: world.debtInB }, data: { storeItemId: item.id } });

    const debts = await get('/api/budget/debts', annaToken, { groupId: world.teamBId });
    const credits = await get('/api/budget/credits', borisToken, { groupId: world.teamBId });

    expect(debts.body.data[0].storeItem).toMatchObject({ name: 'Молоко', quantity: 2 });
    expect(credits.body.data[0].storeItem).toMatchObject({ name: 'Молоко', quantity: 2 });
  });

  /* Получатель вышел из команды: незакрытый долг ему больше не показывается
     среди активных. */
  it('activeOnly скрывает долг перед вышедшим из команды', async () => {
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId: world.teamAId, userId: world.borisId } },
      data: { isActive: false, leftAt: new Date() },
    });

    const response = await get('/api/budget/debts', annaToken, { activeOnly: 'true' });

    expect(response.body.data.map((tx: { id: number }) => tx.id)).toEqual([world.debtInB]);
  });

  it('чужой userId в запросе игнорируется: долги берутся по токену', async () => {
    const response = await get('/api/budget/debts', borisToken, { userId: world.annaId });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('activeOnly скрывает закрытые долги', async () => {
    await setDebt(world.debtInB, { status: 'CONFIRMED', confirmedAt: new Date() });

    const response = await get('/api/budget/debts', annaToken, { activeOnly: 'true' });

    expect(response.body.data.map((tx: { id: number }) => tx.id)).toEqual([world.debtInA]);
  });
});

/**
 * Итоги и разбивка заказа: суммы чужих людей, поэтому только участникам
 * группы заказа. Флаг `users.is_admin` когда-то открывал бюджет любой группы.
 */
describe('итоги заказа: только участникам группы заказа', () => {
  const PATHS = ['poll-totals', 'order-costs', 'poll-breakdown'];

  async function pollInTeamC(): Promise<number> {
    return (
      await prisma.poll.create({
        data: { groupId: world.teamCId, status: 'COMPLETED', createdBy: world.borisId },
      })
    ).id;
  }

  function get(path: string, pollId: number, token: string) {
    return request(app)
      .get(`/api/budget/${path}/${pollId}`)
      .set('Authorization', `Bearer ${token}`);
  }

  it.each(PATHS)('%s: не участник группы — 403, даже с флагом is_admin', async path => {
    const pollId = await pollInTeamC();
    await prisma.user.update({ where: { id: world.annaId }, data: { isAdmin: true } });

    const response = await get(path, pollId, annaToken);

    expect(response.status).toBe(403);
  });

  it.each(PATHS)('%s: неизвестное голосование — 404', async path => {
    const response = await get(path, 999_999, annaToken);

    expect(response.status).toBe(404);
  });

  it('участник группы получает разбивку по долгам заказа', async () => {
    const pollId = (await prisma.transaction.findUniqueOrThrow({ where: { id: world.debtInA } }))
      .pollId!;

    const response = await get('poll-breakdown', pollId, borisToken);

    expect(response.status).toBe(200);
    expect(response.body.data.transactions).toEqual([
      expect.objectContaining({ userId: world.annaId, totalAmount: 390 }),
    ]);
  });
});
