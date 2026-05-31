import { BotContext } from '../../types/bot.types';
import { MenuService } from '../../services/menu.service';
import { UserService } from '../../services/user.service';
import { logger } from '../../utils/logger';

/**
 * Команда /menu - открытие Mini App для управления меню
 */
export async function menuCommand(ctx: BotContext): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      await ctx.reply('❌ Не удалось распознать пользователя. Перезапусти бота командой /start');
      return;
    }

    // Проверяем, зарегистрирован ли пользователь
    const dbUser = await UserService.getUserByTelegramId(BigInt(user.id));
    if (!dbUser) {
      await ctx.reply(
        '❌ Ты ещё не зарегистрирован.\n\n' +
        'Отправь /start, чтобы начать.'
      );
      return;
    }

    const isAdmin = dbUser.isAdmin;
    const isGroup = ctx.chat?.type !== 'private';
    
    // Получаем статистику меню
    const menuStats = await MenuService.getMenuStats();
    const popularItems = await MenuService.getPopularMenuItems(3);

    let text = '🍽️ **Управление меню**\n\n';
    text += `📊 **Статистика:**\n`;
    text += `• Всего блюд: ${menuStats.total}\n`;
    text += `• Активных: ${menuStats.active}\n`;
    if (menuStats.averagePrice > 0) {
      text += `• Средняя цена: ${menuStats.averagePrice}₽\n`;
    }
    text += '\n';

    if (popularItems.length > 0) {
      text += '🔥 **Популярные блюда:**\n';
      popularItems.forEach((item, index) => {
        text += `${index + 1}. ${item.name} (${item.voteCount} голосов)\n`;
      });
      text += '\n';
    }

    if (isAdmin) {
      text += '👑 **Права администратора:**\n';
      text += '• Добавление новых блюд\n';
      text += '• Редактирование существующих\n';
      text += '• Активация/деактивация блюд\n';
      text += '• Удаление блюд\n';
      text += '• Просмотр статистики\n\n';
    } else {
      text += '👀 **Доступен просмотр:**\n';
      text += '• Список всех блюд\n';
      text += '• Статистика популярности\n';
      text += '• Поиск\n\n';
      text += '💡 *Для редактирования требуются права администратора*\n\n';
    }

    // Кнопки для управления
    const webappUrl = process.env.WEBAPP_URL ?? '';
    if (!webappUrl) {
      logger.warn('WEBAPP_URL is not set — web_app buttons will be unavailable');
    }
    const botUsername = ctx.me.username;
    
    const keyboard = {
      inline_keyboard: isGroup ? [
        // Для групп - deep link для открытия Mini App
        [
          {
            text: '📱 Открыть управление',
            url: `https://t.me/${botUsername}?start=menu_${ctx.chat?.id || 'unknown'}`
          }
        ],
        [
          { text: '📋 Показать список', callback_data: 'show_menu_list' },
          { text: '🔍 Поиск блюда', callback_data: 'search_menu' }
        ],
        [
          { text: '📊 Популярные', callback_data: 'show_popular' },
          { text: '📂 Категории', callback_data: 'show_categories' }
        ]
      ] : [
        // Для личных чатов - прямая web_app кнопка
        [
          {
            text: '🚀 Открыть Mini App',
            web_app: { url: webappUrl }
          }
        ],
        [
          { text: '📋 Показать список', callback_data: 'show_menu_list' },
          { text: '🔍 Поиск блюда', callback_data: 'search_menu' }
        ],
        [
          { text: '📊 Популярные', callback_data: 'show_popular' },
          { text: '📂 Категории', callback_data: 'show_categories' }
        ]
      ]
    };

    // Добавляем админские кнопки
    if (isAdmin) {
      keyboard.inline_keyboard.push([
        { text: '➕ Быстрое добавление', callback_data: 'quick_add_item' },
        { text: '⚙️ Настройки', callback_data: 'menu_settings' }
      ]);
    }
    
    // В группах добавляем подсказку
    if (isGroup) {
      text += '\n💡 Открой управление кнопкой ниже или через *Menu* справа от поля ввода.\n';
    }

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    logger.info('Menu command executed', {
      userId: dbUser.id,
      telegramId: user.id.toString(),
      isAdmin,
      chatType: ctx.chat?.type || 'unknown'
    });

  } catch (error) {
    logger.error('Error in menu command:', error);
    await ctx.reply(
      '❌ Произошла ошибка при загрузке меню.\n\n' +
      '🔄 Попробуй ещё раз или обратись к администратору.'
    );
  }
}

/**
 * Обработчик быстрого добавления блюда (для админов)
 */
export async function handleQuickAddItem(ctx: any): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) return;

    const isAdmin = await UserService.isAdmin(BigInt(user.id));
    if (!isAdmin) {
      await ctx.answerCallbackQuery('❌ Доступно только администраторам');
      return;
    }

    // Устанавливаем состояние ожидания ввода
    ctx.session.step = 'waiting_menu_item_name';
    ctx.session.tempData = {};

    await ctx.answerCallbackQuery();
    await ctx.reply(
      '➕ **Быстрое добавление блюда**\n\n' +
      '📝 Введите название блюда:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Отмена', callback_data: 'cancel_add_item' }]
          ]
        }
      }
    );

  } catch (error) {
    logger.error('Error in quick add item:', error);
    await ctx.answerCallbackQuery('❌ Произошла ошибка');
  }
}

/**
 * Показать список блюд в текстовом виде
 */
export async function handleShowMenuList(ctx: any): Promise<void> {
  try {
    const activeItems = await MenuService.getActiveMenuItems();
    
    if (activeItems.length === 0) {
      await ctx.answerCallbackQuery();
      await ctx.reply(
        '🍽️ **Меню пусто**\n\n' +
        '➕ Добавь блюда в приложении или командой быстрого добавления.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let text = '🍽️ **Список блюд** (активные)\n\n';

    activeItems.forEach((item, index) => {
      text += `${index + 1}. ${item.name}`;
      if (item.price) text += ` - ${item.price}₽`;
      if (item.description) text += `\n   _${item.description}_`;
      text += '\n';
    });

    await ctx.answerCallbackQuery();
    const isGroup = ctx.chat?.type !== 'private';
    const webappUrl = process.env.WEBAPP_URL ?? '';
    
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: isGroup ? [
          // Для групп - без web_app
          [
            { text: '🔍 Поиск', callback_data: 'search_menu' },
            { text: '🔄 Обновить', callback_data: 'show_menu_list' }
          ]
        ] : [
          // Для личных чатов - с web_app
          [
            { text: '🚀 Открыть Mini App', web_app: { url: webappUrl } }
          ],
          [
            { text: '🔍 Поиск', callback_data: 'search_menu' },
            { text: '🔄 Обновить', callback_data: 'show_menu_list' }
          ]
        ]
      }
    });

  } catch (error) {
    logger.error('Error showing menu list:', error);
    await ctx.answerCallbackQuery('❌ Ошибка загрузки списка');
  }
}


