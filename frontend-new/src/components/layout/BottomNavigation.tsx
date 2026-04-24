import { NavLink } from 'react-router-dom';
import { Home, Utensils, TrendingUp, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const items: Item[] = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/menu', label: 'Меню', icon: Utensils },
  { to: '/stats', label: 'Статистика', icon: TrendingUp },
  { to: '/profile', label: 'Профиль', icon: User },
];

export function BottomNavigation() {
  return (
    <nav
      className={cn(
        'sticky bottom-0 z-40 flex items-center justify-around',
        'bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] backdrop-blur-nav',
        'border-t border-line',
        'px-2 pt-2',
      )}
      style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
      aria-label="Основная навигация"
    >
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex-1 flex flex-col items-center gap-[3px] py-2 px-1 rounded-[12px]',
              'text-[10px] font-medium transition-colors duration-150',
              isActive
                ? 'bg-pri text-pri-ink font-semibold'
                : 'text-ink-2 hover:text-ink',
            )
          }
        >
          <Icon className="size-5" strokeWidth={2.2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
