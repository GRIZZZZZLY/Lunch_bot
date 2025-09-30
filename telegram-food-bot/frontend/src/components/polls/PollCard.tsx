import React from 'react';
import { Poll, pollsService } from '../../services/polls.service';
import { Button } from '../common/Button';
import { useTelegram } from '../../hooks/useTelegram';

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
  const { hapticFeedback } = useTelegram();

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

  const statusColor = poll.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400';
  const statusBg = poll.isActive ? 'bg-green-100 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-700';
  const statusText = poll.isActive ? 'Активно' : 'Завершено';

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${
      compact ? 'p-3' : 'p-4'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className={`font-semibold text-gray-900 dark:text-white truncate ${
              compact ? 'text-sm' : 'text-base'
            }`}>
              {poll.title}
            </h3>
            <span className={`px-2 py-1 text-xs rounded-full ${statusBg} ${statusColor}`}>
              {statusText}
            </span>
          </div>
          
          {poll.description && !compact && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
              {poll.description}
            </p>
          )}
        </div>

        {poll.isActive && timeRemaining && timeRemaining !== 'Завершено' && (
          <div className="ml-3 text-right">
            <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
              ⏰ {timeRemaining}
            </div>
            <div className="text-xs text-gray-500">осталось</div>
          </div>
        )}
      </div>

      {/* Статистика */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-3">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <span>👥</span>
            <span>{poll._count.votes} голосов</span>
          </div>
          
          {!compact && (
            <div className="flex items-center space-x-1">
              <span>📅</span>
              <span>{formattedDate}</span>
            </div>
          )}
        </div>

        {poll.isActive && (
          <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
            <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
            <span className="text-xs">В эфире</span>
          </div>
        )}
      </div>

      {/* Прогресс-бар участия */}
      {!compact && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Участие</span>
            <span>{poll._count.votes} участников</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min((poll._count.votes / Math.max(poll._count.votes, 10)) * 100, 100)}%` 
              }}
            />
          </div>
        </div>
      )}

      {/* Действия */}
      {showActions && (
        <div className="flex items-center space-x-2">
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewDetails}
              className="flex-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              📋 {compact ? 'Детали' : 'Подробнее'}
            </Button>
          )}
          
          {onViewResults && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewResults}
              className="flex-1 text-green-600 hover:text-green-700 dark:text-green-400"
            >
              📊 Результаты
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Компактная карточка для списков
 */
export const PollCardCompact: React.FC<PollCardProps> = (props) => {
  return <PollCard {...props} compact />;
};
