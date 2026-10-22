/**
 * Middleware бота, подключённые в createBot. Ключевое свойство: сбой
 * аутентификации НЕ должен глушить бота (next вызывается всё равно), а ошибка
 * обработчика доходит до пользователя ответом и пробрасывается дальше.
 *
 * Регистрацию пользователя и группы на тестовой БД проверяет integration/bot.
 */
import { authMiddleware } from '../../../bot/middleware/auth';
import { errorLoggingMiddleware } from '../../../bot/middleware/logger';
import { UserService } from '../../../services/user.service';
import { asServiceMock } from '../../helpers/mocks';
import type { BotContext } from '../../../types/bot.types';

jest.mock('../../../services/user.service', () => ({
  UserService: { upsertUser: jest.fn() },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { upsertGroup: jest.fn(), addMemberToGroup: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const userService = asServiceMock(UserService);

/**
 * Минимальный контекст grammy: только то, что читают middleware.
 *
 * `from: undefined` передаётся осознанно (обновление без пользователя),
 * поэтому проверяем НАЛИЧИЕ ключа, а не его значение: с `??` заглушка молча
 * подставляла бы пользователя обратно и тест проверял бы не тот случай.
 */
function makeCtx(init: { from?: { id: number; first_name?: string } } = {}) {
  return {
    from: 'from' in init ? init.from : { id: 555, first_name: 'Игорь', username: 'igor' },
    chat: { id: 555, type: 'private' },
    update: { update_id: 1 },
    reply: jest.fn().mockResolvedValue(undefined),
  } as unknown as BotContext & { reply: jest.Mock };
}

beforeEach(() => {
  jest.clearAllMocks();
  userService.upsertUser.mockResolvedValue({ id: 1, telegramId: BigInt(555), isActive: true });
});

describe('authMiddleware', () => {
  it('обновление без пользователя пропускается дальше', async () => {
    const next = jest.fn();

    await authMiddleware(makeCtx({ from: undefined }), next);

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

describe('errorLoggingMiddleware', () => {
  it('успешную обработку не трогает', async () => {
    const ctx = makeCtx();

    await errorLoggingMiddleware(ctx, jest.fn());

    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('на ошибке отвечает пользователю и пробрасывает её', async () => {
    const ctx = makeCtx();
    const next = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(errorLoggingMiddleware(ctx, next)).rejects.toThrow('boom');
    expect(ctx.reply).toHaveBeenCalled();
  });

  it('невозможность ответить не подменяет исходную ошибку', async () => {
    const ctx = makeCtx();
    ctx.reply.mockRejectedValue(new Error('chat not found'));
    const next = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(errorLoggingMiddleware(ctx, next)).rejects.toThrow('boom');
  });

  it('не-Error пробрасывается как есть', async () => {
    const next = jest.fn().mockRejectedValue('строка вместо ошибки');

    await expect(errorLoggingMiddleware(makeCtx(), next)).rejects.toBe('строка вместо ошибки');
  });
});
