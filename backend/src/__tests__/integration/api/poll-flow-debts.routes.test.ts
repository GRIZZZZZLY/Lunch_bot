/**
 * Долги из голосования с одним ответственным — на настоящей базе.
 *
 * Путь без категорий: голосование завершено, в его итогах лежат победившие
 * блюда и кто за них голосовал; кто-то нажимает в группе «Я оформлю!», и
 * `PollFlowService` создаёт каждому остальному долг на цену его блюда.
 * HTTP-маршрута у этого шага нет — его вызывает бот, поэтому сервисы
 * вызываются напрямую, как в `budget-lifecycle.redis.test.ts`. Через HTTP
 * проверяется то, что потом видит человек: разбивка заказа по участникам.
 *
 * Бота в этом файле нет намеренно: рассылка необязательна, а назначение
 * ответственного и долги без неё обязаны состояться.
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { tokenFor } from '../helpers/api';
import { PollFlowService } from '../../../services/poll-flow.service';
import { ResponsibleService } from '../../../services/responsible.service';

/* `ResponsibleService` подгружает `PollFlowService` динамически по пути с
   `.js` — так он находится в собранном коде, а jest под ts-jest такой путь не
   разрешает. Это не подмена: путь указывает на НАСТОЯЩИЙ модуль. */
jest.mock(
  '../../../services/poll-flow.service.js',
  () => jest.requireActual('../../../services/poll-flow.service'),
  { virtual: true }
);

let app: ReturnType<typeof createTestApp>;

const TELEGRAM = {
  anna: 700000501,
  boris: 700000502,
  vera: 700000503,
  gleb: 700000504,
} as const;
type Who = keyof typeof TELEGRAM;

interface World {
  user: Record<Who, number>;
  pollId: number;
  pizzaId: number;
  sushiId: number;
}

let world: World;

/**
 * Анна и Борис выбрали пиццу (500), Вера — суши (700,50). Глеб в группе, но
 * в этом голосовании его не ждали: он не голосовал.
 */
async function buildWorld(): Promise<World> {
  const user = {} as Record<Who, number>;
  for (const who of Object.keys(TELEGRAM) as Who[]) {
    const row = await prisma.user.create({
      data: { telegramId: BigInt(TELEGRAM[who]), firstName: who },
    });
    user[who] = row.id;
  }

  const group = await prisma.group.create({
    data: { telegramId: BigInt(-100000000501), title: 'Команда обеда' },
  });
  await prisma.groupMember.createMany({
    data: (Object.keys(user) as Who[]).map(who => ({
      groupId: group.id,
      userId: user[who],
      role: who === 'anna' ? 'CREATOR' : 'MEMBER',
    })),
  });

  const pizza = await prisma.menuItem.create({
    data: { name: 'Пицца', price: 500, groupId: group.id, createdBy: user.anna },
  });
  const sushi = await prisma.menuItem.create({
    data: { name: 'Суши', price: 700.5, groupId: group.id, createdBy: user.anna },
  });

  const poll = await prisma.poll.create({
    data: { groupId: group.id, status: 'COMPLETED', createdBy: user.anna },
  });

  const winner = (menuItemId: number, name: string, price: number, voters: Who[]) => ({
    menuItemId,
    menuItemName: name,
    menuItemSnapshot: { price },
    voterIds: voters.map(who => user[who]),
    voters: voters.map(who => ({ userId: user[who], firstName: who })),
    voteCount: voters.length,
    votedAt: [],
  });
  /* Форма итогов — та, что сохраняет завершение голосования
     (`poll-winners.ts`): долги считаются из неё, а не из голосов. */
  await prisma.pollResult.create({
    data: {
      pollId: poll.id,
      responsibleUserId: user.anna,
      totalVotes: 3,
      rouletteData: JSON.stringify({
        winners: [
          winner(pizza.id, 'Пицца', 500, ['anna', 'boris']),
          winner(sushi.id, 'Суши', 700.5, ['vera']),
        ],
      }),
    },
  });

  await prisma.responsibleSelection.create({
    data: { pollId: poll.id, mode: 'volunteer_with_fallback', status: 'WAITING' },
  });
  await prisma.pollParticipant.createMany({
    data: (['anna', 'boris', 'vera'] as Who[]).map(who => ({
      pollId: poll.id,
      userId: user[who],
      status: 'EXPECTED',
    })),
  });

  return { user, pollId: poll.id, pizzaId: pizza.id, sushiId: sushi.id };
}

