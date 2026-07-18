/* Обёртка для превью claude.ai/design: семантические токены темы определены
   на <html data-theme="light|dark"> (src/styles/tokens.css) — без атрибута
   компоненты рендерятся без стилей. Провайдер выставляет тему на корне.
   Экспортируется в бандл — дизайн-агент тоже может использовать его как
   корневую обёртку приложения. */
import { useLayoutEffect, type ReactNode } from 'react';

export function DSThemeRoot({
  theme = 'light',
  children,
}: {
  theme?: 'light' | 'dark';
  children?: ReactNode;
}) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return <>{children}</>;
}
