import { NextFunction } from 'grammy';
import { BotContext } from '../../types/bot.types';
import { UserService } from '../../services/user.service';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';

/**
 * Middleware для аутентификации пользователей
 * Автоматически создает/обновляет пользователя в БД
 */
export async function authMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      return next();
    }

    // Создаем или обновляем пользователя
    const dbUser = await UserService.upsertUser({
      telegramId: user.id.toString(),
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    // Сохраняем информацию о пользователе в контекст
    ctx.dbUser = dbUser;

    // Если это групповой чат, обрабатываем группу
    if (ctx.chat && ['group', 'supergroup'].includes(ctx.chat.type)) {
      const group = await GroupService.upsertGroup({
        telegramId: ctx.chat.id.toString(),
        title: 'title' in ctx.chat ? ctx.chat.title : 'Unknown Group',
        type: ctx.chat.type,
      });

      ctx.dbGroup = group;

      // Добавляем пользователя в группу
      await GroupService.addMemberToGroup(group.id, dbUser.id);
    }

    return next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return next();
  }
}

/**
 * Middleware проверки админских прав
 * Проверяет является ли пользователь администратором бота
 */
export function adminMiddleware() {
  return async function(ctx: BotContext, next: NextFunction): Promise<void> {
    try {
      const user = ctx.from;
      if (!user) {
        await ctx.reply('❌ Не удалось определить пользователя');
        return;
      }

      const isAdmin = await UserService.isAdmin(BigInt(user.id));
      if (!isAdmin) {
        await ctx.reply(
          '🔒 **Недостаточно прав**\n\n' +
          'Эта команда доступна только администраторам бота.\n\n' +
          '💡 Обратитесь к администратору для получения прав.',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '👑 Список админов', callback_data: 'show_admins' }]
              ]
            }
          }
        );
        return;
      }

      return next();
    } catch (error) {
      logger.error('Admin middleware error:', error);
      await ctx.reply('❌ Ошибка проверки прав администратора');
    }
  };
}

/**
 * Middleware проверки админских прав в группе
 * Проверяет права администратора Telegram в текущей группе
 */
export function groupAdminMiddleware() {
  return async function(ctx: BotContext, next: NextFunction): Promise<void> {
    try {
      const user = ctx.from;
      const chat = ctx.chat;

      if (!user || !chat) {
        await ctx.reply('❌ Не удалось определить контекст');
        return;
      }

      // Проверяем только в групповых чатах
      if (!['group', 'supergroup'].includes(chat.type)) {
        return next();
      }

      // Проверяем права в Telegram группе
      const member = await ctx.api.getChatMember(chat.id, user.id);
      const isGroupAdmin = ['administrator', 'creator'].includes(member.status);

      if (!isGroupAdmin) {
        await ctx.reply(
          '🔒 **Недостаточно прав в группе**\n\n' +
          'Для выполнения этой команды вам нужны права администратора группы.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      return next();
    } catch (error) {
      logger.error('Group admin middleware error:', error);
      await ctx.reply('❌ Ошибка проверки прав в группе');
    }
  };
}

/**
 * Middleware ограничения только для групп
 */
export async function groupOnlyMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  if (ctx.chat?.type === 'private') {
    await ctx.reply(
      '👥 **Команда только для групп**\n\n' +
      'Эта команда работает только в групповых чатах.\n\n' +
      '💡 Добавьте бота в группу и попробуйте снова.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📖 Инструкция', callback_data: 'group_setup_help' }]
          ]
        }
      }
    );
    return;
  }

  return next();
}

/**
 * Middleware ограничения только для личных сообщений
 */
export async function privateOnlyMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  if (ctx.chat?.type !== 'private') {
    await ctx.reply(
      '💬 **Команда только для личных сообщений**\n\n' +
      'Эта команда работает только в личной переписке с ботом.\n\n' +
      '💡 Напишите боту в личные сообщения.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  return next();
}

/**
 * Middleware проверки активности пользователя
 */
export async function activeUserMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      return next();
    }

    const dbUser = await UserService.getUserByTelegramId(BigInt(user.id));
    if (!dbUser?.isActive) {
      await ctx.reply(
        '🔒 **Аккаунт деактивирован**\n\n' +
        'Ваш аккаунт был деактивирован администратором.\n\n' +
        'Обратитесь к администратору для восстановления доступа.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    return next();
  } catch (error) {
    logger.error('Active user middleware error:', error);
    return next();
  }
}

/**
 * Middleware для команд требующих регистрации
 */
export async function registeredUserMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      await ctx.reply('❌ Не удалось определить пользователя');
      return;
    }

    const dbUser = await UserService.getUserByTelegramId(BigInt(user.id));
    if (!dbUser) {
      await ctx.reply(
        '📝 **Требуется регистрация**\n\n' +
        'Для использования этой команды необходимо зарегистрироваться.\n\n' +
        'Используйте команду /start для регистрации.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 Зарегистрироваться', callback_data: 'start' }]
            ]
          }
        }
      );
      return;
    }

    return next();
  } catch (error) {
    logger.error('Registered user middleware error:', error);
    await ctx.reply('❌ Ошибка проверки регистрации');
  }
}


