"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidCallbackDataError = exports.InsufficientPermissionsError = exports.UserAlreadyVotedError = exports.PollAlreadyActiveError = exports.PollNotFoundError = exports.MenuEmptyError = exports.GroupNotFoundError = exports.UserNotFoundError = exports.BotError = exports.DatabaseError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.BaseError = void 0;
exports.isOperationalError = isOperationalError;
exports.formatErrorForLogging = formatErrorForLogging;
exports.setupErrorHandlers = setupErrorHandlers;
exports.errorHandler = errorHandler;
const logger_1 = require("./logger");
class BaseError extends Error {
    isOperational;
    statusCode;
    code;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.BaseError = BaseError;
class ValidationError extends BaseError {
    field;
    value;
    constructor(message, field, value) {
        super(message, 422, 'VALIDATION_ERROR');
        this.field = field;
        this.value = value;
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends BaseError {
    constructor(message = 'Неверные данные аутентификации') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends BaseError {
    constructor(message = 'Недостаточно прав доступа') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends BaseError {
    constructor(resource = 'Ресурс') {
        super(`${resource} не найден`, 404, 'NOT_FOUND_ERROR');
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends BaseError {
    constructor(message = 'Конфликт данных') {
        super(message, 409, 'CONFLICT_ERROR');
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends BaseError {
    retryAfter;
    constructor(retryAfter = 60) {
        super('Превышен лимит запросов', 429, 'RATE_LIMIT_ERROR');
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
class DatabaseError extends BaseError {
    constructor(message = 'Ошибка базы данных', originalError) {
        super(message, 500, 'DATABASE_ERROR');
        if (originalError) {
            logger_1.logger.error('Database error details:', {
                message: originalError.message,
                stack: originalError.stack,
            });
        }
    }
}
exports.DatabaseError = DatabaseError;
class BotError extends BaseError {
    isPublic;
    telegramId;
    constructor(message, code = 'BOT_ERROR', isPublic = true, telegramId) {
        super(message, 400, code);
        this.isPublic = isPublic;
        this.telegramId = telegramId;
    }
}
exports.BotError = BotError;
class UserNotFoundError extends BotError {
    constructor(telegramId) {
        super('Пользователь не найден', 'USER_NOT_FOUND', false, telegramId);
    }
}
exports.UserNotFoundError = UserNotFoundError;
class GroupNotFoundError extends BotError {
    constructor(telegramId) {
        super('Группа не найдена', 'GROUP_NOT_FOUND', false, telegramId);
    }
}
exports.GroupNotFoundError = GroupNotFoundError;
class MenuEmptyError extends BotError {
    constructor() {
        super('📝 Меню пусто! Сначала добавьте блюда через команду /menu', 'MENU_EMPTY');
    }
}
exports.MenuEmptyError = MenuEmptyError;
class PollNotFoundError extends BotError {
    constructor() {
        super('❌ Активное голосование не найдено', 'POLL_NOT_FOUND');
    }
}
exports.PollNotFoundError = PollNotFoundError;
class PollAlreadyActiveError extends BotError {
    constructor() {
        super('⏰ В этой группе уже идет голосование!', 'POLL_ALREADY_ACTIVE');
    }
}
exports.PollAlreadyActiveError = PollAlreadyActiveError;
class UserAlreadyVotedError extends BotError {
    constructor() {
        super('✅ Вы уже проголосовали в этом голосовании!', 'USER_ALREADY_VOTED');
    }
}
exports.UserAlreadyVotedError = UserAlreadyVotedError;
class InsufficientPermissionsError extends BotError {
    constructor() {
        super('❌ Эта команда доступна только администраторам группы', 'INSUFFICIENT_PERMISSIONS');
    }
}
exports.InsufficientPermissionsError = InsufficientPermissionsError;
class InvalidCallbackDataError extends BotError {
    constructor() {
        super('Некорректные данные callback', 'INVALID_CALLBACK_DATA', false);
    }
}
exports.InvalidCallbackDataError = InvalidCallbackDataError;
function isOperationalError(error) {
    if (error instanceof BaseError) {
        return error.isOperational;
    }
    return false;
}
function formatErrorForLogging(error, context) {
    const errorInfo = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        context,
    };
    if (error instanceof BaseError) {
        return {
            ...errorInfo,
            statusCode: error.statusCode,
            code: error.code,
            isOperational: error.isOperational,
        };
    }
    if (error instanceof BotError) {
        return {
            ...errorInfo,
            isPublic: error.isPublic,
            telegramId: error.telegramId,
        };
    }
    return errorInfo;
}
function setupErrorHandlers() {
    process.on('uncaughtException', (error) => {
        logger_1.logger.error('Uncaught Exception:', formatErrorForLogging(error));
        process.exit(1);
    });
    process.on('unhandledRejection', (reason, promise) => {
        logger_1.logger.error('Unhandled Rejection at:', {
            promise,
            reason: reason instanceof Error ? formatErrorForLogging(reason) : reason,
        });
    });
}
function errorHandler(err, req, res, next) {
    logger_1.logger.error('Express error:', formatErrorForLogging(err, {
        method: req.method,
        url: req.url,
        body: req.body,
        query: req.query,
    }));
    if (err instanceof BaseError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code,
            ...(err instanceof ValidationError && {
                field: err.field,
                value: err.value,
            }),
            ...(err instanceof RateLimitError && {
                retryAfter: err.retryAfter,
            }),
        });
        return;
    }
    res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера',
        code: 'INTERNAL_ERROR',
    });
}
