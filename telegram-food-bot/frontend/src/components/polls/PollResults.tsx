import React, { useState, useEffect } from 'react';
import { Poll, PollResult, VoteBreakdown, pollsService } from '../../services/polls.service';
import { Skeleton } from '../common/LoadingSpinner';
import { Button } from '../common/Button';
import { useTelegram } from '../../hooks/useTelegram';
import { useUI } from '../../store/useAppStore';

export interface PollResultsProps {
  poll: Poll;
  onBack?: () => void;
}

/**
 * Компонент отображения результатов голосования
 */
export const PollResults: React.FC<PollResultsProps> = ({ poll, onBack }) => {
  const { hapticFeedback, showAlert } = useTelegram();
  const { addNotification } = useUI();
  
  const [results, setResults] = useState<PollResult | null>(null);
  const [breakdown, setBreakdown] = useState<VoteBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadResults();
  }, [poll.id]);

  const loadResults = async () => {
    try {
      setLoading(true);
      setError(null);

      const [resultsResponse, breakdownResponse] = await Promise.all([
        pollsService.getPollResults(poll.id),
        pollsService.getPollVoteBreakdown(poll.id),
      ]);

      if (resultsResponse.success) {
        setResults(resultsResponse.data || null);
      }

      if (breakdownResponse.success) {
        setBreakdown(breakdownResponse.data || []);
      }

      if (!resultsResponse.success && !breakdownResponse.success) {
        throw new Error('Не удалось загрузить результаты');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки';
      setError(errorMessage);
      addNotification({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      hapticFeedback.impactOccurred('medium');
      
      const data = await pollsService.exportPollData(poll.id, 'json');
      
      // Создаем blob и скачиваем файл
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `poll-${poll.id}-results.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      addNotification({
        type: 'success',
        message: 'Результаты экспортированы',
      });
    } catch (error) {
      showAlert('Ошибка экспорта данных');
    }
  };

  const createProgressBar = (percentage: number): string => {
    const filledBlocks = Math.round((percentage / 100) * 10);
    const emptyBlocks = 10 - filledBlocks;
    return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton count={6} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">😔</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Ошибка загрузки результатов
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <div className="flex space-x-3 justify-center">
          <Button onClick={loadResults}>
            Попробовать снова
          </Button>
          {onBack && (
            <Button variant="secondary" onClick={onBack}>
              Назад
            </Button>
          )}
        </div>
      </div>
    );
  }

  const totalVotes = results?.totalVotes || 0;
  const hasVotes = breakdown.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        {onBack && (
          <Button variant="ghost" onClick={onBack} size="sm">
            ← Назад
          </Button>
        )}
        <div className="flex-1 text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Результаты голосования
          </h2>
        </div>
        <div className="w-16"></div> {/* Spacer for centering */}
      </div>

      {/* Poll info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
          "{poll.title}"
        </h3>
        
        {poll.description && (
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            {poll.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Статус:</span>
            <div className={`font-medium ${
              poll.isActive 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {poll.isActive ? '🟢 Активно' : '⭕ Завершено'}
            </div>
          </div>
          
          <div>
            <span className="text-gray-500 dark:text-gray-400">Участников:</span>
            <div className="font-medium text-gray-900 dark:text-white">
              👥 {totalVotes}
            </div>
          </div>

          <div>
            <span className="text-gray-500 dark:text-gray-400">Создано:</span>
            <div className="font-medium text-gray-900 dark:text-white">
              📅 {pollsService.formatPollDate(poll.createdAt)}
            </div>
          </div>

          {poll.endTime && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">
                {poll.isActive ? 'Завершится:' : 'Завершено:'}
              </span>
              <div className="font-medium text-gray-900 dark:text-white">
                ⏰ {poll.isActive ? pollsService.formatTimeRemaining(poll.endTime) : pollsService.formatPollDate(poll.endTime)}
              </div>
            </div>
          )}
        </div>

        {/* Winner info */}
        {results?.winnerItem && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🏆</span>
              <div>
                <div className="font-semibold text-yellow-800 dark:text-yellow-300">
                  Победитель: {results.winnerItem.name}
                </div>
                {results.winnerItem.price && (
                  <div className="text-sm text-yellow-700 dark:text-yellow-400">
                    💰 {results.winnerItem.price}₽
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Responsible person */}
        {results?.responsible && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🎲</span>
              <div>
                <div className="font-semibold text-blue-800 dark:text-blue-300">
                  Ответственный: {results.responsible.firstName}
                </div>
                {results.responsible.username && (
                  <div className="text-sm text-blue-700 dark:text-blue-400">
                    @{results.responsible.username}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results breakdown */}
      {hasVotes ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              📊 Подробные результаты
            </h4>
            <Button variant="ghost" size="sm" onClick={handleExport}>
              📥 Экспорт
            </Button>
          </div>

          <div className="space-y-4">
            {breakdown.map((item, index) => (
              <div key={item.menuItemId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                    </span>
                    <h5 className="font-medium text-gray-900 dark:text-white">
                      {item.menuItemName}
                    </h5>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {item.votes} голосов
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {item.percentage}%
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      index === 0 
                        ? 'bg-yellow-500' 
                        : index === 1 
                        ? 'bg-gray-400' 
                        : index === 2 
                        ? 'bg-amber-600' 
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>

                {/* Text progress bar */}
                <div className="font-mono text-sm text-gray-600 dark:text-gray-400">
                  {createProgressBar(item.percentage)}
                </div>

                {/* Voters */}
                {item.voters.length <= 5 ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    👤 {item.voters.map(voter => voter.firstName).join(', ')}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    👤 {item.voters.slice(0, 3).map(voter => voter.firstName).join(', ')} 
                    {' '}и ещё {item.voters.length - 3}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🗳️</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Нет голосов
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            В этом голосовании пока никто не участвовал
          </p>
        </div>
      )}
    </div>
  );
};
