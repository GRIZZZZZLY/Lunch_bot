import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight,
  Share2,
  Bell,
  Star,
  Zap,
  RotateCcw,
  Sparkles,
  UserPlus,
} from 'lucide-react';

// New shadcn/ui components
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Progress } from '../components/ui/progress';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';

// Common components
import { UserAvatar } from '../components/common/UserAvatar';

// Custom components
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardDescription, GlassCardContent } from '../components/ui/glass-card';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { MediumWaveGradient } from '../components/background';

// Poll components
import { InlineVotingCard } from '../components/voting/InlineVotingCard';
import { CreatePollForm } from '../components/polls/CreatePollForm';
import { CompletedPollWidget } from '../components/polls/CompletedPollWidget';
import { TopDishModal } from '../components/modals/TopDishModal';
import { PollSummaryCard } from '../components/polls/PollSummaryCard';

// Budget components
import { BudgetWidget } from '../components/budget';

// New components
import { FloatingActionButton } from '../components/common/FloatingActionButton';
import { FeedbackModal } from '../components/modals/FeedbackModal';

// Hooks & Services
import { useTelegram } from '../hooks/useTelegram';
import { useAuth } from '../hooks/useAuth';
import { useHaptic } from '../hooks/useHaptic';
import { useMenu, useAppStore, useUI } from '../store/useAppStore';
import { pollsService, PollWithDetails } from '../services/polls.service';
import { useActivePolls } from '../hooks/usePolls';
import { useMenuItems } from '../hooks/queries';
import { useTodayCompletedPoll } from '../hooks/useTodayCompletedPoll';
import { cn, formatRelativeTime, getInitials, getAvatarColor } from '../lib/utils';
import { useTimeBasedGradient } from '../hooks/useTimeBasedGradient';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';

