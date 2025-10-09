import { useState, useEffect, lazy, Suspense, startTransition } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/react-query';
import { ToastProvider } from './components/common/ToastManager';
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
import { DebugLogger } from './components/DebugLogger';

// Lazy load страниц для Code Splitting
const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const MenuPage = lazy(() => import('./pages/MenuPage').then(module => ({ default: module.MenuPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then(module => ({ default: module.StatsPage })));
const VotingPage = lazy(() => import('./pages/VotingPage').then(module => ({ default: module.VotingPage })));
const VotingHubPage = lazy(() => import('./pages/VotingHubPage').then(module => ({ default: module.VotingHubPage })));
const PollManagementPage = lazy(() => import('./pages/PollManagementPage').then(module => ({ default: module.PollManagementPage })));
const PollHistoryPage = lazy(() => import('./pages/PollHistoryPage').then(module => ({ default: module.PollHistoryPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })));

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

// Voting Router
import { VoteRouter } from './components/voting/VoteRouter';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isModalOpen, completeOnboarding } = useOnboarding();
  const theme = useAppStore((state) => state.theme);

  // Debug logging
  console.log('[AppContent] Render:', {
    pathname: location.pathname,
    theme,
    isModalOpen,
  });
  
  // Применяем тему глобально к <html>
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Deep Link: Обработка pollId из URL параметров
  useEffect(() => {
    console.log('[Deep Link] Checking URL params:', {
      search: location.search,
      pathname: location.pathname
    });
    
    const searchParams = new URLSearchParams(location.search);
    const pollId = searchParams.get('pollId');
    
    console.log('[Deep Link] Parsed pollId:', pollId);
    
    if (pollId) {
      // Автоматически перенаправляем на страницу голосования
      console.log('[Deep Link] ✅ Navigating to poll:', pollId);
      console.log('[Deep Link] Target path:', `/vote/${pollId}`);
      navigate(`/vote/${pollId}`, { replace: true });
      console.log('[Deep Link] Navigate called successfully');
    } else {
      console.log('[Deep Link] No pollId found in URL');
    }
  }, [location.search, navigate]);



  // Мгновенный preload критичных страниц для максимальной скорости
  useEffect(() => {
    // Начинаем preload сразу после монтирования (0ms delay)
    const timer = setTimeout(() => {
      // Предзагружаем только production страницы
      import('./pages/MenuPage');
      import('./pages/VotingPage');
      import('./pages/StatsPage');
      import('./pages/HomePage');
      import('./pages/ProfilePage');
      import('./pages/PollManagementPage');
      import('./pages/PollHistoryPage');
    }, 0); // Мгновенно - без задержки

    return () => clearTimeout(timer);
  }, []);

  // Показываем навигацию на всех основных страницах (кроме голосования и других модальных)
  const showNavigation = ['/', '/menu', '/stats', '/profile', '/vote'].includes(location.pathname);
  
  console.log('🔍 [AppContent] Navigation state:', {
    pathname: location.pathname,
    showNavigation,
  });

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
              
              {/* Voting Routes - Умный роутинг */}
              <Route path="/vote" element={<VoteRouter />} />
              <Route path="/vote/hub" element={<VotingHubPage />} />
              <Route path="/vote/history" element={<PollHistoryPage />} />
              <Route path="/vote/:pollId" element={<VotingPage />} />
              
              {/* Legacy poll routes (для обратной совместимости) */}
              <Route path="/poll/create" element={<PollManagementPage />} />
              <Route path="/poll/history" element={<PollHistoryPage />} />
              <Route path="/poll/:pollId" element={<VotingPage />} />
              
              <Route path="/profile" element={<ProfilePage />} />

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
        
        {/* Welcome Onboarding Modal - TEMPORARILY DISABLED FOR DEBUGGING */}
        {/* <WelcomeModal isOpen={isModalOpen} onClose={completeOnboarding} /> */}
      </div>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <OfflineIndicator />
          <OfflineBanner />
          <UpdatePrompt />
          <InstallPrompt />
          <WebVitals />
          <PerformanceMonitor />
          <DebugLogger />
          <AppContent />
        </BrowserRouter>
        {/* React Query Devtools - отключены для production */}
        {import.meta.env.DEV && false && <ReactQueryDevtools initialIsOpen={false} />}
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
