import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Регрессия 1: бэкенд требует Idempotency-Key на write-endpoint'ах
 * (POST /api/polls, /api/store-runs, /api/votes и др.). Без заголовка —
 * 400 IDEMPOTENCY_KEY_REQUIRED ещё до контроллера.
 *
 * Регрессия 2: двойной тап отправлял вторую мутацию до ответа на первую —
 * с новым ключом идемпотентности, то есть как отдельное действие.
 */

const { create, requestHandlers, client } = vi.hoisted(() => {
  const handlers: Array<(config: unknown) => unknown> = [];
  const instance = {
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
  };
  return { requestHandlers: handlers, client: instance, create: vi.fn(() => instance) };
});

vi.mock('axios', () => ({ default: { create, get: vi.fn() } }));

import { apiService } from '../api.service';

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

/** Промис, которым управляет тест: имитирует запрос «в полёте». */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
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

describe('apiService — защита от двойного тапа', () => {
  it('схлопывает повторную мутацию, пока первая в полёте', async () => {
    const first = deferred<{ data: unknown }>();
    client.post.mockReturnValueOnce(first.promise);

    const a = apiService.post('/store-runs', { storeName: 'Кб', collectMinutes: 15 });
    const b = apiService.post('/store-runs', { storeName: 'Кб', collectMinutes: 15 });

    expect(client.post).toHaveBeenCalledTimes(1);

    first.resolve({ data: { success: true, data: { id: 42 } } });
    await expect(a).resolves.toEqual({ success: true, data: { id: 42 } });
    await expect(b).resolves.toEqual({ success: true, data: { id: 42 } });
  });

  it('разные тела — разные действия, оба уходят на сервер', async () => {
    client.post.mockResolvedValue({ data: { success: true } });

    await Promise.all([
      apiService.post('/store-runs/1/items', { items: [{ name: 'Молоко' }] }),
      apiService.post('/store-runs/1/items', { items: [{ name: 'Хлеб' }] }),
    ]);

    expect(client.post).toHaveBeenCalledTimes(2);
  });

  it('после ответа тот же запрос снова уходит на сервер', async () => {
    client.post.mockResolvedValue({ data: { success: true } });

    await apiService.post('/votes', { pollId: 1, menuItemId: 2 });
    await apiService.post('/votes', { pollId: 1, menuItemId: 2 });

    expect(client.post).toHaveBeenCalledTimes(2);
  });

  it('ошибку получают оба вызова, а следующая попытка не блокируется', async () => {
    const failure = deferred<{ data: unknown }>();
    client.post.mockReturnValueOnce(failure.promise);

    const a = apiService.post('/feedback', { text: 'привет' });
    const b = apiService.post('/feedback', { text: 'привет' });
    failure.reject(new Error('network'));

    await expect(a).rejects.toThrow('network');
    await expect(b).rejects.toThrow('network');

    client.post.mockResolvedValueOnce({ data: { success: true } });
    await expect(apiService.post('/feedback', { text: 'привет' })).resolves.toEqual({
      success: true,
    });
    expect(client.post).toHaveBeenCalledTimes(2);
  });

  it('разные URL не смешиваются', async () => {
    const pending = deferred<{ data: unknown }>();
    client.post.mockReturnValue(pending.promise);

    void apiService.post('/store-runs/1/cancel', {});
    void apiService.post('/store-runs/2/cancel', {});

    expect(client.post).toHaveBeenCalledTimes(2);
    pending.resolve({ data: { success: true } });
  });

  it('GET не схлопывается — это забота react-query', async () => {
    client.get.mockResolvedValue({ data: { success: true, data: [] } });

    await Promise.all([apiService.get('/store-runs/active'), apiService.get('/store-runs/active')]);

    expect(client.get).toHaveBeenCalledTimes(2);
  });
});

/** Ключ идемпотентности из n-го вызова client.post. */
function sentKey(call: number): string | undefined {
  const config = client.post.mock.calls[call]?.[2] as
    | { headers?: Record<string, string> }
    | undefined;
  return config?.headers?.['Idempotency-Key'];
}

describe('apiService — стабильный ключ действия', () => {
  it('повтор после сетевой ошибки идёт с тем же ключом (сервер отдаст replay)', async () => {
    client.post.mockRejectedValueOnce({ success: false, code: 'NETWORK_ERROR' });
    await expect(apiService.post('/store-runs', { storeName: 'Кб' })).rejects.toBeTruthy();

    client.post.mockResolvedValueOnce({ data: { success: true } });
    await apiService.post('/store-runs', { storeName: 'Кб' });

    expect(sentKey(0)).toBeDefined();
    expect(sentKey(1)).toBe(sentKey(0));
  });

  it('5xx тоже неизвестный исход — ключ сохраняется', async () => {
    client.post.mockRejectedValueOnce({ status: 500 });
    await expect(apiService.post('/votes', { pollId: 1 })).rejects.toBeTruthy();

    client.post.mockResolvedValueOnce({ data: { success: true } });
    await apiService.post('/votes', { pollId: 1 });

    expect(sentKey(1)).toBe(sentKey(0));
  });

  it('409 «уже выполняется» — ключ сохраняется', async () => {
    client.post.mockRejectedValueOnce({ status: 409, code: 'IDEMPOTENCY_INFLIGHT' });
    await expect(apiService.post('/store-runs/1/settle', {})).rejects.toBeTruthy();

    client.post.mockResolvedValueOnce({ data: { success: true } });
    await apiService.post('/store-runs/1/settle', {});

    expect(sentKey(1)).toBe(sentKey(0));
  });

  it('после успеха следующее нажатие — новое действие с новым ключом', async () => {
    client.post.mockResolvedValue({ data: { success: true } });

    await apiService.post('/feedback', { text: 'ок' });
    await apiService.post('/feedback', { text: 'ок' });

    expect(sentKey(0)).toBeDefined();
    expect(sentKey(1)).not.toBe(sentKey(0));
  });

  it('после 4xx ключ не переиспользуется — сервер закешировал отказ', async () => {
    client.post.mockRejectedValueOnce({ status: 400, code: 'POLL_ALREADY_ACTIVE' });
    await expect(apiService.post('/polls', { title: 'Обед' })).rejects.toBeTruthy();

    client.post.mockResolvedValueOnce({ data: { success: true } });
    await apiService.post('/polls', { title: 'Обед' });

    expect(sentKey(1)).not.toBe(sentKey(0));
  });

  it('у разных действий ключи разные', async () => {
    client.post.mockResolvedValue({ data: { success: true } });

    await apiService.post('/store-runs/1/items', { items: [{ name: 'Молоко' }] });
    await apiService.post('/store-runs/1/items', { items: [{ name: 'Хлеб' }] });

    expect(sentKey(1)).not.toBe(sentKey(0));
  });
});
