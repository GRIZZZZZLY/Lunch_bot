import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Регрессия: бэкенд требует Idempotency-Key на write-endpoint'ах
 * (POST /api/polls, /api/store-runs, /api/votes и др.). Без заголовка —
 * 400 IDEMPOTENCY_KEY_REQUIRED ещё до контроллера.
 */

const { create, requestHandlers } = vi.hoisted(() => {
  const handlers: Array<(config: unknown) => unknown> = [];
  return {
    requestHandlers: handlers,
    create: vi.fn(() => ({
      interceptors: {
        request: { use: (fn: (config: unknown) => unknown) => handlers.push(fn) },
        response: { use: vi.fn() },
      },
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
    })),
  };
});

vi.mock('axios', () => ({ default: { create, get: vi.fn() } }));

import '../api.service';

/** Минимальный стенд вместо AxiosHeaders — нужны только has/set/get. */
function makeConfig(method: string, headers: Record<string, string> = {}) {
  const store = new Map(Object.entries(headers));
  return {
    method,
    headers: {
      has: (name: string) => store.has(name),
      set: (name: string, value: string) => store.set(name, value),
      get: (name: string) => store.get(name),
    },
  };
}

function applyInterceptor(method: string, headers?: Record<string, string>) {
  const config = makeConfig(method, headers);
  for (const handler of requestHandlers) handler(config);
  return config.headers.get('Idempotency-Key');
}

beforeEach(() => {
  expect(requestHandlers.length).toBeGreaterThan(0);
});

describe('apiService — Idempotency-Key', () => {
  it.each(['post', 'POST', 'put', 'patch', 'delete'])('ставит ключ на %s', (method) => {
    const key = applyInterceptor(method);
    expect(key).toBeDefined();
    // Формат, который принимает бэкенд: 8..200 символов из [A-Za-z0-9_-:.]
    expect(key).toMatch(/^[A-Za-z0-9_\-:.]{8,200}$/);
  });

  it.each(['get', 'GET', 'head', 'options'])('не ставит ключ на %s', (method) => {
    expect(applyInterceptor(method)).toBeUndefined();
  });

  it('не перетирает уже выставленный ключ — ретрай должен попасть в replay', () => {
    expect(applyInterceptor('post', { 'Idempotency-Key': 'fixed-key-123456' })).toBe(
      'fixed-key-123456',
    );
  });

  it('генерит разные ключи для разных запросов', () => {
    expect(applyInterceptor('post')).not.toBe(applyInterceptor('post'));
  });
});
