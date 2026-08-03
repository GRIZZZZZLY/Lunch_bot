/**
 * Иерархия ошибок. Её читают два разных потребителя: HTTP-обработчик (по
 * statusCode и code) и бот (по isPublic — можно ли показать текст человеку).
 * Поэтому проверяется соответствие класса и кода: перепутанный statusCode
 * превращает «нет прав» в «внутреннюю ошибку», а перепутанный isPublic
 * показывает участнику текст, написанный для лога.
 *
 * Отдельно закреплён fatalExit: при uncaughtException процесс намеренно падает
 * (crash-fast), но не мгновенно — есть секунда на сброс лог-транспортов.
 * Таймер unref'ится, иначе тесты и graceful shutdown висли бы лишнюю секунду.
 */
import {
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  BotError,
  UserNotFoundError,
  GroupNotFoundError,
  MenuEmptyError,
  PollNotFoundError,
  PollAlreadyActiveError,
  UserAlreadyVotedError,
  InsufficientPermissionsError,
  InvalidCallbackDataError,
  isOperationalError,
  formatErrorForLogging,
  setupErrorHandlers,
  errorHandler,
} from '../../../utils/error';
import { mockRequest, mockResponse } from '../../helpers/http';

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('коды и статусы', () => {
  it.each([
    [new ValidationError('плохо'), 422, 'VALIDATION_ERROR'],
    [new AuthenticationError(), 401, 'AUTHENTICATION_ERROR'],
    [new AuthorizationError(), 403, 'AUTHORIZATION_ERROR'],
    [new NotFoundError(), 404, 'NOT_FOUND_ERROR'],
    [new ConflictError(), 409, 'CONFLICT_ERROR'],
    [new RateLimitError(), 429, 'RATE_LIMIT_ERROR'],
    [new DatabaseError(), 500, 'DATABASE_ERROR'],
    [new BotError('ошибка бота'), 400, 'BOT_ERROR'],
  ])('$constructor.name → %p', (error, statusCode, code) => {
    expect(error.statusCode).toBe(statusCode);
    expect(error.code).toBe(code);
  });

  it('имя ошибки — имя класса, а не Error', () => {
    expect(new ValidationError('плохо').name).toBe('ValidationError');
    expect(new NotFoundError().name).toBe('NotFoundError');
  });

  it('все свои ошибки — операционные, то есть ожидаемые', () => {
    expect(isOperationalError(new NotFoundError())).toBe(true);
  });

  it('чужая ошибка операционной не считается', () => {
    expect(isOperationalError(new Error('boom'))).toBe(false);
  });

  it('операционность можно снять явно', () => {
    class FatalError extends BaseError {
      constructor() {
        super('всё плохо', 500, 'FATAL', false);
      }
    }

    expect(isOperationalError(new FatalError())).toBe(false);
  });

  it('стек начинается с места создания, а не с конструктора', () => {
    const error = new NotFoundError();

    expect(error.stack).toBeDefined();
    expect(error.stack).not.toContain('new NotFoundError');
  });
});

