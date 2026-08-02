/**
 * События группы: как бот попадает в группу, как оттуда уходит и как в БД
 * появляются участники, которые ни разу не писали боту.
 *
 * Здесь важна не «одна ветка кода», а порядок: группа должна быть создана
 * ДО того, как в неё добавляют участника, иначе внешний ключ падает и человек
 * молча не попадает в состав. Плюс три независимых пути регистрации
 * (my_chat_member, chat_member, new_chat_members) — Telegram присылает не все,
 * и каждый должен работать в одиночку.
 */
import {
  setupGroupEvents,
  setupMenuButtonForGroup,
  setupDefaultMenuButton,
  mapChatMemberStatusToRole,
} from '../../../bot/events/group-events';
import { GroupService } from '../../../services/group.service';
import { UserService } from '../../../services/user.service';
import { asServiceMock } from '../../helpers/mocks';
import type { Bot } from 'grammy';
import type { BotContext } from '../../../types/bot.types';

jest.mock('../../../services/group.service', () => ({
  GroupService: {
    upsertGroup: jest.fn(),
    updateGroup: jest.fn(),
    getGroupByTelegramId: jest.fn(),
    deactivateGroup: jest.fn(),
    ensureMemberRole: jest.fn(),
    addMemberToGroup: jest.fn(),
    removeMemberFromGroup: jest.fn(),
  },
}));

jest.mock('../../../services/user.service', () => ({
  UserService: { upsertUser: jest.fn(), getUserByTelegramId: jest.fn() },
}));

jest.mock('../../../bot/keyboards/webapp.keyboard', () => ({
  createGroupWelcomeKeyboard: jest.fn(() => ({ inline_keyboard: [] })),
}));

