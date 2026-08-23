import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { BaseError, formatErrorForLogging, ValidationError, RateLimitError } from '../../utils/error';
import type { ApiErrorCode } from '../error-codes';
import { RequestValidationError } from './validate';
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

  logger.error(
    'API request failed',
    process.env.NODE_ENV === 'production'
      ? {
          requestId,
          method: req.method,
          path: req.path,
          errorName: err.name,
          errorCode:
            err instanceof BaseError
              ? err.code
              : (err as { code?: unknown }).code,
        }
      : formatErrorForLogging(err, {
          requestId,
          method: req.method,
          path: req.path,
        })
  );

  if (res.headersSent) {
    return next(err);
  }

  const instance = req.path;

  // 1) Ошибки разбора тела запроса от body-parser/Express.
  const parserError = err as Error & {
    status?: number;
    statusCode?: number;
    type?: string;
  };
  if (
    parserError.status === 413 ||
    parserError.statusCode === 413 ||
    parserError.type === 'entity.too.large'
  ) {
    sendProblem(
      res,
      makeProblem({
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        title: 'Payload too large',
        detail: 'Request body exceeds the allowed size',
        instance,
        traceId: requestId,
      })
    );
    return;
  }
  if (
    parserError.status === 400 ||
    parserError.statusCode === 400 ||
    parserError.type === 'entity.parse.failed' ||
    parserError.type === 'request.aborted'
  ) {
    sendProblem(
      res,
      makeProblem({
        status: 400,
        code: 'INVALID_REQUEST_BODY',
        title: 'Invalid request body',
        detail: 'Request body is malformed',
        instance,
        traceId: requestId,
      })
    );
    return;
  }

  // 2) Наши собственные ошибки (BaseError и потомки).
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
    /* Разбор входа может сработать и в контроллере — если middleware контракта
       на маршруте не отработал. Ответ обязан быть тем же самым, включая
       `errors[]`: иначе один и тот же невалидный запрос давал бы клиенту два
       разных тела в зависимости от того, кто его поймал. */
    if (err instanceof RequestValidationError) {
      extensions.errors = err.issues;
    }

    sendProblem(
      res,
      makeProblem({
        /* Единственное место, где `code` НЕ проверяется типом, и это осознанно.
           `BaseError` открыт для наследования: подкласс объявляет свой код, и
           тест `error-handler.test.ts` («наследник BaseError с чужим кодом
           сохраняет его») закрепляет это как свойство. Попытка сузить здесь
           через `isApiErrorCode` его сломала — код подменялся на
           INTERNAL_ERROR. Гарантию даёт не тип, а тест словаря: он собирает
           коды из классов ошибок и требует для каждого текст на фронте. */
        status: err.statusCode,
        code: err.code as ApiErrorCode,
        title: err.name,
        detail: err.message,
        instance,
        traceId: requestId,
        extensions,
      }),
    );
    return;
  }

  // 3) Zod / generic ValidationError по name (для legacy импортов).
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

  // 4) Prisma известные ошибки.
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

  // 5) Fallback — 500.
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
      detail: `Маршрут ${req.method} ${req.path} не найден`,
      instance: req.path,
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
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      path: req.path,
      contentLength: res.get('Content-Length'),
    });

    return originalSend.call(this, body);
  };
  
  next();
}
