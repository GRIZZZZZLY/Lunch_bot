import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Repeat, 
  Shuffle, 
  Menu as MenuIcon, 
  BarChart3, 
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { GlassCard, GlassCardContent } from '../ui/glass-card';
import { Badge } from '../ui/badge';
import { pollsService } from '../../services/polls.service';
import type { UserLastVote, UserVoteStatus, TopDish } from '../../types/polls';
import { LastVoteFeedback } from './LastVoteFeedback';
import { TopDishRecommendation } from './TopDishRecommendation';
import { InviteButton } from './InviteButton';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTelegram } from '../../hooks/useTelegram';
import { useUI } from '../../store/useAppStore';

interface ActivePollActionsProps {
  pollId: number;
  pollTitle: string;
  timeRemaining: string;
  voteCount: number;
}

export const ActivePollActions: React.FC<ActivePollActionsProps> = ({
  pollId,
  pollTitle,
  timeRemaining,
  voteCount
}) => {
  const { user } = useAuth();
  const { hapticFeedback } = useTelegram();
  const { addNotification } = useUI();
  const navigate = useNavigate();

  // State
  const [lastVote, setLastVote] = useState<UserLastVote | null>(null);
  const [voteStatus, setVoteStatus] = useState<UserVoteStatus | null>(null);
  const [topDish, setTopDish] = useState<TopDish | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [pollId, user]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);

      // Параллельные запросы
      const [lastVoteRes, statusRes, topDishRes] = await Promise.all([
        pollsService.getLastVote(),
        pollsService.getUserVoteStatus(pollId),
        pollsService.getTopDish()
      ]);

      if (lastVoteRes.success) setLastVote(lastVoteRes.data);
      if (statusRes.success) setVoteStatus(statusRes.data);
      if (topDishRes.success) setTopDish(topDishRes.data);

    } catch (error) {
      console.error('[ActivePollActions] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // === Action Handlers ===

  const handleQuickVote = async () => {
    if (!lastVote || actionLoading) return;

    try {
      setActionLoading(true);
      hapticFeedback.impactOccurred('medium');

      const response = await pollsService.quickVote(pollId, lastVote.menuItemId);

      if (response.success) {
        hapticFeedback.notificationOccurred('success');
        addNotification({
          type: 'success',
          message: `Вы выбрали: ${lastVote.menuItemName}`
        });
        
        // Обновляем статус
        await loadData();
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
      setActionLoading(false);
    }
  };

  const handleRandomVote = async () => {
    if (actionLoading) return;

    try {
      setActionLoading(true);
      hapticFeedback.impactOccurred('heavy');

      const response = await pollsService.randomVote(pollId);

      if (response.success && response.data) {
        hapticFeedback.notificationOccurred('success');
        addNotification({
          type: 'success',
          message: `🎲 Выпало: ${response.data.menuItem?.name}`
        });
        
        await loadData();
      } else {
        throw new Error(response.error || 'Failed to vote');
      }
    } catch (error) {
      hapticFeedback.notificationOccurred('error');
      addNotification({
        type: 'error',
        message: 'Ошибка рулетки'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleShowMenu = () => {
    hapticFeedback.impactOccurred('light');
    navigate(`/vote/${pollId}`);
  };

  const handleShowResults = () => {
    hapticFeedback.impactOccurred('light');
    navigate(`/vote/${pollId}`);
  };

  const handleChangeVote = () => {
    hapticFeedback.impactOccurred('light');
    navigate(`/vote/${pollId}`);
  };

  // === Render Logic ===

  if (loading) {
    return (
      <GlassCard className="animate-pulse">
        <GlassCardContent className="h-48" />
      </GlassCard>
    );
  }

  // Определяем сценарий
  const hasVotingHistory = !!lastVote;
  const hasVotedInCurrentPoll = voteStatus?.hasVoted || false;
  const isNewUser = !hasVotingHistory;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <GlassCard intensity="high" hover>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-peach-400/30 to-transparent dark:from-peach-500/20 blur-2xl" />
        
        <GlassCardContent className="relative space-y-4">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default" className="bg-peach-500 text-white">
                🗳️ Активно
              </Badge>
              <Badge variant="outline">
                👥 {voteCount} {voteCount === 1 ? 'голос' : 'голосов'}
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {pollTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              ⏰ Осталось {timeRemaining}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {/* Left Button */}
            {hasVotedInCurrentPoll ? (
              <Button
                variant="outline"
                size="lg"
                className="flex-col h-auto py-4"
                onClick={handleShowResults}
                disabled={actionLoading}
              >
                <BarChart3 className="size-6 mb-2" />
                <span className="font-semibold">Результаты</span>
                <span className="text-xs text-muted-foreground">текущие</span>
              </Button>
            ) : isNewUser ? (
              <Button
                variant="outline"
                size="lg"
                className="flex-col h-auto py-4"
                onClick={handleShowMenu}
                disabled={actionLoading}
              >
                <MenuIcon className="size-6 mb-2" />
                <span className="font-semibold">Смотреть</span>
                <span className="text-xs text-muted-foreground">меню</span>
              </Button>
            ) : (
              <Button
                variant="peach"
                size="lg"
                className="flex-col h-auto py-4"
                onClick={handleQuickVote}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="size-6 mb-2 animate-spin" />
                ) : (
                  <>
                    <Repeat className="size-6 mb-2" />
                    <span className="font-semibold">Повторить</span>
                    <span className="text-xs opacity-80 truncate max-w-full">
                      {lastVote?.menuItemName}
                    </span>
                  </>
                )}
              </Button>
            )}

            {/* Right Button */}
            {hasVotedInCurrentPoll ? (
              <Button
                variant="outline"
                size="lg"
                className="flex-col h-auto py-4"
                onClick={handleChangeVote}
                disabled={actionLoading}
              >
                <RefreshCw className="size-6 mb-2" />
                <span className="font-semibold">Изменить</span>
                <span className="text-xs text-muted-foreground">выбор</span>
              </Button>
            ) : (
              <Button
                variant="mint"
                size="lg"
                className="flex-col h-auto py-4"
                onClick={handleRandomVote}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="size-6 mb-2 animate-spin" />
                ) : (
                  <>
                    <Shuffle className="size-6 mb-2" />
                    <span className="font-semibold">Рулетка</span>
                    {isNewUser && (
                      <span className="text-xs opacity-80">Повезет!</span>
                    )}
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Info Block */}
          {hasVotedInCurrentPoll ? (
            <div className="p-3 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <div className="text-2xl">✅</div>
                <div className="flex-1">
                  <div className="font-semibold text-green-900 dark:text-green-100">
                    Вы выбрали:
                  </div>
                  <div className="text-lg font-bold text-green-700 dark:text-green-300">
                    {voteStatus?.votedItemName}
                  </div>
                  {voteStatus?.sameChoiceCount && voteStatus.sameChoiceCount > 1 && (
                    <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                      👥 Уже {voteStatus.sameChoiceCount} {
                        voteStatus.sameChoiceCount === 1 ? 'человек' : 
                        voteStatus.sameChoiceCount < 5 ? 'человека' : 'человек'
                      } тоже!
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : isNewUser && topDish ? (
            <TopDishRecommendation 
              dish={topDish} 
              pollId={pollId}
              onSelect={() => loadData()}
            />
          ) : lastVote ? (
            <LastVoteFeedback 
              lastVote={lastVote}
              onRate={() => loadData()}
            />
          ) : null}

          {/* Invite Button */}
          <InviteButton pollId={pollId} />
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
};
