import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Транспорт переехал с axios на fetch — гарантии остались те же, и тесты
 * проверяют именно их, а не библиотеку:
 *
 * Регрессия 1: бэкенд требует Idempotency-Key на write-endpoint'ах
 * (POST /api/polls, /api/store-runs, /api/votes и др.). Без заголовка —
 * 400 IDEMPOTENCY_KEY_REQUIRED ещё до контроллера.
 *
 * Регрессия 2: двойной тап отправлял вторую мутацию до ответа на первую —
 * с новым ключом идемпотентности, то есть как отдельное действие.
 */

const fetchMock = vi.fn();

import { apiService } from '../api.service';
import { useAppStore } from '@/store/useAppStore';

function ok(body: unknown = { success: true }) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

function fail(status: number, body: unknown = {}) {
  return { ok: false, status, text: async () => JSON.stringify(body) };
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

function init(call: number): RequestInit | undefined {
  return fetchMock.mock.calls[call]?.[1] as RequestInit | undefined;
}

/** Ключ идемпотентности из n-го обращения к сети. */
function sentKey(call: number): string | undefined {
  return (init(call)?.headers as Record<string, string> | undefined)?.['Idempotency-Key'];
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(ok());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiService — Idempotency-Key', () => {
  it.each([
    ['post', () => apiService.post('/polls', { a: 1 })],
    ['put', () => apiService.put('/polls/1', { a: 1 })],
    ['patch', () => apiService.patch('/polls/1', { a: 1 })],
    ['delete', () => apiService.delete('/polls/1')],
  ])('ставит ключ на %s', async (_name, run) => {
    await run();
    const key = sentKey(0);
    expect(key).toBeDefined();
    // Формат, который принимает бэкенд: 8..200 символов из [A-Za-z0-9_-:.]
    expect(key).toMatch(/^[A-Za-z0-9_\-:.]{8,200}$/);
  });

  it('не ставит ключ на get', async () => {
    await apiService.get('/polls/active');
    expect(sentKey(0)).toBeUndefined();
    expect(init(0)?.method).toBe('GET');
  });

  it('не перетирает уже выставленный ключ — ретрай должен попасть в replay', async () => {
    await apiService.post('/polls', { a: 1 }, { headers: { 'Idempotency-Key': 'fixed-key-123456' } });
    expect(sentKey(0)).toBe('fixed-key-123456');
  });

  it('генерит разные ключи для разных запросов', async () => {
    await apiService.post('/polls', { a: 1 });
    await apiService.post('/polls', { a: 2 });
    expect(sentKey(0)).toBeDefined();
    expect(sentKey(1)).not.toBe(sentKey(0));
  });
});

