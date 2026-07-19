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

const EnvSchema = z.object({
  // Runtime mode
  NODE_ENV: NodeEnv.default('development'),

  // Telegram
  BOT_TOKEN: z.string().regex(/^\d+:[A-Za-z0-9_-]+$/, 'BOT_TOKEN must match <id>:<secret>'),
  WEBAPP_URL: z.string().url().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  POLLING_TIMEOUT: z.coerce.number().int().min(1).max(120).default(30),

  // API server
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),

  // Auth secrets
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be ≥32 chars'),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
    .optional(),

  // Database
  DATABASE_URL: z.string().min(10, 'DATABASE_URL is required'),

  // Optional integrations
  SENTRY_DSN: z.string().url().optional(),
  GLITCHTIP_DSN: z.string().url().optional(),
  REDIS_URL: z.string().optional(),
  REDIS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Dev flags
  SKIP_TELEGRAM_VALIDATION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  ALLOW_SKIP_VALIDATION_IN_PROD: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Proxy (optional, for blocked regions)
  HTTPS_PROXY: z.string().optional(),
  SOCKS_PROXY: z.string().optional(),
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
      (i) => `  - ${i.path.join('.')}: ${i.message}`,
    );
    logger.error(`🚨 ENV VALIDATION FAILED:\n${  issues.join('\n')}`);
    // Fail fast — don't let a broken config stagger into mid-flight handler crashes.
    throw new Error(
      `Invalid environment configuration (${parsed.error.issues.length} issue(s)). See logs above.`,
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
 * Get the validated env object. Throws if validateEnv() hasn't been called yet.
 * Direct module-load validation is intentionally avoided so dotenv.config()
 * can run first in index.ts.
 */
export function getEnv(): Env {
  if (!cached) {
    throw new Error('getEnv() called before validateEnv(). Call validateEnv() at boot.');
  }
  return cached;
}
