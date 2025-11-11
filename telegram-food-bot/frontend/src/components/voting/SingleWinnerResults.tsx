import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Users, Crown } from 'lucide-react';
import { PollResult } from '@/services/polls.service';
import { Badge } from '@/components/ui/badge';
import { ICON_SIZES } from '@/lib/design-tokens';

interface SingleWinnerResultsProps {
  result: PollResult;
  breakdown?: Array<{
    menuItemId: number;
    menuItemName: string;
    votes: number;
    percentage: number;
    voters: Array<{
      id: number;
      firstName: string;
      username?: string;
    }>;
  }>;
}

export const SingleWinnerResults: React.FC<SingleWinnerResultsProps> = ({
  result,
  breakdown = [],
}) => {
  const getPluralForm = (count: number): string => {
    if (count % 10 === 1 && count % 100 !== 11) return 'голос';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
      return 'голоса';
    }
    return 'голосов';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <h2 className="text-2xl font-bold">📊 Результаты</h2>

      {/* Winner Card */}
      {result.winnerItem && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-gold-100 to-gold-200 dark:from-gold-900/30 dark:to-gold-800/20 rounded-xl p-6 border-2 border-gold-400"
        >
          <div className="flex items-start gap-4">
            <Trophy className={`${ICON_SIZES['2xl']} text-gold-600 dark:text-gold-400 flex-shrink-0`} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-2xl font-bold">🏆 Победитель</h3>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {result.winnerItem.name}
              </p>
              {result.winnerItem.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {result.winnerItem.description}
                </p>
              )}
              {result.winnerItem.price && (
                <p className="text-lg font-semibold text-gold-600 dark:text-gold-400 mt-2">
                  {result.winnerItem.price} ₽
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Responsible Person */}
      {result.responsible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-glass rounded-xl p-4 border border-white/10"
        >
          <div className="flex items-center gap-3">
            <Crown className={`${ICON_SIZES.xl} text-purple-500`} />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ответственный за заказ
              </p>
              <p className="text-lg font-bold">
                {result.responsible.firstName}
                {result.responsible.lastName && ` ${result.responsible.lastName}`}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Vote Breakdown */}
      {breakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-bold mb-3">Детальная разбивка</h3>
          <div className="space-y-3">
            {breakdown.map((item, index) => (
              <div
                key={item.menuItemId}
                className="bg-glass rounded-lg p-4 border border-white/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                    </span>
                    <span className="font-semibold">{item.menuItemName}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-lg">{item.votes}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                      {getPluralForm(item.votes)}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-gradient-to-r from-peach-400 to-peach-500 h-2 rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>

                {/* Voters */}
                {item.voters.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.voters.slice(0, 5).map((voter) => (
                      <span
                        key={voter.id}
                        className="text-xs px-2 py-1 bg-mint-100 dark:bg-mint-900/30 rounded-full"
                      >
                        {voter.firstName}
                      </span>
                    ))}
                    {item.voters.length > 5 && (
                      <Badge variant="secondary">
                        +{item.voters.length - 5}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-glass rounded-lg p-4 border border-white/10"
      >
        <div className="flex items-center gap-3">
          <Users className={`${ICON_SIZES.lg} text-blue-500`} />
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Всего участников
            </p>
            <p className="text-2xl font-bold">{result.totalVotes}</p>
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        Завершено: {new Date(result.createdAt).toLocaleString('ru-RU')}
      </div>
    </div>
  );
};
