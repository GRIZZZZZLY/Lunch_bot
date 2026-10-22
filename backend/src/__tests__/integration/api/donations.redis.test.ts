/**
 * Донаты звёздами Telegram: счёт через НАСТОЯЩИЙ API и денежный автомат доната
 * на настоящей PostgreSQL.
 *
 * Прежний контроллерный тест решал «400 или 500» по тексту ошибки, который сам
 * же и придумывал в моке: смени сервис формулировку — прод ответит 500, а тест
 * останется зелёным. Здесь граница суммы проверяется настоящим запросом.
 *
 * Автомат доната (PENDING → CONFIRMED с идентификатором платежа Telegram,
 * PENDING → FAILED при невыписанном счёте) проверяется вызовами
 * `donationService` — тех же функций, что вызывают обработчики платежей бота
 * (`bot/handlers/payments.handlers.ts`). Разбор апдейта Telegram — забота
 * тестов бота; здесь — деньги: что и когда переходит в какое состояние.
 *
 * Telegram подменяется на границе: `setBotInstance` с поддельным `api`.
 *
 * Redis обязателен: `POST /api/donations/stars` объявлен `required: true` в
 * middleware идемпотентности и без хранилища отвечает 503.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { setBotInstance } from '../../../bot/bot-instance';
import { donationService } from '../../../services/donation.service';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { idemKey, tokenFor } from '../helpers/api';

let app: ReturnType<typeof createTestApp>;

const ANNA_TG = 730000101;
const BORIS_TG = 730000102;
const INVOICE_URL = 'https://t.me/$test-invoice';

interface Invoice {
  payload: string;
  currency: string;
  prices: Array<{ label: string; amount: number }>;
}

/** Поддельный Telegram: запоминает выписанные счета и отправленные сообщения. */
const telegram = {
  invoices: [] as Invoice[],
  sent: [] as Array<{ chatId: number; text: string }>,
  failInvoices: false,
  failMessages: false,
};

function installFakeBot(): void {
  setBotInstance({
    api: {
      createInvoiceLink: async (
        _title: string,
        _description: string,
        payload: string,
        _providerToken: string,
        currency: string,
        prices: Array<{ label: string; amount: number }>
      ) => {
        if (telegram.failInvoices) {
          throw Object.assign(new Error('Bad Gateway'), { error_code: 502 });
        }
        telegram.invoices.push({ payload, currency, prices });
        return INVOICE_URL;
      },
      sendMessage: async (chatId: number, text: string) => {
        if (telegram.failMessages) {
          throw Object.assign(new Error('Forbidden: bot was blocked by the user'), {
            error_code: 403,
          });
        }
        telegram.sent.push({ chatId, text });
        return { message_id: 1 };
      },
    },
  } as unknown as Parameters<typeof setBotInstance>[0]);
}

let annaId: number;
let borisId: number;
let annaToken: string;

function createInvoice(body: Record<string, unknown> | undefined, token = annaToken) {
  const req = request(app)
    .post('/api/donations/stars')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', idemKey('donation'));
  return body === undefined ? req : req.send(body);
}

/** Донат в состоянии PENDING, созданный настоящим запросом. */
async function pendingDonation(amountStars = 50): Promise<string> {
  const response = await createInvoice({ amountStars }).expect(200);
  return response.body.data.donationId as string;
}

/** Платёж в том виде, в каком его передаёт обработчик successful_payment. */
function paymentFor(donationId: string, overrides: Partial<{
  telegramUserId: number;
  totalAmount: number;
  currency: string;
  telegramChargeId: string;
}> = {}) {
  return {
    invoicePayload: `donation:${donationId}`,
    telegramUserId: ANNA_TG,
    currency: 'XTR',
    totalAmount: 50,
    telegramChargeId: 'charge-1',
    ...overrides,
  };
}

