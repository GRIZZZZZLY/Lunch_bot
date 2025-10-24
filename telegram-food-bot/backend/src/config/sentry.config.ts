import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { logger } from '../utils/logger';

/**
 * Инициализация Sentry для мониторинга ошибок в production
 */
export function initSentry() {
  const sentryDsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  const enableSentry = process.env.ENABLE_SENTRY === 'true';

  if (!enableSentry) {
    logger.info('Sentry мониторинг отключен');
    return;
  }

  if (!sentryDsn) {
    logger.warn('SENTRY_DSN не установлен. Sentry мониторинг недоступен.');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment,
    
    // Отслеживание производительности
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    
    // Профилирование
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
    integrations: [
      new ProfilingIntegration(),
    ],

    // Фильтрация чувствительных данных
    beforeSend(event, hint) {
      // Удаляем токены из данных
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['x-telegram-bot-token'];
      }

      // Удаляем чувствительные переменные окружения
      if (event.contexts?.runtime?.env) {
        delete event.contexts.runtime.env.TELEGRAM_BOT_TOKEN;
        delete event.contexts.runtime.env.JWT_SECRET;
      }

      return event;
    },

    // Игнорируем определенные ошибки
    ignoreErrors: [
      // Telegram API ошибки, которые мы уже логируем
      /Telegram API error/,
      /ETIMEDOUT/,
      /ECONNRESET/,
      // 404 ошибки
      /Not Found/,
      /404/,
    ],

    // Дополнительный контекст
    initialScope: {
      tags: {
        service: 'telegram-food-bot-backend',
      },
    },
  });

  logger.info(`✅ Sentry инициализирован для окружения: ${environment}`);
}

/**
 * Capture exception в Sentry
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (process.env.ENABLE_SENTRY === 'true') {
    Sentry.captureException(error, {
      extra: context,
    });
  }
  // Также логируем в обычный лог
  logger.error('Exception captured:', { error: error.message, stack: error.stack, context });
}

/**
 * Capture message в Sentry
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) {
  if (process.env.ENABLE_SENTRY === 'true') {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }
  logger.info(`Message captured: ${message}`, context);
}

/**
 * Set user context
 */
export function setUserContext(userId: number, username?: string) {
  if (process.env.ENABLE_SENTRY === 'true') {
    Sentry.setUser({
      id: userId.toString(),
      username,
    });
  }
}

/**
 * Clear user context
 */
export function clearUserContext() {
  if (process.env.ENABLE_SENTRY === 'true') {
    Sentry.setUser(null);
  }
}
