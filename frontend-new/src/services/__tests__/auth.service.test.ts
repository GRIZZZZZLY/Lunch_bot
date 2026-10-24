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
 * Обычный вход и обновление по refresh-токену проверяют сквозные сценарии
 * (`routes-auth.spec.ts`, `integration.spec.ts`). Здесь — то, до чего они не
 * доходят:
 *
 * 1. **Отказ не бросает, а возвращает `success: false`.** На этом построен
 *    вызывающий код: экран показывает сообщение, а не падает в границу ошибок.
 * 2. **Запасной путь initData и снятие сессии.** Если refresh отказал, сессию
 *    восстанавливает initData; если отказали оба, сессия снимается, а не
 *    повторяет 401 вечно.
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
   а без `.env` его нет, и транспорт берёт абсолютный адрес по умолчанию. */
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
});
