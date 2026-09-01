import type { ReactNode } from 'react';
import { SchemeThemeToggle } from '@/components/rl/SchemeThemeToggle';
import { useBootReveal } from '@/lib/motion';

interface HeaderProps {
  title?: string;
  right?: ReactNode;
}

export function Header({ title = 'Rocket Lunch', right }: HeaderProps) {
  // Верхняя грань кадра: при первом открытии оседает сверху (styles/motion.css).
  const boot = useBootReveal();

  return (
    <div
      className={boot ? 'rl anim-boot-top' : 'rl'}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        // Обёртка прозрачная: точечная фактура (body::before) должна
        // просвечивать в отступах, иначе шапка снова читается плашкой.
        padding: '8px 12px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-control-sm)',
              flexShrink: 0,
              background: 'var(--vote, var(--accent))',
              // Пара к --vote: раньше здесь стоял --danger-foreground, и правка
              // danger-палитры увела бы цвет логотипа.
              color: 'var(--vote-foreground, #fff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Логотип — маска, а не <img>: PNG одноцветный, и через
                background: currentColor знак берёт --vote-foreground, то есть
                остаётся читаемым и на кирпичной плитке светлой темы, и на
                оранжевой тёмной. У <img> цвет был бы вшит в файл. */}
            <div
              aria-hidden
              style={{
                width: 22,
                height: 22,
                background: 'currentColor',
                WebkitMaskImage: 'url(/logo-rocket.png)',
                maskImage: 'url(/logo-rocket.png)',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
              }}
            />
          </div>
          <div
            className="tight"
            style={{
              // Unbounded — только бренд (система C)
              fontFamily: 'var(--font-brand)',
              fontWeight: 700,
              fontSize: 'var(--text-16)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
        </div>
        {right ?? <SchemeThemeToggle />}
      </header>
    </div>
  );
}
