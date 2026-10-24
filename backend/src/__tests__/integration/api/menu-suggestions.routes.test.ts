/* Лимитер выключен до загрузки приложения — см. menu.routes.test.ts. */
process.env.ENABLE_RATE_LIMIT = 'false';

/**
 * Предложения блюд через НАСТОЯЩИЙ API: express, PostgreSQL, Prisma.
 *
 * Предложение — заявка участника в меню группы. Права здесь двух видов, и
 * оба решает роль В ГРУППЕ ПРЕДЛОЖЕНИЯ, а не глобальный флаг users.is_admin:
 *
 * - модерация (очередь, одобрение, отклонение, статистика) — админ группы;
 * - своё предложение автор видит всегда и может отозвать, пока оно ждёт.
 *
 * Раньше список фильтровался по глобальному флагу: админ группы получал пустую
 * очередь при нарисованных кнопках, а глобальный админ без роли — чужие
 * предложения из всех групп. Чтение одного предложения тоже решалось флагом.
 *
 * Telegram — единственная внешняя граница: бот подменяется настоящим
 * `setBotInstance`, чтобы проверить, что автор узнаёт о решении.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { setBotInstance } from '../../../bot/bot-instance';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { tokenFor } from '../helpers/api';

let app: ReturnType<typeof createTestApp>;

const TG = {
  anna: 700002001,
  vera: 700002002,
  dima: 700002003,
  gleb: 700002004,
  boris: 700002005,
} as const;
type Who = keyof typeof TG;

interface World {
  user: Record<Who, number>;
  groupA: number;
  groupB: number;
  /** Предложения группы A. */
  veraPending: number;
  dimaPending: number;
  glebPending: number;
  veraApproved: number;
  dimaRejected: number;
  /** Предложение группы B. */
  borisPending: number;
}

/**
 * Анна — создатель A. Вера и Дима — рядовые участники A. Глеб — участник A
 * без роли, но с глобальным флагом users.is_admin: ровно тот, кому флаг
 * раньше открывал чужое. Борис — создатель B, в A его нет.
 */
async function buildWorld(): Promise<World> {
  const user = {} as Record<Who, number>;
  for (const who of Object.keys(TG) as Who[]) {
    const created = await prisma.user.create({
      data: { telegramId: BigInt(TG[who]), firstName: who, isAdmin: who === 'gleb' },
    });
    user[who] = created.id;
  }
  const groupA = (
    await prisma.group.create({ data: { telegramId: BigInt(-100000002001), title: 'Команда А' } })
  ).id;
  const groupB = (
    await prisma.group.create({ data: { telegramId: BigInt(-100000002002), title: 'Команда Б' } })
  ).id;
  await prisma.groupMember.createMany({
    data: [
      { groupId: groupA, userId: user.anna, role: 'CREATOR' },
      { groupId: groupA, userId: user.vera, role: 'MEMBER' },
      { groupId: groupA, userId: user.dima, role: 'MEMBER' },
      { groupId: groupA, userId: user.gleb, role: 'MEMBER' },
      { groupId: groupB, userId: user.boris, role: 'CREATOR' },
    ],
  });

  const suggest = async (
    who: Who,
    groupId: number,
    name: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING'
  ) =>
    (
      await prisma.menuSuggestion.create({
        data: {
          name,
          price: 300,
          suggestedBy: user[who],
          groupId,
          status,
          ...(status === 'PENDING' ? {} : { reviewedBy: user.anna, reviewedAt: new Date() }),
        },
      })
    ).id;

  return {
    user,
    groupA,
    groupB,
    veraPending: await suggest('vera', groupA, 'Окрошка'),
    dimaPending: await suggest('dima', groupA, 'Шаурма'),
    glebPending: await suggest('gleb', groupA, 'Лагман'),
    veraApproved: await suggest('vera', groupA, 'Борщ', 'APPROVED'),
    dimaRejected: await suggest('dima', groupA, 'Хот-дог', 'REJECTED'),
    borisPending: await suggest('boris', groupB, 'Суши'),
  };
}

const tokens = new Map<Who, string>();

