/* Layout pushed detail-экранов: единый контекстный ScreenHeader,
   без BottomNavigation и без второго брендового header.
   Назад: Telegram BackButton (в браузере — in-app fallback-кнопка);
   открытый оверлей закрывается раньше навигации (lib/backButton.ts). */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { RouteFallback } from '@/components/common/RouteFallback';
import { ToastContainer } from '@/components/common/ToastContainer';
import { IconButton } from '@/components/rl/primitives';
import { getWebApp } from '@/lib/telegram';
import { closeTopOverlay, setBaseBackHandler } from '@/lib/backButton';
import { useBootReveal, usePageTransition, useRouteFocus } from '@/lib/motion';
import {
  ScreenHeaderContext,
  type ScreenHeaderApi,
  type ScreenHeaderState,
} from './screenHeader';

const EMPTY_HEADER: ScreenHeaderState = { title: '' };

export function DetailLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [header, setHeaderState] = useState<ScreenHeaderState>(EMPTY_HEADER);
  /* Deep link открывает Mini App прямо здесь, минуя вкладки: кадр собирается
     так же, только без таббара — его на detail-экране нет. */
  const boot = useBootReveal();

  usePageTransition(pageRef, location.pathname);
  useRouteFocus(mainRef, location.pathname);

  // location.key === 'default' — приложение открыто сразу на этом экране
  // (deep link / refresh): внутренней истории нет, назад ведёт на главную.
  const canGoBack = location.key !== 'default';

  const goBack = useCallback(() => {
    if (closeTopOverlay()) return;
    if (canGoBack) navigate(-1);
    else navigate('/', { replace: true });
  }, [canGoBack, navigate]);

  useEffect(() => setBaseBackHandler(goBack), [goBack]);

  const headerApi = useMemo<ScreenHeaderApi>(
    () => ({
      set: (next) =>
        setHeaderState((prev) =>
          prev.title === next.title && prev.action === next.action ? prev : next,
        ),
      reset: () => setHeaderState(EMPTY_HEADER),
    }),
    [],
  );

  const inTelegram = !!getWebApp();

  return (
    <div className="rl flex flex-col min-h-[100dvh] mx-auto w-full max-w-[430px]">
      <ScreenHeaderContext.Provider value={headerApi}>
        <div
          className={boot ? 'anim-boot-top' : undefined}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 'calc(10px + var(--safe-area-top, 0px)) 16px 12px',
            background: 'var(--canvas)',
            borderBottom: '1px solid var(--divider)',
          }}
        >
          {!inTelegram && (
            <IconButton
              variant="ghost"
              name="chevronRight"
              aria-label="Назад"
              onClick={goBack}
              style={{ transform: 'rotate(180deg)' }}
            />
          )}
          <h1
            className="font-head tight"
            style={{
              margin: 0,
              flex: 1,
              fontSize: 'var(--text-18)',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {header.title}
          </h1>
          {header.action}
        </div>

        <main
          ref={mainRef}
          tabIndex={-1}
          className={`flex-1 overflow-y-auto${boot ? ' anim-boot-content' : ''}`}
          style={{ paddingBottom: 'calc(24px + var(--safe-area-bottom, 0px))' }}
        >
          <ErrorBoundary>
            {/* См. RootLayout: key перезапускает анимацию входа при переходе
                между detail-экранами, где layout остаётся тем же. */}
            <div key={location.pathname} ref={pageRef} className="anim-page">
              {/* См. RootLayout: граница внутри layout'а сохраняет контекстную
                  шапку с заголовком, пока грузится чанк экрана. */}
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </ErrorBoundary>
        </main>
      </ScreenHeaderContext.Provider>
      <ToastContainer />
    </div>
  );
}
