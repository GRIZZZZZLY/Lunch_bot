import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp, X } from 'lucide-react';
import { PollTimer } from './PollTimer';
import { LiveVoteCounter } from './LiveVoteCounter';
import { QuickVoteButton } from './QuickVoteButton';
import { VotersAvatars } from '../voting/VotersAvatars';
import { useHaptic } from '../../hooks/useHaptic';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentGroup } from '../../hooks/useCurrentGroup';
import { useUI } from '../../store/useAppStore';
import { PollWithDetails, pollsService } from '../../services/polls.service';
import { MenuItem, menuService } from '../../services/menu.service';
import { ICON_SIZES } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import { GlassCard } from '../ui/glass-card';
import { PollParticipantsAdminSection } from './PollParticipantsAdminSection';

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
  const { currentGroupId } = useCurrentGroup();
  const { addNotification } = useUI();

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [topItems, setTopItems] = useState<MenuItem[]>([]);
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

  const loadMenuItems = useCallback(async () => {
    try {
      console.log('[ActivePollWidget] Loading menu items...');
      console.log('[ActivePollWidget] poll.selectedMenuItemIds:', poll.selectedMenuItemIds);
      
      const response = await menuService.getActiveItems(currentGroupId!);
      if (response.success && response.data) {
        let items = response.data;
        console.log('[ActivePollWidget] All active items loaded:', items.length);
        
        // Фильтруем по выбранным блюдам, если они указаны в poll
        if (poll.selectedMenuItemIds) {
          try {
            const selectedIds = JSON.parse(poll.selectedMenuItemIds);
            if (Array.isArray(selectedIds) && selectedIds.length > 0) {
              console.log('[ActivePollWidget] Filtering by selectedIds:', selectedIds);
              items = items.filter(item => selectedIds.includes(item.id));
              console.log('[ActivePollWidget] ✅ Filtered menu items:', {
                allItems: response.data.length,
                selectedItems: items.length,
                selectedIds,
                filteredItemIds: items.map(i => i.id)
              });
            }
          } catch (parseError) {
            console.warn('[ActivePollWidget] Failed to parse selectedMenuItemIds:', parseError);
          }
        } else {
          console.warn('[ActivePollWidget] ⚠️ No selectedMenuItemIds in poll, showing all items');
        }
        
        console.log('[ActivePollWidget] Setting topItems:', items.length);
        // Показываем ВСЕ выбранные блюда для голосования
        setTopItems(items);
      }
    } catch (error) {
      console.error('[ActivePollWidget] Error loading menu items:', error);
    }
  }, [poll.selectedMenuItemIds]);

  const checkUserVote = useCallback(() => {
    if (!user || !poll.votes) return;
    const userVote = poll.votes.find((v) => v.userId === user.id);
    if (userVote) {
      setHasVoted(true);
      setSelectedItemId(userVote.menuItemId);
    }
  }, [poll.votes, user]);

  useEffect(() => {
    loadMenuItems();
    checkUserVote();
  }, [poll.id, loadMenuItems, checkUserVote]);

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
    } catch (error: unknown) {
      haptic.error();
      const errorMessage = error instanceof Error ? error.message : 'Не удалось проголосовать';
      addNotification({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setSubmitting(false);
    }
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
    } catch (error: unknown) {
      haptic.error();
      const errorMessage = error instanceof Error ? error.message : 'Не удалось завершить';
      addNotification({
        type: 'error',
        message: errorMessage,
      });
    }
  };

  const totalVotes = poll.votes?.length || 0;

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
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              "bg-gradient-to-br",
              isDark 
                ? "from-lavender-400 to-lavender-600" 
                : "from-peach-400 to-peach-600"
            )}>
              <TrendingUp className={cn(ICON_SIZES.sm, "text-white")} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Активное голосование
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Голосование на обед
          </p>
        </div>
        
        {/* Close button for admins */}
        {user?.isAdmin && (
          <button
            onClick={handleClosePoll}
            className={cn(
              "flex-shrink-0 p-2 rounded-lg transition-colors",
              isDark 
                ? "hover:bg-lavender-500/10" 
                : "hover:bg-peach-500/10"
            )}
            title="Завершить голосование"
          >
            <X className={cn(ICON_SIZES.md, "text-gray-700 dark:text-gray-300")} />
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
            <VotersAvatars 
              voters={poll.votes.map((v) => {
                const telegramIdValue = v.user.telegramId ?? v.user.id;
                return {
                  id: v.user.id,
                  firstName: v.user.firstName,
                  lastName: v.user.lastName,
                  username: v.user.username,
                  telegramId: BigInt(telegramIdValue),
                };
              })} 
              maxDisplay={5} 
            />
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
        <div className={cn(
          "rounded-xl p-4 mb-4 border",
          isDark 
            ? "bg-lavender-500/10 border-lavender-500/20" 
            : "bg-peach-500/10 border-peach-500/20"
        )}>
          <p className="text-gray-900 dark:text-white text-center font-medium">
            ✅ Ты проголосовал!
          </p>
          <p className="text-gray-600 dark:text-gray-300 text-sm text-center mt-1">
            Результаты обновляются в реальном времени
          </p>
        </div>
      )}

      {/* Admin: участники голосования */}
      {user?.isAdmin && (
        <PollParticipantsAdminSection pollId={poll.id} onAutoClosed={onPollClosed} />
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!hasVoted && (
          <button
            onClick={handleVote}
            disabled={!selectedItemId || submitting}
            className={cn(
              "flex-1 font-semibold py-3 px-4 rounded-xl transition-all",
              "active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
              "bg-gradient-to-r",
              isDark
                ? "from-lavender-500 to-lavender-600 hover:from-lavender-600 hover:to-lavender-700 text-white"
                : "from-peach-500 to-coral-500 hover:from-peach-600 hover:to-coral-600 text-white"
            )}
          >
            {submitting ? 'Отправка...' : 'Проголосовать'}
          </button>
        )}
        
        <button
          onClick={() => {
            haptic.medium();
            navigate(`/vote/${poll.id}`);
          }}
          className={cn(
            "flex items-center gap-2 font-medium py-3 px-4 rounded-xl transition-all",
            "active:scale-95 border",
            isDark
              ? "bg-lavender-500/10 hover:bg-lavender-500/20 border-lavender-500/30 text-gray-900 dark:text-white"
              : "bg-peach-500/10 hover:bg-peach-500/20 border-peach-500/30 text-gray-900"
          )}
        >
          {hasVoted ? 'Результаты' : 'Все блюда'}
          <ArrowRight size={18} />
        </button>
      </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};
