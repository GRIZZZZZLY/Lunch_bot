/* Theme (light/dark) switcher for the app header.
   Схема одна — «Графит и мёд», выбор схем убран вместе с редизайном 2026-07.
   Must render inside a `.rl` ancestor (uses scoped .btn styles). */
import { useState } from 'react';
import { Icon } from './Icon';
import { getTheme, setTheme, type Theme } from '@/lib/appearance';

export function SchemeThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <button
      type="button"
      className="btn btn--icon btn--ghost btn--sm"
      aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      onClick={toggleTheme}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
