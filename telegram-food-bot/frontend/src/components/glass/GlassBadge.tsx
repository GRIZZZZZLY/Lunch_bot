import React from 'react';
import { m } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGlassTailwindClasses, type GlassVariant, type GlassTheme } from '@/lib/glassmorphism';

// Цвета для каждого варианта
const variantStyles: Record<BadgeVariant, string> = {
  default: 'text-gray-700 dark:text-gray-300',
  success: 'text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-900/20',
  warning: 'text-orange-700 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-900/20',
  error: 'text-red-700 dark:text-red-400 bg-red-50/50 dark:bg-red-900/20',
  info: 'text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20',
  food: 'text-primary-food-700 dark:text-primary-food-400 bg-primary-food-50/50 dark:bg-primary-food-900/20',
};


export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'food';

export interface GlassBadgeProps {
  label: string;
  icon?: LucideIcon;
  variant?: BadgeVariant;
  glassVariant?: GlassVariant;
  theme?: GlassTheme;
  className?: string;
  animate?: boolean;
  onClick?: () => void;
}

/**
 * GlassBadge - бейдж с glassmorphism эффектом
 * 
 * @component
 * @example
 * ```tsx
 * // Базовое использование
 * <GlassBadge label="Новое" />
 * 
 * // С иконкой
 * <GlassBadge 
 *   label="Вегетарианское" 
 *   icon={Leaf}
 *   variant="success"
 * />
 * 
 * // Кликабельный
 * <GlassBadge 
 *   label="Популярное"
 *   variant="food"
 *   onClick={() => handleFilter('popular')}
 * />
 * ```
 */
export const GlassBadge: React.FC<GlassBadgeProps> = ({
  label,
  icon: Icon,
  variant = 'default',
  glassVariant = 'light',
  theme = 'light',
  className,
  animate = true,
  onClick,
}) => {
  const glassClasses = getGlassTailwindClasses(glassVariant, theme);
  
  const content = (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
        'transition-all duration-200',
        glassClasses,
        variantStyles[variant],
        onClick && 'cursor-pointer hover:scale-105 active:scale-95',
        className
      )}
      onClick={onClick}
      onKeyDown={event => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span>{label}</span>
    </div>
  );
  
  if (animate) {
    return (
      <m.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={onClick ? { scale: 1.05 } : undefined}
        whileTap={onClick ? { scale: 0.95 } : undefined}
        transition={{ duration: 0.2 }}
        className="inline-block"
      >
        {content}
      </m.div>
    );
  }
  
  return <div className="inline-block">{content}</div>;
};

GlassBadge.displayName = 'GlassBadge';

/**
 * GlassBadgeGroup - группа бейджей с анимацией появления
 */
export interface GlassBadgeGroupProps {
  badges: Array<{
    id: string | number;
    label: string;
    icon?: LucideIcon;
    variant?: BadgeVariant;
    onClick?: () => void;
  }>;
  className?: string;
  stagger?: boolean;
}

export const GlassBadgeGroup: React.FC<GlassBadgeGroupProps> = ({
  badges,
  className,
  stagger = true,
}) => {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {badges.map((badge, index) => (
        <m.div
          key={badge.id}
          initial={stagger ? { opacity: 0, y: 10 } : undefined}
          animate={stagger ? { opacity: 1, y: 0 } : undefined}
          transition={stagger ? { delay: index * 0.05, duration: 0.2 } : undefined}
        >
          <GlassBadge
            label={badge.label}
            icon={badge.icon}
            variant={badge.variant}
            onClick={badge.onClick}
            animate={false}
          />
        </m.div>
      ))}
    </div>
  );
};

GlassBadgeGroup.displayName = 'GlassBadgeGroup';
