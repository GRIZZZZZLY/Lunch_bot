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

// Загружаем переменные окружения
dotenv.config();

// 🔐 Sprint 3: Критические проверки безопасности
// В production приложение НЕ запустится с небезопасными настройками
runSecurityChecks();

// Инициализируем Sentry (должно быть сразу после dotenv.config)
initSentry();

// Инициализация
const bot = createBot();
const app = createApiServer();

// Инициализация PollService с экземпляром бота
initializePollServiceBot(bot);

// Инициализация FeedbackService с экземпляром бота
feedbackService.initialize(bot);

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Получен сигнал SIGINT, завершаем приложение...');
  
  try {
    await stopBot(bot);
    await disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Ошибка при завершении приложения:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('Получен сигнал SIGTERM, завершаем приложение...');
  
  try {
    await stopBot(bot);
    await disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Ошибка при завершении приложения:', error);
    process.exit(1);
  }
});

async function startApplication(): Promise<void> {
  try {
    logger.info('Запуск Telegram Food Bot...');
    
    // Проверка подключения к БД
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Не удалось подключиться к базе данных');
    }
    
    // Запуск бота - проверяем BOT_MODE вместо NODE_ENV!
    if (botConfig.mode === 'webhook' && botConfig.webhookUrl) {
      // Webhook режим
      logger.info('🌐 Запуск в webhook режиме');

      // ✅ FIX: Регистрируем роут webhook ДО запуска сервера
      app.post('/webhook', async (req, res) => {
        try {
          await bot.handleUpdate(req.body);
          res.sendStatus(200);
        } catch (error) {
          logger.error('Ошибка обработки webhook:', error);
          res.sendStatus(500);
        }
      });

      // Запускаем API сервер
      startApiServer(app);

      // Устанавливаем webhook в Telegram
      await setupWebhook(bot, botConfig.webhookUrl);
    } else {
      // Polling режим (по умолчанию)
      logger.info('🔄 Запуск в polling режиме');
      startApiServer(app);
      startPolling(bot);
    }

    logger.info('✅ Приложение успешно запущено');
    
  } catch (error) {
    logger.error('❌ Ошибка при запуске приложения:', error);
    process.exit(1);
  }
}

// Запуск приложения
startApplication();
