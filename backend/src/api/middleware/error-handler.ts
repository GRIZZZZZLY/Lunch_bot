import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { BaseError, formatErrorForLogging } from '../../utils/error';

/**
 * Middleware для обработки ошибок Express
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.requestId;

  // Логируем ошибку с контекстом включая requestId для трассировки
  logger.error('API Error:', formatErrorForLogging(err, {
    requestId,
    method: req.method,
    url: req.url,
    query: req.query,
    body: req.body,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  }));

  // Если ответ уже отправлен, передаем ошибку дальше
  if (res.headersSent) {
    return next(err);
  }

  // Обрабатываем кастомные ошибки
  if (err instanceof BaseError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Обрабатываем ошибки валидации Joi/Zod (если будут использоваться)
  if (err.name === 'ValidationError') {
    res.status(422).json({
      success: false,
      error: 'Ошибка валидации данных',
      code: 'VALIDATION_ERROR',
      details: err.message,
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Обрабатываем ошибки Prisma
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;

    if (prismaError.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: 'Запись с такими данными уже существует',
        code: 'DUPLICATE_ENTRY',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (prismaError.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Запись не найдена',
        code: 'NOT_FOUND',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Общая ошибка сервера
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Внутренняя ошибка сервера'
      : err.message,
    code: 'INTERNAL_ERROR',
    requestId,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  });
}

/**
 * Middleware для обработки 404 ошибок
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.status(404).json({
    success: false,
    error: `Маршрут ${req.method} ${req.url} не найден`,
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Middleware для логирования запросов
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  
  // Перехватываем окончание ответа
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;

    logger.info('API Request', {
      requestId: req.requestId,
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
