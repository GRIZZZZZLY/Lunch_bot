/**
 * Авторизация и переавторизация по 401.
 *
 * Через этот сервис проходит вход в приложение и восстановление сессии.
 * Сломается — пользователь видит не «ошибку голосования», а пустой экран.
 *
 * Сеть подменена на границе (`fetch`), транспорт и стор настоящие: результат
 * читается из сохранённых токенов, состояния стора и запросов, ушедших в сеть,
 * а не из вызовов моков.
 *
 * Проверяется три свойства, каждое из которых ломается молча:
 *
 * 1. **Форма ответа терпима к обеим схемам.** Сервер отдаёт полезную нагрузку
 *    то в `data`, то на верхнем уровне. Потеря одной ветки означает «вход есть,
 *    а токена нет».
 * 2. **Отказ не бросает, а возвращает `success: false`.** На этом построен
 *    вызывающий код: экран показывает сообщение, а не падает в границу ошибок.
 * 3. **Переавторизация: сначала refresh, потом initData.** initData — запасной
 *    путь и живёт недолго (TELEGRAM_INIT_DATA_MAX_AGE_SECONDS на сервере);
 *    если оба пути отказали, сессия снимается, а не повторяет 401 вечно.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiService } from '../api.service';
import { authService } from '../auth.service';
import { useAppStore } from '@/store/useAppStore';

const USER = { id: 1, firstName: 'Иван' };

type Reply = { status: number; body?: unknown } | 'network';

const fetchMock = vi.fn();
let routes: Record<string, Reply[]> = {};

/** Ответы сервера по пути; у очереди последний ответ повторяется. */
function serve(map: Record<string, Reply | Reply[]>): void {
  routes = Object.fromEntries(
    Object.entries(map).map(([path, reply]) => [path, Array.isArray(reply) ? [...reply] : [reply]]),
  );
}

/* База нужна для относительного адреса: локальный `.env` задаёт VITE_API_URL=/api,
   а в CI его нет и транспорт берёт абсолютный адрес по умолчанию. */
const pathOf = (url: string) =>
  new URL(url, 'http://localhost').pathname.replace(/^\/api/, '');

function respond(url: string): Promise<unknown> {
  const queue = routes[pathOf(url)];
  const reply = !queue ? { status: 404 } : queue.length > 1 ? queue.shift()! : queue[0];
  if (reply === 'network') return Promise.reject(new TypeError('Failed to fetch'));
  return Promise.resolve({
    ok: reply.status >= 200 && reply.status < 300,
    status: reply.status,
    text: async () => (reply.body === undefined ? '' : JSON.stringify(reply.body)),
  });
}

/** Что ушло в сеть: путь, Authorization и тело каждого запроса. */
function sent() {
  return fetchMock.mock.calls.map(([url, init]: unknown[]) => {
    const { headers, body } = init as RequestInit;
    return {
      path: pathOf(url as string),
      auth: (headers as Record<string, string>).Authorization,
      body: typeof body === 'string' ? JSON.parse(body) : undefined,
    };
  });
}

const lastSent = () => sent()[sent().length - 1];

const ok = (body: unknown): Reply => ({ status: 200, body });
const authOk = (accessToken: string, extra: object = {}) =>
  ok({ success: true, data: { user: USER, accessToken, ...extra } });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('VITE_DEV_INIT_DATA', '');
  fetchMock.mockReset();
  fetchMock.mockImplementation(respond);
  routes = {};
  apiService.clearToken();
  useAppStore.getState().reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  delete window.Telegram;
});

describe('validateInitData', () => {
  it('достаёт пользователя и токен из data', async () => {
    serve({ '/auth/validate': authOk('access-1') });

    await expect(authService.validateInitData('init')).resolves.toEqual({
      success: true,
      user: USER,
      token: 'access-1',
    });
    expect(sent()).toMatchObject([{ path: '/auth/validate', body: { initData: 'init' } }]);
  });

  /* Вторая схема ответа: полезная нагрузка на верхнем уровне, без `data`.
     Обе ветки живые, и обе приходят с продакшена. */
  it('достаёт пользователя и токен с верхнего уровня', async () => {
    serve({ '/auth/validate': ok({ success: true, user: USER, accessToken: 'access-2' }) });

    await expect(authService.validateInitData('init')).resolves.toMatchObject({
      success: true,
      token: 'access-2',
    });
  });

  /* Отказ НЕ бросает: вызывающий читает `success` и показывает текст. */
  it('ответ без токена превращается в отказ с текстом сервера', async () => {
    serve({ '/auth/validate': ok({ success: false, error: 'Invalid initData format' }) });

    await expect(authService.validateInitData('init')).resolves.toEqual({
      success: false,
      user: {},
      token: '',
      error: 'Invalid initData format',
    });
  });

  it('успех без токена тоже отказ — половинчатый вход недопустим', async () => {
    serve({ '/auth/validate': ok({ success: true, data: { user: USER } }) });

    const result = await authService.validateInitData('init');

    expect(result.success).toBe(false);
    expect(result.token).toBe('');
  });

  it.each([
    ['сетевой сбой', 'network' as const],
    ['отказ сервера без текста', { status: 500 }],
  ])('%s превращается в отказ с причиной, а не в исключение', async (_name, reply) => {
    serve({ '/auth/validate': reply });

    const result = await authService.validateInitData('init');

    expect(result.success).toBe(false);
    expect(result.error).toEqual(expect.any(String));
    expect(result.error).not.toBe('');
  });

  it('сохраняет refresh-токен из ответа', async () => {
    serve({ '/auth/validate': authOk('a', { refreshToken: 'r' }) });

    await authService.validateInitData('init');

    expect(apiService.getRefreshToken()).toBe('r');
  });
});

