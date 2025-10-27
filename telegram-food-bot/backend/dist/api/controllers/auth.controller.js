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
exports.authController = exports.AuthController = void 0;
const user_service_1 = require("../../services/user.service");
const telegram_auth_1 = require("../../utils/telegram-auth");
const logger_1 = require("../../utils/logger");
const jwt_service_1 = require("../../services/jwt.service");
class AuthController {
    static async validateInitData(req, res) {
        try {
            const { initData } = req.body;
            if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
                logger_1.logger.info('🔓 SKIP_TELEGRAM_VALIDATION: extracting REAL user from initData');
                if (initData && initData.trim().length > 0 && initData !== 'mock_jwt_token_12345678') {
                    const { parseInitDataUnsafe } = await Promise.resolve().then(() => __importStar(require('../../utils/telegram-auth')));
                    const telegramUser = parseInitDataUnsafe(initData);
                    if (telegramUser) {
                        const user = await user_service_1.UserService.upsertUser({
                            telegramId: telegramUser.id.toString(),
                            username: telegramUser.username || `user_${telegramUser.id}`,
                            firstName: telegramUser.first_name,
                            lastName: telegramUser.last_name,
                            photoUrl: telegramUser.photo_url,
                        });
                        logger_1.logger.info('✅ SKIP mode: authenticated with REAL Telegram user', {
                            userId: user.id,
                            telegramId: telegramUser.id,
                            username: telegramUser.username
                        });
                        res.json({
                            success: true,
                            user: {
                                id: typeof user.id === 'bigint' ? Number(user.id) : user.id,
                                telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
                                username: user.username,
                                firstName: user.firstName,
                                lastName: user.lastName,
                                isAdmin: user.isAdmin,
                                isActive: user.isActive,
                                createdAt: user.createdAt,
                            },
                            token: generateJWT(user),
                        });
                        return;
                    }
                }
                logger_1.logger.warn('⚠️ SKIP_TELEGRAM_VALIDATION: No real initData - using TEST_USER_ID fallback');
                const testUserId = process.env.TEST_USER_ID || '123456789';
                const user = await user_service_1.UserService.upsertUser({
                    telegramId: testUserId,
                    username: 'dev_user',
                    firstName: 'Dev',
                    lastName: 'User',
                });
                logger_1.logger.info('✅ SKIP mode: fallback test user', {
                    userId: user.id,
                    telegramId: testUserId
                });
                res.json({
                    success: true,
                    user: {
                        id: typeof user.id === 'bigint' ? Number(user.id) : user.id,
                        telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
                        username: user.username,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        isAdmin: user.isAdmin,
                        isActive: user.isActive,
                        createdAt: user.createdAt,
                    },
                    token: generateJWT(user),
                });
                return;
            }
            if (!initData) {
                logger_1.logger.warn('❌ No initData provided');
                res.status(400).json({
                    success: false,
                    error: 'Missing initData',
                    code: 'INVALID_REQUEST'
                });
                return;
            }
            logger_1.logger.info('🔐 Validating initData...', {
                initDataLength: initData.length,
                nodeEnv: process.env.NODE_ENV,
            });
            const userData = (0, telegram_auth_1.validateTelegramInitData)(initData);
            if (!userData) {
                logger_1.logger.error('❌ InitData validation failed');
                res.status(401).json({
                    success: false,
                    error: 'Invalid initData',
                    code: 'INVALID_INIT_DATA'
                });
                return;
            }
            logger_1.logger.info('✅ InitData validated successfully', {
                userId: userData.id,
                username: userData.username,
            });
            const user = await user_service_1.UserService.upsertUser({
                telegramId: userData.id.toString(),
                username: userData.username,
                firstName: userData.first_name,
                lastName: userData.last_name,
                photoUrl: userData.photo_url,
            });
            logger_1.logger.info('User validated via initData', {
                userId: user.id,
                telegramId: userData.id.toString(),
                username: userData.username
            });
            res.json({
                success: true,
                user: {
                    id: typeof user.id === 'bigint' ? Number(user.id) : user.id,
                    telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    photoUrl: user.photoUrl,
                    isAdmin: user.isAdmin,
                    isActive: user.isActive,
                    createdAt: user.createdAt,
                },
                token: generateJWT(user),
            });
        }
        catch (error) {
            logger_1.logger.error('Error validating initData:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getCurrentUser(req, res) {
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
            res.json({
                success: true,
                data: {
                    id: typeof user.id === 'bigint' ? Number(user.id) : user.id,
                    telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    isAdmin: user.isAdmin,
                    isActive: user.isActive,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting current user:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getAuthStatus(req, res) {
        try {
            const user = req.user;
            res.json({
                success: true,
                authenticated: !!user,
                user: user ? {
                    id: typeof user.id === 'bigint' ? Number(user.id) : user.id,
                    telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
                    firstName: user.firstName,
                    isAdmin: user.isAdmin,
                    isActive: user.isActive,
                } : null,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error checking auth status:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async refreshAuth(req, res) {
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
            const freshUser = await user_service_1.UserService.getUserById(user.id);
            if (!freshUser || !freshUser.isActive) {
                res.status(401).json({
                    success: false,
                    error: 'User not found or inactive',
                    code: 'USER_NOT_ACTIVE'
                });
                return;
            }
            res.json({
                success: true,
                user: {
                    id: typeof freshUser.id === 'bigint' ? Number(freshUser.id) : freshUser.id,
                    telegramId: typeof freshUser.telegramId === 'bigint' ? freshUser.telegramId.toString() : freshUser.telegramId,
                    username: freshUser.username,
                    firstName: freshUser.firstName,
                    lastName: freshUser.lastName,
                    isAdmin: freshUser.isAdmin,
                    isActive: freshUser.isActive,
                    updatedAt: freshUser.updatedAt,
                },
                token: generateJWT(freshUser),
            });
        }
        catch (error) {
            logger_1.logger.error('Error refreshing auth:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
}
exports.AuthController = AuthController;
function generateJWT(user) {
    const payload = {
        userId: typeof user.id === 'bigint' ? Number(user.id) : user.id,
        telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
        username: user.username,
        isAdmin: user.isAdmin,
    };
    return jwt_service_1.JwtService.generateAccessToken(payload);
}
exports.authController = AuthController;
//# sourceMappingURL=auth.controller.js.map