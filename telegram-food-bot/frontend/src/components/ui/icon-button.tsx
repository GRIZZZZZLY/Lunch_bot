/**
 * 🎯 ICON BUTTON COMPONENT
 * 
 * Стандартизированный компонент кнопки с иконкой.
 * Использует Lucide React иконки и дизайн-токены.
 * 
 * @version 2.0.0
 * @date 2025-11-10
 */

import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IconButtonProps {
  /** Lucide React иконка */
  icon: LucideIcon;
  
  /** Обработчик клика */
  onClick?: () => void;
  
  /** Визуальный стиль кнопки */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  
  /** Размер кнопки и иконки */
  size?: 'sm' | 'base' | 'lg';
  
  /** Aria-label для accessibility */
  label: string;
  
  /** Заблокирована ли кнопка */
  disabled?: boolean;
  
  /** Дополнительные CSS классы */
  className?: string;
  
  /** Показать loading состояние */
  loading?: boolean;
  
  /** Тип кнопки (для форм) */
  type?: 'button' | 'submit' | 'reset';
}

/**
 * IconButton - кнопка только с иконкой
 * 
 * @example
 * // Primary кнопка
 * <IconButton
 *   icon={Edit}
 *   onClick={handleEdit}
 *   variant="primary"
 *   size="base"
 *   label="Редактировать блюдо"
 * />
 * 
 * @example
 * // Ghost кнопка для тулбара
 * <IconButton
 *   icon={Trash2}
 *   onClick={handleDelete}
 *   variant="ghost"
 *   size="sm"
 *   label="Удалить"
 * />
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon: Icon,
      onClick,
      variant = 'primary',
      size = 'base',
      label,
      disabled = false,
      className,
      loading = false,
      type = 'button',
    },
    ref
  ) => {
    // Размеры кнопки и иконки
    const sizeClasses = {
      sm: 'p-1.5',      // padding 6px
      base: 'p-2',      // padding 8px (DEFAULT)
      lg: 'p-3',        // padding 12px
    };

    const iconSizeClasses = {
      sm: 'w-4 h-4',    // 16px icon
      base: 'w-5 h-5',  // 20px icon (DEFAULT)
      lg: 'w-6 h-6',    // 24px icon
    };

    // Варианты стилей
    const variantClasses = {
      primary: cn(
        'bg-gradient-peach dark:bg-gradient-peach-dark',
        'text-white',
        'hover:shadow-lg hover:shadow-peach-500/30',
        'active:scale-95',
        'transition-all duration-200'
      ),
      secondary: cn(
        'bg-muted',
        'text-foreground',
        'hover:bg-muted/80',
        'active:scale-95',
        'transition-all duration-200'
      ),
      ghost: cn(
        'text-muted-foreground',
        'hover:bg-muted/50 hover:text-foreground',
        'active:bg-muted',
        'transition-all duration-150'
      ),
      danger: cn(
        'bg-gradient-coral dark:bg-gradient-coral-dark',
        'text-white',
        'hover:shadow-lg hover:shadow-coral-500/30',
        'active:scale-95',
        'transition-all duration-200'
      ),
    };

    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={label}
        aria-busy={loading}
        className={cn(
          // Базовые стили
          'inline-flex items-center justify-center',
          'rounded-lg',
          'font-medium',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          
          // Размеры
          sizeClasses[size],
          
          // Вариант
          variantClasses[variant],
          
          // Кастомные классы
          className
        )}
      >
        {loading ? (
          // Loading spinner
          <svg
            className={cn(iconSizeClasses[size], 'animate-spin')}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          // Иконка
          <Icon className={iconSizeClasses[size]} />
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

/**
 * 🔧 ICON BUTTON GROUP
 * Группа иконочных кнопок с автоматическими отступами
 */
export interface IconButtonGroupProps {
  children: React.ReactNode;
  className?: string;
  /** Ориентация группы */
  orientation?: 'horizontal' | 'vertical';
  /** Размер gap между кнопками */
  spacing?: 'tight' | 'normal' | 'comfortable';
}

export const IconButtonGroup: React.FC<IconButtonGroupProps> = ({
  children,
  className,
  orientation = 'horizontal',
  spacing = 'normal',
}) => {
  const spacingClasses = {
    tight: 'gap-1',         // 4px
    normal: 'gap-2',        // 8px (DEFAULT)
    comfortable: 'gap-3',   // 12px
  };

  return (
    <div
      className={cn(
        'inline-flex',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
        spacingClasses[spacing],
        className
      )}
      role="group"
    >
      {children}
    </div>
  );
};

IconButtonGroup.displayName = 'IconButtonGroup';
