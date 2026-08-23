/**
 * Boot-time environment validation.
 *
 * Validates all required env vars with zod at startup. Fails fast (process.exit(1))
 * on missing/invalid values rather than crashing later in some random handler.
 *
 * Use the exported `env` object instead of `process.env.X` for type-safe access:
 *   import { env } from './utils/env';
 *   env.API_PORT  // number, validated
 *
 * Direct process.env access is still allowed but unvalidated.
 */
import { z } from 'zod';
import { logger } from './logger';

const NodeEnv = z.enum(['development', 'production', 'test']);
const optionalValue = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    value =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    schema.optional()
  );

const EnvSchema = z
  .object({
    // Runtime mode
    NODE_ENV: NodeEnv.default('development'),
    PROCESS_ROLE: z.enum(['full', 'api', 'bot']).default('full'),

    // Telegram
    BOT_TOKEN: z
      .string()
      .regex(/^\d+:[A-Za-z0-9_-]+$/, 'BOT_TOKEN must match <id>:<secret>'),
    BOT_MODE: z.enum(['webhook', 'polling']).default('polling'),
    BOT_WEBHOOK_URL: optionalValue(z.string().url()),
    TELEGRAM_WEBHOOK_SECRET: optionalValue(
      z.string().regex(/^[A-Za-z0-9_-]{32,256}$/)
    ),
    TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(86400)
      .default(300),
    WEBAPP_URL: optionalValue(z.string().url()),
    TELEGRAM_BOT_USERNAME: optionalValue(z.string()),
    POLLING_TIMEOUT: z.coerce.number().int().min(1).max(120).default(30),

    // API server
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    API_BODY_LIMIT: z
      .enum(['64kb', '128kb', '256kb', '512kb', '1mb'])
      .default('256kb'),
    API_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(5_000)
      .max(120_000)
      .default(30_000),
    API_HEADERS_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(5_000)
      .max(120_000)
      .default(35_000),
    API_KEEP_ALIVE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(30_000)
      .default(5_000),
    CORS_ORIGIN: optionalValue(z.string()),
    TRUST_PROXY: z
      .union([z.enum(['true', 'false']), z.string().regex(/^(?:[0-9]|10)$/)])
      .default('1'),
    ENABLE_HELMET: z
      .enum(['true', 'false'])
      .default('true')
      .transform(v => v === 'true'),
    ENABLE_RATE_LIMIT: z
      .enum(['true', 'false'])
      .default('true')
      .transform(v => v === 'true'),
    ENABLE_OPERATIONS_API: z
      .enum(['true', 'false'])
      .default('false')
      .transform(v => v === 'true'),
    OPERATIONS_API_SECRET: optionalValue(
      z
        .string()
        .min(32, 'OPERATIONS_API_SECRET must contain at least 32 characters')
    ),

    // Auth secrets
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be ≥32 chars'),
    ENCRYPTION_KEY: optionalValue(
      z.string().regex(
        /^[0-9a-fA-F]{64}$/,
        'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'
      )
    ),

    // Database
    DATABASE_URL: z.string().min(10, 'DATABASE_URL is required'),

    // Optional integrations
    SENTRY_DSN: optionalValue(z.string().url()),
    GLITCHTIP_DSN: optionalValue(z.string().url()),
    REDIS_URL: optionalValue(z.string()),
    REDIS_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform(v => v === 'true'),

    // Dev flags
    SKIP_TELEGRAM_VALIDATION: z
      .enum(['true', 'false'])
      .default('false')
      .transform(v => v === 'true'),
    // Proxy (optional, for blocked regions)
    HTTPS_PROXY: optionalValue(z.string()),
    SOCKS_PROXY: optionalValue(z.string()),
  })
  .superRefine((value, context) => {
    if (value.BOT_MODE === 'webhook' && !value.BOT_WEBHOOK_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BOT_WEBHOOK_URL'],
        message: 'BOT_WEBHOOK_URL is required in webhook mode',
      });
    }

    if (value.BOT_MODE === 'webhook' && !value.TELEGRAM_WEBHOOK_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TELEGRAM_WEBHOOK_SECRET'],
        message: 'TELEGRAM_WEBHOOK_SECRET is required in webhook mode',
      });
    }

    if (value.BOT_MODE === 'webhook' && value.PROCESS_ROLE !== 'full') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PROCESS_ROLE'],
        message: 'PROCESS_ROLE must be full in webhook mode',
      });
    }

    if (value.NODE_ENV === 'production' && value.SKIP_TELEGRAM_VALIDATION) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SKIP_TELEGRAM_VALIDATION'],
        message: 'SKIP_TELEGRAM_VALIDATION must be false in production',
      });
    }

    if (value.NODE_ENV === 'production' && !value.REDIS_ENABLED) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_ENABLED'],
        message:
          'REDIS_ENABLED must be true in production for idempotent writes',
      });
    }

    if (value.NODE_ENV === 'production' && !value.ENABLE_HELMET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ENABLE_HELMET'],
        message: 'ENABLE_HELMET must be true in production',
      });
    }

    if (value.NODE_ENV === 'production' && !value.ENABLE_RATE_LIMIT) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ENABLE_RATE_LIMIT'],
        message: 'ENABLE_RATE_LIMIT must be true in production',
      });
    }

    if (value.ENABLE_OPERATIONS_API && !value.OPERATIONS_API_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OPERATIONS_API_SECRET'],
        message:
          'OPERATIONS_API_SECRET is required when ENABLE_OPERATIONS_API=true',
      });
    }

    if (value.API_HEADERS_TIMEOUT_MS <= value.API_KEEP_ALIVE_TIMEOUT_MS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['API_HEADERS_TIMEOUT_MS'],
        message:
          'API_HEADERS_TIMEOUT_MS must be greater than API_KEEP_ALIVE_TIMEOUT_MS',
      });
    }

    if (value.NODE_ENV === 'production') {
      const origins = (value.CORS_ORIGIN ?? '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
      if (
        origins.length === 0 ||
        origins.some(origin => origin === '*' || !origin.startsWith('https://'))
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGIN'],
          message:
            'CORS_ORIGIN must contain explicit HTTPS origins in production',
        });
      }

      if (!value.WEBAPP_URL?.startsWith('https://')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['WEBAPP_URL'],
          message: 'WEBAPP_URL must use HTTPS in production',
        });
      }

      if (
        value.BOT_MODE === 'webhook' &&
        !value.BOT_WEBHOOK_URL?.startsWith('https://')
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['BOT_WEBHOOK_URL'],
          message: 'BOT_WEBHOOK_URL must use HTTPS in production',
        });
      }

      if (value.JWT_SECRET.length < 64) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message:
            'JWT_SECRET must contain at least 64 characters in production',
        });
      }

      if (!value.ENCRYPTION_KEY) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ENCRYPTION_KEY'],
          message: 'ENCRYPTION_KEY is required in production',
        });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/**
 * Validate process.env against schema. Cached after first call.
 * Throws on failure with a structured list of issues.
 */
