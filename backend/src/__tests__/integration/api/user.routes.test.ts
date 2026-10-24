/* Лимитер выключен до загрузки приложения — см. menu.routes.test.ts. */
process.env.ENABLE_RATE_LIMIT = 'false';

/**
 * Профиль пользователя через НАСТОЯЩИЙ API: express, PostgreSQL, Prisma.
 *
 * 1. Реквизиты для переводов. Их видят ДРУГИЕ участники кнопкой «Перевести»,
 *    поэтому на входе запрещены опасные схемы ссылок, а в базе они лежат
 *    шифротекстом — утечка дампа не должна раскрывать телефоны и карты.
 * 2. Группы пользователя — только живые членства в живых группах; глобальный
 *    флаг users.is_admin чужих групп не открывает.
 * 3. Аватарки отдаются только тем, с кем есть общая АКТИВНАЯ группа; чужой
 *    пользователь неотличим от несуществующего (404, а не 403).
 *
 * Telegram — внешняя граница: бот подменяется настоящим `setBotInstance`.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { setBotInstance } from '../../../bot/bot-instance';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { tokenFor } from '../helpers/api';

let app: ReturnType<typeof createTestApp>;

const TG = {
  anna: 700003001,
  vera: 700003002,
  dima: 700003003,
  lena: 700003004,
  gleb: 700003005,
} as const;
type Who = keyof typeof TG;

interface World {
  user: Record<Who, number>;
  groupA: number;
  groupE: number;
}

/**
 * Анна и Вера вместе в A. Лена была в A и вышла. Дима — только в B, общей
 * группы с Анной у него нет. Глеб — глобальный админ (users.is_admin): админ
 * в A, вышел из C и админ мёртвой группы D (бота из неё убрали).
 */
async function buildWorld(): Promise<World> {
  const user = {} as Record<Who, number>;
  const avatars: Partial<Record<Who, string>> = {
    vera: 'tg://avatar/VERA_FILE',
    dima: 'tg://avatar/DIMA_FILE',
    lena: 'tg://avatar/LENA_FILE',
  };
  for (const who of Object.keys(TG) as Who[]) {
    const created = await prisma.user.create({
      data: {
        telegramId: BigInt(TG[who]),
        firstName: who,
        isAdmin: who === 'gleb',
        // Свежий кэш аватарки: такой ответ не ходит в Telegram.
        ...(avatars[who] ? { avatarUrl: avatars[who], avatarUpdatedAt: new Date() } : {}),
      },
    });
    user[who] = created.id;
  }

  const group = async (n: number, title: string, isActive = true) =>
    (
      await prisma.group.create({
        data: { telegramId: BigInt(-100000003000 - n), title, isActive },
      })
    ).id;
  const groupA = await group(1, 'Команда А');
  const groupB = await group(2, 'Команда Б');
  const groupC = await group(3, 'Команда В');
  const groupD = await group(4, 'Команда Г', false);
  const groupE = await group(5, 'Команда Д');

  await prisma.groupMember.createMany({
    data: [
      { groupId: groupA, userId: user.anna, role: 'CREATOR' },
      { groupId: groupA, userId: user.vera, role: 'MEMBER' },
      { groupId: groupA, userId: user.lena, role: 'MEMBER', isActive: false, leftAt: new Date() },
      { groupId: groupB, userId: user.dima, role: 'CREATOR' },
      { groupId: groupE, userId: user.gleb, role: 'ADMIN' },
      { groupId: groupC, userId: user.gleb, role: 'MEMBER', isActive: false, leftAt: new Date() },
      { groupId: groupD, userId: user.gleb, role: 'ADMIN' },
    ],
  });

  return { user, groupA, groupE };
}

const tokens = new Map<Who, string>();

async function as(who: Who) {
  if (!tokens.has(who)) tokens.set(who, await tokenFor(app, TG[who]));
  const auth = `Bearer ${tokens.get(who)}`;
  return {
    get: (url: string) => request(app).get(url).set('Authorization', auth),
    post: (url: string, body: object) =>
      request(app).post(url).set('Authorization', auth).send(body),
    put: (url: string, body: object) =>
      request(app).put(url).set('Authorization', auth).send(body),
  };
}

/** Подменный Telegram: считает обращения за фото профиля. */
let telegram: {
  photoRequests: number;
  photos: Array<Array<{ file_id: string }>>;
};

let w: World;

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  tokens.clear();
  telegram = { photoRequests: 0, photos: [] };
  setBotInstance({
    api: {
      getUserProfilePhotos: async () => {
        telegram.photoRequests += 1;
        return { total_count: telegram.photos.length, photos: telegram.photos };
      },
      getFile: async (fileId: string) => ({ file_id: fileId, file_path: `photos/${fileId}.jpg` }),
    },
  } as unknown as Parameters<typeof setBotInstance>[0]);
  w = await buildWorld();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

