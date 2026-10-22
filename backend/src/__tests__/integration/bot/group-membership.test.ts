/**
 * Состав групп глазами Telegram: бота добавили или выгнали, участник вошёл,
 * вышел, вернулся. Всё идёт через настоящего бота (`createBot`) и настоящую
 * PostgreSQL; подделан только Telegram (см. helpers/bot.ts).
 *
 * Почему это важно: членство в группе решает доступ ко всему — к меню,
 * голосованиям, долгам. Ошибка здесь либо пускает чужих, либо выкидывает
 * своих, либо понижает создателя группы до рядового участника.
 */
import { prisma } from '../../../database/client';
import { GroupService } from '../../../services/group.service';
import { cleanDatabase } from '../helpers/fixtures';
import {
  type FakeTelegram,
  type TgUser,
  BOT_INFO,
  TelegramRefusal,
  buttonsOf,
  chatMember,
  createFakeTelegram,
  groupChat,
  message,
  myChatMember,
  newChatMembers,
  privateChat,
  sentTo,
} from '../helpers/bot';

let tg: FakeTelegram;

const owner: TgUser = { id: 5101, first_name: 'Ольга', username: 'olga' };
const admin: TgUser = { id: 5102, first_name: 'Антон' };
const member: TgUser = { id: 5103, first_name: 'Маша' };
const helperBot: TgUser = { id: 5199, first_name: 'Другой бот', is_bot: true };

const CHAT = groupChat(-100510, 'Обеды на пятом');

async function groupRow(chatId = CHAT.id) {
  return prisma.group.findUnique({ where: { telegramId: BigInt(chatId) } });
}

async function membership(chatId: number, telegramUserId: number) {
  return prisma.groupMember.findFirst({
    where: {
      group: { telegramId: BigInt(chatId) },
      user: { telegramId: BigInt(telegramUserId) },
    },
  });
}

