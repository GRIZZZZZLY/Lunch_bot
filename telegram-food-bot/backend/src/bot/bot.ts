import { Bot, session, BotConfig } from 'grammy';
import { BotContext, SessionData } from '../types/bot.types';
import { botConfig } from '../config/bot.config';
import { logger } from '../utils/logger';
import { setupErrorHandlers } from '../utils/error';
import { notificationService } from '../services/notification.service';
import { PollReminderService } from '../services/poll-reminder.service';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';


// Module-level bot instance for access from services
let botInstance: Bot<BotContext> | null = null;

// Middleware
import { authMiddleware } from './middleware/auth';
import { 
  loggingMiddleware,
  statsMiddleware,
  errorLoggingMiddleware
} from './middleware/logger';

// Commands
import { startCommand } from './commands/start';
import { helpCommand } from './commands/help';
import { menuCommand } from './commands/menu';
import { appCommand } from './commands/app';
import { setBotInstance } from './bot-instance';

// Handlers
import { 
  handleCancelPoll, 
  handleRunRoulette,
  handleCompletePoll,
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

function parseCallbackId(data: string, index: number): number | null {
  const value = data.split(':')[index];
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
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
  } else {
    logger.warn('⚠️  ВАЖНО: Прокси не настроен! Если Telegram API заблокирован, включите VPN или настройте прокси в .env');
  }
  
  botInstance = new Bot<BotContext>(botConfig.token, gramBotConfig);
  const bot = botInstance;

  // Регистрируем типизированный синглтон — все сервисы читают из него
  setBotInstance(bot);

  // Настройка обработки ошибок
  setupErrorHandlers();

  // Инициализация notification service
  notificationService.initialize(bot);
  
  // Инициализация poll reminder service
  PollReminderService.initialize(bot);

  // ⚡ Инициализация Scheduler (использует синглтон через getBotInstance)
  const { PollSchedulerService } = require('../services/poll-scheduler.service');
  PollSchedulerService.initialize(bot);

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
  bot.command('app', appCommand);

  // Обработка callback queries
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    try {
      // Обработка кнопки "Проголосовать" (Deep Linking)
      if (data.startsWith('openpoll:')) {
        const pollId = parseCallbackId(data, 1);
        if (!pollId) {
          await ctx.answerCallbackQuery('❌ Некорректный идентификатор голосования');
          return;
        }
        await handleOpenPollButton(ctx as any, pollId);
        return;
      }



      // Отмена голосования
      if (data.startsWith('cancel_poll:')) {
        const pollId = parseCallbackId(data, 1);
        if (!pollId) {
          await ctx.answerCallbackQuery('❌ Некорректный идентификатор голосования');
          return;
        }
        await handleCancelPoll(ctx as any, pollId);
        return;
      }

      // Запуск рулетки
      if (data.startsWith('run_roulette:')) {
        const pollId = parseCallbackId(data, 1);
        if (!pollId) {
          await ctx.answerCallbackQuery('❌ Некорректный идентификатор голосования');
          return;
        }
        await handleRunRoulette(ctx as any, pollId);
        return;
      }

      // Завершение голосования
      if (data.startsWith('complete_poll:')) {
        const pollId = parseCallbackId(data, 1);
        if (!pollId) {
          await ctx.answerCallbackQuery('❌ Некорректный идентификатор голосования');
          return;
        }
        await handleCompletePoll(ctx as any, pollId);
        return;
      }

      // 🚀 НОВОЕ: Бюджет-трекер - Добровольный выбор ответственного
      if (data.startsWith('volunteer:')) {
        const pollId = parseCallbackId(data, 1);
        if (!pollId) {
          await ctx.answerCallbackQuery('❌ Некорректный идентификатор голосования');
          return;
        }
        const { ResponsibleService } = await import('../services/responsible.service.js');
        await ResponsibleService.handleVolunteer(pollId, ctx.from.id);
        await ctx.answerCallbackQuery('✅ Спасибо! Вы выбраны ответственным');
        return;
      }

      // 🚀 НОВОЕ: Multi-category - Добровольный выбор для категории
      if (data.startsWith('volunteer_category:')) {
        const categoryOrderId = parseCallbackId(data, 1);
        if (!categoryOrderId) {
          await ctx.answerCallbackQuery('❌ Некорректный идентификатор категории');
          return;
        }
        const { MultiCategoryResponsibleService } = await import('../services/multi-category-responsible.service.js');
        await MultiCategoryResponsibleService.handleVolunteerForCategory(
          categoryOrderId,
          BigInt(ctx.from.id)
        );
        await ctx.answerCallbackQuery('✅ Спасибо! Вы ответственный за эту категорию');
        return;
      }

      // 🚀 НОВОЕ: Бюджет-трекер - Отметить оплату
      if (data.startsWith('budget:mark_paid:')) {
        const txId = parseCallbackId(data, 2);
        if (!txId) {
          await ctx.answerCallbackQuery('❌ Некорректный идентификатор транзакции');
          return;
        }
        const { BudgetService } = await import('../services/budget.service.js');
        const { prisma } = await import('../database/client.js');
        
        // ✅ FIX: Проверяем что пользователь - должник
        const tx = await prisma.transaction.findUnique({
          where: { id: txId },
          include: { fromUser: true },
        });
        
        if (!tx) {
          await ctx.answerCallbackQuery('❌ Транзакция не найдена');
          return;
        }
        
        if (Number(tx.fromUser.telegramId) !== ctx.from.id) {
          await ctx.answerCallbackQuery('❌ Вы можете отметить только свои долги');
          return;
        }
        
        await BudgetService.markAsPaid(txId, ctx.from.id);
        await ctx.answerCallbackQuery('✅ Отмечено как оплачено');
        // Edit the message: remove button and add pending status line
        try {
          const originalText = ctx.callbackQuery.message?.text ?? '';
          const updatedText = originalText + '\n\n⏳ Ожидаем подтверждения от ответственного...';
          await ctx.editMessageText(updatedText, { reply_markup: { inline_keyboard: [] } });
        } catch (e) { /* ignore if edit fails */ }
        return;
      }

      // 🚀 НОВОЕ: Бюджет-трекер - Подтвердить оплату
      if (data.startsWith('budget:confirm:')) {
        const txId = parseCallbackId(data, 2);
        if (!txId) {
          await ctx.answerCallbackQuery('❌ Некорректный идентификатор транзакции');
          return;
        }
        const { BudgetService } = await import('../services/budget.service.js');
        const { prisma } = await import('../database/client.js');
        
        // ✅ FIX: Проверяем что пользователь - кредитор (получатель)
        const tx = await prisma.transaction.findUnique({
          where: { id: txId },
          include: { toUser: true },
        });
        
        if (!tx) {
          await ctx.answerCallbackQuery('❌ Транзакция не найдена');
          return;
        }
        
        if (Number(tx.toUser.telegramId) !== ctx.from.id) {
          await ctx.answerCallbackQuery('❌ Вы можете подтвердить только платежи в ваш адрес');
          return;
        }
        
        await BudgetService.confirmPayment(txId);
        await ctx.answerCallbackQuery('✅ Оплата подтверждена');
        try {
          await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
        } catch (e) { /* ignore */ }
        return;
      }

      // Бюджет-трекер - Ответственный подтверждает что все оплатили
      if (data.startsWith('budget:all_paid:')) {
        const pollId = parseCallbackId(data, 2);
        if (!pollId) {
          await ctx.answerCallbackQuery('❌ Некорректный идентификатор голосования');
          return;
        }
        const { BudgetService } = await import('../services/budget.service.js');
        const { prisma } = await import('../database/client.js');

        // Проверяем что нажавший — ответственный (кредитор) по этому poll
        const tx = await prisma.transaction.findFirst({
          where: { pollId, toUser: { telegramId: BigInt(ctx.from.id) } },
        });
        if (!tx) {
          await ctx.answerCallbackQuery('❌ Вы не являетесь ответственным по этому заказу');
          return;
        }

        await BudgetService.markAllPaidByResponsible(pollId, tx.toUserId);
        await ctx.answerCallbackQuery('✅ Все транзакции подтверждены');
        try {
          await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
        } catch (e) { /* ignore */ }
        return;
      }

      // Бюджет-трекер - Ответственный отправляет напоминания должникам
      if (data.startsWith('budget:remind:')) {
        const pollId = parseCallbackId(data, 2);
        if (!pollId) {
          await ctx.answerCallbackQuery('❌ Некорректный идентификатор голосования');
          return;
        }
        const { BudgetService } = await import('../services/budget.service.js');
        const { prisma } = await import('../database/client.js');

        // Проверяем что нажавший — ответственный по этому poll
        const tx = await prisma.transaction.findFirst({
          where: { pollId, toUser: { telegramId: BigInt(ctx.from.id) } },
        });
        if (!tx) {
          await ctx.answerCallbackQuery('❌ Вы не являетесь ответственным по этому заказу');
          return;
        }

        const resultMessage = await BudgetService.remindAllDebtors(pollId, tx.toUserId);
        await ctx.answerCallbackQuery(resultMessage.substring(0, 200)); // Telegram limit 200 chars
        return;
      }

      // ⚡ НОВОЕ: Recurring Polls - Отключить расписание
      if (data.startsWith('recurring:disable:')) {
        const scheduleId = parseCallbackId(data, 2);
        if (!scheduleId) {
          await ctx.answerCallbackQuery('❌ Некорректный идентификатор расписания');
          return;
        }
        const { PollSchedulerService } = await import('../services/poll-scheduler.service.js');
        
        try {
          await PollSchedulerService.handleDisableCallback(scheduleId);
          await ctx.answerCallbackQuery('✅ Автоматические голосования отключены');
          await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
        } catch (error) {
          logger.error('Error disabling recurring poll:', error);
          await ctx.answerCallbackQuery('❌ Ошибка отключения');
        }
        return;
      }

      // Остальные команды
      switch (data) {
        case 'help':
          await helpCommand(ctx);
          break;
        default:
          await ctx.answerCallbackQuery('🤷‍♂️ Неизвестная команда');
      }
    } catch (error) {
      logger.error('Ошибка обработки callback query:', error);
      await ctx.answerCallbackQuery('❌ Произошла ошибка');
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
    try {
      await bot.api.deleteWebhook({ drop_pending_updates: true });
      logger.info('✅ Webhook удален');
    } catch (webhookError: any) {
      // Игнорируем ошибки удаления webhook (VPN/прокси проблемы)
      logger.warn('⚠️ Не удалось удалить webhook (пропускаем):', webhookError.message);
    }
    
    await bot.start({
      onStart: (botInfo) => {
        logger.info('🚀 Бот запущен в polling режиме', {
          username: botInfo.username,
        });
        
        // ⚡ НОВОЕ: Запускаем scheduler для автоматических голосований
        const { PollSchedulerService } = require('../services/poll-scheduler.service');
        PollSchedulerService.start();
        logger.info('⚡ Poll scheduler запущен');
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
    
    // ⚡ НОВОЕ: Останавливаем scheduler
    const { PollSchedulerService } = require('../services/poll-scheduler.service');
    PollSchedulerService.stop();
    logger.info('⚡ Poll scheduler остановлен');
    
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


