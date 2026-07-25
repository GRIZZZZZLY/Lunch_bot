import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthGate } from '@/components/common/AuthGate';
import { RootLayout } from '@/app/layouts/RootLayout';
import { DetailLayout } from '@/app/layouts/DetailLayout';
import { HomePage } from '@/features/home/HomePage';

// Dev-only: lazy, чтобы demo-код не попадал в production-бандл.
const UiShowcasePage = lazy(() =>
  import('@/pages/UiShowcasePage').then((m) => ({ default: m.UiShowcasePage })),
);
import { StatsPage } from '@/features/stats/StatsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { AdminPage } from '@/pages/AdminPage';
import { BudgetPage } from '@/features/budget/BudgetPage';
import MenuPage from '@/features/menu/MenuPage';
import { PollHistoryPage } from '@/features/polls/PollHistoryPage';
import { PollResultsPage } from '@/features/polls/PollResultsPage';
import { StoreRunPage } from '@/features/store-run/StoreRunPage';
import { SuggestionsPage } from '@/features/suggestions/SuggestionsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

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
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        {/* Dev-only playground: в production не регистрируется (404); в
            навигацию не добавлять. */}
        {import.meta.env.DEV && (
          <Route
            path="/dev/ui"
            element={
              <Suspense fallback={null}>
                <UiShowcasePage />
              </Suspense>
            }
          />
        )}
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
  );
}
