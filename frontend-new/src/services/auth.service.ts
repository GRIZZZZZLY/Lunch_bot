import { apiService } from './api.service';
import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/models';
import { useAppStore } from '@/store/useAppStore';
import { getInitData } from '@/lib/telegram';

export interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
  error?: string;
}

interface AuthValidatePayload {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

function extractPayload<T extends { user: User; accessToken: string }>(
  response: ApiResponse<T>,
): { user?: User; accessToken?: string } {
  if (response.data && typeof response.data === 'object') {
    return { user: response.data.user, accessToken: response.data.accessToken };
  }
  const top = response as unknown as { user?: User; accessToken?: string };
  return { user: top.user, accessToken: top.accessToken };
}

class AuthService {
  async validateInitData(initData: string): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthValidatePayload>('/auth/validate', {
        initData: initData || '',
      });
      const { user, accessToken } = extractPayload(response);
      if (response.success && user && accessToken) {
        return { success: true, user, token: accessToken };
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
    try {
      const response = await apiService.post<AuthValidatePayload>('/auth/refresh');
      const { user, accessToken } = extractPayload(response);
      if (response.success && user && accessToken) {
        return { success: true, user, token: accessToken };
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
   сначала refresh, при неудаче — повторная валидация initData (она живёт всю
   сессию Mini App). Оба запроса идут на /auth/* и сами повтор не запускают. */
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
