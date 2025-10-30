"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheInvalidator = exports.CACHE_TTL = exports.CACHE_KEYS = exports.cacheService = void 0;
const redis_config_1 = require("../config/redis.config");
const logger_1 = require("../utils/logger");
const DEFAULT_TTL = 60;
const ACTIVE_POLLS_TTL = 30;
const MENU_TTL = 300;
const STATS_TTL = 120;
class CacheService {
    client;
    hits = 0;
    misses = 0;
    constructor() {
        this.client = (0, redis_config_1.createRedisClient)();
        logger_1.logger.info('✅ Cache service initialized with Redis');
    }
    async get(key) {
        try {
            const value = await this.client.get(key);
            if (value !== null) {
                this.hits++;
                logger_1.logger.debug(`Cache HIT: ${key} (hits: ${this.hits}/${this.hits + this.misses})`);
                return JSON.parse(value);
            }
            else {
                this.misses++;
                logger_1.logger.debug(`Cache MISS: ${key} (misses: ${this.misses}/${this.hits + this.misses})`);
                return undefined;
            }
        }
        catch (error) {
            logger_1.logger.error(`Cache GET error for key ${key}:`, error);
            return undefined;
        }
    }
    async set(key, value, ttl) {
        try {
            const serialized = JSON.stringify(value);
            const ttlSeconds = ttl || DEFAULT_TTL;
            await this.client.setex(key, ttlSeconds, serialized);
            logger_1.logger.debug(`Cache SET: ${key}, TTL: ${ttlSeconds}s`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Cache SET error for key ${key}:`, error);
            return false;
        }
    }
    async del(key) {
        try {
            const keys = Array.isArray(key) ? key : [key];
            const result = await this.client.del(...keys);
            logger_1.logger.debug(`Cache DELETE: ${keys.join(', ')}`);
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Cache DELETE error:`, error);
            return 0;
        }
    }
    async flush() {
        try {
            await this.client.flushdb();
            this.hits = 0;
            this.misses = 0;
            logger_1.logger.info('Cache flushed (all keys deleted)');
        }
        catch (error) {
            logger_1.logger.error('Cache FLUSH error:', error);
        }
    }
    async invalidatePattern(pattern) {
        try {
            const stream = this.client.scanStream({
                match: `*${pattern}*`,
                count: 100,
            });
            const keysToDelete = [];
            stream.on('data', (keys) => {
                keysToDelete.push(...keys);
            });
            stream.on('end', async () => {
                if (keysToDelete.length > 0) {
                    await this.client.del(...keysToDelete);
                    logger_1.logger.info(`Cache invalidated for pattern: ${pattern}, keys: ${keysToDelete.length}`);
                }
            });
        }
        catch (error) {
            logger_1.logger.error(`Cache INVALIDATE PATTERN error for ${pattern}:`, error);
        }
    }
    async getOrSet(key, fetcher, ttl) {
        const cached = await this.get(key);
        if (cached !== undefined) {
            return cached;
        }
        logger_1.logger.debug(`Fetching data for cache key: ${key}`);
        const value = await fetcher();
        await this.set(key, value, ttl);
        return value;
    }
    async getStats() {
        try {
            const info = await this.client.info('stats');
            const dbSize = await this.client.dbsize();
            const hitRate = this.hits + this.misses > 0
                ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(2)
                : '0.00';
            return {
                hits: this.hits,
                misses: this.misses,
                hitRate: `${hitRate}%`,
                dbSize,
                redisInfo: info,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting cache stats:', error);
            return {
                hits: this.hits,
                misses: this.misses,
                hitRate: '0.00%',
                dbSize: 0,
            };
        }
    }
    async keys(pattern = '*') {
        try {
            return await this.client.keys(pattern);
        }
        catch (error) {
            logger_1.logger.error('Error getting cache keys:', error);
            return [];
        }
    }
    async has(key) {
        try {
            const exists = await this.client.exists(key);
            return exists === 1;
        }
        catch (error) {
            logger_1.logger.error(`Error checking cache key ${key}:`, error);
            return false;
        }
    }
    async getTtl(key) {
        try {
            const ttl = await this.client.ttl(key);
            return ttl >= 0 ? ttl : undefined;
        }
        catch (error) {
            logger_1.logger.error(`Error getting TTL for key ${key}:`, error);
            return undefined;
        }
    }
    getClient() {
        return this.client;
    }
    async close() {
        try {
            await this.client.quit();
            logger_1.logger.info('Redis cache client closed');
        }
        catch (error) {
            logger_1.logger.error('Error closing Redis cache client:', error);
        }
    }
}
exports.cacheService = new CacheService();
exports.CACHE_KEYS = {
    ACTIVE_POLLS: 'active_polls',
    ACTIVE_POLLS_GROUP: (groupId) => `active_polls_group_${groupId}`,
    POLL_DETAILS: (pollId) => `poll_${pollId}`,
    POLL_VOTES: (pollId) => `poll_votes_${pollId}`,
    POLL_VOTE_BREAKDOWN: (pollId) => `poll_vote_breakdown_${pollId}`,
    MENU_ITEMS: 'menu_items',
    MENU_ITEMS_ACTIVE: 'menu_items_active',
    MENU_ITEMS_BY_CATEGORY: (category) => `menu_items_category_${category}`,
    USER: (userId) => `user_${userId}`,
    USER_BY_TELEGRAM_ID: (telegramId) => `user_telegram_${telegramId}`,
    GROUP: (groupId) => `group_${groupId}`,
    GROUP_BY_TELEGRAM_ID: (telegramId) => `group_telegram_${telegramId}`,
    POLL_STATS: (groupId) => groupId ? `stats_${groupId}` : 'stats_global',
    USER_STATS: (userId) => `user_stats_${userId}`,
};
exports.CACHE_TTL = {
    ACTIVE_POLLS: ACTIVE_POLLS_TTL,
    MENU: MENU_TTL,
    STATS: STATS_TTL,
    POLL_DETAILS: 60,
    USER: 300,
    GROUP: 300,
    VOTES: 30,
};
class CacheInvalidator {
    static async invalidatePoll(pollId, groupId) {
        const keysToDelete = [
            exports.CACHE_KEYS.ACTIVE_POLLS,
            exports.CACHE_KEYS.POLL_DETAILS(pollId),
            exports.CACHE_KEYS.POLL_VOTES(pollId),
            exports.CACHE_KEYS.POLL_VOTE_BREAKDOWN(pollId),
        ];
        if (groupId) {
            keysToDelete.push(exports.CACHE_KEYS.ACTIVE_POLLS_GROUP(groupId));
        }
        await exports.cacheService.del(keysToDelete);
        await exports.cacheService.invalidatePattern('stats');
    }
    static async invalidateVote(pollId) {
        await exports.cacheService.del([
            exports.CACHE_KEYS.POLL_VOTES(pollId),
            exports.CACHE_KEYS.POLL_VOTE_BREAKDOWN(pollId),
            exports.CACHE_KEYS.POLL_DETAILS(pollId),
        ]);
        await exports.cacheService.invalidatePattern('stats');
    }
    static async invalidateMenu() {
        await exports.cacheService.invalidatePattern('menu_items');
    }
    static async invalidateUser(userId, telegramId) {
        const keysToDelete = [exports.CACHE_KEYS.USER(userId)];
        if (telegramId) {
            keysToDelete.push(exports.CACHE_KEYS.USER_BY_TELEGRAM_ID(telegramId));
        }
        await exports.cacheService.del(keysToDelete);
    }
}
exports.CacheInvalidator = CacheInvalidator;
//# sourceMappingURL=cache.service.js.map