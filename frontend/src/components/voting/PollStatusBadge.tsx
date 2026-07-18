import { m } from 'framer-motion';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  PlayCircle,
  Pause
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type PollStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'PAUSED';

interface PollStatusBadgeProps {
  status: PollStatus;
  hasVoted?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

interface StatusConfig {
  icon: React.ElementType;
  label: string;
  votedLabel?: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  pulseColor?: string;
}

const statusConfigs: Record<PollStatus, StatusConfig> = {
  ACTIVE: {
    icon: PlayCircle,
    label: 'Активно',
    votedLabel: 'Ты проголосовал',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-300 dark:border-green-700',
    pulseColor: 'bg-green-500',
  },
  COMPLETED: {
    icon: CheckCircle2,
    label: 'Завершено',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-300 dark:border-blue-700',
  },
  CANCELLED: {
    icon: XCircle,
    label: 'Отменено',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-300 dark:border-red-700',
  },
  PENDING: {
    icon: Clock,
    label: 'Ожидание',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    borderColor: 'border-yellow-300 dark:border-yellow-700',
  },
  PAUSED: {
    icon: Pause,
    label: 'Приостановлено',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300',
    borderColor: 'border-gray-300 dark:border-gray-600',
  },
};

const sizeClasses = {
  sm: {
    badge: 'px-2 py-1 text-xs gap-1',
    icon: 'w-3 h-3',
    pulse: 'w-2 h-2',
  },
  md: {
    badge: 'px-3 py-1.5 text-sm gap-1.5',
    icon: 'w-4 h-4',
    pulse: 'w-2.5 h-2.5',
  },
  lg: {
    badge: 'px-4 py-2 text-base gap-2',
    icon: 'w-5 h-5',
    pulse: 'w-3 h-3',
  },
};

/**
 * Компонент статус-бейджа для голосования
 * Показывает текущий статус с чёткой цветовой кодировкой
 */
export const PollStatusBadge = ({
  status,
  hasVoted = false,
  size = 'md',
  showIcon = true,
  showLabel = true,
  className,
}: PollStatusBadgeProps) => {
  const config = statusConfigs[status] || statusConfigs.PENDING;
  const Icon = config.icon;
  const sizes = sizeClasses[size];
  
  // Определяем текст: если активно и проголосовал - показываем "Вы проголосовали"
  const displayLabel = status === 'ACTIVE' && hasVoted && config.votedLabel 
    ? config.votedLabel 
    : config.label;

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizes.badge,
        className
      )}
      role="status"
      aria-label={`Статус голосования: ${displayLabel}`}
    >
      {/* Пульсирующий индикатор для активных */}
      {status === 'ACTIVE' && config.pulseColor && (
        <span className="relative flex">
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              config.pulseColor,
              sizes.pulse
            )}
          />
          <span
            className={cn(
              'relative inline-flex rounded-full',
              config.pulseColor,
              sizes.pulse
            )}
          />
        </span>
      )}
      
      {/* Иконка */}
      {showIcon && status !== 'ACTIVE' && (
        <Icon className={sizes.icon} />
      )}
      
      {/* Текст */}
      {showLabel && (
        <span>{displayLabel}</span>
      )}
    </m.div>
  );
};

export default PollStatusBadge;
