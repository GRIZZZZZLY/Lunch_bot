import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler, requestLogger } from './middleware/error-handler';
import { apiConfig } from '../config/api.config';
import { logger } from '../utils/logger';

// Импорт роутов
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import pollRoutes from './routes/poll.routes';
import userRoutes from './routes/user.routes';
import budgetRoutes from './routes/budget.routes';
import metricsRoutes from './routes/metrics.routes';
import healthRoutes from './routes/health.routes';
import testRoutes from './routes/test.routes';
import feedbackRoutes from './routes/feedback.routes';

// Импорт middleware
import { metricsMiddleware } from './middleware/metrics';

/**
 * Настройка Express приложения
 */
export function createApiServer(): express.Application {
  const app = express();

  // Глобальный фикс для BigInt сериализации
  (BigInt.prototype as any).toJSON = function() {
    return this.toString();
  };

  // Базовые middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", 'https://telegram.org'],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://telegram.org'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:', 'https:'], // Разрешаем загрузку шрифтов
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
        frameSrc: ["'self'", 'https://telegram.org'],
      },
    },
    crossOriginEmbedderPolicy: false, // Для iframe интеграции
  }));

  // Добавляем заголовок для обхода ngrok browser warning
  app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestLogger);
  app.use(metricsMiddleware); // Отслеживание response time

  // Health & Monitoring endpoints (без префикса /api)
  app.use('/health', healthRoutes);

  // CORS только для API роутов
  app.use('/api', corsMiddleware);

  // API routes с префиксом /api
  app.use('/api/auth', authRoutes);
  app.use('/api/menu', menuRoutes);
  app.use('/api/polls', pollRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/budget', budgetRoutes);
  app.use('/api/metrics', metricsRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/notifications', require('./routes/notification.routes').default);

  // Test endpoints (только для dev/staging)
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/test', testRoutes);
    logger.info('Test endpoints enabled (dev/staging mode)');
  }

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

  // Production: Раздача frontend статики из dist/
  // Определяем корень проекта независимо от режима (dev/prod)
  // В dev (tsx): __dirname = backend/src/api → ../../.. = корень
  // В prod: __dirname = backend/dist/api → ../../.. = корень
  const projectRoot = path.join(__dirname, '../../..');
  const frontendDistPath = path.join(projectRoot, 'frontend/dist');
  
  logger.info(`Frontend static path: ${frontendDistPath}`);
  
  // Добавляем заголовки no-cache для статики (чтобы браузер не кэшировал при разработке)
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  
  app.use(express.static(frontendDistPath, {
    maxAge: 0,
    etag: false,
  }));

  // Fallback на index.html для React Router (SPA)
  app.get('*', (req, res, next) => {
    // Пропускаем API запросы
    if (req.path.startsWith('/api/')) {
      return next();
    }
    // Отправляем index.html для всех остальных запросов
    res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
      if (err) {
        next(err);
      }
    });
  });

  // 404 handler (для API запросов)
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
    logger.info('📋 Monitoring endpoints:');
    logger.info('  GET  /health - проверка состояния');
    logger.info('  GET  /health/ready - readiness check');
    logger.info('  GET  /health/live - liveness check');
    logger.info('  GET  /api/metrics - метрики приложения');
    logger.info('  GET  /api/metrics/detailed - детальная статистика');
    logger.info('  GET  /dashboard.html - monitoring dashboard');
    logger.info('');
    logger.info('📋 Main API endpoints:');
    logger.info('  POST /api/auth/validate - валидация пользователя');
    logger.info('  GET  /api/menu - список блюд');
    logger.info('  GET  /api/polls/active - активные голосования');
    logger.info('  GET  /api/budget/debts - долги пользователя');
    logger.info('');
    if (process.env.NODE_ENV !== 'production') {
      logger.info('🧪 Test endpoints (dev/staging):');
      logger.info('  GET  /api/test/sentry-error - тест Sentry error');
      logger.info('  GET  /api/test/sentry-message - тест Sentry message');
      logger.info('');
    }
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
