/**
 * Команда /menu и её callback-обработчики. Меню привязано к ГРУППЕ, поэтому
 * в личке данных нет — вместо пустого списка человек должен получить
 * объяснение. И в группах вместо web_app-кнопки идёт deep-link: web_app в
 * группах не работает.
 */
import {
  menuCommand,
  handleQuickAddItem,
  handleShowMenuList,
} from '../../../bot/commands/menu';
import { MenuService } from '../../../services/menu.service';
import { UserService } from '../../../services/user.service';
import { GroupService } from '../../../services/group.service';
import { asServiceMock } from '../../helpers/mocks';
import type { BotContext } from '../../../types/bot.types';

jest.mock('../../../services/menu.service', () => ({
  MenuService: {
    getMenuStats: jest.fn(),
    getPopularMenuItems: jest.fn(),
    getActiveMenuItems: jest.fn(),
  },
}));

jest.mock('../../../services/user.service', () => ({
  UserService: { getUserByTelegramId: jest.fn(), isAdmin: jest.fn() },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { getGroupByTelegramId: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const menuService = asServiceMock(MenuService);
const userService = asServiceMock(UserService);
const groupService = asServiceMock(GroupService);

interface CtxInit {
  from?: { id: number };
  chat?: { id: number; type: string };
  session?: Record<string, unknown>;
}

function makeCtx(init: CtxInit = {}) {
  const reply = jest.fn().mockResolvedValue(undefined);
  const answerCallbackQuery = jest.fn().mockResolvedValue(undefined);
  return {
    from: 'from' in init ? init.from : { id: 555 },
    chat: 'chat' in init ? init.chat : { id: -1001, type: 'supergroup' },
    me: { username: 'rocket_lunch_bot' },
    session: init.session ?? {},
    reply,
    answerCallbackQuery,
  } as unknown as BotContext & {
    reply: jest.Mock;
    answerCallbackQuery: jest.Mock;
    session: Record<string, unknown>;
  };
}

function lastOptions(ctx: { reply: jest.Mock }): Record<string, unknown> {
  const call = ctx.reply.mock.calls[ctx.reply.mock.calls.length - 1];
  return (call?.[1] ?? {}) as Record<string, unknown>;
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  envBackup = { ...process.env };
  process.env.WEBAPP_URL = 'https://app.example.com';

  userService.getUserByTelegramId.mockResolvedValue({ id: 1, isAdmin: false });
  userService.isAdmin.mockResolvedValue(true);
  groupService.getGroupByTelegramId.mockResolvedValue({ id: 100 });
  menuService.getMenuStats.mockResolvedValue({
    total: 12,
    active: 9,
    averagePrice: 350,
  });
  menuService.getPopularMenuItems.mockResolvedValue([
    { id: 1, name: 'Плов', voteCount: 7 },
  ]);
  menuService.getActiveMenuItems.mockResolvedValue([
    { id: 1, name: 'Плов', price: 250, description: 'вкусно' },
  ]);
});

afterEach(() => {
  process.env = envBackup;
});

describe('/menu', () => {
  it('в группе показывает статистику и популярные блюда', async () => {
    const ctx = makeCtx();

    await menuCommand(ctx);

    const text = ctx.reply.mock.calls[0][0] as string;
    expect(text).toContain('Всего блюд: 12');
    expect(text).toContain('Активных: 9');
    expect(text).toContain('Средняя цена: 350₽');
    expect(text).toContain('1. Плов (7 голосов)');
  });

  it('название популярного блюда экранируется', async () => {
    menuService.getPopularMenuItems.mockResolvedValue([
      { id: 1, name: 'Соус_острый *акция*', voteCount: 7 },
    ]);
    const ctx = makeCtx();

    await menuCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain(
      '1. Соус\\_острый \\*акция\\* (7 голосов)'
    );
  });

  it('нулевая средняя цена не показывается', async () => {
    menuService.getMenuStats.mockResolvedValue({
      total: 2,
      active: 2,
      averagePrice: 0,
    });
    const ctx = makeCtx();

    await menuCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).not.toContain('Средняя цена');
  });

  it('без популярных блюд блок не выводится', async () => {
    menuService.getPopularMenuItems.mockResolvedValue([]);
    const ctx = makeCtx();

    await menuCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).not.toContain('Популярные блюда');
  });

  it('в группе кнопка — deep-link, а не web_app', async () => {
    const ctx = makeCtx();

    await menuCommand(ctx);

    const markup = JSON.stringify(lastOptions(ctx));
    expect(markup).toContain('t.me/rocket_lunch_bot?start=menu_-1001');
    expect(markup).not.toContain('web_app');
  });

  it('админу добавляются кнопки управления', async () => {
    userService.getUserByTelegramId.mockResolvedValue({ id: 1, isAdmin: true });
    const ctx = makeCtx();

    await menuCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain('Права администратора');
    expect(JSON.stringify(lastOptions(ctx))).toContain('quick_add_item');
  });

  it('обычному участнику про права сказано прямо', async () => {
    const ctx = makeCtx();

    await menuCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain(
      'Для редактирования требуются права администратора'
    );
    expect(JSON.stringify(lastOptions(ctx))).not.toContain('quick_add_item');
  });

  it('в личке объясняет, что меню живёт в группе', async () => {
    const ctx = makeCtx({ chat: { id: 555, type: 'private' } });

    await menuCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('привязано к группе')
    );
    expect(menuService.getMenuStats).not.toHaveBeenCalled();
  });

  it('незарегистрированная группа получает инструкцию', async () => {
    groupService.getGroupByTelegramId.mockResolvedValue(null);
    const ctx = makeCtx();

    await menuCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('/startpoll')
    );
  });

  it('незарегистрированному пользователю предлагают /start', async () => {
    userService.getUserByTelegramId.mockResolvedValue(null);
    const ctx = makeCtx();

    await menuCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Отправь /start')
    );
  });

  it('без пользователя просит перезапуск', async () => {
    const ctx = makeCtx({ from: undefined });

    await menuCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/start'));
  });

  it('ошибка загрузки не оставляет без ответа', async () => {
    menuService.getMenuStats.mockRejectedValue(new Error('db down'));
    const ctx = makeCtx();

    await menuCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('ошибка при загрузке меню')
    );
  });

  it('отсутствующий WEBAPP_URL логируется', async () => {
    const { logger } = jest.requireMock('../../../utils/logger');
    delete process.env.WEBAPP_URL;
    const ctx = makeCtx();

    await menuCommand(ctx);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('WEBAPP_URL is not set')
    );
  });
});