jest.mock('../../../bot/handlers/group.handlers', () => ({
  WELCOME_GREETING: 'Привет, команда!',
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const groupService = asServiceMock(GroupService);
const userService = asServiceMock(UserService);
const { logger } = jest.requireMock('../../../utils/logger');

type Handler = (ctx: unknown) => Promise<void>;

interface FakeBot {
  bot: Bot<BotContext>;
  handlers: Map<string, Handler>;
  setChatMenuButton: jest.Mock;
}

function makeBot(): FakeBot {
  const handlers = new Map<string, Handler>();
  const setChatMenuButton = jest.fn().mockResolvedValue(true);
  const bot = {
    on: (event: string, handler: Handler) => {
      handlers.set(event, handler);
      return bot;
    },
    api: { setChatMenuButton },
  };
  return { bot: bot as unknown as Bot<BotContext>, handlers, setChatMenuButton };
}

const GROUP = { id: -1001, title: 'Обед', type: 'supergroup' as const };

function tgUser(over: Record<string, unknown> = {}) {
  return {
    id: 555,
    is_bot: false,
    username: 'ivan',
    first_name: 'Иван',
    last_name: 'Петров',
    ...over,
  };
}

interface MyChatMemberInit {
  oldStatus?: string;
  newStatus?: string;
  chat?: { id: number; title?: string; type: string };
  from?: Record<string, unknown> | undefined;
  admins?: unknown[];
}

function myChatMemberCtx(init: MyChatMemberInit = {}) {
  const getChatAdministrators = jest
    .fn()
    .mockResolvedValue(init.admins ?? [{ user: tgUser(), status: 'creator' }]);
  const reply = jest.fn().mockResolvedValue(undefined);
  return {
    chat: init.chat ?? GROUP,
    myChatMember: {
      old_chat_member: { status: init.oldStatus ?? 'left' },
      new_chat_member: { status: init.newStatus ?? 'member' },
      from: 'from' in init ? init.from : tgUser({ id: 777, username: 'boss' }),
    },
    api: { getChatAdministrators },
    reply,
  };
}

function chatMemberCtx(init: {
  oldStatus?: string;
  newStatus?: string;
  user?: Record<string, unknown>;
  chat?: { id: number; title?: string; type: string };
}) {
  return {
    chat: init.chat ?? GROUP,
    chatMember: {
      old_chat_member: { status: init.oldStatus ?? 'left' },
      new_chat_member: {
        status: init.newStatus ?? 'member',
        user: init.user ?? tgUser(),
      },
    },
  };
}

let envBackup: NodeJS.ProcessEnv;
let fake: FakeBot;

beforeEach(() => {
  jest.clearAllMocks();
  envBackup = { ...process.env };
  process.env.WEBAPP_URL = 'https://app.example.com';

  groupService.upsertGroup.mockResolvedValue({ id: 100 });
  groupService.getGroupByTelegramId.mockResolvedValue({ id: 100 });
  groupService.updateGroup.mockResolvedValue({ id: 100 });
  groupService.deactivateGroup.mockResolvedValue({ id: 100 });
  groupService.ensureMemberRole.mockResolvedValue(undefined);
  groupService.addMemberToGroup.mockResolvedValue(undefined);
  groupService.removeMemberFromGroup.mockResolvedValue(undefined);
  userService.upsertUser.mockImplementation(
    async (data: { telegramId: string }) => ({
      id: Number(data.telegramId),
    })
  );
  userService.getUserByTelegramId.mockResolvedValue({ id: 555 });

  fake = makeBot();
  setupGroupEvents(fake.bot);
});

afterEach(() => {
  process.env = envBackup;
});

function fire(event: string, ctx: unknown): Promise<void> {
  const handler = fake.handlers.get(event);
  if (!handler) throw new Error(`handler ${event} not registered`);
  return handler(ctx);
}

describe('mapChatMemberStatusToRole', () => {
  it.each([
    ['creator', 'CREATOR'],
    ['administrator', 'ADMIN'],
    ['member', 'MEMBER'],
    ['restricted', 'MEMBER'],
  ])('%s → %s', (status, role) => {
    expect(mapChatMemberStatusToRole(status)).toBe(role);
  });
});

describe('регистрация обработчиков', () => {
  it('подписывается на все три источника событий', () => {
    expect([...fake.handlers.keys()]).toEqual([
      'my_chat_member',
      'chat_member',
      'message:new_chat_members',
    ]);
  });
});

describe('бота добавили в группу', () => {
  it('группа сохраняется с названием и типом', async () => {
    await fire('my_chat_member', myChatMemberCtx());

    expect(groupService.upsertGroup).toHaveBeenCalledWith({
      telegramId: '-1001',
      title: 'Обед',
      type: 'supergroup',
    });
  });

  it('группа без названия сохраняется под заглушкой', async () => {
    await fire(
      'my_chat_member',
      myChatMemberCtx({ chat: { id: -1002, type: 'group' } })
    );

    expect(groupService.upsertGroup).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Unknown Group', type: 'group' })
    );
  });

  it('тот, кто добавил бота, становится CREATOR группы', async () => {
    await fire('my_chat_member', myChatMemberCtx());

    expect(groupService.ensureMemberRole).toHaveBeenCalledWith(
      100,
      777,
      'CREATOR'
    );
  });

  it('бот-инициатор в CREATOR не превращается', async () => {
    await fire(
      'my_chat_member',
      myChatMemberCtx({ from: tgUser({ id: 777, is_bot: true }), admins: [] })
    );

    expect(groupService.ensureMemberRole).not.toHaveBeenCalled();
  });

  it('без инициатора событие всё равно обрабатывается', async () => {
    await fire('my_chat_member', myChatMemberCtx({ from: undefined }));

    expect(groupService.upsertGroup).toHaveBeenCalled();
    expect(groupService.ensureMemberRole).toHaveBeenCalledWith(
      100,
      555,
      'CREATOR'
    );
  });

  it('падение при повышении инициатора не срывает остальную настройку', async () => {
    groupService.ensureMemberRole.mockRejectedValueOnce(new Error('deadlock'));

    await fire('my_chat_member', myChatMemberCtx());

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to promote bot adder',
      expect.objectContaining({ error: 'deadlock' })
    );
    expect(fake.setChatMenuButton).toHaveBeenCalled();
  });

  it('админы группы синхронизируются с их ролями', async () => {
    await fire(
      'my_chat_member',
      myChatMemberCtx({
        admins: [
          { user: tgUser({ id: 1 }), status: 'creator' },
          { user: tgUser({ id: 2 }), status: 'administrator' },
          { user: tgUser({ id: 3, is_bot: true }), status: 'administrator' },
        ],
      })
    );

    expect(groupService.ensureMemberRole).toHaveBeenCalledWith(
      100,
      1,
      'CREATOR'
    );
    expect(groupService.ensureMemberRole).toHaveBeenCalledWith(100, 2, 'ADMIN');
    expect(groupService.ensureMemberRole).not.toHaveBeenCalledWith(
      100,
      3,
      expect.anything()
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Synced group admins on bot join',
      expect.objectContaining({ syncedCount: 2, totalAdmins: 3 })
    );
  });

  it('отказ getChatAdministrators не мешает приветствию', async () => {
    const ctx = myChatMemberCtx();
    ctx.api.getChatAdministrators.mockRejectedValue(new Error('no rights'));

    await fire('my_chat_member', ctx);

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to sync group admins on bot join',
      expect.objectContaining({ error: 'no rights' })
    );
    expect(ctx.reply).toHaveBeenCalled();
  });

  it('menu button настраивается на конкретную группу', async () => {
    await fire('my_chat_member', myChatMemberCtx());

    expect(fake.setChatMenuButton).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_id: -1001,
        menu_button: expect.objectContaining({
          web_app: { url: 'https://app.example.com?groupId=-1001' },
        }),
      })
    );
  });

  it('приветствие уходит с групповой клавиатурой', async () => {
    const {
      createGroupWelcomeKeyboard,
    } = jest.requireMock('../../../bot/keyboards/webapp.keyboard');
    const ctx = myChatMemberCtx();

    await fire('my_chat_member', ctx);

    expect(createGroupWelcomeKeyboard).toHaveBeenCalledWith(-1001);
    expect(ctx.reply).toHaveBeenCalledWith('Привет, команда!', {
      reply_markup: { inline_keyboard: [] },
    });
  });

  it('добавление сразу в администраторы тоже считается добавлением', async () => {
    await fire(
      'my_chat_member',
      myChatMemberCtx({ oldStatus: 'kicked', newStatus: 'administrator' })
    );

    expect(groupService.upsertGroup).toHaveBeenCalled();
  });

  it('в личном чате группа не создаётся', async () => {
    const ctx = myChatMemberCtx({ chat: { id: 555, type: 'private' } });

    await fire('my_chat_member', ctx);

    expect(groupService.upsertGroup).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('повышение бота до админа не считается новым добавлением', async () => {
    await fire(
      'my_chat_member',
      myChatMemberCtx({ oldStatus: 'member', newStatus: 'administrator' })
    );

    expect(groupService.upsertGroup).not.toHaveBeenCalled();
    expect(groupService.deactivateGroup).not.toHaveBeenCalled();
  });

  it('ошибка сохранения группы только логируется', async () => {
    groupService.upsertGroup.mockRejectedValue(new Error('db down'));

    await expect(fire('my_chat_member', myChatMemberCtx())).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Error handling my_chat_member event:',
      expect.any(Error)
    );
  });
});

