import { apiService, ApiResponse } from './api.service';
import { mockApiService } from './mockApi.service';
import type { User } from '../hooks/useAuth';

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

export interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
  error?: string;
}

export interface AuthStatusResponse {
  success: boolean;
  authenticated: boolean;
  user?: User;
  timestamp: string;
}

class AuthService {
  /**
   * Валидация initData от Telegram
   */
  async validateInitData(initData: string): Promise<AuthResponse> {
    try {
      if (USE_MOCK_API) {
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

      const response = await apiService.post<{
        user: User;
        token: string;
      }>('/auth/validate', { initData });

      if (response.success && response.data) {
        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
        };
      }

      throw new Error(response.error || 'Validation failed');
    } catch (error: any) {
      return {
        success: false,
        user: {} as User,
        token: '',
        error: error.error || error.message || 'Authentication failed',
      };
    }
  }

  /**
   * Получение информации о текущем пользователе
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    try {
      return await apiService.get<User>('/auth/me');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Проверка статуса авторизации
   */
  async getAuthStatus(): Promise<AuthStatusResponse> {
    try {
      const response = await apiService.get<{
        authenticated: boolean;
        user?: User;
        timestamp: string;
      }>('/auth/status');

      if (response.success && response.data) {
        return {
          success: true,
          authenticated: response.data.authenticated,
          user: response.data.user,
          timestamp: response.data.timestamp,
        };
      }

      return {
        success: false,
        authenticated: false,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
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
      const response = await apiService.post<{
        user: User;
        token: string;
      }>('/auth/refresh');

      if (response.success && response.data) {
        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
        };
      }

      throw new Error(response.error || 'Refresh failed');
    } catch (error: any) {
      return {
        success: false,
        user: {} as User,
        token: '',
        error: error.error || error.message || 'Refresh failed',
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
