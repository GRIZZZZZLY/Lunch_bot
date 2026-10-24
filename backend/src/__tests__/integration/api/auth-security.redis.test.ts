/**
 * Защиты, которые держатся на Redis, и проверки прав по группе — через
 * НАСТОЯЩЕЕ приложение: express, PostgreSQL, Redis.
 *
 * 1. Refresh-токен одноразовый: повтор того же токена отклоняется.
 * 2. Идемпотентность: повтор с тем же ключом получает первый ответ и не
 *    меняет базу второй раз, а ОТКАЗ не запоминается.
 * 3. Права администратора решаются по группе ресурса из пути, а не по
 *    `groupId`, присланному клиентом рядом.
 * 4. Распределённая блокировка фоновых задач.
 *
 * Без Redis файл не собирается (`testPathIgnorePatterns` в jest.config.js):
 * изменяющие маршруты объявлены `required: true` и без хранилища отвечают 503.
 * Вход — с включённой проверкой подписи Telegram, как в production.
 */
import request from 'supertest';
import type express from 'express';

import { prisma } from '../../../database/client';
import { cacheService } from '../../../services/cache.service';
import { withDistributedLock } from '../../../utils/distributed-lock';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { addMember, idemKey } from '../helpers/api';
import {
  applyEnv,
  EnvPatch,
  FALLBACK_BOT_TOKEN,
  initDataFields,
  signInitData,
} from '../helpers/auth';

let app: express.Application;
let savedEnv: EnvPatch;

const ANNA_TG = 700000501;
const BORIS_TG = 700000502;
const VERA_TG = 700000503;

async function login(
  telegramId: number,
  firstName = 'Анна'
): Promise<{ accessToken: string; refreshToken: string; userId: number }> {
  const response = await request(app)
    .post('/api/auth/validate')
    .send({ initData: signInitData(initDataFields(telegramId, firstName)) })
    .expect(200);
  return {
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
    userId: response.body.user.id,
  };
}

function refresh(refreshToken: string) {
  return request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${refreshToken}`);
}

/** Клиент Redis поднимается лениво; до готовности хранилище «недоступно». */
async function waitForRedis(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await cacheService.healthCheck()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Redis не поднялся: проверьте REDIS_URL');
}

beforeAll(async () => {
  savedEnv = applyEnv({
    SKIP_TELEGRAM_VALIDATION: 'false',
    BOT_TOKEN: process.env.BOT_TOKEN || FALLBACK_BOT_TOKEN,
  });
  app = createTestApp();
  await waitForRedis();
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  applyEnv(savedEnv);
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/auth/refresh', () => {
  /* Украденный refresh-токен живёт неделю. Одноразовость сужает окно: после
     законного обновления перехваченная копия уже не выдаёт новую пару. */
  it('выдаёт рабочую пару; повтор тем же refresh-токеном — 401 REFRESH_TOKEN_REPLAY', async () => {
    const { refreshToken, userId } = await login(ANNA_TG);

    const first = await refresh(refreshToken);
    const replay = await refresh(refreshToken);

    expect(first.status).toBe(200);
    const profile = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${first.body.accessToken}`);
    expect(profile.body.data.id).toBe(userId);

    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('REFRESH_TOKEN_REPLAY');
    expect(replay.body.accessToken).toBeUndefined();

    expect((await refresh(first.body.refreshToken)).status).toBe(200);
  });
});

