/**
 * Админка группы через НАСТОЯЩИЙ API: express, PostgreSQL, Redis.
 *
 * Здесь деньги и права. Прежние модульные тесты подменяли
 * `GroupService.isUserGroupAdmin` и Prisma, поэтому правило доступа и переход
 * денежного статуса не выполнялись ни разу: тест сверял, какие аргументы
 * контроллер передал в мок. Здесь проверяется исход — ответ и строки в базе.
 *
 * Redis обязателен: изменяющие маршруты `/api/admin` объявлены `required: true`
 * в middleware идемпотентности и без хранилища отвечают 503.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { setBotInstance } from '../../../bot/bot-instance';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { addMember, idemKey, tokenFor } from '../helpers/api';

let app: ReturnType<typeof createTestApp>;

const TG = {
  clara: 710000101, // создатель группы А
  alex: 710000102, // админ группы А
  misha: 710000103, // рядовой участник А
  inna: 710000104, // бывший админ А: членство неактивно
  boris: 710000105, // создатель группы Б, в А не состоит
  dima: 710000106, // участник А и Б, должник
} as const;
type Person = keyof typeof TG;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

interface World {
  user: Record<Person, number>;
  groupA: number;
  groupB: number;
  menuItemA: number;
  activePoll: number;
  oldPoll: number;
  oldEmptyPoll: number;
  debtA: number;
  debtB: number;
}

/**
 * Две группы и шесть человек.
 *
 * В группе А есть всё, на что может посягнуть чужой: живой долг, закрытый
 * старый долг, пустое старое голосование (его удалила бы очистка), активное
 * голосование со снимком участников. Без этого «в базе ничего не поменялось»
 * было бы правдой и при снятой проверке прав.
 */
async function buildWorld(): Promise<World> {
  const user = {} as Record<Person, number>;
  for (const [name, telegramId] of Object.entries(TG) as Array<[Person, number]>) {
    const row = await prisma.user.create({
      data: { telegramId: BigInt(telegramId), firstName: name },
    });
    user[name] = row.id;
  }

  const groupA = (
    await prisma.group.create({ data: { telegramId: BigInt(-100000000201), title: 'Группа А' } })
  ).id;
  const groupB = (
    await prisma.group.create({ data: { telegramId: BigInt(-100000000202), title: 'Группа Б' } })
  ).id;

  await addMember(groupA, user.clara, 'CREATOR');
  await addMember(groupA, user.alex, 'ADMIN');
  await addMember(groupA, user.misha, 'MEMBER');
  await addMember(groupA, user.inna, 'ADMIN', { isActive: false, leftAt: daysAgo(3) });
  await addMember(groupA, user.dima, 'MEMBER');
  await addMember(groupB, user.boris, 'CREATOR');
  await addMember(groupB, user.dima, 'MEMBER');

  const menuItemA = (
    await prisma.menuItem.create({
      data: { name: 'Плов', price: 300, groupId: groupA, createdBy: user.clara },
    })
  ).id;

  const activePoll = (
    await prisma.poll.create({ data: { groupId: groupA, status: 'ACTIVE', createdBy: user.clara } })
  ).id;
  await prisma.pollParticipant.createMany({
    data: [
      { pollId: activePoll, userId: user.dima, status: 'EXPECTED' },
      { pollId: activePoll, userId: user.misha, status: 'EXPECTED' },
    ],
  });
  await prisma.vote.create({
    data: { pollId: activePoll, userId: user.dima, menuItemId: menuItemA },
  });

  const oldPoll = (
    await prisma.poll.create({
      data: { groupId: groupA, status: 'COMPLETED', createdBy: user.clara, endedAt: daysAgo(40) },
    })
  ).id;
  const oldEmptyPoll = (
    await prisma.poll.create({
      data: { groupId: groupA, status: 'COMPLETED', createdBy: user.clara, endedAt: daysAgo(40) },
    })
  ).id;
  const pollB = (
    await prisma.poll.create({
      data: { groupId: groupB, status: 'COMPLETED', createdBy: user.boris, endedAt: daysAgo(40) },
    })
  ).id;

  const debtA = (
    await prisma.transaction.create({
      data: { pollId: oldPoll, fromUserId: user.dima, toUserId: user.clara, amount: 100, status: 'PENDING' },
    })
  ).id;
  await prisma.transaction.create({
    data: {
      pollId: oldPoll,
      fromUserId: user.misha,
      toUserId: user.clara,
      amount: 70,
      status: 'CONFIRMED',
      paidAt: daysAgo(40),
      confirmedAt: daysAgo(40),
    },
  });
  const debtB = (
    await prisma.transaction.create({
      data: { pollId: pollB, fromUserId: user.dima, toUserId: user.boris, amount: 1000, status: 'PENDING' },
    })
  ).id;

  return { user, groupA, groupB, menuItemA, activePoll, oldPoll, oldEmptyPoll, debtA, debtB };
}