const paymentRow = (who: Who) =>
  prisma.user.findUnique({
    where: { id: w.user[who] },
    select: { paymentCard: true, paymentPhone: true, paymentDetails: true },
  });

const GOOD = {
  paymentPhone: '+7 (900) 123-45-67',
  paymentCard: 'https://pay.example/anna',
  paymentDetails: 'Т-Банк, Анна К.',
};

describe('реквизиты для переводов', () => {
  it('в базе лежит шифротекст, а владелец получает открытый текст', async () => {
    const anna = await as('anna');

    const saved = await anna.put('/api/user/payment-info', GOOD);
    expect(saved.status).toBe(200);
    // Ответ PUT раньше нёс шифротекст из базы.
    expect(saved.body.data).toEqual(GOOD);

    const stored = await paymentRow('anna');
    for (const field of Object.keys(GOOD) as Array<keyof typeof GOOD>) {
      expect(stored?.[field]).toBeTruthy();
      expect(stored?.[field]).not.toContain(GOOD[field]);
    }

    const read = await anna.get('/api/user/payment-info');
    expect(read.status).toBe(200);
    expect(read.body.data).toEqual(GOOD);
  });

  /* Ссылку видит ДРУГОЙ участник кнопкой «Перевести по ссылке»:
     `javascript:` из чужого профиля исполнился бы под пальцем плательщика. */
  it.each<[string, Partial<typeof GOOD>]>([
    ['ссылка javascript:', { paymentCard: 'javascript:alert(1)' }],
    ['ссылка data:', { paymentCard: 'data:text/html,<script>alert(1)</script>' }],
    ['не ссылка вовсе', { paymentCard: 'карта 4276 0000' }],
    ['ссылка длиннее 500 знаков', { paymentCard: `https://pay.example/${'a'.repeat(500)}` }],
    ['в телефоне меньше 10 цифр', { paymentPhone: '12345' }],
    ['описание длиннее 200 знаков', { paymentDetails: 'я'.repeat(201) }],
  ])('%s — 400, сохранённое не тронуто', async (_name, body) => {
    const anna = await as('anna');
    await anna.put('/api/user/payment-info', GOOD).expect(200);
    const before = await paymentRow('anna');

    const res = await anna.put('/api/user/payment-info', body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYMENT_INFO');
    expect(await paymentRow('anna')).toEqual(before);
  });

  it('http-ссылка допускается: локальные платёжные шлюзы', async () => {
    const anna = await as('anna');

    const res = await anna.put('/api/user/payment-info', { paymentCard: 'http://pay.local/anna' });

    expect(res.status).toBe(200);
    expect((await anna.get('/api/user/payment-info')).body.data.paymentCard).toBe('http://pay.local/anna');
  });

  /* Убрать реквизит было нельзя вовсе: клиент слал undefined, ключ пропадал
     из JSON, и сервер сохранял старое значение. */
  it('null и пустая строка очищают поле, отсутствующий ключ его не трогает', async () => {
    const anna = await as('anna');
    await anna.put('/api/user/payment-info', GOOD).expect(200);

    await anna.put('/api/user/payment-info', { paymentCard: null, paymentPhone: '' }).expect(200);

    const read = await anna.get('/api/user/payment-info');
    expect(read.body.data.paymentCard).toBeFalsy();
    expect(read.body.data.paymentPhone).toBeFalsy();
    expect(read.body.data.paymentDetails).toBe(GOOD.paymentDetails);
  });
});

describe('профиль и группы пользователя', () => {
  it('профиль отдаёт telegramId строкой', async () => {
    const res = await (await as('anna')).get('/api/user/me');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: w.user.anna, telegramId: String(TG.anna) });
  });

  /* Глобальный флаг не открывает чужих групп: иначе переключатель показал бы
     группы, где любое действие всё равно получит 403. */
  it('в списке только живые членства в живых группах, с ролью', async () => {
    const res = await (await as('gleb')).get('/api/user/groups');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ id: w.groupE, role: 'ADMIN', telegramId: String(-100000003005) }),
    ]);
  });
});

