"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
exports.requestLogger = requestLogger;
const logger_1 = require("../../utils/logger");
const error_1 = require("../../utils/error");
function errorHandler(err, req, res, next) {
    logger_1.logger.error('API Error:', (0, error_1.formatErrorForLogging)(err, {
        method: req.method,
        url: req.url,
        query: req.query,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
    }));
    if (res.headersSent) {
        return next(err);
    }
    if (err instanceof error_1.BaseError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code,
            timestamp: new Date().toISOString(),
        });
        return;
    }
    if (err.name === 'ValidationError') {
        res.status(422).json({
            success: false,
            error: 'Ошибка валидации данных',
            code: 'VALIDATION_ERROR',
            details: err.message,
            timestamp: new Date().toISOString(),
        });
        return;
    }
    if (err.name === 'PrismaClientKnownRequestError') {
        const prismaError = err;
        if (prismaError.code === 'P2002') {
            res.status(409).json({
                success: false,
                error: 'Запись с такими данными уже существует',
                code: 'DUPLICATE_ENTRY',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        if (prismaError.code === 'P2025') {
            res.status(404).json({
                success: false,
                error: 'Запись не найдена',
                code: 'NOT_FOUND',
                timestamp: new Date().toISOString(),
            });
            return;
        }
    }
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Внутренняя ошибка сервера'
            : err.message,
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
        }),
    });
}
function notFoundHandler(req, res, next) {
    res.status(404).json({
        success: false,
        error: `Маршрут ${req.method} ${req.url} не найден`,
        code: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
    });
}
function requestLogger(req, res, next) {
    const startTime = Date.now();
    const originalSend = res.send;
    res.send = function (body) {
        const duration = Date.now() - startTime;
        logger_1.logger.info('API Request', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            contentLength: res.get('Content-Length'),
        });
        return originalSend.call(this, body);
    };
    next();
}
//# sourceMappingURL=error-handler.js.map