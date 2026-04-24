import { useEffect, useMemo, lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from './lib/queryClient';

// Lazy load React Query Devtools only in development
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({
        default: m.ReactQueryDevtools,
      }))
    )
  : null;
import { initCache } from './lib/cacheUtils';
import { ErrorBoundary } from './lib/sentry';
import { Toaster } from 'sonner';
import { AppSkeleton } from './components/common/AppSkeleton';
import { Layout } from './components/layout/Layout';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { PWAUpdatePrompt } from './components/common/PWAUpdatePrompt';
import { NavigationProgress } from './components/common/NavigationProgress';
import { WelcomeModal } from './components/onboarding';
import { useOnboarding } from './hooks/useOnboarding';
import { AuthProvider } from './hooks/useAuth';
import { useAppStore } from './store/useAppStore';
import { WebVitals, PerformanceMonitor } from './components/performance/WebVitals';
import { ToastProvider } from './components/common/ToastManager';

const isChunkLoadError = (error: unknown): boolean => {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('ChunkLoadError')
  );
};

const tryRecoverChunkLoad = async () => {
  const retryKey = 'lazy-import-retry';
  const alreadyRetried = sessionStorage.getItem(retryKey);

  if (alreadyRetried) {
    sessionStorage.removeItem(retryKey);
    return;
  }

  sessionStorage.setItem(retryKey, '1');

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    } catch {
      // Ignore SW cleanup errors
    }
  }

  window.location.reload();
};

// ✅ ИСПРАВЛЕНО: Lazy load с обработкой ошибок
const createLazyComponent = <T extends ComponentType<unknown>>(
  importFn: () => Promise<Record<string, T>>,
  exportName: string
) => {
  return lazy(() =>
    importFn()
      .then(module => ({ default: module[exportName] as T }))
      .catch(error => {
        console.error(`Failed to load component ${exportName}:`, error);
        if (isChunkLoadError(error)) {
          tryRecoverChunkLoad();
        }
        // Возвращаем fallback компонент при ошибке загрузки
        return {
          default: (() => (
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Ошибка загрузки</h2>
                <p className="text-muted-foreground mb-4">Не удалось загрузить страницу</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-peach-500 text-white rounded-lg hover:bg-peach-600"
                >
                  Перезагрузить
                </button>
              </div>
            </div>
          )) as unknown as T
        };
      })
  );
};

// ✅ ОПТИМИЗАЦИЯ: Lazy load для HomePage и StatsPage (было синхронно)
const HomePage = createLazyComponent(() => import('./pages/HomePage'), 'HomePage');
const StatsPage = createLazyComponent(() => import('./pages/StatsPage'), 'StatsPage');

const MenuPage = createLazyComponent(() => import('./pages/MenuPage'), 'MenuPage');
// VotingPage УДАЛЁН - функционал перенесён в InlineVotingCard на главной странице
const PollHistoryPage = createLazyComponent(() => import('./pages/PollHistoryPage'), 'PollHistoryPage');
const PollResultsPage = createLazyComponent(() => import('./pages/PollResultsPage'), 'PollResultsPage');
const ProfilePage = createLazyComponent(() => import('./pages/ProfilePage'), 'ProfilePage');
const AdminDashboardPage = createLazyComponent(() => import('./pages/AdminDashboardPage'), 'AdminDashboardPage');
const SuggestionsPage = createLazyComponent(() => import('./pages/SuggestionsPage'), 'SuggestionsPage');
const MySuggestionsPage = createLazyComponent(() => import('./pages/MySuggestionsPage'), 'MySuggestionsPage');
const UserStatsPage = createLazyComponent(() => import('./pages/UserStatsPage'), 'UserStatsPage');



