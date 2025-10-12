interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    allows_write_to_pm?: boolean;
}
export declare function validateTelegramInitData(initData: string): TelegramUser | null;
export declare function generateTestInitData(userId: number, firstName: string, username?: string): string;
export declare function extractUserFromInitData(initData: string): TelegramUser | null;
export declare function parseInitDataUnsafe(initData: string): TelegramUser | null;
export {};
//# sourceMappingURL=telegram-auth.d.ts.map