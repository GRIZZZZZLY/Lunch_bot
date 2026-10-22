/**
 * Ежедневная задача напоминаний о долгах (debt-reminder.job).
 *
 * Запускается настоящая функция задачи на настоящей базе; подделан только
 * Telegram. Проверяется, КОМУ ушло напоминание и что стало со счётчиками
 * долга, — не текст письма.
 *
 * Два риска, ради которых файл существует:
 * - выборка: напоминать только о созревших неоплаченных долгах, не чаще
 *   интервала и не больше лимита;
 * - постоянная ошибка доставки (бот заблокирован) обязана закончить серию.
 *   Раньше счётчик рос только после успешной отправки, и долг человека,
 *   заблокировавшего бота, каждый день снова попадал в выборку — задача
 *   падала на нём бесконечно, не глядя ни на интервал, ни на лимит.
 */
import type { Group, User } from '@prisma/client';

import { prisma } from '../../../database/client';
import { runDebtReminderJobManually } from '../../../jobs/debt-reminder.job';
import { addMember } from '../helpers/api';
import { cleanDatabase } from '../helpers/fixtures';
import {
  type FakeTelegram,
  BAD_GATEWAY,
  BLOCKED_BY_USER,
  TOO_MANY_REQUESTS,
  TelegramRefusal,
  createFakeTelegram,
  sentTo,
} from '../helpers/bot';

let tg: FakeTelegram;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

let seq = 0;
async function person(firstName: string): Promise<User> {
  seq += 1;
  return prisma.user.create({ data: { telegramId: BigInt(9100 + seq), firstName } });
}

interface Setup {
  group: Group;
  creditor: User;
  pollId: number;
}

/** Группа с включёнными напоминаниями: раз в 3 дня, с суток, не больше 2 раз. */
async function groupWithReminders(chatId: number, enabled = true): Promise<Setup> {
  const creditor = await person('Кредитор');
  const group = await prisma.group.create({
    data: { telegramId: BigInt(chatId), title: `группа ${chatId}` },
  });
  await addMember(group.id, creditor.id, 'ADMIN');
  await prisma.debtReminderSettings.create({
    data: {
      groupId: group.id,
      isEnabled: enabled,
      intervalDays: 3,
      minDebtAge: 1,
      maxReminders: 2,
      messageTemplate: '{userName}: {totalAmount}\n{debtsList}',
      createdBy: creditor.id,
    },
  });
  const poll = await prisma.poll.create({
    data: { groupId: group.id, createdBy: creditor.id, status: 'COMPLETED' },
  });
  return { group, creditor, pollId: poll.id };
}

async function debtor(setup: Setup, name = 'Должник') {
  const user = await person(name);
  await addMember(setup.group.id, user.id);
  return user;
}

async function debt(
  setup: Setup,
  from: User,
  extra: {
    ageDays?: number;
    status?: string;
    reminderCount?: number;
    lastReminderAt?: Date | null;
    amount?: number;
  } = {}
) {
  return prisma.transaction.create({
    data: {
      pollId: setup.pollId,
      fromUserId: from.id,
      toUserId: setup.creditor.id,
      amount: extra.amount ?? 300,
      status: extra.status ?? 'PENDING',
      reminderCount: extra.reminderCount ?? 0,
      lastReminderAt: extra.lastReminderAt ?? null,
      createdAt: daysAgo(extra.ageDays ?? 5),
    },
  });
}

async function row(id: number) {
  return prisma.transaction.findUniqueOrThrow({ where: { id } });
}

