import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import { cn } from '../../lib/utils';

interface Breadcrumb {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  /** Заголовок страницы */
  title: string | React.ReactNode;
  /** Подзаголовок (опционально) */
  subtitle?: string;
  /** Показать кнопку "Назад" */
  showBack?: boolean;
  /** Кастомный обработчик кнопки "Назад" */
  onBack?: () => void;
  /** Дополнительные действия (кнопки справа) */
  actions?: React.ReactNode;
  /** Breadcrumbs навигация */
  breadcrumbs?: Breadcrumb[];
  /** Дополнительные CSS классы */
  className?: string;
  /** Sticky header */
  sticky?: boolean;
}

/**
 * PageHeader - Унифицированный заголовок страницы
 * 
 * Особенности:
 * - Breadcrumbs навигация
 * - Кнопка "Назад" с haptic feedback
 * - Glassmorphism дизайн
 * - Sticky positioning
 * - Адаптивный под темную/светлую тему
 * 
 * @example
 * <PageHeader 
 *   title="Голосование"
 *   showBack
 *   breadcrumbs={[
 *     { label: 'Главная', path: '/' },
 *     { label: 'Голосования', path: '/vote' },
 *     { label: 'Голосование #123' }
 *   ]}
 * />
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  actions,
  breadcrumbs,
  className,
  sticky = true,
}) => {
  const navigate = useNavigate();
  const { hapticFeedback, colorScheme } = useTelegram();
  
  const isDark = colorScheme === 'dark';
  
  const handleBack = () => {
    hapticFeedback.impactOccurred('light');
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };
  
  const handleBreadcrumbClick = (path?: string) => {
    if (path) {
      hapticFeedback.impactOccurred('light');
      navigate(path);
    }
  };
  
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'z-40 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-800/50',
        sticky && 'sticky top-0',
        className
      )}
    >
      <div className="container mx-auto px-4 py-3 max-w-2xl">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav 
            className="flex items-center gap-1.5 text-xs mb-2 overflow-x-auto scrollbar-hide"
            aria-label="Breadcrumbs"
          >
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {crumb.path ? (
                  <button
                    onClick={() => handleBreadcrumbClick(crumb.path)}
                    className={cn(
                      'text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current rounded-sm px-1'
                    )}
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-foreground font-medium whitespace-nowrap px-1">
                    {crumb.label}
                  </span>
                )}
                {index < breadcrumbs.length - 1 && (
                  <ChevronRight 
                    className="size-3 text-muted-foreground flex-shrink-0" 
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        
        {/* Header content */}
        <div className="flex items-center justify-between gap-3">
          {/* Back button */}
          {showBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleBack}
              className={cn(
                'flex items-center justify-center size-10 rounded-xl',
                'hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'
              )}
              aria-label="Назад"
            >
              <ArrowLeft className="size-5 text-foreground" />
            </motion.button>
          )}
          
          {/* Title & Subtitle */}
          <div className="flex-1 min-w-0">
            {typeof title === 'string' ? (
              <h1 className="text-xl font-bold text-foreground truncate">
                {title}
              </h1>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          
          {/* Actions */}
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
};
