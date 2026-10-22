/**
 * Оплата доната звёздами Telegram (Stars) — проводка бота.
 *
 * Сама машина состояний доната проверяется в тестах сервиса доната; здесь —
 * что обновления Telegram доходят до неё через настоящего бота:
 * pre_checkout_query получает ответ «да/нет» (Telegram ждёт его 10 секунд и
 * без ответа платёж отменяет), а successful_payment меняет строку доната.
 */
import { prisma } from '../../../database/client';
import { cleanDatabase } from '../helpers/fixtures';
import {
  type FakeTelegram,
  type TgUser,
  createFakeTelegram,
  preCheckoutQuery,
  sentTo,
  successfulPayment,
} from '../helpers/bot';

let tg: FakeTelegram;

const payer: TgUser = { id: 8001, first_name: 'Плательщик' };
const stranger: TgUser = { id: 8002, first_name: 'Чужой' };

async function pendingDonation(stars = 50) {
  const user = await prisma.user.create({
    data: { telegramId: BigInt(payer.id), firstName: payer.first_name },
  });
  return prisma.donation.create({
    data: { userId: user.id, amountRub: 100, amountStars: stars, method: 'STARS', status: 'PENDING' },
  });
}

/** Решение по pre-checkout, которое бот отправил в Telegram. */
function preCheckoutAnswer() {
  const answers = tg.sent('answerPreCheckoutQuery');
  expect(answers).toHaveLength(1);
  return answers[0].payload.ok as boolean;
}

beforeAll(async () => {
  tg = await createFakeTelegram();
});

beforeEach(async () => {
  await cleanDatabase();
  tg.reset();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('pre_checkout_query', () => {
  it('счёт совпадает с донатом — Telegram получает согласие', async () => {
    const donation = await pendingDonation(50);

    await tg.receive(preCheckoutQuery(payer, `donation:${donation.id}`, 50));

    expect(preCheckoutAnswer()).toBe(true);
  });

  it.each([
    ['другая сумма', (id: string) => preCheckoutQuery(payer, `donation:${id}`, 49)],
    ['другая валюта', (id: string) => preCheckoutQuery(payer, `donation:${id}`, 50, 'USD')],
    ['чужой донат', (id: string) => preCheckoutQuery(stranger, `donation:${id}`, 50)],
    ['не наш payload', () => preCheckoutQuery(payer, 'subscription:1', 50)],
  ])('%s — отказ', async (_label, build) => {
    const donation = await pendingDonation(50);

    await tg.receive(build(donation.id));

    expect(preCheckoutAnswer()).toBe(false);
  });

  it('уже подтверждённый донат второй раз не оплачивается', async () => {
    const donation = await pendingDonation(50);
    await prisma.donation.update({
      where: { id: donation.id },
      data: { status: 'CONFIRMED', externalId: 'old-charge' },
    });

    await tg.receive(preCheckoutQuery(payer, `donation:${donation.id}`, 50));

    expect(preCheckoutAnswer()).toBe(false);
  });
});

describe('successful_payment', () => {
  it('подтверждает донат и связывает его с платежом Telegram; спасибо уходит один раз', async () => {
    const donation = await pendingDonation(50);
    const update = successfulPayment(payer, `donation:${donation.id}`, 50, 'charge-1');

    await tg.receive(update);
    // Telegram повторяет доставку, если не дождался ответа.
    await tg.receive(update);

    const row = await prisma.donation.findUnique({ where: { id: donation.id } });
    expect(row).toMatchObject({ status: 'CONFIRMED', externalId: 'charge-1' });
    expect(row?.confirmedAt).toBeInstanceOf(Date);
    expect(sentTo(tg, payer.id)).toHaveLength(1);
  });

  it('платёж, не совпавший с донатом, донат не подтверждает и не теряется молча', async () => {
    const donation = await pendingDonation(50);

    /* Ошибка доходит до вызывающего: в webhook-режиме это ответ не-200, и
       Telegram повторит доставку, вместо того чтобы платёж пропал. */
    await expect(
      tg.receive(successfulPayment(payer, `donation:${donation.id}`, 10, 'charge-2'))
    ).rejects.toThrow();

    const row = await prisma.donation.findUnique({ where: { id: donation.id } });
    expect(row).toMatchObject({ status: 'PENDING', externalId: null });
  });

  it('платёж за чужой счёт не подтверждает его', async () => {
    const donation = await pendingDonation(50);

    await expect(
      tg.receive(successfulPayment(stranger, `donation:${donation.id}`, 50, 'charge-3'))
    ).rejects.toThrow();

    expect((await prisma.donation.findUnique({ where: { id: donation.id } }))?.status).toBe('PENDING');
  });

  it('платёж не за донат донаты не трогает', async () => {
    const donation = await pendingDonation(50);

    await tg.receive(successfulPayment(payer, 'subscription:7', 50, 'charge-4'));

    expect((await prisma.donation.findUnique({ where: { id: donation.id } }))?.status).toBe('PENDING');
  });
});
