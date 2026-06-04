import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from '@/components/rl/Icon';
import { useActivePolls } from '@/hooks/usePolls';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

const items: NavItem[] = [
  { to: '/', label: 'Главная', icon: 'home', end: true },
  { to: '/menu', label: 'Меню', icon: 'menu' },
  { to: '/stats', label: 'Статистика', icon: 'stats' },
  { to: '/profile', label: 'Профиль', icon: 'user' },
];

export function BottomNavigation() {
  const { data: activePolls = [] } = useActivePolls();
  const badge = activePolls.length;

  return (
    <div
      className="rl"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
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
