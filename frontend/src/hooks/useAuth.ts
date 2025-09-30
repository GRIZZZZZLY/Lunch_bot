import { useState, useEffect, useMemo } from 'react';
import { useTelegram } from './useTelegram';
import { authService } from '../services/auth.service';

export interface User {
  id: number;
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

/**
 * Хук для управления аутентификацией
 */
export const useAuth = (): UseAuthReturn => {
  const { initData, user: tgUser, isReady } = useTelegram();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Автоматическая аутентификация при готовности Telegram WebApp
  useEffect(() => {
    if (isReady && initData && tgUser) {
      login();
    } else if (isReady && !initData) {
      setError('No Telegram init data available');
      setIsLoading(false);
    }
  }, [isReady, initData, tgUser]);

  const login = async () => {
    if (!initData) {
      setError('No init data available');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await authService.validateInitData(initData);
      
      if (response.success) {
        setUser(response.user);
        
        // Сохраняем токен для последующих запросов
        if (response.token) {
          authService.setToken(response.token);
        }
      } else {
        throw new Error(response.error || 'Authentication failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    authService.clearToken();
    setError(null);
  };

  const refresh = async () => {
    try {
      setError(null);
      const response = await authService.refreshAuth();
      
      if (response.success) {
        setUser(response.user);
        
        if (response.token) {
          authService.setToken(response.token);
        }
      } else {
        throw new Error(response.error || 'Refresh failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Refresh error:', err);
      logout();
    }
  };

  const isAuthenticated = useMemo(() => user !== null, [user]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refresh,
  };
};
