import { NavLink } from 'react-router-dom';
import { Icon } from '@/components/rl/Icon';
import { useActivePolls } from '@/hooks/usePolls';
import { ROOT_TABS, type RootTab } from '@/app/navigation';

export function BottomNavigation({ items = ROOT_TABS }: { items?: RootTab[] }) {
  const { data: activePolls = [] } = useActivePolls();
  const badge = activePolls.length;

  return (
    <div
      className="rl"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(12px + var(--safe-area-bottom, 0px))',
        // Не мёртвая ветка, как показалось при беглом чтении: на целевых
        // 390 px работает calc(), а 406 px — потолок ширины на широких экранах
        // (дев-превью, планшет), чтобы панель не растягивалась во всю строку.
        width: 'min(406px, calc(100vw - 24px))',
        zIndex: 40,
      }}
    >
      <nav className="bottomnav glass" style={{ boxShadow: 'var(--shadow-3)' }} aria-label="Основная навигация">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => 'navbtn' + (isActive ? ' on' : '')}>
            <span className="nav-dot" />
            <span style={{ position: 'relative' }}>
              <Icon name={it.icon} size={22} />
              {it.to === '/' && badge > 0 && <span className="nav-badge tnum">{badge}</span>}
            </span>
            {it.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
