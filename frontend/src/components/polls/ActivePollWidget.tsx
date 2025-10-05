import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp, X } from 'lucide-react';
import { PollTimer } from './PollTimer';
import { LiveVoteCounter } from './LiveVoteCounter';
import { QuickVoteButton } from './QuickVoteButton';
import { VotersAvatars } from '../voting/VotersAvatars';
import { useHaptic } from '../../hooks/useHaptic';
import { useAuth } from '../../hooks/useAuth';
import { useUI } from '../../store/useAppStore';
import { PollWithDetails, pollsService } from '../../services/polls.service';
import { MenuItem, menuService } from '../../services/menu.service';

interface ActivePollWidgetProps {
  poll: PollWithDetails;
  onVoteSuccess: () => void;
  onPollClosed?: () => void;
}

export const ActivePollWidget: React.FC<ActivePollWidgetProps> = ({
  poll,
  onVoteSuccess,
  onPollClosed,
}) => {
  const navigate = useNavigate();
  const haptic = useHaptic();
  const { user } = useAuth();
  const { addNotification } = useUI();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [topItems, setTopItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    loadMenuItems();
    checkUserVote();
  }, [poll.id]);

  const loadMenuItems = async () => {
    try {
      const response = await menuService.getActiveItems();
      if (response.success && response.data) {
        setMenuItems(response.data);
        // Get top 3 items for quick vote
        setTopItems(response.data.slice(0, 3));
      }
    } catch (error) {
      console.error('Error loading menu items:', error);
    }
  };

  const checkUserVote = () => {
    if (!user || !poll.votes) return;
    const userVote = poll.votes.find((v) => v.userId === user.id);
    if (userVote) {
      setHasVoted(true);
      setSelectedItemId(userVote.menuItemId);
    }
  };

  const handleVote = async () => {
    if (!selectedItemId || submitting) return;

    haptic.medium();
    setSubmitting(true);

    try {
      const response = await pollsService.vote(poll.id, selectedItemId);
      if (response.success) {
        haptic.success();
        addNotification({
          type: 'success',
          message: '✅ Голос учтён!',
        });
        setHasVoted(true);
        onVoteSuccess();
      } else {
        throw new Error(response.error || 'Ошибка голосования');
      }
    } catch (error: any) {
      haptic.error();
      addNotification({
        type: 'error',
        message: error.message || 'Не удалось проголосовать',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const calculateVotePercentage = (itemId: number): number => {
    if (!poll.votes || poll.votes.length === 0) return 0;
    const votes = poll.votes.filter((v) => v.menuItemId === itemId).length;
    return Math.round((votes / poll.votes.length) * 100);
  };

  const handleClosePoll = async () => {
    if (!window.confirm('Завершить голосование?')) return;
    
    haptic.medium();
    try {
      const response = await pollsService.completePoll(poll.id);
      if (response.success) {
        haptic.success();
        addNotification({
          type: 'success',
          message: '✅ Голосование завершено',
        });
        if (onPollClosed) onPollClosed();
      } else {
        throw new Error(response.error);
      }
    } catch (error: any) {
      haptic.error();
      addNotification({
        type: 'error',
        message: error.message || 'Не удалось завершить',
      });
    }
  };

  const totalVotes = poll.votes?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-gradient-to-br from-primary-food-500 to-primary-food-600 rounded-2xl p-6 shadow-xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} className="text-white" />
            <h2 className="text-lg font-bold text-white">Активное голосование</h2>
          </div>
          <p className="text-sm text-white/80">Голосование на обед</p>
        </div>
        
        {/* Close button for admins */}
        {user?.isAdmin && (
          <button
            onClick={handleClosePoll}
            className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Завершить голосование"
          >
            <X size={20} className="text-white" />
          </button>
        )}
      </div>

      {/* Timer and Counter */}
      <div className="flex items-center gap-2 mb-4">
        {poll.endTime && <PollTimer endsAt={new Date(poll.endTime)} />}
        <LiveVoteCounter voteCount={totalVotes} />
      </div>

      {/* Voters Avatars */}
      {poll.votes && poll.votes.length > 0 && (
        <div className="mb-4">
          <VotersAvatars votes={poll.votes} maxDisplay={5} />
        </div>
      )}

      {/* Quick Vote Buttons */}
      {!hasVoted ? (
        <div className="space-y-3 mb-4">
          <AnimatePresence>
            {topItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <QuickVoteButton
                  item={item}
                  isSelected={selectedItemId === item.id}
                  onSelect={() => {
                    haptic.light();
                    setSelectedItemId(item.id);
                  }}
                  disabled={submitting}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white/10 rounded-xl p-4 mb-4">
          <p className="text-white text-center font-medium">
            ✅ Вы проголосовали!
          </p>
          <p className="text-white/70 text-sm text-center mt-1">
            Результаты обновляются в реальном времени
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!hasVoted && (
          <button
            onClick={handleVote}
            disabled={!selectedItemId || submitting}
            className="flex-1 bg-white text-primary-food-600 font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Отправка...' : 'Проголосовать'}
          </button>
        )}
        
        <button
          onClick={() => {
            haptic.medium();
            navigate(`/vote/${poll.id}`);
          }}
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-medium py-3 px-4 rounded-xl active:scale-95 transition-all"
        >
          {hasVoted ? 'Результаты' : 'Все блюда'}
          <ArrowRight size={18} />
        </button>
      </div>
    </motion.div>
  );
};
