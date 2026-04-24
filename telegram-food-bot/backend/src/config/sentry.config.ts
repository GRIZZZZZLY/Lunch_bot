import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { logger } from '../utils/logger';

/**
 * Инициализация Sentry/GlitchTip для мониторинга ошибок в production
 * 
 * GlitchTip совместим с Sentry SDK, поэтому используем тот же код.
 * Просто укажите SENTRY_DSN с URL GlitchTip вместо Sentry.
 */
export function initSentry() {
  const sentryDsn = process.env.SENTRY_DSN || process.env.GLITCHTIP_DSN;
  const environment = process.env.NODE_ENV || 'development';
  const enableSentry = process.env.ENABLE_SENTRY === 'true' || process.env.ENABLE_GLITCHTIP === 'true';

  if (!enableSentry) {
    logger.info('Error tracking (Sentry/GlitchTip) отключен');
    return;
  }

  if (!sentryDsn) {
    logger.warn('SENTRY_DSN или GLITCHTIP_DSN не установлен. Error tracking недоступен.');
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
      nodeProfilingIntegration(),
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
        const env = event.contexts.runtime.env as any;
        delete env.TELEGRAM_BOT_TOKEN;
        delete env.JWT_SECRET;
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

  const serviceName = sentryDsn.includes('glitchtip') ? 'GlitchTip' : 'Sentry';
  logger.info(`✅ ${serviceName} инициализирован для окружения: ${environment}`);
}

/**
 * Capture exception в Sentry/GlitchTip
 */
export function captureException(error: Error, context?: Record<string, any>) {
  const enabled = process.env.ENABLE_SENTRY === 'true' || process.env.ENABLE_GLITCHTIP === 'true';
  if (enabled) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
  // Также логируем в обычный лог
  logger.error('Exception captured:', { error: error.message, stack: error.stack, context });
}

/**
 * Capture message в Sentry/GlitchTip
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) {
  const enabled = process.env.ENABLE_SENTRY === 'true' || process.env.ENABLE_GLITCHTIP === 'true';
  if (enabled) {
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
  const enabled = process.env.ENABLE_SENTRY === 'true' || process.env.ENABLE_GLITCHTIP === 'true';
  if (enabled) {
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
  const enabled = process.env.ENABLE_SENTRY === 'true' || process.env.ENABLE_GLITCHTIP === 'true';
  if (enabled) {
    Sentry.setUser(null);
  }
}