interface Sent {
  chatId: unknown;
  text: string;
}

/**
 * Бот на границе с Telegram. Настоящий клиент сериализует запрос в JSON, и
 * BigInt там бросает TypeError, — фальшивый делает то же самое, иначе он
 * пропустил бы ошибку, которую в бою ловит Telegram.
 */
function fakeBot(failFor: (chatId: number) => Error | undefined = () => undefined): Sent[] {
  const sent: Sent[] = [];
  setBotInstance({
    api: {
      sendMessage: async (chatId: unknown, text: string, options?: object) => {
        JSON.stringify({ chat_id: chatId, text, ...options });
        const failure = failFor(Number(chatId));
        if (failure) throw failure;
        sent.push({ chatId, text });
        return { message_id: sent.length };
      },
    },
  } as unknown as Parameters<typeof setBotInstance>[0]);
  return sent;
}

function noBot(): void {
  setBotInstance(null as unknown as Parameters<typeof setBotInstance>[0]);
}

const blocked = () => Object.assign(new Error('Forbidden: bot was blocked by the user'), { error_code: 403 });

let w: World;
let token: Record<Person, string>;

async function freshWorld(): Promise<void> {
  await cleanDatabase();
  w = await buildWorld();
  token = {} as Record<Person, string>;
  for (const [name, telegramId] of Object.entries(TG) as Array<[Person, number]>) {
    token[name] = await tokenFor(app, telegramId);
  }
}

type Method = 'get' | 'put' | 'post' | 'delete';

function call(method: Method, path: string, as: Person, body?: object) {
  const req = request(app)[method](path)
    .set('Authorization', `Bearer ${token[as]}`)
    .set('Idempotency-Key', idemKey('admin'));
  return body ? req.send(body) : req;
}

