import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '../components/layout/Layout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { GlassHeroCard } from '../components/glass';
import { GlassCard, GlassCardContent } from '../components/ui/glass-card';
import { MediumWaveGradient } from '../components/background';
import { useTimeBasedGradient } from '../hooks/useTimeBasedGradient';
import { 
  CheckCircle2, 
  Circle, 
  Users,
  Vote as VoteIcon,
  AlertCircle,
  Send
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useUI } from '../store/useAppStore';
import { pollsService, PollWithDetails, Vote } from '../services/polls.service';
import { menuService, MenuItem } from '../services/menu.service';
import { cn } from '../lib/utils';
import { FirstTimeVotingTutorial } from '../components/voting/FirstTimeVotingTutorial';
import { VotersAvatars } from '../components/voting/VotersAvatars';
import { AdminControls } from '../components/voting/AdminControls';

/**
 * Страница голосования
 */
export const VotingPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mainButton, backButton, colorScheme, hapticFeedback } = useTelegram();
  const { addNotification } = useUI();
  
  const isDark = colorScheme === 'dark';
  const { from, to, textColor, label } = useTimeBasedGradient(isDark);

  const [poll, setPoll] = useState<PollWithDetails | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [userVote, setUserVote] = useState<Vote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Загрузка данных
  useEffect(() => {
    // Очищаем кэш перед загрузкой для свежих данных
    if (pollId) {
      // Удаляем кэш для конкретного poll
      import('../lib/react-query').then(({ queryClient, queryKeys }) => {
        queryClient.removeQueries({ 
          queryKey: queryKeys.polls.detail(parseInt(pollId))
        });
      });
    }
    loadPollData(false); // Первая загрузка - с loading
  }, [pollId]);

  // Отмечаем что анимации показаны после первой загрузки
  useEffect(() => {
    if (!loading && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [loading]);

  // Автообновление данных каждые 10 секунд (Real-time updates)
  useEffect(() => {
    if (!poll || poll.status !== 'ACTIVE') return;

    const refreshInterval = setInterval(() => {
      // Тихое обновление БЕЗ перерисовки анимаций
      loadPollData(true); // silent mode
    }, 10000); // 10 секунд

    return () => clearInterval(refreshInterval);
  }, [poll?.status]);

  // Проверка первого посещения для показа туториала
  useEffect(() => {
    const hasSeenVotingTutorial = localStorage.getItem('hasSeenVotingTutorial');
    if (!hasSeenVotingTutorial && !loading && poll && poll.status === 'ACTIVE') {
      // Показываем туториал с небольшой задержкой после загрузки
      const timer = setTimeout(() => {
        setShowTutorial(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, poll]);

  // Обновление таймера
  useEffect(() => {
    if (!poll?.endTime) return;

    const timer = setInterval(() => {
      const remaining = pollsService.formatTimeRemaining(poll.endTime!);
      setTimeRemaining(remaining);
      
      if (remaining === 'Завершено') {
        clearInterval(timer);
        addNotification({
          type: 'info',
          message: 'Голосование завершено',
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [poll]);

  // Настройка Telegram кнопок
  useEffect(() => {
    if (!poll || poll.status !== 'ACTIVE') {
      mainButton.hide();
    } else if (selectedItemId && selectedItemId !== userVote?.menuItemId) {
      mainButton.setText('Проголосовать');
      mainButton.onClick(handleVote);
      mainButton.show();
    } else {
      mainButton.hide();
    }

    backButton.onClick(() => navigate('/'));
    backButton.show();

    return () => {
      mainButton.hide();
      backButton.hide();
    };
  }, [selectedItemId, userVote, poll]);

  const loadPollData = async (silent: boolean = false) => {
    try {
      // Только при первой загрузке показываем loader
      if (!silent) {
        setLoading(true);
      }

      if (!pollId) {
        throw new Error('Poll ID is missing');
      }

      // Загружаем данные голосования
      const pollResponse = await pollsService.getPollById(parseInt(pollId));
      
      if (!pollResponse.success || !pollResponse.data) {
        throw new Error('Poll not found');
      }

      const pollData = pollResponse.data;
      
      console.log(`📊 Poll data loaded: ${pollData._count?.votes || 0} votes, ${pollData.votes?.length || 0} vote records`);
      
      // ВАЖНО: Создаем полностью новый объект с глубоким копированием массива votes
      const freshPoll = {
        ...pollData,
        votes: pollData.votes ? [...pollData.votes] : [],
        _count: { ...pollData._count },
      };
      
      setPoll(freshPoll);
      console.log('✅ Poll state updated');

      // Проверяем голос пользователя
      if (user) {
        const existingVote = pollData.votes?.find(v => v.userId === user.id);
        if (existingVote) {
          console.log('👤 User vote found:', existingVote);
          setUserVote({ ...existingVote }); // Создаем новый объект
          setSelectedItemId(existingVote.menuItemId);
        } else {
          console.log('👤 No user vote found');
          setUserVote(null);
        }
      }

      // Загружаем меню и фильтруем по выбранным блюдам в голосовании
      const menuResponse = await menuService.getActiveItems();
      if (menuResponse.success && menuResponse.data) {
        let items = menuResponse.data;
        
        // Фильтруем по выбранным блюдам, если они указаны в poll
        if (pollData.selectedMenuItemIds) {
          try {
            const selectedIds = JSON.parse(pollData.selectedMenuItemIds);
            if (Array.isArray(selectedIds) && selectedIds.length > 0) {
              items = items.filter(item => selectedIds.includes(item.id));
              console.log('✅ Menu items filtered by poll selection:', {
                total: menuResponse.data.length,
                filtered: items.length,
                selectedIds
              });
            }
          } catch (parseError) {
            console.warn('Failed to parse selectedMenuItemIds:', parseError);
          }
        }
        
        // Принудительное обновление через создание нового массива
        setMenuItems([...items]);
        console.log('✅ Menu items updated');
      }

    } catch (error) {
      console.error('Error loading poll data:', error);
      // Только при первой загрузке показываем ошибку и редирект
      if (!silent) {
        addNotification({
          type: 'error',
          message: 'Ошибка загрузки голосования',
        });
        navigate('/');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleVote = async () => {
    if (!selectedItemId || !pollId) return;

    // SECURITY: Проверка endTime перед голосованием
    if (poll?.endedAt) {
      const now = new Date();
      const endTime = new Date(poll.endedAt);
      
      if (now > endTime) {
        hapticFeedback.notificationOccurred('error');
        addNotification({
          type: 'error',
          message: 'Голосование уже завершено',
        });
        return;
      }
    }

    try {
      setSubmitting(true);
      
      console.log('📤 Submitting vote for item:', selectedItemId);
      
      // Haptic feedback при отправке голоса
      hapticFeedback.impactOccurred('light');

      const response = await pollsService.voteForItem(parseInt(pollId), selectedItemId);

      if (response.success && response.data) {
        console.log('✅ Vote response received:', response.data);
        
        // Успешное голосование - haptic success + уведомление
        hapticFeedback.notificationOccurred('success');
        
        // UX UPGRADE: Показываем toast с подтверждением (простая обратная связь)
        addNotification({
          type: 'success',
          message: '✓ Голос учтен! Чтобы изменить - выберите другое блюдо',
        });
        
        console.log('🔄 Refreshing poll data...');
        
        // Небольшая задержка чтобы backend успел обновить данные
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Тихое обновление БЕЗ loader - обновятся только измененные блоки
        await loadPollData(true); // silent = true
        
        // Принудительно обновляем UI (React обновит только изменённые компоненты)
        setRefreshKey(prev => prev + 1);
        
        console.log('✅ UI refreshed with new data (only changed blocks)');
      } else {
        // Ошибка - haptic error
        hapticFeedback.notificationOccurred('error');
        throw new Error(response.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
      hapticFeedback.notificationOccurred('error');
      addNotification({
        type: 'error',
        message: 'Ошибка при голосовании',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectItem = (itemId: number) => {
    if (poll?.status === 'ACTIVE') {
      // Haptic feedback при выборе блюда
      hapticFeedback.selectionChanged();
      setSelectedItemId(itemId);
      
      console.log(`✅ Selected item ${itemId}`);
    }
  };

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('hasSeenVotingTutorial', 'true');
  };

  // Admin actions
  const handleCompletePoll = async (mode: 'single' | 'multi') => {
    try {
      if (!poll) return;
      
      let response;
      if (mode === 'multi') {
        response = await pollsService.completePollMultiWinner(poll.id, {
          minVotes: 1,
          maxWinners: null,
          tieBreakMethod: 'earliest',
        });
      } else {
        response = await pollsService.completePoll(poll.id);
      }

      if (response.success) {
        addNotification({ 
          type: 'success', 
          message: mode === 'multi' ? 'Голосование завершено (распределение)' : 'Голосование завершено' 
        });
        hapticFeedback.notificationOccurred('success');
        
        // Перенаправляем на страницу результатов
        navigate(`/poll/${poll.id}/results`);
      }
    } catch (error) {
      console.error('[VotingPage] Error completing poll:', error);
      addNotification({ type: 'error', message: 'Ошибка завершения голосования' });
      hapticFeedback.notificationOccurred('error');
    }
  };

  const handleExtendPoll = async (minutes: number) => {
    try {
      if (!poll) return;
      addNotification({ type: 'success', message: `Голосование продлено на ${minutes} минут` });
      hapticFeedback.notificationOccurred('success');
      await loadPollData(false);
    } catch (error) {
      console.error('[VotingPage] Error extending poll:', error);
      addNotification({ type: 'error', message: 'Ошибка продления голосования' });
      hapticFeedback.notificationOccurred('error');
    }
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </>
    );
  }

  if (!poll) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <AlertCircle size={48} className="text-gray-400 mx-auto mb-4" aria-label="Предупреждение" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">Голосование не найдено</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-primary-food-700 text-white dark:bg-peach-500 dark:text-slate-900 rounded-lg font-medium"
          >
            На главную
          </motion.button>
        </motion.div>
      </>
    );
  }

  const isActive = poll.status === 'ACTIVE';
  const hasVoted = !!userVote;

  return (
    <>
      {/* Animated gradient background - full page */}
      <MediumWaveGradient />
      


      {/* Hero Card */}
      <motion.div
        initial={!hasAnimated ? { opacity: 0, y: -20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        <GlassHeroCard
          gradient={{ from, to }}
          value={(poll._count?.votes || 0).toString()}
          label={poll.title || 'Голосование'}
          sublabel={isActive ? `${timeRemaining} · Активно` : 'Завершено'}
          textColor={textColor}
          icon={<VoteIcon size={24} aria-hidden="true" />}
        />
      </motion.div>

      <div className="space-y-4">
        {/* Admin Controls - только для админов */}
        {user?.isAdmin && poll && poll.status === 'ACTIVE' && (
          <AdminControls
            poll={poll}
            onComplete={handleCompletePoll}
            onExtend={handleExtendPoll}
          />
        )}




        {/* Статус голоса пользователя */}
        {hasVoted && (
          <motion.div
            key={`vote-status-${userVote?.menuItemId || 0}-${refreshKey}`}
            initial={!hasAnimated ? { opacity: 0, scale: 0.95 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: !hasAnimated ? 0.2 : 0, duration: 0.15 }}
          >
            <div className="px-4 py-2 rounded-lg bg-mint-50/80 dark:bg-mint-900/20 border-l-4 border-mint-500 dark:border-mint-400">
                    <p className="text-sm text-gray-900 dark:text-white">
                      ✅ <span className="font-medium">{userVote.menuItem.name}</span>
                      {isActive && <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(можно изменить)</span>}
                    </p>
            </div>
          </motion.div>
        )}

        {/* Список блюд */}
        <motion.div
          initial={!hasAnimated ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: !hasAnimated ? 0.2 : 0, duration: 0.15 }}
        >
          {menuItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Нет доступных блюд
            </div>
          ) : (
            <div key={refreshKey} className="space-y-3">
              {menuItems.map((item, index) => {
                const isSelected = selectedItemId === item.id;
                const isUserChoice = userVote?.menuItemId === item.id;
                const itemVotes = poll.votes?.filter(v => v.menuItemId === item.id) || [];
                const voteCount = itemVotes.length;
                const voters = itemVotes.map(v => ({
                  ...v.user,
                  telegramId: BigInt((v.user as any).telegramId || v.user.id),
                }));

                return (
                  <motion.div
                    key={item.id}
                    initial={!hasAnimated ? { opacity: 0, x: -20 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: !hasAnimated ? 0.3 + index * 0.03 : 0, duration: 0.15 }}
                    whileHover={isActive && !submitting ? { scale: 1.02 } : undefined}
                    whileTap={isActive && !submitting ? { scale: 0.98 } : undefined}
                  >
                    <button
                      onClick={() => handleSelectItem(item.id)}
                      disabled={!isActive || submitting}
                      aria-label={`${isSelected ? 'Отменить выбор' : 'Выбрать'} блюдо ${item.name}, ${voteCount} ${voteCount === 1 ? 'голос' : voteCount < 5 ? 'голоса' : 'голосов'}`}
                      aria-pressed={isSelected}
                      className="w-full min-h-[44px]"
                    >
                      <GlassCard
                        className={cn(
                          "border-2 transition-all",
                          isSelected
                            ? 'border-peach-500 dark:border-peach-400 bg-gradient-to-br from-peach-50/80 to-peach-100/60 dark:from-peach-900/30 dark:to-peach-800/20'
                            : 'border-gray-200/50 dark:border-gray-700/50 hover:border-peach-300 dark:hover:border-peach-600',
                          !isActive || submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        )}
                        hover={isActive && !submitting}
                      >
                        <GlassCardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {/* Checkbox Icon */}
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckCircle2 className="size-6 text-primary-food-500 dark:text-peach-400" aria-hidden="true" />
                            ) : isUserChoice ? (
                              <CheckCircle2 className="size-6 text-green-500 dark:text-success-soft-300" aria-hidden="true" />
                            ) : (
                              <Circle className="size-6 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                            )}
                            <span className="sr-only">
                              {isSelected ? 'Выбрано' : isUserChoice ? 'Ваш текущий голос' : 'Не выбрано'}
                            </span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {item.name}
                            </h3>
                          </div>
                        </div>
                        
                        {item.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                            {item.description}
                          </p>
                        )}

                        {/* Social Proof: Аватары проголосовавших */}
                        {voters.length > 0 && (
                          <div className="mt-2">
                            <VotersAvatars voters={voters} maxDisplay={3} size="sm" />
                          </div>
                        )}
                      </div>

                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-20 h-20 object-cover rounded-lg ml-4 flex-shrink-0"
                        />
                      )}
                    </div>
                        </GlassCardContent>
                      </GlassCard>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Информация */}
        {!isActive && (
          <motion.div
            initial={!hasAnimated ? { opacity: 0, scale: 0.95 } : false}
            animate={{ opacity: 1, scale: 1 }}
          >
            <GlassCard className="border-l-4 border-butter-500 dark:border-butter-400 bg-gradient-to-r from-butter-50/50 to-transparent dark:from-butter-900/20 dark:to-transparent">
              <GlassCardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-butter-100 to-butter-200 dark:from-butter-900/30 dark:to-butter-800/30">
                    <AlertCircle size={18} className="text-butter-600 dark:text-butter-400" aria-hidden="true" />
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white flex-1">
                    Голосование завершено. Результаты будут отправлены в личные сообщения.
                  </p>
                </div>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}

        {/* Отступ снизу для FAB */}
        <div className="h-24"></div>
      </div>

      {/* Floating Action Button */}
      {isActive && selectedItemId && selectedItemId !== userVote?.menuItemId && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          whileHover={{ scale: !submitting ? 1.05 : 1 }}
          whileTap={{ scale: !submitting ? 0.95 : 1 }}
          onClick={handleVote}
          disabled={submitting}
          aria-label="Проголосовать за выбранное блюдо"
          className={cn(
            "fixed bottom-20 right-6 z-50",
            "flex items-center justify-center gap-2",
            "px-5 py-3 rounded-full",
            "text-base font-semibold",
            "transition-all duration-300",
            "backdrop-blur-xl",
            !submitting
              ? 'bg-gradient-to-r from-peach-500 to-coral-500 hover:from-peach-600 hover:to-coral-600 text-white dark:from-peach-400 dark:to-coral-400 shadow-2xl shadow-peach-500/50 dark:shadow-peach-400/50 border border-white/20'
              : 'bg-gradient-to-r from-peach-400 to-coral-400 text-white shadow-lg cursor-wait border border-white/10'
          )}
        >
          {submitting ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Отправка...</span>
            </>
          ) : (
            <>
              <Send size={20} aria-hidden="true" />
              <span>Проголосовать</span>
            </>
          )}
        </motion.button>
      )}

      {/* First Time Voting Tutorial */}
      <FirstTimeVotingTutorial 
        isOpen={showTutorial} 
        onClose={handleCloseTutorial} 
      />
    </>
  );
};
