/* Контекст заголовка detail-экрана. DetailLayout рендерит единый
   ScreenHeader; страницы объявляют title/action через useScreenHeader. */
import {
  createContext,
  useContext,
  useLayoutEffect,
  type ReactNode,
} from 'react';

export interface ScreenHeaderState {
  title: ReactNode;
  action?: ReactNode;
}

export interface ScreenHeaderApi {
  set: (state: ScreenHeaderState) => void;
  reset: () => void;
}

export const ScreenHeaderContext = createContext<ScreenHeaderApi | null>(null);

/**
 * Объявляет заголовок и action-слот текущего detail-экрана.
 * ВАЖНО: `action` (JSX) обязан быть мемоизирован (useMemo), иначе каждый
 * рендер страницы будет обновлять layout и зациклит рендер.
 */
export function useScreenHeader(title: ReactNode, action?: ReactNode) {
  const ctx = useContext(ScreenHeaderContext);
  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.set({ title, action });
    return () => ctx.reset();
  }, [ctx, title, action]);
}
