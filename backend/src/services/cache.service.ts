import Redis from 'ioredis';
import { createRedisClient, REDIS_ENABLED } from '../config/redis.config';
import { logger } from '../utils/logger';

// TTL (Time To Live) в секундах
const DEFAULT_TTL = 60; // 1 минута
const ACTIVE_POLLS_TTL = 30; // 30 секунд для активных голосований
const MENU_TTL = 300; // 5 минут для меню
const STATS_TTL = 120; // 2 минуты для статистики

/**
 * Сервис кэширования на основе Redis
 * Заменяет in-memory node-cache на Redis для:
 * - Персистентность (не теряется при перезапуске)
 * - Масштабируемость (общий кэш между серверами)
 * - Pub/Sub для инвалидации кэша
 * 
 * В dev режиме если Redis не доступен - работает без кэша
 */
class CacheService {
  private client: Redis | null;
  private hits = 0;
  private misses = 0;
  private enabled: boolean;

  constructor() {
    this.enabled = REDIS_ENABLED;
    
    if (this.enabled) {
      try {
        this.client = createRedisClient();
        logger.info('✅ Cache service initialized with Redis');
      } catch (error) {
        logger.warn('⚠️ Failed to initialize Redis, running without cache', error);
        this.client = null;
        this.enabled = false;
      }
    } else {
      logger.warn('⚠️ Redis disabled via REDIS_ENABLED=false, running without cache');
      this.client = null;
    }
  }
  
  /**
   * Проверка доступности кэша
   */
  private isAvailable(): boolean {
    return this.enabled && this.client !== null && this.client.status === 'ready';
  }

