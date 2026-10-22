/**
 * «Позвать админа» через НАСТОЯЩИЙ API: express, PostgreSQL, фальшивый бот.
 *
 * Прежний модульный тест подменял Prisma по форме запросов, поэтому две
 * настоящие поломки этого маршрута он увидеть не мог: BigInt-идентификатор
 * админа из базы и Markdown в названии группы. Обе давали ответ 200 при нуле
 * доставленных сообщений. Здесь админы, группы и паузы лежат в настоящей базе,
 * а подменяется только Telegram.
 *
 * Маршруты без идемпотентности, Redis не нужен.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { setBotInstance } from '../../../bot/bot-instance';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { addMember, tokenFor } from '../helpers/api';

let app: ReturnType<typeof createTestApp>;

/* У админа идентификатор больше 2^32: такие давно выдаёт Telegram, и именно
   на них `telegramId` из базы приходит BigInt-ом. */
const TG = {
  igor: 720000101,
  sveta: 720000102,
  admin1: 7000000001,
  admin2: 720000104,
  exAdmin: 720000105,
  stranger: 720000106,
  adminB: 720000107,
  formerGlobal: 720000108,
} as const;
type Person = keyof typeof TG;

interface World {
  user: Record<Person, number>;
  groupA: number;
  groupB: number;
}

async function buildWorld(): Promise<World> {
  const user = {} as Record<Person, number>;
  for (const [name, telegramId] of Object.entries(TG) as Array<[Person, number]>) {
    user[name] = (
      await prisma.user.create({
        data: { telegramId: BigInt(telegramId), firstName: name, isAdmin: name === 'formerGlobal' },
      })
    ).id;
  }

  const groupA = (
    await prisma.group.create({ data: { telegramId: BigInt(-100000000301), title: 'Обед_дня *акция*' } })
  ).id;
  const groupB = (
    await prisma.group.create({ data: { telegramId: BigInt(-100000000302), title: 'Группа Б' } })
  ).id;

  await addMember(groupA, user.igor, 'MEMBER');
  await addMember(groupA, user.sveta, 'MEMBER');
  await addMember(groupA, user.admin1, 'CREATOR');
  await addMember(groupA, user.admin2, 'ADMIN');
  await addMember(groupA, user.exAdmin, 'ADMIN', { isActive: false, leftAt: new Date() });
  await addMember(groupB, user.stranger, 'MEMBER');
  await addMember(groupB, user.adminB, 'CREATOR');

  return { user, groupA, groupB };
}

interface Sent {
  chatId: unknown;
  text: string;
}

/**
 * Бот на границе с Telegram. Настоящий клиент сериализует запрос в JSON, а
 * `JSON.stringify` на BigInt бросает TypeError, — фальшивый делает то же,
 * иначе пропустил бы ровно ту ошибку, ради которой тест написан.
 */
function fakeBot(failFor: (chatId: number) => boolean = () => false): Sent[] {
  const sent: Sent[] = [];
  setBotInstance({
    api: {
      sendMessage: async (chatId: unknown, text: string, options?: object) => {
        JSON.stringify({ chat_id: chatId, text, ...options });
        if (failFor(Number(chatId))) {
          throw Object.assign(new Error('Forbidden: bot was blocked by the user'), { error_code: 403 });
        }
        sent.push({ chatId, text });
        return { message_id: sent.length };
      },
    },
  } as unknown as Parameters<typeof setBotInstance>[0]);
  return sent;
}

let w: World;

async function as(person: Person): Promise<string> {
  return tokenFor(app, TG[person]);
}

function remind(token: string, groupId: number) {
  return request(app)
    .post('/api/notifications/remind-admin')
    .set('Authorization', `Bearer ${token}`)
    .send({ groupId });
}

