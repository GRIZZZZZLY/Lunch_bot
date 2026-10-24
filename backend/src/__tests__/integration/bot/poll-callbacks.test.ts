/**
 * Кнопки под сообщениями бота: управление голосованием, «Я обедаю»,
 * отключение автоголосований, отметки по долгам.
 *
 * Нажатие проходит весь путь настоящего бота: middleware, разбор
 * callback_data в bot.ts, обработчик, сервисы, PostgreSQL. Проверяется
 * решение (что изменилось в базе и что ушло в Telegram), а не тексты ответов.
 *
 * Главный риск — права: кнопка видна всей группе, и нажать её может любой.
 * Права решает роль в группе (ADMIN/CREATOR), а не глобальный isAdmin.
 */
import type { User, Group, Poll } from '@prisma/client';

import { prisma } from '../../../database/client';
import { addMember } from '../helpers/api';
import { cleanDatabase, createTestGroup, createTestUser } from '../helpers/fixtures';
import {
  type FakeTelegram,
  type TgChat,
  type TgUser,
  buttonsOf,
  callback,
  createFakeTelegram,
  groupChat,
  privateChat,
} from '../helpers/bot';

let tg: FakeTelegram;

const CHAT_ID = -100600;
const CHAT: TgChat = groupChat(CHAT_ID);

interface World {
  group: Group;
  creator: User;
  admin: User;
  member: User;
  globalAdmin: User;
  outsider: User;
  poll: Poll;
  dishes: number[];
}

function asTg(user: User): TgUser {
  return { id: Number(user.telegramId), first_name: user.firstName };
}

let seq = 0;
async function person(firstName: string, isAdmin = false): Promise<User> {
  seq += 1;
  return createTestUser({
    telegramId: BigInt(6000 + seq),
    firstName,
    username: `u${seq}`,
    isAdmin,
  });
}

/** Группа с активным голосованием, в котором уже есть голоса. */
async function world(): Promise<World> {
  const group = await createTestGroup({ telegramId: BigInt(CHAT_ID) });
  const creator = await person('Создатель');
  const admin = await person('Админ');
  const member = await person('Участник');
  // Глобальный админ бота без роли в этой группе.
  const globalAdmin = await person('Суперадмин', true);
  const outsider = await person('Посторонний');
  await addMember(group.id, creator.id, 'CREATOR');
  await addMember(group.id, admin.id, 'ADMIN');
  await addMember(group.id, member.id, 'MEMBER');
  await addMember(group.id, globalAdmin.id, 'MEMBER');

  const dishes = await Promise.all(
    ['Плов', 'Суп'].map(name =>
      prisma.menuItem.create({
        data: { name, price: 300, groupId: group.id, createdBy: creator.id },
      })
    )
  );
  const poll = await prisma.poll.create({
    data: { groupId: group.id, createdBy: creator.id, status: 'ACTIVE', duration: 60 },
  });
  await prisma.vote.createMany({
    data: [
      { pollId: poll.id, userId: member.id, menuItemId: dishes[0].id },
      { pollId: poll.id, userId: admin.id, menuItemId: dishes[0].id },
      { pollId: poll.id, userId: creator.id, menuItemId: dishes[1].id },
    ],
  });

  return {
    group,
    creator,
    admin,
    member,
    globalAdmin,
    outsider,
    poll,
    dishes: dishes.map(d => d.id),
  };
}