/** Всё, что может испортить админка: состав, деньги, голосования, настройки. */
async function snapshot(): Promise<string> {
  const byId = { orderBy: { id: 'asc' as const } };
  const state = await Promise.all([
    prisma.groupMember.findMany(byId),
    prisma.transaction.findMany(byId),
    prisma.poll.findMany(byId),
    prisma.pollParticipant.findMany(byId),
    prisma.debtReminderSettings.findMany(byId),
    prisma.adminNotificationSettings.findMany(byId),
  ]);
  return JSON.stringify(state, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
}

async function debt(id: number) {
  return prisma.transaction.findUniqueOrThrow({ where: { id } });
}

async function member(groupId: number, userId: number) {
  return prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
}

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

/**
 * Все маршруты `/api/admin`, каждый — с запросом, который ИЗМЕНИЛ БЫ базу или
 * отправил бы сообщения, пройди он проверку прав. Порядок важен для таблицы
 * «создатель проходит»: напоминания идут раньше списания и очистки.
 */
interface RouteCase {
  name: string;
  method: Method;
  path: (w: World) => string;
  body?: (w: World) => object;
}

const ROUTES: RouteCase[] = [
  { name: 'GET /users', method: 'get', path: w => `/api/admin/users?groupId=${w.groupA}` },
  {
    name: 'GET /users/:userId/stats',
    method: 'get',
    path: w => `/api/admin/users/${w.user.dima}/stats?groupId=${w.groupA}`,
  },
  {
    name: 'PUT /users/:userId/admin',
    method: 'put',
    path: w => `/api/admin/users/${w.user.misha}/admin?groupId=${w.groupA}`,
    body: () => ({ isAdmin: true }),
  },
  {
    name: 'PUT /users/:userId/active',
    method: 'put',
    path: w => `/api/admin/users/${w.user.misha}/active?groupId=${w.groupA}`,
    body: () => ({ isActive: false }),
  },
  {
    name: 'PUT /users/:userId/participates-in-polls',
    method: 'put',
    path: w => `/api/admin/users/${w.user.misha}/participates-in-polls?groupId=${w.groupA}`,
    body: () => ({ participates: false }),
  },
  /* У маршрутов голосования группа берётся у самого голосования. `groupId`
     группы Б в запросе — попытка Бориса пройти проверку своей группой. */
  {
    name: 'GET /polls/:pollId/participants',
    method: 'get',
    path: w => `/api/admin/polls/${w.activePoll}/participants?groupId=${w.groupB}`,
  },
  {
    name: 'PUT /polls/:pollId/participants/:userId',
    method: 'put',
    path: w => `/api/admin/polls/${w.activePoll}/participants/${w.user.dima}?groupId=${w.groupB}`,
    body: () => ({ status: 'EXCLUDED' }),
  },
  { name: 'GET /debtors', method: 'get', path: w => `/api/admin/debtors?groupId=${w.groupA}` },
  { name: 'GET /debt-stats', method: 'get', path: w => `/api/admin/debt-stats?groupId=${w.groupA}` },
  {
    name: 'POST /debts/remind-all',
    method: 'post',
    path: w => `/api/admin/debts/remind-all?groupId=${w.groupA}`,
  },
  {
    name: 'POST /debts/:debtId/remind',
    method: 'post',
    path: w => `/api/admin/debts/${w.debtA}/remind?groupId=${w.groupA}`,
  },
  {
    name: 'POST /debts/:debtId/forgive',
    method: 'post',
    path: w => `/api/admin/debts/${w.debtA}/forgive?groupId=${w.groupA}`,
  },
  {
    name: 'DELETE /cleanup/old-polls',
    method: 'delete',
    path: w => `/api/admin/cleanup/old-polls?groupId=${w.groupA}&daysOld=1`,
  },
  {
    name: 'DELETE /cleanup/old-transactions',
    method: 'delete',
    path: w => `/api/admin/cleanup/old-transactions?groupId=${w.groupA}&daysOld=1`,
  },
  { name: 'GET /cleanup/stats', method: 'get', path: w => `/api/admin/cleanup/stats?groupId=${w.groupA}` },
  {
    name: 'GET /cleanup/preview',
    method: 'get',
    path: w => `/api/admin/cleanup/preview?groupId=${w.groupA}&daysOld=1&kind=polls`,
  },
  {
    name: 'GET /reminder-settings/:groupId',
    method: 'get',
    path: w => `/api/admin/reminder-settings/${w.groupA}`,
  },
  {
    name: 'PUT /reminder-settings/:groupId',
    method: 'put',
    path: w => `/api/admin/reminder-settings/${w.groupA}`,
    body: () => ({ isEnabled: false }),
  },
  {
    name: 'GET /notification-settings/:groupId',
    method: 'get',
    path: w => `/api/admin/notification-settings/${w.groupA}`,
  },
  {
    name: 'PUT /notification-settings/:groupId',
    method: 'put',
    path: w => `/api/admin/notification-settings/${w.groupA}`,
    body: () => ({ notifyOnPollEnd: true }),
  },
];

/* Три способа НЕ быть админом группы А: рядовой участник, админ, вышедший из
   группы, и админ другой группы. У последнего роль есть — но не здесь. */
const OUTSIDERS: Array<[Person, string]> = [
  ['misha', 'рядовой участник'],
  ['inna', 'админ с неактивным членством'],
  ['boris', 'админ другой группы'],
];

describe('права: админка группы только для админа ЭТОЙ группы', () => {
  let sent: Sent[];

  beforeAll(async () => {
    await freshWorld();
    sent = fakeBot();
  });

  it.each(
    OUTSIDERS.flatMap(([person, label]) => ROUTES.map(route => [route.name, label, person, route] as const))
  )('%s: %s получает 403, база не меняется', async (_name, _label, person, route) => {
    const before = await snapshot();
    const sentBefore = sent.length;

    const response = await call(route.method, route.path(w), person, route.body?.(w));

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(await snapshot()).toBe(before);
    expect(sent).toHaveLength(sentBefore);
  });

  it('админ (не создатель) тоже проходит', async () => {
    const response = await call('get', `/api/admin/users?groupId=${w.groupA}`, 'alex');
    expect(response.status).toBe(200);
  });

  /* Контрольная таблица: те же запросы от создателя группы проходят. Без неё
     403 выше мог бы означать сломанный запрос, а не проверку прав. Идёт
     последней: запросы меняют базу. */
  it.each(ROUTES.map(route => [route.name, route] as const))(
    '%s: создатель группы получает 200',
    async (_name, route) => {
      const response = await call(route.method, route.path(w), 'clara', route.body?.(w));
      expect(response.status).toBe(200);
    }
  );
});

describe('списание долга', () => {
  beforeEach(freshWorld);

  it('админ группы списывает долг: статус FORGIVEN', async () => {
    const response = await call('post', `/api/admin/debts/${w.debtA}/forgive?groupId=${w.groupA}`, 'clara');

    expect(response.status).toBe(200);
    const row = await debt(w.debtA);
    expect(row.status).toBe('FORGIVEN');
    expect(row.confirmedAt).not.toBeNull();
  });

  /* Борис — создатель группы Б и проверку прав по ней проходит. Долг же из
     группы А: своим groupId чужой долг не открывается. */
  it('долг другой группы не списывается даже админом своей', async () => {
    const response = await call('post', `/api/admin/debts/${w.debtA}/forgive?groupId=${w.groupB}`, 'boris');

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect((await debt(w.debtA)).status).toBe('PENDING');
  });

  // Регрессия: чужой долг отвечал 500 — сервис бросал голый Error.
  it('долг другой группы отвечает 404, а не ошибкой сервера', async () => {
    const response = await call('post', `/api/admin/debts/${w.debtA}/forgive?groupId=${w.groupB}`, 'boris');
    expect(response.status).toBe(404);
  });
});

/**
 * Очистка необратима, а `Transaction.poll` объявлен `onDelete: Cascade`:
 * удалённое голосование уносит свои долги. Раньше вместе со «старыми
 * голосованиями» бесследно пропадали непогашенные долги за те обеды.
 */
describe('очистка старых данных', () => {
  beforeEach(freshWorld);

  async function completedPoll(groupId: number, endedDaysAgo: number, debtStatuses: string[] = []) {
    const poll = await prisma.poll.create({
      data: { groupId, status: 'COMPLETED', createdBy: w.user.clara, endedAt: daysAgo(endedDaysAgo) },
    });
    for (const status of debtStatuses) {
      await prisma.transaction.create({
        data: { pollId: poll.id, fromUserId: w.user.dima, toUserId: w.user.clara, amount: 50, status },
      });
    }
    return poll.id;
  }

  it('голосования с живыми долгами остаются; предпросмотр совпадает с фактом', async () => {
    /* Мир уже содержит в А: старое голосование с PENDING-долгом (oldPoll),
       старое пустое (oldEmptyPoll) и активное. */
    const withPaid = await completedPoll(w.groupA, 40, ['CONFIRMED', 'PAID']);
    const allClosed = await completedPoll(w.groupA, 40, ['CONFIRMED', 'FORGIVEN']);
    const recent = await completedPoll(w.groupA, 5);
    const otherGroup = await completedPoll(w.groupB, 40);

    const preview = await call('get', `/api/admin/cleanup/preview?groupId=${w.groupA}&daysOld=30&kind=polls`, 'clara');
    expect(preview.status).toBe(200);

    const cleanup = await call('delete', `/api/admin/cleanup/old-polls?groupId=${w.groupA}&daysOld=30`, 'clara');
    expect(cleanup.status).toBe(200);

    const remaining = (await prisma.poll.findMany({ select: { id: true } })).map(p => p.id);
    expect(remaining).toEqual(expect.arrayContaining([w.oldPoll, withPaid, recent, otherGroup, w.activePoll]));
    expect(remaining).not.toContain(w.oldEmptyPoll);
    expect(remaining).not.toContain(allClosed);

    // Удалено ровно то, что обещал предпросмотр, и пропущено столько же.
    expect(cleanup.body.data.deleted).toBe(2);
    expect(cleanup.body.data.skipped).toBe(2);
    expect(preview.body.data).toEqual({ deletable: 2, blockedByDebt: 2 });

    // Живые деньги на месте: PENDING и PAID долги не унесло каскадом.
    expect(await prisma.transaction.count({ where: { status: { in: ['PENDING', 'PAID'] } } })).toBe(3);
  });

  it('транзакции: удаляются только закрытые, старше срока и своей группы', async () => {
    const poll = await completedPoll(w.groupA, 5);
    const pollB = await completedPoll(w.groupB, 5);
    const tx = (pollId: number, status: string, paidDaysAgo: number | null) =>
      prisma.transaction.create({
        data: {
          pollId,
          fromUserId: w.user.dima,
          toUserId: w.user.clara,
          amount: 10,
          status,
          paidAt: paidDaysAgo === null ? null : daysAgo(paidDaysAgo),
        },
      });
    const oldConfirmed = await tx(poll, 'CONFIRMED', 100);
    const oldForgiven = await tx(poll, 'FORGIVEN', 100);
    const oldPaid = await tx(poll, 'PAID', 100);
    const freshConfirmed = await tx(poll, 'CONFIRMED', 10);
    const foreign = await tx(pollB, 'CONFIRMED', 100);

    const preview = await call(
      'get',
      `/api/admin/cleanup/preview?groupId=${w.groupA}&daysOld=90&kind=transactions`,
      'clara'
    );
    const cleanup = await call(
      'delete',
      `/api/admin/cleanup/old-transactions?groupId=${w.groupA}&daysOld=90`,
      'clara'
    );

    expect(cleanup.status).toBe(200);
    const ids = (await prisma.transaction.findMany({ select: { id: true } })).map(t => t.id);
    expect(ids).not.toContain(oldConfirmed.id);
    expect(ids).not.toContain(oldForgiven.id);
    expect(ids).toEqual(expect.arrayContaining([oldPaid.id, freshConfirmed.id, foreign.id, w.debtA, w.debtB]));
    expect(cleanup.body.data.deleted).toBe(2);
    expect(preview.body.data.deletable).toBe(2);
  });

  /* В мире два голосования группы А закончились 40 дней назад, закрытый долг
     оплачен тогда же. Старое голосование группы Б в счёт не идёт. */
  it('статистика очистки считает старое по срезам 30/60/90 дней', async () => {
    const response = await call('get', `/api/admin/cleanup/stats?groupId=${w.groupA}`, 'clara');

    expect(response.body.data).toEqual({
      oldPolls: { count30Days: 2, count60Days: 0, count90Days: 0 },
      oldTransactions: { count30Days: 1, count60Days: 0, count90Days: 0 },
    });
  });

  /* Раньше неизвестный `kind` молча подменялся на polls, и админ смотрел
     предпросмотр не того, что собирался удалить. */
  it('неизвестный вид предпросмотра — 400', async () => {
    const response = await call('get', `/api/admin/cleanup/preview?groupId=${w.groupA}&kind=users`, 'clara');
    expect(response.status).toBe(400);
  });
});

describe('состав группы', () => {
  beforeEach(freshWorld);

  it('назначение и снятие админа меняет роль в группе', async () => {
    const path = `/api/admin/users/${w.user.misha}/admin?groupId=${w.groupA}`;

    expect((await call('put', path, 'clara', { isAdmin: true })).status).toBe(200);
    expect((await member(w.groupA, w.user.misha))!.role).toBe('ADMIN');

    expect((await call('put', path, 'clara', { isAdmin: false })).status).toBe(200);
    expect((await member(w.groupA, w.user.misha))!.role).toBe('MEMBER');
  });

  it('создателя группы разжаловать нельзя', async () => {
    await call('put', `/api/admin/users/${w.user.clara}/admin?groupId=${w.groupA}`, 'alex', { isAdmin: false });

    expect((await member(w.groupA, w.user.clara))!.role).toBe('CREATOR');
  });

  it('блокировка выводит из группы, разблокировка возвращает с прежней ролью', async () => {
    const path = `/api/admin/users/${w.user.alex}/active?groupId=${w.groupA}`;

    expect((await call('put', path, 'clara', { isActive: false })).status).toBe(200);
    const left = await member(w.groupA, w.user.alex);
    expect(left!.isActive).toBe(false);
    expect(left!.leftAt).not.toBeNull();

    expect((await call('put', path, 'clara', { isActive: true })).status).toBe(200);
    const back = await member(w.groupA, w.user.alex);
    expect(back!.isActive).toBe(true);
    expect(back!.role).toBe('ADMIN');
  });

  it('флаг участия в голосованиях переключается', async () => {
    const response = await call(
      'put',
      `/api/admin/users/${w.user.misha}/participates-in-polls?groupId=${w.groupA}`,
      'clara',
      { participates: false }
    );

    expect(response.status).toBe(200);
    expect((await member(w.groupA, w.user.misha))!.participatesInPolls).toBe(false);
  });

  /* Борис в группе А не состоит: сделать его админом А через админку А
     нельзя, и его членство в Б не трогается. */
  it('человека не из группы админом не сделать', async () => {
    const before = await snapshot();

    const response = await call('put', `/api/admin/users/${w.user.boris}/admin?groupId=${w.groupA}`, 'clara', {
      isAdmin: true,
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await snapshot()).toBe(before);
  });
});

describe('участники голосования', () => {
  beforeEach(freshWorld);

  it('список показывает, кто уже проголосовал', async () => {
    const response = await call('get', `/api/admin/polls/${w.activePoll}/participants`, 'clara');

    expect(response.status).toBe(200);
    const byUser = Object.fromEntries(
      (response.body.data as Array<{ userId: number; hasVoted: boolean }>).map(p => [p.userId, p.hasVoted])
    );
    expect(byUser).toEqual({ [w.user.dima]: true, [w.user.misha]: false });
  });

  /* Миша — последний, кто ещё не голосовал. Исключили его — все ожидаемые
     проголосовали, и голосование закрывается само. */
  it('исключение последнего непроголосовавшего закрывает голосование', async () => {
    const response = await call(
      'put',
      `/api/admin/polls/${w.activePoll}/participants/${w.user.misha}`,
      'clara',
      { status: 'EXCLUDED', reason: 'в отпуске' }
    );

    expect(response.status).toBe(200);
    expect(response.body.autoClosed).toBe(true);
    const participant = await prisma.pollParticipant.findUniqueOrThrow({
      where: { pollId_userId: { pollId: w.activePoll, userId: w.user.misha } },
    });
    expect(participant.status).toBe('EXCLUDED');
    const poll = await prisma.poll.findUniqueOrThrow({ where: { id: w.activePoll } });
    expect(poll.status).toBe('COMPLETED');
  });

  /* Алекса добавили в группу после старта: в снимке его нет, и запись
     создаётся. Возврат без причины стирает прежнюю причину. */
  it('статус создаётся для того, кого нет в снимке; без причины причина стирается', async () => {
    const path = `/api/admin/polls/${w.activePoll}/participants/${w.user.alex}`;
    const row = () =>
      prisma.pollParticipant.findUnique({
        where: { pollId_userId: { pollId: w.activePoll, userId: w.user.alex } },
      });

    await call('put', path, 'clara', { status: 'EXCLUDED', reason: 'на больничном' }).expect(200);
    expect(await row()).toMatchObject({ status: 'EXCLUDED', reason: 'на больничном' });

    await call('put', path, 'clara', { status: 'EXPECTED' }).expect(200);
    expect(await row()).toMatchObject({ status: 'EXPECTED', reason: null });
  });

  /* Раньше нестроковая причина молча отбрасывалась, а статус менялся. */
  it('нестроковая причина — 400, участник не меняется', async () => {
    const before = await snapshot();

    const response = await call(
      'put',
      `/api/admin/polls/${w.activePoll}/participants/${w.user.misha}`,
      'clara',
      { status: 'EXCLUDED', reason: 42 }
    );

    expect(response.status).toBe(400);
    expect(await snapshot()).toBe(before);
  });
});

describe('напоминания должникам от админа', () => {
  beforeEach(freshWorld);

  it('рассылка всем: счётчик растёт только у долгов своей группы', async () => {
    const sent = fakeBot();
    const paidInA = await prisma.transaction.create({
      data: { pollId: w.oldPoll, fromUserId: w.user.misha, toUserId: w.user.clara, amount: 30, status: 'PAID' },
    });
    // Имена — ввод людей в Markdown-сообщении. Вход их перезаписывает, поэтому ставим после.
    await prisma.user.update({ where: { id: w.user.dima }, data: { firstName: 'Дима_К' } });
    await prisma.user.update({ where: { id: w.user.clara }, data: { firstName: 'Клара*' } });

    const response = await call('post', `/api/admin/debts/remind-all?groupId=${w.groupA}`, 'clara');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ sent: 1, total: 1 });
    expect(sent.map(m => m.chatId)).toEqual([TG.dima]);
    expect(sent[0].text).toContain('Дима\\_К');
    expect(sent[0].text).toContain('Клара\\*');
    expect((await debt(w.debtA)).reminderCount).toBe(1);
    // У Димы есть долг и в группе Б — напоминание группы А его не касается.
    expect((await debt(w.debtB)).reminderCount).toBe(0);
    expect((await debt(paidInA.id)).reminderCount).toBe(0);
  });

  it('недоставленное напоминание не увеличивает счётчик', async () => {
    fakeBot(chatId => (chatId === TG.dima ? blocked() : undefined));

    const response = await call('post', `/api/admin/debts/remind-all?groupId=${w.groupA}`, 'clara');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ sent: 0, total: 1 });
    expect((await debt(w.debtA)).reminderCount).toBe(0);
  });

  it('точечное напоминание по долгу своей группы', async () => {
    const sent = fakeBot();

    const response = await call('post', `/api/admin/debts/${w.debtA}/remind?groupId=${w.groupA}`, 'clara');

    expect(response.status).toBe(200);
    expect(sent.map(m => m.chatId)).toEqual([TG.dima]);
    expect((await debt(w.debtA)).reminderCount).toBe(1);
  });

  it('чужой долг через свою группу не напоминается', async () => {
    const sent = fakeBot();

    const response = await call('post', `/api/admin/debts/${w.debtB}/remind?groupId=${w.groupA}`, 'clara');

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(sent).toHaveLength(0);
    expect((await debt(w.debtB)).reminderCount).toBe(0);
  });

  it('без бота рассылка отказывает и счётчики не трогает', async () => {
    noBot();

    const response = await call('post', `/api/admin/debts/remind-all?groupId=${w.groupA}`, 'clara');

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect((await debt(w.debtA)).reminderCount).toBe(0);
  });
});

