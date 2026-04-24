import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, UtensilsCrossed, BarChart3, User } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import { useAuth } from '../../hooks/useAuth';
import { useActivePollsCount, startPollsAutoUpdate, stopPollsAutoUpdate } from '../../store/usePollsStore';
import { pollsService } from '../../services/polls.service';
import { cn } from '../../lib/utils';

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
  const { user } = useAuth();
  useActivePollsCount();

  const isDark = colorScheme === 'dark';

  // Debug logging
  useEffect(() => {
    console.log('[BottomNavigation] Mounted', {
      pathname: location.pathname,
      colorScheme,
      isDark,
      userExists: !!user,
    });
  }, [colorScheme, isDark, location.pathname, user]);

  useEffect(() => {
    console.log('[BottomNavigation] Route changed:', location.pathname);
  }, [location.pathname]);

  // Start auto-update on mount
  useEffect(() => {
    console.log('[BottomNavigation] Starting polls auto-update');
    startPollsAutoUpdate(60000); // Update every 60 seconds
    
    return () => {
      console.log('[BottomNavigation] Stopping polls auto-update');
      stopPollsAutoUpdate();
    };
  }, []);

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

  const handleNavigation = (path: string) => {
    // Haptic убран - не используем для обычной навигации
    navigate(path);
  };

  // Prefetch для оптимизации /vote перехода
  const prefetchVoteData = useCallback(() => {
    // Prefetch активных голосований для мгновенного перехода
    pollsService.getActivePolls().catch(() => {
      // Ignore errors on prefetch
    });
  }, []);

  return (
    <motion.nav
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
        'border-t',
        'overflow-hidden',
        isDark 
          ? 'bg-card/92 border-border/70' 
          : 'bg-card border-border'
      )}
      style={{
        boxShadow: isDark
          ? '0 -8px 30px rgba(0, 0, 0, 0.22)'
          : '0 -12px 32px rgba(82, 57, 24, 0.14)',
      }}
    >
      <div className="flex items-center justify-center gap-1 h-16 max-w-2xl mx-auto px-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <motion.button
              key={item.path}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNavigation(item.path)}
              onMouseEnter={() => {
                // Prefetch на hover для desktop
                if (item.path === '/vote') {
                  prefetchVoteData();
                }
              }}
              onTouchStart={() => {
                // Prefetch на touch для mobile
                if (item.path === '/vote') {
                  prefetchVoteData();
                }
              }}
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
                'flex-1 h-14 rounded-xl transition-all',
                'px-2 py-1.5',
                'focus-visible:outline-2 focus-visible:outline-offset-2',
                isActive
                    ? isDark
                      ? 'bg-primary/12 focus-visible:outline-primary'
                      : 'bg-primary/12 focus-visible:outline-primary'
                  : 'focus-visible:outline-primary/40'
               )}
              style={isActive ? { boxShadow: 'inset 0 0 0 1px hsl(var(--primary) / 0.18)' } : undefined}
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
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ 
                        scale: 1, 
                        opacity: 1,
                        // Pulse анимация для главной страницы с активным голосованием
                        ...(item.path === '/' && typeof item.badge === 'number' && item.badge > 0 ? {
                          scale: [1, 1.15, 1],
                        } : {})
                      }}
                      exit={{ scale: 0, opacity: 0 }}
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
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Label */}
              <motion.span
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
              </motion.span>

              {/* Active indicator - positioned at bottom inside button */}
              {isActive && (
                <motion.div
                  className={cn(
                    'absolute bottom-1.5 left-0 right-0 mx-auto h-0.5 w-8 rounded-full',
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
            </motion.button>
          );
        })}
      </div>

      {/* Safe area для iOS */}
      <div 
        className="bg-transparent" 
        style={{ height: 'env(safe-area-inset-bottom, 0px)' }}
      />
    </motion.nav>
  );
};
