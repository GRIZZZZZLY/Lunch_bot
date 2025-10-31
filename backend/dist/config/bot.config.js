"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.botConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.botConfig = {
    token: process.env.BOT_TOKEN || '',
    webhookUrl: process.env.BOT_WEBHOOK_URL || '',
    secretKey: process.env.TELEGRAM_SECRET_KEY || process.env.BOT_TOKEN || '',
    proxy: {
        enabled: process.env.USE_PROXY === 'true',
        url: process.env.PROXY_URL || '',
    },
    localApi: {
        enabled: process.env.USE_LOCAL_API === 'true',
        url: process.env.LOCAL_API_URL || 'http://localhost:8081',
    },
    mode: process.env.BOT_MODE || 'polling',
    polling: {
        interval: parseInt(process.env.POLLING_INTERVAL || '1000'),
        timeout: parseInt(process.env.POLLING_TIMEOUT || '30'),
        limit: parseInt(process.env.POLLING_LIMIT || '100'),
    },
    webhook: {
        port: parseInt(process.env.WEBHOOK_PORT || '8443'),
        path: process.env.WEBHOOK_PATH || `/webhook/${process.env.BOT_TOKEN}`,
        ssl: {
            enabled: process.env.WEBHOOK_SSL_ENABLED === 'true',
            cert: process.env.WEBHOOK_SSL_CERT || '',
            key: process.env.WEBHOOK_SSL_KEY || '',
        },
    },
    limits: {
        userRequestsPerMinute: parseInt(process.env.USER_RATE_LIMIT || '30'),
        maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '4096'),
        maxPollParticipants: parseInt(process.env.MAX_POLL_PARTICIPANTS || '100'),
        defaultPollDuration: parseInt(process.env.DEFAULT_POLL_DURATION || '30'),
    },
    commands: {
        enableInGroups: process.env.ENABLE_COMMANDS_IN_GROUPS !== 'false',
        enableInPrivate: process.env.ENABLE_COMMANDS_IN_PRIVATE !== 'false',
        prefix: process.env.COMMAND_PREFIX || '/',
    },
    logging: {
        level: process.env.BOT_LOG_LEVEL || 'info',
        logAllMessages: process.env.LOG_ALL_MESSAGES === 'true',
        logCallbacks: process.env.LOG_CALLBACKS === 'true',
    },
    defaultAdmins: process.env.DEFAULT_ADMINS?.split(',').map(id => id.trim()).filter(Boolean) || [],
    miniApp: {
        url: process.env.VITE_APP_URL || 'https://your-domain.com/miniapp',
        shortName: process.env.MINI_APP_SHORT_NAME || 'foodbot',
    },
    webappUrl: process.env.WEBAPP_URL || 'http://localhost:5173',
    features: {
        enablePolls: process.env.ENABLE_POLLS !== 'false',
        enableRoulette: process.env.ENABLE_ROULETTE !== 'false',
        enableStats: process.env.ENABLE_STATS !== 'false',
        enableNotifications: process.env.ENABLE_NOTIFICATIONS !== 'false',
    },
    messages: {
        welcome: process.env.WELCOME_MESSAGE || 'Добро пожаловать в Telegram Food Bot! 🤖',
        noPermission: process.env.NO_PERMISSION_MESSAGE || 'У вас недостаточно прав для выполнения этой команды.',
        error: process.env.ERROR_MESSAGE || 'Произошла ошибка. Попробуйте позже.',
    },
};
function validateConfig() {
    const errors = [];
    if (!exports.botConfig.token) {
        errors.push('BOT_TOKEN is required');
    }
    if (exports.botConfig.mode === 'webhook' && !exports.botConfig.webhookUrl) {
        errors.push('BOT_WEBHOOK_URL is required for webhook mode');
    }
    if (exports.botConfig.polling.interval < 100) {
        errors.push('POLLING_INTERVAL must be at least 100ms');
    }
    if (exports.botConfig.limits.userRequestsPerMinute < 1) {
        errors.push('USER_RATE_LIMIT must be at least 1');
    }
    if (errors.length > 0) {
        throw new Error(`Bot configuration errors:\n${errors.join('\n')}`);
    }
}
validateConfig();
exports.default = exports.botConfig;
//# sourceMappingURL=bot.config.js.map