describe('бота удалили из группы', () => {
  it('группа деактивируется, а не удаляется', async () => {
    await fire(
      'my_chat_member',
      myChatMemberCtx({ oldStatus: 'member', newStatus: 'left' })
    );

    expect(groupService.deactivateGroup).toHaveBeenCalledWith(100);
  });

  it('бан бота равносилен удалению', async () => {
    await fire(
      'my_chat_member',
      myChatMemberCtx({ oldStatus: 'administrator', newStatus: 'kicked' })
    );

    expect(groupService.deactivateGroup).toHaveBeenCalledWith(100);
  });

  it('незнакомая группа не вызывает деактивации', async () => {
    groupService.getGroupByTelegramId.mockResolvedValue(null);

    await fire(
      'my_chat_member',
      myChatMemberCtx({ oldStatus: 'member', newStatus: 'left' })
    );

    expect(groupService.deactivateGroup).not.toHaveBeenCalled();
  });
});

describe('chat_member: участник вошёл или вышел', () => {
  it('вошедший участник создаётся и добавляется в группу', async () => {
    await fire('chat_member', chatMemberCtx({ newStatus: 'member' }));

    expect(userService.upsertUser).toHaveBeenCalledWith({
      telegramId: '555',
      username: 'ivan',
      firstName: 'Иван',
      lastName: 'Петров',
    });
    expect(groupService.addMemberToGroup).toHaveBeenCalledWith(100, 555);
  });

  it('группа гарантируется до добавления участника', async () => {
    const order: string[] = [];
    groupService.upsertGroup.mockImplementation(async () => {
      order.push('group');
      return { id: 100 };
    });
    groupService.addMemberToGroup.mockImplementation(async () => {
      order.push('member');
    });

    await fire('chat_member', chatMemberCtx({}));

    expect(order).toEqual(['group', 'member']);
  });

  it('изменившееся название группы обновляется', async () => {
    await fire('chat_member', chatMemberCtx({}));

    expect(groupService.updateGroup).toHaveBeenCalledWith(100, {
      title: 'Обед',
    });
  });

  it('без названия обновление не вызывается', async () => {
    await fire(
      'chat_member',
      chatMemberCtx({ chat: { id: -1001, type: 'supergroup' } })
    );

    expect(groupService.updateGroup).not.toHaveBeenCalled();
  });

  it.each(['member', 'administrator', 'creator', 'restricted'])(
    'left → %s считается входом',
    async newStatus => {
      await fire('chat_member', chatMemberCtx({ oldStatus: 'left', newStatus }));

      expect(groupService.addMemberToGroup).toHaveBeenCalled();
    }
  );

  it('вышедший участник удаляется из состава', async () => {
    await fire(
      'chat_member',
      chatMemberCtx({ oldStatus: 'member', newStatus: 'left' })
    );

    expect(userService.getUserByTelegramId).toHaveBeenCalledWith(BigInt(555));
    expect(groupService.removeMemberFromGroup).toHaveBeenCalledWith(100, 555);
  });

  it('изгнанный участник тоже удаляется', async () => {
    await fire(
      'chat_member',
      chatMemberCtx({ oldStatus: 'administrator', newStatus: 'kicked' })
    );

    expect(groupService.removeMemberFromGroup).toHaveBeenCalled();
  });

  it('неизвестного в БД участника удалять не пытаемся', async () => {
    userService.getUserByTelegramId.mockResolvedValue(null);

    await fire(
      'chat_member',
      chatMemberCtx({ oldStatus: 'member', newStatus: 'left' })
    );

    expect(groupService.removeMemberFromGroup).not.toHaveBeenCalled();
  });

  it('смена роли внутри группы состав не меняет', async () => {
    await fire(
      'chat_member',
      chatMemberCtx({ oldStatus: 'member', newStatus: 'administrator' })
    );

    expect(groupService.addMemberToGroup).not.toHaveBeenCalled();
    expect(groupService.removeMemberFromGroup).not.toHaveBeenCalled();
  });

  it('бота в состав не записываем', async () => {
    await fire('chat_member', chatMemberCtx({ user: tgUser({ is_bot: true }) }));

    expect(groupService.upsertGroup).not.toHaveBeenCalled();
  });

  it('событие из лички игнорируется', async () => {
    await fire(
      'chat_member',
      chatMemberCtx({ chat: { id: 5, title: 'x', type: 'private' } })
    );

    expect(groupService.upsertGroup).not.toHaveBeenCalled();
  });

  it('ошибка внутри обработчика только логируется', async () => {
    groupService.addMemberToGroup.mockRejectedValue(new Error('fk violation'));

    await expect(
      fire('chat_member', chatMemberCtx({}))
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Error handling chat_member event:',
      expect.any(Error)
    );
  });
});

