import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Clock, Users, Vote, X } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';
import { useAuth } from '../../hooks/useAuth';
import { useIsGroupAdmin } from '../../hooks/useIsGroupAdmin';
import { useUI } from '../../store/useAppStore';
import { pollsService, PollWithDetails } from '../../services/polls.service';
import { ICON_SIZES } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import { GlassCard } from '../ui/glass-card';

interface SimplePollCardProps {
  poll: PollWithDetails;
  onPollClosed?: () => void;
}

export const SimplePollCard = ({ 
  poll, 
  onPollClosed 
}: SimplePollCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGroupAdmin = useIsGroupAdmin();
  const haptic = useHaptic();
  const { addNotification } = useUI();
  const [closing, setClosing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Adaptive theme detection
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      });
    });
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    return () => observer.disconnect();
  }, []);

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
    } catch (error: unknown) {
      haptic.error();
      const errorMessage = error instanceof Error ? error.message : 'Не удалось завершить';
      addNotification({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setClosing(false);
    }
  };

  const timeLeft = getTimeLeft();
  const voteCount = poll._count?.votes || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <GlassCard
        intensity="medium"
        style={{
          borderLeftWidth: isHovered ? '6px' : '4px',
          transition: 'border-left-width 0.2s ease'
        }}
        className={cn(
          "relative overflow-hidden p-6",
          "border-t border-r border-b border-border",
          "border-l-4",
          isDark ? "border-l-lavender-500" : "border-l-peach-500"
        )}
      >
        {/* Animated gradient overlay */}
        <div className={cn(
          "absolute inset-0 pointer-events-none animate-gradient-slow",
          "bg-gradient-to-br",
          isDark 
            ? "from-lavender-500/10 to-purple-500/10" 
            : "from-peach-500/10 to-coral-500/10"
        )} />
        
        {/* Content with z-index */}
        <div className="relative z-10">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              "bg-gradient-to-br",
              isDark 
                ? "from-lavender-400 to-lavender-600" 
                : "from-peach-400 to-peach-600"
            )}>
              <Vote className={cn(ICON_SIZES.sm, "text-white")} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Голосование активно
            </h3>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            {poll.title || 'Выбери блюдо на обед'}
          </p>
        </div>
        
        {/* Timer */}
        {timeLeft && (
          <div className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-1.5 border",
            isDark 
              ? "bg-lavender-500/10 border-lavender-500/30" 
              : "bg-peach-500/10 border-peach-500/30"
          )}>
            <Clock className={ICON_SIZES.sm} />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {timeLeft}
            </span>
          </div>
        )}
      </div>

      {/* Vote Counter */}
      <div className="flex items-center gap-3 mb-6">
        <div className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 border",
          isDark 
            ? "bg-lavender-500/10 border-lavender-500/30" 
            : "bg-peach-500/10 border-peach-500/30"
        )}>
          <Users size={18} className="text-gray-700 dark:text-gray-300" />
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {voteCount}
          </span>
          <span className="text-gray-600 dark:text-gray-300">
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
          className={cn(
            "flex-1 rounded-xl py-3 px-4 font-medium transition-all duration-200",
            "flex items-center justify-center gap-2",
            "bg-gradient-to-r",
            isDark
              ? "from-lavender-500 to-lavender-600 hover:from-lavender-600 hover:to-lavender-700 text-white"
              : "from-peach-500 to-coral-500 hover:from-peach-600 hover:to-coral-600 text-white"
          )}
        >
          <Vote size={18} />
          Голосовать
        </motion.button>
        
        {isGroupAdmin && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClosePoll}
            disabled={closing}
            className="px-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl transition-all duration-200 flex items-center justify-center disabled:opacity-50"
            title="Завершить голосование"
          >
            <X className={cn(ICON_SIZES.md, "text-red-600 dark:text-red-400")} />
          </motion.button>
        )}
      </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};
