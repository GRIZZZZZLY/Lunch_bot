"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramAuthMiddleware = telegramAuthMiddleware;
exports.adminMiddleware = adminMiddleware;
exports.validateInitDataMiddleware = validateInitDataMiddleware;
exports.optionalAuthMiddleware = optionalAuthMiddleware;
exports.refreshTokenMiddleware = refreshTokenMiddleware;
const user_service_1 = require("../../services/user.service");
const telegram_auth_1 = require("../../utils/telegram-auth");
const logger_1 = require("../../utils/logger");
const jwt_service_1 = require("../../services/jwt.service");
async function telegramAuthMiddleware(req, res, next) {
    try {
        if (process.env.NODE_ENV === 'production' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
            logger_1.logger.error('🚨 SECURITY BREACH: SKIP_TELEGRAM_VALIDATION enabled in PRODUCTION! Shutting down...');
            throw new Error('CRITICAL SECURITY ERROR: SKIP_TELEGRAM_VALIDATION must NEVER be enabled in production!');
        }
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
            logger_1.logger.warn('⚠️ SECURITY: SKIP_TELEGRAM_VALIDATION enabled - DEVELOPMENT ONLY!');
            logger_1.logger.info('🔓 SKIP_TELEGRAM_VALIDATION mode - extracting REAL user from initData');
            const authHeader = req.headers.authorization;
            let telegramUser = null;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const isJWT = token.startsWith('eyJ');
                logger_1.logger.info('🔍 SKIP mode: analyzing token', {
                    isJWT,
                    tokenLength: token.length,
                    tokenPreview: token.substring(0, 50)
                });
                if (isJWT) {
                    try {
                        const decoded = jwt_service_1.JwtService.verifyToken(token);
                        if (decoded && decoded.type === 'access') {
                            logger_1.logger.info('✅ SKIP mode: decoded JWT token', {
                                userId: decoded.userId,
                                telegramId: decoded.telegramId,
                            });
                            const user = await user_service_1.UserService.getUserById(decoded.userId);
                            if (user && user.isActive) {
                                req.user = user;
                                logger_1.logger.info('✅ SKIP mode: authenticated via JWT token', {
                                    userId: user.id,
                                    telegramId: user.telegramId.toString()
                                });
                                next();
                                return;
                            }
                        }
                        else {
                            logger_1.logger.warn('⚠️ Invalid JWT token type or expired');
                        }
                    }
                    catch (jwtError) {
                        logger_1.logger.warn('⚠️ Failed to verify JWT token', {
                            jwtError: jwtError instanceof Error ? jwtError.message : String(jwtError),
                        });
                    }
                }
                else {
                    try {
                        const { parseInitDataUnsafe } = await Promise.resolve().then(() => __importStar(require('../../utils/telegram-auth')));
                        telegramUser = parseInitDataUnsafe(token);
                        if (telegramUser) {
                            logger_1.logger.info('✅ SKIP mode: extracted user from initData', {
                                userId: telegramUser.id,
                                username: telegramUser.username,
                            });
                        }
                    }
                    catch (initDataError) {
                        logger_1.logger.warn('⚠️ Failed to parse initData', {
                            initDataError: initDataError instanceof Error ? initDataError.message : String(initDataError),
                        });
                    }
                }
            }
            if (telegramUser) {
                const dbUser = await user_service_1.UserService.getUserByTelegramId(BigInt(telegramUser.id));
                if (!dbUser) {
                    const newUser = await user_service_1.UserService.createUser({
                        telegramId: BigInt(telegramUser.id).toString(),
                        username: telegramUser.username || `user_${telegramUser.id}`,
                        firstName: telegramUser.first_name,
                        lastName: telegramUser.last_name,
                    });
                    req.user = newUser;
                    logger_1.logger.info('✅ SKIP mode: created new user with REAL Telegram ID', {
                        userId: newUser.id,
                        telegramId: telegramUser.id
                    });
                }
                else {
                    req.user = dbUser;
                    logger_1.logger.info('✅ SKIP mode: authenticated with REAL Telegram ID', {
                        userId: dbUser.id,
                        telegramId: telegramUser.id
                    });
                }
                next();
                return;
            }
            logger_1.logger.error('❌ CRITICAL: No real user data in initData!');
            logger_1.logger.error('❌ Cannot authenticate - this would mix votes from different users!');
            res.status(401).json({
                success: false,
                error: 'Telegram authentication required. Please open app inside Telegram.',
                code: 'MISSING_TELEGRAM_DATA'
            });
            return;
        }
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: 'Missing or invalid authorization header',
                code: 'MISSING_TOKEN'
            });
            return;
        }
        const token = authHeader.substring(7);
        let userData;
        try {
            const decoded = jwt_service_1.JwtService.verifyToken(token);
            if (!decoded) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid or expired token',
                    code: 'TOKEN_EXPIRED'
                });
                return;
            }
            if (decoded.type !== 'access') {
                res.status(401).json({
                    success: false,
                    error: 'Invalid token type. Use access token.',
                    code: 'INVALID_TOKEN_TYPE'
                });
                return;
            }
            const user = await user_service_1.UserService.getUserById(decoded.userId);
            if (!user || !user.isActive) {
                res.status(401).json({
                    success: false,
                    error: 'User not found or inactive',
                    code: 'USER_NOT_ACTIVE'
                });
                return;
            }
            userData = user;
            logger_1.logger.debug('✅ JWT token validated', {
                userId: decoded.userId,
                telegramId: decoded.telegramId,
            });
        }
        catch (error) {
            logger_1.logger.debug('JWT validation failed, trying as initData...');
            try {
                userData = (0, telegram_auth_1.validateTelegramInitData)(token);
                if (!userData) {
                    res.status(401).json({
                        success: false,
                        error: 'Invalid token',
                        code: 'INVALID_TOKEN'
                    });
                    return;
                }
                const dbUser = await user_service_1.UserService.getUserByTelegramId(BigInt(userData.id));
                if (!dbUser || !dbUser.isActive) {
                    res.status(401).json({
                        success: false,
                        error: 'User not found or inactive',
                        code: 'USER_NOT_ACTIVE'
                    });
                    return;
                }
                userData = dbUser;
                logger_1.logger.debug('✅ InitData validated (legacy path)');
            }
            catch (initDataError) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid token',
                    code: 'INVALID_TOKEN'
                });
                return;
            }
        }
        req.user = userData;
        next();
    }
    catch (error) {
        logger_1.logger.error('Telegram auth middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
}
async function adminMiddleware(req, res, next) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'User not authenticated',
                code: 'NOT_AUTHENTICATED'
            });
            return;
        }
        if (!user.isAdmin) {
            res.status(403).json({
                success: false,
                error: 'Admin access required',
                code: 'ACCESS_DENIED'
            });
            return;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Admin middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
}
async function validateInitDataMiddleware(req, res, next) {
    try {
        if (process.env.NODE_ENV === 'production' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
            logger_1.logger.error('🚨 SECURITY BREACH: SKIP_TELEGRAM_VALIDATION in PRODUCTION!');
            throw new Error('CRITICAL SECURITY ERROR: SKIP_TELEGRAM_VALIDATION forbidden in production!');
        }
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
            logger_1.logger.warn('⚠️ SECURITY: SKIP_TELEGRAM_VALIDATION enabled - DEVELOPMENT ONLY!');
            const { initData } = req.body;
            if (initData && initData.trim().length > 0) {
                try {
                    const { parseInitDataUnsafe } = await Promise.resolve().then(() => __importStar(require('../../utils/telegram-auth')));
                    const telegramUser = parseInitDataUnsafe(initData);
                    if (telegramUser && telegramUser.id) {
                        req.telegramUser = telegramUser;
                        logger_1.logger.info('✅ validateInitDataMiddleware: SKIP mode - REAL user from initData', {
                            userId: telegramUser.id,
                            firstName: telegramUser.first_name,
                            username: telegramUser.username
                        });
                        next();
                        return;
                    }
                }
                catch (parseError) {
                    logger_1.logger.error('❌ Failed to parse initData:', parseError);
                }
            }
            logger_1.logger.error('❌ validateInitDataMiddleware: No real user data in initData!');
            logger_1.logger.error('❌ Cannot authenticate - this would mix votes from different users!');
            res.status(401).json({
                success: false,
                error: 'Telegram authentication required. Please open app inside Telegram.',
                code: 'MISSING_TELEGRAM_DATA'
            });
            return;
        }
        const { initData } = req.body;
        if (!initData) {
            res.status(400).json({
                success: false,
                error: 'Missing initData in request body',
                code: 'MISSING_INIT_DATA'
            });
            return;
        }
        const userData = (0, telegram_auth_1.validateTelegramInitData)(initData);
        if (!userData) {
            res.status(400).json({
                success: false,
                error: 'Invalid initData',
                code: 'INVALID_INIT_DATA'
            });
            return;
        }
        req.telegramUser = userData;
        next();
    }
    catch (error) {
        logger_1.logger.error('InitData validation middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
}
async function optionalAuthMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            next();
            return;
        }
        const token = authHeader.substring(7);
        try {
            const decoded = jwt_service_1.JwtService.verifyToken(token);
            if (decoded && decoded.type === 'access') {
                const user = await user_service_1.UserService.getUserById(decoded.userId);
                if (user && user.isActive) {
                    req.user = user;
                }
            }
        }
        catch {
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Optional auth middleware error:', error);
        next();
    }
}
async function refreshTokenMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: 'Missing or invalid authorization header',
                code: 'MISSING_TOKEN'
            });
            return;
        }
        const token = authHeader.substring(7);
        try {
            const decoded = jwt_service_1.JwtService.verifyToken(token);
            if (!decoded) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid or expired refresh token',
                    code: 'TOKEN_EXPIRED'
                });
                return;
            }
            if (decoded.type !== 'refresh') {
                res.status(401).json({
                    success: false,
                    error: 'Invalid token type. Use refresh token.',
                    code: 'INVALID_TOKEN_TYPE'
                });
                return;
            }
            const user = await user_service_1.UserService.getUserById(decoded.userId);
            if (!user || !user.isActive) {
                res.status(401).json({
                    success: false,
                    error: 'User not found or inactive',
                    code: 'USER_NOT_ACTIVE'
                });
                return;
            }
            req.user = user;
            next();
        }
        catch (error) {
            res.status(401).json({
                success: false,
                error: 'Invalid refresh token',
                code: 'INVALID_TOKEN'
            });
            return;
        }
    }
    catch (error) {
        logger_1.logger.error('Refresh token middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
}
//# sourceMappingURL=telegram-auth.js.map