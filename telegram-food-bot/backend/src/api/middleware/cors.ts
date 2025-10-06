import cors from 'cors';
import { apiConfig } from '../../config/api.config';
import { logger } from '../../utils/logger';

/**
 * Настройка CORS для API
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (например, мобильные приложения)
    if (!origin) {
      return callback(null, true);
    }

    // В development режиме разрешаем все origins (для работы с ngrok)
    if (process.env.NODE_ENV === 'development') {
      logger.debug('CORS: development режим, разрешаем все origins', { origin });
      return callback(null, true);
    }

    // Проверяем разрешенные домены в production
    const allowedOrigins = Array.isArray(apiConfig.cors.origin) 
      ? [...apiConfig.cors.origin] 
      : [apiConfig.cors.origin];

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      logger.warn('CORS заблокировал запрос', { origin, allowedOrigins });
      callback(new Error('Запрос заблокирован CORS политикой'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
  ],
  credentials: true,
  maxAge: 86400, // 24 часа
  optionsSuccessStatus: 200,
});

/**
 * Настройка CORS специально для Telegram WebApp
 */
export const telegramCorsMiddleware = cors({
  origin: (origin, callback) => {
    // Telegram WebApp может не отправлять origin
    if (!origin) {
      return callback(null, true);
    }

    // В development режиме разрешаем все origins
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Telegram CORS: development режим, разрешаем все origins', { origin });
      return callback(null, true);
    }

    // Разрешенные домены для Telegram
    const telegramOrigins = [
      'https://web.telegram.org',
      'https://k.web.telegram.org',
      'https://z.web.telegram.org',
      'https://a.web.telegram.org',
    ];

    // Добавляем настроенные домены
    const configOrigins = Array.isArray(apiConfig.corsOrigin) 
      ? apiConfig.corsOrigin 
      : [apiConfig.corsOrigin];
    const allowedOrigins = [...configOrigins, ...telegramOrigins];

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      logger.warn('Telegram CORS заблокировал запрос', { origin });
      callback(null, true); // Для Telegram WebApp все равно разрешаем
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Telegram-Bot-Api-Secret-Token',
  ],
  credentials: false, // Telegram WebApp не поддерживает credentials
  maxAge: 3600, // 1 час
});
