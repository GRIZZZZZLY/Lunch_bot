"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramCorsMiddleware = exports.corsMiddleware = void 0;
const cors_1 = __importDefault(require("cors"));
const api_config_1 = require("../../config/api.config");
const logger_1 = require("../../utils/logger");
exports.corsMiddleware = (0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        const configAllowedOrigins = Array.isArray(api_config_1.apiConfig.cors.origin)
            ? [...api_config_1.apiConfig.cors.origin]
            : [api_config_1.apiConfig.cors.origin];
        if (process.env.NODE_ENV === 'development') {
            const devOrigins = [
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                'http://localhost:3000',
                ...configAllowedOrigins,
            ];
            const isNgrok = origin.includes('.ngrok');
            const isAllowed = devOrigins.includes(origin) || isNgrok;
            if (isAllowed) {
                logger_1.logger.debug('CORS: development режим, origin разрешен', { origin });
                return callback(null, true);
            }
            logger_1.logger.warn('CORS: development режим, origin ЗАБЛОКИРОВАН', { origin, allowedOrigins: devOrigins });
            return callback(new Error('Origin не в whitelist даже для development'));
        }
        if (configAllowedOrigins.includes(origin) || configAllowedOrigins.includes('*')) {
            callback(null, true);
        }
        else {
            logger_1.logger.warn('CORS заблокировал запрос', { origin, allowedOrigins: configAllowedOrigins });
            callback(new Error('Запрос заблокирован CORS политикой'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'Pragma',
    ],
    credentials: true,
    maxAge: 86400,
    optionsSuccessStatus: 200,
});
exports.telegramCorsMiddleware = (0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        const configOrigins = Array.isArray(api_config_1.apiConfig.corsOrigin)
            ? api_config_1.apiConfig.corsOrigin
            : [api_config_1.apiConfig.corsOrigin];
        if (process.env.NODE_ENV === 'development') {
            const isNgrok = origin.includes('.ngrok');
            const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
            const isTelegram = origin.includes('telegram.org');
            if (isNgrok || isLocalhost || isTelegram || configOrigins.includes(origin)) {
                logger_1.logger.debug('Telegram CORS: development режим, origin разрешен', { origin });
                return callback(null, true);
            }
            logger_1.logger.warn('Telegram CORS: development режим, origin ЗАБЛОКИРОВАН', { origin });
            return callback(new Error('Telegram CORS: origin не в whitelist'));
        }
        const telegramOrigins = [
            'https://web.telegram.org',
            'https://k.web.telegram.org',
            'https://z.web.telegram.org',
            'https://a.web.telegram.org',
        ];
        const allowedOrigins = [...configOrigins, ...telegramOrigins];
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        }
        else {
            logger_1.logger.warn('Telegram CORS заблокировал запрос', { origin });
            callback(null, true);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Telegram-Bot-Api-Secret-Token',
    ],
    credentials: false,
    maxAge: 3600,
});
//# sourceMappingURL=cors.js.map