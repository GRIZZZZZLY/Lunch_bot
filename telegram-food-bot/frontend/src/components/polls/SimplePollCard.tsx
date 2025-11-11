import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Clock, Users, Vote, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHaptic } from '../../hooks/useHaptic';
import { useUI } from '../../store/useAppStore';
import { pollsService } from '../../services/polls.service';
import { ICON_SIZES } from '@/lib/design-tokens';

interface SimplePollCardProps {
  poll: any;
  onPollClosed?: () => void;
}

export const SimplePollCard: React.FC<SimplePollCardProps> = ({ 
  poll, 
  onPollClosed 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const haptic = useHaptic();
  const { addNotification } = useUI();
  const [closing, setClosing] = React.useState(false);

  // Calculate time left
  const getTimeLeft = () => {
    if (!poll.endTime && !poll.endedAt) return null;
    
    const endTime = poll.endTime || poll.endedAt;
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;
    
    if (diff <= 0) return 'Завершается...';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}ч ${minutes}мин`;
    }
    return `${minutes} мин`;
  };

  const handleVote = () => {
    haptic.light();
    navigate(`/vote/${poll.id}`);
  };

  const handleClosePoll = async () => {
    if (!window.confirm('Завершить голосование?')) return;
    
    setClosing(true);
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
    } finally {
      setClosing(false);
    }
  };

  const timeLeft = getTimeLeft();
  const voteCount = poll._count?.votes || poll.voteCount || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 rounded-2xl p-6 text-white shadow-xl"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Vote className={ICON_SIZES.md} />
            <h3 className="text-xl font-bold">Голосование активно</h3>
          </div>
          <p className="text-white/80 text-sm">
            {poll.title || 'Выберите блюдо на обед'}
          </p>
        </div>
        
        {/* Timer */}
        {timeLeft && (
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
            <Clock className={ICON_SIZES.sm} />
            <span className="text-sm font-medium">{timeLeft}</span>
          </div>
        )}
      </div>

      {/* Vote Counter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
          <Users size={18} />
          <span className="text-2xl font-bold">{voteCount}</span>
          <span className="text-white/80">
            {voteCount === 1 ? 'голос' : voteCount < 5 ? 'голоса' : 'голосов'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleVote}
          className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl py-3 px-4 font-medium transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Vote size={18} />
          Голосовать
        </motion.button>
        
        {user?.isAdmin && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClosePoll}
            disabled={closing}
            className="px-4 bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm rounded-xl transition-all duration-200 flex items-center justify-center disabled:opacity-50"
            title="Завершить голосование"
          >
            <X className={ICON_SIZES.md} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};
