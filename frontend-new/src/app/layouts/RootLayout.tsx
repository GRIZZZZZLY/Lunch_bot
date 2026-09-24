/* Layout root-вкладок: шапка вкладки + BottomNavigation.
   Telegram BackButton здесь скрыт (им управляет только DetailLayout и оверлеи). */
import { Suspense, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { TeamSlot } from '@/components/layout/TeamSlot';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { RouteFallback } from '@/components/common/RouteFallback';
import { ToastContainer } from '@/components/common/ToastContainer';
import { ROOT_TABS } from '@/app/navigation';
import { useBootReveal, usePageTransition, useRouteFocus } from '@/lib/motion';
import { ScreenHeaderContext, useScreenHeaderState } from './screenHeader';

export function RootLayout() {
  const mainRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const { header, api } = useScreenHeaderState();
  /* Пока ленивый чанк вкладки грузится, страница заголовок ещё не объявила:
     шапка берёт название вкладки из нижней навигации, а не пустеет. */
  const tabLabel = ROOT_TABS.find((t) => t.to === pathname)?.label;
  /* Сборка кадра висит на <main>, а не на контейнере страницы: тот пересоздаётся
     под key={pathname} и уже несёт анимацию перехода. Две анимации на одном
     узле — это снова два прихода подряд. */
  const boot = useBootReveal();
  usePageTransition(pageRef, pathname);
  useRouteFocus(mainRef, pathname);

  return (
    <div className="flex flex-col min-h-[100dvh] mx-auto w-full max-w-[430px]">
      <ScreenHeaderContext.Provider value={api}>
        <Header
          title={header.title || tabLabel}
          subtitle={header.subtitle}
          team={<TeamSlot />}
        />

        <main
          ref={mainRef}
          tabIndex={-1}
          className={`flex-1 overflow-y-auto${boot ? ' anim-boot-content' : ''}`}
          style={{ paddingBottom: 'calc(88px + var(--safe-area-bottom, 0px))' }}
        >
          <ErrorBoundary>
            {/* key по пути — то, что перезапускает анимацию входа: без него React
                переиспользует этот div, и на смене таба ничего не проигрывается.
                Страницу это не ломает: она и так размонтируется при смене
                маршрута. */}
            <div key={pathname} ref={pageRef} className="anim-page">
              {/* Граница Suspense внутри layout'а, а не над ним: сверху она
                  снимала вместе со страницей шапку и таббар, и загрузка чанка
                  читалась как мигание всего приложения. */}
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </ErrorBoundary>
        </main>
      </ScreenHeaderContext.Provider>

      <BottomNavigation items={ROOT_TABS} />
      <ToastContainer />
    </div>
  );
}
