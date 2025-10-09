import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { pollsService } from '../../services/polls.service';
import type { UserLastVote } from '../../types/polls';
import { useTelegram } from '../../hooks/useTelegram';
import { useUI } from '../../store/useAppStore';
import { formatRelativeTime } from '../../lib/utils';

interface LastVoteFeedbackProps {
  lastVote: UserLastVote;
  onRate: () => void;
}

export const LastVoteFeedback: React.FC<LastVoteFeedbackProps> = ({
  lastVote,
  onRate
}) => {
  const { hapticFeedback } = useTelegram();
  const { addNotification } = useUI();
  const [rating, setRating] = useState<'like' | 'dislike' | null>(lastVote.rating);
  const [submitting, setSubmitting] = useState(false);

  const handleRate = async (newRating: 'like' | 'dislike') => {
    if (submitting || rating) return;

    try {
      setSubmitting(true);
      hapticFeedback.impactOccurred('light');

      const response = await pollsService.rateLastVote(lastVote.pollId, newRating);

      if (response.success) {
        setRating(newRating);
        hapticFeedback.notificationOccurred('success');
        addNotification({
          type: 'success',
          message: newRating === 'like' ? 'Спасибо за отзыв! 👍' : 'Спасибо! Попробуйте что-то другое 👎'
        });
        onRate();
      } else {
        throw new Error(response.error || 'Failed to rate');
      }
    } catch (error) {
      hapticFeedback.notificationOccurred('error');
      addNotification({
        type: 'error',
        message: 'Ошибка сохранения оценки'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const relativeTime = formatRelativeTime(lastVote.votedAt);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-3 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Last vote info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Clock className="size-3" />
            <span>{relativeTime}</span>
          </div>
          <div className="font-medium text-sm truncate">
            {lastVote.menuItemName}
          </div>
        </div>

        {/* Right: Rating buttons */}
        {rating ? (
          <div className="flex items-center gap-2">
            {rating === 'like' ? (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Check className="size-4" />
                <span className="text-xs font-medium">Понравилось!</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <span className="text-xs font-medium">Попробуйте другое</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Понравилось?
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
              onClick={() => handleRate('like')}
              disabled={submitting}
            >
              <ThumbsUp className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
              onClick={() => handleRate('dislike')}
              disabled={submitting}
            >
              <ThumbsDown className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