async function as(who: Who) {
  if (!tokens.has(who)) tokens.set(who, await tokenFor(app, TG[who]));
  const auth = `Bearer ${tokens.get(who)}`;
  return {
    get: (url: string) => request(app).get(url).set('Authorization', auth),
    post: (url: string, body: object) =>
      request(app).post(url).set('Authorization', auth).send(body),
    delete: (url: string, body: object) =>
      request(app).delete(url).set('Authorization', auth).send(body),
  };
}

const suggestion = (id: number) => prisma.menuSuggestion.findUnique({ where: { id } });
const names = (body: { data: Array<{ name: string }> }) =>
  body.data.map(item => item.name).sort();

/** Сообщения, ушедшие в Telegram в текущем тесте. */
let sent: Array<{ chatId: number; text: string }>;

let w: World;

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  tokens.clear();
  sent = [];
  setBotInstance({
    api: {
      sendMessage: async (chatId: number, text: string) => {
        sent.push({ chatId, text });
        return { message_id: 1 };
      },
    },
  } as unknown as Parameters<typeof setBotInstance>[0]);
  w = await buildWorld();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('GET /api/suggestions — кто что видит', () => {
  it.each<[string, Who, (x: World) => string, string[]]>([
    ['админ группы видит всю очередь своей группы', 'anna', x => `?groupId=${x.groupA}`,
      ['Борщ', 'Лагман', 'Окрошка', 'Хот-дог', 'Шаурма']],
    ['фильтр по статусу сужает очередь', 'anna', x => `?groupId=${x.groupA}&status=PENDING`,
      ['Лагман', 'Окрошка', 'Шаурма']],
    ['админ без groupId видит только свои — сверять роль не с чем', 'anna', () => '', []],
    ['участник в группе видит только свои', 'vera', x => `?groupId=${x.groupA}`, ['Борщ', 'Окрошка']],
    ['участник без groupId видит только свои', 'vera', () => '', ['Борщ', 'Окрошка']],
    /* Глобальный флаг users.is_admin без роли в группе открывал чужие
       предложения всех групп. */
    ['глобальный админ без роли в группе видит только свои', 'gleb', x => `?groupId=${x.groupA}`, ['Лагман']],
    ['админ другой группы в чужой группе не видит ничего чужого', 'boris', x => `?groupId=${x.groupA}`, []],
  ])('%s', async (_name, who, query, expected) => {
    const res = await (await as(who)).get(`/api/suggestions${query(w)}`);

    expect(res.status).toBe(200);
    expect(names(res.body)).toEqual(expected);
  });

  /* Испорченный groupId трактовался как отсутствующий: запрос молча отдавал
     другой набор вместо ошибки. */
  it.each(['нет', '0', '-3'])('groupId «%s» — 400, а не молчаливая подмена фильтра', async raw => {
    const res = await (await as('anna')).get(`/api/suggestions?groupId=${encodeURIComponent(raw)}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_GROUP_ID');
  });
});

describe('GET /api/suggestions/:id — одно предложение', () => {
  /* Право решает роль в группе САМОГО предложения: ни глобальный флаг, ни
     роль админа в группе из запроса чужое не открывают. */
  it.each<[string, Who, string, number]>([
    ['автор открывает своё', 'vera', '', 200],
    ['админ группы предложения открывает чужое', 'anna', '', 200],
    ['другой участник — 403', 'dima', '', 403],
    ['глобальный админ без роли — 403', 'gleb', '', 403],
    ['админ другой группы со своим groupId — 403', 'boris', 'B', 403],
  ])('%s', async (_name, who, groupHint, status) => {
    const query = groupHint === 'B' ? `?groupId=${w.groupB}` : '';
    const res = await (await as(who)).get(`/api/suggestions/${w.veraPending}${query}`);

    expect(res.status).toBe(status);
    if (status === 200) expect(res.body.data.name).toBe('Окрошка');
  });

  it('несуществующее предложение — 404', async () => {
    const res = await (await as('anna')).get(`/api/suggestions/${w.borisPending + 1000}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/suggestions — создание', () => {
  it('участник предлагает блюдо: автор из токена, статус PENDING', async () => {
    const res = await (await as('vera')).post('/api/suggestions', {
      name: '  Пельмени  ',
      description: ' домашние ',
      price: '350',
      groupId: w.groupA,
      // Подделка автора и статуса в теле не должна сработать.
      suggestedBy: w.user.anna,
      status: 'APPROVED',
    });

    expect(res.status).toBe(201);
    const saved = await suggestion(res.body.data.id);
    expect(saved).toMatchObject({
      name: 'Пельмени',
      description: 'домашние',
      price: 350,
      suggestedBy: w.user.vera,
      groupId: w.groupA,
      status: 'PENDING',
    });
  });

  it('не участник группы — 403, ничего не создано', async () => {
    const res = await (await as('boris')).post('/api/suggestions', { name: 'Пельмени', groupId: w.groupA });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_MEMBER');
    expect(await prisma.menuSuggestion.count({ where: { name: 'Пельмени' } })).toBe(0);
  });

  it('без группы — 400, ничего не создано', async () => {
    const res = await (await as('vera')).post('/api/suggestions', { name: 'Пельмени' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_GROUP_ID');
    expect(await prisma.menuSuggestion.count({ where: { name: 'Пельмени' } })).toBe(0);
  });
});

describe('одобрение и отклонение', () => {
  it('одобрение создаёт блюдо в меню группы и сообщает автору', async () => {
    const res = await (await as('anna')).post(`/api/suggestions/${w.veraPending}/approve`, {
      groupId: w.groupA,
    });

    expect(res.status).toBe(200);
    const saved = await suggestion(w.veraPending);
    expect(saved).toMatchObject({ status: 'APPROVED', reviewedBy: w.user.anna });
    const dish = await prisma.menuItem.findUnique({ where: { id: saved!.createdMenuItemId! } });
    expect(dish).toMatchObject({ name: 'Окрошка', groupId: w.groupA, isActive: true });
    expect(Number(dish!.price)).toBe(300);
    // Автор узнаёт решение: сообщение ушло ему и называет блюдо.
    expect(sent).toHaveLength(1);
    expect(sent[0].chatId).toBe(TG.vera);
    expect(sent[0].text).toContain('Окрошка');
  });

  it('отклонение сохраняет причину и доносит её до автора', async () => {
    const res = await (await as('anna')).post(`/api/suggestions/${w.dimaPending}/reject`, {
      groupId: w.groupA,
      reason: 'кафе это не готовит',
    });

    expect(res.status).toBe(200);
    expect(await suggestion(w.dimaPending)).toMatchObject({
      status: 'REJECTED',
      reviewedBy: w.user.anna,
      rejectionReason: 'кафе это не готовит',
    });
    expect(await prisma.menuItem.count()).toBe(0);
    expect(sent.map(m => m.chatId)).toEqual([TG.dima]);
    expect(sent[0].text).toContain('кафе это не готовит');
  });

  /* Админ группы B не модерирует группу A ни со своим groupId (тогда
     предложение «не из его группы»), ни с чужим (тогда он там не админ). */
  it.each<[string, 'approve' | 'reject', Who, 'A' | 'B']>([
    ['одобрение: рядовой участник', 'approve', 'vera', 'A'],
    ['одобрение: админ B со своим groupId', 'approve', 'boris', 'B'],
    ['одобрение: админ B с groupId группы A', 'approve', 'boris', 'A'],
    ['отклонение: рядовой участник', 'reject', 'vera', 'A'],
    ['отклонение: админ B со своим groupId', 'reject', 'boris', 'B'],
  ])('%s — 403, предложение не тронуто', async (_name, action, who, group) => {
    const groupId = group === 'A' ? w.groupA : w.groupB;

    const res = await (await as(who)).post(`/api/suggestions/${w.dimaPending}/${action}`, { groupId });

    expect(res.status).toBe(403);
    expect(await suggestion(w.dimaPending)).toMatchObject({ status: 'PENDING', reviewedBy: null });
    expect(await prisma.menuItem.count()).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('повторное одобрение не создаёт второе блюдо', async () => {
    const anna = await as('anna');
    await anna.post(`/api/suggestions/${w.veraPending}/approve`, { groupId: w.groupA }).expect(200);

    const again = await anna.post(`/api/suggestions/${w.veraPending}/approve`, { groupId: w.groupA });

    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.menuItem.count({ where: { name: 'Окрошка' } })).toBe(1);
  });
});

describe('DELETE /api/suggestions/:id — кто что удаляет', () => {
  /* Прав два: автор отзывает СВОЁ, пока оно ждёт решения (маршрут раньше
     был закрыт админской мидлварой, и кнопка автора не работала ни разу), а
     админ группы убирает уже разобранное. */
  it.each<[string, Who, keyof World, 'A' | 'B', number]>([
    ['автор отзывает своё ожидающее', 'vera', 'veraPending', 'A', 200],
    ['админ группы убирает одобренное', 'anna', 'veraApproved', 'A', 200],
    ['админ группы убирает отклонённое', 'anna', 'dimaRejected', 'A', 200],
    ['чужое ожидающее другой участник не удаляет', 'dima', 'veraPending', 'A', 403],
    ['автор не удаляет уже разобранное', 'vera', 'veraApproved', 'A', 403],
    ['админ B со своим groupId не удаляет предложение A', 'boris', 'dimaRejected', 'B', 403],
    ['админ B с groupId группы A не удаляет предложение A', 'boris', 'dimaRejected', 'A', 403],
  ])('%s', async (_name, who, key, group, status) => {
    const id = w[key] as number;
    const groupId = group === 'A' ? w.groupA : w.groupB;

    const res = await (await as(who)).delete(`/api/suggestions/${id}`, { groupId });

    expect(res.status).toBe(status);
    expect(await suggestion(id)).toEqual(status === 200 ? null : expect.objectContaining({ id }));
  });

  // Ожидающее админ сначала отклоняет — чтобы у автора осталась причина.
  it('админ не удаляет ожидающее решения', async () => {
    const res = await (await as('anna')).delete(`/api/suggestions/${w.veraPending}`, {
      groupId: w.groupA,
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await suggestion(w.veraPending)).not.toBeNull();
  });

  it('без groupId — 400, предложение на месте', async () => {
    const res = await (await as('vera')).delete(`/api/suggestions/${w.veraPending}`, {});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_GROUP_ID');
    expect(await suggestion(w.veraPending)).not.toBeNull();
  });
});

describe('отказ по правилу домена — ошибка клиента, а не сбой сервера', () => {
  // Регрессия: сервис бросал обычный Error, и на эти отказы приходил 500.
  it.each<[string, (x: World) => [Who, string, object], number, string]>([
    ['повторное одобрение', x => ['anna', `/api/suggestions/${x.veraApproved}/approve`, { groupId: x.groupA }],
      409, 'CONFLICT_ERROR'],
    ['одобрение несуществующего', x => ['anna', `/api/suggestions/${x.borisPending + 1000}/approve`, { groupId: x.groupA }],
      404, 'NOT_FOUND'],
    // Чужой админ не узнаёт по 409, что предложение уже разобрано.
    ['одобрение разобранного админом другой группы', x => ['boris', `/api/suggestions/${x.veraApproved}/approve`, { groupId: x.groupB }],
      403, 'NOT_ADMIN'],
  ])('%s — 4xx', async (_name, call, status, code) => {
    const [who, url, body] = call(w);
    const res = await (await as(who)).post(url, body);

    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
  });

  // Регрессия: удаление ожидающего админом отвечало 500 вместо 409.
  it('удаление ожидающего админом — 409', async () => {
    const res = await (await as('anna')).delete(`/api/suggestions/${w.veraPending}`, {
      groupId: w.groupA,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT_ERROR');
  });
});

describe('статистика и счётчик ожидающих', () => {
  it('считают только свою группу', async () => {
    const anna = await as('anna');

    const stats = await anna.get(`/api/suggestions/stats?groupId=${w.groupA}`);
    expect(stats.status).toBe(200);
    // 5 предложений в A: 3 ждут, 1 одобрено, 1 отклонено. Суши из B не в счёт.
    expect(stats.body.data).toEqual({ total: 5, pending: 3, approved: 1, rejected: 1, approvalRate: 20 });

    const pending = await anna.get(`/api/suggestions/pending-count?groupId=${w.groupA}`);
    expect(pending.body.data).toEqual({ count: 3 });
  });

  it.each<[string, Who]>([
    ['рядовой участник', 'vera'],
    ['админ другой группы', 'boris'],
  ])('%s — 403', async (_name, who) => {
    const client = await as(who);
    for (const path of ['stats', 'pending-count']) {
      const res = await client.get(`/api/suggestions/${path}?groupId=${w.groupA}`);
      expect(res.status).toBe(403);
    }
  });
});
