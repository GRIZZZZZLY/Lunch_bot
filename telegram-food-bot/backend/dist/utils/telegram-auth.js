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
const init_data_node_1 = require("@telegram-apps/init-data-node");
const logger_1 = require("./logger");
function validateTelegramInitData(initData) {
    try {
        logger_1.logger.info('🔐 Validating Telegram initData with @telegram-apps/init-data-node', {
            initDataLength: initData?.length || 0,
            initDataPreview: initData?.substring(0, 50) + '...'
        });
        const botToken = process.env.BOT_TOKEN;
        if (!botToken) {
            logger_1.logger.error('BOT_TOKEN not found in environment variables');
            return null;
        }
        const skipValidation = process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true';
        if (skipValidation) {
            logger_1.logger.warn('⚠️ SKIP_TELEGRAM_VALIDATION enabled - parsing without validation');
            try {
                const parsed = (0, init_data_node_1.parse)(initData);
                logger_1.logger.info('✅ initData parsed (validation skipped)', {
                    userId: parsed.user?.id,
                    username: parsed.user?.username,
                    firstName: parsed.user?.firstName,
                });
                return parsed.user ? {
                    id: parsed.user.id,
                    first_name: parsed.user.firstName,
                    last_name: parsed.user.lastName,
                    username: parsed.user.username,
                    photo_url: parsed.user.photoUrl,
                    language_code: parsed.user.languageCode,
                    is_premium: parsed.user.isPremium,
                    allows_write_to_pm: parsed.user.allowsWriteToPm,
                } : null;
            }
            catch (parseError) {
                logger_1.logger.error('Failed to parse initData even without validation:', parseError);
                return null;
            }
        }
        (0, init_data_node_1.validate)(initData, botToken, { expiresIn: 86400 });
        const parsed = (0, init_data_node_1.parse)(initData);
        logger_1.logger.info('✅ Telegram initData validated successfully', {
            userId: parsed.user?.id,
            username: parsed.user?.username,
            firstName: parsed.user?.firstName,
        });
        return parsed.user ? {
            id: parsed.user.id,
            first_name: parsed.user.firstName,
            last_name: parsed.user.lastName,
            username: parsed.user.username,
            photo_url: parsed.user.photoUrl,
            language_code: parsed.user.languageCode,
            is_premium: parsed.user.isPremium,
            allows_write_to_pm: parsed.user.allowsWriteToPm,
        } : null;
    }
    catch (error) {
        logger_1.logger.error('❌ Error validating Telegram initData:', error);
        return null;
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
            initDataPreview: initData?.substring(0, 100),
            looksLikeJWT: initData?.startsWith('eyJ'),
        });
        if (!initData || initData.trim().length === 0 || initData === 'mock_jwt_token_12345678') {
            logger_1.logger.warn('⚠️ Empty or mock initData - returning null');
            return null;
        }
        const params = new URLSearchParams(initData);
        const userStr = params.get('user');
        logger_1.logger.info('🔍 DEBUG: Parsed URLSearchParams', {
            hasUser: !!userStr,
            allKeys: Array.from(params.keys()),
            userStrPreview: userStr?.substring(0, 50),
        });
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