describe('refreshAuth', () => {
  /* Сервер принимает на /auth/refresh только токен type=refresh: access там
     даёт 401 — так жил баг «сессия умирает через час». */
  it('шлёт именно refresh-токен в Authorization и сохраняет новую пару', async () => {
    apiService.setToken('access-1');
    apiService.setRefreshToken('refresh-1');
    serve({ '/auth/refresh': authOk('access-2', { refreshToken: 'refresh-2' }) });

    await expect(authService.refreshAuth()).resolves.toMatchObject({
      success: true,
      token: 'access-2',
      refreshToken: 'refresh-2',
    });
    expect(sent()).toMatchObject([{ path: '/auth/refresh', auth: 'Bearer refresh-1' }]);
    expect(apiService.getRefreshToken()).toBe('refresh-2');
  });

  it('без сохранённого refresh-токена не ходит на сервер и возвращает отказ', async () => {
    await expect(authService.refreshAuth()).resolves.toMatchObject({ success: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('отказ обновления не бросает', async () => {
    apiService.setRefreshToken('refresh-1');
    serve({ '/auth/refresh': { status: 401, body: { error: 'Refresh token revoked' } } });

    await expect(authService.refreshAuth()).resolves.toMatchObject({
      success: false,
      error: 'Refresh token revoked',
    });
  });
});

/**
 * Переавторизация запускается настоящим путём: обычный запрос получает 401,
 * транспорт зовёт переавторизатор, зарегистрированный auth.service, и при
 * успехе повторяет запрос с новым токеном.
 */
describe('переавторизация по 401', () => {
  const POLLS = '/polls/active';

  beforeEach(() => {
    apiService.setToken('stale');
    apiService.setRefreshToken('refresh-1');
  });

  function telegramInitData(initData: string): void {
    window.Telegram = { WebApp: { initData } } as unknown as typeof window.Telegram;
  }

  /* Сначала refresh: он дешевле и не требует Telegram. initData при этом есть,
     но повторная валидация подписи не нужна. */
  it('успешный refresh восстанавливает сессию без initData', async () => {
    telegramInitData('init-data');
    serve({
      [POLLS]: [{ status: 401 }, ok({ success: true, data: [] })],
      '/auth/refresh': authOk('fresh'),
    });

    await expect(apiService.get(POLLS)).resolves.toMatchObject({ success: true });

    expect(sent().filter((r) => r.path.startsWith('/auth/'))).toMatchObject([{ path: '/auth/refresh' }]);
    expect(lastSent()).toMatchObject({ path: POLLS, auth: 'Bearer fresh' });
    expect(apiService.getToken()).toBe('fresh');
    expect(useAppStore.getState().user).toEqual(USER);
  });

  it('при отказе refresh сессию восстанавливает initData', async () => {
    telegramInitData('init-data');
    serve({
      [POLLS]: [{ status: 401 }, ok({ success: true, data: [] })],
      '/auth/refresh': { status: 401, body: { error: 'expired' } },
      '/auth/validate': authOk('from-init'),
    });

    await expect(apiService.get(POLLS)).resolves.toMatchObject({ success: true });

    expect(lastSent()).toMatchObject({ path: POLLS, auth: 'Bearer from-init' });
    expect(apiService.getToken()).toBe('from-init');
  });

  /* Оба пути отказали (или initData нет вовсе — вне Telegram) — токены
     обязаны быть сняты, а экран перейти в ошибку: иначе интерфейс остаётся
     «залогиненным» и повторяет 401 на каждом запросе. */
  it.each([
    ['без initData', ''],
    ['initData тоже отклонён', 'init-data'],
  ])('%s: сессия снята, экран в ошибке', async (_name, initData) => {
    telegramInitData(initData);
    serve({
      [POLLS]: { status: 401 },
      '/auth/refresh': { status: 401, body: { error: 'expired' } },
      '/auth/validate': { status: 401, body: { error: 'expired' } },
    });

    await expect(apiService.get(POLLS)).rejects.toMatchObject({ status: 401 });

    expect(apiService.getToken()).toBeNull();
    expect(apiService.getRefreshToken()).toBeNull();
    expect(useAppStore.getState().authStatus).toBe('error');
    expect(useAppStore.getState().user).toBeNull();
  });

  /* Вне Telegram подписи нет — запрос с пустой подписью не отправляется. */
  it('без initData повторная валидация не отправляется', async () => {
    telegramInitData('');
    serve({
      [POLLS]: { status: 401 },
      '/auth/refresh': { status: 401, body: { error: 'expired' } },
    });

    await expect(apiService.get(POLLS)).rejects.toMatchObject({ status: 401 });

    expect(sent().some((r) => r.path === '/auth/validate')).toBe(false);
  });
});