describe('new_chat_members: резервный путь регистрации', () => {
  function newMembersCtx(
    members: Record<string, unknown>[] | undefined,
    chat: { id: number; title?: string; type: string } = GROUP
  ) {
    return { chat, message: { new_chat_members: members } };
  }

  it('все приглашённые попадают в состав группы', async () => {
    await fire(
      'message:new_chat_members',
      newMembersCtx([tgUser({ id: 1 }), tgUser({ id: 2 })])
    );

    expect(groupService.addMemberToGroup).toHaveBeenCalledWith(100, 1);
    expect(groupService.addMemberToGroup).toHaveBeenCalledWith(100, 2);
  });

  it('добавленные боты пропускаются', async () => {
    await fire(
      'message:new_chat_members',
      newMembersCtx([tgUser({ id: 1, is_bot: true }), tgUser({ id: 2 })])
    );

    expect(groupService.addMemberToGroup).toHaveBeenCalledTimes(1);
    expect(groupService.addMemberToGroup).toHaveBeenCalledWith(100, 2);
  });

  it('пустой список не создаёт группу', async () => {
    await fire('message:new_chat_members', newMembersCtx([]));

    expect(groupService.upsertGroup).not.toHaveBeenCalled();
  });

  it('отсутствующее поле не ломает обработчик', async () => {
    await fire('message:new_chat_members', newMembersCtx(undefined));

    expect(groupService.upsertGroup).not.toHaveBeenCalled();
  });

  it('группа без названия получает заглушку', async () => {
    await fire(
      'message:new_chat_members',
      newMembersCtx([tgUser()], { id: -1003, type: 'group' })
    );

    expect(groupService.upsertGroup).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Unknown Group' })
    );
  });

  it('событие из лички игнорируется', async () => {
    await fire(
      'message:new_chat_members',
      newMembersCtx([tgUser()], { id: 5, type: 'private' })
    );

    expect(groupService.upsertGroup).not.toHaveBeenCalled();
  });

  it('ошибка только логируется', async () => {
    userService.upsertUser.mockRejectedValue(new Error('db down'));

    await expect(
      fire('message:new_chat_members', newMembersCtx([tgUser()]))
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Error handling new_chat_members:',
      expect.any(Error)
    );
  });
});

