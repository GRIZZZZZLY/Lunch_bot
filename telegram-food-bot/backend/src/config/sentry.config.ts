import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { logger } from '../utils/logger';

const SENSITIVE_SENTRY_KEY =
  /^(authorization|cookie|set-cookie|.*token.*|.*secret.*|password|initdata.*|telegramid|chatid|username|firstname|lastname|photourl|payment(card|phone|details)?|phone|cardnumber|invoicepayload|.*chargeid)$/i;

function scrubSensitiveData(value: unknown, depth: number = 0): unknown {
  if (depth > 8) return '[Truncated]';
  if (Array.isArray(value)) {
    return value.map(item => scrubSensitiveData(item, depth + 1));
  }
  if (!value || typeof value !== 'object') return value;

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = SENSITIVE_SENTRY_KEY.test(key)
      ? '[Filtered]'
      : scrubSensitiveData(nested, depth + 1);
  }
  return result;
}

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

  // P0-6: release tag = git SHA (или версия из package.json как fallback).
  // Sentry группирует регрессии по release; без тега любой p95-выброс непонятно
  // в какой деплой попадает. SENTRY_RELEASE можно проставить из CI:
  //   SENTRY_RELEASE=$(git rev-parse --short HEAD) pm2 reload
  const release =
    process.env.SENTRY_RELEASE ||
    process.env.GIT_COMMIT_SHA ||
    process.env.npm_package_version ||
    undefined;

  Sentry.init({
    dsn: sentryDsn,
    environment,
    release,

    // Отслеживание производительности
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

    // Профилирование
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
    integrations: [
      nodeProfilingIntegration(),
    ],

    // Фильтрация чувствительных данных
    beforeSend(event) {
      // P0-6: расширенный PII скраб.
      // Auth headers
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, unknown>;
        for (const key of [
          'authorization',
          'cookie',
          'set-cookie',
          'x-telegram-bot-token',
          'x-telegram-init-data',
          'x-telegram-bot-api-secret-token',
          'idempotency-key',
        ]) {
          delete h[key];
        }
      }

      if (event.request?.url) {
        event.request.url = event.request.url.split('?')[0];
      }

      // Чувствительные env-переменные
      if (event.contexts?.runtime?.env) {
        const env = event.contexts.runtime.env as any;
        for (const key of [
          'TELEGRAM_BOT_TOKEN',
          'BOT_TOKEN',
          'JWT_SECRET',
          'DATABASE_URL',
          'SENTRY_DSN',
          'GLITCHTIP_DSN',
          'REDIS_URL',
          'DB_PASSWORD',
        ]) {
          delete env[key];
        }
      }

      // Параметры запроса/body иногда содержат telegramId, username — для
      // ошибок этого достаточно как контекст, но НЕ для PII-полей вроде phone.
      if (event.request?.data) {
        event.request.data = scrubSensitiveData(event.request.data);
      }
      event.extra = scrubSensitiveData(event.extra) as typeof event.extra;
      event.contexts = scrubSensitiveData(
        event.contexts
      ) as typeof event.contexts;
      if (event.user) {
        event.user = event.user.id ? { id: event.user.id } : undefined;
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
export function setUserContext(userId: number, _username?: string) {
  const enabled = process.env.ENABLE_SENTRY === 'true' || process.env.ENABLE_GLITCHTIP === 'true';
  if (enabled) {
    Sentry.setUser({
      id: userId.toString(),
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
