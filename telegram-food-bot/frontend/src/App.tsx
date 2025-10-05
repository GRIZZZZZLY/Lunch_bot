import { useState, useEffect, lazy, Suspense, startTransition } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/react-query';
import { ToastProvider } from './components/common/ToastManager';
import { PageLoader } from './components/common/PageLoader';
import { DelayedFallback } from './components/common/DelayedFallback';
import { Layout, Navigation } from './components/layout/Layout';
import { OfflineIndicator, UpdatePrompt } from './hooks/usePWA';
import { WelcomeModal } from './components/onboarding';
import { useOnboarding } from './hooks/useOnboarding';
import { useAppStore } from './store/useAppStore';
import { WebVitals, PerformanceMonitor } from './components/performance/WebVitals';
import { OfflineBanner } from './components/common/OfflineBanner';
import { InstallPrompt } from './components/pwa/InstallPrompt';

// Lazy load страниц для Code Splitting
const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const MenuPage = lazy(() => import('./pages/MenuPage').then(module => ({ default: module.MenuPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then(module => ({ default: module.StatsPage })));
const VotingPage = lazy(() => import('./pages/VotingPage').then(module => ({ default: module.VotingPage })));
const PollManagementPage = lazy(() => import('./pages/PollManagementPage').then(module => ({ default: module.PollManagementPage })));
const PollHistoryPage = lazy(() => import('./pages/PollHistoryPage').then(module => ({ default: module.PollHistoryPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })));
const TestIconsPage = lazy(() => import('./pages/TestIconsPage').then(module => ({ default: module.TestIconsPage })));
const ColorDemoPage = lazy(() => import('./pages/ColorDemoPage').then(module => ({ default: module.ColorDemoPage })));
const ColorTestPage = lazy(() => import('./pages/ColorTestPage').then(module => ({ default: module.ColorTestPage })));

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState<string>('menu');
  const { isModalOpen, completeOnboarding } = useOnboarding();
  const theme = useAppStore((state) => state.theme);
  
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
    const searchParams = new URLSearchParams(location.search);
    const pollId = searchParams.get('pollId');
    
    if (pollId) {
      // Автоматически перенаправляем на страницу голосования
      console.log('[Deep Link] Navigating to poll:', pollId);
      navigate(`/poll/${pollId}`, { replace: true });
    }
  }, [location.search, navigate]);

  // Синхронизация табов с роутами
  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      setCurrentTab('home');
    } else if (path === '/menu') {
      setCurrentTab('menu');
    } else if (path === '/stats') {
      setCurrentTab('stats');
    } else if (path === '/profile') {
      setCurrentTab('profile');
    }
  }, [location.pathname]);

  // Мгновенный preload ВСЕХ страниц для максимальной скорости
  useEffect(() => {
    // Начинаем preload сразу после монтирования (0ms delay)
    const timer = setTimeout(() => {
      // Предзагружаем ВСЕ страницы фоном
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

  const handleTabChange = (tab: string) => {
    // Используем startTransition для плавных переходов без блокировки UI
    startTransition(() => {
      setCurrentTab(tab);
      switch (tab) {
        case 'home':
          navigate('/');
          break;
        case 'menu':
          navigate('/menu');
          break;
        case 'stats':
          navigate('/stats');
          break;
        case 'profile':
          navigate('/profile');
          break;
        default:
          navigate('/');
      }
    });
  };

  // Показываем навигацию на всех основных страницах
  const showNavigation = ['/', '/menu', '/stats', '/profile'].includes(location.pathname);

  return (
    <Layout>
      <div className="min-h-screen flex flex-col">
        <div className="flex-1">
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/vote/:pollId" element={<VotingPage />} />
              <Route path="/poll/create" element={<PollManagementPage />} />
              <Route path="/poll/history" element={<PollHistoryPage />} />
              <Route path="/poll/:pollId" element={<VotingPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/test-icons" element={<TestIconsPage />} />
              <Route path="/color-demo" element={<ColorDemoPage />} />
              <Route path="/color-test" element={<ColorTestPage />} />
            </Routes>
          </Suspense>
        </div>
        {showNavigation && (
          <Navigation currentTab={currentTab} onTabChange={handleTabChange} />
        )}
        
        {/* Welcome Onboarding Modal */}
        <WelcomeModal isOpen={isModalOpen} onClose={completeOnboarding} />
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
          <AppContent />
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
