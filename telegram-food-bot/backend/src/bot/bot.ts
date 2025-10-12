import { Bot, session, BotConfig } from 'grammy';
import { BotContext, SessionData } from '../types/bot.types';
import { botConfig } from '../config/bot.config';
import { logger } from '../utils/logger';
import { setupErrorHandlers } from '../utils/error';
import { UserService } from '../services/user.service';
import { notificationService } from '../services/notification.service';
import { PollReminderService } from '../services/poll-reminder.service';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

const userService = new UserService();

// Module-level bot instance for access from services
let botInstance: Bot<BotContext> | null = null;

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
import { voteCommand } from './commands/vote';
import { quickVoteCommand, resultsCommand } from './commands/quick';

// Handlers
import { 
  handleVote, 
  handleShowResults, 
  handleCancelPoll, 
  handleRunRoulette,
  handleCompletePoll,
  handleRefreshPoll,
  handleBringOwnVote,
  handleSkipVote,
  handleOpenPollButton
} from './handlers/poll.handlers';

// Events
import { setupGroupEvents, setupDefaultMenuButton } from './events/group-events';

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
  // Настройка прокси или локального API
  let gramBotConfig: BotConfig<BotContext> | undefined;
  
  if (botConfig.localApi.enabled) {
    // Используем локальный Telegram Bot API сервер
    logger.info('🔧 Используется локальный Telegram Bot API сервер', {
      url: botConfig.localApi.url,
    });
    gramBotConfig = {
      client: {
        apiRoot: botConfig.localApi.url,
      },
    };
  } else if (botConfig.proxy.enabled && botConfig.proxy.url) {
    // Используем прокси
    logger.info('🔧 Используется прокси для подключения к Telegram API', {
      proxy: botConfig.proxy.url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'), // Скрываем пароль
    });
    
    try {
      const proxyUrl = botConfig.proxy.url;
      let agent;
      
      if (proxyUrl.startsWith('socks')) {
        agent = new SocksProxyAgent(proxyUrl);
      } else {
        agent = new HttpsProxyAgent(proxyUrl);
      }
      
      gramBotConfig = {
        client: {
          // @ts-ignore - Grammy типы не всегда корректны для агентов
          baseFetchConfig: {
            agent,
            compress: true,
          },
        },
      };
    } catch (error) {
      logger.error('❌ Ошибка настройки прокси:', error);
      logger.warn('⚠️  Продолжаем без прокси...');
    }
  }
  
  botInstance = new Bot<BotContext>(botConfig.token, gramBotConfig);
  const bot = botInstance;

  // Настройка обработки ошибок
  setupErrorHandlers();

  // Инициализация notification service
  notificationService.initialize(bot);
  
  // Инициализация poll reminder service
  PollReminderService.initialize(bot);

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
  bot.command('vote', voteCommand); // Fallback для голосования без web_app
  bot.command('startpoll', groupOnlyMiddleware, adminMiddleware(), startPollCommand);
  bot.command('q', groupOnlyMiddleware, quickVoteCommand);
  bot.command('r', groupOnlyMiddleware, resultsCommand);

  bot.command('history', async (ctx: BotContext) => {
    await ctx.reply('🚧 История голосований в разработке!');
  });

  // Обработка callback queries
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    try {
      // Обработка кнопки "Проголосовать" (Deep Linking)
      if (data.startsWith('openpoll:')) {
        const pollId = parseInt(data.split(':')[1]);
        await handleOpenPollButton(ctx as any, pollId);
        return;
      }

      // Обработка fallback кнопки "Альтернативный способ"
      if (data.startsWith('vote_fallback:')) {
        const pollId = parseInt(data.split(':')[1]);
        await ctx.answerCallbackQuery();
        await ctx.reply(
          '💡 **Альтернативные способы голосования:**\n\n' +
          `1️⃣ Используйте команду: \`/vote ${pollId}\`\n\n` +
          `2️⃣ Откройте бота в личных сообщениях и нажмите на кнопку Web App\n\n` +
          '📱 Выберите удобный для вас способ!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Обработка голосования
      if (data.startsWith('vote:')) {
        const parts = data.split(':');
        if (parts[1] === 'bring_own') {
          // Голосование "Принесу из дома"
          const pollId = parseInt(parts[2]);
          await handleBringOwnVote(ctx as any, pollId);
          return;
        } else if (parts[1] === 'skip') {
          // Голосование "Не обедаю"
          const pollId = parseInt(parts[2]);
          await handleSkipVote(ctx as any, pollId);
          return;
        } else {
          // Обычное голосование за блюдо
          const pollId = parseInt(parts[1]);
          const menuItemId = parseInt(parts[2]);
          await handleVote(ctx as any, pollId, menuItemId);
          return;
        }
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
            '👑 *Администраторы бота:*\n\n' + 
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

  // Настройка обработчиков событий группы
  setupGroupEvents(bot);

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
    
    // Настраиваем дефолтный Menu Button для личных чатов
    setupDefaultMenuButton(bot).catch(err => {
      logger.error('Failed to setup default menu button:', err);
    });
  });

  return bot;
}

/**
 * Запуск бота в polling режиме
 */
export async function startPolling(bot: Bot<BotContext>): Promise<void> {
  try {
    // Удаляем webhook перед запуском polling (для локальной разработки)
    logger.info('🔄 Удаление webhook перед запуском polling...');
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    logger.info('✅ Webhook удален');
    
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
    // Отменяем все активные напоминания
    PollReminderService.cancelAllReminders();
    
    await bot.stop();
    logger.info('🛑 Бот остановлен');
  } catch (error) {
    logger.error('❌ Ошибка остановки бота:', error);
  }
}

/**
 * Получение глобального экземпляра бота
 * Используется сервисами для доступа к Telegram API
 */
export function getBotInstance(): Bot<BotContext> | null {
  return botInstance;
}


