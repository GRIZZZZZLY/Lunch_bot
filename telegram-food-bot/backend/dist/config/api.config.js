"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
exports.apiConfig = {
    host: process.env.API_HOST || '0.0.0.0',
    port: parseInt(process.env.API_PORT || '3001'),
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:3000', 'http://localhost:5173'],
        credentials: true,
        optionsSuccessStatus: 200,
    },
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173',
    security: {
        enableHelmet: process.env.ENABLE_HELMET !== 'false',
        enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
        jwt: {
            secret: process.env.JWT_SECRET || process.env.BOT_TOKEN || 'fallback-secret',
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        },
    },
    upload: {
        maxSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '5'),
        allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
        ],
        path: path_1.default.resolve(process.cwd(), process.env.UPLOAD_PATH || 'uploads'),
    },
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '5'),
    uploadPath: path_1.default.resolve(process.cwd(), process.env.UPLOAD_PATH || 'uploads'),
    logging: {
        level: process.env.API_LOG_LEVEL || 'info',
        logRequests: process.env.LOG_REQUESTS !== 'false',
        logRequestBodies: process.env.LOG_REQUEST_BODIES === 'true',
        logHeaders: process.env.LOG_HEADERS === 'true',
    },
    pagination: {
        defaultLimit: parseInt(process.env.DEFAULT_PAGE_LIMIT || '20'),
        maxLimit: parseInt(process.env.MAX_PAGE_LIMIT || '100'),
    },
    cache: {
        enabled: process.env.ENABLE_CACHE === 'true',
        defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || '',
            db: parseInt(process.env.REDIS_DB || '0'),
        },
    },
    database: {
        url: process.env.DATABASE_URL || '',
        pool: {
            min: parseInt(process.env.DB_POOL_MIN || '2'),
            max: parseInt(process.env.DB_POOL_MAX || '10'),
        },
        timeouts: {
            query: parseInt(process.env.DB_QUERY_TIMEOUT || '10000'),
            transaction: parseInt(process.env.DB_TRANSACTION_TIMEOUT || '30000'),
        },
    },
    validation: {
        strict: process.env.VALIDATION_STRICT === 'true',
        maxDepth: parseInt(process.env.VALIDATION_MAX_DEPTH || '5'),
    },
    monitoring: {
        enablePrometheus: process.env.ENABLE_PROMETHEUS === 'true',
        metricsPath: process.env.METRICS_PATH || '/metrics',
        enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
        healthPath: process.env.HEALTH_PATH || '/health',
    },
    swagger: {
        enabled: process.env.ENABLE_SWAGGER === 'true' || process.env.NODE_ENV === 'development',
        path: process.env.SWAGGER_PATH || '/api-docs',
        info: {
            title: 'Telegram Food Bot API',
            version: '1.0.0',
            description: 'API для управления меню и голосованиями в Telegram Food Bot',
        },
    },
    external: {
        telegram: {
            apiUrl: process.env.TELEGRAM_API_URL || 'https://api.telegram.org',
            timeout: parseInt(process.env.TELEGRAM_TIMEOUT || '10000'),
        },
        webhooks: {
            enabled: process.env.ENABLE_WEBHOOKS === 'true',
            urls: process.env.WEBHOOK_URLS?.split(',').map(u => u.trim()).filter(Boolean) || [],
            timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '5000'),
            retries: parseInt(process.env.WEBHOOK_RETRIES || '3'),
        },
    },
};
function validateApiConfig() {
    const errors = [];
    if (exports.apiConfig.port < 1 || exports.apiConfig.port > 65535) {
        errors.push('API_PORT must be between 1 and 65535');
    }
    if (!exports.apiConfig.database.url) {
        errors.push('DATABASE_URL is required');
    }
    if (exports.apiConfig.upload.maxSizeMB < 1) {
        errors.push('MAX_FILE_SIZE_MB must be at least 1');
    }
    if (exports.apiConfig.pagination.defaultLimit > exports.apiConfig.pagination.maxLimit) {
        errors.push('DEFAULT_PAGE_LIMIT cannot be greater than MAX_PAGE_LIMIT');
    }
    if (!exports.apiConfig.security.jwt.secret || exports.apiConfig.security.jwt.secret === 'fallback-secret') {
        console.warn('Warning: Using fallback JWT secret. Set JWT_SECRET in production.');
    }
    if (errors.length > 0) {
        throw new Error(`API configuration errors:\n${errors.join('\n')}`);
    }
}
validateApiConfig();
exports.default = exports.apiConfig;
