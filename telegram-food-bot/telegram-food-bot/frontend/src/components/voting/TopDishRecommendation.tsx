import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Users, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { pollsService } from '../../services/polls.service';
import type { TopDish } from '../../types/polls';
import { useTelegram } from '../../hooks/useTelegram';
import { useUI } from '../../store/useAppStore';

interface TopDishRecommendationProps {
  dish: TopDish;
  pollId: number;
  onSelect: () => void;
}

export const TopDishRecommendation: React.FC<TopDishRecommendationProps> = ({
  dish,
  pollId,
  onSelect
}) => {
  const { hapticFeedback } = useTelegram();
  const { addNotification } = useUI();
  const [voting, setVoting] = useState(false);

  const handleSelect = async () => {
    try {
      setVoting(true);
      hapticFeedback.impactOccurred('medium');

      const response = await pollsService.quickVote(pollId, dish.id);

      if (response.success) {
        hapticFeedback.notificationOccurred('success');
        addNotification({
          type: 'success',
          message: `Вы выбрали: ${dish.name}`
        });
        onSelect();
      } else {
        throw new Error(response.error || 'Failed to vote');
      }
    } catch (error) {
      hapticFeedback.notificationOccurred('error');
      addNotification({
        type: 'error',
        message: 'Ошибка голосования'
      });
    } finally {
      setVoting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl">
          <Sparkles className="size-6 text-amber-500" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
            🌟 Самое популярное
          </div>
          <div className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-1">
            {dish.name}
          </div>
          {dish.description && (
            <div className="text-sm text-amber-700 dark:text-amber-300 mb-2">
              {dish.description}
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-amber-600 dark:text-amber-400">
            <span className="flex items-center gap-1">
              <Star className="size-3 fill-current" />
              {dish.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              Выбирают {dish.popularityPercent}%
            </span>
          </div>
        </div>
      </div>

      <Button
        variant="default"
        size="sm"
        className="w-full bg-amber-500 hover:bg-amber-600 text-white"
        onClick={handleSelect}
        disabled={voting}
      >
        {voting ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" />
            Выбираем...
          </>
        ) : (
          <>
            Выбрать это
            <Sparkles className="size-4 ml-2" />
          </>
        )}
      </Button>
    </motion.div>
  );
};
