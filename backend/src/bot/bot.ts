import { Bot, session, BotConfig } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import { BotContext, SessionData } from '../types/bot.types';
import { botConfig } from '../config/bot.config';
import { logger } from '../utils/logger';
import { setupErrorHandlers } from '../utils/error';
import { notificationService } from '../services/notification.service';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

// Middleware
import { authMiddleware } from './middleware/auth';
import {
  loggingMiddleware,
  statsMiddleware,
  errorLoggingMiddleware,
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
  handleOpenPollButton,
} from './handlers/poll.handlers';
import { registerPaymentHandlers } from './handlers/payments.handlers';

// Events
import {
  setupGroupEvents,
  setupDefaultMenuButton,
} from './events/group-events';

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
    logger.warn(
      '⚠️  ВАЖНО: Прокси не настроен! Если Telegram API заблокирован, включите VPN или настройте прокси в .env'
    );
  }

  /* Экземпляр доступен сервисам через bot/bot-instance.ts — ниже он кладётся
     туда вызовом setBotInstance. Модульной переменной здесь больше нет:
     она обслуживала второй, одноимённый экспорт getBotInstance, у которого
     не было ни одного импортёра. */
  const bot = new Bot<BotContext>(botConfig.token, gramBotConfig);

  // 🚦 Phase 0 (G0-7): Proactive outbound throttle for Telegram Bot API.
  // Telegram limits: 30 msg/sec global, 1 msg/sec per chat, 20 msg/min per group.
  // Without this, notifyGroupMembersAboutStoreRun() / sendPollEndedNotification()
  // fan out Promise.all(sendMessage) and hit flood-limit on the first 30+ member
  // group. The throttler queues outbound calls so we stay under Telegram's quota
  // BEFORE auto-retry is even needed.
  //
  // ORDER MATTERS: throttler must be registered BEFORE auto-retry so retries
  // re-enter the throttle queue instead of stacking up against the limit.
  bot.api.config.use(
    apiThrottler({
      global: {
        reservoir: 30,
        reservoirRefreshAmount: 30,
        reservoirRefreshInterval: 1000,
      },
      group: {
        reservoir: 20,
        reservoirRefreshAmount: 20,
        reservoirRefreshInterval: 60_000,
      },
      out: { maxConcurrent: 1, minTime: 1000 },
    })
  );

  // 🔁 Auto-retry on transient Telegram API failures.
  // Honors RETRY_AFTER on 429 (flood limit) and retries 5xx / network errors
  // with exponential backoff. Caps total retries so a poisoned call cannot
  // hang a worker forever.
  bot.api.config.use(
    autoRetry({
      maxRetryAttempts: 3,
      maxDelaySeconds: 30,
    })
  );

  // Регистрируем типизированный синглтон — все сервисы читают из него
  setBotInstance(bot);

  // Настройка обработки ошибок
  setupErrorHandlers();

  // Инициализация notification service
  notificationService.initialize(bot);

  // ⚡ Инициализация Scheduler (использует синглтон через getBotInstance)
  const {
    PollSchedulerService,
  } = require('../services/poll-scheduler.service');
  PollSchedulerService.initialize(bot);

  // Глобальные middleware (применяются ко всем обновлениям)
  bot.use(session({ initial }));
  bot.use(loggingMiddleware);
  bot.use(errorLoggingMiddleware);
  bot.use(authMiddleware);
  bot.use(statsMiddleware);

  // Telegram Payments (Stars и т.п.) — регистрируем до message-handler'ов
  registerPaymentHandlers(bot);

  // Команды
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('menu', menuCommand);
  bot.command('app', appCommand);

  // Обработка callback queries
  bot.on('callback_query:data', async ctx => {
    const data = ctx.callbackQuery.data;

    try {
      // Обработка кнопки "Проголосовать" (Deep Linking)
      if (data.startsWith('openpoll:')) {
        const pollId = parseCallbackId(data, 1);
        if (!pollId) {
          await ctx.answerCallbackQuery(
            '❌ Не получилось открыть голосование. Обнови страницу.'
          );
          return;
        }
        await handleOpenPollButton(ctx as any, pollId);
        return;
      }

      // Opt-in «Я обедаю» из приветственного сообщения группы
      if (data.startsWith('optin_')) {
        const { handleOptInButton } = await import('./handlers/group.handlers');
        await handleOptInButton(ctx as any);
        return;
      }

      // Отмена голосования
      if (data.startsWith('cancel_poll:')) {
        const pollId = parseCallbackId(data, 1);
        if (!pollId) {
          await ctx.answerCallbackQuery(
            '❌ Не получилось открыть голосование. Обнови страницу.'
          );
          return;
        }
        await handleCancelPoll(ctx as any, pollId);
        return;
      }

      // Запуск рулетки
      if (data.startsWith('run_roulette:')) {
        const pollId = parseCallbackId(data, 1);
        if (!pollId) {
          await ctx.answerCallbackQuery(
            '❌ Не получилось открыть голосование. Обнови страницу.'
          );
          return;
        }
        await handleRunRoulette(ctx, pollId);
        return;
      }

      // Завершение голосования
      if (data.startsWith('complete_poll:')) {
        const pollId = parseCallbackId(data, 1);
        if (!pollId) {
          await ctx.answerCallbackQuery(
            '❌ Не получилось открыть голосование. Обнови страницу.'
          );
          return;
        }
        await handleCompletePoll(ctx as any, pollId);
        return;
      }

      // 🚀 НОВОЕ: Бюджет-трекер - Добровольный выбор ответственного
      if (data.startsWith('volunteer:')) {
        const pollId = parseCallbackId(data, 1);
        if (!pollId) {
          await ctx.answerCallbackQuery(
            '❌ Не получилось открыть голосование. Обнови страницу.'
          );
          return;
        }
        const { ResponsibleService } = await import(
          '../services/responsible.service.js'
        );
        const selected = await ResponsibleService.handleVolunteer(
          pollId,
          ctx.from.id
        );
        await ctx.answerCallbackQuery(
          selected
            ? '✅ Спасибо! Ты выбран ответственным'
            : '❌ Выбор уже завершён или ты не участвуешь в этом голосовании'
        );
        return;
      }

      // 🚀 НОВОЕ: Multi-category - Добровольный выбор для категории
      if (data.startsWith('volunteer_category:')) {
        const categoryOrderId = parseCallbackId(data, 1);
        if (!categoryOrderId) {
          await ctx.answerCallbackQuery(
            '❌ Не получилось открыть категорию. Обнови страницу.'
          );
          return;
        }
        const { MultiCategoryResponsibleService } = await import(
          '../services/multi-category-responsible.service.js'
        );
        const selected =
          await MultiCategoryResponsibleService.handleVolunteerForCategory(
            categoryOrderId,
            BigInt(ctx.from.id)
          );
        await ctx.answerCallbackQuery(
          selected
            ? '✅ Спасибо! Ты ответственный за эту категорию'
            : '❌ Категория уже назначена или ты не участвуешь в ней'
        );
        return;
      }

      // 🚀 НОВОЕ: Бюджет-трекер - Отметить оплату
      if (data.startsWith('budget:mark_paid:')) {
        const txId = parseCallbackId(data, 2);
        if (!txId) {
          await ctx.answerCallbackQuery(
            '❌ Не получилось открыть платёж. Обнови страницу.'
          );
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
          await ctx.answerCallbackQuery('❌ Отметить можно только свой долг');
          return;
        }

        await BudgetService.markAsPaid(txId, tx.fromUserId);
        await ctx.answerCallbackQuery('✅ Отмечено как оплачено');
        // Edit the message: remove button and add pending status line
        try {
          const originalText = ctx.callbackQuery.message?.text ?? '';
          const updatedText = `${originalText}\n\n⏳ Ожидаем подтверждения от ответственного...`;
          await ctx.editMessageText(updatedText, {
            reply_markup: { inline_keyboard: [] },
          });
        } catch (e) {
          /* ignore if edit fails */
        }
        return;
      }

      // 🚀 НОВОЕ: Бюджет-трекер - Подтвердить оплату
      if (data.startsWith('budget:confirm:')) {
        const txId = parseCallbackId(data, 2);
        if (!txId) {
          await ctx.answerCallbackQuery(
            '❌ Не получилось открыть платёж. Обнови страницу.'
          );
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
          await ctx.answerCallbackQuery(
            '❌ Подтвердить можно только перевод тебе'
          );
          return;
        }

        await BudgetService.confirmPayment(txId, tx.toUserId);
        await ctx.answerCallbackQuery('✅ Оплата подтверждена');
        try {
          await ctx.editMessageReplyMarkup({
            reply_markup: { inline_keyboard: [] },
          });
        } catch (e) {
          /* ignore */
        }
        return;
      }

      // Store run - должник отметил оплату всего своего заказа
      if (data.startsWith('budget:srun_paid:')) {
        const storeRunId = parseCallbackId(data, 2);
        if (!storeRunId) {
          await ctx.answerCallbackQuery(
            '❌ Не получилось открыть заказ. Обнови страницу.'
          );
          return;
        }
        const { StoreRunBudgetService } = await import('../services/store-run-budget.service.js');
        const result = await StoreRunBudgetService.markStoreRunPaidByDebtor(
          storeRunId,
          ctx.from.id
        );
        if (!result) {
          await ctx.answerCallbackQuery(
            '❌ Нет неоплаченных позиций по этому заказу'
          );
          return;
        }
        await ctx.answerCallbackQuery('✅ Отмечено как оплачено');
        try {
          const originalText = ctx.callbackQuery.message?.text ?? '';
          const updatedText = `${originalText}\n\n⏳ Ожидаем подтверждения от инициатора...`;
          await ctx.editMessageText(updatedText, {
            reply_markup: { inline_keyboard: [] },
          });
        } catch (e) {
          /* ignore if edit fails */
        }
        return;
      }

      // Store run - инициатор подтвердил оплату от должника
      if (data.startsWith('budget:srun_confirm:')) {
        const storeRunId = parseCallbackId(data, 2);
        const debtorUserId = parseCallbackId(data, 3);
        if (!storeRunId || !debtorUserId) {
          await ctx.answerCallbackQuery(
            '❌ Не получилось открыть платёж. Обнови страницу.'
          );
          return;
        }
        const { StoreRunBudgetService } = await import('../services/store-run-budget.service.js');
        const result = await StoreRunBudgetService.confirmStoreRunByDebtor(
          storeRunId,
          debtorUserId,
          ctx.from.id
        );
        if ('error' in result) {
          await ctx.answerCallbackQuery(
            result.error === 'forbidden'
              ? '❌ Подтвердить может только инициатор забега'
              : '❌ Нечего подтверждать'
          );
          return;
        }
        await ctx.answerCallbackQuery('✅ Оплата подтверждена');
        try {
          await ctx.editMessageReplyMarkup({
            reply_markup: { inline_keyboard: [] },
          });
        } catch (e) {
          /* ignore */
        }
        return;
      }

      // Бюджет-трекер - Ответственный подтверждает что все оплатили
      if (data.startsWith('budget:all_paid:')) {
        const pollId = parseCallbackId(data, 2);
        if (!pollId) {
          await ctx.answerCallbackQuery(
            '❌ Не получилось открыть голосование. Обнови страницу.'
          );
          return;
        }
        const { BudgetService } = await import('../services/budget.service.js');
        const { prisma } = await import('../database/client.js');

        // Проверяем что нажавший — ответственный (кредитор) по этому poll
        const tx = await prisma.transaction.findFirst({
          where: { pollId, toUser: { telegramId: BigInt(ctx.from.id) } },
        });
        if (!tx) {
          await ctx.answerCallbackQuery(
            '❌ Ты не ответственный по этому заказу'
          );
          return;
        }

        await BudgetService.markAllPaidByResponsible(pollId, tx.toUserId);
        await ctx.answerCallbackQuery('✅ Все транзакции подтверждены');
        try {
          await ctx.editMessageReplyMarkup({
            reply_markup: { inline_keyboard: [] },
          });
        } catch (e) {
          /* ignore */
        }
        return;
      }

      // Бюджет-трекер - Ответственный отправляет напоминания должникам
      if (data.startsWith('budget:remind:')) {
        const pollId = parseCallbackId(data, 2);
        if (!pollId) {
          await ctx.answerCallbackQuery(
            '❌ Не получилось открыть голосование. Обнови страницу.'
          );
          return;
        }
        const { ReminderService } = await import('../services/reminder.service.js');
        const { prisma } = await import('../database/client.js');

        // Проверяем что нажавший — ответственный по этому poll
        const tx = await prisma.transaction.findFirst({
          where: { pollId, toUser: { telegramId: BigInt(ctx.from.id) } },
        });
        if (!tx) {
          await ctx.answerCallbackQuery(
            '❌ Ты не ответственный по этому заказу'
          );
          return;
        }

        const resultMessage = await ReminderService.remindAllDebtors(
          pollId,
          tx.toUserId
        );
        await ctx.answerCallbackQuery(resultMessage.substring(0, 200)); // Telegram limit 200 chars
        return;
      }

      // ⚡ НОВОЕ: Recurring Polls - Отключить расписание
      if (data.startsWith('recurring:disable:')) {
        const scheduleId = parseCallbackId(data, 2);
        if (!scheduleId) {
          await ctx.answerCallbackQuery(
            '❌ Некорректный идентификатор расписания'
          );
          return;
        }
        const { PollSchedulerService } = await import(
          '../services/poll-scheduler.service.js'
        );

        try {
          const disabled = await PollSchedulerService.handleDisableCallback(
            scheduleId,
            ctx.from.id
          );
          if (!disabled) {
            await ctx.answerCallbackQuery(
              '❌ Расписание не найдено или нет прав администратора'
            );
            return;
          }
          await ctx.answerCallbackQuery(
            '✅ Автоматические голосования отключены'
          );
          await ctx.editMessageReplyMarkup({
            reply_markup: { inline_keyboard: [] },
          });
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
      await ctx.answerCallbackQuery('❌ Что-то пошло не так. Попробуй ещё раз');
    }
  });

  // Настройка обработчиков событий группы
  setupGroupEvents(bot);

  // Логируем готовность бота
  void bot.api.getMe().then(botInfo => {
    logger.info('🤖 Бот инициализирован', {
      id: botInfo.id,
      username: botInfo.username,
      firstName: botInfo.first_name,
      canJoinGroups: botInfo.can_join_groups,
      canReadAllGroupMessages: botInfo.can_read_all_group_messages,
      supportsInlineQueries: botInfo.supports_inline_queries,
    });

    // Настраиваем дефолтный Menu Button для личных чатов
    setupDefaultMenuButton(bot).catch((err: unknown) => {
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
      await bot.api.deleteWebhook({ drop_pending_updates: false });
      logger.info('✅ Webhook удален');
    } catch (webhookError: any) {
      // Игнорируем ошибки удаления webhook (VPN/прокси проблемы)
      logger.warn(
        '⚠️ Не удалось удалить webhook (пропускаем):',
        webhookError.message
      );
    }

    await bot.start({
      // Явно подписываемся на chat_member и chat_join_request — иначе Telegram
      // не присылает события о вступлении/выходе других участников группы.
      // Без этого приглашённый пользователь не попадает в GroupMember, пока
      // не напишет сообщение (см. authMiddleware).
      allowed_updates: [
        'message',
        'edited_message',
        'callback_query',
        'pre_checkout_query',
        'my_chat_member',
        'chat_member',
        'chat_join_request',
      ],
      onStart: botInfo => {
        logger.info('🚀 Бот запущен в polling режиме', {
          username: botInfo.username,
        });

        // ⚡ НОВОЕ: Запускаем scheduler для автоматических голосований
        const {
          PollSchedulerService,
        } = require('../services/poll-scheduler.service');
        void PollSchedulerService.start().catch((e: unknown) =>
          logger.error('Poll scheduler start failed', e)
        );
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
export async function setupWebhook(
  bot: Bot<BotContext>,
  webhookUrl: string,
  webhookSecret: string
): Promise<void> {
  try {
    await bot.api.setWebhook(webhookUrl, {
      drop_pending_updates: false,
      secret_token: webhookSecret,
      // Те же allowed_updates, что и для polling — нужно явно запрашивать
      // chat_member, иначе Telegram не присылает события о членах группы.
      allowed_updates: [
        'message',
        'edited_message',
        'callback_query',
        'pre_checkout_query',
        'my_chat_member',
        'chat_member',
        'chat_join_request',
      ],
    });

    logger.info('🌐 Webhook установлен');
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
    // ⚡ НОВОЕ: Останавливаем scheduler
    const {
      PollSchedulerService,
    } = require('../services/poll-scheduler.service');
    await PollSchedulerService.stop();
    logger.info('⚡ Poll scheduler остановлен');

    await bot.stop();
    logger.info('🛑 Бот остановлен');
  } catch (error) {
    logger.error('❌ Ошибка остановки бота:', error);
  }
}

