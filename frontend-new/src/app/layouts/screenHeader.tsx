/* Контекст заголовка экрана. DetailLayout и RootLayout рендерят единую шапку;
   страницы объявляют title/action/subtitle через useScreenHeader. */
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface ScreenHeaderState {
  title: ReactNode;
  action?: ReactNode;
  /** Строка под заголовком: дата на Главной, «12 блюд · Офис» в Меню. */
  subtitle?: ReactNode;
}

export interface ScreenHeaderApi {
  set: (state: ScreenHeaderState) => void;
  reset: () => void;
}

export const ScreenHeaderContext = createContext<ScreenHeaderApi | null>(null);

const EMPTY_HEADER: ScreenHeaderState = { title: '' };

/** Состояние шапки для layout'а: одно на detail-экраны и на корневые вкладки. */
export function useScreenHeaderState() {
  const [header, setHeader] = useState<ScreenHeaderState>(EMPTY_HEADER);
  const api = useMemo<ScreenHeaderApi>(
    () => ({
      set: (next) =>
        setHeader((prev) =>
          prev.title === next.title && prev.action === next.action && prev.subtitle === next.subtitle
            ? prev
            : next,
        ),
      reset: () => setHeader(EMPTY_HEADER),
    }),
    [],
  );
  return { header, api };
}

/**
 * Объявляет заголовок, action-слот и подпись текущего экрана.
 * ВАЖНО: JSX в `title`/`action`/`subtitle` обязан быть мемоизирован
 * (useMemo), иначе каждый рендер страницы будет обновлять layout и зациклит
 * рендер. Строки можно передавать как есть.
 */
export function useScreenHeader(title: ReactNode, action?: ReactNode, subtitle?: ReactNode) {
  const ctx = useContext(ScreenHeaderContext);
  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.set({ title, action, subtitle });
    return () => ctx.reset();
  }, [ctx, title, action, subtitle]);
}