/**
 * HomePage - Умная адаптивная главная страница
 * 
 * Особенности:
 * - Welcome Card для новых пользователей (0-2 голосования)
 * - Floating Action Button для обратной связи (всегда видна)
 * - Чистый минималистичный дизайн
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const telegram = useTelegram();
  const { colorScheme } = telegram;
  const { user } = useAuth();
  const haptic = useHaptic();
  const { addNotification } = useUI();
  const theme = useAppStore((state) => state.theme);
  
  // Load menu items from API using React Query
  const { data: menuItems = [], isLoading: menuLoading } = useMenuItems();
  
  // Time-based gradient and greeting
  const gradientColors = useTimeBasedGradient(theme === 'dark');
  const timeIcons = {
    morning: '🌅',
    afternoon: '☀️',
    evening: '🌆',
    night: '🌙'
  } as const;
  const timeIcon = timeIcons[gradientColors.timeOfDay];
  
  const isDark = theme === 'dark';

  // State - ВАЖНО: объявляем ДО использования в React Query hooks
  const [activePoll, setActivePoll] = useState<PollWithDetails | null>(null);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [isRepeatLoading, setIsRepeatLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [justCompletedPollId, setJustCompletedPollId] = useState<number | null>(null);

  // React Query: Load active polls with caching
  const { data: activePolls = [], isLoading, refetch } = useActivePolls();

  // React Query: Load today's completed poll
  // Используем groupId из активного голосования или из user groups (если есть)
  const userGroupId = user?.groups?.[0]?.id || activePoll?.groupId;
  const { data: todayCompletedPoll, isLoading: loadingCompletedPoll, error: completedPollError, refetch: refetchCompleted } = useTodayCompletedPoll(
    userGroupId,
    !!userGroupId // Всегда загружаем если есть groupId (не зависит от activePoll)
  );

  // Debug logging
  useEffect(() => {
    console.log('[HomePage] Completed Poll State:', {
      userGroupId,
      hasActivePoll: !!activePoll,
      loadingCompletedPoll,
      hasCompletedPoll: !!todayCompletedPoll,
      error: completedPollError
    });
  }, [userGroupId, activePoll, loadingCompletedPoll, todayCompletedPoll, completedPollError]);

  // Auto-hide celebration after 3 seconds
  useEffect(() => {
    if (showCelebration) {
      const timer = setTimeout(() => {
        setShowCelebration(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [showCelebration]);

  // Отслеживаем автоматическое завершение голосования
  const prevActivePollRef = useRef<PollWithDetails | null>(null);
  
  useEffect(() => {
    // Проверяем переход: было активное голосование → теперь нет
    const hadActivePoll = prevActivePollRef.current !== null;
    const nowHasNoPoll = activePoll === null;
    
    if (hadActivePoll && nowHasNoPoll && todayCompletedPoll && !showCelebration) {
      console.log('🎉 [HomePage] Detected auto-completed poll, triggering celebration');
      setJustCompletedPollId(todayCompletedPoll.id);
      setShowCelebration(true);
    }
    
    // Обновляем ref для следующего цикла
    prevActivePollRef.current = activePoll;
  }, [activePoll, todayCompletedPoll, showCelebration]);
  
  // Модалки
  const [isTopDishModalOpen, setIsTopDishModalOpen] = useState(false);
  const [topDishData, setTopDishData] = useState<any>(null);
  const [loadingTopDish, setLoadingTopDish] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  
  // NOTE: userPollCount и Welcome Card удалены - инструкция показывается только при первом запуске
  
  // Set first active poll when data loads
  useEffect(() => {
    console.log('🚀 [HomePage] Active polls loaded:', activePolls.length);
    
    if (activePolls.length > 0) {
      const firstPoll = activePolls[0];
      console.log('✅ [HomePage] Found active poll:', {
            id: firstPoll.id,
            status: firstPoll.status,
            groupId: firstPoll.groupId
          });
          
          const transformedPoll = {
            ...firstPoll,
            title: 'Голосование на обед',
            endTime: firstPoll.endedAt || 
              (firstPoll.startedAt ? 
                new Date(new Date(firstPoll.startedAt).getTime() + (firstPoll.duration || 30) * 60 * 1000).toISOString() : 
                new Date(Date.now() + 30 * 60 * 1000).toISOString()),
            voteCount: firstPoll._count?.votes || 0,
          };
          
          setActivePoll(transformedPoll as any);
    } else {
      console.log('⚠️ [HomePage] No active polls found');
      setActivePoll(null);
    }
  }, [activePolls]);

  // Auto-refresh
  useEffect(() => {
    if (!activePoll) {
      // Когда нет активного голосования, можем включить подтверждение
      if (telegram.enableClosingConfirmation) {
        telegram.enableClosingConfirmation();
      }
      return;
    }
    
    // Когда есть активное голосование, отключаем подтверждение закрытия
    // чтобы пользователь мог свободно закрыть Mini App
    if (telegram.disableClosingConfirmation) {
      telegram.disableClosingConfirmation();
    }
    
    const refreshInterval = setInterval(() => {
      refetch(); // React Query auto-refetch
    }, 10000);

    return () => {
      clearInterval(refreshInterval);
      // При размонтировании восстанавливаем подтверждение
      if (telegram.enableClosingConfirmation) {
        telegram.enableClosingConfirmation();
      }
    };
  }, [activePoll, telegram]);

  const handlePollClosed = () => {
    // Запускаем celebration для текущего активного голосования
    if (activePoll) {
      setJustCompletedPollId(activePoll.id);
      setShowCelebration(true);
    }
    
    // Обновляем оба query: активные И завершённые голосования
    refetch(); // Refresh active polls immediately
    
    // Задержка для completed poll, чтобы backend успел обновить статус
    setTimeout(() => {
      refetchCompleted();
    }, 500); // 500ms задержка
  };

  const queryClient = useQueryClient();

  // Инвалидация polls кэша при смене пользователя
  useEffect(() => {
    if (user?.id) {
      console.log(`[HomePage] User changed to ${user.id} - invalidating polls cache`);
      
      // Инвалидируем все polls queries
      queryClient.invalidateQueries({ queryKey: queryKeys.polls.all });
      
      // Рефетчим активные polls
      refetch();
    }
  }, [user?.id, queryClient, refetch]);

  const handlePollCreated = async (pollId: number) => {
    console.log('✅ [HomePage] Poll created:', pollId);
    haptic.success();
    setIsCreatingPoll(false);
    
    // Инвалидируем только кэш polls (НЕ удаляем меню!)
    queryClient.invalidateQueries({ queryKey: queryKeys.polls.all });
    
    // Обновляем список голосований без popup уведомления
    refetch();
  };

  // Admin functions removed - now only available on VotingHubPage
  
  // ========== Handler Functions ==========
  
  // Пригласить друга
  const handleInviteFriend = () => {
    haptic.impact();
    
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'rocket_lunch_bot';
    const inviteUrl = `https://t.me/${botUsername}?start=invite_${user?.id || 'unknown'}`;
    const shareText = `🍽️ Присоединяйся к нашим обеденным голосованиям!\n\n` +
      `Выбираем еду вместе с командой через удобного бота.\n\n` +
      `Попробуй: ${inviteUrl}`;

    // Используем Telegram WebApp share API
    if (window.Telegram?.WebApp?.openLink) {
      const shareLink = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(shareText)}`;
      window.Telegram.WebApp.openLink(shareLink);
    } else {
      // Fallback - копируем в буфер
      navigator.clipboard.writeText(shareText).then(() => {
        addNotification({
          type: 'success',
          message: '✅ Ссылка скопирована в буфер обмена',
        });
      }).catch(() => {
        addNotification({
          type: 'error',
          message: '❌ Не удалось скопировать ссылку',
        });
      });
    }
  };
  
  // УДАЛЕНО: handleShowWinner, handleRepeatThisPoll, handleLeaveFeedback - не используются
  
  // 10. Показать топ блюдо недели
  const handleShowTopDish = async () => {
    try {
      setLoadingTopDish(true);
      haptic.light();
      
      const response = await pollsService.getPopularItems(1);
      
      if (response.success && response.data && response.data.length > 0) {
        const topItem = response.data[0];
        setTopDishData({
          name: topItem.menuItemName,
          voteCount: topItem.totalVotes,
          percentage: topItem.percentage,
          imageUrl: topItem.imageUrl,
          description: topItem.description,
          price: topItem.price,
        });
        setIsTopDishModalOpen(true);
        haptic.success();
      } else {
        addNotification({
          type: 'info',
          message: '📊 Пока недостаточно данных для статистики',
        });
      }
    } catch (error) {
      console.error('Error loading top dish:', error);
      addNotification({
        type: 'error',
        message: '❌ Не удалось загрузить статистику',
      });
      haptic.error();
    } finally {
      setLoadingTopDish(false);
    }
  };
  
  // УДАЛЕНО: handleShowUserStats - кнопка убрана из Quick Actions (доступна через Bottom Nav)

  // 12. Повторить вчерашнее голосование (только для админов)
  const handleRepeatYesterday = async () => {
    console.log('🔄 [handleRepeatYesterday] Функция вызвана');
    
    try {
      haptic.light();
      console.log('🔄 [handleRepeatYesterday] Haptic feedback отправлен');

      // 1. Получить последнее завершённое голосование
      console.log('🔄 [handleRepeatYesterday] Запрос последнего poll...');
      const response = await pollsService.getLastCompleted();
      console.log('🔄 [handleRepeatYesterday] Ответ получен:', response);

      if (!response.success || !response.data) {
        console.log('❌ [handleRepeatYesterday] Нет завершённых polls');
        addNotification({
          type: 'error',
          message: '❌ Нет завершённых голосований для повтора',
        });
        haptic.error();
        return;
      }

      const lastPoll = response.data;
      console.log('✅ [handleRepeatYesterday] Последний poll:', lastPoll);

      // 2. Подтверждение
      const endDate = lastPoll.endedAt ? new Date(lastPoll.endedAt).toLocaleDateString('ru-RU') : 'неизвестно';
      console.log('🔄 [handleRepeatYesterday] Показываем confirm для даты:', endDate);
      const confirmed = window.confirm(
        `Повторить голосование от ${endDate}?`
      );
      console.log('🔄 [handleRepeatYesterday] Подтверждение:', confirmed);

      if (!confirmed) {
        console.log('❌ [handleRepeatYesterday] Пользователь отменил');
        return;
      }

      // 3. Создать копию
      console.log('🔄 [handleRepeatYesterday] Создаём копию poll ID:', lastPoll.id);
      setIsRepeatLoading(true);
      const repeatResponse = await pollsService.repeatPoll(lastPoll.id);
      console.log('✅ [handleRepeatYesterday] Ответ от repeatPoll:', repeatResponse);

      if (repeatResponse.success && repeatResponse.data) {
        console.log('✅ [handleRepeatYesterday] Poll создан успешно!');
        const newPollId = repeatResponse.data.id;
        
        haptic.success();
        addNotification({
          type: 'success',
          message: '✅ Голосование создано и отправлено!',
        });

        // Очищаем кэш
        console.log('🔄 [handleRepeatYesterday] Очищаем кэш...');
        await queryClient.invalidateQueries({ 
          queryKey: queryKeys.polls.active(),
          refetchType: 'active' 
        });
        
        // Задержка для backend
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Загружаем новое голосование напрямую
        try {
          const newPollResponse = await pollsService.getPollById(newPollId);
          if (newPollResponse.success && newPollResponse.data) {
            console.log('✅ [handleRepeatYesterday] Новый poll загружен:', newPollResponse.data);
            console.log('📋 [handleRepeatYesterday] selectedMenuItemIds:', newPollResponse.data.selectedMenuItemIds);
            
            setActivePoll({
              ...newPollResponse.data,
              title: 'Голосование на обед',
              endTime: newPollResponse.data.endedAt || 
                (newPollResponse.data.startedAt ? 
                  new Date(new Date(newPollResponse.data.startedAt).getTime() + (newPollResponse.data.duration || 30) * 60 * 1000).toISOString() : 
                  new Date(Date.now() + 30 * 60 * 1000).toISOString()),
              voteCount: newPollResponse.data._count?.votes || 0,
            } as any);
          }
        } catch (error) {
          console.error('❌ [handleRepeatYesterday] Ошибка загрузки нового poll:', error);
        }
        
        // Также обновляем React Query кэш
        console.log('🔄 [handleRepeatYesterday] Обновляем React Query кэш...');
        await refetch();
        console.log('✅ [handleRepeatYesterday] Список polls обновлён');
      } else {
        console.log('❌ [handleRepeatYesterday] Ошибка создания:', repeatResponse);
        addNotification({
          type: 'error',
          message: '❌ Ошибка создания голосования',
        });
      }
    } catch (error: any) {
      console.error('❌ [handleRepeatYesterday] Exception:', error);
      haptic.error();
      addNotification({
        type: 'error',
        message: error.message || '❌ Ошибка создания голосования',
      });
    } finally {
      setIsRepeatLoading(false);
      console.log('🔄 [handleRepeatYesterday] Функция завершена');
    }
  };
  

  
  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };
  
  return (
    <>
      {/* Animated gradient background - full page */}
      <MediumWaveGradient />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6 min-h-screen"
      >
        {/* Header Section */}
        <motion.div variants={itemVariants}>
          <GlassCard intensity="solid" className="overflow-hidden">
            <GlassCardContent className="relative">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-3xl">{timeIcon}</div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      Привет, {user?.firstName || 'Гость'}! Время {gradientColors.label.toLowerCase()}! 🍽️
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Выберите что-нибудь вкусное из нашего меню
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <ThemeToggle variant="outline" size="icon" />
                  <div
                    className="cursor-pointer"
                    onClick={() => navigate('/profile')}
                  >
                    <UserAvatar
                      userId={user?.id}
                      firstName={user?.firstName || 'User'}
                      lastName={user?.lastName}
                      size="md"
                      className="size-10 ring-2 ring-primary/20"
                    />
                  </div>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>

        {/* Hero Section - Active Poll Widget with Glassmorphism */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GlassCard intensity="solid" className="p-6">
                <Skeleton className="h-8 w-2/3 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </GlassCard>
            </motion.div>
          ) : isCreatingPoll ? (
            <motion.div
              key="creating-poll"
              variants={itemVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <CreatePollForm
                onSuccess={handlePollCreated}
                onCancel={() => setIsCreatingPoll(false)}
                compact={true}
              />
            </motion.div>
          ) : activePoll ? (
            <motion.div
              key="active-poll"
              variants={itemVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <InlineVotingCard
                poll={activePoll}
                onPollClosed={handlePollClosed}
                onVoteSuccess={() => refetch()}
              />
            </motion.div>
          ) : loadingCompletedPoll ? (
            <motion.div
              key="loading-completed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GlassCard intensity="solid" className="p-6">
                <Skeleton className="h-8 w-2/3 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </GlassCard>
            </motion.div>
          ) : todayCompletedPoll ? (
            <motion.div
              key="completed-poll"
              variants={itemVariants}
              initial="hidden"
              animate="show"
            >
              {/* Показываем результаты завершенного голосования с celebration */}
              <CompletedPollWidget
                poll={todayCompletedPoll}
                showCelebration={showCelebration && justCompletedPollId === todayCompletedPoll.id}
                onCelebrationEnd={() => setShowCelebration(false)}
              />
            </motion.div>
          ) : showCelebration ? (
            // Во время celebration показываем loading вместо "Нет активного голосования"
            <motion.div
              key="celebration-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GlassCard intensity="solid" className="p-6">
                <div className="text-center space-y-4">
                  <div className="text-6xl">🎉</div>
                  <Skeleton className="h-8 w-2/3 mx-auto mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                </div>
              </GlassCard>
            </motion.div>
          ) : (
            <motion.div
              key="no-poll"
              variants={itemVariants}
              initial="hidden"
              animate="show"
            >
              {/* UX UPGRADE: Убрана геймификация (DynamicHeroBanner) - простая карточка */}
              <GlassCard intensity="solid" className="overflow-hidden">
                <GlassCardContent className="relative py-8 px-6 text-center space-y-6">
                  <div className="text-6xl">🍽️</div>
                  
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">
                      Нет активного голосования
                    </h2>
                    <p className="text-muted-foreground">
                      {user?.isAdmin 
                        ? 'Создайте новое голосование для группы'
                        : 'Дождитесь, пока администратор создаст голосование'
                      }
                    </p>
                  </div>

                  {user?.isAdmin && (
                    <div className="flex flex-col gap-3">
                      <Button 
                        variant="mint"
                        size="lg"
                        className="w-full"
                        onClick={() => {
                          haptic.impact();
                          setIsCreatingPoll(true);
                        }}
                      >
                        <Sparkles className="size-5 mr-2" />
                        Создать голосование
                      </Button>
                      
                      <Button 
                        variant="outline"
                        size="default"
                        className="w-full"
                        onClick={handleRepeatYesterday}
                        disabled={isRepeatLoading}
                      >
                        <RotateCcw className="size-4 mr-2" />
                        Повторить вчерашнее
                      </Button>
                    </div>
                  )}
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>



        {/* Budget Widget - адаптивный виджет бюджет-трекера */}
        <motion.div variants={itemVariants}>
          <BudgetWidget />
        </motion.div>

        {/* Actions Section - Действия */}
        <motion.div variants={itemVariants} className="space-y-3">
          {/* Remind Admin Button */}
          <motion.button
            whileHover={!activePoll ? { scale: 1.02 } : undefined}
            whileTap={!activePoll ? { scale: 0.98 } : undefined}
            onClick={() => {
              if (!activePoll) {
                haptic.impact();
                addNotification({
                  type: 'info',
                  message: '🔔 Функция в разработке',
                });
                // TODO: Реализовать отправку уведомления через API
              }
            }}
            disabled={!!activePoll}
            className={cn(
              'w-full bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm transition-all',
              activePoll 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:shadow-md cursor-pointer'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  activePoll 
                    ? 'bg-gray-100 dark:bg-gray-700' 
                    : 'bg-peach-50 dark:bg-peach-900/20'
                )}>
                  <Bell size={20} className={cn(
                    activePoll 
                      ? 'text-gray-400' 
                      : 'text-peach-500'
                  )} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">
                    Напомнить админу
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {activePoll 
                      ? 'Голосование уже активно' 
                      : 'Попросить создать голосование'
                    }
                  </p>
                </div>
              </div>
              {!activePoll && <div className="text-gray-400 dark:text-gray-600">›</div>}
            </div>
          </motion.button>

          {/* Invite Friend Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleInviteFriend}
            className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-mint-50 dark:bg-mint-900/20">
                  <UserPlus size={20} className="text-mint-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">
                    Пригласить друга
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Поделитесь ботом с коллегами
                  </p>
                </div>
              </div>
              <div className="text-gray-400 dark:text-gray-600">›</div>
            </div>
          </motion.button>
        </motion.div>

      </motion.div>

      {/* Floating Action Button - всегда видна */}
      <FloatingActionButton onClick={() => setIsFeedbackModalOpen(true)} />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />

      {/* Top Dish Modal */}
      <TopDishModal
        isOpen={isTopDishModalOpen}
        onClose={() => setIsTopDishModalOpen(false)}
        topDish={topDishData}
      />

    </>
  );
};
