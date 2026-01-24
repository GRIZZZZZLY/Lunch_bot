import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler, requestLogger } from './middleware/error-handler';
import { generalLimiter, authLimiter } from './middleware/rate-limiter';
import { apiConfig } from '../config/api.config';
import { logger } from '../utils/logger';

// Импорт роутов
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import menuSuggestionRoutes from './routes/menu-suggestion.routes';
import pollRoutes from './routes/poll.routes';
import userRoutes from './routes/user.routes';
import budgetRoutes from './routes/budget.routes';
import metricsRoutes from './routes/metrics.routes';
import healthRoutes from './routes/health.routes';
import testRoutes from './routes/test.routes';
import feedbackRoutes from './routes/feedback.routes';
import gamificationRoutes from './routes/gamification.routes';
import seasonRoutes from './routes/season.routes';
import insightsRoutes from './routes/insights.routes';
import recurringPollRoutes from './routes/recurring-poll.routes';

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

  // Rate limiting для всех API запросов (Sprint 2 Security)
  app.use('/api', generalLimiter);

  // Строгий rate limiting для аутентификации
  app.use('/api/auth', authLimiter);

  // API routes с префиксом /api
  app.use('/api/auth', authRoutes);
  app.use('/api/menu', menuRoutes);
  app.use('/api/suggestions', menuSuggestionRoutes);
  app.use('/api/polls', pollRoutes);
  app.use('/api/votes', require('./routes/vote.routes').default);
  app.use('/api/user', userRoutes);
  app.use('/api/budget', budgetRoutes);
  app.use('/api/metrics', metricsRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/notifications', require('./routes/notification.routes').default);
  app.use('/api/gamification', gamificationRoutes);
  app.use('/api/seasons', seasonRoutes);
  app.use('/api/insights', insightsRoutes);
  app.use('/api/avatar', require('./routes/avatar.routes').default);
  app.use('/api/recurring', recurringPollRoutes);

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
  // ИСПРАВЛЕНИЕ: Используем process.cwd() - надёжнее чем __dirname
  // process.cwd() всегда указывает на директорию, откуда запущен процесс

  // Если запускаем из backend/ → cwd = backend, нужно подняться на 1 уровень
  // Если запускаем из корня проекта → cwd уже корень
  const cwd = process.cwd();
  const isInBackendDir = cwd.endsWith('backend') || cwd.endsWith('backend\\');
  const projectRoot = isInBackendDir ? path.join(cwd, '..') : cwd;

  const frontendDistPath = path.join(projectRoot, 'frontend', 'dist');
  const frontendDistExists = require('fs').existsSync(frontendDistPath);

  logger.info(`CWD: ${cwd}`);
  logger.info(`Project root: ${projectRoot}`);
  logger.info(`Frontend static path: ${frontendDistPath}`);
  logger.info(`Frontend dist exists: ${frontendDistExists}`);

  // КРИТИЧНО: Проверяем что frontend/dist существует
  if (!frontendDistExists) {
    logger.error('❌ ОШИБКА: frontend/dist не найдена!');
    logger.error('Запустите сборку frontend: cd frontend && npm run build');
    throw new Error(`Frontend dist directory not found: ${frontendDistPath}`);
  }

  // Настройка кеширования для статических файлов
  app.use((req, res, next) => {
    const path = req.path;
    
    // HTML файлы - всегда проверяем на сервере (no-cache)
    if (path.endsWith('.html') || path === '/' || !path.includes('.')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // JS и CSS с хешами в имени - долгое кеширование (immutable)
    else if (/\.(js|css)$/.test(path) && /-[a-f0-9]{8}\.(js|css)$/.test(path)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // Остальные JS/CSS - короткое кеширование
    else if (/\.(js|css)$/.test(path)) {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate'); // 1 час
    }
    // Изображения и шрифты - долгое кеширование
    else if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(path)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 дней
    }
    // Все остальное - короткое кеширование
    else {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 час
    }
    
    // Добавляем заголовок версии приложения
    res.setHeader('X-App-Version', '2.0.1');
    
    next();
  });
  
  app.use(express.static(frontendDistPath, {
    maxAge: 0, // Управляем через middleware выше
    etag: true, // Включаем ETag для проверки изменений
    lastModified: true, // Включаем Last-Modified
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