const donationRow = (id: string) => prisma.donation.findUniqueOrThrow({ where: { id } });

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  telegram.invoices = [];
  telegram.sent = [];
  telegram.failInvoices = false;
  telegram.failMessages = false;
  installFakeBot();

  annaId = (
    await prisma.user.create({ data: { telegramId: BigInt(ANNA_TG), firstName: 'Анна' } })
  ).id;
  borisId = (
    await prisma.user.create({ data: { telegramId: BigInt(BORIS_TG), firstName: 'Борис' } })
  ).id;
  annaToken = await tokenFor(app, ANNA_TG);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/donations/stars — счёт на оплату', () => {
  it('выписывает счёт на 50 звёзд и заводит донат PENDING на того, кто в токене', async () => {
    const response = await createInvoice({ amountStars: 50, userId: borisId }).expect(200);

    const { invoiceUrl, donationId, amountStars } = response.body.data;
    expect(invoiceUrl).toBe(INVOICE_URL);
    expect(amountStars).toBe(50);

    const row = await donationRow(donationId);
    expect(row).toMatchObject({
      userId: annaId,
      method: 'STARS',
      status: 'PENDING',
      amountStars: 50,
      externalId: null,
    });

    /* Счёт в Telegram ссылается на этот донат: по payload потом находят, что
       именно оплачено. Цена в звёздах — та же, что записана. */
    expect(telegram.invoices).toEqual([
      {
        payload: `donation:${donationId}`,
        currency: 'XTR',
        prices: [expect.objectContaining({ amount: 50 })],
      },
    ]);
  });

  it.each([1, 1000])('граница %p звёзд допустима', async amount => {
    const response = await createInvoice({ amountStars: amount }).expect(200);

    expect((await donationRow(response.body.data.donationId)).amountStars).toBe(amount);
  });

  it('строковое число приводится к числу', async () => {
    const response = await createInvoice({ amountStars: '25' }).expect(200);

    expect(response.body.data.amountStars).toBe(25);
  });

  /* Код, а не текст: прежний тест различал 400 и 500 по формулировке ошибки,
     и смена текста в сервисе незаметно превращала бы отказ в 500. */
  it.each<[string, Record<string, unknown> | undefined]>([
    ['ноль', { amountStars: 0 }],
    ['отрицательная сумма', { amountStars: -5 }],
    ['больше 1000', { amountStars: 1001 }],
    ['0.4 округляется в ноль', { amountStars: 0.4 }],
    ['не число', { amountStars: 'abc' }],
    ['суммы нет', {}],
    ['тела нет', undefined],
  ])('%s — 400 VALIDATION_ERROR, ни доната, ни счёта', async (_name, body) => {
    const response = await createInvoice(body);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(await prisma.donation.count()).toBe(0);
    expect(telegram.invoices).toEqual([]);
  });

  it('Telegram не выписал счёт — 500, а донат помечен FAILED, не висит PENDING', async () => {
    telegram.failInvoices = true;

    const response = await createInvoice({ amountStars: 50 });

    expect(response.status).toBe(500);
    const rows = await prisma.donation.findMany();
    expect(rows.map(r => r.status)).toEqual(['FAILED']);
  });

  it('бот не поднят — счёт не выписан и доната нет', async () => {
    setBotInstance(null as unknown as Parameters<typeof setBotInstance>[0]);

    const response = await createInvoice({ amountStars: 50 });

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(await prisma.donation.count()).toBe(0);
  });
});

