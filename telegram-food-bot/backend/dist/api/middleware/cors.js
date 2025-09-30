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
        const allowedOrigins = Array.isArray(api_config_1.apiConfig.corsOrigin)
            ? [...api_config_1.apiConfig.corsOrigin]
            : [api_config_1.apiConfig.corsOrigin];
        if (process.env.NODE_ENV === 'development') {
            const developmentOrigins = [
                'http://localhost:3000',
                'http://localhost:5173',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:5173',
            ];
            allowedOrigins.push(...developmentOrigins);
        }
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        }
        else {
            logger_1.logger.warn('CORS заблокировал запрос', { origin, allowedOrigins });
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
        const telegramOrigins = [
            'https://web.telegram.org',
            'https://k.web.telegram.org',
            'https://z.web.telegram.org',
            'https://a.web.telegram.org',
        ];
        const configOrigins = Array.isArray(api_config_1.apiConfig.corsOrigin)
            ? api_config_1.apiConfig.corsOrigin
            : [api_config_1.apiConfig.corsOrigin];
        const allowedOrigins = [...configOrigins, ...telegramOrigins];
        if (process.env.NODE_ENV === 'development') {
            allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173', 'https://localhost:5173', 'https://127.0.0.1:5173');
        }
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