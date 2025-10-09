import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler, requestLogger } from './middleware/error-handler';
import { apiConfig } from '../config/api.config';
import { logger } from '../utils/logger';

// Импорт роутов
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import pollRoutes from './routes/poll.routes';
import userRoutes from './routes/user.routes';

/**
 * Настройка Express приложения
 */
export function createApiServer(): express.Application {
  const app = express();

  // Базовые middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Отключаем для Telegram WebApp
    crossOriginEmbedderPolicy: false, // Для iframe интеграции
  }));

  app.use(corsMiddleware);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestLogger);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
      },
    });
  });

  // API routes (БЕЗ префикса /api - proxy уже удаляет его)
  app.use('/auth', authRoutes);
  app.use('/menu', menuRoutes);
  app.use('/polls', pollRoutes);
  app.use('/user', userRoutes);

  app.use('/api/stats', (req, res) => {
    res.json({
      success: false,
      error: 'Endpoints для статистики в разработке',
      code: 'NOT_IMPLEMENTED',
      timestamp: new Date().toISOString(),
    });
  });

  // Статический контент (для будущего использования)
  app.use('/uploads', express.static(apiConfig.uploadPath));

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (должен быть последним)
  app.use(errorHandler);

  logger.info('API сервер настроен', {
    corsOrigin: apiConfig.corsOrigin,
    uploadPath: apiConfig.uploadPath,
    maxFileSize: `${apiConfig.maxFileSizeMB}MB`,
  });

  return app;
}

/**
 * Запуск API сервера
 */
export function startApiServer(app: express.Application): void {
  const port = apiConfig.port;
  const host = apiConfig.host;

  app.listen(port, host, () => {
    logger.info(`🚀 API сервер запущен на http://${host}:${port}`);
    logger.info('📋 Доступные endpoints:');
    logger.info('  GET  /health - проверка состояния');
    logger.info('  POST /api/auth/validate - валидация пользователя');
    logger.info('  GET  /api/auth/me - информация о пользователе');
    logger.info('  GET  /api/auth/status - статус авторизации');
    logger.info('  GET  /api/menu - список блюд');
    logger.info('  POST /api/menu - создание блюда');
    logger.info('  GET  /api/menu/:id - получение блюда');
    logger.info('  PUT  /api/menu/:id - обновление блюда');
    logger.info('  DELETE /api/menu/:id - удаление блюда');
    logger.info('  PATCH /api/menu/:id/toggle - переключение активности');
    logger.info('  GET  /api/polls/active - активные голосования');
    logger.info('  GET  /api/polls/:id - информация о голосовании');
    logger.info('  GET  /api/polls/:id/results - результаты голосования');
    logger.info('  GET  /api/polls/history - история голосований');
    logger.info('  GET  /api/polls/stats - статистика голосований');
    logger.info('  POST /api/polls - создание голосования');
    logger.info('  PATCH /api/polls/:id/complete - завершение голосования');
    logger.info('  PATCH /api/polls/:id/cancel - отмена голосования');
  });
}

/**
 * Graceful shutdown API сервера
 */
export function stopApiServer(server: any): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      logger.info('🛑 API сервер остановлен');
      resolve();
    });
  });
}
