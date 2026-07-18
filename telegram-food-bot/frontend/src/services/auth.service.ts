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
  user?: User | null;
  timestamp: string;
}

export interface AuthStatusResponse {
  success: boolean;
  authenticated: boolean;
  user?: User;
  timestamp: string;
}

class AuthService {
  private readonly refreshTokenKey = 'refresh_token';

  private extractAuthPayload<T extends { user: User; accessToken: string; refreshToken?: string }>(
    response: ApiResponse<T>
  ): { user?: User; accessToken?: string; refreshToken?: string } {
    const data = response.data;

    if (data && typeof data === 'object') {
      return {
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
    }

    const topLevel = response as unknown as {
      user?: User;
      accessToken?: string;
      refreshToken?: string;
    };

    return {
      user: topLevel.user,
      accessToken: topLevel.accessToken,
      refreshToken: topLevel.refreshToken,
    };
  }

  private setRefreshToken(token: string): void {
    sessionStorage.setItem(this.refreshTokenKey, token);
  }

  private getRefreshToken(): string | null {
    return sessionStorage.getItem(this.refreshTokenKey);
  }

  private clearRefreshToken(): void {
    sessionStorage.removeItem(this.refreshTokenKey);
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
      const response = await apiService.post<AuthValidateResponse>('/auth/validate', {
        initData: initData || ''
      });

      const { user, accessToken, refreshToken } = this.extractAuthPayload(response);

      // ✅ ИСПРАВЛЕНО: Backend может возвращать payload без data-обертки
      if (response.success && user && accessToken) {
        if (refreshToken) {
          this.setRefreshToken(refreshToken);
        }

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
      const topLevelResponse = response as ApiResponse<AuthStatusData> &
        Partial<AuthStatusData>;
      const authStatus = response.data ?? (
        topLevelResponse.authenticated !== undefined
          ? {
              authenticated: topLevelResponse.authenticated,
              user: topLevelResponse.user,
              timestamp: topLevelResponse.timestamp || new Date().toISOString(),
            }
          : undefined
      );

      // ApiService возвращает response.data напрямую
      if (response.success && authStatus?.authenticated !== undefined) {
        return {
          success: true,
          authenticated: authStatus.authenticated,
          user: authStatus.user ?? undefined,
          timestamp: authStatus.timestamp || new Date().toISOString(),
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
      const storedRefreshToken = this.getRefreshToken();

      if (!storedRefreshToken) {
        throw new Error('Refresh token missing');
      }

      const response = await apiService.post<AuthRefreshResponse>(
        '/auth/refresh',
        undefined,
        {
          headers: {
            Authorization: `Bearer ${storedRefreshToken}`,
          },
        }
      );

      const { user, accessToken, refreshToken } = this.extractAuthPayload(response);

      // ✅ ИСПРАВЛЕНО: Backend может возвращать payload без data-обертки
      if (response.success && user && accessToken) {
        if (refreshToken) {
          this.setRefreshToken(refreshToken);
        }

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
    this.clearRefreshToken();
  }

  /**
   * Проверить, авторизован ли пользователь
   */
  isAuthenticated(): boolean {
    return apiService.getToken() !== null;
  }
}

export const authService = new AuthService();
