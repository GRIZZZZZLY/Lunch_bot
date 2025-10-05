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
    // Проверяем есть ли уже токен в localStorage
    const existingToken = authService.getToken();
    
    // Проверяем env переменную для MOCK режима
    const useMockApi = import.meta.env.VITE_USE_MOCK_API === 'true';
    
    // Проверка что initData реально есть (не пустая строка)
    const hasValidInitData = initData && initData.trim().length > 0;
    
    const authInfo = {
      hasExistingToken: !!existingToken,
      isReady,
      hasInitData: !!initData,
      initDataLength: initData?.length || 0,
      hasTgUser: !!tgUser,
      useMockApi,
    };
    
    console.log('[useAuth] Auth check:', authInfo);
    
    // ПРИОРИТЕТ 1: Если токен уже есть, пробуем загрузить пользователя по нему
    if (existingToken) {
      console.log('[useAuth] Existing token found - loading user data');
      loadUserWithToken();
      return;
    }
    
    // ПРИОРИТЕТ 2: Mock режим
    if (useMockApi) {
      console.log('[useAuth] MOCK MODE - using mock authentication');
      loginWithMockData();
      return;
    }
    
    // ПРИОРИТЕТ 3: Telegram авторизация
    if (isReady && hasValidInitData && tgUser) {
      console.log('[useAuth] Using normal authentication with initData');
      login();
    } else if (isReady && !hasValidInitData) {
      console.warn('[useAuth] No valid initData - attempting fallback authentication');
      loginWithFallback();
    }
  }, [isReady, initData, tgUser]);

  const loadUserWithToken = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[useAuth] Loading user data with existing token...');
      const response = await authService.getCurrentUser();

      if (response.success && response.data) {
        setUser(response.data);
        console.log('[useAuth] User loaded successfully from token');
      } else {
        throw new Error('Failed to load user');
      }
    } catch (err) {
      console.error('[useAuth] Failed to load user with token:', err);
      // Токен невалидный, очищаем и пробуем другие методы
      authService.clearToken();
      setError('Invalid token');
      
      // Если в Telegram, пробуем авторизацию через Telegram
      if (initData && initData.trim().length > 0) {
        login();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithMockData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Mock пользователь для тестирования
      const mockUser: User = {
        id: 1,
        telegramId: '123456789',
        username: 'testuser',
        firstName: 'Тест',
        lastName: 'Пользователь',
        isAdmin: true,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      // Создаём mock токен
      const mockToken = btoa(JSON.stringify({
        userId: mockUser.id,
        telegramId: mockUser.telegramId,
        isAdmin: mockUser.isAdmin,
        timestamp: Date.now(),
      }));

      // Сохраняем токен
      authService.setToken(mockToken);

      setUser(mockUser);
      console.log('[useAuth] Mock authentication successful with token');
    } catch (err) {
      console.error('[useAuth] Mock auth error:', err);
      setError('Mock authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithFallback = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Пытаемся получить данные из Telegram WebApp напрямую
      const tg = window.Telegram?.WebApp as any;
      if (tg && tg.initDataUnsafe?.user) {
        const tgUser = tg.initDataUnsafe.user;
        
        // Создаем пользователя из данных Telegram
        const fallbackUser: User = {
          id: tgUser.id,
          telegramId: String(tgUser.id),
          username: tgUser.username,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          isAdmin: false,
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        setUser(fallbackUser);
        console.log('[useAuth] Fallback authentication successful');
      } else {
        throw new Error('No Telegram data available');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fallback authentication failed';
      setError(errorMessage);
      console.error('[useAuth] Fallback auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