/** Администраторы чата, которых вернёт Telegram на getChatAdministrators. */
function adminsAre(list: Array<{ user: TgUser; status: 'creator' | 'administrator' }>) {
  tg.respond('getChatAdministrators', () =>
    list.map(({ user, status }) => ({ status, user: { is_bot: false, ...user } }))
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

describe('бота добавили в группу', () => {
  it('новая группа и тот, кто добавил, появляются в базе; добавивший — CREATOR', async () => {
    await tg.receive(myChatMember(CHAT, owner, 'left', 'member'));

    const group = await groupRow();
    expect(group).toMatchObject({ isActive: true, title: CHAT.title });
    expect(await membership(CHAT.id, owner.id)).toMatchObject({
      isActive: true,
      role: 'CREATOR',
    });
  });

  it('администраторы чата получают роли по статусу в Telegram, боты пропускаются', async () => {
    adminsAre([
      { user: admin, status: 'administrator' },
      { user: member, status: 'creator' },
      { user: helperBot, status: 'administrator' },
    ]);

    await tg.receive(myChatMember(CHAT, owner, 'left', 'administrator'));

    expect((await membership(CHAT.id, admin.id))?.role).toBe('ADMIN');
    expect((await membership(CHAT.id, member.id))?.role).toBe('CREATOR');
    expect(await prisma.user.count({ where: { telegramId: BigInt(helperBot.id) } })).toBe(0);
  });

  it('группе приходит приветствие с кнопкой «Я обедаю», без web_app (в группах он запрещён)', async () => {
    await tg.receive(myChatMember(CHAT, owner, 'kicked', 'member'));

    const [welcome] = sentTo(tg, CHAT.id);
    expect(welcome).toBeDefined();
    const buttons = buttonsOf(welcome);
    expect(buttons.some(b => b.callback_data === `optin_${CHAT.id}`)).toBe(true);
    expect(buttons.some(b => b.web_app)).toBe(false);
  });

  it('повторное добавление не понижает CREATOR, даже если Telegram числит его просто администратором', async () => {
    // Ольга создала группу в нашей базе, потом бота выгнали.
    await tg.receive(myChatMember(CHAT, owner, 'left', 'member'));
    await tg.receive(myChatMember(CHAT, owner, 'member', 'kicked'));
    expect((await groupRow())?.isActive).toBe(false);

    // Вернул бота уже Антон; Ольга в списке админов со статусом administrator.
    adminsAre([
      { user: owner, status: 'administrator' },
      { user: admin, status: 'administrator' },
    ]);
    await tg.receive(myChatMember(CHAT, admin, 'kicked', 'member'));

    expect((await groupRow())?.isActive).toBe(true);
    expect((await membership(CHAT.id, owner.id))?.role).toBe('CREATOR');
    expect((await membership(CHAT.id, admin.id))?.role).toBe('CREATOR');
  });

  it('рядового участника синхронизация админов повышает, но не наоборот', async () => {
    await tg.receive(myChatMember(CHAT, owner, 'left', 'member'));
    await tg.receive(chatMember(CHAT, admin, 'left', 'member'));
    expect((await membership(CHAT.id, admin.id))?.role).toBe('MEMBER');

    await tg.receive(myChatMember(CHAT, owner, 'member', 'left'));
    adminsAre([{ user: admin, status: 'administrator' }]);
    await tg.receive(myChatMember(CHAT, owner, 'left', 'member'));

    expect((await membership(CHAT.id, admin.id))?.role).toBe('ADMIN');
    expect((await membership(CHAT.id, owner.id))?.role).toBe('CREATOR');
  });

  it('отказ Telegram в списке админов не мешает зарегистрировать группу и поприветствовать её', async () => {
    tg.respond('getChatAdministrators', () => new TelegramRefusal(400, 'Bad Request: chat not found'));

    await tg.receive(myChatMember(CHAT, owner, 'left', 'member'));

    expect((await groupRow())?.isActive).toBe(true);
    expect((await membership(CHAT.id, owner.id))?.role).toBe('CREATOR');
    expect(sentTo(tg, CHAT.id)).toHaveLength(1);
  });

  it('повышение бота до администратора — не новое добавление: второго приветствия нет', async () => {
    await tg.receive(myChatMember(CHAT, owner, 'left', 'member'));
    tg.reset();

    await tg.receive(myChatMember(CHAT, owner, 'member', 'administrator'));

    expect(sentTo(tg, CHAT.id)).toHaveLength(0);
  });

  it('личный чат с ботом группой не становится', async () => {
    await tg.receive(myChatMember(privateChat(owner), owner, 'kicked', 'member'));

    expect(await prisma.group.count()).toBe(0);
  });
});

describe('бота убрали из группы', () => {
  it.each([
    ['вышел', 'member', 'left'],
    ['выгнали', 'administrator', 'kicked'],
  ] as const)('бот %s — группа деактивирована, но не удалена, состав сохранён', async (_label, from, to) => {
    await tg.receive(myChatMember(CHAT, owner, 'left', 'member'));
    await tg.receive(chatMember(CHAT, member, 'left', 'member'));

    await tg.receive(myChatMember(CHAT, owner, from, to));

    expect((await groupRow())?.isActive).toBe(false);
    expect((await membership(CHAT.id, member.id))?.isActive).toBe(true);
  });
});

describe('участник вошёл, вышел, вернулся (chat_member)', () => {
  beforeEach(async () => {
    await tg.receive(myChatMember(CHAT, owner, 'left', 'member'));
  });

  it.each(['member', 'administrator', 'creator', 'restricted'] as const)(
    'приглашённый (стал %s), ни разу не писавший, становится активным участником',
    async status => {
      await tg.receive(chatMember(CHAT, member, 'left', status, owner));

      expect(await membership(CHAT.id, member.id)).toMatchObject({
        isActive: true,
        role: 'MEMBER',
      });
    }
  );

  it.each([['left'], ['kicked']] as const)(
    'ушедший (%s) — мягкое удаление: строка остаётся с isActive=false и датой ухода',
    async status => {
      await tg.receive(chatMember(CHAT, member, 'left', 'member'));

      await tg.receive(chatMember(CHAT, member, 'member', status));

      const row = await membership(CHAT.id, member.id);
      expect(row?.isActive).toBe(false);
      expect(row?.leftAt).toBeInstanceOf(Date);
    }
  );

  it('вернувшийся снова активен, а не заведён второй строкой', async () => {
    await tg.receive(chatMember(CHAT, member, 'left', 'member'));
    await tg.receive(chatMember(CHAT, member, 'member', 'left'));

    await tg.receive(chatMember(CHAT, member, 'left', 'member'));

    const rows = await prisma.groupMember.findMany({
      where: { user: { telegramId: BigInt(member.id) } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isActive: true, leftAt: null });
  });

  it('смена прав внутри группы (member → administrator) состав не меняет', async () => {
    await tg.receive(chatMember(CHAT, member, 'left', 'member'));

    await tg.receive(chatMember(CHAT, member, 'member', 'administrator'));

    expect(await membership(CHAT.id, member.id)).toMatchObject({
      isActive: true,
      role: 'MEMBER',
    });
  });

  it('бот-участник в состав не записывается', async () => {
    await tg.receive(chatMember(CHAT, helperBot, 'left', 'member', owner));

    expect(await prisma.user.count({ where: { telegramId: BigInt(helperBot.id) } })).toBe(0);
  });

  it('резервный путь new_chat_members регистрирует всех людей из сообщения', async () => {
    await tg.receive(newChatMembers(CHAT, owner, [admin, member, helperBot]));

    expect((await membership(CHAT.id, admin.id))?.isActive).toBe(true);
    expect((await membership(CHAT.id, member.id))?.isActive).toBe(true);
    expect(await prisma.user.count({ where: { telegramId: BigInt(helperBot.id) } })).toBe(0);
  });
});

describe('любое сообщение в группе (authMiddleware)', () => {
  it('незнакомый человек, написавший в группе, заводится вместе с членством', async () => {
    await tg.receive(message(member, CHAT, 'всем привет'));

    expect(await prisma.user.findUnique({ where: { telegramId: BigInt(member.id) } })).not.toBeNull();
    expect(await membership(CHAT.id, member.id)).toMatchObject({
      isActive: true,
      role: 'MEMBER',
    });
  });

  it('сообщение уже записанного администратора его роль не трогает', async () => {
    adminsAre([{ user: admin, status: 'administrator' }]);
    await tg.receive(myChatMember(CHAT, owner, 'left', 'member'));

    await tg.receive(message(admin, CHAT, 'что на обед?'));
    await tg.receive(message(owner, CHAT, 'пицца'));

    expect((await membership(CHAT.id, admin.id))?.role).toBe('ADMIN');
    expect((await membership(CHAT.id, owner.id))?.role).toBe('CREATOR');
  });

  it('личная переписка с ботом не заводит группу', async () => {
    await tg.receive(message(member, privateChat(member), 'привет'));

    expect(await prisma.user.count({ where: { telegramId: BigInt(member.id) } })).toBe(1);
    expect(await prisma.group.count()).toBe(0);
  });
});

describe('сверка групп с Telegram (group-reconcile)', () => {
  /** Ответ Telegram на getChatMember(чат, бот) по каждому чату. */
  function botStatusIn(byChat: Record<number, string | TelegramRefusal>) {
    tg.respond('getChatMember', payload => {
      expect(payload.user_id).toBe(BOT_INFO.id);
      const answer = byChat[Number(payload.chat_id)];
      return answer instanceof TelegramRefusal
        ? answer
        : { status: answer, user: { id: BOT_INFO.id, is_bot: true, first_name: 'bot' } };
    });
  }

  async function makeGroup(chatId: number) {
    return prisma.group.create({ data: { telegramId: BigInt(chatId), title: `g${chatId}` } });
  }

  it('гасит только группы, откуда бота однозначно убрали; сбой Telegram группу не трогает', async () => {
    const left = await makeGroup(-1001);
    const kicked = await makeGroup(-1002);
    const forbidden = await makeGroup(-1003);
    const stillThere = await makeGroup(-1004);
    const flaky = await makeGroup(-1005);
    botStatusIn({
      [-1001]: 'left',
      [-1002]: 'kicked',
      [-1003]: new TelegramRefusal(403, 'Forbidden: bot was kicked from the supergroup chat'),
      [-1004]: 'administrator',
      [-1005]: new TelegramRefusal(502, 'Bad Gateway'),
    });

    const deactivated = await GroupService.reconcileActiveGroups();

    expect(deactivated.sort()).toEqual([left.id, kicked.id, forbidden.id].sort());
    const active = await prisma.group.findMany({ where: { isActive: true } });
    expect(active.map(g => g.id).sort()).toEqual([stillThere.id, flaky.id].sort());
  });

  /* Группа прод-смоука живёт с выдуманным чатом: Telegram отвечает «chat not
     found», и без исключения сверка гасила бы её при каждом запуске. */
  it('группа из GROUP_RECONCILE_SKIP_IDS не сверяется и остаётся активной; мусор в списке не мешает', async () => {
    const fixture = await makeGroup(-1007);
    const other = await makeGroup(-1008);
    botStatusIn({ [-1007]: 'left', [-1008]: 'left' });
    process.env.GROUP_RECONCILE_SKIP_IDS = ` ${fixture.id}, abc,`;
    try {
      await GroupService.reconcileActiveGroups();
    } finally {
      delete process.env.GROUP_RECONCILE_SKIP_IDS;
    }

    expect((await prisma.group.findUnique({ where: { id: fixture.id } }))?.isActive).toBe(true);
    expect((await prisma.group.findUnique({ where: { id: other.id } }))?.isActive).toBe(false);
  });
});
