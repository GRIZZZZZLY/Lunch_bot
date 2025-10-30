import Redis from 'ioredis';
declare class CacheService {
    private client;
    private hits;
    private misses;
    constructor();
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T, ttl?: number): Promise<boolean>;
    del(key: string | string[]): Promise<number>;
    flush(): Promise<void>;
    invalidatePattern(pattern: string): Promise<void>;
    getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T>;
    getStats(): Promise<{
        hits: number;
        misses: number;
        hitRate: string;
        dbSize: number;
        redisInfo: string;
    } | {
        hits: number;
        misses: number;
        hitRate: string;
        dbSize: number;
        redisInfo?: undefined;
    }>;
    keys(pattern?: string): Promise<string[]>;
    has(key: string): Promise<boolean>;
    getTtl(key: string): Promise<number | undefined>;
    getClient(): Redis;
    close(): Promise<void>;
}
export declare const cacheService: CacheService;
export declare const CACHE_KEYS: {
    readonly ACTIVE_POLLS: "active_polls";
    readonly ACTIVE_POLLS_GROUP: (groupId: number) => string;
    readonly POLL_DETAILS: (pollId: number) => string;
    readonly POLL_VOTES: (pollId: number) => string;
    readonly POLL_VOTE_BREAKDOWN: (pollId: number) => string;
    readonly MENU_ITEMS: "menu_items";
    readonly MENU_ITEMS_ACTIVE: "menu_items_active";
    readonly MENU_ITEMS_BY_CATEGORY: (category: string) => string;
    readonly USER: (userId: number) => string;
    readonly USER_BY_TELEGRAM_ID: (telegramId: bigint) => string;
    readonly GROUP: (groupId: number) => string;
    readonly GROUP_BY_TELEGRAM_ID: (telegramId: bigint) => string;
    readonly POLL_STATS: (groupId?: number) => string;
    readonly USER_STATS: (userId: number) => string;
};
export declare const CACHE_TTL: {
    readonly ACTIVE_POLLS: 30;
    readonly MENU: 300;
    readonly STATS: 120;
    readonly POLL_DETAILS: 60;
    readonly USER: 300;
    readonly GROUP: 300;
    readonly VOTES: 30;
};
export declare class CacheInvalidator {
    static invalidatePoll(pollId: number, groupId?: number): Promise<void>;
    static invalidateVote(pollId: number): Promise<void>;
    static invalidateMenu(): Promise<void>;
    static invalidateUser(userId: number, telegramId?: bigint): Promise<void>;
}
export {};
//# sourceMappingURL=cache.service.d.ts.map