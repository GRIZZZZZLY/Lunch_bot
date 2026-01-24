import Redis from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Redis Configuration
 *
 * Environment variables:
 * - REDIS_ENABLED: Enable/disable Redis (default: false)
 * - REDIS_HOST: Redis server host (default: localhost)
 * - REDIS_PORT: Redis server port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_DB: Redis database number (default: 0)
 */

// Redis ВЫКЛЮЧЕН по умолчанию - нужно явно включить через REDIS_ENABLED=true
export const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),

  // Connection options
  retryStrategy: (times: number) => {
    // Если Redis отключен - не пытаемся переподключаться
    if (!REDIS_ENABLED) {
      return null;
    }
    // Максимум 5 попыток переподключения
    if (times > 5) {
      logger.error('❌ Redis max retries exceeded, giving up');
      return null;
    }
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis connection retry attempt ${times}, delay: ${delay}ms`);
    return delay;
  },

  // Connection timeout
  connectTimeout: 10000,

  // Lazy connection - НЕ подключаемся при старте если Redis отключен
  lazyConnect: !REDIS_ENABLED,

  // Enable offline queue only if Redis enabled
  enableOfflineQueue: REDIS_ENABLED,

  // Max retry attempts
  maxRetriesPerRequest: REDIS_ENABLED ? 3 : null,
};

/**
 * Create Redis client
 */
export function createRedisClient(): Redis {
  const client = new Redis(redisConfig);

  client.on('connect', () => {
    logger.info('✅ Redis connected', {
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
    });
  });

  client.on('ready', () => {
    logger.info('🚀 Redis ready for commands');
  });

  client.on('error', (error) => {
    logger.error('❌ Redis error:', error);
  });

  client.on('close', () => {
    logger.warn('⚠️ Redis connection closed');
  });

  client.on('reconnecting', (delay: number) => {
    logger.info('🔄 Redis reconnecting...', { delay });
  });

  return client;
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisClient(client: Redis): Promise<void> {
  try {
    await client.quit();
    logger.info('Redis connection closed gracefully');
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
    client.disconnect();
  }
}