describe('оплата доната: PENDING → CONFIRMED', () => {
  it('pre-checkout пропускает платёж, совпавший со счётом', async () => {
    const donationId = await pendingDonation(50);

    const result = await donationService.validateStarsPreCheckout(paymentFor(donationId));

    expect(result.ok).toBe(true);
  });

  it.each<[string, Parameters<typeof paymentFor>[1]]>([
    ['другая сумма', { totalAmount: 49 }],
    ['платит другой человек', { telegramUserId: BORIS_TG }],
    ['не звёзды', { currency: 'RUB' }],
  ])('pre-checkout отклоняет платёж: %s', async (_name, overrides) => {
    const donationId = await pendingDonation(50);

    const result = await donationService.validateStarsPreCheckout(
      paymentFor(donationId, overrides)
    );

    expect(result.ok).toBe(false);
  });

  it('pre-checkout отклоняет счёт, который уже не PENDING', async () => {
    const donationId = await pendingDonation(50);
    await prisma.donation.update({ where: { id: donationId }, data: { status: 'FAILED' } });

    const result = await donationService.validateStarsPreCheckout(paymentFor(donationId));

    expect(result.ok).toBe(false);
  });

  it('успешный платёж переводит донат в CONFIRMED с id платежа и благодарит один раз', async () => {
    const donationId = await pendingDonation(50);

    await donationService.confirmStarsPayment(paymentFor(donationId, { telegramChargeId: 'ch-777' }));

    const row = await donationRow(donationId);
    expect(row.status).toBe('CONFIRMED');
    expect(row.externalId).toBe('ch-777');
    expect(row.confirmedAt).not.toBeNull();
    expect(telegram.sent.map(m => m.chatId)).toEqual([ANNA_TG]);
  });

  it('повторный webhook с тем же платежом ничего не меняет и не благодарит снова', async () => {
    const donationId = await pendingDonation(50);
    await donationService.confirmStarsPayment(paymentFor(donationId));
    const before = await donationRow(donationId);

    await donationService.confirmStarsPayment(paymentFor(donationId));

    expect(await donationRow(donationId)).toEqual(before);
    expect(telegram.sent).toHaveLength(1);
  });

  it('два одновременных подтверждения — один переход и одна благодарность', async () => {
    const donationId = await pendingDonation(50);

    const results = await Promise.allSettled([
      donationService.confirmStarsPayment(paymentFor(donationId)),
      donationService.confirmStarsPayment(paymentFor(donationId)),
    ]);

    /* Проигравший гонку видит тот же подтверждённый платёж и выходит молча:
       ошибка здесь заставила бы Telegram повторять доставку без конца. */
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled']);
    const row = await donationRow(donationId);
    expect(row.status).toBe('CONFIRMED');
    expect(row.externalId).toBe('charge-1');
    expect(telegram.sent).toHaveLength(1);
  });

  it('платёж, не совпавший со счётом, донат не подтверждает', async () => {
    const donationId = await pendingDonation(50);

    await expect(
      donationService.confirmStarsPayment(paymentFor(donationId, { totalAmount: 10 }))
    ).rejects.toThrow();

    const row = await donationRow(donationId);
    expect(row.status).toBe('PENDING');
    expect(row.externalId).toBeNull();
    expect(telegram.sent).toEqual([]);
  });

  it('один платёж Telegram нельзя засчитать второму донату', async () => {
    const first = await pendingDonation(50);
    const second = await pendingDonation(50);
    await donationService.confirmStarsPayment(paymentFor(first, { telegramChargeId: 'ch-1' }));

    await expect(
      donationService.confirmStarsPayment(paymentFor(second, { telegramChargeId: 'ch-1' }))
    ).rejects.toThrow();

    expect((await donationRow(second)).status).toBe('PENDING');
  });

  /* Благодарность — после перехода. Её сбой (человек заблокировал бота) не
     должен ни откатить донат, ни уронить обработчик: ошибка заставила бы
     Telegram повторять доставку уже подтверждённого платежа. */
  it('сбой благодарности донат не отменяет', async () => {
    const donationId = await pendingDonation(50);
    telegram.failMessages = true;

    await donationService.confirmStarsPayment(paymentFor(donationId));

    expect((await donationRow(donationId)).status).toBe('CONFIRMED');
  });

  it('платёж не за донат донат не трогает', async () => {
    const donationId = await pendingDonation(50);

    await expect(
      donationService.confirmStarsPayment({
        ...paymentFor(donationId),
        invoicePayload: `subscription:${donationId}`,
      })
    ).rejects.toThrow();

    expect((await donationRow(donationId)).status).toBe('PENDING');
  });

  it('проваленный счёт оплатой уже не подтверждается', async () => {
    telegram.failInvoices = true;
    await createInvoice({ amountStars: 50 });
    const failed = await prisma.donation.findFirstOrThrow();

    await expect(
      donationService.confirmStarsPayment(paymentFor(failed.id))
    ).rejects.toThrow();

    expect((await donationRow(failed.id)).status).toBe('FAILED');
  });
});
