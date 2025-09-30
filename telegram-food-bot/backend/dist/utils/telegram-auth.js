"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTelegramInitData = validateTelegramInitData;
exports.generateTestInitData = generateTestInitData;
exports.extractUserFromInitData = extractUserFromInitData;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("./logger");
function validateTelegramInitData(initData) {
    try {
        const botToken = process.env.BOT_TOKEN;
        if (!botToken) {
            logger_1.logger.error('BOT_TOKEN not found in environment variables');
            return null;
        }
        const parsed = parseInitData(initData);
        if (!parsed) {
            logger_1.logger.warn('Failed to parse initData');
            return null;
        }
        const isValid = verifyTelegramHash(parsed, botToken);
        if (!isValid) {
            logger_1.logger.warn('Invalid Telegram hash');
            return null;
        }
        const authDate = parsed.auth_date * 1000;
        const now = Date.now();
        const maxAge = 60 * 60 * 1000;
        if (now - authDate > maxAge) {
            logger_1.logger.warn('InitData is too old', {
                authDate: new Date(authDate),
                now: new Date(now),
                ageMs: now - authDate,
            });
            return null;
        }
        return parsed.user || null;
    }
    catch (error) {
        logger_1.logger.error('Error validating Telegram initData:', error);
        return null;
    }
}
function parseInitData(initData) {
    try {
        const params = new URLSearchParams(initData);
        const result = {};
        for (const [key, value] of params.entries()) {
            if (key === 'user') {
                try {
                    result[key] = JSON.parse(value);
                }
                catch {
                    logger_1.logger.warn('Failed to parse user data from initData');
                    return null;
                }
            }
            else if (key === 'auth_date') {
                result[key] = parseInt(value);
            }
            else {
                result[key] = value;
            }
        }
        if (!result.hash || !result.auth_date) {
            logger_1.logger.warn('Missing required fields in initData');
            return null;
        }
        return result;
    }
    catch (error) {
        logger_1.logger.error('Error parsing initData:', error);
        return null;
    }
}
function verifyTelegramHash(data, botToken) {
    try {
        const { hash, ...params } = data;
        const dataCheckString = Object.keys(params)
            .filter(key => key !== 'hash')
            .sort()
            .map(key => {
            const value = params[key];
            if (typeof value === 'object') {
                return `${key}=${JSON.stringify(value)}`;
            }
            return `${key}=${value}`;
        })
            .join('\n');
        const secretKey = crypto_1.default
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();
        const calculatedHash = crypto_1.default
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');
        return calculatedHash === hash;
    }
    catch (error) {
        logger_1.logger.error('Error verifying Telegram hash:', error);
        return false;
    }
}
function generateTestInitData(userId, firstName, username) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('generateTestInitData should not be used in production');
    }
    const user = {
        id: userId,
        first_name: firstName,
        username: username,
        language_code: 'ru',
    };
    const authDate = Math.floor(Date.now() / 1000);
    const params = {
        user: JSON.stringify(user),
        auth_date: authDate.toString(),
    };
    const dataCheckString = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('\n');
    const botToken = process.env.BOT_TOKEN || 'test_token';
    const secretKey = crypto_1.default
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();
    const hash = crypto_1.default
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
    const initData = new URLSearchParams({
        ...params,
        hash,
    }).toString();
    logger_1.logger.info('Generated test initData', {
        userId,
        firstName,
        username,
        authDate: new Date(authDate * 1000),
    });
    return initData;
}
function extractUserFromInitData(initData) {
    try {
        const params = new URLSearchParams(initData);
        const userStr = params.get('user');
        if (!userStr) {
            return null;
        }
        return JSON.parse(userStr);
    }
    catch (error) {
        logger_1.logger.error('Error extracting user from initData:', error);
        return null;
    }
}
//# sourceMappingURL=telegram-auth.js.map