describe('сводки для админа', () => {
  beforeEach(freshWorld);

  /* В группе А: Дима должен 100 + 50, Миша 30 — итого 180 на двоих. Долг Димы
     в группе Б (1000) и закрытый долг Миши в счёт не идут. */
  async function moreDebts() {
    await prisma.transaction.createMany({
      data: [
        { pollId: w.oldPoll, fromUserId: w.user.dima, toUserId: w.user.clara, amount: 50, status: 'PENDING' },
        { pollId: w.oldPoll, fromUserId: w.user.misha, toUserId: w.user.clara, amount: 30, status: 'PENDING' },
      ],
    });
  }

  it('должники и статистика долгов считаются по своей группе', async () => {
    await moreDebts();

    const debtors = await call('get', `/api/admin/debtors?groupId=${w.groupA}`, 'clara');
    const stats = await call('get', `/api/admin/debt-stats?groupId=${w.groupA}`, 'clara');

    const totals = Object.fromEntries(
      (debtors.body.data as Array<{ userId: number; totalDebt: number }>).map(d => [d.userId, d.totalDebt])
    );
    expect(totals).toEqual({ [w.user.dima]: 150, [w.user.misha]: 30 });
    expect(stats.body.data).toMatchObject({ totalDebtors: 2, totalDebtAmount: 180, avgDebtPerUser: 90 });
  });

  it('список участников: роль админа и непогашенные долги по группе', async () => {
    await moreDebts();

    const response = await call('get', `/api/admin/users?groupId=${w.groupA}`, 'clara');

    const byId = Object.fromEntries(
      (response.body.data as Array<{ id: number; isAdmin: boolean; pendingDebts: number }>).map(u => [u.id, u])
    );
    expect(byId[w.user.clara].isAdmin).toBe(true);
    expect(byId[w.user.alex].isAdmin).toBe(true);
    expect(byId[w.user.misha].isAdmin).toBe(false);
    expect(byId[w.user.dima].pendingDebts).toBe(150);
    expect(byId[w.user.boris]).toBeUndefined();
  });

  it('статистика участника делит его долги по статусам', async () => {
    await moreDebts();
    await prisma.transaction.create({
      data: { pollId: w.oldPoll, fromUserId: w.user.dima, toUserId: w.user.clara, amount: 40, status: 'PAID' },
    });

    const response = await call('get', `/api/admin/users/${w.user.dima}/stats?groupId=${w.groupA}`, 'clara');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ pendingDebts: 150, paidDebts: 40 });
  });

  it('статистику человека не из группы админ не получает', async () => {
    const response = await call('get', `/api/admin/users/${w.user.boris}/stats?groupId=${w.groupA}`, 'clara');

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body.data).toBeUndefined();
  });
});