/** Ответ Telegram на sendMessage конкретному человеку. */
function failSendTo(user: User, refusal: () => TelegramRefusal) {
  tg.respond('sendMessage', payload =>
    String(payload.chat_id) === String(user.telegramId)
      ? refusal()
      : { message_id: 1, date: 0, chat: { id: Number(payload.chat_id), type: 'private' } }
  );
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

describe('какие долги попадают в рассылку', () => {
  it.each([
    ['созревший неоплаченный, ни разу не напоминали', {}, true],
    ['напоминали давно, лимит не исчерпан', { reminderCount: 1, lastReminderAt: daysAgo(4) }, true],
    ['моложе минимального возраста', { ageDays: 0 }, false],
    ['уже отмечен оплаченным', { status: 'PAID' }, false],
    ['подтверждён получателем', { status: 'CONFIRMED' }, false],
    ['напоминали вчера — интервал не прошёл', { reminderCount: 1, lastReminderAt: daysAgo(1) }, false],
    ['лимит напоминаний исчерпан', { reminderCount: 2, lastReminderAt: daysAgo(10) }, false],
  ] as const)('%s → напоминание: %s', async (_label, state, expected) => {
    const setup = await groupWithReminders(-100801);
    const who = await debtor(setup);
    const tx = await debt(setup, who, state);
    const before = await row(tx.id);

    await runDebtReminderJobManually();

    expect(sentTo(tg, who.telegramId)).toHaveLength(expected ? 1 : 0);
    const after = await row(tx.id);
    if (expected) {
      expect(after.reminderCount).toBe(before.reminderCount + 1);
      expect(after.lastReminderAt!.getTime()).toBeGreaterThan(Date.now() - 60_000);
    } else {
      expect(after.reminderCount).toBe(before.reminderCount);
      expect(after.lastReminderAt).toEqual(before.lastReminderAt);
    }
  });

  it('несколько долгов одного человека — одно письмо, счётчики растут у каждого долга', async () => {
    const setup = await groupWithReminders(-100802);
    const who = await debtor(setup);
    const first = await debt(setup, who, { ageDays: 6, amount: 120 });
    const second = await debt(setup, who, { ageDays: 2, amount: 80 });

    await runDebtReminderJobManually();

    expect(sentTo(tg, who.telegramId)).toHaveLength(1);
    expect((await row(first.id)).reminderCount).toBe(1);
    expect((await row(second.id)).reminderCount).toBe(1);
  });

  it('в группе с выключенными напоминаниями никому не пишем', async () => {
    const setup = await groupWithReminders(-100803, false);
    const who = await debtor(setup);
    const tx = await debt(setup, who);

    await runDebtReminderJobManually();

    expect(tg.sent('sendMessage')).toHaveLength(0);
    expect((await row(tx.id)).reminderCount).toBe(0);
  });

  it('второй запуск в тот же день повторно не пишет', async () => {
    const setup = await groupWithReminders(-100804);
    const who = await debtor(setup);
    await debt(setup, who);

    await runDebtReminderJobManually();
    await runDebtReminderJobManually();

    expect(sentTo(tg, who.telegramId)).toHaveLength(1);
  });

  // BUG: выборка берёт долги человека по ЕГО членству в группе, а не по группе
  // самого долга. Должник, состоящий в двух группах, получает от группы B
  // напоминание о долге из группы A, где напоминания выключены.
  it.failing('рассылка группы напоминает только о долгах этой группы', async () => {
    const quiet = await groupWithReminders(-100805, false);
    const loud = await groupWithReminders(-100806, true);
    const who = await debtor(quiet);
    await addMember(loud.group.id, who.id);
    const foreignDebt = await debt(quiet, who);

    await runDebtReminderJobManually();

    expect(sentTo(tg, who.telegramId)).toHaveLength(0);
    expect((await row(foreignDebt.id)).reminderCount).toBe(0);
  });
});

describe('ошибки доставки', () => {
  it('бот заблокирован: попытка засчитана, и следующий запуск человека не трогает', async () => {
    const setup = await groupWithReminders(-100811);
    const blocked = await debtor(setup, 'Заблокировал');
    const tx = await debt(setup, blocked);
    failSendTo(blocked, BLOCKED_BY_USER);

    await runDebtReminderJobManually();

    const after = await row(tx.id);
    expect(after.reminderCount).toBe(1);
    expect(after.lastReminderAt).not.toBeNull();

    tg.reset();
    await runDebtReminderJobManually();
    expect(sentTo(tg, blocked.telegramId)).toHaveLength(0);
  });

  it.each([
    ['429 Too Many Requests', TOO_MANY_REQUESTS],
    ['502 Bad Gateway', BAD_GATEWAY],
  ])('временный сбой (%s) попытку не тратит — следующий запуск пробует снова', async (_label, refusal) => {
    const setup = await groupWithReminders(-100812);
    const who = await debtor(setup);
    const tx = await debt(setup, who);
    failSendTo(who, refusal);

    await runDebtReminderJobManually();

    expect(await row(tx.id)).toMatchObject({ reminderCount: 0, lastReminderAt: null });

    tg.reset();
    await runDebtReminderJobManually();
    expect(sentTo(tg, who.telegramId)).toHaveLength(1);
    expect((await row(tx.id)).reminderCount).toBe(1);
  });

  it('сбой у одного должника не отменяет письма остальным', async () => {
    const setup = await groupWithReminders(-100813);
    const blocked = await debtor(setup, 'Первый');
    const others = [await debtor(setup, 'Второй'), await debtor(setup, 'Третий')];
    for (const user of [blocked, ...others]) await debt(setup, user);
    failSendTo(blocked, BLOCKED_BY_USER);

    await runDebtReminderJobManually();

    for (const user of others) {
      expect(sentTo(tg, user.telegramId)).toHaveLength(1);
    }
  });
});