async function pollDebts() {
  const rows = await prisma.transaction.findMany({
    where: { pollId: world.pollId },
    orderBy: { fromUserId: 'asc' },
  });
  return rows.map(row => ({
    from: row.fromUserId,
    to: row.toUserId,
    amount: String(row.amount),
    menuItemId: row.menuItemId,
    status: row.status,
  }));
}

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  world = await buildWorld();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('долги из голосования', () => {
  it('каждый, кроме ответственного, должен ему цену своего блюда', async () => {
    await PollFlowService.processResponsibleSelected(world.pollId, world.user.boris);

    expect(await pollDebts()).toEqual([
      { from: world.user.anna, to: world.user.boris, amount: '500', menuItemId: world.pizzaId, status: 'PENDING' },
      { from: world.user.vera, to: world.user.boris, amount: '700.5', menuItemId: world.sushiId, status: 'PENDING' },
    ]);
  });

  /* Вызов повторяют после сбоя рассылки или перезапуска обработчика: долги
     уже записаны, второй комплект удвоил бы сумму каждому. */
  it('повторный вызов не создаёт второй комплект', async () => {
    await PollFlowService.processResponsibleSelected(world.pollId, world.user.boris);
    const first = await pollDebts();

    await PollFlowService.processResponsibleSelected(world.pollId, world.user.boris);

    expect(await pollDebts()).toEqual(first);
  });

  /* Защита от повтора — «посчитать, потом вставить» внутри транзакции
     READ COMMITTED, без уникального ограничения на долги голосования. Два
     одновременных вызова оба видят ноль и оба вставляют. */
  // Регрессия: параллельные вызовы создавали второй комплект долгов.
  it('одновременные вызовы не создают второй комплект', async () => {
    await Promise.all([
      PollFlowService.processResponsibleSelected(world.pollId, world.user.boris),
      PollFlowService.processResponsibleSelected(world.pollId, world.user.boris),
      PollFlowService.processResponsibleSelected(world.pollId, world.user.boris),
    ]);

    expect(await pollDebts()).toHaveLength(2);
  });
});

describe('«Я оформлю!» в голосовании', () => {
  /* Два человека нажали одновременно. Роль забирается условной записью
     WAITING → VOLUNTEER_SELECTED, поэтому победитель один, и долги
     выставлены ему одному — без второго комплекта на проигравшего. */
  it('два одновременных отклика: ответственный один, долги — только ему', async () => {
    const results = await Promise.all([
      ResponsibleService.handleVolunteer(world.pollId, TELEGRAM.boris),
      ResponsibleService.handleVolunteer(world.pollId, TELEGRAM.vera),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    const winner: Who = results[0] ? 'boris' : 'vera';

    const selection = await prisma.responsibleSelection.findUniqueOrThrow({
      where: { pollId: world.pollId },
    });
    expect(selection).toMatchObject({
      status: 'VOLUNTEER_SELECTED',
      selectedUserId: world.user[winner],
    });

    const debts = await pollDebts();
    expect(debts).toHaveLength(2);
    for (const debt of debts) {
      expect(debt.to).toBe(world.user[winner]);
      expect(debt.from).not.toBe(world.user[winner]);
    }
  });

  /* Член группы, которого в этом голосовании не ждали, ответственным стать
     не может: он не заказывал и не знает, что заказывать. */
  it('тот, кого в голосовании не ждали, роль не получает', async () => {
    const taken = await ResponsibleService.handleVolunteer(world.pollId, TELEGRAM.gleb);

    expect(taken).toBe(false);
    expect(
      (await prisma.responsibleSelection.findUniqueOrThrow({ where: { pollId: world.pollId } })).status
    ).toBe('WAITING');
    expect(await pollDebts()).toHaveLength(0);
  });
});

describe('разбивка заказа по участникам', () => {
  async function breakdown() {
    const response = await request(app)
      .get(`/api/budget/poll-breakdown/${world.pollId}`)
      .set('Authorization', `Bearer ${await tokenFor(app, TELEGRAM.anna)}`);
    expect(response.status).toBe(200);
    return response.body.data;
  }

  /* У долгов голосования нет своей цены позиции: она берётся из блюда. */
  it('цена позиции у долга из голосования — цена блюда', async () => {
    await PollFlowService.processResponsibleSelected(world.pollId, world.user.boris);

    const data = await breakdown();

    const byUser = Object.fromEntries(
      data.transactions.map((tx: { userId: number; itemPrice: number; menuItemName: string }) => [
        tx.userId,
        { itemPrice: tx.itemPrice, menuItemName: tx.menuItemName },
      ])
    );
    expect(byUser).toEqual({
      [world.user.anna]: { itemPrice: 500, menuItemName: 'Пицца' },
      [world.user.vera]: { itemPrice: 700.5, menuItemName: 'Суши' },
    });
    expect(data.totalItemsCost).toBe(1200.5);
  });

  /* Старые долги без цены позиции и без блюда: цена восстанавливается как
     сумма минус доли расходов и в минус не уходит. */
  it('без цены и без блюда позиция восстанавливается из суммы, не ниже нуля', async () => {
    const debt = (fromUserId: number, amount: number, deliveryShare: number, serviceShare: number) =>
      prisma.transaction.create({
        data: {
          pollId: world.pollId,
          fromUserId,
          toUserId: world.user.boris,
          amount,
          deliveryShare,
          serviceShare,
          status: 'PENDING',
        },
      });
    await debt(world.user.anna, 600, 100, 50);
    await debt(world.user.vera, 50, 100, 0);

    const data = await breakdown();

    const itemPriceOf = (userId: number) =>
      data.transactions.find((tx: { userId: number }) => tx.userId === userId).itemPrice;
    expect(itemPriceOf(world.user.anna)).toBe(450);
    expect(itemPriceOf(world.user.vera)).toBe(0);
  });

  it('с ценой позиции на долге берётся она, а не цена блюда', async () => {
    await prisma.transaction.create({
      data: {
        pollId: world.pollId,
        fromUserId: world.user.anna,
        toUserId: world.user.boris,
        menuItemId: world.pizzaId,
        amount: 433.34,
        itemPrice: 400,
        deliveryShare: 33.34,
        status: 'PENDING',
      },
    });

    const [tx] = (await breakdown()).transactions;

    expect(tx).toMatchObject({ itemPrice: 400, deliveryShare: 33.34, totalAmount: 433.34 });
  });
});
