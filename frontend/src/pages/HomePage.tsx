import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  RotateCcw,
  Sparkles,
  UserPlus,
  Flame,
  Repeat,
} from 'lucide-react';

// New shadcn/ui components
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

// Custom components
import { PastelCard, CardContent } from '../components/ui/pastel-card';
import { ThemeToggle } from '../components/ui/theme-toggle';
// import { MediumWaveGradient } from '../components/background'; // REMOVED: убрали оранжевый градиент
import { BottomNavigation } from '../components/layout/BottomNavigation';

// Poll components
import { InlineVotingCard } from '../components/voting/InlineVotingCard';
import { CreatePollForm } from '../components/polls/CreatePollForm';
import { CompletedPollWidget } from '../components/polls/CompletedPollWidget';
import { TopDishModal } from '../components/modals/TopDishModal';

// Budget components
import { BudgetWidget } from '../components/budget';

// Recurring Polls components
import { RecurringPollBadge } from '../components/polls/RecurringPollBadge';

// New components
import { FloatingActionButton } from '../components/common/FloatingActionButton';
import { UserAvatar } from '../components/common/UserAvatar';
import { FeedbackModal } from '../components/modals/FeedbackModal';

// Hooks & Services
import { useTelegram } from '../hooks/useTelegram';
import { useAuth } from '../hooks/useAuth';
import { useHaptic } from '../hooks/useHaptic';
import { useAppStore, useUI } from '../store/useAppStore';
import { pollsService, PollWithDetails } from '../services/polls.service';
import { notificationService } from '../services/notification.service';
import { useActivePolls } from '../hooks/usePolls';
import { useMenuItems } from '../hooks/queries';
import { useUserGroups } from '../hooks/queries/useUserQueries';
import { useTodayCompletedPoll } from '../hooks/useTodayCompletedPoll';
import { cn, formatRelativeTime } from '../lib/utils';
import { TYPOGRAPHY_H1, TYPOGRAPHY_H2 } from '../lib/typography';
import { useTimeBasedGradient } from '../hooks/useTimeBasedGradient';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { ICON_SIZES } from '@/lib/design-tokens';
import { getContextualGreeting, getEmptyStateMessage } from '../lib/contextual-messages';
import { getHumanErrorMessage } from '../lib/error-messages';
import { getUserStreak, updateStreakAfterVote } from '../services/streak.service';
import { InsightsCard } from '../components/insights/InsightsCard';
import { generatePersonalInsights } from '../services/insights.service';

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
  const isDark = colorScheme === 'dark';
  
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

  // State - ВАЖНО: объявляем ДО использования в React Query hooks
  const [activePoll, setActivePoll] = useState<PollWithDetails | null>(null);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [createPollTab, setCreatePollTab] = useState<'single' | 'recurring'>('single');
  const [isRepeatLoading, setIsRepeatLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [justCompletedPollId, setJustCompletedPollId] = useState<number | null>(null);

  // ✅ ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА: Все 3 запроса идут одновременно
  // React Query: Load active polls with caching
  const { data: activePolls = [], isLoading: pollsLoading, refetch } = useActivePolls();

  // React Query: Load user groups (параллельно с polls)
  const { data: userGroups = [], isLoading: groupsLoading } = useUserGroups();

  // ВАЖНО: userGroupId ДОЛЖЕН быть объявлен ПОСЛЕ activePolls и userGroups
  // Используем groupId из активного голосования или первой группы пользователя
  const userGroupId = activePoll?.groupId || userGroups[0]?.id;

  // React Query: Load today's completed poll (параллельно, но использует userGroupId)
  const { data: todayCompletedPoll, isLoading: loadingCompletedPoll, error: completedPollError, refetch: refetchCompleted } = useTodayCompletedPoll(
    userGroupId,
    !!userGroupId // Всегда загружаем если есть groupId (не зависит от activePoll)
  );

  // Общий loading state - показываем loading только если ВСЕ запросы в процессе
  const isLoading = pollsLoading || groupsLoading || loadingCompletedPoll;

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

  // Проверяем проголосовал ли пользователь
  const hasVoted = activePoll?.votes?.some(vote => vote.userId === user?.id) || false;
  
  // Проверяем осталось ли меньше 5 минут до закрытия
  const isPollEnding = activePoll ? (() => {
    const endTime = new Date(activePoll.endTime);
    const now = new Date();
    const minutesLeft = (endTime.getTime() - now.getTime()) / (1000 * 60);
    return minutesLeft < 5 && minutesLeft > 0;
  })() : false;

  // Получаем контекстное приветствие
  const contextualGreeting = getContextualGreeting({
    timeOfDay: gradientColors.timeOfDay,
    hasActivePoll: !!activePoll,
    hasVoted,
    isPollEnding,
    hasCompletedPoll: !!todayCompletedPoll,
    userName: user?.firstName,
  });
  
  // Модалки
  const [isTopDishModalOpen, setIsTopDishModalOpen] = useState(false);
  const [topDishData, setTopDishData] = useState<any>(null);
  const [loadingTopDish, setLoadingTopDish] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Streak система
  const [userStreak, setUserStreak] = useState(getUserStreak(user?.id || 0));
  const [showStreakMilestone, setShowStreakMilestone] = useState(false);
  const [achievedMilestone, setAchievedMilestone] = useState<any>(null);

  // Персональные инсайты
  const [personalInsights, setPersonalInsights] = useState(
    generatePersonalInsights(user?.id || 0)
  );
  
  // NOTE: userPollCount и Welcome Card удалены - инструкция показывается только при первом запуске
  
  // ИЗМЕНЕНО: Set active poll based on URL param OR first poll
  useEffect(() => {
    console.log('🚀 [HomePage] Active polls loaded:', activePolls.length);
    
    if (activePolls.length === 0) {
      console.log('⚠️ [HomePage] No active polls found');
      setActivePoll(null);
      return;
    }

    // Проверяем URL параметр pollId (deep link support)
    const searchParams = new URLSearchParams(window.location.search);
    const requestedPollId = searchParams.get('pollId');

    let selectedPoll: PollWithDetails | null = null;

    if (requestedPollId) {
      // Deep link: Ищем конкретное голосование по ID
      const targetPoll = activePolls.find(p => p.id === parseInt(requestedPollId));
      if (targetPoll) {
        selectedPoll = targetPoll as PollWithDetails;
        console.log('✅ [HomePage] Deep link poll found:', {
          id: targetPoll.id,
          status: targetPoll.status,
          groupId: targetPoll.groupId
        });
      } else {
        console.warn('[HomePage] ⚠️ Deep link poll not found:', requestedPollId);
        addNotification({
          type: 'warning',
          message: '⚠️ Голосование не найдено или уже завершено'
        });
        // Fallback на первое голосование
        selectedPoll = activePolls[0] as PollWithDetails;
      }
    } else {
      // Обычный режим: показываем первое активное голосование
      selectedPoll = activePolls[0] as PollWithDetails;
      console.log('✅ [HomePage] Showing first active poll:', {
        id: selectedPoll.id,
        status: selectedPoll.status,
        groupId: selectedPoll.groupId
      });
    }

    // Вычисляем endTime на основе startedAt + duration
    const endTime = selectedPoll.endedAt || 
      (selectedPoll.startedAt ? 
        new Date(new Date(selectedPoll.startedAt).getTime() + (selectedPoll.duration || 30) * 60 * 1000).toISOString() : 
        new Date(Date.now() + 30 * 60 * 1000).toISOString());

    console.log('📊 [HomePage] Poll time calculation:', {
      pollId: selectedPoll.id,
      startedAt: selectedPoll.startedAt,
      duration: selectedPoll.duration,
      endedAt: selectedPoll.endedAt,
      calculatedEndTime: endTime
    });

    const transformedPoll = {
      ...selectedPoll,
      title: 'Голосование на обед',
      endTime,
      voteCount: selectedPoll._count?.votes || 0,
    };
    
    setActivePoll(transformedPoll as any);
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
  
  // Пригласить друга - улучшенная версия с shareLink API
  const handleInviteFriend = async () => {
    haptic.impact();
    
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'rocket_lunch_bot';
    const inviteUrl = `https://t.me/${botUsername}?start=ref_${user?.id || 'unknown'}`;
    const shareText = `🍽️ Присоединяйся к обеденным голосованиям! Выбираем еду вместе с командой. ${inviteUrl}`;
    
    console.log('[Invite] Starting invite flow:', {
      botUsername,
      userId: user?.id,
      inviteUrl,
      hasTelegramWebApp: !!window.Telegram?.WebApp,
      hasShareLink: !!window.Telegram?.WebApp?.shareLink,
      webAppVersion: (window.Telegram?.WebApp as any)?.version,
    });
    
    // Проверяем версию Telegram
    const webApp = window.Telegram?.WebApp;
    const version = (webApp as any)?.version || '0.0';
    const isVersionSupported = parseFloat(version) >= 6.1;
    
    // Вариант 1: Используем shareLink API (Telegram 6.1+)
    if (webApp?.shareLink && isVersionSupported) {
      console.log('[Invite] Using shareLink API');
      try {
        await webApp.shareLink(inviteUrl);
        addNotification({
          type: 'success',
          message: '🎉 Спасибо за приглашение! +50 XP за каждого друга',
        });
        return;
      } catch (error) {
        console.error('[Invite] shareLink failed:', error);
      }
    }
    
    // Вариант 2: Используем openTelegramLink (работает всегда)
    if (webApp?.openTelegramLink) {
      console.log('[Invite] Using openTelegramLink');
      try {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent('🍽️ Присоединяйся к обеденным голосованиям!')}`;
        (webApp as any).openTelegramLink(shareUrl);
        addNotification({
          type: 'success',
          message: '📤 Откройте диалог для отправки приглашения',
        });
        return;
      } catch (error) {
        console.error('[Invite] openTelegramLink failed:', error);
      }
    }
    
    // Вариант 3: Используем openLink (откроет Telegram, но через браузер)
    if (webApp?.openLink) {
      console.log('[Invite] Using openLink');
      try {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent('🍽️ Присоединяйся к обеденным голосованиям!')}`;
        webApp.openLink(shareUrl);
        addNotification({
          type: 'info',
          message: '📱 Откройте Telegram для отправки приглашения',
        });
        return;
      } catch (error) {
        console.error('[Invite] openLink failed:', error);
      }
    }
    
    // Вариант 4: Fallback - копируем в буфер
    console.log('[Invite] Using clipboard fallback');
    fallbackShareInvite(inviteUrl, shareText);
  };

  // Fallback метод - копирование в буфер обмена
  const fallbackShareInvite = (inviteUrl: string, shareText: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareText).then(() => {
        addNotification({
          type: 'success',
          message: '✅ Реферальная ссылка скопирована! За каждого друга +50 XP 🎁',
        });
      }).catch((error) => {
        console.error('[Invite] Clipboard failed:', error);
        // Показываем ссылку в алерте
        showInviteLinkAlert(inviteUrl, shareText);
      });
    } else {
      // Старый браузер - показываем алерт
      showInviteLinkAlert(inviteUrl, shareText);
    }
  };

  // Показать ссылку в алерте (последний fallback)
  const showInviteLinkAlert = (inviteUrl: string, shareText: string) => {
    if (window.Telegram?.WebApp?.showPopup) {
      window.Telegram.WebApp.showPopup({
        title: 'Пригласить друга',
        message: `Отправьте эту ссылку другу:\n\n${inviteUrl}`,
        buttons: [{ id: 'ok', type: 'ok', text: 'OK' }],
      });
    } else {
      alert(`Пригласите друга:\n\n${shareText}`);
    }
  };

  // Напомнить админу о создании голосования
  const handleRemindAdmin = async () => {
    // Используем первую группу пользователя (приоритет выше чем activePoll)
    const groupId = userGroups[0]?.id || activePoll?.groupId;
    
    if (!groupId) {
      addNotification({
        type: 'error',
        message: '❌ Не удалось определить группу',
      });
      return;
    }
    
    try {
      haptic.impact();
      
      const response = await notificationService.remindAdmin(groupId);
      
      if (response.success && response.data) {
        addNotification({
          type: 'success',
          message: response.data.message,
        });
      } else {
        addNotification({
          type: 'error',
          message: response.error || 'Ошибка отправки напоминания',
        });
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: getHumanErrorMessage(error),
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
        message: getHumanErrorMessage(error),
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
        message: getHumanErrorMessage(error),
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
      {/* Background removed - using neutral bg-background from Layout */}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-8 min-h-screen"
      >
        {/* Header Section - Компактное приветствие */}
        <motion.div variants={itemVariants}>
          <PastelCard variant="default" className="overflow-hidden border-l-4 border-orange-500 dark:border-purple-500">
            <CardContent className="relative py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-4xl">{contextualGreeting.emoji}</div>
                  <div>
                    <h1 className="text-xl font-semibold text-foreground leading-tight">
                      {contextualGreeting.greeting}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {contextualGreeting.message}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  <ThemeToggle variant="ghost" size="sm" />
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="cursor-pointer"
                      onClick={() => navigate('/profile')}
                    >
                      <UserAvatar
                        userId={user?.id}
                        firstName={user?.firstName || 'User'}
                        lastName={user?.lastName}
                        size="md"
                        className="ring-2 ring-primary/20"
                      />
                    </div>
                    {userStreak.currentStreak > 0 && (
                      <div className="streak-mini-badge inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-white shadow-sm whitespace-nowrap">
                        <Flame className="size-3.5 fill-current" />
                        <span>{userStreak.currentStreak} дн. подряд</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </PastelCard>
        </motion.div>

        {/* Streak Section removed - integrated into header */}

        {/* Milestone Achievement Overlay */}
        <AnimatePresence>
          {showStreakMilestone && achievedMilestone && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              onClick={() => setShowStreakMilestone(false)}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', damping: 15 }}
                className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl max-w-md mx-4 text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.6 }}
                  className="text-8xl mb-4"
                >
                  {achievedMilestone.emoji}
                </motion.div>
                
                <h2 className="text-3xl font-bold text-foreground mb-2">
                  {achievedMilestone.title}!
                </h2>
                
                <p className="text-lg text-muted-foreground mb-6">
                  {achievedMilestone.message}
                </p>
                
                <div className="flex items-center justify-center gap-2 text-orange-500 font-bold text-2xl">
                  <Flame size={32} className="fill-current" />
                  <span>{userStreak.currentStreak} дней подряд</span>
                </div>
                
                <button
                  onClick={() => setShowStreakMilestone(false)}
                  className="mt-6 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold hover:scale-105 transition-transform"
                >
                  Продолжить 🚀
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section - Active Poll Widget */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PastelCard variant="default" className="p-6 border-l-4 border-gray-300 dark:border-gray-600">
                <Skeleton className="h-8 w-2/3 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </PastelCard>
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
                onVoteSuccess={() => {
                  // Обновляем streak после голосования
                  if (user?.id) {
                    const { streak, milestoneAchieved, newMilestone } = updateStreakAfterVote(user.id);
                    setUserStreak(streak);
                    
                    if (milestoneAchieved && newMilestone) {
                      setAchievedMilestone(newMilestone);
                      setShowStreakMilestone(true);
                      haptic.success();
                      
                      // Скрываем через 5 секунд
                      setTimeout(() => {
                        setShowStreakMilestone(false);
                      }, 5000);
                    }
                  }
                  refetch();
                }}
              />
            </motion.div>
          ) : loadingCompletedPoll ? (
            <motion.div
              key="loading-completed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PastelCard variant="default" className="p-6 border-l-4 border-gray-300 dark:border-gray-600">
                <Skeleton className="h-8 w-2/3 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </PastelCard>
            </motion.div>
          ) : todayCompletedPoll ? (
            <motion.div
              key="completed-poll"
              variants={itemVariants}
              initial="hidden"
              animate="show"
            >
              <CompletedPollWidget
                poll={todayCompletedPoll}
                showCelebration={showCelebration && justCompletedPollId === todayCompletedPoll.id}
                onCelebrationEnd={() => setShowCelebration(false)}
              />
            </motion.div>
          ) : showCelebration ? (
            <motion.div
              key="celebration-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PastelCard variant="default" className="p-6 border-l-4 border-green-500">
                <div className="text-center space-y-4">
                  <div className="text-6xl">🎉</div>
                  <Skeleton className="h-8 w-2/3 mx-auto mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                </div>
              </PastelCard>
            </motion.div>
          ) : (
            <motion.div
              key="no-poll"
              variants={itemVariants}
              initial="hidden"
              animate="show"
            >
              <PastelCard variant="default" className="overflow-hidden">
                <CardContent className="relative py-8 px-6 text-center space-y-6">
                  {(() => {
                    const emptyState = getEmptyStateMessage(gradientColors.timeOfDay, !!todayCompletedPoll);
                    return (
                      <>
                        <div className="text-6xl">{emptyState.emoji}</div>

                        <div className="space-y-2">
                          <h2 className={cn(TYPOGRAPHY_H2.className, "text-foreground")}>
                            {emptyState.title}
                          </h2>
                          <p className="text-muted-foreground">
                            {user?.isAdmin
                              ? 'Создайте новое голосование для группы'
                              : emptyState.description
                            }
                          </p>
                        </div>
                      </>
                    );
                  })()}

                  {user?.isAdmin && (
                    <div className="flex flex-col gap-3">
                      <Button
                        variant="mint"
                        size="lg"
                        className="w-full"
                        onClick={() => {
                          haptic.impact();
                          setCreatePollTab('single');
                          setIsCreatingPoll(true);
                        }}
                      >
                        <Sparkles className={`${ICON_SIZES.md} mr-2`} />
                        Создать голосование
                      </Button>

                      <Button
                        variant="outline"
                        size="default"
                        className="w-full"
                        onClick={() => {
                          haptic.impact();
                          setCreatePollTab('recurring');
                          setIsCreatingPoll(true);
                        }}
                      >
                        <Repeat className={`${ICON_SIZES.sm} mr-2`} />
                        Автоматическое голосование
                      </Button>

                      <Button
                        variant="outline"
                        size="default"
                        className="w-full"
                        onClick={handleRepeatYesterday}
                        disabled={isRepeatLoading}
                      >
                        <RotateCcw className={`${ICON_SIZES.sm} mr-2`} />
                        Повторить вчерашнее
                      </Button>
                    </div>
                  )}

                  {/* Remind Admin - только для НЕ-админов когда нет голосования */}
                  {!user?.isAdmin && userGroupId && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleRemindAdmin}
                      className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 ease-out mt-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                            <Bell className={cn(ICON_SIZES.md, "text-orange-600 dark:text-orange-400")} />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              Напомнить админу
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Попросить создать голосование
                            </p>
                          </div>
                        </div>
                        <div className="text-gray-400 dark:text-gray-600">›</div>
                      </div>
                    </motion.button>
                  )}
                </CardContent>
              </PastelCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Personal Insights Section */}
        {personalInsights.length > 0 && (
          <motion.div variants={itemVariants}>
            <InsightsCard insights={personalInsights} />
          </motion.div>
        )}



        {/* Budget Widget - адаптивный виджет бюджет-трекера (conditional) */}
        <motion.div variants={itemVariants}>
          <BudgetWidget />
        </motion.div>

        {/* Recurring Poll Badge - индикатор автоматических голосований */}
        {user?.isAdmin && (
          <motion.div variants={itemVariants}>
            <RecurringPollBadge
              groupId={userGroupId}
              onClick={() => {
                haptic.impact();
                setCreatePollTab('recurring');
                setIsCreatingPoll(true);
                // TODO: переключить на вкладку "Автоматическое" при открытии
              }}
            />
          </motion.div>
        )}

        {/* Actions Section - Vertical list */}
        <motion.div variants={itemVariants} className="space-y-3">
          {user?.isAdmin && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                haptic.impact();
                setCreatePollTab('recurring');
                setIsCreatingPoll(true);
              }}
              className="relative w-full rounded-xl p-4 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-[0_0_15px_rgba(16,185,129,0.35)] hover:shadow-[0_0_25px_rgba(13,148,136,0.5)] transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                    <Repeat className={cn(ICON_SIZES.lg, 'text-white')} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-white text-lg">
                      Автоголосование
                    </p>
                    <p className="text-sm text-white/80">
                      Запуск по расписанию
                    </p>
                  </div>
                </div>
              </div>
            </motion.button>
          )}
          {/* Invite Friend Button - High priority CTA */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleInviteFriend}
            className="relative w-full rounded-xl p-4 bg-gradient-to-r from-violet-500 to-purple-600 shadow-[0_0_15px_rgba(139,92,246,0.5)] hover:shadow-[0_0_25px_rgba(139,92,246,0.65)] transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                  <UserPlus className={cn(ICON_SIZES.lg, "text-white")} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white text-lg">
                    Пригласить друга
                  </p>
                  <p className="text-sm text-white/80">
                    Поделитесь ботом с коллегами
                  </p>
                </div>
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* Bottom padding for BottomNavigation */}
        <div className="h-20" />

      </motion.div>

      {/* BottomNavigation - Sticky navigation bar */}
      <BottomNavigation />

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

      {/* Create Poll Modal */}
      <Dialog open={isCreatingPoll} onOpenChange={setIsCreatingPoll}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Создание голосования</DialogTitle>
          </DialogHeader>
          <CreatePollForm
            onSuccess={handlePollCreated}
            onCancel={() => setIsCreatingPoll(false)}
            compact={true}
            initialTab={createPollTab}
          />
        </DialogContent>
      </Dialog>

    </>
  );
};
