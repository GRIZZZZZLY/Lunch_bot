import dotenv from 'dotenv';
import { testConnection, disconnect } from './database/client';
import { logger } from './utils/logger';
import { initSentry } from './config/sentry.config';
import { botConfig } from './config/bot.config';
import { createBot, startPolling, setupWebhook, stopBot } from './bot/bot';
import { createApiServer, startApiServer } from './api/server';
import { initializePollServiceBot } from './services/poll.service.extensions';
import { feedbackService } from './services/feedback.service';
import { runSecurityChecks } from './utils/security-checks';
import { validateEnv } from './utils/env';
import { initDebtReminderJob } from './jobs/debt-reminder.job';
import { initStoreRunAutoCloseJob } from './jobs/store-run-autoclose.job';

// Загружаем переменные окружения
dotenv.config();

// 🛡️ Boot-time env schema validation. Fails fast if required vars are
// missing or malformed (e.g. non-numeric API_PORT, malformed BOT_TOKEN).
// Must run AFTER dotenv.config() and BEFORE any module that reads env.
validateEnv();

// 🔐 Sprint 3: Критические проверки безопасности
// В production приложение НЕ запустится с небезопасными настройками
runSecurityChecks();

// Инициализируем Sentry (должно быть сразу после dotenv.config)
initSentry();

// P2-1: split monolith preparation.
// Один и тот же index.ts работает в трёх режимах через env:
//   PROCESS_ROLE=full   (default)  — полный монолит (bot + api + jobs).
//   PROCESS_ROLE=api    — только API сервер (без bot polling и cron'ов).
//   PROCESS_ROLE=bot    — только bot + cron-jobs (без HTTP-сервера).
//
// Это нужно для будущего PM2 split (когда G0-9 Redis prod закрыт и api/bot
// можно гонять как раздельные процессы). Сейчас по умолчанию остаётся 'full'
// — старое поведение, ничего не ломается.
const PROCESS_ROLE = (process.env.PROCESS_ROLE ?? 'full') as 'full' | 'api' | 'bot';
const RUN_BOT = PROCESS_ROLE === 'full' || PROCESS_ROLE === 'bot';
const RUN_API = PROCESS_ROLE === 'full' || PROCESS_ROLE === 'api';
logger.info(`🧩 PROCESS_ROLE=${PROCESS_ROLE} (bot=${RUN_BOT}, api=${RUN_API})`);

// Инициализация
const bot = RUN_BOT ? createBot() : null;
const app = RUN_API ? createApiServer() : null;

if (bot) {
  // Инициализация PollService с экземпляром бота
  initializePollServiceBot(bot);

  // Инициализация FeedbackService с экземпляром бота
  feedbackService.initialize(bot);

  // Инициализация cron job для автоматических напоминаний о долгах
  initDebtReminderJob();

  // Cron для авто-закрытия магазинных забегов ("Иду в магазин") по истечении таймера
  initStoreRunAutoCloseJob();
}

// Graceful shutdown — single orchestrator, idempotent, hard-cap at 10s.
let shuttingDown = false;
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function gracefulShutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Получен сигнал ${signal}, завершаем приложение...`);

  // Force-exit after SHUTDOWN_TIMEOUT_MS so a stuck bot.stop() / DB
  // disconnect cannot block the process forever (PM2/systemd then restart).
  const forceTimer = setTimeout(() => {
    logger.error(`Graceful shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  try {
    if (bot) await stopBot(bot);
    await disconnect();
    clearTimeout(forceTimer);
    process.exit(0);
  } catch (error) {
    logger.error('Ошибка при завершении приложения:', error);
    clearTimeout(forceTimer);
    process.exit(1);
  }
}

process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });
process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });

async function startApplication(): Promise<void> {
  try {
    logger.info('Запуск Telegram Food Bot...');
    
    // Проверка подключения к БД
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Не удалось подключиться к базе данных');
    }
    
    // P2-1: split monolith — каждый ROLE стартует только свои части.
    if (botConfig.mode === 'webhook' && botConfig.webhookUrl && bot && app) {
      // Webhook режим: ROLE=full — webhook handler в том же процессе.
      logger.info('🌐 Запуск в webhook режиме');

      app.post('/webhook', async (req, res) => {
        try {
          await bot.handleUpdate(req.body);
          res.sendStatus(200);
        } catch (error) {
          logger.error('Ошибка обработки webhook:', error);
          res.sendStatus(500);
        }
      });

      startApiServer(app);
      await setupWebhook(bot, botConfig.webhookUrl);
    } else {
      // Polling / API-only / Bot-only режимы.
      logger.info('🔄 Запуск в polling режиме');
      if (app) startApiServer(app);
      if (bot) startPolling(bot);
    }

    logger.info('✅ Приложение успешно запущено');

    // P0-3: сигнализируем PM2 что воркер готов принимать трафик.
    // ecosystem.config.js имеет wait_ready: true — без этого вызова PM2 ждёт
    // listen_timeout (10s) по таймауту, и rolling-reload фактически даёт
    // короткое окно недоступности. С process.send('ready') reload бесшовный.
    if (typeof process.send === 'function') {
      process.send('ready');
    }

  } catch (error) {
    logger.error('❌ Ошибка при запуске приложения:', error);
    process.exit(1);
  }
}

// Запуск приложения
startApplication();
