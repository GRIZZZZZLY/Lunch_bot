/**
 * Авторизация и переавторизация по 401.
 *
 * Задача 11 ставит этот файл в приоритет по риску: через него проходит вход в
 * приложение и восстановление сессии, а тестов у него не было. Сломается —
 * пользователь видит не «ошибку голосования», а пустой экран.
 *
 * Проверяется три свойства, каждое из которых ломается молча:
 *
 * 1. **Форма ответа терпима к обеим схемам.** Сервер отдаёт полезную нагрузку
 *    то в `data`, то на верхнем уровне (`extractPayload` для этого и написан).
 *    Потеря одной ветки означает «вход есть, а токена нет».
 * 2. **Отказ не бросает, а возвращает `success: false`.** На этом построен
 *    вызывающий код: экран показывает сообщение, а не падает в границу ошибок.
 * 3. **Порядок переавторизации: сначала refresh, потом initData.** initData —
 *    запасной путь и живёт недолго (протухает через
 *    TELEGRAM_INIT_DATA_MAX_AGE_SECONDS на сервере, 300 с по умолчанию); если
 *    порядок перевернуть, каждый истёкший токен будет стоить полной повторной
 *    валидации подписи.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  setToken: vi.fn(),
  getToken: vi.fn(),
  clearToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setRefreshToken: vi.fn(),
  getInitData: vi.fn(),
  reauth: null as null | (() => Promise<boolean>),
  setUser: vi.fn(),
  setAuthStatus: vi.fn(),
  setAuthError: vi.fn(),
}));

vi.mock('../api.service', () => ({
  apiService: {
    post: h.post,
    get: h.get,
    setToken: h.setToken,
    getToken: h.getToken,
    clearToken: h.clearToken,
    getRefreshToken: h.getRefreshToken,
    setRefreshToken: h.setRefreshToken,
    /* Функция переавторизации регистрируется ОДИН раз, при импорте модуля.
       Держим её в отдельном поле, а не в `mock.calls`: `beforeEach` сбрасывает
       моки, и запись о вызове при импорте до первого теста бы не дожила. */
    setReauthenticator: (fn: () => Promise<boolean>) => {
      h.reauth = fn;
    },
  },
}));

vi.mock('@/lib/telegram', () => ({ getInitData: h.getInitData }));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: {
    getState: () => ({
      setUser: h.setUser,
      setAuthStatus: h.setAuthStatus,
      setAuthError: h.setAuthError,
    }),
  },
}));

import { authService } from '../auth.service';

const USER = { id: 1, firstName: 'Иван' };

/** Переавторизатор, который сервис зарегистрировал при импорте модуля. */
function reauthenticate(): Promise<boolean> {
  if (!h.reauth) throw new Error('переавторизатор не зарегистрирован');
  return h.reauth();
}

beforeEach(() => {
  for (const value of Object.values(h)) {
    if (typeof value === 'function' && 'mockReset' in value) value.mockReset();
  }
});

describe('validateInitData', () => {
  it('достаёт пользователя и токен из data', async () => {
    h.post.mockResolvedValue({
      success: true,
      data: { user: USER, accessToken: 'access-1' },
    });

    await expect(authService.validateInitData('init')).resolves.toEqual({
      success: true,
      user: USER,
      token: 'access-1',
    });
    expect(h.post).toHaveBeenCalledWith('/auth/validate', { initData: 'init' });
  });

  /* Вторая схема ответа: полезная нагрузка на верхнем уровне, без `data`.
     Обе ветки живые, и обе приходят с продакшена — отсюда `extractPayload`. */
  it('достаёт пользователя и токен с верхнего уровня', async () => {
    h.post.mockResolvedValue({ success: true, user: USER, accessToken: 'access-2' });

    await expect(authService.validateInitData('init')).resolves.toMatchObject({
      success: true,
      token: 'access-2',
    });
  });

  it('пустая строка уходит на сервер как пустая, а не как undefined', async () => {
    h.post.mockResolvedValue({ success: true, data: { user: USER, accessToken: 'a' } });

    await authService.validateInitData('');

    expect(h.post).toHaveBeenCalledWith('/auth/validate', { initData: '' });
  });

  /* Отказ НЕ бросает: вызывающий читает `success` и показывает текст. */
  it('ответ без токена превращается в отказ с текстом сервера', async () => {
    h.post.mockResolvedValue({ success: false, error: 'Invalid initData format' });

    await expect(authService.validateInitData('init')).resolves.toEqual({
      success: false,
      user: {},
      token: '',
      error: 'Invalid initData format',
    });
  });

  it('успех без токена тоже отказ — половинчатый вход недопустим', async () => {
    h.post.mockResolvedValue({ success: true, data: { user: USER } });

    const result = await authService.validateInitData('init');

    expect(result.success).toBe(false);
    expect(result.token).toBe('');
  });

  it('сетевой сбой превращается в отказ, а не в исключение', async () => {
    h.post.mockRejectedValue(new Error('Network Error'));

    await expect(authService.validateInitData('init')).resolves.toMatchObject({
      success: false,
      error: 'Network Error',
    });
  });

  it('отказ без текста получает общую формулировку', async () => {
    h.post.mockRejectedValue({});

    await expect(authService.validateInitData('init')).resolves.toMatchObject({
      error: 'Authentication failed',
    });
  });

  it('сохраняет refresh-токен из ответа', async () => {
    h.post.mockResolvedValue({
      success: true,
      data: { user: USER, accessToken: 'a', refreshToken: 'r' },
    });
    await authService.validateInitData('init');
    expect(h.setRefreshToken).toHaveBeenCalledWith('r');
  });
});

