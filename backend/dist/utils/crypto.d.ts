export declare function validateTelegramInitData(initData: string, botToken: string): {
    isValid: boolean;
    data?: any;
};
export declare function extractAuthHeader(authHeader: string): string | null;
export declare function generateRandomToken(length?: number): string;
export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, stored: string): boolean;
export declare function createWebhookSignature(body: string, secretToken: string): string;
export declare function verifyWebhookSignature(body: string, signature: string, secretToken: string): boolean;
//# sourceMappingURL=crypto.d.ts.map