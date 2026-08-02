import type { ReactNode } from 'react';
import { Icon } from '@/components/rl/Icon';
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
            {/* 22/1.5, а не 18/2: у ракеты стабилизаторы и окно тонут, если
                обводка толще, а тайл всего 32px. */}
            <Icon name="rocket" size={22} stroke={1.5} />
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
