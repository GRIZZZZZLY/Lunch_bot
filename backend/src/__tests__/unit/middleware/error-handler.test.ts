/**
 * Единый обработчик ошибок. Внешний контракт — RFC 7807 problem+json плюс
 * legacy-зеркала (success/error), на которых до сих пор живёт фронт: сломать их
 * значит сломать показ ошибок во всём Mini App.
 *
 * Отдельно закреплено то, что легко потерять при рефакторинге:
 *  - в production в ответе и в логе нет текста внутренней ошибки и стека;
 *  - если заголовки уже отправлены (SSE, стрим файла), ошибка уходит в next,
 *    а не пытается писать второй ответ;
 *  - 413 и битый JSON от body-parser не превращаются в 500.
 */
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
} from '../../../api/middleware/error-handler';
import {
  BaseError,
  ValidationError,
  RateLimitError,
  NotFoundError,
  AuthorizationError,
} from '../../../utils/error';
import { mockRequest, mockResponse } from '../../helpers/http';
import type { MockRequest, MockResponse } from '../../helpers/http';

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { logger } = jest.requireMock('../../../utils/logger');

interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  traceId?: string;
  success: boolean;
  error: string;
  [key: string]: unknown;
}

function handle(
  err: Error,
  init: { path?: string; requestId?: string; headersSent?: boolean } = {}
): { res: MockResponse; next: jest.Mock; problem: Problem } {
  const req = mockRequest({
    path: init.path ?? '/api/menu',
    method: 'POST',
    extra: { requestId: init.requestId ?? 'req-1' },
  });
  const res = mockResponse();
  if (init.headersSent) {
    Object.defineProperty(res, 'headersSent', { value: true });
  }
  const next = jest.fn();
  errorHandler(err, req, res, next);
  return { res, next, problem: res.body as Problem };
}

function withStatus(err: Error, extra: Record<string, unknown>): Error {
  return Object.assign(err, extra);
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  envBackup = { ...process.env };
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  process.env = envBackup;
});

describe('errorHandler: общий контракт ответа', () => {
  it('problem+json содержит type, instance и traceId', () => {
    const { res, problem } = handle(new NotFoundError('Блюдо'), {
      path: '/api/menu/7',
      requestId: 'req-42',
    });

    expect(res.headers['content-type']).toBe(
      'application/problem+json; charset=utf-8'
    );
    expect(problem.type).toContain('not_found');
    expect(problem.instance).toBe('/api/menu/7');
    expect(problem.traceId).toBe('req-42');
  });

  it('legacy-поля success и error продолжают приходить', () => {
    const { problem } = handle(new AuthorizationError('Нет прав'));

    expect(problem.success).toBe(false);
    expect(problem.error).toBe('Нет прав');
  });

  it('любая ошибка логируется с методом и путём', () => {
    handle(new Error('boom'), { path: '/api/x' });

    expect(logger.error).toHaveBeenCalledWith(
      'API request failed',
      expect.objectContaining({
        context: expect.objectContaining({ method: 'POST', path: '/api/x' }),
      })
    );
  });

  it('уже отправленные заголовки передают ошибку дальше, а не пишут второй ответ', () => {
    const err = new Error('поток уже пошёл');

    const { next, res } = handle(err, { headersSent: true });

    expect(next).toHaveBeenCalledWith(err);
    expect(res.body).toBeUndefined();
  });
});

