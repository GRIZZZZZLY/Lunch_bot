/**
 * События группы. Основные пути (бот вошёл или вышел, участники вошли или
 * вышли) на тестовой БД проверяет integration/bot/group-membership. Здесь —
 * защитные ветки, которые через настоящий бот не воспроизвести: обновление без
 * инициатора или названия, личный чат, сбои базы и Telegram.
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

describe('бота добавили в группу', () => {
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
    expect(groupService.ensureMemberRole).toHaveBeenCalledWith(100, 555, 'CREATOR');
  });

  it('падение при повышении инициатора не срывает остальную настройку', async () => {
    groupService.ensureMemberRole.mockRejectedValueOnce(new Error('deadlock'));
    const ctx = myChatMemberCtx();

    await fire('my_chat_member', ctx);

    expect(ctx.reply).toHaveBeenCalled();
  });

  it('ошибка сохранения группы не выбрасывается из обработчика', async () => {
    groupService.upsertGroup.mockRejectedValue(new Error('db down'));

    await expect(fire('my_chat_member', myChatMemberCtx())).resolves.toBeUndefined();
  });
});

describe('chat_member: участник вошёл или вышел', () => {
  it('изменившееся название группы обновляется', async () => {
    await fire('chat_member', chatMemberCtx({}));

    expect(groupService.updateGroup).toHaveBeenCalledWith(100, { title: 'Обед' });
  });

  it('без названия обновление не вызывается', async () => {
    await fire('chat_member', chatMemberCtx({ chat: { id: -1001, type: 'supergroup' } }));

    expect(groupService.updateGroup).not.toHaveBeenCalled();
  });

  it('неизвестного в БД участника удалять не пытаемся', async () => {
    userService.getUserByTelegramId.mockResolvedValue(null);

    await fire('chat_member', chatMemberCtx({ oldStatus: 'member', newStatus: 'left' }));

    expect(groupService.removeMemberFromGroup).not.toHaveBeenCalled();
  });

  it('событие из лички игнорируется', async () => {
    await fire('chat_member', chatMemberCtx({ chat: { id: 5, title: 'x', type: 'private' } }));

    expect(groupService.upsertGroup).not.toHaveBeenCalled();
  });

  it('ошибка внутри обработчика не выбрасывается наружу', async () => {
    groupService.addMemberToGroup.mockRejectedValue(new Error('fk violation'));

    await expect(fire('chat_member', chatMemberCtx({}))).resolves.toBeUndefined();
  });
});

describe('new_chat_members: резервный путь регистрации', () => {
  function newMembersCtx(
    members: Record<string, unknown>[] | undefined,
    chat: { id: number; title?: string; type: string } = GROUP
  ) {
    return { chat, message: { new_chat_members: members } };
  }

  it('пустой список не создаёт группу', async () => {
    await fire('message:new_chat_members', newMembersCtx([]));

    expect(groupService.upsertGroup).not.toHaveBeenCalled();
  });

  it('отсутствующее поле не ломает обработчик', async () => {
    await fire('message:new_chat_members', newMembersCtx(undefined));

    expect(groupService.upsertGroup).not.toHaveBeenCalled();
  });

  it('событие из лички игнорируется', async () => {
    await fire('message:new_chat_members', newMembersCtx([tgUser()], { id: 5, type: 'private' }));

    expect(groupService.upsertGroup).not.toHaveBeenCalled();
  });

  it('ошибка не выбрасывается наружу', async () => {
    userService.upsertUser.mockRejectedValue(new Error('db down'));

    await expect(
      fire('message:new_chat_members', newMembersCtx([tgUser()]))
    ).resolves.toBeUndefined();
  });
});

describe('setupMenuButtonForGroup', () => {
  it('отказ Telegram не пробрасывается наружу', async () => {
    fake.setChatMenuButton.mockRejectedValue(new Error('chat not found'));

    await expect(setupMenuButtonForGroup(fake.bot, -42)).resolves.toBeUndefined();
  });
});

describe('setupDefaultMenuButton', () => {
  it('ставит кнопку по умолчанию без chat_id', async () => {
    await setupDefaultMenuButton(fake.bot);

    const [params] = fake.setChatMenuButton.mock.calls[0];
    expect(params).not.toHaveProperty('chat_id');
    expect(params.menu_button.web_app).toEqual({ url: 'https://app.example.com' });
  });

  it.each([
    ['http-адрес: Telegram требует HTTPS', 'http://localhost:5173'],
    ['отсутствующий WEBAPP_URL', undefined],
  ])('%s — кнопка не ставится', async (_name, url) => {
    if (url === undefined) delete process.env.WEBAPP_URL;
    else process.env.WEBAPP_URL = url;

    await setupDefaultMenuButton(fake.bot);

    expect(fake.setChatMenuButton).not.toHaveBeenCalled();
  });

  it('отказ Telegram не пробрасывается наружу', async () => {
    fake.setChatMenuButton.mockRejectedValue(new Error('unauthorized'));

    await expect(setupDefaultMenuButton(fake.bot)).resolves.toBeUndefined();
  });
});
