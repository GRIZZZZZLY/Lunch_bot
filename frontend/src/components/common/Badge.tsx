import React from 'react';

const variantClasses = {
  default: 'bg-gray-500',
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-orange-500',
  info: 'bg-blue-500',
  primary: 'bg-telegram-button-color',
};

const positionClasses = {
  'top-right': '-top-1 -right-1',
  'top-left': '-top-1 -left-1',
  'bottom-right': '-bottom-1 -right-1',
  'bottom-left': '-bottom-1 -left-1',
};

const statusConfig = {
  active: { label: 'Активно', variant: 'success' as const },
  inactive: { label: 'Неактивно', variant: 'default' as const },
  pending: { label: 'Ожидание', variant: 'warning' as const },
  completed: { label: 'Завершено', variant: 'info' as const },
  cancelled: { label: 'Отменено', variant: 'error' as const },
};


interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  pulse?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

/**
 * Badge - значок для отображения счётчиков и статусов
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  pulse = false,
  className = '',
}) => {

  const sizeClasses = {
    sm: dot ? 'w-2 h-2' : 'px-1.5 py-0.5 text-xs',
    md: dot ? 'w-2.5 h-2.5' : 'px-2 py-1 text-xs',
    lg: dot ? 'w-3 h-3' : 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center justify-center font-semibold text-white rounded-full ${variantClasses[variant]} ${sizeClasses[size]} ${
        pulse ? 'animate-pulse' : ''
      } ${className}`}
    >
      {!dot && children}
    </span>
  );
};

/**
 * BadgeWrapper - обёртка для добавления badge к элементам
 */
export const BadgeWrapper: React.FC<{
  children: React.ReactNode;
  badge?: number | string;
  showZero?: boolean;
  max?: number;
  variant?: BadgeProps['variant'];
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}> = ({
  children,
  badge,
  showZero = false,
  max = 99,
  variant = 'error',
  position = 'top-right',
  dot = false,
  pulse = false,
  className = '',
}) => {

  const displayBadge = typeof badge === 'number' && badge > max ? `${max}+` : badge;
  const shouldShow = badge !== undefined && (showZero || badge !== 0);

  return (
    <div className={`relative inline-flex ${className}`}>
      {children}
      {shouldShow && (
        <span className={`absolute ${positionClasses[position]}`}>
          <Badge variant={variant} dot={dot} pulse={pulse}>
            {displayBadge}
          </Badge>
        </span>
      )}
    </div>
  );
};

/**
 * StatusBadge - для отображения статусов
 */
export const StatusBadge: React.FC<{
  status: 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled';
  size?: BadgeProps['size'];
  className?: string;
}> = ({ status, size = 'md', className = '' }) => {

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} size={size} className={className}>
      {config.label}
    </Badge>
  );
};

/**
 * Пример использования:
 * 
 * // Простой badge:
 * <Badge variant="error">3</Badge>
 * 
 * // Badge с wrapper:
 * <BadgeWrapper badge={5} variant="error">
 *   <button>Уведомления</button>
 * </BadgeWrapper>
 * 
 * // Dot badge (для индикаторов):
 * <BadgeWrapper badge={1} dot pulse>
 *   <Avatar />
 * </BadgeWrapper>
 * 
 * // Status badge:
 * <StatusBadge status="active" />
 * 
 * // Badge с max значением:
 * <BadgeWrapper badge={150} max={99}>
 *   <MessageIcon />
 * </BadgeWrapper>
 */