  /**
   * Получить значение из кэша
   */
  async get<T>(key: string): Promise<T | undefined> {
    if (!this.isAvailable()) {
      this.misses++;
      return undefined;
    }
    
    try {
      const value = await this.client!.get(key);

      if (value !== null) {
        this.hits++;
        logger.debug(`Cache HIT: ${key} (hits: ${this.hits}/${this.hits + this.misses})`);
        return JSON.parse(value) as T;
      } else {
        this.misses++;
        logger.debug(`Cache MISS: ${key} (misses: ${this.misses}/${this.hits + this.misses})`);
        return undefined;
      }
    } catch (error) {
      logger.error(`Cache GET error for key ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Установить значение в кэш
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    
    try {
      const serialized = JSON.stringify(value);
      const ttlSeconds = ttl || DEFAULT_TTL;

      await this.client!.setex(key, ttlSeconds, serialized);
      logger.debug(`Cache SET: ${key}, TTL: ${ttlSeconds}s`);
      return true;
    } catch (error) {
      logger.error(`Cache SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Удалить значение из кэша
   */
  async del(key: string | string[]): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }
    
    try {
      const keys = Array.isArray(key) ? key : [key];
      const result = await this.client!.del(...keys);
      logger.debug(`Cache DELETE: ${keys.join(', ')}`);
      return result;
    } catch (error) {
      logger.error(`Cache DELETE error:`, error);
      return 0;
    }
  }

  /**
   * Очистить весь кэш
   */
  async flush(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    
    try {
      await this.client!.flushdb();
      this.hits = 0;
      this.misses = 0;
      logger.info('Cache flushed (all keys deleted)');
    } catch (error) {
      logger.error('Cache FLUSH error:', error);
    }
  }

  /**
   * Инвалидация кэша по паттерну
   * Удаляет все ключи, соответствующие паттерну
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    
    try {
      const stream = this.client!.scanStream({
        match: `*${pattern}*`,
        count: 100,
      });

      const keysToDelete: string[] = [];

      stream.on('data', (keys: string[]) => {
        keysToDelete.push(...keys);
      });

      stream.on('end', async () => {
        if (keysToDelete.length > 0 && this.client) {
          await this.client.del(...keysToDelete);
          logger.info(`Cache invalidated for pattern: ${pattern}, keys: ${keysToDelete.length}`);
        }
      });
    } catch (error) {
      logger.error(`Cache INVALIDATE PATTERN error for ${pattern}:`, error);
    }
  }

  /**
   * Получить или создать (cache-aside pattern)
   * Если значение есть в кэше - вернуть его, иначе выполнить fetcher и закэшировать
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    logger.debug(`Fetching data for cache key: ${key}`);
    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Получить статистику кэша
   */
  async getStats() {
    const hitRate = this.hits + this.misses > 0
      ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(2)
      : '0.00';
    
    if (!this.isAvailable()) {
      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: `${hitRate}%`,
        dbSize: 0,
        enabled: false,
      };
    }
    
    try {
      const info = await this.client!.info('stats');
      const dbSize = await this.client!.dbsize();

      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: `${hitRate}%`,
        dbSize,
        redisInfo: info,
        enabled: true,
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: `${hitRate}%`,
        dbSize: 0,
        enabled: false,
      };
    }
  }

  /**
   * Получить все ключи кэша (осторожно с большим количеством!)
   */
  async keys(pattern: string = '*'): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }
    
    try {
      return await this.client!.keys(pattern);
    } catch (error) {
      logger.error('Error getting cache keys:', error);
      return [];
    }
  }

  /**
   * Проверить, есть ли ключ в кэше
   */
  async has(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    
    try {
      const exists = await this.client!.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error(`Error checking cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Получить TTL ключа в секундах
   */
  async getTtl(key: string): Promise<number | undefined> {
    if (!this.isAvailable()) {
      return undefined;
    }
    
    try {
      const ttl = await this.client!.ttl(key);
      return ttl >= 0 ? ttl : undefined;
    } catch (error) {
      logger.error(`Error getting TTL for key ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Получить Redis client для прямого доступа (если нужно)
   */
  getClient(): Redis | null {
    return this.client;
  }

  /**
   * Закрыть соединение с Redis
   */
  async close(): Promise<void> {
    if (!this.client) {
      return;
    }
    
    try {
      await this.client.quit();
      logger.info('Redis cache client closed');
    } catch (error) {
      logger.error('Error closing Redis cache client:', error);
    }
  }
}

// Экспортируем singleton instance
export const cacheService = new CacheService();

/**
 * Константы для ключей кэша
 * Централизованное управление ключами для избежания опечаток
 */
export const CACHE_KEYS = {
  // Polls
  ACTIVE_POLLS: 'active_polls',
  ACTIVE_POLLS_GROUP: (groupId: number) => `active_polls_group_${groupId}`,
  POLL_DETAILS: (pollId: number) => `poll_${pollId}`,
  POLL_VOTES: (pollId: number) => `poll_votes_${pollId}`,
  POLL_VOTE_BREAKDOWN: (pollId: number) => `poll_vote_breakdown_${pollId}`,

  // Menu
  MENU_ITEMS: 'menu_items',
  MENU_ITEMS_ACTIVE: 'menu_items_active',
  MENU_ITEMS_BY_CATEGORY: (category: string) => `menu_items_category_${category}`,

  // Users
  USER: (userId: number) => `user_${userId}`,
  USER_BY_TELEGRAM_ID: (telegramId: bigint) => `user_telegram_${telegramId}`,

  // Groups
  GROUP: (groupId: number) => `group_${groupId}`,
  GROUP_BY_TELEGRAM_ID: (telegramId: bigint) => `group_telegram_${telegramId}`,

  // Stats
  POLL_STATS: (groupId?: number) => groupId ? `stats_${groupId}` : 'stats_global',
  USER_STATS: (userId: number) => `user_stats_${userId}`,
} as const;

/**
 * Константы для TTL разных типов данных
 */
export const CACHE_TTL = {
  ACTIVE_POLLS: ACTIVE_POLLS_TTL, // 30 сек - активные голосования меняются часто
  MENU: MENU_TTL, // 5 мин - меню редко меняется
  STATS: STATS_TTL, // 2 мин - статистика может обновляться
  POLL_DETAILS: 60, // 1 мин - детали голосования
  USER: 300, // 5 мин - данные пользователя
  GROUP: 300, // 5 мин - данные группы
  VOTES: 30, // 30 сек - голоса активного голосования
} as const;

/**
 * Хелпер для автоматической инвалидации связанных ключей
 * при изменении данных
 */
export class CacheInvalidator {
  /**
   * Инвалидация при создании/обновлении голосования
   */
  static async invalidatePoll(pollId: number, groupId?: number): Promise<void> {
    const keysToDelete = [
      CACHE_KEYS.ACTIVE_POLLS,
      CACHE_KEYS.POLL_DETAILS(pollId),
      CACHE_KEYS.POLL_VOTES(pollId),
      CACHE_KEYS.POLL_VOTE_BREAKDOWN(pollId),
    ];

    if (groupId) {
      keysToDelete.push(CACHE_KEYS.ACTIVE_POLLS_GROUP(groupId));
    }

    await cacheService.del(keysToDelete);
    await cacheService.invalidatePattern('stats'); // Инвалидируем все статистики
  }

  /**
   * Инвалидация при создании/изменении голоса
   */
  static async invalidateVote(pollId: number): Promise<void> {
    await cacheService.del([
      CACHE_KEYS.POLL_VOTES(pollId),
      CACHE_KEYS.POLL_VOTE_BREAKDOWN(pollId),
      CACHE_KEYS.POLL_DETAILS(pollId),
    ]);
    await cacheService.invalidatePattern('stats');
  }

  /**
   * Инвалидация при изменении меню
   */
  static async invalidateMenu(): Promise<void> {
    await cacheService.invalidatePattern('menu_items');
  }

  /**
   * Инвалидация при изменении пользователя
   */
  static async invalidateUser(userId: number, telegramId?: bigint): Promise<void> {
    const keysToDelete = [CACHE_KEYS.USER(userId)];

    if (telegramId) {
      keysToDelete.push(CACHE_KEYS.USER_BY_TELEGRAM_ID(telegramId));
    }

    await cacheService.del(keysToDelete);
  }
}
