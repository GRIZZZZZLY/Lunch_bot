export declare const apiConfig: {
    host: string;
    port: number;
    baseUrl: string;
    cors: {
        origin: string[];
        credentials: boolean;
        optionsSuccessStatus: number;
    };
    corsOrigin: string;
    security: {
        enableHelmet: boolean;
        enableRateLimit: boolean;
        rateLimitMax: number;
        rateLimitWindowMs: number;
        jwt: {
            secret: string;
            expiresIn: string;
        };
    };
    upload: {
        maxSizeMB: number;
        allowedTypes: string[];
        path: string;
    };
    maxFileSizeMB: number;
    uploadPath: string;
    logging: {
        level: string;
        logRequests: boolean;
        logRequestBodies: boolean;
        logHeaders: boolean;
    };
    pagination: {
        defaultLimit: number;
        maxLimit: number;
    };
    cache: {
        enabled: boolean;
        defaultTTL: number;
        redis: {
            host: string;
            port: number;
            password: string;
            db: number;
        };
    };
    database: {
        url: string;
        pool: {
            min: number;
            max: number;
        };
        timeouts: {
            query: number;
            transaction: number;
        };
    };
    validation: {
        strict: boolean;
        maxDepth: number;
    };
    monitoring: {
        enablePrometheus: boolean;
        metricsPath: string;
        enableHealthChecks: boolean;
        healthPath: string;
    };
    swagger: {
        enabled: boolean;
        path: string;
        info: {
            title: string;
            version: string;
            description: string;
        };
    };
    external: {
        telegram: {
            apiUrl: string;
            timeout: number;
        };
        webhooks: {
            enabled: boolean;
            urls: string[];
            timeout: number;
            retries: number;
        };
    };
};
export default apiConfig;
//# sourceMappingURL=api.config.d.ts.map