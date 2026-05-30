import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

// New shadcn/ui components
import { Skeleton } from '../components/ui/skeleton';

// Custom components
import { PastelCard } from '../components/ui/pastel-card';
// import { MediumWaveGradient } from '../components/background'; // REMOVED: убрали оранжевый градиент
// BottomNavigation rendered globally in App.tsx — не импортируем здесь

// Poll components — критичные на первом экране
import { InlineVotingCard } from '../components/voting/InlineVotingCard';

// Lazy: показываются не на каждом рендере, тащат heavy зависимости.
// RouletteRevealOverlay — только во время reveal анимации.
// CreatePollForm — только когда пользователь жмёт "создать".
// CompletedPollWidget — только если есть completed poll за день.
// TopDishModal / CalculatorModal — модалки, открываются по action.
// BudgetWidgetWithCalculator — только если есть долги/кредиты (heavy: ~30 KB).
const RouletteRevealOverlay = lazy(() =>
  import('../components/voting/RouletteRevealOverlay').then((m) => ({ default: m.RouletteRevealOverlay })),
);
const CreatePollForm = lazy(() =>
  import('../components/polls/CreatePollForm').then((m) => ({ default: m.CreatePollForm })),
);
const CompletedPollWidget = lazy(() =>
  import('../components/polls/CompletedPollWidget').then((m) => ({ default: m.CompletedPollWidget })),
);
const TopDishModal = lazy(() =>
  import('../components/modals/TopDishModal').then((m) => ({ default: m.TopDishModal })),
);
const BudgetWidgetWithCalculator = lazy(() =>
  import('../components/budget/BudgetWidgetWithCalculator').then((m) => ({ default: m.BudgetWidgetWithCalculator })),
);
const CalculatorModal = lazy(() =>
  import('../components/budget/CalculatorModal').then((m) => ({ default: m.CalculatorModal })),
);

// Recurring Polls components
import { RecurringPollBadge } from '../components/polls/RecurringPollBadge';

// New components
import { HomeEmptyStateCard } from '../components/home/HomeEmptyStateCard';
import { HomeHeroCard, type PollStatus, type PollMeta } from '../components/home/HomeHeroCard';
import { HomeActionsSection } from '../components/home/HomeActionsSection';
import { ActiveStoreRunsSection } from '../components/store-run/ActiveStoreRunsSection';

// Hooks & Services
import { useTelegram } from '../hooks/useTelegram';
import { useAuth } from '../hooks/useAuth';
import { useHaptic } from '../hooks/useHaptic';
import { useAppStore } from '../store/useAppStore';
import { pollsService, PollWithDetails } from '../services/polls.service';
import { notificationService } from '../services/notification.service';
import { useActivePolls } from '../hooks/usePolls';
import { useMenuItems } from '../hooks/queries';
import { useUserGroups } from '../hooks/queries/useUserQueries';
import { useTodayCompletedPoll } from '../hooks/useTodayCompletedPoll';
import { useCompletedPollVisibility } from '../hooks/useCompletedPollVisibility';
import { formatRelativeTime } from '../lib/utils';
import { TYPOGRAPHY_H1, TYPOGRAPHY_H2 } from '../lib/typography';
import { useTimeBasedGradient } from '../hooks/useTimeBasedGradient';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { ICON_SIZES } from '@/lib/design-tokens';
import { getContextualGreeting } from '../lib/contextual-messages';
import { getHumanErrorMessage } from '../lib/error-messages';
import { getUserStreak, updateStreakAfterVote } from '../services/streak.service';
// InsightsCard moved to StatsPage (Insights tab)

