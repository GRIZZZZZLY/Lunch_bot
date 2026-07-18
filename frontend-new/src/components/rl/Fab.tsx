/* ROCKET LUNCH — floating action button («Графит и мёд»).
   Без actions — обычная кнопка; с actions — speed-dial:
   плюс поворачивается, над ним раскрываются подписанные мини-действия. */
import { useState } from 'react';
import { Icon, type IconName } from './Icon';

export interface FabAction {
  icon: IconName;
  label: string;
  onClick: () => void;
}

export function Fab({
  onClick,
  label = 'Создать',
  icon = 'plus',
  actions,
}: {
  onClick?: () => void;
  label?: string;
  icon?: IconName;
  actions?: FabAction[];
}) {
  const [open, setOpen] = useState(false);
  const hasMenu = !!actions && actions.length > 0;

  return (
    <>
      {hasMenu && open && (
        <div
          className="rl"
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'rgba(0, 0, 0, 0.35)' }}
        />
      )}
      <div
        className="rl"
        style={{
          position: 'fixed',
          right: 18,
          bottom: 'calc(88px + var(--safe-area-bottom, 0px))',
          zIndex: 45,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10,
        }}
      >
        {hasMenu &&
          open &&
          actions!.map((a, i) => (
            <button
              key={a.label}
              className="press anim-pop"
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                height: 44,
                padding: '0 16px',
                borderRadius: 17,
                border: 'none',
                cursor: 'pointer',
                background: 'var(--float-grad, var(--bg-floating))',
                boxShadow: 'var(--shadow-3)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 600,
                animationDelay: `${(actions!.length - 1 - i) * 40}ms`,
              }}
            >
              <Icon name={a.icon} size={18} style={{ color: 'var(--accent)' }} />
              {a.label}
            </button>
          ))}
        <button
          className={'fab press' + (hasMenu && open ? ' is-open' : '')}
          aria-label={label}
          aria-expanded={hasMenu ? open : undefined}
          onClick={hasMenu ? () => setOpen((v) => !v) : onClick}
        >
          <Icon name={icon} size={26} stroke={2} />
        </button>
      </div>
    </>
  );
}