describe('тексты и поля', () => {
  it('NotFoundError называет ресурс', () => {
    expect(new NotFoundError('Голосование').message).toBe(
      'Голосование не найден'
    );
  });

  it('без ресурса NotFoundError говорит про «Ресурс»', () => {
    expect(new NotFoundError().message).toBe('Ресурс не найден');
  });

  it('ValidationError несёт поле и значение', () => {
    const error = new ValidationError('Цена отрицательная', 'price', -5);

    expect(error.field).toBe('price');
    expect(error.value).toBe(-5);
  });

  it('RateLimitError несёт время ожидания', () => {
    expect(new RateLimitError(90).retryAfter).toBe(90);
    expect(new RateLimitError().retryAfter).toBe(60);
  });

  it('DatabaseError логирует исходную ошибку, но наружу её не выносит', () => {
    const original = new Error('connect ECONNREFUSED 10.0.0.5:5432');

    const error = new DatabaseError('Ошибка базы данных', original);

    expect(error.message).not.toContain('10.0.0.5');
    expect(logger.error).toHaveBeenCalledWith('Database error details:', {
      message: original.message,
      stack: original.stack,
    });
  });

  it('DatabaseError без исходной ошибки ничего не логирует', () => {
    new DatabaseError();

    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('ошибки бота: что можно показать человеку', () => {
  it.each([
    [new MenuEmptyError(), 'MENU_EMPTY'],
    [new PollNotFoundError(), 'POLL_NOT_FOUND'],
    [new PollAlreadyActiveError(), 'POLL_ALREADY_ACTIVE'],
    [new UserAlreadyVotedError(), 'USER_ALREADY_VOTED'],
    [new InsufficientPermissionsError(), 'INSUFFICIENT_PERMISSIONS'],
  ])('%s показывается в чате', (error, code) => {
    expect(error.code).toBe(code);
    expect(error.isPublic).toBe(true);
    expect(error.message.length).toBeGreaterThan(0);
  });

  it.each([
    [new UserNotFoundError(), 'USER_NOT_FOUND'],
    [new GroupNotFoundError(), 'GROUP_NOT_FOUND'],
    [new InvalidCallbackDataError(), 'INVALID_CALLBACK_DATA'],
  ])('%s остаётся внутренней', (error, code) => {
    expect(error.code).toBe(code);
    expect(error.isPublic).toBe(false);
  });

  it('telegramId сохраняется для адресного ответа', () => {
    expect(new UserNotFoundError(555).telegramId).toBe(555);
    expect(new GroupNotFoundError(-1001).telegramId).toBe(-1001);
  });

  it('без telegramId поле остаётся пустым', () => {
    expect(new UserNotFoundError().telegramId).toBeUndefined();
  });
});

describe('formatErrorForLogging', () => {
  it('своя ошибка логируется с кодом, статусом и операционностью', () => {
    const formatted = formatErrorForLogging(new NotFoundError('Блюдо'), {
      requestId: 'req-1',
    });

    expect(formatted).toMatchObject({
      name: 'NotFoundError',
      message: 'Блюдо не найден',
      statusCode: 404,
      code: 'NOT_FOUND_ERROR',
      isOperational: true,
      context: { requestId: 'req-1' },
    });
  });

  it('чужая ошибка логируется без придуманных полей', () => {
    const formatted = formatErrorForLogging(new Error('boom'));

    expect(formatted).toEqual({
      name: 'Error',
      message: 'boom',
      stack: expect.any(String),
      context: undefined,
    });
  });

  it('стек попадает в лог', () => {
    expect(formatErrorForLogging(new Error('boom')).stack).toContain('Error');
  });

  /**
   * BotError — потомок BaseError, поэтому первая проверка перехватывает его, и
   * ветка с isPublic/telegramId недостижима. Тест закрепляет фактическое
   * поведение: в логе окажутся statusCode и code, а не isPublic.
   */
  it('ошибка бота логируется как своя, с кодом', () => {
    const formatted = formatErrorForLogging(new UserNotFoundError(555));

    expect(formatted).toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 400 });
    expect(formatted).not.toHaveProperty('isPublic');
  });
});

describe('errorHandler', () => {
  function handle(error: Error) {
    const req = mockRequest({ method: 'POST', path: '/api/menu' });
    const res = mockResponse();
    errorHandler(error, req, res, jest.fn());
    return { res, body: res.body as Record<string, unknown> };
  }

  it('своя ошибка отдаёт свой статус и код', () => {
    const { res, body } = handle(new NotFoundError('Блюдо'));

    expect(res.statusCode).toBe(404);
    expect(body).toMatchObject({
      success: false,
      error: 'Блюдо не найден',
      code: 'NOT_FOUND_ERROR',
    });
  });

  it('ValidationError добавляет поле и значение', () => {
    const { body } = handle(new ValidationError('Цена', 'price', -5));

    expect(body).toMatchObject({ field: 'price', value: -5 });
  });

  it('RateLimitError добавляет время ожидания', () => {
    const { body } = handle(new RateLimitError(120));

    expect(body).toMatchObject({ retryAfter: 120 });
  });

  it('неизвестная ошибка отдаёт 500 без внутреннего текста', () => {
    const { res, body } = handle(new Error('connect ECONNREFUSED 10.0.0.5'));

    expect(res.statusCode).toBe(500);
    expect(body).toEqual({
      success: false,
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR',
    });
  });

  it('запрос логируется с методом и путём', () => {
    handle(new Error('boom'));

    expect(logger.error).toHaveBeenCalledWith(
      'Express error:',
      expect.objectContaining({
        context: { method: 'POST', path: '/api/menu' },
      })
    );
  });
});

describe('setupErrorHandlers', () => {
  let onSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;
  const handlers = new Map<string, (arg: unknown) => void>();

  beforeEach(() => {
    handlers.clear();
    jest.useFakeTimers();
    onSpy = jest
      .spyOn(process, 'on')
      .mockImplementation(
        (event: string | symbol, handler: (...args: never[]) => void) => {
          handlers.set(String(event), handler as (arg: unknown) => void);
          return process;
        }
      );
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    onSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('подписывается на необработанные исключения и отказы', () => {
    setupErrorHandlers();

    expect([...handlers.keys()]).toEqual([
      'uncaughtException',
      'unhandledRejection',
    ]);
  });

  it('исключение логируется, и процесс падает не мгновенно', () => {
    setupErrorHandlers();

    handlers.get('uncaughtException')?.(new Error('boom'));

    expect(logger.error).toHaveBeenCalledWith(
      'Uncaught Exception:',
      expect.objectContaining({ message: 'boom' })
    );
    // Секунда на сброс логов — до неё выхода нет.
    expect(exitSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('отказ промиса не с Error тоже валит процесс', () => {
    setupErrorHandlers();

    handlers.get('unhandledRejection')?.('строка вместо ошибки');

    expect(logger.error).toHaveBeenCalledWith('Unhandled Rejection:', {
      error: 'строка вместо ошибки',
    });

    jest.advanceTimersByTime(1000);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('сбой самого логгера не мешает падению', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    logger.error.mockImplementation(() => {
      throw new Error('logger broken');
    });
    setupErrorHandlers();

    handlers.get('uncaughtException')?.(new Error('boom'));

    expect(consoleSpy).toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    logger.error.mockReset();
  });

  it('таймер выхода не удерживает процесс', () => {
    setupErrorHandlers();
    const timers: Array<{ unref: jest.Mock }> = [];
    const setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation(() => {
        const timer = { unref: jest.fn() };
        timers.push(timer);
        return timer as unknown as NodeJS.Timeout;
      });

    handlers.get('uncaughtException')?.(new Error('boom'));

    expect(timers[0].unref).toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});
