/* Compact scheme (A/B/C) + theme (light/dark) switcher for the app header.
   Must render inside a `.rl` ancestor (uses scoped .seg/.btn styles). */
import { useState } from 'react';
import { Icon } from './Icon';
import { getScheme, getTheme, setScheme, setTheme, type Scheme, type Theme } from '@/lib/appearance';

const SCHEMES: Scheme[] = ['a', 'b', 'c'];

export function SchemeThemeToggle() {
  const [scheme, setSchemeState] = useState<Scheme>(getScheme);
  const [theme, setThemeState] = useState<Theme>(getTheme);

  const pickScheme = (s: Scheme) => {
    setScheme(s);
    setSchemeState(s);
  };
  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="seg" role="tablist" aria-label="Цветовая схема">
        {SCHEMES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={scheme === s}
            className={scheme === s ? 'on' : ''}
            onClick={() => pickScheme(s)}
            style={{ textTransform: 'uppercase', minWidth: 26, padding: '6px 8px' }}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn--icon btn--ghost btn--sm"
        aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        onClick={toggleTheme}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>
    </div>
  );
}
