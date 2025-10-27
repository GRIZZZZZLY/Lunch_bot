import { useState, useEffect, useMemo } from 'react';
import { useTelegram } from './useTelegram';
import { authService } from '../services/auth.service';
import { setUserContext, clearUserContext } from '../lib/sentry';

export interface User {
  id: number;
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
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
    
    // ПРИОРИТЕТ 1: Mock режим
    if (useMockApi) {
      console.log('[useAuth] MOCK MODE - using mock authentication');
      loginWithMockData();
      return;
    }
    
    // ПРИОРИТЕТ 2: Telegram авторизация (если есть initData)
    if (isReady && hasValidInitData && tgUser) {
      console.log('[useAuth] Using Telegram authentication with initData');
      // Очищаем старый токен перед новой авторизацией
      if (existingToken) {
        console.log('[useAuth] Clearing old token - using fresh Telegram initData');
        authService.clearToken();
      }
      login();
      return;
    }
    
    // ПРИОРИТЕТ 3: Сохраненный токен (fallback)
    if (existingToken) {
      console.log('[useAuth] No Telegram initData - using existing token');
      loadUserWithToken();
      return;
    }
    
    // ПРИОРИТЕТ 4: Fallback авторизация
    if (isReady) {
      console.warn('[useAuth] No initData and no token - attempting fallback authentication');
      console.log('[useAuth] Environment:', {
        isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
        hasWindow: typeof window !== 'undefined',
        hasTelegram: !!window.Telegram,
        hasTelegramWebApp: !!(window.Telegram?.WebApp),
        userAgent: navigator.userAgent.substring(0, 100)
      });
      loginWithFallback();
    }
  }, [isReady, initData, tgUser]);

  const loadUserWithToken = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[useAuth] Loading user data with existing token...');
      const response = await authService.getCurrentUser();
      console.log('[useAuth] Response received:', { 
        success: response.success, 
        hasData: !!response.data,
        data: response.data 
      });

      if (response.success && response.data) {
        // ✅ ИСПРАВЛЕНО: Устанавливаем user ОДИН раз из API
        setUser(response.data);
        console.log('[useAuth] User loaded from API:', response.data);
        
        // P1.2.6: Set Sentry user context
        setUserContext({
          id: response.data.id,
          username: response.data.username || `user_${response.data.id}`,
        });

        // 🔄 Проверяем что права в токене совпадают с БД
        const currentToken = authService.getToken();
        if (currentToken) {
          try {
            const tokenPayload = JSON.parse(atob(currentToken.split('.')[1]));
            
            // Если isAdmin в токене не совпадает с данными из БД - обновляем токен
            if (tokenPayload.isAdmin !== response.data.isAdmin) {
              console.warn('[useAuth] ⚠️ Token isAdmin mismatch! Refreshing...', {
                tokenIsAdmin: tokenPayload.isAdmin,
                dbIsAdmin: response.data.isAdmin
              });
              
              // Обновляем токен асинхронно
              refresh().catch(err => {
                console.error('[useAuth] Failed to refresh token:', err);
              });
            }
          } catch (e) {
            console.error('[useAuth] Failed to parse token:', e);
          }
        }
      } else {
        console.error('[useAuth] Invalid response format:', response);
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

      console.log('[useAuth] 🔄 Attempting fallback authentication...');
      console.log('[useAuth] Current state:', {
        hasInitData: !!initData,
        initDataLength: initData?.length || 0,
        hasTelegramSDK: !!(window.Telegram?.WebApp),
        location: window.location.href
      });
      
      // Пытаемся получить данные из Telegram WebApp напрямую
      const tg = window.Telegram?.WebApp as any;
      if (tg && tg.initDataUnsafe?.user) {
        const tgUser = tg.initDataUnsafe.user;
        
        console.log('[useAuth] ✅ Found Telegram user data:', {
          id: tgUser.id,
          username: tgUser.username,
          firstName: tgUser.first_name
        });
        
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
        console.log('[useAuth] ✅ Fallback authentication successful with Telegram data');
        setIsLoading(false);
        return;
      }
      
      // Если нет Telegram данных - пробуем авторизоваться без них
      console.log('[useAuth] ⚠️ No Telegram SDK data - trying backend authentication without initData');
      console.log('[useAuth] API URL:', import.meta.env.VITE_API_URL);
      
      const response = await authService.validateInitData('');
      
      console.log('[useAuth] Backend response:', {
        success: response.success,
        hasUser: !!response.user,
        hasToken: !!response.token,
        error: response.error
      });
      
      if (response.success && response.user) {
        setUser(response.user);
        authService.setToken(response.token);
        console.log('[useAuth] ✅ Fallback authentication successful without Telegram data');
        console.log('[useAuth] User:', response.user);
      } else {
        throw new Error(response.error || 'Authentication failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fallback authentication failed';
      setError(errorMessage);
      console.error('[useAuth] ❌ Fallback auth error:', err);
      console.error('[useAuth] Error details:', {
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined
      });
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    if (!initData) {
      console.error('[useAuth] ❌ Login failed: No initData');
      setError('No init data available');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('[useAuth] 🔄 Starting login with initData...');
      console.log('[useAuth] InitData length:', initData.length);
      console.log('[useAuth] API URL:', import.meta.env.VITE_API_URL);
      
      const response = await authService.validateInitData(initData);
      
      console.log('[useAuth] 📡 Server response received:', {
        success: response.success,
        hasUser: !!response.user,
        hasToken: !!response.token,
        error: response.error
      });
      
      if (response.success) {
        setUser(response.user);
        
        // Сохраняем токен для последующих запросов
        if (response.token) {
          authService.setToken(response.token);
        }
        
        console.log('[useAuth] ✅ Login successful', { 
          userId: response.user.id,
          username: response.user.username 
        });
      } else {
        throw new Error(response.error || 'Authentication failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useAuth] ❌ Login error:', err);
      console.error('[useAuth] Error details:', {
        message: errorMessage,
        type: err instanceof Error ? err.constructor.name : typeof err
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    authService.clearToken();
    setError(null);
    
    // P1.2.6: Clear Sentry user context
    clearUserContext();
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
