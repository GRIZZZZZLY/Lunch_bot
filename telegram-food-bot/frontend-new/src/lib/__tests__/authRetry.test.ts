import { describe, expect, it, vi } from 'vitest';
import { createAuthRetryHandler, isAuthEndpoint } from '../authRetry';

describe('isAuthEndpoint', () => {
  it('распознаёт auth-эндпоинты', () => {
    expect(isAuthEndpoint('/auth/validate')).toBe(true);
    expect(isAuthEndpoint('/auth/refresh')).toBe(true);
    expect(isAuthEndpoint('auth/refresh')).toBe(true);
    expect(isAuthEndpoint('/polls/active')).toBe(false);
    expect(isAuthEndpoint('/author/1')).toBe(false);
    expect(isAuthEndpoint(undefined)).toBe(false);
  });
});

describe('createAuthRetryHandler', () => {
  it('успешная переавторизация разрешает повтор', async () => {
    const reauth = vi.fn().mockResolvedValue(true);
    const shouldRetry = createAuthRetryHandler(reauth);
    await expect(shouldRetry({ url: '/polls' })).resolves.toBe(true);
    expect(reauth).toHaveBeenCalledTimes(1);
  });

  it('уже повторённый запрос не переавторизуется — защита от цикла', async () => {
    const reauth = vi.fn().mockResolvedValue(true);
    const shouldRetry = createAuthRetryHandler(reauth);
    await expect(shouldRetry({ url: '/polls', _authRetry: true })).resolves.toBe(false);
    expect(reauth).not.toHaveBeenCalled();
  });

  it('401 на /auth/* не запускает переавторизацию — защита от цикла', async () => {
    const reauth = vi.fn().mockResolvedValue(true);
    const shouldRetry = createAuthRetryHandler(reauth);
    await expect(shouldRetry({ url: '/auth/refresh' })).resolves.toBe(false);
    await expect(shouldRetry({ url: '/auth/validate' })).resolves.toBe(false);
    expect(reauth).not.toHaveBeenCalled();
  });

  it('single-flight: параллельные 401 ждут одну общую попытку', async () => {
    let resolveReauth!: (v: boolean) => void;
    const reauth = vi.fn().mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveReauth = resolve;
        }),
    );
    const shouldRetry = createAuthRetryHandler(reauth);

    const first = shouldRetry({ url: '/a' });
    const second = shouldRetry({ url: '/b' });
    resolveReauth(true);

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(reauth).toHaveBeenCalledTimes(1);
  });

  it('после завершённой попытки следующий 401 запускает новую', async () => {
    const reauth = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const shouldRetry = createAuthRetryHandler(reauth);
    await expect(shouldRetry({ url: '/a' })).resolves.toBe(false);
    await expect(shouldRetry({ url: '/a' })).resolves.toBe(true);
    expect(reauth).toHaveBeenCalledTimes(2);
  });

  it('исключение внутри reauth трактуется как отказ, а не падение', async () => {
    const reauth = vi.fn().mockRejectedValue(new Error('boom'));
    const shouldRetry = createAuthRetryHandler(reauth);
    await expect(shouldRetry({ url: '/a' })).resolves.toBe(false);
  });
});
