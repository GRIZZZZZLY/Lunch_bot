import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from '../../src/services/auth.service';

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('../../src/services/api.service', () => ({
  apiService: {
    get: apiGet,
    post: apiPost,
    setToken: vi.fn(),
    getToken: vi.fn(),
    clearToken: vi.fn(),
  },
}));

const user = {
  id: 1,
  telegramId: '123456789',
  username: 'rocket',
  firstName: 'Rocket',
  lastName: 'User',
  isAdmin: true,
  isActive: true,
  createdAt: '2026-06-22T09:00:00.000Z',
};

describe('authService API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('reads authenticated status from the current backend response shape', async () => {
    apiGet.mockResolvedValue({
      success: true,
      authenticated: true,
      user,
      timestamp: '2026-06-22T09:30:00.000Z',
    });

    const response = await authService.getAuthStatus();

    expect(apiGet).toHaveBeenCalledWith('/auth/status');
    expect(response).toEqual({
      success: true,
      authenticated: true,
      user,
      timestamp: '2026-06-22T09:30:00.000Z',
    });
  });

  it('keeps accepting wrapped auth status responses for compatibility', async () => {
    apiGet.mockResolvedValue({
      success: true,
      data: {
        authenticated: true,
        user,
        timestamp: '2026-06-22T09:45:00.000Z',
      },
    });

    const response = await authService.getAuthStatus();

    expect(response.authenticated).toBe(true);
    expect(response.user).toEqual(user);
    expect(response.timestamp).toBe('2026-06-22T09:45:00.000Z');
  });

  it('refreshes auth with the refresh token returned by validate', async () => {
    apiPost
      .mockResolvedValueOnce({
        success: true,
        user,
        accessToken: 'access-token-1',
        refreshToken: 'refresh-token-1',
        expiresIn: 3600,
      })
      .mockResolvedValueOnce({
        success: true,
        user,
        accessToken: 'access-token-2',
        refreshToken: 'refresh-token-2',
      });

    const loginResponse = await authService.validateInitData('tg-init-data');
    const refreshResponse = await authService.refreshAuth();

    expect(loginResponse.token).toBe('access-token-1');
    expect(refreshResponse.token).toBe('access-token-2');
    expect(apiPost).toHaveBeenNthCalledWith(1, '/auth/validate', {
      initData: 'tg-init-data',
    });
    expect(apiPost).toHaveBeenNthCalledWith(2, '/auth/refresh', undefined, {
      headers: {
        Authorization: 'Bearer refresh-token-1',
      },
    });
  });

  it('does not write Telegram initData to console', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    apiPost.mockResolvedValue({
      success: true,
      user,
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresIn: 3600,
    });

    try {
      await authService.validateInitData('tg-init-data&hash=secret');

      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });
});