describe('refreshAuth', () => {
  it('шлёт именно refresh-токен в Authorization и сохраняет новую пару', async () => {
    h.getRefreshToken.mockReturnValue('refresh-1');
    h.post.mockResolvedValue({
      success: true,
      data: { user: USER, accessToken: 'access-2', refreshToken: 'refresh-2' },
    });

    await expect(authService.refreshAuth()).resolves.toMatchObject({
      success: true,
      token: 'access-2',
      refreshToken: 'refresh-2',
    });
    expect(h.post).toHaveBeenCalledWith('/auth/refresh', undefined, {
      headers: { Authorization: 'Bearer refresh-1' },
    });
    expect(h.setRefreshToken).toHaveBeenCalledWith('refresh-2');
  });

  it('без сохранённого refresh-токена не ходит на сервер и возвращает отказ', async () => {
    h.getRefreshToken.mockReturnValue(null);

    await expect(authService.refreshAuth()).resolves.toMatchObject({ success: false });
    expect(h.post).not.toHaveBeenCalled();
  });

  it('отказ обновления не бросает', async () => {
    h.getRefreshToken.mockReturnValue('refresh-1');
    h.post.mockRejectedValue({ error: 'Refresh token revoked' });

    await expect(authService.refreshAuth()).resolves.toMatchObject({
      success: false,
      error: 'Refresh token revoked',
    });
  });
});

describe('работа с токеном', () => {
  it('делегирует хранение транспорту', () => {
    authService.setToken('t');
    authService.clearToken();

    expect(h.setToken).toHaveBeenCalledWith('t');
    expect(h.clearToken).toHaveBeenCalled();
  });

  it('аутентифицирован — это «токен есть»', () => {
    h.getToken.mockReturnValue('t');
    expect(authService.isAuthenticated()).toBe(true);

    h.getToken.mockReturnValue(null);
    expect(authService.isAuthenticated()).toBe(false);
  });

  it('текущий пользователь читается с /auth/me', () => {
    authService.getCurrentUser();

    expect(h.get).toHaveBeenCalledWith('/auth/me');
  });
});

describe('переавторизация по 401', () => {
  it('регистрируется в транспорте при загрузке модуля', () => {
    expect(typeof h.reauth).toBe('function');
  });

  /* Сначала refresh: он дешевле и не требует Telegram. initData к нему даже не
     запрашивается — иначе на каждом истёкшем токене шла бы полная валидация
     подписи. */
  it('успешный refresh не трогает initData', async () => {
    h.getRefreshToken.mockReturnValue('refresh-1');
    h.post.mockResolvedValue({ success: true, data: { user: USER, accessToken: 'fresh' } });

    await expect(reauthenticate()).resolves.toBe(true);

    expect(h.setToken).toHaveBeenCalledWith('fresh');
    expect(h.setUser).toHaveBeenCalledWith(USER);
    expect(h.getInitData).not.toHaveBeenCalled();
  });

  it('при отказе refresh переходит к повторной валидации initData', async () => {
    h.getRefreshToken.mockReturnValue('refresh-1');
    h.post
      .mockRejectedValueOnce({ error: 'expired' })
      .mockResolvedValueOnce({ success: true, data: { user: USER, accessToken: 'from-init' } });
    h.getInitData.mockReturnValue('init-data');

    await expect(reauthenticate()).resolves.toBe(true);

    expect(h.post).toHaveBeenNthCalledWith(1, '/auth/refresh', undefined, {
      headers: { Authorization: 'Bearer refresh-1' },
    });
    expect(h.post).toHaveBeenNthCalledWith(2, '/auth/validate', { initData: 'init-data' });
    expect(h.setToken).toHaveBeenCalledWith('from-init');
  });

  /* Вне Telegram initData нет вовсе — тогда второй путь пропускается, и сессия
     честно объявляется истёкшей вместо запроса с пустой подписью. */
  it('без initData сессия объявляется истёкшей', async () => {
    h.getRefreshToken.mockReturnValue('refresh-1');
    h.post.mockRejectedValue({ error: 'expired' });
    h.getInitData.mockReturnValue(null);

    await expect(reauthenticate()).resolves.toBe(false);

    expect(h.post).toHaveBeenCalledTimes(1);
    expect(h.clearToken).toHaveBeenCalled();
    expect(h.setAuthStatus).toHaveBeenCalledWith('error');
    expect(h.setAuthError).toHaveBeenCalledWith('Сессия истекла. Войдите заново.');
  });

  /* Оба пути отказали — токен обязан быть снят: иначе интерфейс остаётся
     «залогиненным» и повторяет 401 на каждом запросе. */
  it('отказ обоих путей снимает токен и сообщает пользователю', async () => {
    h.getRefreshToken.mockReturnValue('refresh-1');
    h.post.mockRejectedValue({ error: 'expired' });
    h.getInitData.mockReturnValue('init-data');

    await expect(reauthenticate()).resolves.toBe(false);

    expect(h.post).toHaveBeenCalledTimes(2);
    expect(h.clearToken).toHaveBeenCalled();
    expect(h.setUser).not.toHaveBeenCalled();
  });
});
