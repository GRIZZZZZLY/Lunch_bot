/**
 * Обратная связь через НАСТОЯЩИЙ API: express, Redis, PostgreSQL.
 *
 * Маршрут превращает запрос пользователя в сообщение админам бота в Telegram,
 * поэтому главные риски — подделка автора (кто прислал) и доставка (кому
 * дошло). Telegram подменяется на границе: `feedbackService.initialize` с
 * поддельным `api`, тем же вызовом, что делает точка входа бота.
 *
 * Получатели берутся из ADMIN_USER_IDS в момент загрузки сервиса, поэтому
 * переменная выставляется ДО импортов ниже.
 *
 * Redis обязателен: маршрут объявлен `required: true` в middleware
 * идемпотентности и без хранилища отвечает 503.
 */
const ADMIN_IDS = ['740000901', '740000902'];
process.env.ADMIN_USER_IDS = ADMIN_IDS.join(',');

import request from 'supertest';

import { prisma } from '../../../database/client';
import { feedbackService } from '../../../services/feedback.service';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { idemKey, tokenFor } from '../helpers/api';

let app: ReturnType<typeof createTestApp>;

const ANNA_TG = 740000101;

const sent: Array<{ chatId: string; text: string }> = [];
/** `fail` — Telegram не принимает ничего; `failFor` — не принимает для одного чата. */
const telegram: { fail: boolean; failFor?: string } = { fail: false };

let annaToken: string;

function sendFeedback(body: Record<string, unknown>) {
  return request(app)
    .post('/api/feedback')
    .set('Authorization', `Bearer ${annaToken}`)
    .set('Idempotency-Key', idemKey('feedback'))
    .send(body);
}

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
  feedbackService.initialize({
    api: {
      sendMessage: async (chatId: string, text: string) => {
        if (telegram.fail || telegram.failFor === String(chatId)) {
          throw Object.assign(new Error('Bad Gateway: telegram internal 7f3a'), { error_code: 502 });
        }
        sent.push({ chatId: String(chatId), text });
        return { message_id: 1 };
      },
    },
  });
});

beforeEach(async () => {
  await cleanDatabase();
  sent.length = 0;
  telegram.fail = false;
  telegram.failFor = undefined;
  await prisma.user.create({ data: { telegramId: BigInt(ANNA_TG), firstName: 'Анна' } });
  annaToken = await tokenFor(app, ANNA_TG);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/feedback', () => {
  it('автор письма — тот, кто в токене; поля автора из тела игнорируются', async () => {
    const anna = await prisma.user.findUniqueOrThrow({ where: { telegramId: BigInt(ANNA_TG) } });

    await sendFeedback({
      message: '  Добавьте суп дня  ',
      userId: 999999,
      username: 'spoofed_name',
      firstName: 'Поддельный',
    }).expect(200);

    expect(sent.length).toBeGreaterThan(0);
    const text = sent[0].text;
    expect(text).toContain('Добавьте суп дня');
    expect(text).toContain(String(ANNA_TG));
    expect(text).toContain(anna.firstName);
    expect(text).not.toContain('999999');
    expect(text).not.toContain('spoofed_name');
    expect(text).not.toContain('Поддельный');
  });

  it.each<[string, Record<string, unknown>]>([
    ['сообщения нет', {}],
    ['пустая строка', { message: '' }],
    ['одни пробелы', { message: '   ' }],
    ['не строка', { message: 42 }],
    ['длиннее 1000 символов', { message: 'а'.repeat(1001) }],
  ])('%s — 400, админам ничего не уходит', async (_name, body) => {
    const response = await sendFeedback(body);

    expect(response.status).toBe(400);
    expect(sent).toEqual([]);
  });

  /* Письмо уходит с разметкой HTML: неэкранированный текст пользователя
     ломал бы отправку («can't parse entities») или подделывал разметку. */
  it('текст пользователя экранируется перед отправкой в HTML', async () => {
    await sendFeedback({ message: '<b>срочно</b> & <a href="x">тут</a>' }).expect(200);

    const text = sent[0].text;
    expect(text).toContain('&lt;b&gt;срочно&lt;/b&gt; &amp; &lt;a href=');
    expect(text).not.toContain('<b>срочно</b>');
  });

  it('Telegram не принял письмо — 500, и его ошибка наружу не выходит', async () => {
    telegram.fail = true;

    const response = await sendFeedback({ message: 'Спасибо' });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('7f3a');
  });

  // Регрессия: письмо получал только первый id из ADMIN_USER_IDS.
  it('письмо получает каждый админ из ADMIN_USER_IDS', async () => {
    await sendFeedback({ message: 'Спасибо за бота' }).expect(200);

    expect(sent.map(m => m.chatId).sort()).toEqual([...ADMIN_IDS].sort());
  });

  it('один недоступный админ не лишает письма остальных', async () => {
    telegram.failFor = ADMIN_IDS[0];

    await sendFeedback({ message: 'Спасибо за бота' }).expect(200);

    expect(sent.map(m => m.chatId)).toEqual([ADMIN_IDS[1]]);
  });
});
