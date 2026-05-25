import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { BaseError, formatErrorForLogging, ValidationError, RateLimitError } from '../../utils/error';
import { sendProblem, makeProblem } from '../../utils/problem';

/**
 * P1-6: Express error handler возвращает RFC 7807 problem+json.
 * Внешний контракт: { type, title, status, detail, instance, code, traceId, ...extensions }.
 * Legacy-поля (success: false, error) проставляются автоматически через makeProblem
 * — фронт продолжает работать без миграции.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = req.requestId;

  logger.error('API Error:', formatErrorForLogging(err, {
    requestId,
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

  const instance = req.url;

  // 1) Наши собственные ошибки (BaseError и потомки).
  if (err instanceof BaseError) {
    const extensions: Record<string, unknown> = {};
    if (err instanceof ValidationError) {
      if (err.field !== undefined) extensions.field = err.field;
      if (err.value !== undefined) extensions.value = err.value;
    }
    if (err instanceof RateLimitError) {
      extensions.retryAfter = err.retryAfter;
      res.setHeader('Retry-After', String(err.retryAfter));
    }

    sendProblem(
      res,
      makeProblem({
        status: err.statusCode,
        code: err.code,
        title: err.name,
        detail: err.message,
        instance,
        traceId: requestId,
        extensions,
      }),
    );
    return;
  }

  // 2) Zod / generic ValidationError по name (для legacy импортов).
  if (err.name === 'ValidationError') {
    sendProblem(
      res,
      makeProblem({
        status: 422,
        code: 'VALIDATION_ERROR',
        title: 'Validation failed',
        detail: err.message,
        instance,
        traceId: requestId,
      }),
    );
    return;
  }

  // 3) Prisma известные ошибки.
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;

    if (prismaError.code === 'P2002') {
      sendProblem(
        res,
        makeProblem({
          status: 409,
          code: 'DUPLICATE_ENTRY',
          title: 'Conflict',
          detail: 'Record with these data already exists',
          instance,
          traceId: requestId,
          extensions: { prismaCode: prismaError.code, target: prismaError.meta?.target },
        }),
      );
      return;
    }

    if (prismaError.code === 'P2025') {
      sendProblem(
        res,
        makeProblem({
          status: 404,
          code: 'NOT_FOUND',
          title: 'Not found',
          detail: 'Record not found',
          instance,
          traceId: requestId,
          extensions: { prismaCode: prismaError.code },
        }),
      );
      return;
    }
  }

  // 4) Fallback — 500.
  sendProblem(
    res,
    makeProblem({
      status: 500,
      code: 'INTERNAL_ERROR',
      title: 'Internal server error',
      detail: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      instance,
      traceId: requestId,
      extensions:
        process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
    }),
  );
}

/**
 * Middleware для обработки 404 ошибок (роут не найден).
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  sendProblem(
    res,
    makeProblem({
      status: 404,
      code: 'ROUTE_NOT_FOUND',
      title: 'Not found',
      detail: `Маршрут ${req.method} ${req.url} не найден`,
      instance: req.url,
      traceId: req.requestId,
    }),
  );
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
