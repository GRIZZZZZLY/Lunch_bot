import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { Home, UtensilsCrossed, BarChart3, User } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import { useActivePollsCount, startPollsAutoUpdate, stopPollsAutoUpdate } from '../../store/usePollsStore';
import { pollsService } from '../../services/polls.service';
import { cn } from '../../lib/utils';

// Навигация оптимизирована: 4 кнопки вместо 5 (убрана "Голосование")
// Голосование встроено в главную страницу, FAB для создания
// Badge показывает активные голосования на "Главная"
const navItems: NavItem[] = [
  {
    path: '/',
    icon: Home,
    label: 'Главная',
    badge: null,
  },
  {
    path: '/menu',
    icon: UtensilsCrossed,
    label: 'Меню',
    badge: null,
  },
  {
    path: '/stats',
    icon: BarChart3,
    label: 'Статистика',
    badge: null,
  },
  {
    path: '/profile',
    icon: User,
    label: 'Профиль',
    badge: null,
  },
];


interface NavItem {
  path: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  badge?: string | number | null;
}

/**
 * Bottom Navigation Bar - фиксированная навигация снизу
 *
 * Особенности:
 * - Touch-friendly элементы (56px высота)
 * - Haptic feedback при тапе
 * - Badges для уведомлений
 * - Smooth анимации активного состояния
 * - Glassmorphism дизайн
 */
export const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { colorScheme } = useTelegram();
  useActivePollsCount();

  const isDark = colorScheme === 'dark';

  // Start auto-update on mount
  useEffect(() => {
    startPollsAutoUpdate(60000); // Update every 60 seconds

    return () => {
      stopPollsAutoUpdate();
    };
  }, []);

  const handleNavigation = (path: string) => {
    // Haptic убран - не используем для обычной навигации
    navigate(path);
  };

  // P1-7: Prefetch для актуальных вкладок.
  // pollsService импортирован статически (см. import выше) — dynamic import
  // не имеет смысла и ругается на «statically + dynamically imported».
  // Для menu/stats/profile префетч можно подключить когда соответствующие
  // сервисы получат public read-методы (см. PHASE_2_RUNBOOK § P1-7 todo).
  const prefetchByPath = useCallback((path: string) => {
    try {
      if (path === '/') {
        pollsService.getActivePolls().catch(() => undefined);
      }
      // /menu, /stats, /profile — TODO когда сервисы получат cache-friendly методы.
    } catch {
      // prefetch не должен сломать UI
    }
  }, []);

  return (
    <m.nav
      role="navigation"
      aria-label="Основная навигация"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'backdrop-blur-xl saturate-150',
        'border-t border-border/60 dark:border-white/[0.07]',
        'overflow-hidden',
        'bg-card'
      )}
      style={{
        boxShadow: isDark
          ? '0 -1px 0 rgba(255,255,255,0.06)'
          : '0 -4px 16px rgba(33,20,10,0.06)',
      }}
    >
      <div className="flex items-center justify-center gap-1 h-16 max-w-2xl mx-auto px-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <m.button
              key={item.path}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNavigation(item.path)}
              onMouseEnter={() => prefetchByPath(item.path)}
              onTouchStart={() => prefetchByPath(item.path)}
              aria-label={`Перейти на ${item.label}`}
              aria-current={isActive ? 'page' : undefined}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNavigation(item.path);
                }
              }}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1',
                'flex-1 h-16 rounded-xl transition-all',
                'px-2 py-1.5',
                'focus-visible:outline-2 focus-visible:outline-offset-2',
                isActive
                  ? 'focus-visible:outline-primary'
                  : 'focus-visible:outline-primary/40'
              )}
            >
              {/* Icon container with badge */}
              <div className="relative">
                <Icon
                  className={cn(
                    'icon-nav transition-all duration-200',
                    isActive
                      ? isDark
                        ? 'text-primary scale-110'
                        : 'text-primary scale-110'
                      : isDark ? 'text-muted-foreground scale-100' : 'text-foreground/84 scale-100'
                  )}
                />

                {/* Badge */}
                <AnimatePresence>
                  {item.badge && (
                    <m.span
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{
                        scale: 1,
                        opacity: 1,
                        // Pulse анимация для главной страницы с активным голосованием
                        ...(item.path === '/' && typeof item.badge === 'number' && item.badge > 0 ? {
                          scale: [1, 1.15, 1],
                        } : {})
                      }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      transition={{
                        ...(item.path === '/' && typeof item.badge === 'number' && item.badge > 0 ? {
                          type: 'tween',
                          repeat: Infinity,
                          duration: 2,
                          ease: 'easeInOut',
                        } : {
                          type: 'spring',
                          stiffness: 500,
                          damping: 25,
                        })
                      }}
                      aria-label={`${item.badge} ${item.label === 'Главная' ? 'активных голосований' : 'уведомлений'}`}
                      className={cn(
                        'absolute -top-1 -right-1',
                        'min-w-[16px] h-4 px-1',
                        'flex items-center justify-center',
                        'rounded-full text-[10px] font-bold',
                        'bg-coral-500 text-white',
                        'shadow-lg'
                      )}
                    >
                      {item.badge}
                    </m.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Label */}
              <m.span
                animate={{
                  opacity: isActive ? 1 : 0.7,
                  fontWeight: isActive ? 600 : 500,
                }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'text-xs leading-tight text-center max-w-full truncate',
                  isActive
                    ? isDark
                      ? 'text-primary'
                      : 'text-primary'
                    : isDark ? 'text-muted-foreground' : 'text-foreground/82'
                )}
              >
                {item.label}
              </m.span>

              {/* Active indicator — dot-top (redesign 2026-04-24) */}
              {isActive && (
                <m.div
                  className={cn(
                    'absolute top-0 left-0 right-0 mx-auto h-[3px] w-6 rounded-b-full',
                    'bg-primary'
                  )}
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  exit={{ opacity: 0, scaleX: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                  }}
                />
              )}
            </m.button>
          );
        })}
      </div>

      {/* Safe area для iOS */}
      <div
        className="bg-transparent"
        style={{ height: 'env(safe-area-inset-bottom, 0px)' }}
      />
    </m.nav>
  );
};
