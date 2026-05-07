import { apiService, type ApiResponse } from './api.service';
import type { User } from '../types/auth.types';

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

export interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
  error?: string;
}

interface AuthValidateResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthRefreshResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface AuthStatusData {
  authenticated: boolean;
  user: User;
  timestamp: string;
}

export interface AuthStatusResponse {
  success: boolean;
  authenticated: boolean;
  user?: User;
  timestamp: string;
}

class AuthService {
  private extractAuthPayload<T extends { user: User; accessToken: string }>(
    response: ApiResponse<T>
  ): { user?: User; accessToken?: string } {
    const data = response.data;

    if (data && typeof data === 'object') {
      return {
        user: data.user,
        accessToken: data.accessToken,
      };
    }

    const topLevel = response as unknown as {
      user?: User;
      accessToken?: string;
    };

    return {
      user: topLevel.user,
      accessToken: topLevel.accessToken,
    };
  }

  /**
   * Валидация initData от Telegram
   */
  async validateInitData(initData: string): Promise<AuthResponse> {
    try {
      if (USE_MOCK_API) {
        const { mockApiService } = await import('./mockApi.service');
        const response = await mockApiService.validateInitData(initData);
        if (response.success && response.data) {
          return {
            success: true,
            user: response.data.user,
            token: response.data.token,
          };
        }
        throw new Error(response.error || 'Validation failed');
      }

      // КРИТИЧНО: Отправляем РЕАЛЬНЫЙ initData от Telegram!
      // Если initData пустой - отправляем пустую строку, backend обработает
      console.log('[authService] validateInitData called:', {
        hasInitData: !!initData,
        initDataLength: initData?.length || 0,
        initDataPreview: initData?.substring(0, 100) || 'empty'
      });
      
      const response = await apiService.post<AuthValidateResponse>('/auth/validate', {
        initData: initData || ''
      });

      const { user, accessToken } = this.extractAuthPayload(response);

      // ✅ ИСПРАВЛЕНО: Backend может возвращать payload без data-обертки
      if (response.success && user && accessToken) {
        return {
          success: true,
          user,
          token: accessToken,
        };
      }

      throw new Error(response.error || 'Validation failed');
    } catch (error: unknown) {
      const errorObj = error as { error?: string; message?: string };
      return {
        success: false,
        user: {} as User,
        token: '',
        error: errorObj.error || errorObj.message || 'Authentication failed',
      };
    }
  }

  /**
   * Получение информации о текущем пользователе
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiService.get<User>('/auth/me');
  }

  /**
   * Проверка статуса авторизации
   */
  async getAuthStatus(): Promise<AuthStatusResponse> {
    try {
      const response = await apiService.get<AuthStatusData>('/auth/status');

      // ApiService возвращает response.data напрямую
      if (response.success && response.data?.authenticated !== undefined) {
        return {
          success: true,
          authenticated: response.data.authenticated,
          user: response.data.user,
          timestamp: response.data.timestamp || new Date().toISOString(),
        };
      }

      return {
        success: false,
        authenticated: false,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        success: false,
        authenticated: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Обновление токена авторизации
   */
  async refreshAuth(): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthRefreshResponse>('/auth/refresh');

      const { user, accessToken } = this.extractAuthPayload(response);

      // ✅ ИСПРАВЛЕНО: Backend может возвращать payload без data-обертки
      if (response.success && user && accessToken) {
        return {
          success: true,
          user,
          token: accessToken,
        };
      }

      throw new Error(response.error || 'Refresh failed');
    } catch (error: unknown) {
      const errorObj = error as { error?: string; message?: string };
      return {
        success: false,
        user: {} as User,
        token: '',
        error: errorObj.error || errorObj.message || 'Refresh failed',
      };
    }
  }

  /**
   * Установить токен
   */
  setToken(token: string): void {
    apiService.setToken(token);
  }

  /**
   * Получить токен
   */
  getToken(): string | null {
    return apiService.getToken();
  }

  /**
   * Очистить токен
   */
  clearToken(): void {
    apiService.clearToken();
  }

  /**
   * Проверить, авторизован ли пользователь
   */
  isAuthenticated(): boolean {
    return apiService.getToken() !== null;
  }
}

export const authService = new AuthService();
