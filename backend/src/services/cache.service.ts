import NodeCache from 'node-cache';
import { logger } from '../utils/logger';

// TTL (Time To Live) в секундах
const DEFAULT_TTL = 60; // 1 минута
const ACTIVE_POLLS_TTL = 30; // 30 секунд для активных голосований
const MENU_TTL = 300; // 5 минут для меню
const STATS_TTL = 120; // 2 минуты для статистики

/**
 * Сервис кэширования на основе node-cache
 * Использует in-memory кэш для оптимизации частых запросов к БД
 */
class CacheService {
  private cache: NodeCache;
  private hits = 0;
  private misses = 0;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: DEFAULT_TTL,
      checkperiod: 60, // Проверка истекших ключей каждые 60 сек
      useClones: false, // Для лучшей производительности (не клонируем объекты)
      deleteOnExpire: true,
    });

    // События для логирования
    this.cache.on('expired', (key, value) => {
      logger.debug(`Cache key expired: ${key}`);
    });

    this.cache.on('flush', () => {
      logger.info('Cache flushed');
    });

    logger.info('Cache service initialized');
  }

  /**
   * Получить значение из кэша
   */
  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    if (value !== undefined) {
      this.hits++;
      logger.debug(`Cache HIT: ${key} (hits: ${this.hits}/${this.hits + this.misses})`);
    } else {
      this.misses++;
      logger.debug(`Cache MISS: ${key} (misses: ${this.misses}/${this.hits + this.misses})`);
    }
    return value;
  }

  /**
   * Установить значение в кэш
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    const result = this.cache.set(key, value, ttl || DEFAULT_TTL);
    logger.debug(`Cache SET: ${key}, TTL: ${ttl || DEFAULT_TTL}s`);
    return result;
  }

  /**
   * Удалить значение из кэша
   */
  del(key: string | string[]): number {
    const result = this.cache.del(key);
    logger.debug(`Cache DELETE: ${Array.isArray(key) ? key.join(', ') : key}`);
    return result;
  }

  /**
   * Очистить весь кэш
   */
  flush(): void {
    this.cache.flushAll();
    this.hits = 0;
    this.misses = 0;
    logger.info('Cache flushed (all keys deleted)');
  }

  /**
   * Инвалидация кэша по паттерну
   * Удаляет все ключи, содержащие указанный паттерн
   */
  invalidatePattern(pattern: string): void {
    const keys = this.cache.keys();
    const matchedKeys = keys.filter(key => key.includes(pattern));
    if (matchedKeys.length > 0) {
      this.cache.del(matchedKeys);
      logger.info(`Cache invalidated for pattern: ${pattern}, keys: ${matchedKeys.length}`);
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
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    logger.debug(`Fetching data for cache key: ${key}`);
    const value = await fetcher();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Получить статистику кэша
   */
  getStats() {
    const stats = this.cache.getStats();
    const hitRate = this.hits + this.misses > 0
      ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(2)
      : '0.00';

    return {
      ...stats,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * Получить все ключи кэша
   */
  keys(): string[] {
    return this.cache.keys();
  }

  /**
   * Проверить, есть ли ключ в кэше
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Получить TTL ключа
   */
  getTtl(key: string): number | undefined {
    return this.cache.getTtl(key);
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
  static invalidatePoll(pollId: number, groupId?: number): void {
    const keysToDelete = [
      CACHE_KEYS.ACTIVE_POLLS,
      CACHE_KEYS.POLL_DETAILS(pollId),
      CACHE_KEYS.POLL_VOTES(pollId),
      CACHE_KEYS.POLL_VOTE_BREAKDOWN(pollId),
    ];

    if (groupId) {
      keysToDelete.push(CACHE_KEYS.ACTIVE_POLLS_GROUP(groupId));
    }

    cacheService.del(keysToDelete);
    cacheService.invalidatePattern('stats'); // Инвалидируем все статистики
  }

  /**
   * Инвалидация при создании/изменении голоса
   */
  static invalidateVote(pollId: number): void {
    cacheService.del([
      CACHE_KEYS.POLL_VOTES(pollId),
      CACHE_KEYS.POLL_VOTE_BREAKDOWN(pollId),
      CACHE_KEYS.POLL_DETAILS(pollId),
    ]);
    cacheService.invalidatePattern('stats');
  }

  /**
   * Инвалидация при изменении меню
   */
  static invalidateMenu(): void {
    cacheService.invalidatePattern('menu_items');
  }

  /**
   * Инвалидация при изменении пользователя
   */
  static invalidateUser(userId: number, telegramId?: bigint): void {
    const keysToDelete = [CACHE_KEYS.USER(userId)];
    
    if (telegramId) {
      keysToDelete.push(CACHE_KEYS.USER_BY_TELEGRAM_ID(telegramId));
    }
    
    cacheService.del(keysToDelete);
  }
}