function cooldown(token: string, groupId: number) {
  return request(app)
    .get(`/api/notifications/cooldown/${groupId}`)
    .set('Authorization', `Bearer ${token}`);
}

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  w = await buildWorld();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/notifications/remind-admin', () => {
  /* Раньше `telegramId` из базы уходил в Telegram как BigInt: TypeError ловил
     тот же catch, что и «бот заблокирован», и рассылка молча заканчивалась
     нулём доставленных при ответе 200. */
  it('сообщение уходит каждому активному админу группы, по числовому chat id', async () => {
    const sent = fakeBot();

    const response = await remind(await as('igor'), w.groupA);

    expect(response.status).toBe(200);
    expect(response.body.data.sentCount).toBe(2);
    // Ни вышедший админ, ни рядовой участник сообщения не получают.
    expect(sent.map(m => m.chatId).sort()).toEqual([TG.admin1, TG.admin2].sort());
    const records = await prisma.adminReminder.findMany();
    expect(records).toEqual([expect.objectContaining({ userId: w.user.igor, groupId: w.groupA })]);
  });

  /* Группа `Обед_дня` в Markdown-сообщении давала от Telegram «can't parse
     entities», и напоминание не доходило НИ ОДНОМУ админу — молча, с 200.
     Проверяется только то, что пришло от людей: имя и название группы. */
  it('имя и название группы экранируются для Markdown', async () => {
    const sent = fakeBot();
    const token = await as('igor');
    // Вход перезаписывает имя из Telegram, поэтому имя ставится после него.
    await prisma.user.update({ where: { id: w.user.igor }, data: { firstName: 'Игорь_К' } });

    await remind(token, w.groupA).expect(200);

    const text = sent[0].text;
    expect(text).toContain('Игорь\\_К');
    expect(text).toContain('Обед\\_дня \\*акция\\*');
    expect(text).not.toContain('Обед_дня');
  });

  it('посторонний получает 403: ни сообщений, ни записи о паузе', async () => {
    const sent = fakeBot();

    const response = await remind(await as('stranger'), w.groupA);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(sent).toHaveLength(0);
    expect(await prisma.adminReminder.count()).toBe(0);
  });

  it('пауза общая для группы: второй участник получает 429, другая группа — нет', async () => {
    const sent = fakeBot();

    await remind(await as('igor'), w.groupA).expect(200);
    const second = await remind(await as('sveta'), w.groupA);

    expect(second.status).toBe(429);
    expect(sent).toHaveLength(2);
    expect(await prisma.adminReminder.count({ where: { groupId: w.groupA } })).toBe(1);

    // Пауза группы А не мешает группе Б.
    await remind(await as('stranger'), w.groupB).expect(200);
  });

  it('без бота — отказ, и пауза не начинается', async () => {
    setBotInstance(null as unknown as Parameters<typeof setBotInstance>[0]);
    const token = await as('igor');

    const response = await remind(token, w.groupA);

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(await prisma.adminReminder.count()).toBe(0);

    // Бот вернулся — позвать можно сразу, паузы от неудачной попытки нет.
    fakeBot();
    await remind(token, w.groupA).expect(200);
  });

  it('сбой отправки одному админу не отменяет рассылку остальным', async () => {
    const sent = fakeBot(chatId => chatId === TG.admin1);

    const response = await remind(await as('igor'), w.groupA);

    expect(response.status).toBe(200);
    expect(response.body.data.sentCount).toBe(1);
    expect(sent.map(m => m.chatId)).toEqual([TG.admin2]);
    expect(await prisma.adminReminder.count()).toBe(1);
  });
});

describe('GET /api/notifications/cooldown/:groupId', () => {
  it('без напоминаний пауза неактивна', async () => {
    const response = await cooldown(await as('sveta'), w.groupA);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ isActive: false, lastReminderBy: null });
  });

  it('напоминание 5 минут назад: пауза активна ещё 25 минут, автор назван', async () => {
    await prisma.adminReminder.create({
      data: { userId: w.user.igor, groupId: w.groupA, createdAt: new Date(Date.now() - 5 * 60_000) },
    });

    const response = await cooldown(await as('sveta'), w.groupA);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      isActive: true,
      minutesLeft: 25,
      lastReminderBy: { id: w.user.igor },
    });
  });

  /* Флаг `users.is_admin` раньше открывал паузы любой группы. Понятия
     глобального админа больше нет: решает членство. */
  it.each<[Person, string]>([
    ['stranger', 'участник другой группы'],
    ['formerGlobal', 'прежний глобальный админ'],
  ])('%s (%s) получает 403', async person => {
    const response = await cooldown(await as(person), w.groupA);

    expect(response.status).toBe(403);
  });
});
