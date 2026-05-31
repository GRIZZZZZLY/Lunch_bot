import { BotContext } from '../../types/bot.types';
import { UserService } from '../../services/user.service';
import { logger } from '../../utils/logger';

/**
 * Команда /app - быстрое открытие Mini App
 * Работает как в личных чатах, так и в группах
 */
export async function appCommand(ctx: BotContext): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      await ctx.reply('❌ Не удалось распознать пользователя. Перезапусти бота командой /start');
      return;
    }

    // Проверяем регистрацию пользователя
    const dbUser = await UserService.getUserByTelegramId(BigInt(user.id));
    if (!dbUser) {
      await ctx.reply(
        '❌ Ты ещё не зарегистрирован.\n\n' +
        'Отправь /start, чтобы начать.',
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '▶️ Начать', callback_data: 'start' }
            ]]
          }
        }
      );
      return;
    }

    const webappUrl = process.env.WEBAPP_URL ?? '';
    if (!webappUrl) {
      logger.warn('WEBAPP_URL is not set — web_app buttons will be unavailable');
    }
    const isGroup = ctx.chat?.type !== 'private';
    const isAdmin = dbUser.isAdmin;

    let text = '🚀 *Rocket Lunch*\n\n';
    
    if (isGroup) {
      text += '👥 **Групповой режим**\n\n';
      text += '⚠️ В группах кнопки приложения не работают — ограничение Telegram.\n\n';
      text += '📱 **Для управления меню:**\n';
      text += '1. Открой бота [@rocket_lunch_bot](https://t.me/rocket_lunch_bot) в личных сообщениях\n';
      text += '2. Нажми на кнопку **Menu** внизу экрана\n';
      text += '3. Или используйте команду `/menu` в личке\n\n';
      text += '✨ **Доступные функции:**\n';
      text += '• 📋 Просмотр меню блюд\n';
      text += '• 🔍 Поиск и фильтрация\n';
      text += '• 📊 Статистика популярности\n';
      if (isAdmin) {
        text += '• ➕ Добавление новых блюд\n';
        text += '• ✏️ Редактирование меню\n';
        text += '• 🗳️ Создание голосований\n';
      }
    } else {
      text += '👤 **Личный режим**\n\n';
      text += '🎯 Открой приложение для управления меню:\n\n';
      if (isAdmin) {
        text += '👑 **У тебя есть права администратора:**\n';
        text += '• ➕ Добавляйте новые блюда\n';
        text += '• ✏️ Редактируйте существующие\n';
        text += '• 🗑️ Удаляйте ненужные\n';
        text += '• 📊 Просматривайте статистику\n';
        text += '• 🗳️ Создавайте голосования\n';
      } else {
        text += '👀 **Доступен просмотр:**\n';
        text += '• 📋 Список всех блюд\n';
        text += '• 🔍 Поиск и фильтры\n';
        text += '• 📊 Статистика\n';
      }
    }

    // В группах web_app кнопки не работают (ограничение Telegram)
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: isGroup ? [
          // Для групп - без web_app, с инструкцией
          [
            { text: '📖 Команды', callback_data: 'help' },
            { text: '🍽️ Меню', callback_data: 'menu' }
          ]
        ] : [
          // Для личных чатов - с web_app кнопкой
          [
            {
              text: '🚀 Открыть Mini App',
              web_app: { url: webappUrl }
            }
          ],
          [
            { text: '📖 Команды', callback_data: 'help' },
            { text: '🍽️ Меню', callback_data: 'menu' }
          ]
        ]
      }
    });

    logger.info('App command executed', {
      userId: dbUser.id,
      telegramId: user.id.toString(),
      isAdmin,
      chatType: ctx.chat?.type || 'unknown',
      isGroup
    });

  } catch (error) {
    logger.error('Error in app command:', error);
    await ctx.reply(
      '❌ Произошла ошибка.\n\n' +
      '🔄 Попробуй ещё раз или обратись к администратору.'
    );
  }
}
