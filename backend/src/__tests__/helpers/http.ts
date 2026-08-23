import type { Request, Response } from 'express';

/**
 * Заглушки Express-объектов для тестов контроллеров.
 *
 * Контроллеры вызываются напрямую, без сети и без роутера: это оставляет в
 * тесте только то, что он проверяет — код ответа, тело и аргументы, с которыми
 * вызван сервис.
 */

export type MockResponse = Response & {
  /** Код, переданный в res.status(); 200, если статус не выставляли. */
  statusCode: number;
  /** Тело последнего res.json() или res.send(). */
  body: unknown;
  /** Всё, что ушло через res.write() — для SSE. */
  written: string[];
  /** Заголовки, выставленные через setHeader (ключи в нижнем регистре). */
  headers: Record<string, string>;
  /** Путь последнего res.sendFile(). */
  sentFile?: string;
  ended: boolean;
  /** Обработчики, зарегистрированные через res.on(...). */
  listeners: Record<string, Array<(...args: unknown[]) => void>>;
};

export function mockResponse(): MockResponse {
  /* Собираем через any: точная сигнатура Express-методов (перегрузки Send,
     ServerResponse) в моке не нужна, а её удовлетворение стоит десятка
     приведений типов, которые ничего не проверяют. */
   
  const res: any = {
    statusCode: 200,
    body: undefined,
    written: [],
    headers: {},
    ended: false,
    locals: {},
    listeners: {},
    headersSent: false,
  };

  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });

  res.json = jest.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });

  res.send = jest.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });

  res.setHeader = jest.fn((name: string, value: unknown) => {
    res.headers[name.toLowerCase()] = String(value);
    return res;
  });

  res.getHeader = jest.fn((name: string) => res.headers[name.toLowerCase()]);

  /* Express-псевдоним getHeader: им пользуется requestLogger. */
  res.get = jest.fn((name: string) => res.headers[name.toLowerCase()]);

  res.removeHeader = jest.fn((name: string) => {
    delete res.headers[name.toLowerCase()];
  });

  res.write = jest.fn((chunk: unknown) => {
    res.written.push(String(chunk));
    return true;
  });

  res.end = jest.fn(() => {
    res.ended = true;
    return res;
  });

  res.sendFile = jest.fn(
    (filePath: string, callback?: (err?: Error) => void) => {
      res.sentFile = filePath;
      callback?.();
    }
  );

  res.set = jest.fn((field: unknown, value?: unknown) => {
    if (typeof field === 'string') {
      res.headers[field.toLowerCase()] = String(value);
    } else if (field && typeof field === 'object') {
      for (const [key, headerValue] of Object.entries(
        field as Record<string, unknown>
      )) {
        res.headers[key.toLowerCase()] = String(headerValue);
      }
    }
    return res;
  });

  res.on = jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    res.listeners[event] = res.listeners[event] ?? [];
    res.listeners[event].push(handler);
    return res;
  });

  /* SSE: writeHead выставляет статус и заголовки одним вызовом, а поток живёт
     до writableEnded/destroyed — обработчики проверяют их перед каждой
     записью. */
  res.writeHead = jest.fn(
    (code: number, headers?: Record<string, string | number>) => {
      res.statusCode = code;
      for (const [name, value] of Object.entries(headers ?? {})) {
        res.headers[name.toLowerCase()] = String(value);
      }
      res.headersSent = true;
      return res;
    }
  );
  res.writableEnded = false;
  res.destroyed = false;

  res.flushHeaders = jest.fn();
  res.type = jest.fn(() => res);
  res.contentType = jest.fn(() => res);
  res.once = jest.fn(() => res);
  res.removeListener = jest.fn(() => res);
  res.setTimeout = jest.fn(() => res);
  res.cookie = jest.fn(() => res);
  res.clearCookie = jest.fn(() => res);
  res.redirect = jest.fn(() => res);
  res.vary = jest.fn(() => res);

  return res as MockResponse;
}

export type MockNext = jest.Mock & {
  /** Ошибка, переданная в next(err); undefined, если next вызван без аргумента. */
  readonly error: unknown;
};

/**
 * Заглушка `next` для обработчиков, отдающих 500 через `next(err)`.
 *
 * Такой обработчик не формирует ответ сам — тело и статус собирает
 * `errorHandler`, и проверять их надо там, а не здесь. Тест контроллера
 * доказывает ДРУГОЕ: что ошибка не съедена и дошла до обработчика. Поэтому
 * `error` вынесен отдельным полем — `expect(next.error).toBeInstanceOf(Error)`
 * читается прямее, чем разбор `mock.calls`.
 */
export function mockNext(): MockNext {
  const next = jest.fn() as MockNext;
  Object.defineProperty(next, 'error', {
    get: () => next.mock.calls[0]?.[0],
  });
  return next;
}

type AnyHandler = (
  req: Request,
  res: Response,
  next: (error?: unknown) => void
) => unknown;

