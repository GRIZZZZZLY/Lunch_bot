/* Лимитер выключен до загрузки приложения — см. menu.routes.test.ts. */
process.env.ENABLE_RATE_LIMIT = 'false';

/**
 * Удаление своего аккаунта через настоящий API: express, PostgreSQL, Prisma.
 *
 * Личные данные стираются, а строки, на которые опираются другие участники
 * (закрытые долги, очередь уведомлений), остаются без имени. Незакрытое —
 * долг, свой опрос или закупка, единственный админ группы — удаление
 * не закрывает за человека, а называет.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { tokenFor } from '../helpers/api';
import { DELETED_USER_NAME } from '../../../services/account-deletion.service';

let app: ReturnType<typeof createTestApp>;

const TG = { anna: 700004001, vera: 700004002 } as const;

let anna: number;
let vera: number;
let groupId: number;

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  anna = (await prisma.user.create({ data: { telegramId: BigInt(TG.anna), firstName: 'Анна' } })).id;
  vera = (
    await prisma.user.create({
      data: {
        telegramId: BigInt(TG.vera),
        firstName: 'Вера',
        lastName: 'Петрова',
        username: 'vera_p',
        paymentPhone: 'cipher-phone',
        paymentCard: 'cipher-card',
      },
    })
  ).id;
  groupId = (await prisma.group.create({ data: { telegramId: BigInt(-100000004001), title: 'Команда А' } })).id;
  await prisma.groupMember.createMany({
    data: [
      { groupId, userId: anna, role: 'CREATOR' },
      { groupId, userId: vera, role: 'MEMBER' },
    ],
  });
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

async function deleteAs(telegramId: number) {
  const token = await tokenFor(app, telegramId);
  return {
    token,
    res: await request(app).delete('/api/user/me').set('Authorization', `Bearer ${token}`),
  };
}

describe('DELETE /api/user/me', () => {
  it('стирает личное, оставляет закрытый долг и чужую очередь без имени', async () => {
    const debt = await prisma.transaction.create({
      data: {
        fromUserId: vera,
        toUserId: anna,
        amount: 450,
        status: 'CONFIRMED',
        debtChatId: String(TG.vera),
        debtMessageId: 77,
      },
    });
    await prisma.userProgress.create({ data: { userId: vera } });
    await prisma.outboxEvent.createMany({
      data: [
        {
          entityType: 'TRANSACTION',
          entityId: debt.id,
          transitionVersion: 1,
          messageType: 'PAYMENT_CLAIMED',
          recipientChatId: String(TG.anna),
          payload: { debtorFirstName: 'Вера', amount: '450', transactionId: debt.id },
          status: 'SENT',
        },
        {
          entityType: 'TRANSACTION',
          entityId: debt.id,
          transitionVersion: 2,
          messageType: 'PAYMENT_CONFIRMED',
          recipientChatId: String(TG.vera),
          payload: { payeeFirstName: 'Анна', amount: '450', transactionId: debt.id },
        },
      ],
    });

    const { token, res } = await deleteAs(TG.vera);
    expect(res.status).toBe(200);

    const gone = await prisma.user.findUniqueOrThrow({ where: { id: vera } });
    expect(gone).toMatchObject({
      firstName: DELETED_USER_NAME,
      lastName: null,
      username: null,
      paymentPhone: null,
      paymentCard: null,
      isActive: false,
    });
    expect(gone.telegramId < 0n).toBe(true);
    expect(
      await prisma.groupMember.findFirstOrThrow({ where: { userId: vera } })
    ).toMatchObject({ isActive: false });
    expect(await prisma.userProgress.count({ where: { userId: vera } })).toBe(0);

    // Долг на месте, ссылка на личку стёрта.
    expect(await prisma.transaction.findUniqueOrThrow({ where: { id: debt.id } })).toMatchObject({
      fromUserId: vera,
      status: 'CONFIRMED',
      debtChatId: null,
      debtMessageId: null,
    });
    // Уведомление Анне осталось, имя в нём — нет; уведомление Вере удалено.
    const outbox = await prisma.outboxEvent.findMany();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].payload).toMatchObject({ debtorFirstName: DELETED_USER_NAME });

    // Старый вход больше не действует.
    const me = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);

    // Тот же Telegram-аккаунт входит заново и получает пустой новый профиль.
    await tokenFor(app, TG.vera);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { telegramId: BigInt(TG.vera) } });
    expect(fresh.id).not.toBe(vera);
    expect(fresh.paymentCard).toBeNull();
  });

  it('незакрытый долг не даёт удалить аккаунт и ничего не меняет', async () => {
    await prisma.transaction.create({
      data: { fromUserId: vera, toUserId: anna, amount: 450, status: 'PENDING' },
    });

    const { res } = await deleteAs(TG.vera);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ACCOUNT_HAS_OPEN_ITEMS');
    expect(res.body.blockers).toEqual([expect.stringContaining('Незакрытых долгов: 1')]);
    // Имя при входе обновляется из Telegram, поэтому смотрим на то, что вход не трогает.
    expect(await prisma.user.findUniqueOrThrow({ where: { id: vera } })).toMatchObject({
      telegramId: BigInt(TG.vera),
      paymentCard: 'cipher-card',
      isActive: true,
    });
  });

  it('единственный админ группы с участниками сначала передаёт права', async () => {
    const blocked = await deleteAs(TG.anna);
    expect(blocked.res.status).toBe(409);
    expect(blocked.res.body.blockers).toEqual([expect.stringContaining('«Команда А»')]);

    await prisma.groupMember.updateMany({ where: { userId: vera }, data: { role: 'ADMIN' } });
    const allowed = await deleteAs(TG.anna);
    expect(allowed.res.status).toBe(200);
  });

  it('админ группы, где никого больше нет, удаляется сразу', async () => {
    await prisma.groupMember.updateMany({
      where: { userId: vera },
      data: { isActive: false, leftAt: new Date() },
    });

    const { res } = await deleteAs(TG.anna);

    expect(res.status).toBe(200);
  });

  it('правило про админа не касается обычного участника', async () => {
    // В группе не осталось админов вовсе — участника это не держит.
    await prisma.groupMember.updateMany({ where: { userId: anna }, data: { role: 'MEMBER' } });

    const { res } = await deleteAs(TG.vera);

    expect(res.status).toBe(200);
  });

  it('свой идущий опрос надо закончить до удаления', async () => {
    await prisma.poll.create({ data: { groupId, createdBy: vera, status: 'ACTIVE', duration: 60 } });

    const { res } = await deleteAs(TG.vera);

    expect(res.status).toBe(409);
    expect(res.body.blockers).toEqual([expect.stringContaining('опрос в группе «Команда А»')]);
  });
});