describe('errorHandler: ошибки разбора тела', () => {
  it('слишком большое тело отдаёт 413, а не 500', () => {
    const { res, problem } = handle(
      withStatus(new Error('too large'), { status: 413 })
    );

    expect(res.statusCode).toBe(413);
    expect(problem.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('413 распознаётся и по statusCode', () => {
    const { res } = handle(
      withStatus(new Error('too large'), { statusCode: 413 })
    );

    expect(res.statusCode).toBe(413);
  });

  it('413 распознаётся и по типу entity.too.large', () => {
    const { res } = handle(
      withStatus(new Error('too large'), { type: 'entity.too.large' })
    );

    expect(res.statusCode).toBe(413);
  });

  it('битый JSON отдаёт 400 с понятным кодом', () => {
    const { res, problem } = handle(
      withStatus(new SyntaxError('Unexpected token'), {
        type: 'entity.parse.failed',
      })
    );

    expect(res.statusCode).toBe(400);
    expect(problem.code).toBe('INVALID_REQUEST_BODY');
    expect(problem.detail).toBe('Request body is malformed');
  });

  it('оборванный запрос тоже 400', () => {
    const { res } = handle(
      withStatus(new Error('aborted'), { type: 'request.aborted' })
    );

    expect(res.statusCode).toBe(400);
  });

  it('400 от body-parser по status', () => {
    const { res } = handle(withStatus(new Error('bad'), { status: 400 }));

    expect(res.statusCode).toBe(400);
  });

  it('400 от body-parser по statusCode', () => {
    const { res } = handle(withStatus(new Error('bad'), { statusCode: 400 }));

    expect(res.statusCode).toBe(400);
  });

  it('текст внутренней ошибки разбора наружу не уходит', () => {
    const { problem } = handle(
      withStatus(new Error('/var/app/secret path in message'), { status: 400 })
    );

    expect(JSON.stringify(problem)).not.toContain('/var/app/secret');
  });
});

describe('errorHandler: собственные ошибки', () => {
  it('код и статус берутся из ошибки', () => {
    const { res, problem } = handle(new NotFoundError('Голосование'));

    expect(res.statusCode).toBe(404);
    expect(problem.code).toBe('NOT_FOUND_ERROR');
    expect(problem.title).toBe('NotFoundError');
  });

  it('ValidationError добавляет поле и значение', () => {
    const { res, problem } = handle(
      new ValidationError('Цена отрицательная', 'price', -5)
    );

    expect(res.statusCode).toBe(422);
    expect(problem.field).toBe('price');
    expect(problem.value).toBe(-5);
  });

  it('ValidationError без поля не добавляет пустых расширений', () => {
    const { problem } = handle(new ValidationError('Что-то не так'));

    expect(problem).not.toHaveProperty('field');
    expect(problem).not.toHaveProperty('value');
  });

  it('RateLimitError отдаёт Retry-After заголовком и в теле', () => {
    const { res, problem } = handle(new RateLimitError(90));

    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('90');
    expect(problem.retryAfter).toBe(90);
  });

  it('наследник BaseError с чужим кодом сохраняет его', () => {
    class PaymentRequiredError extends BaseError {
      constructor() {
        super('Нужна оплата', 402, 'PAYMENT_REQUIRED');
      }
    }

    const { res, problem } = handle(new PaymentRequiredError());

    expect(res.statusCode).toBe(402);
    expect(problem.code).toBe('PAYMENT_REQUIRED');
  });
});

describe('errorHandler: чужие ошибки', () => {
  it('ошибка с именем ValidationError отдаёт 422', () => {
    const err = new Error('zod: expected number');
    err.name = 'ValidationError';

    const { res, problem } = handle(err);

    expect(res.statusCode).toBe(422);
    expect(problem.code).toBe('VALIDATION_ERROR');
    expect(problem.detail).toBe('zod: expected number');
  });

  it('P2002 отдаёт 409 и называет конфликтующее поле', () => {
    const err = Object.assign(new Error('unique failed'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: { target: ['telegramId'] },
    });

    const { res, problem } = handle(err);

    expect(res.statusCode).toBe(409);
    expect(problem.code).toBe('DUPLICATE_ENTRY');
    expect(problem.target).toEqual(['telegramId']);
  });

  it('P2025 отдаёт 404', () => {
    const err = Object.assign(new Error('not found'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2025',
    });

    const { res, problem } = handle(err);

    expect(res.statusCode).toBe(404);
    expect(problem.code).toBe('NOT_FOUND');
    expect(problem.prismaCode).toBe('P2025');
  });

  it('незнакомая ошибка Prisma доходит до 500', () => {
    const err = Object.assign(new Error('deadlock'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2034',
    });

    const { res, problem } = handle(err);

    expect(res.statusCode).toBe(500);
    expect(problem.code).toBe('INTERNAL_ERROR');
  });

  it('неизвестная ошибка отдаёт 500', () => {
    const { res, problem } = handle(new Error('boom'));

    expect(res.statusCode).toBe(500);
    expect(problem.code).toBe('INTERNAL_ERROR');
  });
});

describe('errorHandler: production не раскрывает внутренности', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  it('текст внутренней ошибки заменяется общим', () => {
    const { problem } = handle(
      new Error('connect ECONNREFUSED 10.0.0.5:5432 as user postgres')
    );

    expect(problem.detail).toBe('Internal server error');
    expect(JSON.stringify(problem)).not.toContain('10.0.0.5');
  });

  it('стек не попадает в ответ', () => {
    const { problem } = handle(new Error('boom'));

    expect(problem).not.toHaveProperty('stack');
  });

  it('в лог идут только имя и код ошибки, без стека', () => {
    handle(Object.assign(new Error('boom'), { code: 'ECONNREFUSED' }));

    const [, payload] = logger.error.mock.calls[0];
    expect(payload).toEqual({
      requestId: 'req-1',
      method: 'POST',
      path: '/api/menu',
      errorName: 'Error',
      errorCode: 'ECONNREFUSED',
    });
  });

  it('для собственной ошибки в лог идёт её код', () => {
    handle(new NotFoundError('Блюдо'));

    const [, payload] = logger.error.mock.calls[0];
    expect(payload).toMatchObject({ errorCode: 'NOT_FOUND_ERROR' });
  });
});

describe('errorHandler: development помогает отладке', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  it('стек приходит в ответе', () => {
    const { problem } = handle(new Error('boom'));

    expect(typeof problem.stack).toBe('string');
    expect(problem.detail).toBe('boom');
  });
});

describe('notFoundHandler', () => {
  it('называет метод и путь ненайденного маршрута', () => {
    const req = mockRequest({
      method: 'DELETE',
      path: '/api/unknown',
      extra: { requestId: 'req-9' },
    });
    const res = mockResponse();

    notFoundHandler(req, res, jest.fn() as never);

    const problem = res.body as Problem;
    expect(res.statusCode).toBe(404);
    expect(problem.code).toBe('ROUTE_NOT_FOUND');
    expect(problem.detail).toBe('Маршрут DELETE /api/unknown не найден');
    expect(problem.traceId).toBe('req-9');
  });
});

describe('requestLogger', () => {
  function logged(res: MockResponse): Record<string, unknown> {
    const call = logger.info.mock.calls.find(
      (c: unknown[]) => c[0] === 'API Request'
    );
    expect(call).toBeDefined();
    void res;
    return call?.[1] as Record<string, unknown>;
  }

  function setup(): { req: MockRequest; res: MockResponse; next: jest.Mock } {
    const req = mockRequest({
      method: 'GET',
      path: '/api/menu',
      extra: { requestId: 'req-7' },
    });
    const res = mockResponse();
    const next = jest.fn();
    requestLogger(req, res, next);
    return { req, res, next };
  }

  it('пропускает запрос дальше сразу, не дожидаясь ответа', () => {
    const { next } = setup();

    expect(next).toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('пишет строку доступа при отправке ответа', () => {
    const { res } = setup();

    res.status(201).send({ ok: true });

    expect(logged(res)).toMatchObject({
      requestId: 'req-7',
      method: 'GET',
      statusCode: 201,
      path: '/api/menu',
    });
  });

  it('длительность указывается в миллисекундах', () => {
    const { res } = setup();

    res.send('ok');

    expect(logged(res).duration).toMatch(/^\d+ms$/);
  });

  it('тело ответа доходит до клиента без изменений', () => {
    const { res } = setup();

    res.send({ items: [1, 2] });

    expect(res.body).toEqual({ items: [1, 2] });
  });
});
