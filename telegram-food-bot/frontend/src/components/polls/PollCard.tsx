import React from 'react';
import { motion } from 'framer-motion';
import { Poll, pollsService } from '../../services/polls.service';
import { GlassCard, GlassBadge } from '@/components/glass';
import { useTelegram } from '../../hooks/useTelegram';
import { cn } from '@/lib/utils';
import { 
  Users, 
  Calendar, 
  Clock, 
  BarChart2, 
  FileText,
  TrendingUp,
  Sparkles
} from 'lucide-react';

export interface PollCardProps {
  poll: Poll;
  onViewDetails?: (poll: Poll) => void;
  onViewResults?: (poll: Poll) => void;
  showActions?: boolean;
  compact?: boolean;
}

/**
 * Карточка голосования
 */
export const PollCard: React.FC<PollCardProps> = ({
  poll,
  onViewDetails,
  onViewResults,
  showActions = true,
  compact = false,
}) => {
  const { hapticFeedback, colorScheme } = useTelegram();
  const isDark = colorScheme === 'dark';

  const handleViewDetails = () => {
    hapticFeedback.impactOccurred('light');
    onViewDetails?.(poll);
  };

  const handleViewResults = () => {
    hapticFeedback.impactOccurred('light');
    onViewResults?.(poll);
  };

  const timeRemaining = poll.endTime ? pollsService.formatTimeRemaining(poll.endTime) : null;
  const formattedDate = pollsService.formatPollDate(poll.createdAt);

  const statusText = poll.status === 'ACTIVE' ? 'Активно' : 'Завершено';

  return (
    <GlassCard
      variant="medium"
      theme={isDark ? 'dark' : 'light'}
      hover
      className={cn(compact ? 'p-3' : 'p-4')}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className={`font-semibold text-gray-900 dark:text-white ${
              compact ? 'text-sm' : 'text-base'
            }`}>
              {poll.title}
            </h3>
            <GlassBadge
              label={statusText}
              icon={poll.status === 'ACTIVE' ? Sparkles : undefined}
              variant={poll.status === 'ACTIVE' ? 'success' : 'default'}
              glassVariant="light"
              theme={isDark ? 'dark' : 'light'}
              animate={false}
            />
          </div>
          
          {poll.description && !compact && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {poll.description}
            </p>
          )}
        </div>

        {poll.status === 'ACTIVE' && timeRemaining && timeRemaining !== 'Завершено' && (
          <div className="ml-3 text-right">
            <div className="flex items-center space-x-1 text-sm font-semibold text-primary-food-700 dark:text-primary-food-400">
              <Clock size={14} />
              <span>{timeRemaining}</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">осталось</div>
          </div>
        )}
      </div>

      {/* Статистика */}
      <div className="flex items-center justify-between text-sm mb-3">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-gray-600 dark:text-gray-400">
            <Users size={16} className="text-primary-food-500" />
            <span className="font-medium">{poll._count.votes}</span>
            <span className="text-xs">голосов</span>
          </div>
          
          {!compact && (
            <div className="flex items-center space-x-1.5 text-gray-600 dark:text-gray-400">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-xs">{formattedDate}</span>
            </div>
          )}
        </div>

        {poll.status === 'ACTIVE' && (
          <div className="flex items-center space-x-1.5 text-green-600 dark:text-success-soft-300">
            <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
            <span className="text-xs font-medium">В эфире</span>
          </div>
        )}
      </div>

      {/* Прогресс-бар участия */}
      {!compact && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            <span className="font-medium">Участие</span>
            <span>{poll._count.votes} участников</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ 
                width: `${Math.min((poll._count.votes / Math.max(poll._count.votes, 10)) * 100, 100)}%` 
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="bg-gradient-to-r from-primary-food-500 to-primary-food-600 dark:from-peach-400 dark:to-peach-500 h-2 rounded-full"
            />
          </div>
        </div>
      )}

      {/* Действия */}
      {showActions && (
        <div className="flex items-center gap-2">
          {onViewDetails && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleViewDetails}
              className="
                flex-1 flex items-center justify-center space-x-1.5
                px-3 py-2 rounded-lg text-sm font-medium
                text-blue-600 dark:text-bluegray-300
                bg-blue-50 dark:bg-bluegray-500/20
                hover:bg-blue-100 dark:hover:bg-bluegray-500/30
                transition-colors duration-200
              "
            >
              <FileText size={16} />
              <span>{compact ? 'Детали' : 'Подробнее'}</span>
            </motion.button>
          )}
          
          {onViewResults && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleViewResults}
              className="
                flex-1 flex items-center justify-center space-x-1.5
                px-3 py-2 rounded-lg text-sm font-medium
                text-primary-food-700 dark:text-peach-300
                bg-primary-food-50 dark:bg-peach-500/20
                hover:bg-primary-food-100 dark:hover:bg-peach-500/30
                transition-colors duration-200
              "
            >
              <BarChart2 size={16} />
              <span>Результаты</span>
            </motion.button>
          )}
        </div>
      )}
    </GlassCard>
  );
};

/**
 * Компактная карточка для списков
 */
export const PollCardCompact: React.FC<PollCardProps> = (props) => {
  return <PollCard {...props} compact />;
};
