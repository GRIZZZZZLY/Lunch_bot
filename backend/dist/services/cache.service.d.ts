declare class CacheService {
    private cache;
    private hits;
    private misses;
    constructor();
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T, ttl?: number): boolean;
    del(key: string | string[]): number;
    flush(): void;
    invalidatePattern(pattern: string): void;
    getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T>;
    getStats(): {
        hits: number;
        misses: number;
        hitRate: string;
        keys: number;
        ksize: number;
        vsize: number;
    };
    keys(): string[];
    has(key: string): boolean;
    getTtl(key: string): number | undefined;
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
    static invalidatePoll(pollId: number, groupId?: number): void;
    static invalidateVote(pollId: number): void;
    static invalidateMenu(): void;
    static invalidateUser(userId: number, telegramId?: bigint): void;
}
export {};
//# sourceMappingURL=cache.service.d.ts.map