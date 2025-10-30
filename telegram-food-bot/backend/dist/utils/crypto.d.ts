export declare function extractAuthHeader(authHeader: string): string | null;
export declare function generateRandomToken(length?: number): string;
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
export declare function createWebhookSignature(body: string, secretToken: string): string;
export declare function verifyWebhookSignature(body: string, signature: string, secretToken: string): boolean;
//# sourceMappingURL=crypto.d.ts.map