function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isModalOpen, completeOnboarding } = useOnboarding();
  const theme = useAppStore((state) => state.theme);
  
  // Инициализация cache при запуске (только 1 раз)
  useEffect(() => {
    initCache();
  }, []);

  // Debug logging (в useEffect чтобы не вызывать setState во время рендера)
  // ✅ ИСПРАВЛЕНО: console.log обёрнут в DEV проверку
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[AppContent] Render:', {
        pathname: location.pathname,
        theme,
        isModalOpen,
      });
    }
  }, [location.pathname, theme, isModalOpen]);
  
  // Применяем тему глобально к <html>
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Синхронизируем цвета шапки/фона Telegram Mini App с темой проекта
    // Цвета совпадают с --background из styles/globals.css
    const bgColor = theme === 'dark' ? '#161c26' : '#f4f0ea';
    const tgWebApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
    if (tgWebApp) {
      try {
        tgWebApp.setHeaderColor?.(bgColor);
        tgWebApp.setBackgroundColor?.(bgColor);
        tgWebApp.setBottomBarColor?.(bgColor);
      } catch {
        // Старые версии Telegram могут не поддерживать — игнорируем
      }
    }
  }, [theme]);

  // Deep Link: Обработка pollId из URL параметров
  // ВАЖНО: Больше НЕ перенаправляем на /poll/:id, остаёмся на главной
  // InlineVotingCard на главной странице автоматически развернётся и покажет нужное голосование
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const pollId = searchParams.get('pollId');

    if (pollId && location.pathname === '/') {
      // Логируем, что deep link обработан
      if (import.meta.env.DEV) {
        console.log('[Deep Link] Poll ID detected on HomePage:', pollId);
        console.log('[Deep Link] InlineVotingCard will handle poll display');
      }
      
      // НЕ делаем navigate - InlineVotingCard сам покажет нужное голосование
      // Параметр ?pollId=X остаётся в URL для HomePage
    }
  }, [location.search, location.pathname, navigate]);



  // ✅ ИСПРАВЛЕНО: Preload критичных страниц через requestIdleCallback
  useEffect(() => {
    let cancelled = false;

    // Проверяем поддержку requestIdleCallback
    if ('requestIdleCallback' in window) {
      const handle = requestIdleCallback(
        () => {
          if (cancelled) return;

          // Предзагружаем только production страницы
          import('./pages/MenuPage').catch(() => {});
          import('./pages/StatsPage').catch(() => {});
          import('./pages/HomePage').catch(() => {});
          import('./pages/ProfilePage').catch(() => {});
          import('./pages/PollHistoryPage').catch(() => {});
        },
        { timeout: 2000 } // Максимум 2 секунды ожидания
      );

      return () => {
        cancelled = true;
        cancelIdleCallback(handle);
      };
    } else {
      // Fallback для старых браузеров
      const timer = setTimeout(() => {
        if (cancelled) return;

        import('./pages/MenuPage').catch(() => {});
        import('./pages/StatsPage').catch(() => {});
        import('./pages/HomePage').catch(() => {});
        import('./pages/ProfilePage').catch(() => {});
        import('./pages/PollHistoryPage').catch(() => {});
      }, 100);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, []);

  // Показываем навигацию на всех основных страницах (кроме голосования и других модальных)
  const showNavigation = ['/', '/menu', '/stats', '/profile', '/vote'].includes(location.pathname);
  
  // Debug logging (в useEffect)
  // ✅ ИСПРАВЛЕНО: console.log обёрнут в DEV проверку
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🔍 [AppContent] Navigation state:', {
        pathname: location.pathname,
        showNavigation,
      });
    }
  }, [location.pathname, showNavigation]);

  return (
    <Layout>
      <div className="min-h-screen flex flex-col">
        <div className="flex-1">
          <Suspense fallback={<AppSkeleton />}>
            <Routes>
              {/* Production Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/stats" element={<StatsPage />} />
              
              {/* Voting Routes */}
              <Route path="/vote" element={<HomePage />} />
              <Route path="/vote/hub" element={<HomePage />} /> {/* Legacy redirect */}
              <Route path="/vote/history" element={<PollHistoryPage />} />
              
              {/* ИЗМЕНЕНО: /poll/:pollId теперь редиректит на главную
                  Все голосования показываются через InlineVotingCard на главной странице */}
              <Route path="/poll/history" element={<PollHistoryPage />} />
              <Route path="/poll/:pollId/results" element={<PollResultsPage />} />
              
              {/* DEPRECATED: VotingPage больше не используется
                  Все голосования через InlineVotingCard на главной странице
                  Оставлено для backwards compatibility, но редиректит на главную */}
              <Route path="/poll/:pollId" element={<HomePage />} />
              <Route path="/vote/:pollId" element={<HomePage />} />
              
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/user/stats" element={<UserStatsPage />} />
              
              {/* Admin Routes */}
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/suggestions" element={<SuggestionsPage />} />

              {/* User Suggestions Route */}
              <Route path="/my-suggestions" element={<MySuggestionsPage />} />


            </Routes>
          </Suspense>
        </div>
        {showNavigation && <BottomNavigation />}
        
        {/* Welcome Onboarding Modal */}
        <WelcomeModal isOpen={isModalOpen} onClose={completeOnboarding} />
      </div>
    </Layout>
  );
}

function App() {
  const persistOptions = useMemo(
    () => ({ persister, maxAge: 24 * 60 * 60 * 1000 }),
    []
  );

  return (
      <ErrorBoundary
        fallback={({ error, componentStack, resetError }) => (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <h2>⚠️ Что-то пошло не так</h2>
            <p>{error instanceof Error ? error.message : 'Произошла ошибка'}</p>
            {componentStack ? (
              <pre
                style={{
                  marginTop: 12,
                  textAlign: 'left',
                  whiteSpace: 'pre-wrap',
                  fontSize: 12,
                  color: '#666',
                }}
              >
                {componentStack}
              </pre>
            ) : null}
            <button onClick={resetError}>Попробовать снова</button>
          </div>
        )}
        showDialog={false}
      >
      <PersistQueryClientProvider 
        client={queryClient}
        persistOptions={persistOptions} // 24 hours
      >
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <Toaster 
                position="top-center" 
                richColors 
                closeButton 
                icons={{
                  success: undefined,
                  error: undefined,
                  warning: undefined,
                  info: undefined,
                }}
              />
              <NavigationProgress />
              <OfflineIndicator />
              <PWAUpdatePrompt />
              <WebVitals />
              <PerformanceMonitor />
              <AppContent />
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
        {/* ✅ ИСПРАВЛЕНО: React Query Devtools включены в dev режиме (lazy loaded) */}
        {import.meta.env.DEV && ReactQueryDevtools && (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        )}
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
