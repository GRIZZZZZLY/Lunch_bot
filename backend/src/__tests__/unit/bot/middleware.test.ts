/**
 * Middleware бота. Здесь решается, дойдёт ли команда до обработчика, и каждая
 * ошибка видна пользователю сразу: либо бот молчит, либо пропускает того, кого
 * пускать не должен.
 *
 * Ключевые свойства: сбой аутентификации НЕ должен глушить бота (next вызывается
 * всё равно), а отказ в правах — наоборот, обязан остановить цепочку.
 */
import {
  authMiddleware,
  adminMiddleware,
  groupAdminMiddleware,
  groupOnlyMiddleware,
  privateOnlyMiddleware,
  activeUserMiddleware,
  registeredUserMiddleware,
} from '../../../bot/middleware/auth';
import {
  loggingMiddleware,
  statsMiddleware,
  errorLoggingMiddleware,
  rateLimitMiddleware,
  commandLoggingMiddleware,
} from '../../../bot/middleware/logger';
import { UserService } from '../../../services/user.service';
import { GroupService } from '../../../services/group.service';
import { asServiceMock } from '../../helpers/mocks';
import type { BotContext } from '../../../types/bot.types';

jest.mock('../../../services/user.service', () => ({
  UserService: {
    upsertUser: jest.fn(),
    isAdmin: jest.fn(),
    getUserByTelegramId: jest.fn(),
  },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { upsertGroup: jest.fn(), addMemberToGroup: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const userService = asServiceMock(UserService);
const groupService = asServiceMock(GroupService);

const DB_USER = { id: 1, telegramId: BigInt(555), isActive: true };

interface CtxInit {
  from?: { id: number; username?: string; first_name?: string; last_name?: string };
  chat?: { id: number; type: string; title?: string };
  message?: { message_id: number; text?: string };
  callbackQuery?: unknown;
  getChatMember?: jest.Mock;
}

/**
 * Минимальный контекст grammy: только то, что читают middleware.
 *
 * `from: undefined` передаётся осознанно (обновление без пользователя),
 * поэтому проверяем НАЛИЧИЕ ключа, а не его значение: с `??` заглушка молча
 * подставляла бы пользователя обратно и тест проверял бы не тот случай.
 */
function makeCtx(init: CtxInit = {}) {
  const reply = jest.fn().mockResolvedValue(undefined);
  const ctx = {
    from: 'from' in init ? init.from : { id: 555, first_name: 'Игорь', username: 'igor' },
    chat: 'chat' in init ? init.chat : { id: 555, type: 'private' },
    message: init.message,
    callbackQuery: init.callbackQuery,
    update: { update_id: 1 },
    reply,
    api: {
      getChatMember:
        init.getChatMember ??
        jest.fn().mockResolvedValue({ status: 'administrator' }),
    },
  } as unknown as BotContext & { reply: jest.Mock };
  return ctx;
}

beforeEach(() => {
  jest.clearAllMocks();
  userService.upsertUser.mockResolvedValue(DB_USER);
  userService.isAdmin.mockResolvedValue(true);
  userService.getUserByTelegramId.mockResolvedValue(DB_USER);
  groupService.upsertGroup.mockResolvedValue({
    id: 100,
    telegramId: BigInt(-1001),
  });
  groupService.addMemberToGroup.mockResolvedValue(undefined);
});

describe('authMiddleware', () => {
  it('создаёт пользователя и кладёт его в контекст', async () => {
    const ctx = makeCtx();
    const next = jest.fn();

    await authMiddleware(ctx, next);

    expect(userService.upsertUser).toHaveBeenCalledWith({
      telegramId: '555',
      username: 'igor',
      firstName: 'Игорь',
      lastName: undefined,
    });
    expect(ctx.dbUser).toBe(DB_USER);
    expect(next).toHaveBeenCalled();
  });

  it('в групповом чате заводит группу и добавляет участника', async () => {
    const ctx = makeCtx({
      chat: { id: -1001, type: 'supergroup', title: 'Команда' },
    });

    await authMiddleware(ctx, jest.fn());

    expect(groupService.upsertGroup).toHaveBeenCalledWith({
      telegramId: '-1001',
      title: 'Команда',
      type: 'supergroup',
    });
    expect(groupService.addMemberToGroup).toHaveBeenCalledWith(100, 1);
  });

  it('группа без названия получает заглушку', async () => {
    const ctx = makeCtx({ chat: { id: -1001, type: 'group' } });

    await authMiddleware(ctx, jest.fn());

    expect(groupService.upsertGroup).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Unknown Group' })
    );
  });

  it('в личке группа не создаётся', async () => {
    await authMiddleware(makeCtx(), jest.fn());

    expect(groupService.upsertGroup).not.toHaveBeenCalled();
  });

  it('обновление без пользователя пропускается дальше', async () => {
    const ctx = makeCtx({ from: undefined });
    const next = jest.fn();

    await authMiddleware(ctx, next);

    expect(userService.upsertUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('падение базы не глушит бота — обработка продолжается', async () => {
    userService.upsertUser.mockRejectedValue(new Error('db down'));
    const next = jest.fn();

    await authMiddleware(makeCtx(), next);

    expect(next).toHaveBeenCalled();
  });
});

describe('adminMiddleware', () => {
  it('админа пропускает', async () => {
    const next = jest.fn();

    await adminMiddleware()(makeCtx(), next);

    expect(next).toHaveBeenCalled();
  });

  it('не админа останавливает с подсказкой', async () => {
    userService.isAdmin.mockResolvedValue(false);
    const ctx = makeCtx();
    const next = jest.fn();

    await adminMiddleware()(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Недостаточно прав'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
  });

  it('без пользователя просит перезапустить бота', async () => {
    const ctx = makeCtx({ from: undefined });
    const next = jest.fn();

    await adminMiddleware()(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('/start')
    );
  });

  it('ошибка проверки прав не пропускает дальше', async () => {
    userService.isAdmin.mockRejectedValue(new Error('db down'));
    const ctx = makeCtx();
    const next = jest.fn();

    await adminMiddleware()(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Ошибка проверки прав')
    );
  });
});

describe('groupAdminMiddleware', () => {
  it.each(['administrator', 'creator'])('%s в группе проходит', async status => {
    const ctx = makeCtx({
      chat: { id: -1001, type: 'supergroup' },
      getChatMember: jest.fn().mockResolvedValue({ status }),
    });
    const next = jest.fn();

    await groupAdminMiddleware()(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it('обычного участника группы останавливает', async () => {
    const ctx = makeCtx({
      chat: { id: -1001, type: 'supergroup' },
      getChatMember: jest.fn().mockResolvedValue({ status: 'member' }),
    });
    const next = jest.fn();

    await groupAdminMiddleware()(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Недостаточно прав в группе'),
      expect.any(Object)
    );
  });

  it('в личке проверка не применяется', async () => {
    const ctx = makeCtx();
    const next = jest.fn();

    await groupAdminMiddleware()(ctx, next);

    expect(ctx.api.getChatMember).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('без контекста чата останавливает', async () => {
    const ctx = makeCtx({ from: undefined });
    const next = jest.fn();

    await groupAdminMiddleware()(ctx, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('падение Telegram API не пропускает дальше', async () => {
    const ctx = makeCtx({
      chat: { id: -1001, type: 'supergroup' },
      getChatMember: jest.fn().mockRejectedValue(new Error('api down')),
    });
    const next = jest.fn();

    await groupAdminMiddleware()(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Ошибка проверки прав в группе')
    );
  });
});

describe('ограничения по типу чата', () => {
  it('groupOnly: в личке отвечает инструкцией', async () => {
    const ctx = makeCtx();
    const next = jest.fn();

    await groupOnlyMiddleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Только для групп'),
      expect.any(Object)
    );
  });

  it('groupOnly: в группе пропускает', async () => {
    const next = jest.fn();

    await groupOnlyMiddleware(
      makeCtx({ chat: { id: -1001, type: 'supergroup' } }),
      next
    );

    expect(next).toHaveBeenCalled();
  });

  it('privateOnly: в группе отвечает отказом', async () => {
    const ctx = makeCtx({ chat: { id: -1001, type: 'supergroup' } });
    const next = jest.fn();

    await privateOnlyMiddleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('только для личных сообщений'),
      expect.any(Object)
    );
  });

  it('privateOnly: в личке пропускает', async () => {
    const next = jest.fn();

    await privateOnlyMiddleware(makeCtx(), next);

    expect(next).toHaveBeenCalled();
  });
});

describe('activeUserMiddleware', () => {
  it('активного пропускает', async () => {
    const next = jest.fn();

    await activeUserMiddleware(makeCtx(), next);

    expect(next).toHaveBeenCalled();
  });

  it('деактивированного останавливает', async () => {
    userService.getUserByTelegramId.mockResolvedValue({
      ...DB_USER,
      isActive: false,
    });
    const ctx = makeCtx();
    const next = jest.fn();

    await activeUserMiddleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Аккаунт деактивирован'),
      expect.any(Object)
    );
  });

  it('незнакомого пользователя тоже останавливает', async () => {
    userService.getUserByTelegramId.mockResolvedValue(null);
    const next = jest.fn();

    await activeUserMiddleware(makeCtx(), next);

    expect(next).not.toHaveBeenCalled();
  });

  it('обновление без пользователя пропускается', async () => {
    const next = jest.fn();

    await activeUserMiddleware(makeCtx({ from: undefined }), next);

    expect(next).toHaveBeenCalled();
  });

  it('ошибка базы не блокирует бота', async () => {
    userService.getUserByTelegramId.mockRejectedValue(new Error('db down'));
    const next = jest.fn();

    await activeUserMiddleware(makeCtx(), next);

    expect(next).toHaveBeenCalled();
  });
});

describe('registeredUserMiddleware', () => {
  it('зарегистрированного пропускает', async () => {
    const next = jest.fn();

    await registeredUserMiddleware(makeCtx(), next);

    expect(next).toHaveBeenCalled();
  });

  it('незарегистрированному предлагает /start', async () => {
    userService.getUserByTelegramId.mockResolvedValue(null);
    const ctx = makeCtx();
    const next = jest.fn();

    await registeredUserMiddleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Нужна регистрация'),
      expect.any(Object)
    );
  });

  it('без пользователя просит перезапуск', async () => {
    const ctx = makeCtx({ from: undefined });
    const next = jest.fn();

    await registeredUserMiddleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/start'));
  });

  it('ошибка базы не пропускает дальше', async () => {
    userService.getUserByTelegramId.mockRejectedValue(new Error('db down'));
    const ctx = makeCtx();
    const next = jest.fn();

    await registeredUserMiddleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Ошибка проверки регистрации')
    );
  });
});

describe('loggingMiddleware', () => {
  it('логирует приход и завершение обновления', async () => {
    const { logger } = jest.requireMock('../../../utils/logger');
    const next = jest.fn();

    await loggingMiddleware(makeCtx({ message: { message_id: 9 } }), next);

    expect(logger.info).toHaveBeenCalledWith(
      'Incoming update',
      expect.objectContaining({ type: 'message', messageId: 9 })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Update processed',
      expect.objectContaining({ duration: expect.any(String) })
    );
  });

  it('ошибка обработчика логируется и пробрасывается', async () => {
    const { logger } = jest.requireMock('../../../utils/logger');
    const next = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(loggingMiddleware(makeCtx(), next)).rejects.toThrow('boom');
    expect(logger.error).toHaveBeenCalledWith(
      'Error processing update',
      expect.objectContaining({ error: 'boom' })
    );
  });

  it.each([
    ['callback_query', { callbackQuery: {} }],
    ['message', { message: { message_id: 1 } }],
  ])('тип обновления %s распознаётся', async (type, init) => {
    const { logger } = jest.requireMock('../../../utils/logger');

    await loggingMiddleware(makeCtx(init), jest.fn());

    expect(logger.info).toHaveBeenCalledWith(
      'Incoming update',
      expect.objectContaining({ type })
    );
  });

  it('неизвестный тип обновления так и помечается', async () => {
    const { logger } = jest.requireMock('../../../utils/logger');

    await loggingMiddleware(makeCtx(), jest.fn());

    expect(logger.info).toHaveBeenCalledWith(
      'Incoming update',
      expect.objectContaining({ type: 'unknown' })
    );
  });
});

describe('statsMiddleware', () => {
  it('пропускает обновление дальше', async () => {
    const next = jest.fn();

    await statsMiddleware(makeCtx(), next);

    expect(next).toHaveBeenCalled();
  });

  it('ошибка обработчика пробрасывается', async () => {
    const next = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(statsMiddleware(makeCtx(), next)).rejects.toThrow('boom');
  });
});

describe('errorLoggingMiddleware', () => {
  it('успешную обработку не трогает', async () => {
    const ctx = makeCtx();
    const next = jest.fn();

    await errorLoggingMiddleware(ctx, next);

    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('на ошибке отвечает пользователю и пробрасывает её', async () => {
    const ctx = makeCtx();
    const next = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(errorLoggingMiddleware(ctx, next)).rejects.toThrow('boom');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Что-то сломалось'),
      expect.any(Object)
    );
  });

  it('невозможность ответить не подменяет исходную ошибку', async () => {
    const ctx = makeCtx();
    ctx.reply.mockRejectedValue(new Error('chat not found'));
    const next = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(errorLoggingMiddleware(ctx, next)).rejects.toThrow('boom');
  });

  it('не-Error тоже логируется', async () => {
    const { logger } = jest.requireMock('../../../utils/logger');
    const next = jest.fn().mockRejectedValue('строка вместо ошибки');

    await expect(errorLoggingMiddleware(makeCtx(), next)).rejects.toBe(
      'строка вместо ошибки'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Bot error occurred',
      expect.objectContaining({
        error: expect.objectContaining({ name: 'UnknownError' }),
      })
    );
  });
});

describe('rateLimitMiddleware', () => {
  it('в пределах лимита пропускает', async () => {
    const middleware = rateLimitMiddleware(3, 60_000);
    const next = jest.fn();

    await middleware(makeCtx(), next);
    await middleware(makeCtx(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('превышение лимита останавливает и предупреждает', async () => {
    const middleware = rateLimitMiddleware(2, 60_000);
    const next = jest.fn();
    const ctx = makeCtx();

    await middleware(ctx, next);
    await middleware(ctx, next);
    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Слишком часто'),
      expect.any(Object)
    );
  });

  it('после окна счётчик обнуляется', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-03T10:00:00.000Z'));
    const middleware = rateLimitMiddleware(1, 1000);
    const next = jest.fn();
    const ctx = makeCtx();

    await middleware(ctx, next);
    jest.setSystemTime(new Date('2026-08-03T10:00:02.000Z'));
    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('лимит считается по каждому пользователю отдельно', async () => {
    const middleware = rateLimitMiddleware(1, 60_000);
    const next = jest.fn();

    await middleware(makeCtx({ from: { id: 1 } }), next);
    await middleware(makeCtx({ from: { id: 2 } }), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('обновление без пользователя не ограничивается', async () => {
    const middleware = rateLimitMiddleware(1, 60_000);
    const next = jest.fn();

    await middleware(makeCtx({ from: undefined }), next);
    await middleware(makeCtx({ from: undefined }), next);

    expect(next).toHaveBeenCalledTimes(2);
  });
});

describe('commandLoggingMiddleware', () => {
  it('логирует только команды', async () => {
    const { logger } = jest.requireMock('../../../utils/logger');
    const next = jest.fn();

    await commandLoggingMiddleware(
      makeCtx({ message: { message_id: 1, text: '/start привет' } }),
      next
    );

    expect(logger.info).toHaveBeenCalledWith(
      'Command executed',
      expect.objectContaining({ command: '/start' })
    );
    expect(next).toHaveBeenCalled();
  });

  it('обычный текст не логируется как команда', async () => {
    const { logger } = jest.requireMock('../../../utils/logger');
    const next = jest.fn();

    await commandLoggingMiddleware(
      makeCtx({ message: { message_id: 1, text: 'привет' } }),
      next
    );

    expect(logger.info).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('обновление без сообщения проходит дальше', async () => {
    const next = jest.fn();

    await commandLoggingMiddleware(makeCtx(), next);

    expect(next).toHaveBeenCalled();
  });
});
