import { logger } from './logger';

// Базовый класс для кастомных ошибок
export abstract class BaseError extends Error {
  public readonly isOperational: boolean;
  public readonly statusCode: number;
  public readonly code: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Ошибки валидации
export class ValidationError extends BaseError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any) {
    super(message, 422, 'VALIDATION_ERROR');
    this.field = field;
    this.value = value;
  }
}

// Ошибки аутентификации
export class AuthenticationError extends BaseError {
  constructor(message: string = 'Неверные данные аутентификации') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

// Ошибки авторизации
export class AuthorizationError extends BaseError {
  constructor(message: string = 'Недостаточно прав доступа') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

// Ошибки "не найдено"
export class NotFoundError extends BaseError {
  constructor(resource: string = 'Ресурс') {
    super(`${resource} не найден`, 404, 'NOT_FOUND_ERROR');
  }
}

// Ошибки конфликта
export class ConflictError extends BaseError {
  constructor(message: string = 'Конфликт данных') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

// Ошибки rate limiting
export class RateLimitError extends BaseError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super('Превышен лимит запросов', 429, 'RATE_LIMIT_ERROR');
    this.retryAfter = retryAfter;
  }
}

// Ошибки базы данных
export class DatabaseError extends BaseError {
  constructor(message: string = 'Ошибка базы данных', originalError?: Error) {
    super(message, 500, 'DATABASE_ERROR');
    
    if (originalError) {
      logger.error('Database error details:', {
        message: originalError.message,
        stack: originalError.stack,
      });
    }
  }
}

// Ошибки бота
export class BotError extends BaseError {
  public readonly isPublic: boolean;
  public readonly telegramId?: number;

  constructor(
    message: string,
    code: string = 'BOT_ERROR',
    isPublic: boolean = true,
    telegramId?: number
  ) {
    super(message, 400, code);
    this.isPublic = isPublic;
    this.telegramId = telegramId;
  }
}

// Специфические ошибки бота
export class UserNotFoundError extends BotError {
  constructor(telegramId?: number) {
    super(
      'Пользователь не найден',
      'USER_NOT_FOUND',
      false,
      telegramId
    );
  }
}

export class GroupNotFoundError extends BotError {
  constructor(telegramId?: number) {
    super(
      'Группа не найдена',
      'GROUP_NOT_FOUND',
      false,
      telegramId
    );
  }
}

export class MenuEmptyError extends BotError {
  constructor() {
    super(
      '📝 Меню пусто! Сначала добавьте блюда через команду /menu',
      'MENU_EMPTY'
    );
  }
}

export class PollNotFoundError extends BotError {
  constructor() {
    super(
      '❌ Активное голосование не найдено',
      'POLL_NOT_FOUND'
    );
  }
}

export class PollAlreadyActiveError extends BotError {
  constructor() {
    super(
      '⏰ В этой группе уже идет голосование!',
      'POLL_ALREADY_ACTIVE'
    );
  }
}

export class UserAlreadyVotedError extends BotError {
  constructor() {
    super(
      '✅ Вы уже проголосовали в этом голосовании!',
      'USER_ALREADY_VOTED'
    );
  }
}

export class InsufficientPermissionsError extends BotError {
  constructor() {
    super(
      '❌ Эта команда доступна только администраторам группы',
      'INSUFFICIENT_PERMISSIONS'
    );
  }
}

export class InvalidCallbackDataError extends BotError {
  constructor() {
    super(
      'Некорректные данные callback',
      'INVALID_CALLBACK_DATA',
      false
    );
  }
}

// Функция для определения типа ошибки
export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
}

// Функция для форматирования ошибки для логов
export function formatErrorForLogging(error: Error, context?: any) {
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

// Обработчик необработанных ошибок
export function setupErrorHandlers(): void {
  // Crash-fast pattern: log the cause, give async log transports a moment to
  // flush, then exit. Process supervisor (PM2/systemd) is expected to restart.
  // Continuing in an unknown state is worse than restarting cleanly.
  const fatalExit = (label: string, error: unknown): void => {
    try {
      const formatted =
        error instanceof Error ? formatErrorForLogging(error) : { error };
      logger.error(`${label}:`, formatted);
    } catch {
      // Last-resort fallback if logger itself fails
      console.error(`${label}:`, error);
    }
    // 1s grace period for winston file transports to flush, then hard exit.
    setTimeout(() => process.exit(1), 1_000).unref();
  };

  process.on('uncaughtException', (error: Error) => {
    fatalExit('Uncaught Exception', error);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    fatalExit('Unhandled Rejection', reason);
  });
}

// Middleware для обработки ошибок Express
export function errorHandler(
  err: Error,
  req: any,
  res: any,
  next: any
): void {
  logger.error('Express error:', formatErrorForLogging(err, {
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

  // Неизвестная ошибка
  res.status(500).json({
    success: false,
    error: 'Внутренняя ошибка сервера',
    code: 'INTERNAL_ERROR',
  });
}
