import dotenv from 'dotenv';
import { testConnection, disconnect } from './database/client';
import { logger } from './utils/logger';
import { initSentry } from './config/sentry.config';
import { botConfig } from './config/bot.config';
import { createBot, startPolling, setupWebhook, stopBot } from './bot/bot';
import { createApiServer, startApiServer } from './api/server';
import { initializePollServiceBot } from './services/poll.service.extensions';

// Загружаем переменные окружения
dotenv.config();

// Инициализируем Sentry (должно быть сразу после dotenv.config)
initSentry();

// Инициализация
const bot = createBot();
const app = createApiServer();

// Инициализация PollService с экземпляром бота
initializePollServiceBot(bot);

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
    
    // Запуск бота
    // Запуск API сервера СНАЧАЛА
    startApiServer(app);
    
    if (process.env.NODE_ENV === 'production' && botConfig.webhookUrl) {
      // Production: webhook режим
      await setupWebhook(bot, botConfig.webhookUrl);
      
      // Обработчик webhook
      app.use(`/webhook`, async (req, res) => {
        try {
          await bot.handleUpdate(req.body);
          res.sendStatus(200);
        } catch (error) {
          logger.error('Ошибка обработки webhook:', error);
          res.sendStatus(500);
        }
      });
    } else {
      // Development: polling режим (запускаем БЕЗ await)
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