export function validateEnv(): Env {
  if (cached) return cached;

  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      i => `  - ${i.path.join('.')}: ${i.message}`
    );
    logger.error(`🚨 ENV VALIDATION FAILED:\n${issues.join('\n')}`);
    // Fail fast — don't let a broken config stagger into mid-flight handler crashes.
    throw new Error(
      `Invalid environment configuration (${parsed.error.issues.length} issue(s)). See logs above.`
    );
  }

  cached = parsed.data;
  logger.info('✅ Environment validation passed', {
    nodeEnv: cached.NODE_ENV,
    apiPort: cached.API_PORT,
    redisEnabled: cached.REDIS_ENABLED,
    sentryConfigured: !!cached.SENTRY_DSN || !!cached.GLITCHTIP_DSN,
  });
  return cached;
}

/**
 * Что делать с `SKIP_TELEGRAM_VALIDATION` прямо сейчас.
 *
 * `off` — проверка подписи работает; `allowed` — пропуск разрешён (dev/test);
 * `blocked` — флаг выставлен там, где его быть не может.
 */
export type TelegramSkipDecision = 'off' | 'allowed' | 'blocked';

/**
 * Единственное место, где решается, можно ли пропустить проверку подписи
 * Telegram.
 *
 * До задачи 16 это правило было написано ПЯТЬ раз независимо: в схеме env, в
 * двух ветках `telegram-auth` middleware, в `auth.controller` и в
 * `utils/telegram-auth`. Прямой дыры это не давало — гейт в `validateEnv()`
 * валит старт в production, — но при следующей правке правила («разрешить в
 * staging») его пришлось бы найти в пяти местах, и шанс пропустить одно высок.
 * Флаг отключает проверку подписи initData, то есть позволяет выдать себя за
 * любого пользователя; ошибиться здесь дороже, чем где-либо ещё в продукте.
 *
 * Читается `process.env`, а не валидированный конфиг, и это осознанно:
 * `validateEnv()` вызывается только в `index.ts`, а тесты, e2e-сиды и служебные
 * скрипты выставляют флаг сами и через валидацию не проходят. Решение, которое
 * меняло бы форму в зависимости от того, поднимался ли процесс через `index.ts`,
 * было бы опаснее дублирования, которое эта задача убирает.
 *
 * Признаётся ровно строка `'true'` — как и во всех пяти прежних проверках;
 * `'TRUE'`, `'1'`, `'yes'` пропуск НЕ включают. Расширять это тихо нельзя:
 * человек, написавший `SKIP_TELEGRAM_VALIDATION=1`, получит работающую проверку
 * подписи, а не выключенную.
 *
 * Ответ на `blocked` каждый вызывающий формирует сам — middleware бросает,
 * контроллер отвечает 500 `SECURITY_VIOLATION`, `validateTelegramInitData`
 * возвращает `null`. Формы ответов и коды намеренно оставлены прежними: на них
 * завязаны тесты и алерты.
 */
export function telegramValidationSkip(): TelegramSkipDecision {
  if (process.env.SKIP_TELEGRAM_VALIDATION !== 'true') return 'off';

  return process.env.NODE_ENV === 'production' ? 'blocked' : 'allowed';
}

/**
 * Get the validated env object. Throws if validateEnv() hasn't been called yet.
 * Direct module-load validation is intentionally avoided so dotenv.config()
 * can run first in index.ts.
 */
export function getEnv(): Env {
  if (!cached) {
    throw new Error(
      'getEnv() called before validateEnv(). Call validateEnv() at boot.'
    );
  }
  return cached;
}
