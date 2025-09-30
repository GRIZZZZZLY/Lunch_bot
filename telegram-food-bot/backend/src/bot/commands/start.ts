import { CommandContext } from 'grammy';
import { BotContext } from '../../types/bot.types';
import { UserService } from '../../services/user.service';
import { logger } from '../../utils/logger';

/**
 * Команда /start - регистрация пользователя
 */
export async function startCommand(ctx: CommandContext<BotContext>): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      await ctx.reply('❌ Не удалось получить информацию о пользователе');
      return;
    }

    // Создаем или обновляем пользователя в БД
    const dbUser = await UserService.upsertUser({
      telegramId: user.id.toString(),
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    const isNewUser = ctx.session?.step !== 'registered';
    ctx.session.step = 'registered';

    const welcomeText = isNewUser 
      ? `🎉 Добро пожаловать, ${user.first_name}!\n\n` +
        '🤖 Я помогу вашей команде выбирать еду для заказа.\n\n' +
        '✨ **Что я умею:**\n' +
        '• 🗳️ Организовывать голосования за блюда\n' +
        '• 🎲 Выбирать ответственного за заказ\n' +
        '• 🍽️ Управлять меню блюд\n' +
        '• 📊 Показывать статистику\n\n' +
        '💡 **Для начала:**\n' +
        '1. Добавьте меня в группу\n' +
        '2. Дайте мне права администратора\n' +
        '3. Используйте /help для списка команд'
      : `👋 С возвращением, ${user.first_name}!`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🍽️ Управление меню', callback_data: 'menu' },
          { text: '📖 Команды', callback_data: 'help' }
        ],
        [
          { text: '👥 О боте', callback_data: 'about' },
          { text: '👑 Админы', callback_data: 'show_admins' }
        ]
      ]
    };

    await ctx.reply(welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    // Логируем регистрацию
    logger.info('User started bot', {
      userId: dbUser.id,
      telegramId: user.id.toString(),
      username: user.username,
      firstName: user.first_name,
      isNewUser
    });

    // Если это группа, объясняем функционал
    if (ctx.chat.type !== 'private') {
      setTimeout(async () => {
        await ctx.reply(
          '👥 **Групповой режим активирован!**\n\n' +
          '🔧 **Для полного функционала:**\n' +
          '1. Сделайте меня администратором группы\n' +
          '2. Используйте /startpoll для запуска голосования\n' +
          '3. Участники смогут голосовать за блюда\n\n' +
          '⚡ Попробуйте /help для списка команд',
          { parse_mode: 'Markdown' }
        );
      }, 1000);
    }

  } catch (error) {
    logger.error('Error in start command:', error);
    await ctx.reply('❌ Произошла ошибка при регистрации. Попробуйте позже.');
  }
}


