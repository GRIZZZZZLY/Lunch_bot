import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ToastContainer } from '@/components/common/ToastContainer';
import { HomePage } from '@/pages/HomePage';
import { BudgetDemoPage } from '@/pages/BudgetDemoPage';
import { StatsPage } from '@/pages/StatsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AdminPage } from '@/pages/AdminPage';
import MenuPage from '@/pages/MenuPage';
import { PollHistoryPage } from '@/pages/PollHistoryPage';
import { PollResultsPage } from '@/pages/PollResultsPage';
import { StoreRunPage } from '@/pages/StoreRunPage';
import { SuggestionsPage } from '@/pages/SuggestionsPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-[100dvh] mx-auto w-full max-w-[430px]">
        <Header />

        <main
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}
        >
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/budget-demo" element={<BudgetDemoPage />} />
              <Route path="/poll/history" element={<PollHistoryPage />} />
              <Route path="/poll/:id/results" element={<PollResultsPage />} />
              <Route path="/store-run/:id" element={<StoreRunPage />} />
              <Route path="/suggestions" element={<SuggestionsPage />} />
              <Route path="/suggestions/mine" element={<SuggestionsPage onlyMine />} />
            </Routes>
          </ErrorBoundary>
        </main>

        <BottomNavigation />
        <ToastContainer />
      </div>
    </BrowserRouter>
  );
}