/**
 * HomePage - Умная адаптивная главная страница
 * 
 * Особенности:
 * - Welcome Card для новых пользователей (0-2 голосования)
 * - Обратная связь перенесена на страницу профиля
 * - Чистый минималистичный дизайн
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const telegram = useTelegram();
  const { colorScheme } = telegram;
  const { user } = useAuth();
  const haptic = useHaptic();
  const addNotification = useAppStore((state) => state.addNotification);
  const theme = useAppStore((state) => state.theme);
  const isDark = colorScheme === 'dark';
  
  // Load menu items from API using React Query
  const { data: menuItems = [], isLoading: menuLoading } = useMenuItems();
  
  // Time-based gradient and greeting
  const gradientColors = useTimeBasedGradient(theme === 'dark');

  // State - ВАЖНО: объявляем ДО использования в React Query hooks
  const [activePollOverride, setActivePollOverride] = useState<PollWithDetails | null>(null);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [justCompletedPollId, setJustCompletedPollId] = useState<number | null>(null);
  const [showRouletteOverlay, setShowRouletteOverlay] = useState(false);
  const [rouletteParticipants, setRouletteParticipants] = useState<Array<{ id: number; firstName: string; lastName?: string }>>([]);
  const [rouletteWinner, setRouletteWinner] = useState<{ id: number; firstName: string; lastName?: string } | null>(null);
  const [lastRoulettePollId, setLastRoulettePollId] = useState<number | null>(null);
  const rouletteDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Calculator modal state
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [selectedCategoryOrder, setSelectedCategoryOrder] = useState<any>(null);
  const missingPollNotificationRef = useRef<string | null>(null);
  const [showAdminChecklist, setShowAdminChecklist] = useState(false);

  // ✅ ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА: Все 3 запроса идут одновременно
  // React Query: Load active polls with caching
  const { data: activePolls = [], isLoading: pollsLoading, refetch } = useActivePolls({
    refetchInterval: 30000, // Авто-обновление каждые 30 секунд
  });

  // React Query: Load user groups (параллельно с polls)
  const { data: userGroups = [], isLoading: groupsLoading } = useUserGroups();

  const activePollsSignature = activePolls.map(p => p.id).join(',');

  const derivedActivePoll = useMemo(() => {
    if (activePolls.length === 0) {
      return null;
    }

    const searchParams = new URLSearchParams(location.search);
    const requestedPollId = searchParams.get('pollId');

    let selectedPoll: PollWithDetails | null = null;

    if (requestedPollId) {
      const targetPoll = activePolls.find(p => p.id === parseInt(requestedPollId));
      selectedPoll = (targetPoll || activePolls[0]) as PollWithDetails;
    } else {
      selectedPoll = activePolls[0] as PollWithDetails;
    }

    const endTime = selectedPoll.endedAt ||
      (selectedPoll.startedAt ?
        new Date(new Date(selectedPoll.startedAt).getTime() + (selectedPoll.duration || 30) * 60 * 1000).toISOString() :
        new Date(Date.now() + 30 * 60 * 1000).toISOString());

    return {
      ...selectedPoll,
      title: 'Голосование на обед',
      endTime,
      voteCount: selectedPoll._count?.votes || 0,
    } as PollWithDetails;
  }, [activePollsSignature, location.search]);

  const activePoll = activePollOverride ?? derivedActivePoll;

  useEffect(() => {
    if (activePollOverride && derivedActivePoll && activePollOverride.id === derivedActivePoll.id) {
      setActivePollOverride(null);
    }
  }, [activePollOverride, derivedActivePoll]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const requestedPollId = searchParams.get('pollId');

    if (!requestedPollId) {
      if (missingPollNotificationRef.current) {
        missingPollNotificationRef.current = null;
      }
      return;
    }

    if (activePolls.length === 0) {
      return;
    }

    const targetPoll = activePolls.find(p => p.id === parseInt(requestedPollId));
    if (targetPoll) {
      if (missingPollNotificationRef.current === requestedPollId) {
        missingPollNotificationRef.current = null;
      }
      return;
    }

    if (missingPollNotificationRef.current !== requestedPollId) {
      addNotification({
        type: 'warning',
        message: '⚠️ Голосование не найдено или уже завершено'
      });
      missingPollNotificationRef.current = requestedPollId;
    }
  }, [activePollsSignature, location.search, addNotification]);

  // ВАЖНО: userGroupId ДОЛЖЕН быть объявлен ПОСЛЕ activePolls и userGroups
  // Используем groupId из активного голосования или первой группы пользователя
  const userGroupId = activePoll?.groupId || userGroups[0]?.id;

  // React Query: Load today's completed poll (параллельно, но использует userGroupId)
  const { data: todayCompletedPoll, isLoading: loadingCompletedPoll, error: completedPollError, refetch: refetchCompleted } = useTodayCompletedPoll(
    userGroupId,
    !!userGroupId // Всегда загружаем если есть groupId (не зависит от activePoll)
  );

  // Derive hero card poll status from existing query data
  const heroPollStatus: PollStatus = (() => {
    if (activePoll) return 'active';
    if (todayCompletedPoll) {
      const result = (todayCompletedPoll as any).result;
      if (result) return 'completed-result';
      return 'completed';
    }
    return 'none';
  })();

  const heroPollMeta: PollMeta = (() => {
    if (activePoll) {
      const endDate = activePoll.endTime ? new Date(activePoll.endTime) : null;
      const time = endDate
        ? `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`
        : undefined;
      return { time };
    }
    if (todayCompletedPoll) {
      const result = (todayCompletedPoll as any).result;
      if (result) {
        const winner = result.winnerItem?.name as string | undefined;
        const responsible = result.responsibleUser
          ? (result.responsibleUser.firstName as string)
          : undefined;
        return { winner, responsible };
      }
    }
    return {};
  })();

  // Видимость pill завершённого опроса (15 мин таймер + localStorage dismiss)
  const { visible: completedVisible, dismiss: dismissCompletedPoll } =
    useCompletedPollVisibility(todayCompletedPoll ?? null);

  const hasAnyPoll = !!activePoll || !!todayCompletedPoll;

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

  useEffect(() => {
    return () => {
      if (rouletteDelayTimerRef.current) {
        clearTimeout(rouletteDelayTimerRef.current);
      }
    };
  }, []);

  // Отслеживаем автоматическое завершение голосования
  const prevActivePollRef = useRef<PollWithDetails | null>(null);
  
  useEffect(() => {
    // Проверяем переход: было активное голосование → теперь нет
    const hadActivePoll = prevActivePollRef.current !== null;
    const nowHasNoPoll = activePoll === null;
    
    if (hadActivePoll && nowHasNoPoll) {
      setTimeout(() => {
        refetchCompleted();
      }, 400);
    }

    if (hadActivePoll && nowHasNoPoll && todayCompletedPoll && !showCelebration) {
      console.log('🎉 [HomePage] Detected auto-completed poll, triggering celebration');
      setJustCompletedPollId(todayCompletedPoll.id);
      setShowCelebration(true);
    }
    
    // Обновляем ref для следующего цикла
    prevActivePollRef.current = activePoll;
  }, [activePoll, todayCompletedPoll, showCelebration, refetchCompleted]);

  useEffect(() => {
    if (!activePoll?.endTime) return;

    const endTimestamp = new Date(activePoll.endTime).getTime();
    if (Number.isNaN(endTimestamp)) return;

    const now = Date.now();
    const delay = Math.max(endTimestamp - now + 1000, 0);

    const timer = setTimeout(() => {
      refetch();
      setTimeout(() => {
        refetchCompleted();
      }, 400);
    }, delay);

    return () => clearTimeout(timer);
  }, [activePoll?.id, activePoll?.endTime, refetch, refetchCompleted]);

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

  // Streak система
  const [userStreak, setUserStreak] = useState(getUserStreak(user?.id || 0));

  // Персональные инсайты перенесены на StatsPage (вкладка "Инсайты")

  const adminEmptyGreeting = useMemo(() => {
    const map = {
      morning: 'Доброе утро',
      afternoon: 'Добрый день',
      evening: 'Добрый вечер',
      night: 'Спокойной ночи',
    } as const;

    return map[gradientColors.timeOfDay];
  }, [gradientColors.timeOfDay]);
  
  // NOTE: userPollCount и Welcome Card удалены - инструкция показывается только при первом запуске
  
  // ИЗМЕНЕНО: Set active poll based on URL param OR first poll

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
    
    return () => {
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

  const handleCelebrationEnd = () => {
    setShowCelebration(false);

    if (!todayCompletedPoll || justCompletedPollId !== todayCompletedPoll.id) {
      return;
    }

    tryShowRouletteOverlay(todayCompletedPoll, 5000);
  };

  const tryShowRouletteOverlay = (poll: PollWithDetails, delayMs: number) => {
    if (lastRoulettePollId === poll.id) {
      return;
    }

    const result =
      poll.results?.[0] ||
      (poll as PollWithDetails & { result?: PollWithDetails['results'][number] }).result;
    const winner = result?.responsible;
    if (!winner) {
      return;
    }

    const participantsMap = new Map<number, { id: number; firstName: string; lastName?: string }>();
    (poll.votes || []).forEach(vote => {
      if (!participantsMap.has(vote.user.id)) {
        participantsMap.set(vote.user.id, {
          id: vote.user.id,
          firstName: vote.user.firstName,
          lastName: vote.user.lastName,
        });
      }
    });

    if (!participantsMap.has(winner.id)) {
      participantsMap.set(winner.id, {
        id: winner.id,
        firstName: winner.firstName,
        lastName: winner.lastName,
      });
    }

    setRouletteWinner({
      id: winner.id,
      firstName: winner.firstName,
      lastName: winner.lastName,
    });
    setRouletteParticipants(Array.from(participantsMap.values()));

    if (rouletteDelayTimerRef.current) {
      clearTimeout(rouletteDelayTimerRef.current);
    }

    rouletteDelayTimerRef.current = setTimeout(() => {
      setShowRouletteOverlay(true);
      setLastRoulettePollId(poll.id);
      haptic.medium();
      rouletteDelayTimerRef.current = null;
    }, delayMs);
  };

  useEffect(() => {
    if (!todayCompletedPoll || showCelebration) {
      return;
    }

    tryShowRouletteOverlay(todayCompletedPoll, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayCompletedPoll?.id, showCelebration]);

  const queryClient = useQueryClient();

  // Инвалидация polls кэша при смене пользователя
  useEffect(() => {
    if (user?.id) {
      console.log(`[HomePage] User changed to ${user.id} - invalidating polls cache`);
      
      // Инвалидируем все polls queries
      queryClient.invalidateQueries({ queryKey: queryKeys.polls.all });
    }
  }, [user?.id, queryClient]);

  useEffect(() => {
    if (!user?.isAdmin || hasAnyPoll) {
      setShowAdminChecklist(false);
      return;
    }

    if (isLoading || typeof window === 'undefined') {
      return;
    }

    const key = `admin_home_checklist_seen_${user.id}`;
    if (localStorage.getItem(key)) {
      setShowAdminChecklist(false);
      return;
    }

    localStorage.setItem(key, 'true');
    setShowAdminChecklist(true);
  }, [user?.id, user?.isAdmin, hasAnyPoll, isLoading]);

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

  // Добавить бота в группу через deep-link ?startgroup=true
  const handleAddToGroup = () => {
    haptic.impact();
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'rocket_lunch_bot';
    const url = `https://t.me/${botUsername}?startgroup=true`;
    const webApp = window.Telegram?.WebApp;
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(url);
    } else if (webApp?.openLink) {
      webApp.openLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
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
          <HomeHeroCard
            greeting={contextualGreeting.greeting}
            message={contextualGreeting.message}
            currentStreak={userStreak.currentStreak}
            user={user}
            onAvatarClick={() => navigate('/profile')}
            timeColors={gradientColors.colors}
            pollStatus={heroPollStatus}
            pollMeta={heroPollMeta}
          />
        </motion.div>

        {/* Streak Section removed - integrated into header */}

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
                  // Обновляем streak после голосования (без модалки — её заменяет рулетка)
                  if (user?.id) {
                    const { streak } = updateStreakAfterVote(user.id);
                    setUserStreak(streak);
                  }
                  refetch();
                }}
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
          ) : todayCompletedPoll && completedVisible ? null : (
            <motion.div
              key="no-poll"
              variants={itemVariants}
              initial="hidden"
              animate="show"
            >
              {(() => {
                const title = user?.isAdmin
                  ? `${adminEmptyGreeting}! Голосования ещё нет`
                  : 'Пока нет активного голосования';
                const description = user?.isAdmin
                  ? 'Создайте вручную или включите авто-запуск'
                  : 'Мы уведомим, когда начнётся. Пока можно предложить блюдо на странице "Меню".';

                return (
                  <HomeEmptyStateCard
                    title={title}
                    description={description}
                    isAdmin={!!user?.isAdmin}
                    showAdminChecklist={showAdminChecklist}
                    showRemindAdmin={!user?.isAdmin && !!userGroupId}
                    onCreatePoll={() => {
                      haptic.impact();
                      setIsCreatingPoll(true);
                    }}
                    onRemindAdmin={handleRemindAdmin}
                  />
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Store Run Section — "Иду в магазин" + активные забеги */}
        <motion.div variants={itemVariants}>
          <ActiveStoreRunsSection
            groupId={userGroupId ?? null}
            currentUserId={user?.id}
          />
        </motion.div>

        {/* Завершённое голосование — компактный pill (15 мин или до dismiss) */}
        <AnimatePresence>
          {todayCompletedPoll && completedVisible && (
            <motion.div
              key="completed-poll-pill"
              variants={itemVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -8 }}
            >
              <CompletedPollWidget
                poll={todayCompletedPoll}
                showCelebration={showCelebration && justCompletedPollId === todayCompletedPoll.id}
                onCelebrationEnd={handleCelebrationEnd}
                defaultCollapsed
                onDismiss={dismissCompletedPoll}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Budget Widget - адаптивный виджет бюджет-трекера (conditional) */}
        <motion.div variants={itemVariants}>
          <BudgetWidgetWithCalculator
            pollId={activePoll?.id || todayCompletedPoll?.id}
            onOpenCalculator={(categoryOrder) => {
              setSelectedCategoryOrder(categoryOrder);
              setIsCalculatorOpen(true);
            }}
          />
        </motion.div>

        {/* Recurring Poll Badge - индикатор автоматических голосований (только если нет активного poll) */}
        {user?.isAdmin && !activePoll && (
          <motion.div variants={itemVariants}>
            <RecurringPollBadge
              groupId={userGroupId}
              onClick={() => {
                haptic.impact();
                setIsCreatingPoll(true);
              }}
            />
          </motion.div>
        )}

        {/* Actions Section - Vertical list */}
        <motion.div variants={itemVariants}>
          <HomeActionsSection
            showAdminAction={!!user?.isAdmin && hasAnyPoll}
            onCreatePoll={() => {
              haptic.impact();
              setIsCreatingPoll(true);
            }}
            onInviteFriend={handleInviteFriend}
            onAddToGroup={handleAddToGroup}
          />
        </motion.div>

        {/* Bottom padding for BottomNavigation + safe-area */}
        <div style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)' }} />

      </motion.div>

      <RouletteRevealOverlay
        isOpen={showRouletteOverlay}
        participants={rouletteParticipants}
        winner={rouletteWinner}
        onClose={() => {
          setShowRouletteOverlay(false);
          if (rouletteDelayTimerRef.current) {
            clearTimeout(rouletteDelayTimerRef.current);
          }
        }}
      />

      {/* BottomNavigation rendered globally in App.tsx — не дублируем */}

      {/* Top Dish Modal */}
      <TopDishModal
        isOpen={isTopDishModalOpen}
        onClose={() => setIsTopDishModalOpen(false)}
        topDish={topDishData}
      />

      {/* Create Poll — Bottom Sheet */}
      <AnimatePresence>
        {isCreatingPoll && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreatingPoll(false)}
              className="fixed inset-0 bg-black/50 z-[55]"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[60] bg-background rounded-t-3xl max-h-[96dvh] overflow-y-auto shadow-2xl"
            >
              <CreatePollForm
                onSuccess={handlePollCreated}
                onCancel={() => setIsCreatingPoll(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Calculator Modal - Center Modal for Order Calculation */}
      <CalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        categoryOrder={selectedCategoryOrder}
      />

    </>
  );
};