describe('идемпотентность изменяющих запросов (на расписании опросов)', () => {
  /* Носитель — `POST /api/recurring`: он пишет строку в базу и честно
     отвечает 409, если у группы уже есть расписание. Это даёт и «побочный
     эффект один раз», и отказ, который потом перестаёт быть отказом. */
  let token: string;
  let groupA: number;
  let groupB: number;

  const scheduleFor = (groupId: number) => ({
    groupId,
    daysOfWeek: [1, 3],
    timeOfDay: '12:00',
    duration: 30,
  });

  function createSchedule(key: string, body: object) {
    return request(app)
      .post('/api/recurring')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(body);
  }

  beforeEach(async () => {
    const anna = await login(ANNA_TG);
    token = anna.accessToken;
    const [a, b] = await Promise.all([
      prisma.group.create({ data: { telegramId: BigInt(-100000000501), title: 'Команда А' } }),
      prisma.group.create({ data: { telegramId: BigInt(-100000000502), title: 'Команда Б' } }),
    ]);
    groupA = a.id;
    groupB = b.id;
    await addMember(groupA, anna.userId, 'CREATOR');
    await addMember(groupB, anna.userId, 'CREATOR');
  });

  it('без ключа изменяющий запрос отклоняется 400 и ничего не пишет', async () => {
    const response = await request(app)
      .post('/api/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send(scheduleFor(groupA));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(await prisma.recurringPoll.count()).toBe(0);
  });

  it('повтор с тем же ключом получает первый ответ, расписание создаётся один раз', async () => {
    const key = idemKey('schedule');

    const first = await createSchedule(key, scheduleFor(groupA));
    const second = await createSchedule(key, scheduleFor(groupA));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(await prisma.recurringPoll.count({ where: { groupId: groupA } })).toBe(1);
  });

  /* Инцидент 2026-08-24: отказ запоминался на сутки. «У группы уже есть
     расписание» продолжало приходить и после удаления расписания, пока
     клиент повторял запрос с тем же ключом. */
  it('отказ 409 не запоминается: после устранения причины повтор с тем же ключом проходит', async () => {
    const existing = await createSchedule(idemKey('first'), scheduleFor(groupA));
    const retryKey = idemKey('retry');

    const refused = await createSchedule(retryKey, scheduleFor(groupA));
    expect(refused.status).toBe(409);

    await request(app)
      .delete(`/api/recurring/${existing.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idemKey('delete'))
      .expect(200);

    const retried = await createSchedule(retryKey, scheduleFor(groupA));

    expect(retried.status).toBe(201);
    expect(retried.body.data.id).not.toBe(existing.body.data.id);
    const rows = await prisma.recurringPoll.findMany({ where: { groupId: groupA } });
    expect(rows.map(row => row.id)).toEqual([retried.body.data.id]);
  });

  // Регрессия: ключ не был связан с телом, и запрос для группы Б получал 201 группы А.
  it('тот же ключ с другим телом отклоняется, а не получает чужой ответ', async () => {
    const key = idemKey('reuse');

    const first = await createSchedule(key, scheduleFor(groupA));
    const reused = await createSchedule(key, scheduleFor(groupB));

    expect(first.status).toBe(201);
    expect(await prisma.recurringPoll.count({ where: { groupId: groupB } })).toBe(0);
    expect(reused.status).toBe(422);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_INVALID');
  });
});

describe('права администратора решаются по группе из пути', () => {
  /* Анна — администратор команды А. Команда Б чужая. Клиент может прислать
     рядом с путём `?groupId=<своя группа>`: если бы проверка прав читала
     query раньше пути, Анна прошла бы проверку как админ А и получила бы
     данные Б. У Анны к тому же стоит прежний глобальный флаг users.is_admin:
     он отменён как понятие и прав на чужую группу давать не должен. */
  let anna: { accessToken: string; userId: number };
  let groupA: number;
  let groupB: number;

  beforeEach(async () => {
    anna = await login(ANNA_TG);
    await prisma.user.update({ where: { id: anna.userId }, data: { isAdmin: true } });
    const boris = await login(BORIS_TG, 'Борис');
    const [a, b] = await Promise.all([
      prisma.group.create({ data: { telegramId: BigInt(-100000000511), title: 'Команда А' } }),
      prisma.group.create({ data: { telegramId: BigInt(-100000000512), title: 'Команда Б' } }),
    ]);
    groupA = a.id;
    groupB = b.id;
    await addMember(groupA, anna.userId, 'CREATOR');
    await addMember(groupB, boris.userId, 'CREATOR');
  });

  it('GET настроек напоминаний чужой группы с ?groupId=<своя> — 403', async () => {
    const own = await request(app)
      .get(`/api/admin/reminder-settings/${groupA}`)
      .set('Authorization', `Bearer ${anna.accessToken}`);
    const foreign = await request(app)
      .get(`/api/admin/reminder-settings/${groupB}?groupId=${groupA}`)
      .set('Authorization', `Bearer ${anna.accessToken}`);

    expect(own.status).toBe(200);
    expect(foreign.status).toBe(403);
    expect(foreign.body.data).toBeUndefined();
  });

  it('PUT настроек напоминаний чужой группы с ?groupId=<своя> — 403, настройки Б не меняются', async () => {
    const foreign = await request(app)
      .put(`/api/admin/reminder-settings/${groupB}?groupId=${groupA}`)
      .set('Authorization', `Bearer ${anna.accessToken}`)
      .set('Idempotency-Key', idemKey('reminder'))
      .send({ intervalDays: 7 });
    const own = await request(app)
      .put(`/api/admin/reminder-settings/${groupA}`)
      .set('Authorization', `Bearer ${anna.accessToken}`)
      .set('Idempotency-Key', idemKey('reminder-own'))
      .send({ intervalDays: 7 });

    expect(foreign.status).toBe(403);
    expect(await prisma.debtReminderSettings.findUnique({ where: { groupId: groupB } })).toBeNull();
    expect(own.status).toBe(200);
    expect(
      (await prisma.debtReminderSettings.findUnique({ where: { groupId: groupA } }))!.intervalDays
    ).toBe(7);
  });
});

describe('статистика участника для администратора: GET /api/admin/users/:userId/stats', () => {
  /* Право на чужую статистику даёт роль в группе, и только о людях этой
     группы. `GET /api/polls/user-stats/:userId` с тем же правилом покрывает
     набор голосований; здесь — админский маршрут. */
  type Person = { accessToken: string; userId: number };
  let anna: Person;
  let boris: Person;
  let vera: Person;
  let groupA: number;

  /* Анна — администратор команды А, Вера — участница А. Борис — создатель
     другой команды и в А не состоит. */
  beforeEach(async () => {
    anna = await login(ANNA_TG);
    boris = await login(BORIS_TG, 'Борис');
    vera = await login(VERA_TG, 'Вера');
    const [a, b] = await Promise.all([
      prisma.group.create({ data: { telegramId: BigInt(-100000000521), title: 'Команда А' } }),
      prisma.group.create({ data: { telegramId: BigInt(-100000000522), title: 'Команда Б' } }),
    ]);
    groupA = a.id;
    await addMember(groupA, anna.userId, 'CREATOR');
    await addMember(groupA, vera.userId, 'MEMBER');
    await addMember(b.id, boris.userId, 'CREATOR');
  });

  function statsOf(target: Person, caller: Person) {
    return request(app)
      .get(`/api/admin/users/${target.userId}/stats?groupId=${groupA}`)
      .set('Authorization', `Bearer ${caller.accessToken}`);
  }

  /* «Не администратор — 403» и «администратор своей группы — 200» на этом
     маршруте проверяет матрица прав в admin.redis.test.ts. */
  // Регрессия: членство цели проверял только сервис, и вместо 403 приходил 500.
  it('администратор о человеке не из своей группы получает 403, как не администратор', async () => {
    const response = await statsOf(boris, anna);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });
});

describe('распределённая блокировка фоновых задач (настоящий Redis)', () => {
  function gate(): { opened: Promise<void>; open: () => void } {
    let open!: () => void;
    const opened = new Promise<void>(resolve => {
      open = resolve;
    });
    return { opened, open };
  }

  it('второй претендент не запускает задачу, пока первая идёт; после неё блокировка свободна', async () => {
    const key = `lock:auth-test:${Date.now()}:${Math.random()}`;
    const started = gate();
    const finish = gate();
    let runs = 0;

    const first = withDistributedLock(key, 30, async () => {
      runs += 1;
      started.open();
      await finish.opened;
    });
    await started.opened;

    const second = await withDistributedLock(key, 30, async () => {
      runs += 1;
    });

    expect(second).toBe(false);
    expect(runs).toBe(1);

    finish.open();
    expect(await first).toBe(true);
    expect(await withDistributedLock(key, 30, async () => { runs += 1; })).toBe(true);
    expect(runs).toBe(2);
  });

  /* Задача пережила свою блокировку: TTL истёк, блокировку взял второй
     экземпляр. Закончив, первый не должен снять ЧУЖУЮ блокировку — иначе
     третий экземпляр запустит ту же задачу параллельно со вторым. */
  it('владелец истёкшей блокировки не снимает блокировку, перехваченную другим', async () => {
    const key = `lock:auth-test:${Date.now()}:${Math.random()}`;
    const aStarted = gate();
    const aFinish = gate();
    const bStarted = gate();
    const bFinish = gate();

    const a = withDistributedLock(key, 1, async () => {
      aStarted.open();
      await aFinish.opened;
    });
    await aStarted.opened;
    await new Promise(resolve => setTimeout(resolve, 1300));

    const b = withDistributedLock(key, 30, async () => {
      bStarted.open();
      await bFinish.opened;
    });
    await bStarted.opened;

    aFinish.open();
    await a;

    let thirdRan = false;
    const third = await withDistributedLock(key, 30, async () => {
      thirdRan = true;
    });

    bFinish.open();
    await b;

    expect(third).toBe(false);
    expect(thirdRan).toBe(false);
  });
});
