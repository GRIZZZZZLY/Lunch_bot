"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheInvalidator = exports.CACHE_TTL = exports.CACHE_KEYS = exports.cacheService = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../utils/logger");
const DEFAULT_TTL = 60;
const ACTIVE_POLLS_TTL = 30;
const MENU_TTL = 300;
const STATS_TTL = 120;
class CacheService {
    cache;
    hits = 0;
    misses = 0;
    constructor() {
        this.cache = new node_cache_1.default({
            stdTTL: DEFAULT_TTL,
            checkperiod: 60,
            useClones: false,
            deleteOnExpire: true,
        });
        this.cache.on('expired', (key, value) => {
            logger_1.logger.debug(`Cache key expired: ${key}`);
        });
        this.cache.on('flush', () => {
            logger_1.logger.info('Cache flushed');
        });
        logger_1.logger.info('Cache service initialized');
    }
    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            this.hits++;
            logger_1.logger.debug(`Cache HIT: ${key} (hits: ${this.hits}/${this.hits + this.misses})`);
        }
        else {
            this.misses++;
            logger_1.logger.debug(`Cache MISS: ${key} (misses: ${this.misses}/${this.hits + this.misses})`);
        }
        return value;
    }
    set(key, value, ttl) {
        const result = this.cache.set(key, value, ttl || DEFAULT_TTL);
        logger_1.logger.debug(`Cache SET: ${key}, TTL: ${ttl || DEFAULT_TTL}s`);
        return result;
    }
    del(key) {
        const result = this.cache.del(key);
        logger_1.logger.debug(`Cache DELETE: ${Array.isArray(key) ? key.join(', ') : key}`);
        return result;
    }
    flush() {
        this.cache.flushAll();
        this.hits = 0;
        this.misses = 0;
        logger_1.logger.info('Cache flushed (all keys deleted)');
    }
    invalidatePattern(pattern) {
        const keys = this.cache.keys();
        const matchedKeys = keys.filter(key => key.includes(pattern));
        if (matchedKeys.length > 0) {
            this.cache.del(matchedKeys);
            logger_1.logger.info(`Cache invalidated for pattern: ${pattern}, keys: ${matchedKeys.length}`);
        }
    }
    async getOrSet(key, fetcher, ttl) {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }
        logger_1.logger.debug(`Fetching data for cache key: ${key}`);
        const value = await fetcher();
        this.set(key, value, ttl);
        return value;
    }
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
    keys() {
        return this.cache.keys();
    }
    has(key) {
        return this.cache.has(key);
    }
    getTtl(key) {
        return this.cache.getTtl(key);
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
    static invalidatePoll(pollId, groupId) {
        const keysToDelete = [
            exports.CACHE_KEYS.ACTIVE_POLLS,
            exports.CACHE_KEYS.POLL_DETAILS(pollId),
            exports.CACHE_KEYS.POLL_VOTES(pollId),
            exports.CACHE_KEYS.POLL_VOTE_BREAKDOWN(pollId),
        ];
        if (groupId) {
            keysToDelete.push(exports.CACHE_KEYS.ACTIVE_POLLS_GROUP(groupId));
        }
        exports.cacheService.del(keysToDelete);
        exports.cacheService.invalidatePattern('stats');
    }
    static invalidateVote(pollId) {
        exports.cacheService.del([
            exports.CACHE_KEYS.POLL_VOTES(pollId),
            exports.CACHE_KEYS.POLL_VOTE_BREAKDOWN(pollId),
            exports.CACHE_KEYS.POLL_DETAILS(pollId),
        ]);
        exports.cacheService.invalidatePattern('stats');
    }
    static invalidateMenu() {
        exports.cacheService.invalidatePattern('menu_items');
    }
    static invalidateUser(userId, telegramId) {
        const keysToDelete = [exports.CACHE_KEYS.USER(userId)];
        if (telegramId) {
            keysToDelete.push(exports.CACHE_KEYS.USER_BY_TELEGRAM_ID(telegramId));
        }
        exports.cacheService.del(keysToDelete);
    }
}
exports.CacheInvalidator = CacheInvalidator;
//# sourceMappingURL=cache.service.js.map