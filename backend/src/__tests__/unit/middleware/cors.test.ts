/**
 * CORS. Мини-приложение живёт на другом origin, поэтому политика — не
 * формальность: слишком широкая отдаёт API любому сайту, слишком узкая ломает
 * запуск из Telegram.
 *
 * Ключевое, что здесь закреплено: разрешение по origin проверяется и в
 * development (раньше dev-режим пропускал всё), а запрос без origin проходит —
 * иначе отвалятся сам Telegram-клиент и серверные вызовы.
 */
import { corsMiddleware, telegramCorsMiddleware } from '../../../api/middleware/cors';
import { AuthorizationError } from '../../../utils/error';
import { mockRequest, mockResponse } from '../../helpers/http';
import type { MockResponse } from '../../helpers/http';

jest.mock('../../../config/api.config', () => ({
  apiConfig: {
    cors: { origin: ['https://app.example.com'] },
    corsOrigin: 'https://app.example.com, https://second.example.com',
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { logger } = jest.requireMock('../../../utils/logger');

type Cors = typeof corsMiddleware;

interface CorsResult {
  res: MockResponse;
  error: unknown;
  allowedOrigin?: string;
}

function check(
  middleware: Cors,
  origin: string | undefined,
  method = 'GET'
): Promise<CorsResult> {
  const req = mockRequest({
    method,
    headers: origin ? { origin } : {},
  });
  const res = mockResponse();
  return new Promise(resolve => {
    middleware(req, res, ((err?: unknown) => {
      resolve({
        res,
        error: err,
        allowedOrigin: res.headers['access-control-allow-origin'],
      });
    }) as never);
  });
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  envBackup = { ...process.env };
  process.env.NODE_ENV = 'production';
});

afterEach(() => {
  process.env = envBackup;
});

describe('corsMiddleware в production', () => {
  it('разрешённый origin получает заголовок доступа', async () => {
    const { error, allowedOrigin } = await check(
      corsMiddleware,
      'https://app.example.com'
    );

    expect(error).toBeUndefined();
    expect(allowedOrigin).toBe('https://app.example.com');
  });

  it('чужой origin отклоняется ошибкой авторизации', async () => {
    const { error } = await check(corsMiddleware, 'https://evil.example.com');

    expect(error).toBeInstanceOf(AuthorizationError);
    expect(logger.warn).toHaveBeenCalledWith(
      'CORS заблокировал запрос',
      expect.objectContaining({ origin: 'https://evil.example.com' })
    );
  });

  it('localhost в production не разрешён', async () => {
    const { error } = await check(corsMiddleware, 'http://localhost:5173');

    expect(error).toBeInstanceOf(AuthorizationError);
  });

  it('ngrok в production не разрешён', async () => {
    const { error } = await check(corsMiddleware, 'https://a1b2.ngrok-free.app');

    expect(error).toBeInstanceOf(AuthorizationError);
  });

  it('запрос без origin проходит: так ходят серверные и мобильные клиенты', async () => {
    const { error } = await check(corsMiddleware, undefined);

    expect(error).toBeUndefined();
  });

  it('preflight отвечает 200 и разрешает нужные заголовки', async () => {
    const req = mockRequest({
      method: 'OPTIONS',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'POST',
      },
    });
    const res = mockResponse();

    corsMiddleware(req, res, jest.fn() as never);

    expect(res.statusCode).toBe(200);
    expect(res.ended).toBe(true);
    expect(res.headers['access-control-allow-headers']).toContain(
      'Idempotency-Key'
    );
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});

describe('corsMiddleware в development', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  it.each([
    'http://localhost:5173',
    'http://127.0.0.1:5174',
    'http://localhost:4321',
    'https://a1b2.ngrok-free.app',
    'https://app.example.com',
  ])('%s разрешён', async origin => {
    const { error } = await check(corsMiddleware, origin);

    expect(error).toBeUndefined();
  });

  it('посторонний origin блокируется даже в development', async () => {
    const { error } = await check(corsMiddleware, 'https://evil.example.com');

    expect(error).toBeInstanceOf(AuthorizationError);
    expect(logger.warn).toHaveBeenCalledWith(
      'CORS: development режим, origin ЗАБЛОКИРОВАН',
      expect.objectContaining({ origin: 'https://evil.example.com' })
    );
  });

  it('похожий на localhost домен не проходит по регулярке', async () => {
    const { error } = await check(corsMiddleware, 'http://localhost.evil.com');

    expect(error).toBeInstanceOf(AuthorizationError);
  });
});

describe('telegramCorsMiddleware', () => {
  it('домены Telegram разрешены в production', async () => {
    const { error, allowedOrigin } = await check(
      telegramCorsMiddleware,
      'https://web.telegram.org'
    );

    expect(error).toBeUndefined();
    expect(allowedOrigin).toBe('https://web.telegram.org');
  });

  it.each([
    'https://k.web.telegram.org',
    'https://z.web.telegram.org',
    'https://a.web.telegram.org',
  ])('%s разрешён', async origin => {
    const { error } = await check(telegramCorsMiddleware, origin);

    expect(error).toBeUndefined();
  });

  it('origin из конфига разрешён вместе с доменами Telegram', async () => {
    const { error } = await check(
      telegramCorsMiddleware,
      'https://second.example.com'
    );

    expect(error).toBeUndefined();
  });

  it('чужой origin блокируется', async () => {
    const { error } = await check(
      telegramCorsMiddleware,
      'https://evil.example.com'
    );

    expect(error).toBeInstanceOf(AuthorizationError);
    expect(logger.warn).toHaveBeenCalledWith(
      'Telegram CORS заблокировал запрос',
      expect.objectContaining({ origin: 'https://evil.example.com' })
    );
  });

  it('запрос без origin проходит: Telegram WebApp его не присылает', async () => {
    const { error } = await check(telegramCorsMiddleware, undefined);

    expect(error).toBeUndefined();
  });

  it('credentials не включены: Telegram WebApp их не поддерживает', async () => {
    const { res } = await check(
      telegramCorsMiddleware,
      'https://web.telegram.org'
    );

    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('в development пропускает localhost, ngrok и telegram.org', async () => {
    process.env.NODE_ENV = 'development';

    for (const origin of [
      'http://localhost:5173',
      'https://a1b2.ngrok-free.app',
      'https://web.telegram.org',
      'https://second.example.com',
    ]) {
      const { error } = await check(telegramCorsMiddleware, origin);
      expect(error).toBeUndefined();
    }
  });

  it('в development посторонний origin блокируется', async () => {
    process.env.NODE_ENV = 'development';

    const { error } = await check(
      telegramCorsMiddleware,
      'https://evil.example.com'
    );

    expect(error).toBeInstanceOf(AuthorizationError);
    expect(logger.warn).toHaveBeenCalledWith(
      'Telegram CORS: development режим, origin ЗАБЛОКИРОВАН',
      expect.objectContaining({ origin: 'https://evil.example.com' })
    );
  });
});