/**
 * Контроллер, соединённый с настоящим `errorHandler`, — как в приложении.
 *
 * Handler, переведённый на `next(err)`, сам ответ не формирует: статус, код и
 * legacy-поля собирает обработчик ошибок, смонтированный после маршрутов.
 * Тест, который вызывает handler с двумя аргументами, после такого перевода
 * либо падает на `next is not a function`, либо (если `next` передать пустым)
 * проверяет пустоту вместо ответа.
 *
 * Обёртка ставит на место `next` тот же `errorHandler`, поэтому существующие
 * утверждения про `res.statusCode` и `res.body` продолжают проверять то, что
 * увидит клиент, — и заодно становятся тестом делегирования: подмена 409 на 500
 * видна сразу, а не «когда-нибудь на проде».
 *
 * `errorHandler` импортируется здесь, а не принимается параметром: иначе каждый
 * набор тестов делал бы это сам, и один из них однажды передал бы не тот
 * обработчик.
 */
type Wrapped<T> = {
  [K in keyof T]: T[K] extends (req: Request, res: Response, ...rest: never[]) => unknown
    ? (req: Request, res: Response) => Promise<void>
    : T[K];
};

export function withErrorHandler<T extends object>(controller: T): Wrapped<T> {
  const { errorHandler } = require('../../api/middleware/error-handler') as {
    errorHandler: (
      err: Error,
      req: Request,
      res: Response,
      next: () => void
    ) => void;
  };

  const wrapped: Record<string, unknown> = {};

  for (const key of Object.getOwnPropertyNames(controller)) {
    const handler = (controller as Record<string, unknown>)[key];
    if (typeof handler !== 'function') continue;

    wrapped[key] = async (req: Request, res: Response): Promise<void> => {
      const toErrorHandler = (error: unknown): void => {
        errorHandler(error as Error, req, res, jest.fn());
      };

      /* Handler может и бросить (Express 5 сам передаёт отказ в обработчик
         ошибок), и вызвать `next(err)` — в приложении оба пути ведут в одно
         место, поэтому и здесь тоже. */
      try {
        await (handler as AnyHandler)(req, res, toErrorHandler);
      } catch (error) {
        toErrorHandler(error);
      }
    };
  }

  return wrapped as Wrapped<T>;
}

/** Вызывает обработчики, зарегистрированные через res.on(event). */
export function emit(res: MockResponse, event: string): void {
  for (const handler of res.listeners[event] ?? []) {
    handler();
  }
}

/**
 * Помечает поток закрытым, как это делает Node при обрыве соединения.
 * Оба поля объявлены readonly в типах Express, поэтому пишем через
 * defineProperty, а не присваиванием.
 */
export function markStreamClosed(
  res: MockResponse,
  how: 'ended' | 'destroyed' = 'ended'
): void {
  Object.defineProperty(res, how === 'ended' ? 'writableEnded' : 'destroyed', {
    value: true,
    configurable: true,
    writable: true,
  });
}

export interface MockRequestInit {
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  user?: { id: number; isAdmin?: boolean; [key: string]: unknown };
  method?: string;
  path?: string;
  ip?: string;
  /** Дополнительные поля, которые middleware кладёт в req. */
  extra?: Record<string, unknown>;
}

export type MockRequest = Request & {
  /** Обработчики, зарегистрированные через req.on(...) — для SSE-разрыва. */
  listeners: Record<string, Array<(...args: unknown[]) => void>>;
};

export function mockRequest(init: MockRequestInit = {}): MockRequest {
  const headers = Object.fromEntries(
    Object.entries(init.headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ])
  );

  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  return {
    params: init.params ?? {},
    query: init.query ?? {},
    body: init.body ?? {},
    headers,
    method: init.method ?? 'GET',
    path: init.path ?? '/',
    originalUrl: init.path ?? '/',
    url: init.path ?? '/',
    ip: init.ip ?? '127.0.0.1',
    user: init.user,
    get: (name: string) => headers[name.toLowerCase()],
    header: (name: string) => headers[name.toLowerCase()],
    listeners,
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(handler);
    }),
    socket: { remoteAddress: init.ip ?? '127.0.0.1' },
    ...(init.extra ?? {}),
  } as unknown as MockRequest;
}

/** Вызывает обработчики, зарегистрированные через req.on(event). */
export function emitRequest(req: MockRequest, event: string): void {
  for (const handler of req.listeners[event] ?? []) {
    handler();
  }
}

/** Аутентифицированный участник группы. */
export function memberRequest(init: MockRequestInit = {}): MockRequest {
  return mockRequest({ user: { id: 1, isAdmin: false }, ...init });
}

/** Аутентифицированный глобальный админ. */
export function adminRequest(init: MockRequestInit = {}): MockRequest {
  return mockRequest({ user: { id: 1, isAdmin: true }, ...init });
}
