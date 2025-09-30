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

    // Проверяем разрешенные домены
    const allowedOrigins = Array.isArray(apiConfig.corsOrigin) 
      ? [...apiConfig.corsOrigin] 
      : [apiConfig.corsOrigin];
    
    // В development режиме разрешаем localhost
    if (process.env.NODE_ENV === 'development') {
      const developmentOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
      ];
      allowedOrigins.push(...developmentOrigins);
    }

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

    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push(
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://localhost:5173',
        'https://127.0.0.1:5173'
      );
    }

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
