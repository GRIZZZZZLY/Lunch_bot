import cors from 'cors';
import { apiConfig } from '../../config/api.config';
import { logger } from '../../utils/logger';
import { AuthorizationError } from '../../utils/error';

/**
 * Настройка CORS для API
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (например, мобильные приложения)
    if (!origin) {
      return callback(null, true);
    }

    // Получаем разрешенные домены из конфига
    const configAllowedOrigins = Array.isArray(apiConfig.cors.origin) 
      ? [...apiConfig.cors.origin] 
      : [apiConfig.cors.origin];

    // 🔐 SECURITY FIX: Даже в development проверяем origins
    // Разрешаем localhost + ngrok URLs из конфига
    if (process.env.NODE_ENV === 'development') {
      const devOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
        'http://localhost:3000',
        ...configAllowedOrigins,
      ];

      // Разрешаем ngrok URLs (содержат .ngrok) и любой localhost/127.0.0.1 в dev (любой порт Vite)
      const isNgrok = origin.includes('.ngrok');
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      const isAllowed = devOrigins.includes(origin) || isNgrok || isLocalhost;
      
      if (isAllowed) {
        logger.debug('CORS: development режим, origin разрешен', { origin });
        return callback(null, true);
      }
      
      logger.warn('CORS: development режим, origin ЗАБЛОКИРОВАН', { origin, allowedOrigins: devOrigins });
      return callback(
        new AuthorizationError('Origin запрещён политикой CORS')
      );
    }

    // Проверяем разрешенные домены в production
    if (configAllowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS заблокировал запрос', { origin, allowedOrigins: configAllowedOrigins });
      callback(new AuthorizationError('Origin запрещён политикой CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Idempotency-Key',
    'X-Operations-Secret',
    'X-Request-ID',
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

    // Получаем разрешенные домены из конфига
    const configOrigins = apiConfig.corsOrigin
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

    // 🔐 SECURITY FIX: Telegram CORS тоже проверяем в development
    if (process.env.NODE_ENV === 'development') {
      const isNgrok = origin.includes('.ngrok');
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
      const isTelegram = origin.includes('telegram.org');
      
      if (isNgrok || isLocalhost || isTelegram || configOrigins.includes(origin)) {
        logger.debug('Telegram CORS: development режим, origin разрешен', { origin });
        return callback(null, true);
      }
      
      logger.warn('Telegram CORS: development режим, origin ЗАБЛОКИРОВАН', { origin });
      return callback(
        new AuthorizationError('Origin запрещён политикой CORS')
      );
    }

    // Разрешенные домены для Telegram
    const telegramOrigins = [
      'https://web.telegram.org',
      'https://k.web.telegram.org',
      'https://z.web.telegram.org',
      'https://a.web.telegram.org',
    ];

    // Объединяем настроенные домены и Telegram домены
    const allowedOrigins = [...configOrigins, ...telegramOrigins];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('Telegram CORS заблокировал запрос', { origin });
      callback(new AuthorizationError('Origin запрещён политикой CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Idempotency-Key',
    'X-Operations-Secret',
    'X-Request-ID',
    'X-Telegram-Bot-Api-Secret-Token',
  ],
  credentials: false, // Telegram WebApp не поддерживает credentials
  maxAge: 3600, // 1 час
});
