"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramAuthMiddleware = telegramAuthMiddleware;
exports.adminMiddleware = adminMiddleware;
exports.validateInitDataMiddleware = validateInitDataMiddleware;
exports.optionalAuthMiddleware = optionalAuthMiddleware;
const user_service_1 = require("../../services/user.service");
const telegram_auth_1 = require("../../utils/telegram-auth");
const logger_1 = require("../../utils/logger");
async function telegramAuthMiddleware(req, res, next) {
    try {
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
            const testUserId = process.env.TEST_USER_ID || '123456789';
            const dbUser = await user_service_1.UserService.getUserByTelegramId(BigInt(testUserId));
            if (!dbUser) {
                const newUser = await user_service_1.UserService.createUser({
                    telegramId: BigInt(testUserId),
                    username: 'dev_user',
                    firstName: 'Dev',
                    lastName: 'User',
                });
                req.user = newUser;
            }
            else {
                req.user = dbUser;
            }
            logger_1.logger.info('✅ telegramAuthMiddleware: SKIP mode - test user', {
                userId: req.user.id,
                telegramId: testUserId
            });
            next();
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
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
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
        }
        catch {
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
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
            const testUserId = process.env.TEST_USER_ID || '123456789';
            req.telegramUser = {
                id: Number(testUserId),
                first_name: 'Dev',
                last_name: 'User',
                username: 'dev_user',
            };
            logger_1.logger.info('✅ validateInitDataMiddleware: SKIP mode - test user');
            next();
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
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
            const user = await user_service_1.UserService.getUserById(decoded.userId);
            if (user && user.isActive) {
                req.user = user;
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
//# sourceMappingURL=telegram-auth.js.map