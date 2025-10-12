"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTelegramInitData = validateTelegramInitData;
exports.generateTestInitData = generateTestInitData;
exports.extractUserFromInitData = extractUserFromInitData;
exports.parseInitDataUnsafe = parseInitDataUnsafe;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("./logger");
function validateTelegramInitData(initData) {
    try {
        logger_1.logger.info('🔐 Validating Telegram initData', {
            initDataLength: initData?.length || 0,
            initDataPreview: initData?.substring(0, 50) + '...'
        });
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
        logger_1.logger.info('📝 Parsed initData', {
            hasUser: !!parsed.user,
            authDate: parsed.auth_date,
            hasHash: !!parsed.hash
        });
        const isValid = verifyTelegramHash(parsed, botToken);
        if (!isValid && process.env.NODE_ENV !== 'development') {
            logger_1.logger.warn('❌ Invalid Telegram hash - signature verification failed');
            return null;
        }
        if (!isValid && process.env.NODE_ENV === 'development') {
            logger_1.logger.warn('⚠️ Invalid Telegram hash - но разрешено в development режиме');
        }
        else {
            logger_1.logger.info('✅ Telegram hash verified successfully');
        }
        const authDate = parsed.auth_date * 1000;
        const now = Date.now();
        const maxAge = 60 * 60 * 1000;
        if (now - authDate > maxAge) {
            logger_1.logger.warn('⏰ InitData is too old', {
                authDate: new Date(authDate),
                now: new Date(now),
                ageMinutes: Math.round((now - authDate) / (60 * 1000)),
                maxAgeMinutes: 60,
            });
            return null;
        }
        logger_1.logger.info('✅ Telegram initData validated successfully', {
            userId: parsed.user?.id,
            username: parsed.user?.username,
            firstName: parsed.user?.first_name,
        });
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
        logger_1.logger.debug('🔍 Hash verification data:', {
            dataCheckString: dataCheckString.substring(0, 200) + '...',
            receivedHash: hash,
            botTokenLength: botToken.length,
        });
        const secretKey = crypto_1.default
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();
        const calculatedHash = crypto_1.default
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');
        logger_1.logger.debug('🔍 Hash comparison:', {
            calculated: calculatedHash,
            received: hash,
            match: calculatedHash === hash,
        });
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
function parseInitDataUnsafe(initData) {
    if (process.env.NODE_ENV === 'production') {
        const error = new Error('SECURITY ERROR: parseInitDataUnsafe MUST NOT be used in production! ' +
            'This function bypasses cryptographic signature validation and poses a critical security risk.');
        logger_1.logger.error('🚨 CRITICAL SECURITY VIOLATION:', {
            function: 'parseInitDataUnsafe',
            environment: process.env.NODE_ENV,
            stack: error.stack,
        });
        throw error;
    }
    try {
        logger_1.logger.info('🔓 Parsing initData in UNSAFE mode (dev only)', {
            initDataLength: initData?.length || 0,
        });
        if (!initData || initData.trim().length === 0 || initData === 'mock_jwt_token_12345678') {
            logger_1.logger.warn('⚠️ Empty or mock initData - returning null');
            return null;
        }
        const params = new URLSearchParams(initData);
        const userStr = params.get('user');
        if (!userStr) {
            logger_1.logger.warn('⚠️ No user data in initData');
            return null;
        }
        const user = JSON.parse(userStr);
        logger_1.logger.info('✅ Extracted user from initData (UNSAFE mode)', {
            userId: user.id,
            username: user.username,
            firstName: user.first_name,
        });
        return user;
    }
    catch (error) {
        logger_1.logger.error('❌ Error parsing initData in unsafe mode:', error);
        return null;
    }
}
//# sourceMappingURL=telegram-auth.js.map