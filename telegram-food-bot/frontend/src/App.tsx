import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/react-query';
import { ToastProvider } from './components/common/ToastManager';
import { PageLoader } from './components/common/PageLoader';
import { Navigation } from './components/layout/Layout';
import { OfflineIndicator, UpdatePrompt } from './hooks/usePWA';

// Lazy load страниц для Code Splitting
const MenuPage = lazy(() => import('./pages/MenuPage').then(module => ({ default: module.MenuPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then(module => ({ default: module.StatsPage })));
const VotingPage = lazy(() => import('./pages/VotingPage').then(module => ({ default: module.VotingPage })));
const PollManagementPage = lazy(() => import('./pages/PollManagementPage').then(module => ({ default: module.PollManagementPage })));
const PollHistoryPage = lazy(() => import('./pages/PollHistoryPage').then(module => ({ default: module.PollHistoryPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })));

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState<string>('menu');

  // Синхронизация табов с роутами
  useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '/menu') {
      setCurrentTab('menu');
    } else if (path === '/stats') {
      setCurrentTab('stats');
    } else if (path.startsWith('/poll')) {
      setCurrentTab('polls');
    } else if (path === '/profile') {
      setCurrentTab('profile');
    }
  }, [location.pathname]);

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    switch (tab) {
      case 'menu':
        navigate('/menu');
        break;
      case 'stats':
        navigate('/stats');
        break;
      case 'polls':
        navigate('/poll/create');
        break;
      case 'profile':
        navigate('/profile');
        break;
      default:
        navigate('/');
    }
  };

  // Показываем навигацию только на основных страницах
  const showNavigation = ['/', '/menu', '/stats', '/profile'].includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<MenuPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/vote/:pollId" element={<VotingPage />} />
            <Route path="/poll/create" element={<PollManagementPage />} />
            <Route path="/poll/history" element={<PollHistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </Suspense>
      </div>
      {showNavigation && (
        <Navigation currentTab={currentTab} onTabChange={handleTabChange} />
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <OfflineIndicator />
          <UpdatePrompt />
          <AppContent />
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
