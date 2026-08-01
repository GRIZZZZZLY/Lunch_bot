import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthGate } from '@/components/common/AuthGate';
import { RootLayout } from '@/app/layouts/RootLayout';
import { DetailLayout } from '@/app/layouts/DetailLayout';
import { HomePage } from '@/features/home/HomePage';
import { Skeleton } from '@/shared/ui';

/* Главная едет в основном чанке: это первый экран, и ленивая загрузка добавила
   бы ему лишний рейс по сети. Всё остальное грузится по требованию — Mini App
   открывают из чата на мобильной сети, и тянуть код закупки ради голосования
   значит платить за экран, который пользователь может не открыть.
   Вкладки нижней навигации предзагружаются на простое (usePrefetchTabs),
   поэтому переключение остаётся мгновенным. */
const MenuPage = lazy(() => import('@/features/menu/MenuPage'));
const StatsPage = lazy(() =>
  import('@/features/stats/StatsPage').then((m) => ({ default: m.StatsPage })),
);
const ProfilePage = lazy(() =>
  import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const BudgetPage = lazy(() =>
  import('@/features/budget/BudgetPage').then((m) => ({ default: m.BudgetPage })),
);
const PollHistoryPage = lazy(() =>
  import('@/features/polls/PollHistoryPage').then((m) => ({ default: m.PollHistoryPage })),
);
const PollResultsPage = lazy(() =>
  import('@/features/polls/PollResultsPage').then((m) => ({ default: m.PollResultsPage })),
);
const StoreRunPage = lazy(() =>
  import('@/features/store-run/StoreRunPage').then((m) => ({ default: m.StoreRunPage })),
);
const SuggestionsPage = lazy(() =>
  import('@/features/suggestions/SuggestionsPage').then((m) => ({ default: m.SuggestionsPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

// Dev-only: lazy, чтобы demo-код не попадал в production-бандл.
const UiShowcasePage = lazy(() =>
  import('@/pages/UiShowcasePage').then((m) => ({ default: m.UiShowcasePage })),
);

/** Заглушка маршрута: шапка и навигация на месте, меняется только контент. */
function RouteFallback() {
  return (
    <div className="rl" style={{ padding: 'var(--space-4) var(--space-3)' }}>
      <Skeleton variant="text" width="45%" height={12} />
      <div style={{ height: 'var(--space-4)' }} />
      <Skeleton variant="block" height={120} />
      <div style={{ height: 'var(--space-3)' }} />
      <Skeleton variant="block" height={72} />
    </div>
  );
}

/* Вкладки нижней навигации — один тап от Главной, поэтому их чанки тянем на
   простое, а не в момент нажатия. */
function usePrefetchTabs() {
  useEffect(() => {
    const prefetch = () => {
      void import('@/features/menu/MenuPage');
      void import('@/features/stats/StatsPage');
      void import('@/features/profile/ProfilePage');
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(prefetch, 2000);
    return () => window.clearTimeout(t);
  }, []);
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <AppRoutes />
      </AuthGate>
    </BrowserRouter>
  );
}

export function AppRoutes() {
  usePrefetchTabs();
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* Dev-only playground: в production не регистрируется (404); в
              навигацию не добавлять. */}
          {import.meta.env.DEV && <Route path="/dev/ui" element={<UiShowcasePage />} />}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<DetailLayout />}>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/poll/history" element={<PollHistoryPage />} />
          <Route path="/poll/:id/results" element={<PollResultsPage />} />
          <Route path="/store-run/:id" element={<StoreRunPage />} />
          <Route path="/suggestions" element={<SuggestionsPage />} />
          <Route path="/suggestions/mine" element={<SuggestionsPage onlyMine />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
