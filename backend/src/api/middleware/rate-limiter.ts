/**
 * Rate Limiting Middleware - Sprint 2 Security
 * 
 * Защита от DDoS и брутфорса через ограничение количества запросов
 */

import rateLimit, {
  RateLimitRequestHandler,
  ipKeyGenerator as rateLimitIpKeyGenerator,
} from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { apiConfig } from '../../config/api.config';
import { logger } from '../../utils/logger';

/**
 * Стандартный формат ответа при превышении лимита
 */
const rateLimitResponse = (req: Request, res: Response) => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    path: req.path,
    userId: (req as any).user?.id,
  });

  res.status(429).json({
    success: false,
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Слишком много запросов. Пожалуйста, подождите.',
    retryAfter: res.getHeader('Retry-After'),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Ключ для rate limiting - используем userId если есть, иначе IP
 * FIX: Отключаем валидацию IPv6 так как мы используем userId как primary key
 */
const keyGenerator = (req: Request, res: Response): string => {
  const user = (req as any).user;
  if (user?.id) {
    return `user_${user.id}`;
  }
  // Fallback на IP (используем 'unknown' если IP недоступен)
  const ip = req.ip;
  if (!ip) {
    return 'unknown';
  }
  return rateLimitIpKeyGenerator(ip);
};

/**
 * Ключ только по IP для auth endpoints
 */
const ipKeyGenerator = (req: Request, res: Response): string => {
  const ip = req.ip;
  if (!ip) {
    return 'unknown';
  }
  return rateLimitIpKeyGenerator(ip);
};

const noopLimiter = Object.assign(
  (_req: Request, _res: Response, next: NextFunction) => {
    next();
  },
  {
    resetKey: () => undefined,
    getKey: () => undefined,
  }
) as RateLimitRequestHandler;

/**
 * Общий лимит для всех API запросов
 * 100 запросов в минуту на пользователя/IP
 */
export const generalLimiter: RateLimitRequestHandler =
  apiConfig.security.enableRateLimit
    ? rateLimit({
        windowMs: apiConfig.security.rateLimitWindowMs,
        max: apiConfig.security.rateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        handler: rateLimitResponse,
        skip: (req) => {
          // Пропускаем health check, SSE stream и polling endpoints
          return req.path.startsWith('/health')
            || req.path.includes('/stream')
            || (req.method === 'GET' && req.path.includes('/category-orders'));
        },
        validate: { xForwardedForHeader: true },
      })
    : noopLimiter;

/**
 * Строгий лимит для аутентификации
 * Production: 10 попыток в 15 минут (защита от брутфорса)
 * Development: 50 попыток в 5 минут (для удобства тестирования)
 */
export const authLimiter: RateLimitRequestHandler =
  apiConfig.security.enableRateLimit
    ? rateLimit({
        windowMs: apiConfig.security.authRateLimitWindowMs,
        max: apiConfig.security.authRateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator, // По userId если авторизован, иначе по IP
        handler: (req, res) => {
          logger.warn('Auth rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            environment: process.env.NODE_ENV,
          });

          const waitMinutes = Math.ceil(
            apiConfig.security.authRateLimitWindowMs / (60 * 1000)
          );
          res.status(429).json({
            success: false,
            error: 'Too many authentication attempts',
            code: 'AUTH_RATE_LIMIT',
            message: `Слишком много попыток входа. Подождите ${waitMinutes} минут.`,
            retryAfter: res.getHeader('Retry-After'),
            timestamp: new Date().toISOString(),
          });
        },
        validate: { xForwardedForHeader: true },
      })
    : noopLimiter;

/**
 * Лимит для операций записи (POST, PUT, PATCH, DELETE)
 * 30 запросов в минуту
 */
export const writeLimiter: RateLimitRequestHandler =
  apiConfig.security.enableRateLimit
    ? rateLimit({
        windowMs: 60 * 1000, // 1 минута
        max: 30, // 30 запросов
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        handler: rateLimitResponse,
        skip: (req) => {
          // Применяем только к методам записи
          return !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
        },
        validate: { xForwardedForHeader: true },
      })
    : noopLimiter;

/**
 * Лимит для голосования
 * 20 голосов в минуту (защита от спама)
 */
export const voteLimiter: RateLimitRequestHandler =
  apiConfig.security.enableRateLimit
    ? rateLimit({
        windowMs: 60 * 1000, // 1 минута
        max: 20, // 20 голосов
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        handler: (req, res) => {
          logger.warn('Vote rate limit exceeded', {
            ip: req.ip,
            userId: (req as any).user?.id,
          });

          res.status(429).json({
            success: false,
            error: 'Too many votes',
            code: 'VOTE_RATE_LIMIT',
            message: 'Слишком много голосов. Подождите немного.',
            retryAfter: res.getHeader('Retry-After'),
            timestamp: new Date().toISOString(),
          });
        },
        validate: { xForwardedForHeader: true },
      })
    : noopLimiter;

/**
 * Лимит для создания голосований
 * 5 голосований в час (защита от спама)
 */
export const pollCreationLimiter: RateLimitRequestHandler =
  apiConfig.security.enableRateLimit
    ? rateLimit({
        windowMs: 60 * 60 * 1000, // 1 час
        max: 5, // 5 голосований
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        handler: (req, res) => {
          logger.warn('Poll creation rate limit exceeded', {
            ip: req.ip,
            userId: (req as any).user?.id,
          });

          res.status(429).json({
            success: false,
            error: 'Too many polls created',
            code: 'POLL_CREATION_LIMIT',
            message: 'Достигнут лимит создания голосований. Подождите час.',
            retryAfter: res.getHeader('Retry-After'),
            timestamp: new Date().toISOString(),
          });
        },
        validate: { xForwardedForHeader: true },
      })
    : noopLimiter;

/**
 * Лимит для отправки напоминаний
 * 10 напоминаний в час
 */
export const reminderLimiter: RateLimitRequestHandler =
  apiConfig.security.enableRateLimit
    ? rateLimit({
        windowMs: 60 * 60 * 1000, // 1 час
        max: 10, // 10 напоминаний
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        handler: (req, res) => {
          logger.warn('Reminder rate limit exceeded', {
            ip: req.ip,
            userId: (req as any).user?.id,
          });

          res.status(429).json({
            success: false,
            error: 'Too many reminders sent',
            code: 'REMINDER_RATE_LIMIT',
            message: 'Достигнут лимит отправки напоминаний. Подождите час.',
            retryAfter: res.getHeader('Retry-After'),
            timestamp: new Date().toISOString(),
          });
        },
        validate: { xForwardedForHeader: true },
      })
    : noopLimiter;

/**
 * Лимит для тяжёлых операций (отчёты, статистика)
 * 10 запросов в минуту
 */
export const heavyOperationLimiter: RateLimitRequestHandler =
  apiConfig.security.enableRateLimit
    ? rateLimit({
        windowMs: 60 * 1000, // 1 минута
        max: 10, // 10 запросов
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        handler: rateLimitResponse,
        validate: { xForwardedForHeader: true },
      })
    : noopLimiter;
