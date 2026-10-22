/**
 * Rate limiting. Раньше здесь проверялось только то, что функции
 * экспортируются; это не отличало рабочий лимитер от отключённого.
 *
 * Теперь лимитеры действительно упираются в лимит: считается ключ (по
 * пользователю, а не по IP — иначе один офисный NAT съедает лимит всей
 * команды), проверяются исключения (health-check и SSE-поток не должны
 * обрываться) и код 429-ответа. Лимитер входа проверен на настоящем API в
 * integration/api/auth-surface.routes.test.ts.
 */
import type { RateLimitRequestHandler } from 'express-rate-limit';
import { metricsService } from '../../../services/metrics.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';
import type { MockRequest, MockResponse, MockRequestInit } from '../../helpers/http';

const RATE_LIMIT_MAX = 3;

jest.mock('../../../config/api.config', () => ({
  apiConfig: {
    security: {
      enableRateLimit: true,
      rateLimitWindowMs: 60 * 1000,
      rateLimitMax: 3,
      authRateLimitWindowMs: 15 * 60 * 1000,
      authRateLimitMax: 2,
    },
  },
}));

jest.mock('../../../services/metrics.service', () => ({
  metricsService: { incrementRateLimit429: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  generalLimiter,
  writeLimiter,
  voteLimiter,
  pollCreationLimiter,
  reminderLimiter,
  heavyOperationLimiter,
} from '../../../api/middleware/rate-limiter';

const metrics = asServiceMock(metricsService);

interface LimitBody {
  success: boolean;
  error: string;
  code: string;
  message: string;
}

/** Один проход через лимитер; возвращает ответ и признак пропуска. */
async function hit(
  limiter: RateLimitRequestHandler,
  init: MockRequestInit = {}
): Promise<{ req: MockRequest; res: MockResponse; passed: boolean }> {
  const req = mockRequest({ method: 'POST', path: '/api/test', ...init });
  const res = mockResponse();
  let passed = false;
  await new Promise<void>(resolve => {
    limiter(req, res, (() => {
      passed = true;
      resolve();
    }) as never);
    // Обработчик 429 отвечает сам и next не вызывает — ждём микрозадачи.
    setImmediate(resolve);
  });
  return { req, res, passed };
}

/**
 * Бьёт по лимитеру до первого 429, но не дольше attempts раз; возвращает
 * последний ответ. Точный лимит не закрепляется: важно, что срез наступает.
 */
async function hitUntilLimited(
  limiter: RateLimitRequestHandler,
  init: MockRequestInit,
  attempts = 200
): Promise<MockResponse> {
  let last: MockResponse = mockResponse();
  for (let i = 0; i < attempts; i++) {
    last = (await hit(limiter, init)).res;
    if (last.statusCode === 429) break;
  }
  return last;
}

let seq = 0;
/** Новый пользователь на каждый тест: у лимитеров общий стор на весь файл. */
function freshUser(): MockRequestInit {
  seq += 1;
  return { user: { id: 1000 + seq } };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('generalLimiter', () => {
  it('запросы в пределах лимита проходят', async () => {
    const who = freshUser();

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const { passed } = await hit(generalLimiter, who);
      expect(passed).toBe(true);
    }
  });

  it('превышение лимита отдаёт 429 с кодом', async () => {
    const who = freshUser();

    const res = await hitUntilLimited(generalLimiter, who, RATE_LIMIT_MAX + 1);
    const body = res.body as LimitBody;

    expect(res.statusCode).toBe(429);
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.success).toBe(false);
  });

  it('лимит считается по пользователю, а не по общему IP', async () => {
    const first = freshUser();
    const second = freshUser();

    await hitUntilLimited(generalLimiter, first, RATE_LIMIT_MAX + 1);
    const { passed } = await hit(generalLimiter, second);

    expect(passed).toBe(true);
  });

  it('анонимные запросы с одного IP делят лимит', async () => {
    const ip = { ip: `10.0.0.${(seq += 1)}` };

    await hitUntilLimited(generalLimiter, ip, RATE_LIMIT_MAX + 1);
    const { res } = await hit(generalLimiter, ip);

    expect(res.statusCode).toBe(429);
  });

  it('запрос без IP не роняет генератор ключа', async () => {
    const { passed } = await hit(generalLimiter, { ip: undefined as never });

    expect(passed).toBe(true);
  });

  it('health-check не лимитируется: мониторинг не должен получать 429', async () => {
    const who = { ...freshUser(), path: '/health' };

    for (let i = 0; i < RATE_LIMIT_MAX + 3; i++) {
      const { passed } = await hit(generalLimiter, who);
      expect(passed).toBe(true);
    }
  });

  it('SSE-поток не лимитируется: обрыв выглядел бы как потеря связи', async () => {
    const who = { ...freshUser(), path: '/api/events/stream' };

    for (let i = 0; i < RATE_LIMIT_MAX + 3; i++) {
      const { passed } = await hit(generalLimiter, who);
      expect(passed).toBe(true);
    }
  });

  it('чтение порядка категорий не лимитируется', async () => {
    const who = {
      ...freshUser(),
      method: 'GET',
      path: '/api/category-orders',
    };

    for (let i = 0; i < RATE_LIMIT_MAX + 3; i++) {
      const { passed } = await hit(generalLimiter, who);
      expect(passed).toBe(true);
    }
  });

  it('запись порядка категорий лимитируется', async () => {
    const who = {
      ...freshUser(),
      method: 'POST',
      path: '/api/category-orders',
    };

    const res = await hitUntilLimited(generalLimiter, who, RATE_LIMIT_MAX + 1);

    expect(res.statusCode).toBe(429);
  });

  it('сбой метрик не мешает вернуть 429', async () => {
    metrics.incrementRateLimit429.mockImplementation(() => {
      throw new Error('prometheus down');
    });
    const who = freshUser();

    const res = await hitUntilLimited(generalLimiter, who, RATE_LIMIT_MAX + 1);

    expect(res.statusCode).toBe(429);
  });
});

describe('writeLimiter', () => {
  it('GET-запросы не лимитируются', async () => {
    const who = { ...freshUser(), method: 'GET' };

    for (let i = 0; i < 35; i++) {
      const { passed } = await hit(writeLimiter, who);
      expect(passed).toBe(true);
    }
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s лимитируется', async method => {
    const who = { ...freshUser(), method };

    const res = await hitUntilLimited(writeLimiter, who);

    expect(res.statusCode).toBe(429);
  });
});

describe('лимитеры отдельных операций', () => {
  it.each([
    ['voteLimiter', () => voteLimiter, 'VOTE_RATE_LIMIT'],
    ['pollCreationLimiter', () => pollCreationLimiter, 'POLL_CREATION_LIMIT'],
    ['reminderLimiter', () => reminderLimiter, 'REMINDER_RATE_LIMIT'],
    ['heavyOperationLimiter', () => heavyOperationLimiter, 'RATE_LIMIT_EXCEEDED'],
  ])('%s срезает с кодом %s', async (_name, get, code) => {
    const who = freshUser();

    const res = await hitUntilLimited(get(), who);

    expect(res.statusCode).toBe(429);
    expect((res.body as LimitBody).code).toBe(code);
  });
});

describe('rate limit выключен в конфиге', () => {
  it('все лимитеры пропускают запросы без ограничений', async () => {
    jest.resetModules();
    jest.doMock('../../../config/api.config', () => ({
      apiConfig: {
        security: {
          enableRateLimit: false,
          rateLimitWindowMs: 60 * 1000,
          rateLimitMax: 1,
          authRateLimitWindowMs: 60 * 1000,
          authRateLimitMax: 1,
        },
      },
    }));

    const disabled = await import('../../../api/middleware/rate-limiter');

    for (const limiter of [
      disabled.generalLimiter,
      disabled.authLimiter,
      disabled.writeLimiter,
      disabled.voteLimiter,
      disabled.pollCreationLimiter,
      disabled.reminderLimiter,
      disabled.heavyOperationLimiter,
    ]) {
      for (let i = 0; i < 5; i++) {
        const { passed } = await hit(limiter, { user: { id: 1 } });
        expect(passed).toBe(true);
      }
    }
  });
});
