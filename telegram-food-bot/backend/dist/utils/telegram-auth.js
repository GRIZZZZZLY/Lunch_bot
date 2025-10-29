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
        console.log('📥 Original initData:', initData);
        const botToken = process.env.BOT_TOKEN;
        console.log('🔑 BOT_TOKEN runtime check:', {
            exists: !!botToken,
            length: botToken?.length || 0,
            first10: botToken?.substring(0, 10) || 'EMPTY',
            last10: botToken ? botToken.substring(botToken.length - 10) : 'EMPTY',
            nodeEnv: process.env.NODE_ENV,
            cwd: process.cwd()
        });
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
            hasHash: !!parsed.hash,
            hasSignature: !!parsed.signature
        });
        const isValid = verifyTelegramHash(parsed, botToken);
        const skipValidation = process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true';
        if (!isValid && !skipValidation) {
            logger_1.logger.warn('❌ Invalid Telegram hash - signature verification failed');
            return null;
        }
        if (!isValid && skipValidation) {
            logger_1.logger.warn('⚠️ Invalid Telegram hash - но разрешено в SKIP_TELEGRAM_VALIDATION режиме');
        }
        else if (isValid) {
            logger_1.logger.info('✅ Telegram hash verified successfully');
        }
        const authDate = parsed.auth_date * 1000;
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000;
        if (now - authDate > maxAge) {
            logger_1.logger.warn('⏰ InitData is too old', {
                authDate: new Date(authDate),
                now: new Date(now),
                ageHours: Math.round((now - authDate) / (60 * 60 * 1000)),
                maxAgeHours: 24,
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
        const rawPairs = {};
        const pairs = initData.split('&');
        for (const pair of pairs) {
            const eqIndex = pair.indexOf('=');
            if (eqIndex === -1)
                continue;
            const key = pair.substring(0, eqIndex);
            const rawValue = pair.substring(eqIndex + 1);
            rawPairs[key] = rawValue;
        }
        const params = new URLSearchParams(initData);
        const result = {
            _rawPairs: rawPairs,
        };
        for (const [key, value] of params.entries()) {
            if (key === 'user') {
                try {
                    result[key] = JSON.parse(value);
                    result['_userRaw'] = rawPairs['user'];
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
        if ((!result.hash && !result.signature) || !result.auth_date) {
            logger_1.logger.warn('Missing required fields in initData (hash/signature and auth_date)');
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
        console.log('📨 Received signature fields:', {
            hasSignature: !!data.signature,
            hasHash: !!data.hash,
            signatureLength: data.signature?.length || 0,
            hashLength: data.hash?.length || 0,
            usingField: data.hash ? 'hash (HMAC)' : 'signature (Ed25519)'
        });
        const receivedSignature = data.hash || data.signature;
        if (!receivedSignature) {
            logger_1.logger.warn('No signature or hash found in initData');
            return false;
        }
        const rawPairs = data._rawPairs || {};
        const { hash, signature, _userRaw, _rawPairs, ...params } = data;
        const dataCheckString = Object.keys(params)
            .filter(key => key !== 'hash' && key !== 'signature' && key !== '_userRaw' && key !== '_rawPairs')
            .sort()
            .map(key => {
            const rawValue = rawPairs[key];
            if (rawValue !== undefined) {
                return `${key}=${rawValue}`;
            }
            const value = params[key];
            if (typeof value === 'object') {
                return `${key}=${JSON.stringify(value)}`;
            }
            return `${key}=${value}`;
        })
            .join('\n');
        console.log('📝 DataCheckString:', {
            full: dataCheckString,
            length: dataCheckString.length,
            fields: Object.keys(params).sort(),
            usingRawPairs: !!Object.keys(rawPairs).length,
            rawPairsKeys: Object.keys(rawPairs),
            userValuePreview: rawPairs['user']?.substring(0, 100) + '...'
        });
        logger_1.logger.debug('🔍 Signature verification data:', {
            dataCheckString: dataCheckString,
            dataCheckStringLength: dataCheckString.length,
            receivedSignature: receivedSignature.substring(0, 20) + '...',
            receivedSignatureFull: receivedSignature,
            usingField: data.signature ? 'signature' : 'hash',
            signatureLength: receivedSignature.length,
            botTokenLength: botToken.length,
            fields: Object.keys(params).sort(),
        });
        let calculatedSignature;
        const secretKey = crypto_1.default
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();
        const calculatedHmac = crypto_1.default
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest();
        const usingHash = (receivedSignature === data.hash);
        if (!usingHash && data.signature) {
            const rawBase64 = calculatedHmac.toString('base64');
            calculatedSignature = rawBase64
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
        }
        else {
            calculatedSignature = calculatedHmac.toString('hex');
        }
        logger_1.logger.debug('🔍 Signature comparison:', {
            calculated: calculatedSignature.substring(0, 20) + '...',
            received: receivedSignature.substring(0, 20) + '...',
            format: usingHash ? 'hex (HMAC-SHA256)' : 'base64url (Ed25519)',
            match: calculatedSignature === receivedSignature,
        });
        console.log('🔍 SIGNATURE DEBUG:', {
            botTokenLength: botToken.length,
            calculatedFull: calculatedSignature,
            receivedFull: receivedSignature,
            format: usingHash ? 'hex (HMAC)' : 'base64url (Ed25519)',
            match: calculatedSignature === receivedSignature,
            dataCheckStringLength: dataCheckString.length,
            fields: Object.keys(params).sort()
        });
        const isMatch = calculatedSignature === receivedSignature;
        if (process.env.NODE_ENV === 'production' && process.env.SKIP_SIGNATURE_CHECK === 'true') {
            logger_1.logger.error('🚨 SECURITY BREACH: SKIP_SIGNATURE_CHECK enabled in PRODUCTION!');
            throw new Error('CRITICAL SECURITY ERROR: SKIP_SIGNATURE_CHECK must NEVER be enabled in production!');
        }
        if (!isMatch && process.env.SKIP_SIGNATURE_CHECK === 'true') {
            logger_1.logger.warn('⚠️ SIGNATURE MISMATCH but SKIP_SIGNATURE_CHECK=true - allowing!');
            logger_1.logger.warn('⚠️ Using REAL user data from Telegram despite signature mismatch');
            logger_1.logger.warn('⚠️ This should ONLY be used for debugging ngrok setup!');
            return true;
        }
        return isMatch;
    }
    catch (error) {
        logger_1.logger.error('Error verifying Telegram signature:', error);
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