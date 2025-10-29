"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInitDataMiddleware = validateInitDataMiddleware;
exports.requireAdminMiddleware = requireAdminMiddleware;
exports.optionalAuthMiddleware = optionalAuthMiddleware;
const crypto_1 = require("../../utils/crypto");
const user_service_1 = require("../../services/user.service");
const bot_config_1 = require("../../config/bot.config");
const logger_1 = require("../../utils/logger");
const error_1 = require("../../utils/error");
const userService = new user_service_1.UserService();
async function validateInitDataMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
            if (!authHeader) {
                logger_1.logger.warn('⚠️  SKIP_TELEGRAM_VALIDATION: No auth header - using test user');
                const testUserId = process.env.TEST_USER_ID || '123456789';
                const dbUser = await userService.createOrUpdate({
                    telegramId: BigInt(testUserId).toString(),
                    username: 'dev_user',
                    firstName: 'Dev',
                    lastName: 'User',
                });
                req.user = dbUser;
                req.telegramInitData = {
                    user: {
                        id: Number(testUserId),
                        first_name: 'Dev',
                        last_name: 'User',
                        username: 'dev_user',
                    },
                };
                logger_1.logger.info('✅ Dev user authenticated via SKIP_TELEGRAM_VALIDATION (no auth header)', {
                    userId: dbUser.id,
                    telegramId: testUserId
                });
                return next();
            }
            logger_1.logger.warn('⚠️  SKIP_TELEGRAM_VALIDATION активен - валидация отключена!');
            logger_1.logger.debug('Request from:', {
                origin: req.headers.origin,
                userAgent: req.headers['user-agent'],
                authorization: 'present'
            });
            const initData = (0, crypto_1.extractAuthHeader)(authHeader);
            if (initData) {
                const validation = (0, crypto_1.validateTelegramInitData)(initData, bot_config_1.botConfig.token);
                if (validation.data?.user) {
                    const dbUser = await userService.createOrUpdate({
                        telegramId: validation.data.user.id,
                        username: validation.data.user.username,
                        firstName: validation.data.user.first_name,
                        lastName: validation.data.user.last_name,
                    });
                    req.user = dbUser;
                    req.telegramInitData = validation.data;
                    logger_1.logger.info('✅ Real Telegram user (validation skipped)', {
                        userId: dbUser.id,
                        telegramId: dbUser.telegramId.toString(),
                        username: dbUser.username
                    });
                    return next();
                }
            }
            const testUserId = process.env.TEST_USER_ID || '123456789';
            const dbUser = await userService.createOrUpdate({
                telegramId: BigInt(testUserId).toString(),
                username: 'dev_user',
                firstName: 'Dev',
                lastName: 'User',
            });
            req.user = dbUser;
            req.telegramInitData = {
                user: {
                    id: Number(testUserId),
                    first_name: 'Dev',
                    last_name: 'User',
                    username: 'dev_user',
                },
            };
            logger_1.logger.info('✅ Dev user authenticated via SKIP_TELEGRAM_VALIDATION (fallback)', {
                userId: dbUser.id,
                telegramId: testUserId
            });
            return next();
        }
        if (!authHeader) {
            throw new error_1.AuthenticationError('Отсутствует заголовок Authorization');
        }
        const initData = (0, crypto_1.extractAuthHeader)(authHeader);
        if (!initData) {
            throw new error_1.AuthenticationError('Неверный формат заголовка Authorization');
        }
        const validation = (0, crypto_1.validateTelegramInitData)(initData, bot_config_1.botConfig.token);
        if (!validation.isValid || !validation.data) {
            throw new error_1.AuthenticationError('Невалидные данные Telegram');
        }
        const { user: telegramUser } = validation.data;
        if (!telegramUser) {
            throw new error_1.AuthenticationError('Отсутствуют данные пользователя');
        }
        const dbUser = await userService.createOrUpdate({
            telegramId: telegramUser.id,
            username: telegramUser.username,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
        });
        req.user = dbUser;
        req.telegramInitData = validation.data;
        logger_1.logger.debug('API пользователь аутентифицирован', {
            userId: dbUser.id,
            telegramId: dbUser.telegramId.toString(),
            username: dbUser.username,
        });
        next();
    }
    catch (error) {
        logger_1.logger.error('Ошибка валидации initData:', error);
        if (error instanceof error_1.AuthenticationError) {
            res.status(401).json({
                success: false,
                error: error.message,
                code: error.code,
                timestamp: new Date().toISOString(),
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Внутренняя ошибка сервера',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
}
async function requireAdminMiddleware(req, res, next) {
    try {
        if (!req.user) {
            throw new error_1.AuthenticationError('Пользователь не аутентифицирован');
        }
        const isAdmin = await userService.isAdmin(BigInt(req.user.telegramId));
        if (!isAdmin) {
            res.status(403).json({
                success: false,
                error: 'Недостаточно прав доступа',
                code: 'INSUFFICIENT_PERMISSIONS',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        logger_1.logger.debug('API администратор подтвержден', {
            userId: req.user.id,
            telegramId: req.user.telegramId.toString(),
        });
        next();
    }
    catch (error) {
        logger_1.logger.error('Ошибка проверки прав администратора:', error);
        res.status(403).json({
            success: false,
            error: 'Ошибка проверки прав доступа',
            code: 'AUTHORIZATION_ERROR',
            timestamp: new Date().toISOString(),
        });
    }
}
async function optionalAuthMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            next();
            return;
        }
        const initData = (0, crypto_1.extractAuthHeader)(authHeader);
        if (!initData) {
            next();
            return;
        }
        const validation = (0, crypto_1.validateTelegramInitData)(initData, bot_config_1.botConfig.token);
        if (validation.isValid && validation.data?.user) {
            const dbUser = await userService.createOrUpdate({
                telegramId: validation.data.user.id,
                username: validation.data.user.username,
                firstName: validation.data.user.first_name,
                lastName: validation.data.user.last_name,
            });
            req.user = dbUser;
            req.telegramInitData = validation.data;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Ошибка в опциональной аутентификации:', error);
        next();
    }
}
//# sourceMappingURL=validate-init-data.js.map