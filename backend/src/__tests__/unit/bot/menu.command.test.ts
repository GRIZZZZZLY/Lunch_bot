/**
 * Команда /menu. Кнопки по роли, deep-link в группе и отказ в личке на
 * тестовой БД проверяет integration/bot/commands. Здесь — экранирование
 * названия блюда и ответ при сбое базы.
 */
import { menuCommand } from '../../../bot/commands/menu';
import { MenuService } from '../../../services/menu.service';
import { UserService } from '../../../services/user.service';
import { GroupService } from '../../../services/group.service';
import { asServiceMock } from '../../helpers/mocks';
import type { BotContext } from '../../../types/bot.types';

jest.mock('../../../services/menu.service', () => ({
  MenuService: { getMenuStats: jest.fn(), getPopularMenuItems: jest.fn() },
}));

jest.mock('../../../services/user.service', () => ({
  UserService: { getUserByTelegramId: jest.fn() },
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

function makeCtx() {
  return {
    from: { id: 555 },
    chat: { id: -1001, type: 'supergroup' },
    me: { username: 'rocket_lunch_bot' },
    session: {},
    reply: jest.fn().mockResolvedValue(undefined),
  } as unknown as BotContext & { reply: jest.Mock };
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  envBackup = { ...process.env };
  process.env.WEBAPP_URL = 'https://app.example.com';

  userService.getUserByTelegramId.mockResolvedValue({ id: 1, isAdmin: false });
  groupService.getGroupByTelegramId.mockResolvedValue({ id: 100 });
  menuService.getMenuStats.mockResolvedValue({ total: 12, active: 9, averagePrice: 350 });
  menuService.getPopularMenuItems.mockResolvedValue([]);
});

afterEach(() => {
  process.env = envBackup;
});

describe('/menu', () => {
  it('название популярного блюда экранируется', async () => {
    menuService.getPopularMenuItems.mockResolvedValue([
      { id: 1, name: 'Соус_острый *акция*', voteCount: 7 },
    ]);
    const ctx = makeCtx();

    await menuCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain('Соус\\_острый \\*акция\\*');
  });

  it('ошибка загрузки не оставляет без ответа', async () => {
    menuService.getMenuStats.mockRejectedValue(new Error('db down'));
    const ctx = makeCtx();

    await menuCommand(ctx);

    expect(ctx.reply).toHaveBeenCalled();
  });
});
