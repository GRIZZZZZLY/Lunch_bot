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
