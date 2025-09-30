import { Bot, session } from 'grammy';
import { BotContext, SessionData } from '../types/bot.types';
import { botConfig } from '../config/bot.config';
import { logger } from '../utils/logger';
import { setupErrorHandlers } from '../utils/error';
import { UserService } from '../services/user.service';
import { notificationService } from '../services/notification.service';

const userService = new UserService();

// Middleware
import { 
  authMiddleware,
  adminMiddleware,
  groupOnlyMiddleware,
  privateOnlyMiddleware
} from './middleware/auth';
import { 
  loggingMiddleware,
  statsMiddleware,
  errorLoggingMiddleware
} from './middleware/logger';

// Commands
import { startCommand } from './commands/start';
import { helpCommand } from './commands/help';
import { menuCommand } from './commands/menu';
import { startPollCommand } from './commands/startpoll';

// Handlers
import { 
  handleVote, 
  handleShowResults, 
  handleCancelPoll, 
  handleRunRoulette,
  handleCompletePoll,
  handleRefreshPoll
} from './handlers/poll.handlers';

// Инициализация сессий
function initial(): SessionData {
  return {
    step: undefined,
    tempData: undefined,
  };
}

/**
 * Настройка и создание бота
 */
export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(botConfig.token);

  // Настройка обработки ошибок
  setupErrorHandlers();

  // Инициализация notification service
  notificationService.initialize(bot);

  // Глобальные middleware (применяются ко всем обновлениям)
  bot.use(session({ initial }));
  bot.use(loggingMiddleware);
  bot.use(errorLoggingMiddleware);
  bot.use(authMiddleware);
  bot.use(statsMiddleware);

  // Команды
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('menu', menuCommand);
  bot.command('startpoll', groupOnlyMiddleware, adminMiddleware(), startPollCommand);

  bot.command('history', async (ctx) => {
    await ctx.reply('🚧 История голосований в разработке!');
  });

  // Обработка callback queries
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    try {
      // Обработка голосования
      if (data.startsWith('vote:')) {
        const [, pollIdStr, menuItemIdStr] = data.split(':');
        const pollId = parseInt(pollIdStr);
        const menuItemId = parseInt(menuItemIdStr);
        await handleVote(ctx as any, pollId, menuItemId);
        return;
      }

      // Обработка результатов голосования
      if (data.startsWith('show_results:')) {
        const pollId = parseInt(data.split(':')[1]);
        await handleShowResults(ctx as any, pollId);
        return;
      }

      // Отмена голосования
      if (data.startsWith('cancel_poll:')) {
        const pollId = parseInt(data.split(':')[1]);
        await handleCancelPoll(ctx as any, pollId);
        return;
      }

      // Запуск рулетки
      if (data.startsWith('run_roulette:')) {
        const pollId = parseInt(data.split(':')[1]);
        await handleRunRoulette(ctx as any, pollId);
        return;
      }

      // Завершение голосования
      if (data.startsWith('complete_poll:')) {
        const pollId = parseInt(data.split(':')[1]);
        await handleCompletePoll(ctx as any, pollId);
        return;
      }

      // Обновление голосования
      if (data.startsWith('refresh_poll:')) {
        const pollId = parseInt(data.split(':')[1]);
        await handleRefreshPoll(ctx as any, pollId);
        return;
      }

      // Остальные команды
      switch (data) {
        case 'help':
          await helpCommand(ctx);
          break;
        case 'start_new_poll':
          await ctx.answerCallbackQuery('Используйте команду /startpoll для запуска нового голосования');
          break;
        case 'show_history':
          await ctx.answerCallbackQuery('🚧 История в разработке!');
          break;
        case 'show_admins':
          const admins = await UserService.getAdmins();
          const adminList = admins.map((admin: any) => 
            `👑 ${admin.firstName}${admin.lastName ? ` ${admin.lastName}` : ''}${admin.username ? ` (@${admin.username})` : ''}`
          ).join('\n');
          
          await ctx.answerCallbackQuery();
          await ctx.reply(
            '👑 **Администраторы бота:**\n\n' + 
            (adminList || 'Администраторы не назначены'),
            { parse_mode: 'Markdown' }
          );
          break;
        case 'about':
          await ctx.answerCallbackQuery();
          await ctx.reply(
            '🤖 *Telegram Food Bot*\n\n' +
            'Бот для организации голосований за еду в коллективе.\n\n' +
            '✨ *Возможности:*\n' +
            '• Управление меню блюд\n' +
            '• Голосование за блюда\n' +
            '• Рулетка для выбора ответственного\n' +
            '• Статистика и история\n\n' +
            '🔧 Версия: 1.0.0\n' +
            '📅 Создан: 2024',
            { parse_mode: 'Markdown' }
          );
          break;
        case 'menu_stats':
          await ctx.answerCallbackQuery('🚧 Статистика в разработке!');
          break;
        case 'menu_help':
          await ctx.answerCallbackQuery();
          await ctx.reply(
            '❓ *Помощь по меню*\n\n' +
            '🍽️ *Как добавить блюдо:*\n' +
            '1. Нажмите "Открыть Mini App"\n' +
            '2. Используйте кнопку "Добавить блюдо"\n' +
            '3. Заполните название и описание\n' +
            '4. Сохраните изменения\n\n' +
            '⚙️ *Управление блюдами:*\n' +
            '• Редактирование - нажмите на блюдо\n' +
            '• Активация/деактивация - переключатель\n' +
            '• Удаление - кнопка удаления\n\n' +
            '💡 *Советы:*\n' +
            '• Активные блюда участвуют в голосовании\n' +
            '• Используйте категории для группировки\n' +
            '• Добавляйте цены для удобства',
            { parse_mode: 'Markdown' }
          );
          break;
        default:
          await ctx.answerCallbackQuery('🤷‍♂️ Неизвестная команда');
      }
    } catch (error) {
      logger.error('Ошибка обработки callback query:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка');
    }
  });

  // Обработка неизвестных команд
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    
    if (text.startsWith('/')) {
      await ctx.reply(
        '❓ Неизвестная команда.\n\n' +
        'Используйте /help для получения списка доступных команд.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📖 Показать команды', callback_data: 'help' }]
            ]
          }
        }
      );
    }
  });

  // Логируем готовность бота
  bot.api.getMe().then((botInfo) => {
    logger.info('🤖 Бот инициализирован', {
      id: botInfo.id,
      username: botInfo.username,
      firstName: botInfo.first_name,
      canJoinGroups: botInfo.can_join_groups,
      canReadAllGroupMessages: botInfo.can_read_all_group_messages,
      supportsInlineQueries: botInfo.supports_inline_queries,
    });
  });

  return bot;
}

/**
 * Запуск бота в polling режиме
 */
export async function startPolling(bot: Bot<BotContext>): Promise<void> {
  try {
    await bot.start({
      onStart: (botInfo) => {
        logger.info('🚀 Бот запущен в polling режиме', {
          username: botInfo.username,
        });
      },
    });
  } catch (error) {
    logger.error('❌ Ошибка запуска бота в polling режиме:', error);
    throw error;
  }
}

/**
 * Настройка webhook для production
 */
export async function setupWebhook(bot: Bot<BotContext>, webhookUrl: string): Promise<void> {
  try {
    await bot.api.setWebhook(webhookUrl, {
      drop_pending_updates: true,
    });
    
    logger.info('🌐 Webhook установлен', { webhookUrl });
  } catch (error) {
    logger.error('❌ Ошибка установки webhook:', error);
    throw error;
  }
}

/**
 * Остановка бота
 */
export async function stopBot(bot: Bot<BotContext>): Promise<void> {
  try {
    await bot.stop();
    logger.info('🛑 Бот остановлен');
  } catch (error) {
    logger.error('❌ Ошибка остановки бота:', error);
  }
}


