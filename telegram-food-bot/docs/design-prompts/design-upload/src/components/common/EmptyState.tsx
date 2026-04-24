import React from 'react';
import { motion } from 'framer-motion';
import { GradientButton } from '../ui/gradient-button';
import { cn } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';
import { 
  Vote, 
  Utensils, 
  Users, 
  BarChart3, 
  ScrollText, 
  Star, 
  Search,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  type LucideIcon 
} from 'lucide-react';

export type EmptyStateType = 
  | 'no-polls' 
  | 'no-menu' 
  | 'no-votes' 
  | 'no-stats'
  | 'no-history'
  | 'no-favorites'
  | 'no-results'
  | 'no-suggestions'
  | 'poll-completed'
  | 'loading-error';

interface EmptyStateProps {
  type: EmptyStateType;
  onAction?: () => void;
  className?: string;
  actionLabel?: string; // Custom action label override
}

interface EmptyStateConfig {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  gradient: string;
}

const EMPTY_STATE_CONFIGS: Record<EmptyStateType, EmptyStateConfig> = {
  'no-polls': {
    icon: Vote,
    title: 'Нет активных голосований',
    description: 'Создайте первое голосование и начните выбирать обед вместе с командой!',
    actionLabel: 'Создать голосование',
    gradient: 'from-lavender-500 to-lavender-600',
  },
  'no-menu': {
    icon: Utensils,
    title: 'Меню пока пустое',
    description: 'Добавьте первые блюда, чтобы начать голосования',
    actionLabel: 'Добавить блюдо',
    gradient: 'from-mint-500 to-mint-600',
  },
  'no-votes': {
    icon: Users,
    title: 'Ещё никто не проголосовал',
    description: 'Будьте первым! Ваш голос важен для команды',
    actionLabel: 'Проголосовать',
    gradient: 'from-peach-500 to-peach-600',
  },
  'no-stats': {
    icon: BarChart3,
    title: 'Статистика пока недоступна',
    description: 'Проведите несколько голосований, чтобы увидеть аналитику',
    actionLabel: 'На главную',
    gradient: 'from-coral-500 to-coral-600',
  },
  'no-history': {
    icon: ScrollText,
    title: 'История пуста',
    description: 'Здесь будут отображаться ваши прошлые голосования',
    actionLabel: 'Перейти к голосованию',
    gradient: 'from-peach-500 to-mint-500',
  },
  'no-favorites': {
    icon: Star,
    title: 'Нет избранных блюд',
    description: 'Добавьте любимые блюда, чтобы быстро найти их позже',
    actionLabel: 'Посмотреть меню',
    gradient: 'from-butter-500 to-butter-600',
  },
  'no-results': {
    icon: Search,
    title: 'Ничего не найдено',
    description: 'Попробуйте изменить параметры поиска или фильтры',
    actionLabel: 'Сбросить фильтры',
    gradient: 'from-lavender-500 to-mint-500',
  },
  'no-suggestions': {
    icon: Lightbulb,
    title: 'Нет предложений',
    description: 'Предложите новое блюдо для меню! Ваша идея может стать хитом',
    actionLabel: 'Предложить блюдо',
    gradient: 'from-butter-500 to-peach-500',
  },
  'poll-completed': {
    icon: CheckCircle2,
    title: 'Голосование завершено',
    description: 'Результаты уже подведены. Посмотрите, что выбрала команда!',
    actionLabel: 'Посмотреть результаты',
    gradient: 'from-mint-500 to-mint-600',
  },
  'loading-error': {
    icon: AlertCircle,
    title: 'Не удалось загрузить',
    description: 'Проверьте подключение к интернету и попробуйте снова',
    actionLabel: 'Попробовать снова',
    gradient: 'from-coral-500 to-coral-600',
  },
};

/**
 * EmptyState - красочный компонент для пустых состояний
 * 
 * Особенности:
 * - Анимированная иллюстрация (emoji)
 * - Понятное объяснение почему пусто
 * - CTA кнопка для следующего действия
 * - Декоративные анимированные точки
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  onAction,
  className,
  actionLabel,
}) => {
  const config = EMPTY_STATE_CONFIGS[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'px-8 py-16',
        className
      )}
    >
      {/* Animated icon with gradient background */}
      <motion.div
        animate={{
          scale: [1, 1.05, 1],
          rotate: [0, 2, -2, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatDelay: 1,
          ease: 'easeInOut',
        }}
        className="mb-6"
        role="img"
        aria-label="Empty state illustration"
      >
        <div className={cn(
          'w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl',
          `bg-gradient-to-br ${config.gradient}`
        )}>
          <Icon className={`${ICON_SIZES['2xl']} text-white`} strokeWidth={2} />
        </div>
      </motion.div>

      {/* Title */}
      <h3 className="text-xl font-bold mb-2 text-foreground">
        {config.title}
      </h3>

      {/* Description */}
      <p className="text-muted-foreground text-sm mb-6 max-w-xs leading-relaxed">
        {config.description}
      </p>

      {/* CTA Button */}
      {onAction && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <GradientButton
            variant={type.includes('poll') ? 'lavender' : 'peach'}
            onClick={onAction}
            className="min-w-[200px]"
          >
            {actionLabel || config.actionLabel}
          </GradientButton>
        </motion.div>
      )}

      {/* Decorative animated dots */}
      <div className="flex gap-2 mt-8">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
            className={cn(
              'size-2 rounded-full',
              `bg-gradient-to-r ${config.gradient}`
            )}
          />
        ))}
      </div>
    </motion.div>
  );
};
