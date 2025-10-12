import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, ChevronDown, ChevronUp, Trophy, User } from 'lucide-react';
import type { MultiWinnerResultData } from '@/services/polls.service';
import { useTelegram } from '@/hooks/useTelegram';

interface MultiWinnerResultsProps {
  resultData: MultiWinnerResultData;
}

export const MultiWinnerResults: React.FC<MultiWinnerResultsProps> = ({
  resultData,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const { hapticFeedback } = useTelegram();

  const toggleGroup = (menuItemId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(menuItemId)) {
        next.delete(menuItemId);
      } else {
        next.add(menuItemId);
      }
      return next;
    });
  };

  const copyToClipboard = async () => {
    let text = '🍽 Заказ:\n\n';

    resultData.winners.forEach((w) => {
      text += `${w.menuItemName} — ${w.voteCount} шт.\n`;
      text += `  ${w.voters.map((v) => v.firstName).join(', ')}\n\n`;
    });

    if (resultData.bringOwn.count > 0) {
      text += `🏠 Своё: ${resultData.bringOwn.voters.map((v) => v.firstName).join(', ')}\n`;
    }

    try {
      await navigator.clipboard.writeText(text);
      hapticFeedback.notificationOccurred('success');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      hapticFeedback.notificationOccurred('error');
    }
  };

  const getPluralForm = (count: number): string => {
    if (count % 10 === 1 && count % 100 !== 11) return 'человек';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
      return 'человека';
    }
    return 'человек';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">📊 Результаты</h2>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg hover:bg-primary/20 transition"
          aria-label="Копировать результаты"
        >
          <Copy size={16} />
          <span className="text-sm">Копировать</span>
        </button>
      </div>

      {/* Winners */}
      {resultData.winners.length > 0 ? (
        resultData.winners.map((winner, index) => {
          const isExpanded = expandedGroups.has(winner.menuItemId);
          const showExpandButton = winner.voters.length > 5;
          const displayedVoters = isExpanded
            ? winner.voters
            : winner.voters.slice(0, 5);

          return (
            <motion.div
              key={winner.menuItemId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-glass rounded-xl p-4 border border-white/10"
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 text-3xl">
                  {index === 0 ? (
                    <Trophy className="text-yellow-500" size={32} />
                  ) : (
                    <span>🍴</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="text-lg font-bold">{winner.menuItemName}</h3>
                    {index === 0 && (
                      <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
                        🏆 Лидер
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {winner.voteCount} {getPluralForm(winner.voteCount)}
                  </p>

                  {/* Voters */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {displayedVoters.map((voter) => (
                      <span
                        key={voter.userId}
                        className="px-2 py-1 bg-mint-100 dark:bg-mint-900/30 rounded-full text-xs flex items-center gap-1"
                      >
                        <User size={12} />
                        {voter.firstName}
                      </span>
                    ))}

                    {/* Expand Button */}
                    {showExpandButton && (
                      <button
                        onClick={() => toggleGroup(winner.menuItemId)}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                        aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={12} />
                            <span>Свернуть</span>
                          </>
                        ) : (
                          <>
                            <span>Еще {winner.voters.length - 5}</span>
                            <ChevronDown size={12} />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })
      ) : (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          Нет голосов за блюда
        </div>
      )}

      {/* Bring Own */}
      {resultData.bringOwn.count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: resultData.winners.length * 0.1 }}
          className="bg-glass rounded-xl p-4 border border-white/10"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-3xl">🏠</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">Принесу своё</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {resultData.bringOwn.count} {getPluralForm(resultData.bringOwn.count)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {resultData.bringOwn.voters.map((voter) => (
                  <span
                    key={voter.userId}
                    className="px-2 py-1 bg-butter-100 dark:bg-butter-900/30 rounded-full text-xs"
                  >
                    {voter.firstName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Skipped */}
      {resultData.skipped.count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-glass rounded-xl p-4 border border-white/10 opacity-60"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">🚫</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">Пропускаю</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {resultData.skipped.count} {getPluralForm(resultData.skipped.count)}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tie-Break Info */}
      {resultData.meta.tieBreak && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            ℹ️ {resultData.meta.tieBreak.reason}. Лидер выбран по методу:{' '}
            <strong>{resultData.meta.tieBreak.method}</strong>
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        Завершено: {new Date(resultData.meta.completedAt).toLocaleString('ru-RU')}
      </div>
    </div>
  );
};
