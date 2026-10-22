/**
 * Ежеминутная задача магазинных забегов (store-run-autoclose.job):
 * 1) сбор заказов истёк — COLLECTING → SHOPPING, участникам и инициатору
 *    пишем;
 * 2) инициатор завис в магазине дольше таймаута — SHOPPING → CANCELLED,
 *    висящие сообщения «жди цены» в группе и в личках удаляются, инициатору
 *    сообщаем.
 *
 * Запускается тот самый обработчик, который ставит задача в cron: подменён
 * только планировщик (чтобы забрать обработчик, а не ждать минуту) и
 * Telegram. Главный риск — переходы статуса: завершённый (SETTLED) или
 * отменённый забег задача трогать не должна, иначе люди получают
 * «забег отменён» по уже оплаченной покупке, а сообщения с итогами пропадают.
 */
import cron from 'node-cron';
import type { User } from '@prisma/client';

import { prisma } from '../../../database/client';
import { initStoreRunAutoCloseJob } from '../../../jobs/store-run-autoclose.job';
import { cleanDatabase } from '../helpers/fixtures';
import {
  type FakeTelegram,
  TelegramRefusal,
  createFakeTelegram,
  sentTo,
} from '../helpers/bot';

let tg: FakeTelegram;
let tick: () => Promise<void>;

const MINUTE = 60 * 1000;
const GROUP_CHAT = -100900;

let seq = 0;
async function person(firstName: string): Promise<User> {
  seq += 1;
  return prisma.user.create({ data: { telegramId: BigInt(9300 + seq), firstName } });
}

async function storeRun(data: {
  status: string;
  collectUntil?: Date;
  shoppingAt?: Date | null;
  groupMessageId?: number | null;
  dmMessages?: Array<{ chatId: number; messageId: number }>;
}) {
  const initiator = await person('Инициатор');
  const buyer = await person('Покупатель');
  const group =
    (await prisma.group.findUnique({ where: { telegramId: BigInt(GROUP_CHAT) } })) ??
    (await prisma.group.create({ data: { telegramId: BigInt(GROUP_CHAT), title: 'Офис' } }));
  const run = await prisma.storeRun.create({
    data: {
      groupId: group.id,
      initiatorId: initiator.id,
      storeName: 'Лавка',
      status: data.status,
      collectUntil: data.collectUntil ?? new Date(Date.now() - MINUTE),
      shoppingAt: data.shoppingAt ?? null,
      groupMessageId: data.groupMessageId ?? null,
      dmMessages: data.dmMessages ? JSON.stringify(data.dmMessages) : null,
    },
  });
  await prisma.storeItem.createMany({
    data: [
      { storeRunId: run.id, userId: buyer.id, name: 'Молоко' },
      { storeRunId: run.id, userId: initiator.id, name: 'Хлеб' },
    ],
  });
  return { run, initiator, buyer };
}

async function statusOf(id: number) {
  return (await prisma.storeRun.findUniqueOrThrow({ where: { id } })).status;
}

function deletedMessages() {
  return tg
    .sent('deleteMessage')
    .map(c => `${c.payload.chat_id}:${c.payload.message_id}`)
    .sort();
}

beforeAll(async () => {
  tg = await createFakeTelegram();
  jest.spyOn(cron, 'schedule').mockImplementation(((_expr: string, fn: () => Promise<void>) => {
    tick = fn;
    return { stop: () => undefined } as never;
  }) as never);
  initStoreRunAutoCloseJob();
});

beforeEach(async () => {
  await cleanDatabase();
  tg.reset();
});

afterAll(async () => {
  jest.restoreAllMocks();
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('сбор заказов истёк', () => {
  it('COLLECTING с прошедшим сроком → SHOPPING; пишем покупателю и инициатору', async () => {
    const { run, initiator, buyer } = await storeRun({ status: 'COLLECTING' });

    await tick();

    const after = await prisma.storeRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(after.status).toBe('SHOPPING');
    expect(after.shoppingAt).toBeInstanceOf(Date);
    expect(sentTo(tg, buyer.telegramId)).toHaveLength(1);
    expect(sentTo(tg, initiator.telegramId)).toHaveLength(1);
  });

  it('срок сбора ещё не вышел — забег не трогаем и никому не пишем', async () => {
    const { run } = await storeRun({
      status: 'COLLECTING',
      collectUntil: new Date(Date.now() + 10 * MINUTE),
    });

    await tick();

    expect(await statusOf(run.id)).toBe('COLLECTING');
    expect(tg.sent('sendMessage')).toHaveLength(0);
  });

  it.each(['CANCELLED', 'SETTLED'])(
    '%s с прошедшим сроком сбора не «воскресает» в SHOPPING',
    async status => {
      const { run } = await storeRun({ status });

      await tick();

      expect(await statusOf(run.id)).toBe(status);
      expect(tg.sent('sendMessage')).toHaveLength(0);
    }
  );
});

describe('инициатор завис в магазине', () => {
  const stale = () => new Date(Date.now() - 4 * 60 * MINUTE); // таймаут по умолчанию — 3 часа

  it('SHOPPING дольше таймаута → CANCELLED; пост в группе и приглашения в личках удалены, инициатор извещён', async () => {
    const { run, initiator } = await storeRun({
      status: 'SHOPPING',
      shoppingAt: stale(),
      groupMessageId: 501,
      dmMessages: [
        { chatId: 9401, messageId: 11 },
        { chatId: 9402, messageId: 12 },
      ],
    });

    await tick();

    const after = await prisma.storeRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(after.status).toBe('CANCELLED');
    expect(after.cancelledAt).toBeInstanceOf(Date);
    expect(deletedMessages()).toEqual([`${GROUP_CHAT}:501`, '9401:11', '9402:12'].sort());
    expect(sentTo(tg, initiator.telegramId)).toHaveLength(1);
  });

  it('недавно ушедший в магазин не отменяется', async () => {
    const { run } = await storeRun({
      status: 'SHOPPING',
      shoppingAt: new Date(Date.now() - 30 * MINUTE),
      groupMessageId: 502,
    });

    await tick();

    expect(await statusOf(run.id)).toBe('SHOPPING');
    expect(tg.sent('deleteMessage')).toHaveLength(0);
  });

  it('завершённый забег (SETTLED) с давним походом в магазин не отменяется, его сообщения живы', async () => {
    const { run, initiator } = await storeRun({
      status: 'SETTLED',
      shoppingAt: stale(),
      groupMessageId: 503,
      dmMessages: [{ chatId: 9403, messageId: 13 }],
    });

    await tick();

    expect(await statusOf(run.id)).toBe('SETTLED');
    expect(tg.sent('deleteMessage')).toHaveLength(0);
    expect(sentTo(tg, initiator.telegramId)).toHaveLength(0);
  });

  it('уже удалённое сообщение не мешает отмене и удалению остальных', async () => {
    const { run, initiator } = await storeRun({
      status: 'SHOPPING',
      shoppingAt: stale(),
      groupMessageId: 504,
      dmMessages: [{ chatId: 9404, messageId: 14 }],
    });
    tg.respond('deleteMessage', payload =>
      payload.message_id === 504
        ? new TelegramRefusal(400, 'Bad Request: message to delete not found')
        : true
    );

    await tick();

    expect(await statusOf(run.id)).toBe('CANCELLED');
    expect(deletedMessages()).toContain('9404:14');
    expect(sentTo(tg, initiator.telegramId)).toHaveLength(1);
  });
});