describe('настройки напоминаний и уведомлений', () => {
  beforeEach(freshWorld);

  const reminders = (groupId: number) => `/api/admin/reminder-settings/${groupId}`;
  const notifications = (groupId: number) => `/api/admin/notification-settings/${groupId}`;

  it('напоминания: запись и чтение по кругу, частичная запись не трогает остальное', async () => {
    const first = await call('get', reminders(w.groupA), 'clara');
    expect(first.status).toBe(200);
    expect(first.body.data.isEnabled).toBe(true);

    await call('put', reminders(w.groupA), 'clara', { isEnabled: false, intervalDays: 7 }).expect(200);
    await call('put', reminders(w.groupA), 'clara', { maxReminders: 2 }).expect(200);

    const read = await call('get', reminders(w.groupA), 'alex');
    expect(read.body.data).toMatchObject({ isEnabled: false, intervalDays: 7, maxReminders: 2 });
  });

  /* Частичная запись в группу, где настроек ещё нет, раньше падала 500: у
     шаблона сообщения нет значения по умолчанию в базе. */
  it('напоминания: частичная запись в группу без настроек сохраняется', async () => {
    const response = await call('put', reminders(w.groupA), 'clara', { intervalDays: 5 });

    expect(response.status).toBe(200);
    const row = await prisma.debtReminderSettings.findUniqueOrThrow({ where: { groupId: w.groupA } });
    expect(row.intervalDays).toBe(5);
  });

  /* Тело уходило в Prisma целиком: `groupId` в теле переписал бы настройки
     ДРУГОЙ группы. */
  it('напоминания: groupId в теле — 400, ничьи настройки не меняются', async () => {
    await call('put', reminders(w.groupB), 'boris', { isEnabled: true }).expect(200);
    const before = await snapshot();

    const response = await call('put', reminders(w.groupA), 'clara', { isEnabled: false, groupId: w.groupB });

    expect(response.status).toBe(400);
    expect(await snapshot()).toBe(before);
  });

  /* Каждый тумблер отправляет одно поле. Первая версия схемы требовала все
     четыре и выключала остальные. */
  it('уведомления: одно поле меняет только себя', async () => {
    const defaults = (await call('get', notifications(w.groupA), 'clara')).body.data;

    await call('put', notifications(w.groupA), 'clara', { notifyOnPollEnd: !defaults.notifyOnPollEnd }).expect(200);

    const read = (await call('get', notifications(w.groupA), 'clara')).body.data;
    expect(read).toMatchObject({
      notifyOnNewUser: defaults.notifyOnNewUser,
      notifyOnNewPoll: defaults.notifyOnNewPoll,
      notifyOnPollEnd: !defaults.notifyOnPollEnd,
      notifyOnDebtPaid: defaults.notifyOnDebtPaid,
    });
  });

  it('уведомления: поле не из схемы — 400, запись не создаётся', async () => {
    const response = await call('put', notifications(w.groupA), 'clara', { notifyOnEverything: true });

    expect(response.status).toBe(400);
    expect(await prisma.adminNotificationSettings.count()).toBe(0);
  });
});
