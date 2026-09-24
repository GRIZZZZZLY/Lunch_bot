import { useEffect, useState, type ReactNode } from 'react';
import { SchemeThemeToggle } from '@/components/rl/SchemeThemeToggle';
import { useBootReveal } from '@/lib/motion';

interface HeaderProps {
  /** Заголовок вкладки — единственный h1 экрана. */
  title?: ReactNode;
  /** Строка под заголовком. */
  subtitle?: ReactNode;
  /** Плашка команд справа; null — нет. */
  team?: ReactNode;
}

/* Шапка корневых вкладок: заголовок вкладки, плашка команд, тема. Логотипа и
   названия продукта нет — Telegram и так показывает имя бота. Правила —
   docs/design-guidelines/screens.md, «Шапка вкладок». */
export function Header({ title, subtitle, team }: HeaderProps) {
  // Верхняя грань кадра: при первом открытии оседает сверху (styles/motion.css).
  const boot = useBootReveal();
  // Подложка под шапкой нужна только над прокрученным содержимым (redesign-v2.css).
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`rl app-header${scrolled ? ' is-scrolled' : ''}${boot ? ' anim-boot-top' : ''}`}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        // Обёртка прозрачная: точечная фактура (body::before) должна
        // просвечивать в отступах, иначе шапка снова читается плашкой.
        // Безопасная зона — как у шапки detail-экранов; эти же числа
        // повторяет рамка уведомления (styles/toast.css).
        padding: 'calc(8px + var(--safe-area-top, 0px)) 12px 8px',
      }}
    >
      <header
        className="surf-elevated"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 56,
          padding: '0 16px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {title ? (
            <h1
              className="font-head tight"
              style={{
                margin: 0,
                fontSize: 'var(--text-16)',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <div
              className="tnum"
              style={{
                marginTop: 2,
                fontSize: 'var(--text-11)',
                color: 'var(--text-tertiary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {team}
        <SchemeThemeToggle />
      </header>
    </div>
  );
}
