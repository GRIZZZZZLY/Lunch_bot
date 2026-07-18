/* Layout root-вкладок: брендовый Header + BottomNavigation.
   Telegram BackButton здесь скрыт (им управляет только DetailLayout и оверлеи). */
import { Outlet } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ToastContainer } from '@/components/common/ToastContainer';
import { ROOT_TABS } from '@/app/navigation';

export function RootLayout() {
  return (
    <div className="flex flex-col min-h-[100dvh] mx-auto w-full max-w-[430px]">
      <Header />

      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(88px + var(--safe-area-bottom, 0px))' }}
      >
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      <BottomNavigation items={ROOT_TABS} />
      <ToastContainer />
    </div>
  );
}