describe('быстрое добавление блюда', () => {
  it('админ переводится в режим ввода названия', async () => {
    const ctx = makeCtx();

    await handleQuickAddItem(ctx);

    expect(ctx.session).toMatchObject({
      step: 'waiting_menu_item_name',
      tempData: {},
    });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Быстрое добавление блюда'),
      expect.any(Object)
    );
  });

  it('не админу отказывают в ответе на нажатие', async () => {
    userService.isAdmin.mockResolvedValue(false);
    const ctx = makeCtx();

    await handleQuickAddItem(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('только администраторам')
    );
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('без пользователя обработчик молчит', async () => {
    const ctx = makeCtx({ from: undefined });

    await handleQuickAddItem(ctx);

    expect(ctx.reply).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).not.toHaveBeenCalled();
  });

  it('ошибка проверки прав отвечает на нажатие сообщением об ошибке', async () => {
    userService.isAdmin.mockRejectedValue(new Error('db down'));
    const ctx = makeCtx();

    await handleQuickAddItem(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('ошибка')
    );
  });
});

describe('показ списка блюд', () => {
  it('в группе выводит активные блюда с ценой и описанием', async () => {
    const ctx = makeCtx();

    await handleShowMenuList(ctx);

    const text = ctx.reply.mock.calls[0][0] as string;
    expect(text).toContain('1. Плов - 250₽');
    expect(text).toContain('_вкусно_');
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  /**
   * Названия и описания блюд пишут сами участники. Описание особенно опасно:
   * оно подставляется ВНУТРЬ `_..._`, и `_` в тексте закрывает курсив раньше
   * времени — Telegram отвечает `can't parse entities`, и список не выводится.
   */
  it('название и описание блюда экранируются', async () => {
    menuService.getActiveMenuItems.mockResolvedValue([
      { id: 1, name: 'Соус_острый', price: 250, description: 'с *перцем*' },
    ]);
    const ctx = makeCtx();

    await handleShowMenuList(ctx);

    const text = ctx.reply.mock.calls[0][0] as string;
    expect(text).toContain('1. Соус\\_острый - 250₽');
    expect(text).toContain('_с \\*перцем\\*_');
  });

  it('в группе web_app-кнопки в списке нет', async () => {
    const ctx = makeCtx();

    await handleShowMenuList(ctx);

    expect(JSON.stringify(lastOptions(ctx))).not.toContain('web_app');
  });

  it('пустое меню — отдельный текст', async () => {
    menuService.getActiveMenuItems.mockResolvedValue([]);
    const ctx = makeCtx();

    await handleShowMenuList(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Меню пусто'),
      expect.any(Object)
    );
  });

  it('в личке объясняет привязку к группе', async () => {
    const ctx = makeCtx({ chat: { id: 555, type: 'private' } });

    await handleShowMenuList(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Открой Mini App из своей группы')
    );
    expect(menuService.getActiveMenuItems).not.toHaveBeenCalled();
  });

  it('незарегистрированная группа получает инструкцию', async () => {
    groupService.getGroupByTelegramId.mockResolvedValue(null);
    const ctx = makeCtx();

    await handleShowMenuList(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Запусти /startpoll')
    );
  });

  it('ошибка загрузки отвечает на нажатие', async () => {
    menuService.getActiveMenuItems.mockRejectedValue(new Error('db down'));
    const ctx = makeCtx();

    await handleShowMenuList(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('Ошибка загрузки списка')
    );
  });
});
