import { useState, useEffect, lazy, Suspense, startTransition } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient, persister, cacheUtils } from './lib/queryClient';
import { initCache } from './lib/cacheUtils';
import { ErrorBoundary } from './lib/sentry';
import { Toaster } from 'sonner';
import { PageLoader } from './components/common/PageLoader';
import { DelayedFallback } from './components/common/DelayedFallback';
import { Layout } from './components/layout/Layout';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { OfflineIndicator, UpdatePrompt } from './hooks/usePWA';
import { WelcomeModal } from './components/onboarding';
import { useOnboarding } from './hooks/useOnboarding';
import { useAppStore } from './store/useAppStore';
import { WebVitals, PerformanceMonitor } from './components/performance/WebVitals';
import { OfflineBanner } from './components/common/OfflineBanner';
import { InstallPrompt } from './components/pwa/InstallPrompt';

// ✅ ИСПРАВЛЕНО: Lazy load с обработкой ошибок
const createLazyComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ [key: string]: T }>,
  exportName: string
) => {
  return lazy(() =>
    importFn()
      .then(module => ({ default: module[exportName] as T }))
      .catch(error => {
        console.error(`Failed to load component ${exportName}:`, error);
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

const HomePage = createLazyComponent(() => import('./pages/HomePage'), 'HomePage');
const MenuPage = createLazyComponent(() => import('./pages/MenuPage'), 'MenuPage');
const StatsPage = createLazyComponent(() => import('./pages/StatsPage'), 'StatsPage');
const PollHistoryPage = createLazyComponent(() => import('./pages/PollHistoryPage'), 'PollHistoryPage');
const PollResultsPage = createLazyComponent(() => import('./pages/PollResultsPage'), 'PollResultsPage');
const ProfilePage = createLazyComponent(() => import('./pages/ProfilePage'), 'ProfilePage');
const AdminDashboardPage = createLazyComponent(() => import('./pages/AdminDashboardPage'), 'AdminDashboardPage');
const UserStatsPage = createLazyComponent(() => import('./pages/UserStatsPage'), 'UserStatsPage');

// Dev/Debug pages - удалены из сборки, так как вызывают ошибки импортов
// Если нужны, исправьте импорты в __dev__ файлах на относительные пути с ../../
// const HomePageDiagnostic = import.meta.env.DEV ? lazy(() => import('./pages/__dev__/HomePageDiagnostic').then(module => ({ default: module.HomePageDiagnostic }))) : null;
// const HomePageSimple = import.meta.env.DEV ? lazy(() => import('./pages/__dev__/HomePageSimple').then(module => ({ default: module.HomePageSimple }))) : null;
// const TestIconsPage = import.meta.env.DEV ? lazy(() => import('./pages/__dev__/TestIconsPage').then(module => ({ default: module.TestIconsPage }))) : null;
// const ColorDemoPage = import.meta.env.DEV ? lazy(() => import('./pages/__dev__/ColorDemoPage').then(module => ({ default: module.ColorDemoPage }))) : null;
// const ColorTestPage = import.meta.env.DEV ? lazy(() => import('./pages/__dev__/ColorTestPage').then(module => ({ default: module.ColorTestPage }))) : null;
// const DebugHomePage = import.meta.env.DEV ? lazy(() => import('./pages/__dev__/DebugHomePage').then(module => ({ default: module.DebugHomePage }))) : null;
// const SimpleHomePage = import.meta.env.DEV ? lazy(() => import('./pages/__dev__/SimpleHomePage').then(module => ({ default: module.SimpleHomePage }))) : null;
// const TestPage = import.meta.env.DEV ? lazy(() => import('./pages/__dev__/TestPage').then(module => ({ default: module.TestPage }))) : null;

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
  useEffect(() => {
    console.log('[AppContent] Render:', {
      pathname: location.pathname,
      theme,
      isModalOpen,
    });
  }, [location.pathname, theme, isModalOpen]);
  
  // Применяем тему глобально к <html>
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Deep Link: Обработка pollId из URL параметров
  // DISABLED: Все голосования происходят на главной странице
  // useEffect(() => {
  //   const searchParams = new URLSearchParams(location.search);
  //   const pollId = searchParams.get('pollId');
  //   
  //   if (pollId) {
  //     // Автоматически перенаправляем на страницу голосования
  //     console.log('[Deep Link] Navigating to poll:', pollId);
  //     navigate(`/poll/${pollId}`, { replace: true });
  //   }
  // }, [location.search, navigate]);



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
  useEffect(() => {
    console.log('🔍 [AppContent] Navigation state:', {
      pathname: location.pathname,
      showNavigation,
    });
  }, [location.pathname, showNavigation]);

  return (
    <Layout>
      <div className="min-h-screen flex flex-col">
        <div className="flex-1">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-peach-500 mx-auto mb-4"></div>
                <p className="text-muted-foreground">Загрузка...</p>
              </div>
            </div>
          }>
            <Routes>
              {/* Production Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/stats" element={<StatsPage />} />
              
              {/* Voting Routes */}
              <Route path="/vote" element={<HomePage />} />
              <Route path="/vote/hub" element={<HomePage />} /> {/* Legacy redirect */}
              <Route path="/vote/history" element={<PollHistoryPage />} />
              {/* DISABLED: Voting happens on HomePage now */}
              {/* <Route path="/vote/:pollId" element={<VotingPage />} /> */}
              
              {/* Legacy poll routes (для обратной совместимости) */}
              <Route path="/poll/history" element={<PollHistoryPage />} />
              {/* DISABLED: Voting happens on HomePage now */}
              {/* <Route path="/poll/:pollId" element={<VotingPage />} /> */}
              <Route path="/poll/:pollId/results" element={<PollResultsPage />} />
              
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/user/stats" element={<UserStatsPage />} />
              
              {/* Admin Routes */}
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />

              {/* Dev/Debug Routes - закомментированы, так как компоненты не используются */}
              {/* {import.meta.env.DEV && HomePageSimple && <Route path="/debug-simple" element={<HomePageSimple />} />}
              {import.meta.env.DEV && HomePageDiagnostic && <Route path="/debug-diagnostic" element={<HomePageDiagnostic />} />}
              {import.meta.env.DEV && DebugHomePage && <Route path="/debug" element={<DebugHomePage />} />}
              {import.meta.env.DEV && TestIconsPage && <Route path="/test-icons" element={<TestIconsPage />} />}
              {import.meta.env.DEV && ColorDemoPage && <Route path="/color-demo" element={<ColorDemoPage />} />}
              {import.meta.env.DEV && ColorTestPage && <Route path="/color-test" element={<ColorTestPage />} />}
              {import.meta.env.DEV && TestPage && <Route path="/test" element={<TestPage />} />}
              {import.meta.env.DEV && SimpleHomePage && <Route path="/simple" element={<SimpleHomePage />} />} */}
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
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>⚠️ Что-то пошло не так</h2>
          <p>{error && typeof error === 'object' && 'message' in error ? String((error as any).message) : 'Произошла ошибка'}</p>
          <button onClick={resetError}>Попробовать снова</button>
        </div>
      )}
      showDialog={false}
    >
      <PersistQueryClientProvider 
        client={queryClient}
        persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }} // 24 hours
      >
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Toaster position="top-center" richColors closeButton />
          <OfflineIndicator />
          <OfflineBanner />
          <UpdatePrompt />
          <InstallPrompt />
          <WebVitals />
          <PerformanceMonitor />
          <AppContent />
        </BrowserRouter>
        {/* ✅ ИСПРАВЛЕНО: React Query Devtools включены в dev режиме */}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