describe('apiService — защита от двойного тапа', () => {
  it('схлопывает повторную мутацию, пока первая в полёте', async () => {
    const first = deferred<ReturnType<typeof ok>>();
    fetchMock.mockReturnValueOnce(first.promise);

    const a = apiService.post('/store-runs', { storeName: 'Кб', collectMinutes: 15 });
    const b = apiService.post('/store-runs', { storeName: 'Кб', collectMinutes: 15 });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    first.resolve(ok({ success: true, data: { id: 42 } }));
    await expect(a).resolves.toEqual({ success: true, data: { id: 42 } });
    await expect(b).resolves.toEqual({ success: true, data: { id: 42 } });
  });

  it('разные тела — разные действия, оба уходят на сервер', async () => {
    await Promise.all([
      apiService.post('/store-runs/1/items', { items: [{ name: 'Молоко' }] }),
      apiService.post('/store-runs/1/items', { items: [{ name: 'Хлеб' }] }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('после ответа тот же запрос снова уходит на сервер', async () => {
    await apiService.post('/votes', { pollId: 1, menuItemId: 2 });
    await apiService.post('/votes', { pollId: 1, menuItemId: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ошибку получают оба вызова, а следующая попытка не блокируется', async () => {
    const failure = deferred<ReturnType<typeof ok>>();
    fetchMock.mockReturnValueOnce(failure.promise);

    const a = apiService.post('/feedback', { text: 'привет' });
    const b = apiService.post('/feedback', { text: 'привет' });
    failure.reject(new TypeError('Failed to fetch'));

    await expect(a).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    await expect(b).rejects.toMatchObject({ code: 'NETWORK_ERROR' });

    await expect(apiService.post('/feedback', { text: 'привет' })).resolves.toEqual({
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('разные URL не смешиваются', async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    fetchMock.mockReturnValue(pending.promise);

    void apiService.post('/store-runs/1/cancel', {});
    void apiService.post('/store-runs/2/cancel', {});

    expect(fetchMock).toHaveBeenCalledTimes(2);
    pending.resolve(ok());
  });

  it('GET не схлопывается — это забота react-query', async () => {
    await Promise.all([apiService.get('/store-runs/active'), apiService.get('/store-runs/active')]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('apiService — стабильный ключ действия', () => {
  it('повтор после сетевой ошибки идёт с тем же ключом (сервер отдаст replay)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(apiService.post('/store-runs', { storeName: 'Кб' })).rejects.toBeTruthy();

    await apiService.post('/store-runs', { storeName: 'Кб' });

    expect(sentKey(0)).toBeDefined();
    expect(sentKey(1)).toBe(sentKey(0));
  });

  it('5xx тоже неизвестный исход — ключ сохраняется', async () => {
    fetchMock.mockResolvedValueOnce(fail(500));
    await expect(apiService.post('/votes', { pollId: 1 })).rejects.toBeTruthy();

    await apiService.post('/votes', { pollId: 1 });

    expect(sentKey(1)).toBe(sentKey(0));
  });

  it('409 «уже выполняется» — ключ сохраняется', async () => {
    fetchMock.mockResolvedValueOnce(fail(409, { code: 'IDEMPOTENCY_INFLIGHT' }));
    await expect(apiService.post('/store-runs/1/settle', {})).rejects.toBeTruthy();

    await apiService.post('/store-runs/1/settle', {});

    expect(sentKey(1)).toBe(sentKey(0));
  });

  it('после успеха следующее нажатие — новое действие с новым ключом', async () => {
    await apiService.post('/feedback', { text: 'ок' });
    await apiService.post('/feedback', { text: 'ок' });

    expect(sentKey(0)).toBeDefined();
    expect(sentKey(1)).not.toBe(sentKey(0));
  });

  it('после 4xx ключ не переиспользуется — сервер закешировал отказ', async () => {
    fetchMock.mockResolvedValueOnce(fail(400, { code: 'POLL_ALREADY_ACTIVE' }));
    await expect(apiService.post('/polls', { title: 'Обед' })).rejects.toBeTruthy();

    await apiService.post('/polls', { title: 'Обед' });

    expect(sentKey(1)).not.toBe(sentKey(0));
  });

  it('у разных действий ключи разные', async () => {
    await apiService.post('/store-runs/1/items', { items: [{ name: 'Молоко' }] });
    await apiService.post('/store-runs/1/items', { items: [{ name: 'Хлеб' }] });

    expect(sentKey(1)).not.toBe(sentKey(0));
  });
});

/**
 * Refresh-токен и явный Authorization.
 *
 * Задача 3: клиент никогда не сохранял refreshToken и слал access-токен на
 * /auth/refresh, где сервер требует type === 'refresh' — сессия умирала
 * через час без возможности восстановиться. Здесь фиксируется контракт
 * транспорта: refresh-токен живёт в sessionStorage под своим ключом,
 * clearToken сносит оба, а config.headers.Authorization не теряется под
 * access-токеном — иначе refresh-токен до сервера не доедет.
 */
describe('apiService — refresh-токен и явный Authorization', () => {
  afterEach(() => {
    apiService.clearToken();
  });

  it('setRefreshToken/getRefreshToken читают и пишут независимо от access-токена', () => {
    expect(apiService.getRefreshToken()).toBeNull();
    apiService.setRefreshToken('r-1');
    expect(apiService.getRefreshToken()).toBe('r-1');
  });

  it('clearToken очищает и access-, и refresh-токен', () => {
    apiService.setToken('a-1');
    apiService.setRefreshToken('r-1');
    apiService.clearToken();
    expect(apiService.getToken()).toBeNull();
    expect(apiService.getRefreshToken()).toBeNull();
  });

  it('явный Authorization из config не перетирается access-токеном', async () => {
    apiService.setToken('access');
    await apiService.post('/auth/refresh', undefined, { headers: { Authorization: 'Bearer refresh' } });
    const [, reqInit] = fetchMock.mock.calls[0];
    expect((reqInit as RequestInit).headers).toMatchObject({ Authorization: 'Bearer refresh' });
  });
});

describe('apiService — форма ошибки и таймаут', () => {
  it('HTTP-ошибка приходит с error, code и status', async () => {
    fetchMock.mockResolvedValueOnce(fail(403, { error: 'Нет доступа', code: 'FORBIDDEN' }));
    await expect(apiService.get('/store-runs/1')).rejects.toMatchObject({
      success: false,
      error: 'Нет доступа',
      code: 'FORBIDDEN',
      status: 403,
    });
  });

  it('пустое тело ошибки не ломает форму', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => '' });
    await expect(apiService.get('/health')).rejects.toMatchObject({
      error: 'HTTP 500',
      code: 'HTTP_500',
      status: 500,
    });
  });

  it('обрыв таймаута отдаётся как сетевая ошибка', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    await expect(apiService.get('/polls/active')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});

/**
 * Инъекция `groupId` в query.
 *
 * `buildUrl` подмешивает группу из стора, чтобы вызывающим не таскать её
 * повсюду. Половина методов `admin.service.ts` и `suggestions.service.ts` при
 * этом уже встраивает `?groupId=` прямо в путь — и получалось
 * `?groupId=5&groupId=5`. На бэкенде это приходит массивом; работало только
 * потому, что `parseInt(['5','5'])` приводит массив к строке `'5,5'` и
 * возвращает 5. Первая же схема с `z.coerce.number()` получила бы NaN и
 * ответила 400 на восьми работавших админских эндпоинтах.
 */
describe('подмешивание groupId в query', () => {
  function requestedUrl(call = 0): string {
    return fetchMock.mock.calls[call]?.[0] as string;
  }

  beforeEach(() => {
    useAppStore.setState({ currentGroupId: '5' });
  });

  afterEach(() => {
    useAppStore.setState({ currentGroupId: null });
  });

  it('группа из стора добавляется, если её нет в пути', async () => {
    await apiService.get('/admin/debtors');

    expect(requestedUrl()).toContain('groupId=5');
    expect(requestedUrl().match(/groupId=/g)).toHaveLength(1);
  });

  it('groupId, уже вписанный в путь, не дублируется', async () => {
    await apiService.get('/admin/users?groupId=5');

    expect(requestedUrl().match(/groupId=/g)).toHaveLength(1);
  });

  /* Явно переданный в пути параметр побеждает стор — так было и раньше при
     слиянии params, и на это опирается переключение группы в админке. */
  it('groupId из пути побеждает значение из стора', async () => {
    await apiService.get('/admin/users?groupId=7');

    expect(requestedUrl()).toContain('groupId=7');
    expect(requestedUrl()).not.toContain('groupId=5');
  });

  it('прочие параметры пути сохраняются и не мешают инъекции', async () => {
    await apiService.get('/admin/cleanup/preview?daysOld=45&kind=polls');

    const url = requestedUrl();
    expect(url).toContain('daysOld=45');
    expect(url).toContain('kind=polls');
    expect(url.match(/groupId=/g)).toHaveLength(1);
  });
});
