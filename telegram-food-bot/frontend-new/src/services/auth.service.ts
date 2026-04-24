import { apiService } from './api.service';
import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/models';

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
