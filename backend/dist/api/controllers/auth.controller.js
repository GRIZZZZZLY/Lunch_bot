"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const user_service_1 = require("../../services/user.service");
const telegram_auth_1 = require("../../utils/telegram-auth");
const logger_1 = require("../../utils/logger");
class AuthController {
    static async validateInitData(req, res) {
        try {
            const { initData } = req.body;
            if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
                if (!initData || initData.trim().length === 0 || initData === 'mock_jwt_token_12345678') {
                    logger_1.logger.warn('⚠️  SKIP_TELEGRAM_VALIDATION: Empty initData - creating test user');
                    const testUserId = process.env.TEST_USER_ID || '123456789';
                    const user = await user_service_1.UserService.upsertUser({
                        telegramId: testUserId,
                        username: 'dev_user',
                        firstName: 'Dev',
                        lastName: 'User',
                    });
                    logger_1.logger.info('✅ Test user created via SKIP_TELEGRAM_VALIDATION', {
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
            }
            if (!initData) {
                res.status(400).json({
                    success: false,
                    error: 'Missing initData',
                    code: 'INVALID_REQUEST'
                });
                return;
            }
            const userData = (0, telegram_auth_1.validateTelegramInitData)(initData);
            if (!userData) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid initData',
                    code: 'INVALID_INIT_DATA'
                });
                return;
            }
            const user = await user_service_1.UserService.upsertUser({
                telegramId: userData.id.toString(),
                username: userData.username,
                firstName: userData.first_name,
                lastName: userData.last_name,
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
                user: {
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
        isAdmin: user.isAdmin,
        timestamp: Date.now(),
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
}
exports.authController = AuthController;
//# sourceMappingURL=auth.controller.js.map