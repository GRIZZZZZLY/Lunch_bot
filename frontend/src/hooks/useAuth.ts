import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  createContext,
  useContext,
  createElement,
} from 'react';
import type { FC, ReactNode } from 'react';
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

const AuthContext = createContext<UseAuthReturn | null>(null);

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

/**
 * Хук для управления аутентификацией
 * ✅ ИСПРАВЛЕНО: Добавлены useCallback и cleanup для предотвращения race conditions
 */
export const AuthProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { initData, user: tgUser, isReady } = useTelegram();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref для отслеживания монтирования компонента (предотвращение race conditions)
  const isMountedRef = useRef(true);

  // Ref для отслеживания текущей авторизации (предотвращение дублирования)
  const authInProgressRef = useRef(false);

  // Cleanup при размонтировании
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ✅ ИСПРАВЛЕНО: Обёртываем функции в useCallback для стабильных ссылок
  // Ref для refresh функции чтобы избежать циклической зависимости
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  
  const loadUserWithToken = useCallback(async () => {
    if (!isMountedRef.current || authInProgressRef.current) return;
    authInProgressRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      if (import.meta.env.DEV) {
        console.log('[useAuth] Loading user data with existing token...');
      }

      const response = await authService.getCurrentUser();

      if (!isMountedRef.current) return; // Проверка после async операции

      if (import.meta.env.DEV) {
        console.log('[useAuth] Response received:', {
          success: response.success,
          hasData: !!response.data
        });
      }

      if (response.success && response.data) {
        setUser(response.data);

        setUserContext({
          id: response.data.id,
          username: response.data.username || `user_${response.data.id}`,
        });

        // Проверяем что права в токене совпадают с БД
        const currentToken = authService.getToken();
        if (currentToken) {
          try {
            const tokenPayload = JSON.parse(atob(currentToken.split('.')[1]));

            if (tokenPayload.isAdmin !== response.data.isAdmin) {
              if (import.meta.env.DEV) {
                console.warn('[useAuth] ⚠️ Token isAdmin mismatch! Refreshing...');
              }

              // Обновляем токен асинхронно через ref (избегаем циклической зависимости)
              if (refreshRef.current) {
                refreshRef.current().catch(err => {
                  if (import.meta.env.DEV) {
                    console.error('[useAuth] Failed to refresh token:', err);
                  }
                });
              }
            }
          } catch (e) {
            if (import.meta.env.DEV) {
              console.error('[useAuth] Failed to parse token:', e);
            }
          }
        }
      } else {
        throw new Error('Failed to load user');
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      if (import.meta.env.DEV) {
        console.error('[useAuth] Failed to load user with token:', err);
      }

      authService.clearToken();
      setError('Invalid token');

      // ✅ ИСПРАВЛЕНО: Убран циклический вызов login()
      // Вместо этого устанавливаем ошибку и пусть useEffect сам решает что делать
      // на следующем рендере, когда authInProgressRef.current станет false
      if (import.meta.env.DEV) {
        console.log('[useAuth] Token invalid, will retry authentication on next render');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      authInProgressRef.current = false;
    }
  }, []); // ✅ ИСПРАВЛЕНО: Убрана циклическая зависимость от refresh

  const loginWithMockData = useCallback(async () => {
    if (!isMountedRef.current || authInProgressRef.current) return;
    authInProgressRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

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

      const mockToken = btoa(JSON.stringify({
        userId: mockUser.id,
        telegramId: mockUser.telegramId,
        isAdmin: mockUser.isAdmin,
        timestamp: Date.now(),
      }));

      if (!isMountedRef.current) return;

      authService.setToken(mockToken);
      setUser(mockUser);

      if (import.meta.env.DEV) {
        console.log('[useAuth] Mock authentication successful');
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      if (import.meta.env.DEV) {
        console.error('[useAuth] Mock auth error:', err);
      }
      setError('Mock authentication failed');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      authInProgressRef.current = false;
    }
  }, []);

  const loginWithFallback = useCallback(async () => {
    if (!isMountedRef.current || authInProgressRef.current) return;
    authInProgressRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      if (import.meta.env.DEV) {
        console.log('[useAuth] 🔄 Attempting fallback authentication...');
      }

      const tg = window.Telegram?.WebApp as
        | {
            initDataUnsafe?: {
              user?: {
                id: number;
                username?: string;
                first_name?: string;
                last_name?: string;
              };
            };
          }
        | undefined;
      if (tg && tg.initDataUnsafe?.user) {
        const tgUser = tg.initDataUnsafe.user;

        if (!isMountedRef.current) return;

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

        if (import.meta.env.DEV) {
          console.log('[useAuth] ✅ Fallback authentication successful with Telegram data');
        }
        setIsLoading(false);
        authInProgressRef.current = false;
        return;
      }

      if (import.meta.env.DEV) {
        console.log('[useAuth] ⚠️ No Telegram SDK data - trying backend authentication without initData');
      }

      const response = await authService.validateInitData('');

      if (!isMountedRef.current) return;

      if (response.success && response.user) {
        setUser(response.user);
        authService.setToken(response.token);

        if (import.meta.env.DEV) {
          console.log('[useAuth] ✅ Fallback authentication successful');
        }
      } else {
        throw new Error(response.error || 'Authentication failed');
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : 'Fallback authentication failed';
      setError(errorMessage);

      if (import.meta.env.DEV) {
        console.error('[useAuth] ❌ Fallback auth error:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      authInProgressRef.current = false;
    }
  }, []);

  const login = useCallback(async () => {
    if (!initData || !isMountedRef.current || authInProgressRef.current) {
      if (!initData && import.meta.env.DEV) {
        console.error('[useAuth] ❌ Login failed: No initData');
      }
      if (!initData) {
        setError('No init data available');
        setIsLoading(false);
      }
      return;
    }

    authInProgressRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      if (import.meta.env.DEV) {
        console.log('[useAuth] 🔄 Starting login with initData...');
        console.log('[useAuth] InitData length:', initData.length);
      }

      const response = await authService.validateInitData(initData);

      if (!isMountedRef.current) return; // Проверка после async операции

      if (import.meta.env.DEV) {
        console.log('[useAuth] 📡 Server response received:', {
          success: response.success,
          hasUser: !!response.user,
          hasToken: !!response.token,
          error: response.error
        });
      }

      if (response.success) {
        setUser(response.user);

        if (response.token) {
          authService.setToken(response.token);
        }

        if (import.meta.env.DEV) {
          console.log('[useAuth] ✅ Login successful', {
            userId: response.user.id,
            username: response.user.username
          });
        }
      } else {
        throw new Error(response.error || 'Authentication failed');
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      if (import.meta.env.DEV) {
        console.error('[useAuth] ❌ Login error:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      authInProgressRef.current = false;
    }
  }, [initData]); // ✅ Правильные зависимости

  const logout = useCallback(() => {
    setUser(null);
    authService.clearToken();
    setError(null);
    clearUserContext();
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const response = await authService.refreshAuth();

      if (!isMountedRef.current) return;

      if (response.success) {
        setUser(response.user);

        if (response.token) {
          authService.setToken(response.token);
        }
      } else {
        throw new Error(response.error || 'Refresh failed');
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      if (import.meta.env.DEV) {
        console.error('Refresh error:', err);
      }
      logout();
    }
  }, [logout]);

  // Обновляем ref для refresh после создания функции
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  // ✅ ИСПРАВЛЕНО: Автоматическая аутентификация БЕЗ циклических зависимостей
  useEffect(() => {
    // Пропускаем если уже идёт авторизация
    if (authInProgressRef.current) return;

    const existingToken = authService.getToken();
    const useMockApi = import.meta.env.VITE_USE_MOCK_API === 'true';
    const hasValidInitData = initData && initData.trim().length > 0;

    if (import.meta.env.DEV) {
      console.log('[useAuth] Auth check:', {
        hasExistingToken: !!existingToken,
        isReady,
        hasInitData: !!initData,
        hasTgUser: !!tgUser,
        useMockApi,
      });
    }

    // ПРИОРИТЕТ 1: Mock режим
    if (useMockApi) {
      if (import.meta.env.DEV) {
        console.log('[useAuth] MOCK MODE - using mock authentication');
      }
      loginWithMockData();
      return;
    }

    // ПРИОРИТЕТ 2: Сохраненный токен (если соответствует текущему Telegram user)
    if (existingToken) {
      if (isReady && hasValidInitData && tgUser) {
        const tokenPayload = decodeJwtPayload(existingToken);
        const tokenTelegramId = tokenPayload?.telegramId;
        const tokenMatchesUser =
          tokenTelegramId !== undefined &&
          String(tokenTelegramId) === String(tgUser.id);

        if (import.meta.env.DEV) {
          console.log('[useAuth] Token match check:', {
            tokenHasPayload: !!tokenPayload,
            tokenTelegramId,
            telegramId: tgUser.id,
            tokenMatchesUser,
          });
        }

        if (!tokenMatchesUser) {
          if (import.meta.env.DEV) {
            console.warn('[useAuth] Token belongs to another user, reauthenticating');
          }
          authService.clearToken();
          login();
          return;
        }
      }

      if (import.meta.env.DEV) {
        console.log('[useAuth] Using existing token');
      }
      loadUserWithToken();
      return;
    }

    // ПРИОРИТЕТ 3: Telegram авторизация (если есть initData)
    if (isReady && hasValidInitData && tgUser) {
      if (import.meta.env.DEV) {
        console.log('[useAuth] Using Telegram authentication with initData');
      }

      login();
      return;
    }

    // ПРИОРИТЕТ 4: Fallback авторизация
    if (isReady) {
      if (import.meta.env.DEV) {
        console.warn('[useAuth] No initData and no token - attempting fallback authentication');
      }
      loginWithFallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, initData, tgUser]); // ✅ ИСПРАВЛЕНО: Убраны функции из зависимостей (используем refs)

  const isAuthenticated = useMemo(() => user !== null, [user]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      error,
      login,
      logout,
      refresh,
    }),
    [user, isAuthenticated, isLoading, error, login, logout, refresh]
  );

  return createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = (): UseAuthReturn => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
