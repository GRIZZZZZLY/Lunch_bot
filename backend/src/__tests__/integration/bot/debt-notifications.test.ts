/**
 * Личные сообщения о долге после расчёта заказа категории
 * (OrderCalculationService.finalizeCalculation → рассылка должникам).
 *
 * Пока шёл расчёт, каждому участнику в личку висело «⏳ Ожидаем расчёт»;
 * ссылки на эти сообщения лежат JSON-ом в category_orders.participant_messages.
 * После расчёта бот правит ожидание в сообщение о долге с кнопкой «Оплатил»
 * или, если править нечего, шлёт новое. Без этого сообщения должник не знает,
 * сколько и кому переводить.
 */
import type { User } from '@prisma/client';

import { prisma } from '../../../database/client';
import { OrderCalculationService } from '../../../services/order-calculation.service';
import { cleanDatabase } from '../helpers/fixtures';
import { type FakeTelegram, buttonsOf, createFakeTelegram, sentTo } from '../helpers/bot';

let tg: FakeTelegram;

interface Order {
  categoryOrderId: number;
  responsible: User;
  debtors: User[];
}

/** Заказ «Пицца» на троих: собирает R, должники D1 и D2, по 300 ₽. */
async function orderReadyToFinalize(participantMessages: string | null): Promise<Order> {
  const [responsible, d1, d2] = await Promise.all(
    ['Сборщик', 'Должник 1', 'Должник 2'].map((firstName, i) =>
      prisma.user.create({ data: { telegramId: BigInt(9701 + i), firstName } })
    )
  );
  const group = await prisma.group.create({ data: { telegramId: BigInt(-100970), title: 'Пиццерия' } });
  const pizza = await prisma.menuItem.create({
    data: { name: 'Пицца', price: 300, groupId: group.id, createdBy: responsible.id },
  });
  const poll = await prisma.poll.create({
    data: { groupId: group.id, createdBy: responsible.id, status: 'COMPLETED' },
  });
  const people = [responsible, d1, d2];
  await prisma.vote.createMany({
    data: people.map(u => ({ pollId: poll.id, userId: u.id, menuItemId: pizza.id })),
  });
  const order = await prisma.categoryOrder.create({
    data: {
      pollId: poll.id,
      category: 'Пицца',
      responsibleUserId: responsible.id,
      selectionStatus: 'COMPLETED',
      calculationStatus: 'IN_PROGRESS',
      participantCount: 3,
      participantMessages,
    },
  });
  await prisma.orderItem.createMany({
    data: people.map(u => ({
      categoryOrderId: order.id,
      userId: u.id,
      itemName: 'Пицца',
      price: 300,
      enteredBy: responsible.id,
    })),
  });
  return { categoryOrderId: order.id, responsible, debtors: [d1, d2] };
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

it('ожидание расчёта правится в сообщение о долге, у кого его нет — получает новое; кнопка «Оплатил» ведёт на свой долг', async () => {
  const order = await orderReadyToFinalize(null);
  const [d1, d2] = order.debtors;
  await prisma.categoryOrder.update({
    where: { id: order.categoryOrderId },
    data: {
      participantMessages: JSON.stringify({
        [d1.id]: { chatId: String(d1.telegramId), messageId: 55 },
      }),
    },
  });

  await OrderCalculationService.finalizeCalculation(order.categoryOrderId);

  const debts = await prisma.transaction.findMany({
    where: { categoryOrderId: order.categoryOrderId },
  });
  expect(debts.map(t => t.fromUserId).sort()).toEqual([d1.id, d2.id].sort());

  const edit = tg.sent('editMessageText').find(c => c.payload.message_id === 55);
  const d1Debt = debts.find(t => t.fromUserId === d1.id)!;
  expect(buttonsOf(edit).map(b => b.callback_data)).toContain(`budget:mark_paid:${d1Debt.id}`);
  expect(sentTo(tg, d1.telegramId)).toHaveLength(0);

  const [fresh] = sentTo(tg, d2.telegramId);
  const d2Debt = debts.find(t => t.fromUserId === d2.id)!;
  expect(buttonsOf(fresh).map(b => b.callback_data)).toContain(`budget:mark_paid:${d2Debt.id}`);

  // Привязка к сообщению сохраняется: по ней потом правят статус долга.
  expect(d1Debt).toMatchObject({ debtMessageId: 55, debtChatId: String(d1.telegramId) });
  expect((await prisma.transaction.findUniqueOrThrow({ where: { id: d2Debt.id } })).debtMessageId).not.toBeNull();
});

// BUG: битый JSON в participant_messages роняет JSON.parse в начале рассылки,
// и ни один должник не получает сообщения о долге — хотя ссылки на ожидания
// нужны лишь для правки, а новое сообщение можно отправить всегда.
it.failing('испорченные ссылки на ожидания не лишают должников сообщения о долге', async () => {
  const order = await orderReadyToFinalize('{"broken":');

  await OrderCalculationService.finalizeCalculation(order.categoryOrderId);

  for (const debtor of order.debtors) {
    expect(sentTo(tg, debtor.telegramId)).toHaveLength(1);
  }
});