describe('setupMenuButtonForGroup', () => {
  it('без WEBAPP_URL используется localhost', async () => {
    delete process.env.WEBAPP_URL;

    await setupMenuButtonForGroup(fake.bot, -42);

    expect(fake.setChatMenuButton).toHaveBeenCalledWith(
      expect.objectContaining({
        menu_button: expect.objectContaining({
          web_app: { url: 'http://localhost:5173?groupId=-42' },
        }),
      })
    );
  });

  it('отказ Telegram не пробрасывается наружу', async () => {
    fake.setChatMenuButton.mockRejectedValue(new Error('chat not found'));

    await expect(
      setupMenuButtonForGroup(fake.bot, -42)
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Error setting menu button for group:',
      expect.any(Error)
    );
  });
});

describe('setupDefaultMenuButton', () => {
  it('ставит кнопку по умолчанию без chat_id', async () => {
    await setupDefaultMenuButton(fake.bot);

    expect(fake.setChatMenuButton).toHaveBeenCalledWith({
      menu_button: {
        type: 'web_app',
        text: '🍽 Обед',
        web_app: { url: 'https://app.example.com' },
      },
    });
  });

  it('http-адрес отклоняется: Telegram требует HTTPS', async () => {
    process.env.WEBAPP_URL = 'http://localhost:5173';

    await setupDefaultMenuButton(fake.bot);

    expect(fake.setChatMenuButton).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('HTTPS'),
      expect.objectContaining({ webappUrl: 'http://localhost:5173' })
    );
  });

  it('отсутствующий WEBAPP_URL тоже отклоняется', async () => {
    delete process.env.WEBAPP_URL;

    await setupDefaultMenuButton(fake.bot);

    expect(fake.setChatMenuButton).not.toHaveBeenCalled();
  });

  it('отказ Telegram не пробрасывается наружу', async () => {
    fake.setChatMenuButton.mockRejectedValue(new Error('unauthorized'));

    await expect(setupDefaultMenuButton(fake.bot)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Error setting default menu button:',
      expect.any(Error)
    );
  });
});
