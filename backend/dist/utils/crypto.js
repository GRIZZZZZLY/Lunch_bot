"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTelegramInitData = validateTelegramInitData;
exports.extractAuthHeader = extractAuthHeader;
exports.generateRandomToken = generateRandomToken;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.createWebhookSignature = createWebhookSignature;
exports.verifyWebhookSignature = verifyWebhookSignature;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("./logger");
function validateTelegramInitData(initData, botToken) {
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        if (!hash) {
            logger_1.logger.warn('Отсутствует hash в initData');
            return { isValid: false };
        }
        urlParams.delete('hash');
        const sortedParams = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
        const secretKey = crypto_1.default
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();
        const calculatedHash = crypto_1.default
            .createHmac('sha256', secretKey)
            .update(sortedParams)
            .digest('hex');
        const isValid = calculatedHash === hash;
        if (!isValid) {
            logger_1.logger.warn('Невалидный hash в initData', {
                calculated: calculatedHash,
                received: hash,
            });
            return { isValid: false };
        }
        const userData = urlParams.get('user');
        const authDate = urlParams.get('auth_date');
        if (!userData || !authDate) {
            logger_1.logger.warn('Отсутствуют обязательные данные в initData');
            return { isValid: false };
        }
        const authTimestamp = parseInt(authDate) * 1000;
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000;
        if (now - authTimestamp > maxAge) {
            logger_1.logger.warn('InitData устарел', {
                authDate: new Date(authTimestamp),
                now: new Date(now),
                ageHours: Math.round((now - authTimestamp) / (60 * 60 * 1000)),
            });
            return { isValid: false };
        }
        const parsedUserData = JSON.parse(decodeURIComponent(userData));
        return {
            isValid: true,
            data: {
                user: parsedUserData,
                auth_date: parseInt(authDate),
                query_id: urlParams.get('query_id'),
                chat: urlParams.get('chat') ? JSON.parse(decodeURIComponent(urlParams.get('chat'))) : undefined,
                chat_type: urlParams.get('chat_type'),
                chat_instance: urlParams.get('chat_instance'),
                start_param: urlParams.get('start_param'),
                can_send_after: urlParams.get('can_send_after') ? parseInt(urlParams.get('can_send_after')) : undefined,
            }
        };
    }
    catch (error) {
        logger_1.logger.error('Ошибка валидации initData:', error);
        return { isValid: false };
    }
}
function extractAuthHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('tma ')) {
        return null;
    }
    return authHeader.substring(4);
}
function generateRandomToken(length = 32) {
    return crypto_1.default.randomBytes(length).toString('hex');
}
function hashPassword(password) {
    const salt = crypto_1.default.randomBytes(16).toString('hex');
    const hash = crypto_1.default.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
    return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    const testHash = crypto_1.default.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
    return testHash === hash;
}
function createWebhookSignature(body, secretToken) {
    return crypto_1.default
        .createHmac('sha256', secretToken)
        .update(body)
        .digest('hex');
}
function verifyWebhookSignature(body, signature, secretToken) {
    try {
        if (!signature || signature.length !== 64 || !/^[0-9a-fA-F]+$/.test(signature)) {
            logger_1.logger.warn('Invalid webhook signature format', {
                signatureLength: signature?.length,
                expectedLength: 64,
                isHex: /^[0-9a-fA-F]+$/.test(signature || ''),
            });
            return false;
        }
        const expectedSignature = createWebhookSignature(body, secretToken);
        return crypto_1.default.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    }
    catch (error) {
        logger_1.logger.error('Error verifying webhook signature:', error);
        return false;
    }
}
//# sourceMappingURL=crypto.js.map