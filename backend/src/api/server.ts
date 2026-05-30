import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import crypto from 'crypto';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler, requestLogger } from './middleware/error-handler';
import { requestIdMiddleware } from './middleware/request-id';
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
import adminRoutes from './routes/admin.routes';
import categoryOrderRoutes from './routes/category-order.routes';
import sseRoutes from './routes/sse.routes';
import donationRoutes from './routes/donation.routes';

// Импорт middleware
import { metricsMiddleware } from './middleware/metrics';

/**
 * Настройка Express приложения
 */
export function createApiServer(): express.Application {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  const bodyLimit = process.env.API_BODY_LIMIT || '1mb';
  const trustProxyConfig = process.env.TRUST_PROXY ?? (isProduction ? '1' : 'false');

  if (trustProxyConfig === 'true') {
    app.set('trust proxy', true);
  } else if (trustProxyConfig === 'false') {
    app.set('trust proxy', false);
  } else {
    const trustProxyHops = Number.parseInt(trustProxyConfig, 10);
    app.set('trust proxy', Number.isNaN(trustProxyHops) ? 1 : trustProxyHops);
  }

  app.set('json replacer', (_key: string, value: unknown) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });

  // Базовые middleware
  app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
  });

  const scriptSrc = [
    "'self'",
    'https://telegram.org',
    (_req: any, res: any) => `'nonce-${res.locals.cspNonce}'`,
  ];

  if (!isProduction) {
    scriptSrc.push("'unsafe-eval'");
  }

  const connectSrc = [
    "'self'",
    'https://telegram.org',
    'https://t.me',
    'https://api.telegram.org',
    'https://*.sentry.io',
  ];

  if (!isProduction) {
    connectSrc.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'ws://localhost:3000',
      'ws://localhost:3001',
      'ws://localhost:5173'
    );
  }

  const cspReportUri = process.env.CSP_REPORT_URI;
  const cspDirectives: Record<string, any> = {
    defaultSrc: ["'self'", 'https://telegram.org'],
    scriptSrc,
    styleSrc: ["'self'", "'unsafe-inline'"],
    fontSrc: ["'self'", 'data:', 'https:'], // Разрешаем загрузку шрифтов
    imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
    connectSrc,
    frameSrc: ["'self'", 'https://telegram.org'],
  };

  if (cspReportUri) {
    cspDirectives.reportUri = [cspReportUri];
  }

  app.use(helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    } as any,
    crossOriginEmbedderPolicy: false, // Для iframe интеграции
  }));

  // Добавляем заголовок для обхода ngrok browser warning
  app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
  });

  // Compression (Brotli/Gzip) - добавляем ДО body parser
  app.use(compression({
    // Brotli compression (лучше gzip на 15-20%)
    filter: (req, res) => {
      // Не сжимаем SSE stream — это ломает стриминг
      if (req.path.includes('/stream')) {
        return false;
      }
      // Не сжимаем если клиент не поддерживает или уже сжато
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Используем стандартный фильтр compression
      return compression.filter(req, res);
    },
    threshold: 1024, // Сжимаем только файлы > 1KB
    level: 6, // Баланс между скоростью и степенью сжатия (0-9)
  }));

  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
  app.use(requestIdMiddleware);
  app.use(requestLogger);
  app.use(metricsMiddleware); // Отслеживание response time

  // Health & Monitoring endpoints (без префикса /api)
  app.use('/health', healthRoutes);

  // CORS только для API роутов
  app.use('/api', corsMiddleware);

  // SSE route — подключаем ДО rate-limit (долгоживущие соединения)
  app.use('/api', sseRoutes);

  if (apiConfig.security.enableRateLimit) {
    // Rate limiting для всех API запросов (Sprint 2 Security)
    app.use('/api', generalLimiter);

    // Строгий rate limiting для аутентификации
    app.use('/api/auth', authLimiter);
  } else {
    logger.warn('Rate limiting disabled via configuration');
  }

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
  app.use('/api/store-runs', require('./routes/store-run.routes').default);
  app.use('/api/gamification', gamificationRoutes);
  app.use('/api/seasons', seasonRoutes);
  app.use('/api/insights', insightsRoutes);
  app.use('/api/avatar', require('./routes/avatar.routes').default);
  app.use('/api/recurring', recurringPollRoutes);
  app.use('/api/admin', adminRoutes); // Admin panel endpoints
  app.use('/api/donations', donationRoutes); // Donation/support endpoints
  app.use('/api', categoryOrderRoutes); // Category order endpoints

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

  const frontendDir = process.env.FRONTEND_DIR || 'frontend';
  const frontendDistPath = path.join(projectRoot, frontendDir, 'dist');
  const frontendDistExists = require('fs').existsSync(frontendDistPath);

  logger.info(`CWD: ${cwd}`);
  logger.info(`Project root: ${projectRoot}`);
  logger.info(`Frontend dir: ${frontendDir}`);
  logger.info(`Frontend static path: ${frontendDistPath}`);
  logger.info(`Frontend dist exists: ${frontendDistExists}`);

  if (!frontendDistExists) {
    logger.error(`❌ ОШИБКА: ${frontendDir}/dist не найдена!`);
    logger.error(`Запустите сборку frontend: cd ${frontendDir} && npm run build`);
    throw new Error(`Frontend dist directory not found: ${frontendDistPath}`);
  }

  app.get('/manifest.webmanifest', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.sendFile(path.join(frontendDistPath, 'manifest.webmanifest'));
  });

  // Настройка кеширования для статических файлов
  app.use((req, res, next) => {
    const path = req.path;
    
    // HTML и service worker файлы - никогда не кэшировать
    if (path.endsWith('.html') || path === '/' || !path.includes('.') ||
        path === '/sw.js' || path.startsWith('/workbox-')) {
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
  app.use((req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }
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

  // Error handler (должен быть последним)
  app.use(errorHandler);

  logger.info('API сервер настроен', {
    corsOrigin: apiConfig.corsOrigin,
    uploadPath: apiConfig.uploadPath,
    maxFileSize: `${apiConfig.maxFileSizeMB}MB`,
    trustProxy: app.get('trust proxy'),
  });

  return app;
}

/**
 * Запуск API сервера
 */
export function startApiServer(app: express.Application): void {
  const port = apiConfig.port;
  const host = apiConfig.host;

  // 404 handler — регистрируется здесь чтобы маршруты добавленные после
  // createApiServer() (например /webhook) не перехватывались раньше времени
  app.use(notFoundHandler);

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
    logger.info('  GET  /api/polls/:id/stream - SSE real-time updates');
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