async function pollStatus(pollId: number) {
  return (await prisma.poll.findUnique({ where: { id: pollId } }))?.status;
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

/* Эти кнопки (cancel_poll, complete_poll, run_roulette, openpoll) сейчас не
   выдаёт ни одна клавиатура бота, но маршруты в bot.ts живы и откликаются на
   кнопки из старых сообщений, которые остались в чатах. */
const notGroupAdmins = [
  ['рядовой участник', 'member'],
  ['глобальный админ бота без роли в группе', 'globalAdmin'],
  ['человек не из нашей базы', 'outsider'],
] as const;

describe('завершение и отмена голосования кнопкой', () => {
  it.each(notGroupAdmins)('%s не может отменить голосование', async (_label, who) => {
    const w = await world();

    await tg.receive(callback(asTg(w[who]), CHAT, `cancel_poll:${w.poll.id}`));

    expect(await pollStatus(w.poll.id)).toBe('ACTIVE');
  });

  it.each(notGroupAdmins)('%s не может завершить голосование', async (_label, who) => {
    const w = await world();

    await tg.receive(callback(asTg(w[who]), CHAT, `complete_poll:${w.poll.id}`));

    expect(await pollStatus(w.poll.id)).toBe('ACTIVE');
    expect(await prisma.pollResult.count({ where: { pollId: w.poll.id } })).toBe(0);
  });

  it('админ, покинувший группу, прав больше не имеет', async () => {
    const w = await world();
    await prisma.groupMember.updateMany({
      where: { groupId: w.group.id, userId: w.admin.id },
      data: { isActive: false, leftAt: new Date() },
    });

    await tg.receive(callback(asTg(w.admin), CHAT, `cancel_poll:${w.poll.id}`));

    expect(await pollStatus(w.poll.id)).toBe('ACTIVE');
  });

  it.each([
    ['ADMIN', 'admin'],
    ['CREATOR', 'creator'],
  ] as const)('%s группы отменяет голосование', async (_role, who) => {
    const w = await world();

    await tg.receive(callback(asTg(w[who]), CHAT, `cancel_poll:${w.poll.id}`));

    expect(await pollStatus(w.poll.id)).toBe('CANCELLED');
  });

  it('админ группы завершает голосование: итог записан, сообщение в группе заменено итогами', async () => {
    const w = await world();

    await tg.receive(callback(asTg(w.admin), CHAT, `complete_poll:${w.poll.id}`));

    expect(await pollStatus(w.poll.id)).toBe('COMPLETED');
    const result = await prisma.pollResult.findUnique({ where: { pollId: w.poll.id } });
    expect(result?.winnerMenuItemId).toBe(w.dishes[0]);
    expect(
      tg.sent('editMessageText').some(c => String(c.payload.chat_id) === String(CHAT_ID))
    ).toBe(true);
  });

  it('кнопка админа на чужом голосовании (другая группа) не действует', async () => {
    const w = await world();
    const otherGroup = await createTestGroup({ telegramId: BigInt(-100699) });
    const foreignPoll = await prisma.poll.create({
      data: { groupId: otherGroup.id, createdBy: w.outsider.id, status: 'ACTIVE' },
    });

    await tg.receive(callback(asTg(w.admin), CHAT, `cancel_poll:${foreignPoll.id}`));

    expect(await pollStatus(foreignPoll.id)).toBe('ACTIVE');
  });
});

describe('рулетка ответственного', () => {
  /* Единственное состояние, в котором ветка рулетки может дойти до розыгрыша:
     голосование закрыто, голоса есть, итога ещё нет. */
  async function closedWithoutResult() {
    const w = await world();
    await prisma.poll.update({
      where: { id: w.poll.id },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });
    return w;
  }

  it.each(notGroupAdmins)('%s рулетку не запускает: итог не появляется', async (_label, who) => {
    const w = await closedWithoutResult();

    await tg.receive(callback(asTg(w[who]), CHAT, `run_roulette:${w.poll.id}`));

    expect(await prisma.pollResult.count({ where: { pollId: w.poll.id } })).toBe(0);
  });

  it('пока голосование идёт, рулетка не крутится даже у админа', async () => {
    const w = await world();

    await tg.receive(callback(asTg(w.admin), CHAT, `run_roulette:${w.poll.id}`));

    expect(await prisma.pollResult.count({ where: { pollId: w.poll.id } })).toBe(0);
    expect(await pollStatus(w.poll.id)).toBe('ACTIVE');
  });

  // Регрессия: прежний итог искался по id итога вместо id голосования, кнопка рулетки не работала.
  // Тест идёт ~10 с: анимация рулетки — настоящие паузы.
  it('админ группы крутит рулетку: ответственный выбран из проголосовавших', async () => {
    const w = await closedWithoutResult();

    await tg.receive(callback(asTg(w.admin), CHAT, `run_roulette:${w.poll.id}`));

    const result = await prisma.pollResult.findUnique({ where: { pollId: w.poll.id } });
    expect([w.member.id, w.admin.id, w.creator.id]).toContain(result?.responsibleUserId);
  });
});

describe('кнопка «Проголосовать» (openpoll)', () => {
  it('для идущего голосования отвечает ссылкой в личку бота на это голосование', async () => {
    const w = await world();

    await tg.receive(callback(asTg(w.member), CHAT, `openpoll:${w.poll.id}`));

    const [answer] = tg.sent('answerCallbackQuery');
    expect(answer.payload.url).toContain(`start=vote_${w.poll.id}`);
  });

  it('для закрытого голосования ссылки нет', async () => {
    const w = await world();
    await prisma.poll.update({ where: { id: w.poll.id }, data: { status: 'COMPLETED' } });

    await tg.receive(callback(asTg(w.member), CHAT, `openpoll:${w.poll.id}`));

    const [answer] = tg.sent('answerCallbackQuery');
    expect(answer.payload.url).toBeUndefined();
  });
});

describe('«Я обедаю» в приветствии группы', () => {
  it('участник, отказавшийся от голосований, снова в них участвует', async () => {
    const w = await world();
    await prisma.groupMember.updateMany({
      where: { groupId: w.group.id, userId: w.member.id },
      data: { participatesInPolls: false },
    });

    await tg.receive(callback(asTg(w.member), CHAT, `optin_${CHAT_ID}`));

    const row = await prisma.groupMember.findFirst({
      where: { groupId: w.group.id, userId: w.member.id },
    });
    expect(row).toMatchObject({ isActive: true, participatesInPolls: true });
  });

  it('незнакомец из группы регистрируется и попадает в состав обедающих; приветствие обновлено с той же кнопкой', async () => {
    const w = await world();
    const stranger: TgUser = { id: 6999, first_name: 'Новенький' };

    await tg.receive(callback(stranger, CHAT, `optin_${CHAT_ID}`));

    const row = await prisma.groupMember.findFirst({
      where: { groupId: w.group.id, user: { telegramId: BigInt(stranger.id) } },
    });
    expect(row).toMatchObject({ isActive: true, participatesInPolls: true });
    const [edit] = tg.sent('editMessageText');
    expect(buttonsOf(edit).some(b => b.callback_data === `optin_${CHAT_ID}`)).toBe(true);
  });

  it('нажатие в личном чате ничего не заводит', async () => {
    const stranger: TgUser = { id: 6998, first_name: 'Личка' };

    await tg.receive(callback(stranger, privateChat(stranger), `optin_${CHAT_ID}`));

    expect(await prisma.group.count()).toBe(0);
    expect(await prisma.groupMember.count()).toBe(0);
  });
});

describe('отключение автоголосований кнопкой (recurring:disable)', () => {
  async function schedule(w: World) {
    return prisma.recurringPoll.create({
      data: {
        groupId: w.group.id,
        daysOfWeek: '[1,2,3,4,5]',
        timeOfDay: '11:30',
        createdBy: w.creator.id,
        isEnabled: true,
      },
    });
  }

  it.each(notGroupAdmins)('%s расписание не отключает', async (_label, who) => {
    const w = await world();
    const s = await schedule(w);

    await tg.receive(callback(asTg(w[who]), privateChat(asTg(w[who])), `recurring:disable:${s.id}`));

    expect((await prisma.recurringPoll.findUnique({ where: { id: s.id } }))?.isEnabled).toBe(true);
  });

  it('админ другой группы чужое расписание не отключает', async () => {
    const w = await world();
    const otherGroup = await createTestGroup({ telegramId: BigInt(-100698) });
    const foreign = await prisma.recurringPoll.create({
      data: {
        groupId: otherGroup.id,
        daysOfWeek: '[1]',
        timeOfDay: '12:00',
        createdBy: w.outsider.id,
        isEnabled: true,
      },
    });

    await tg.receive(callback(asTg(w.admin), privateChat(asTg(w.admin)), `recurring:disable:${foreign.id}`));

    expect((await prisma.recurringPoll.findUnique({ where: { id: foreign.id } }))?.isEnabled).toBe(true);
  });

  it('админ группы отключает расписание из лички', async () => {
    const w = await world();
    const s = await schedule(w);

    await tg.receive(callback(asTg(w.admin), privateChat(asTg(w.admin)), `recurring:disable:${s.id}`));

    expect((await prisma.recurringPoll.findUnique({ where: { id: s.id } }))?.isEnabled).toBe(false);
  });
});

describe('кнопки долга в личке', () => {
  async function debt(w: World, status = 'PENDING') {
    return prisma.transaction.create({
      data: {
        pollId: w.poll.id,
        fromUserId: w.member.id,
        toUserId: w.admin.id,
        amount: 350,
        status,
      },
    });
  }

  async function statusOf(id: number) {
    return (await prisma.transaction.findUnique({ where: { id } }))?.status;
  }

  it.each([
    ['получатель денег', 'admin'],
    ['посторонний', 'outsider'],
  ] as const)('«Оплатил» за чужой долг (%s) статус не меняет', async (_label, who) => {
    const w = await world();
    const tx = await debt(w);

    await tg.receive(callback(asTg(w[who]), privateChat(asTg(w[who])), `budget:mark_paid:${tx.id}`));

    expect(await statusOf(tx.id)).toBe('PENDING');
  });

  it('должник отмечает свой долг оплаченным', async () => {
    const w = await world();
    const tx = await debt(w);

    await tg.receive(callback(asTg(w.member), privateChat(asTg(w.member)), `budget:mark_paid:${tx.id}`));

    expect(await statusOf(tx.id)).toBe('PAID');
  });

  it('подтвердить оплату может только получатель, не должник', async () => {
    const w = await world();
    const tx = await debt(w, 'PAID');

    await tg.receive(callback(asTg(w.member), privateChat(asTg(w.member)), `budget:confirm:${tx.id}`));
    expect(await statusOf(tx.id)).toBe('PAID');

    await tg.receive(callback(asTg(w.admin), privateChat(asTg(w.admin)), `budget:confirm:${tx.id}`));
    expect(await statusOf(tx.id)).toBe('CONFIRMED');
  });

  it('«все оплатили» действует только от получателя денег по этому голосованию', async () => {
    const w = await world();
    const tx = await debt(w);

    await tg.receive(callback(asTg(w.member), privateChat(asTg(w.member)), `budget:all_paid:${w.poll.id}`));
    expect(await statusOf(tx.id)).toBe('PENDING');

    await tg.receive(callback(asTg(w.admin), privateChat(asTg(w.admin)), `budget:all_paid:${w.poll.id}`));
    expect(await statusOf(tx.id)).toBe('CONFIRMED');
  });
});
