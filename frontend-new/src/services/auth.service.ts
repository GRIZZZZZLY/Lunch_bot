import { apiService } from './api.service';
import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/models';
import { useAppStore } from '@/store/useAppStore';
import { getInitData } from '@/lib/telegram';

export interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
  refreshToken?: string;
  error?: string;
}

interface AuthValidatePayload {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

function extractPayload<T extends { user: User; accessToken: string; refreshToken?: string }>(
  response: ApiResponse<T>,
): { user?: User; accessToken?: string; refreshToken?: string } {
  if (response.data && typeof response.data === 'object') {
    const { user, accessToken, refreshToken } = response.data;
    return { user, accessToken, refreshToken };
  }
  const top = response as unknown as { user?: User; accessToken?: string; refreshToken?: string };
  return { user: top.user, accessToken: top.accessToken, refreshToken: top.refreshToken };
}

class AuthService {
  async validateInitData(initData: string): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthValidatePayload>('/auth/validate', {
        initData: initData || '',
      });
      const { user, accessToken, refreshToken } = extractPayload(response);
      if (response.success && user && accessToken) {
        if (refreshToken) apiService.setRefreshToken(refreshToken);
        return { success: true, user, token: accessToken, refreshToken };
      }
      throw new Error(response.error || 'Validation failed');
    } catch (error) {
      const e = error as { error?: string; message?: string };
      return {
        success: false,
        user: {} as User,
        token: '',
        error: e.error || e.message || 'Authentication failed',
      };
    }
  }

  async refreshAuth(): Promise<AuthResponse> {
    const refreshToken = apiService.getRefreshToken();
    if (!refreshToken) {
      return { success: false, user: {} as User, token: '', error: 'No refresh token' };
    }
    try {
      /* Сервер принимает только токен type=refresh; access здесь даёт 401
         INVALID_TOKEN_TYPE — так и жил баг «сессия умирает через час». */
      const response = await apiService.post<AuthValidatePayload>('/auth/refresh', undefined, {
        headers: { Authorization: `Bearer ${refreshToken}` },
      });
      const { user, accessToken, refreshToken: next } = extractPayload(response);
      if (response.success && user && accessToken) {
        if (next) apiService.setRefreshToken(next);
        return { success: true, user, token: accessToken, refreshToken: next };
      }
      throw new Error(response.error || 'Refresh failed');
    } catch (error) {
      const e = error as { error?: string; message?: string };
      return {
        success: false,
        user: {} as User,
        token: '',
        error: e.error || e.message || 'Refresh failed',
      };
    }
  }

  getCurrentUser() {
    return apiService.get<User>('/auth/me');
  }

  setToken(token: string) {
    apiService.setToken(token);
  }
  getToken() {
    return apiService.getToken();
  }
  clearToken() {
    apiService.clearToken();
  }
  isAuthenticated() {
    return apiService.getToken() !== null;
  }
}

export const authService = new AuthService();

/* Переавторизация для 401-повторов (координация — в lib/authRetry.ts):
   сначала refresh, при неудаче — повторная валидация initData. Это именно
   запасной путь, а не равноценная альтернатива: initData протухает через
   TELEGRAM_INIT_DATA_MAX_AGE_SECONDS (300 с по умолчанию на сервере), то
   есть работает только в первые минуты после открытия Mini App, а не всю
   сессию. Оба запроса идут на /auth/* и сами повтор не запускают. */
apiService.setReauthenticator(async () => {
  const store = useAppStore.getState();
  const refreshed = await authService.refreshAuth();
  if (refreshed.success) {
    authService.setToken(refreshed.token);
    store.setUser(refreshed.user);
    return true;
  }
  const initData = getInitData();
  if (initData) {
    const validated = await authService.validateInitData(initData);
    if (validated.success) {
      authService.setToken(validated.token);
      store.setUser(validated.user);
      return true;
    }
  }
  authService.clearToken();
  store.setAuthStatus('error');
  store.setAuthError('Сессия истекла. Войдите заново.');
  return false;
});