describe('аватарки: только людям с общей активной группой', () => {
  it.each<[string, (x: World) => string, number]>([
    ['участник общей группы', x => String(x.user.vera), 200],
    ['свой аватар', x => String(x.user.anna), 200],
    // Чужой маскируется под несуществующего: 404, а не 403.
    ['без общей группы — 404', x => String(x.user.dima), 404],
    ['вышедший из общей группы — 404', x => String(x.user.lena), 404],
    ['нет такого пользователя — 404', x => String(x.user.gleb + 1000), 404],
  ])('%s', async (_name, target, status) => {
    const res = await (await as('anna')).get(`/api/user/${target(w)}/avatar`);

    expect(res.status).toBe(status);
    if (status === 404) expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  it.each(['abc', '0'])('id «%s» — 400', async id => {
    const res = await (await as('anna')).get(`/api/user/${id}/avatar`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('из кэша отдаётся подписанная ссылка, а не маркер из базы', async () => {
    const res = await (await as('anna')).get(`/api/user/${w.user.vera}/avatar`);

    expect(res.body.data.avatarUrl).toContain('VERA_FILE');
    expect(res.body.data.avatarUrl).not.toMatch(/^tg:/);
    expect(telegram.photoRequests).toBe(0);
  });

  it('из Telegram берётся самое большое фото, в базе остаётся маркер', async () => {
    await prisma.user.update({ where: { id: w.user.vera }, data: { avatarUrl: null, avatarUpdatedAt: null } });
    telegram.photos = [[{ file_id: 'SMALL' }, { file_id: 'BIG' }]];
    const anna = await as('anna');

    const first = await anna.get(`/api/user/${w.user.vera}/avatar`);
    const second = await anna.get(`/api/user/${w.user.vera}/avatar`);

    expect(first.body.data.avatarUrl).toContain('BIG');
    expect(second.body.data.avatarUrl).toContain('BIG');
    // Подпись короткоживущая — в базу пишется стабильный маркер.
    const stored = await prisma.user.findUnique({ where: { id: w.user.vera } });
    expect(stored?.avatarUrl).toBe('tg://avatar/BIG');
    expect(telegram.photoRequests).toBe(1);
  });

  // Регрессия: «нет фото» не считалось кэшем, и каждый показ аватара без фото шёл в Telegram.
  it('отсутствие фото тоже кэшируется: второй запрос не идёт в Telegram', async () => {
    await prisma.user.update({ where: { id: w.user.vera }, data: { avatarUrl: null, avatarUpdatedAt: null } });
    const anna = await as('anna');

    await anna.get(`/api/user/${w.user.vera}/avatar`).expect(200);
    await anna.get(`/api/user/${w.user.vera}/avatar`).expect(200);

    expect(telegram.photoRequests).toBe(1);
  });

  // Сбой Telegram — не ответ «фото нет»: в кэш он не пишется, следующий показ спросит снова.
  it('сбой Telegram не кэшируется как «нет фото»', async () => {
    await prisma.user.update({ where: { id: w.user.vera }, data: { avatarUrl: null, avatarUpdatedAt: null } });
    setBotInstance({
      api: {
        getUserProfilePhotos: async () => {
          throw Object.assign(new Error('Too Many Requests'), { error_code: 429 });
        },
      },
    } as unknown as Parameters<typeof setBotInstance>[0]);

    const res = await (await as('anna')).get(`/api/user/${w.user.vera}/avatar`);

    expect(res.status).toBe(200);
    expect(res.body.data.avatarUrl).toBeNull();
    const stored = await prisma.user.findUnique({ where: { id: w.user.vera } });
    expect(stored?.avatarUpdatedAt).toBeNull();
  });

  it('пакет: в порядке запроса, чужие, вышедшие и мусор отброшены, без фото — null', async () => {
    const res = await (await as('anna')).post('/api/user/avatars/batch', {
      userIds: [w.user.vera, w.user.dima, 'мусор', w.user.lena, w.user.anna],
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { userId: w.user.vera, avatarUrl: expect.stringContaining('VERA_FILE') },
      { userId: w.user.anna, avatarUrl: null },
    ]);
  });

  it.each<[string, unknown, string]>([
    ['пустой список', [], 'VALIDATION_ERROR'],
    ['не список', '1,2', 'VALIDATION_ERROR'],
    ['больше 100 id', Array.from({ length: 101 }, (_, i) => i + 1), 'TOO_MANY_IDS'],
  ])('пакет: %s — 400', async (_name, userIds, code) => {
    const res = await (await as('anna')).post('/api/user/avatars/batch', { userIds });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
  });

  /* Правило «нужна общая группа» во всех остальных модулях не знает
     исключений для users.is_admin; здесь флаг его обходил
     (user.controller.ts, getUserAvatar и getUserAvatarsBatch). Снято. */
  // Регрессия: глобальный админ получал аватар человека без общей группы.
  it('глобальный админ без общей группы чужой аватар не получает', async () => {
    const res = await (await as('gleb')).get(`/api/user/${w.user.dima}/avatar`);

    expect(res.status).toBe(404);
  });

  // Регрессия: глобальный админ получал в пакете аватары людей без общей группы.
  it('глобальный админ без общей группы чужих в пакете не получает', async () => {
    const res = await (await as('gleb')).post('/api/user/avatars/batch', { userIds: [w.user.dima] });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
