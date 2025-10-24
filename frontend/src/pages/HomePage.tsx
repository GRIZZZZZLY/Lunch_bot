import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  TrendingUp,
  Clock,
  Vote,
  History,
  BarChart3,
  User,
  Utensils,
  ChefHat,
  Sparkles,
  ArrowRight,
  Repeat,
  Trophy,
  MessageSquare,
  RefreshCw,
  Share2,
  Bell,
  Shuffle,
  Flame,
  Star,
  Zap,
  RotateCcw,
} from 'lucide-react';

// New shadcn/ui components
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Skeleton } from '../components/ui/skeleton';
import { Progress } from '../components/ui/progress';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';

// Custom components
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardDescription, GlassCardContent } from '../components/ui/glass-card';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { MediumWaveGradient } from '../components/background';

// Poll components
import { InlineVotingCard } from '../components/voting/InlineVotingCard';
import { CreatePollForm } from '../components/polls/CreatePollForm';
import { TopDishModal } from '../components/modals/TopDishModal';

// Hooks & Services
import { useTelegram } from '../hooks/useTelegram';
import { useAuth } from '../hooks/useAuth';
import { useHaptic } from '../hooks/useHaptic';
import { useMenu, useAppStore } from '../store/useAppStore';
import { pollsService, PollWithDetails } from '../services/polls.service';
import { useActivePolls } from '../hooks/usePolls';
import { cn, formatRelativeTime, getInitials, getAvatarColor } from '../lib/utils';
import { useTimeBasedGradient } from '../hooks/useTimeBasedGradient';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';

/**
 * Quick Actions v2.0 Types
 */
type ScenarioType = 
  | 'has-active-poll'
  | 'no-active-poll';

interface HeroAction {
  title: string;
  description: string;
  icon?: React.ReactNode;
  imageUrl?: string;
  buttonText: string;
  buttonVariant: 'peach' | 'mint' | 'lavender' | 'coral' | 'butter';
  showShimmer?: boolean;
  badge?: {
    text: string;
    variant?: 'default' | 'live' | 'popular';
  };
  statistics?: {
    voteCount: number;
    percentage: number;
    showProgress: boolean;
    label?: string;
  };
  onClick: () => void;
  disabled?: boolean;
}

interface SecondaryAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: 'peach' | 'mint' | 'lavender' | 'coral' | 'butter';
  onClick: () => void;
  disabled?: boolean;
}

interface TertiaryAction {
  text: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface ScenarioConfig {
  hero: HeroAction | null;  // Hero Action может быть скрыт
  secondary: SecondaryAction[];
  tertiary?: TertiaryAction;
  layout: '2x50%' | '3x33%';
}

/**
 * HomePage - Полностью переработанная главная страница
 * Современный дизайн с glassmorphism, градиентами и анимациями
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const telegram = useTelegram();
  const { colorScheme } = telegram;
  const { user } = useAuth();
  const haptic = useHaptic();
  const { menuItems } = useMenu();
  const theme = useAppStore((state) => state.theme);
  
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
  
  // React Query: Load active polls with caching
  const { data: activePolls = [], isLoading, refetch } = useActivePolls();
  
  // State
  const [activePoll, setActivePoll] = useState<PollWithDetails | null>(null);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  
  // Quick Actions v2.0 State
  const [currentScenario, setCurrentScenario] = useState<ScenarioType>('no-active-poll');
  const [hasVoted, setHasVoted] = useState(false);
  const [lastPoll, setLastPoll] = useState<PollWithDetails | null>(null);
  const [popularDish, setPopularDish] = useState<any>(null);
  const [randomDish, setRandomDish] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Модалки
  const [isRandomModalOpen, setIsRandomModalOpen] = useState(false);
  const [isPopularModalOpen, setIsPopularModalOpen] = useState(false);
  const [isTopDishModalOpen, setIsTopDishModalOpen] = useState(false);
  const [topDishData, setTopDishData] = useState<any>(null);
  const [loadingTopDish, setLoadingTopDish] = useState(false);
  
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
          
          setActivePoll(transformedPoll);
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
    refetch(); // Refresh polls after closing
  };

  const queryClient = useQueryClient();

  const handlePollCreated = async (pollId: number) => {
    console.log('✅ [HomePage] Poll created:', pollId);
    haptic.success();
    setIsCreatingPoll(false);
    
    // Очищаем кэш polls
    queryClient.removeQueries({ queryKey: queryKeys.polls.all });
    
    // Очищаем localStorage кэш
    localStorage.removeItem('TELEGRAM_FOOD_BOT_CACHE');
    
    // Обновляем список голосований без popup уведомления
    refetch();
  };

  // Admin functions removed - now only available on VotingHubPage
  
  // ========== Quick Actions v2.0 Logic ==========
  
  /**
   * Проверка, проголосовал ли пользователь в активном голосовании
   */
  const checkIfUserVoted = (pollId?: number): boolean => {
    if (!pollId || !user?.id) return false;
    // TODO: Реализовать проверку через API или localStorage
    // Пока возвращаем false для тестирования
    return hasVoted;
  };
  
  /**
   * Проверка, завершилось ли голосование недавно (в течение N минут)
   */
  const isWithinMinutes = (dateStr: string | undefined, minutes: number): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000 / 60; // в минутах
    return diff <= minutes;
  };
  
  /**
   * Определение текущего сценария Quick Actions (упрощенно)
   */
  const getCurrentScenario = (): ScenarioType => {
    const hasActivePoll = !!activePoll && activePoll.status === 'ACTIVE';
    return hasActivePoll ? 'has-active-poll' : 'no-active-poll';
  };
  
  /**
   * Handler функции для Quick Actions
   */
  
  // 1. Случайный выбор
  const handleRandomVote = async () => {
    // TODO: Выбрать случайное блюдо из активного голосования
    console.log('Random vote');
    setIsRandomModalOpen(true);
  };
  
  // 3. Голосовать за популярное
  const handleVoteForPopular = async () => {
    // TODO: Получить текущего лидера и показать модалку
    console.log('Vote for popular');
    setIsPopularModalOpen(true);
  };
  
  // 4. Показать результаты
  const handleShowResults = () => {
    navigate('/stats');
  };
  
  // 5. Установить напоминание
  const handleSetReminder = () => {
    // TODO: Показать bottom sheet с выбором времени
    console.log('Set reminder');
  };
  
  // 6. Пригласить друга
  const handleInviteFriend = () => {
    haptic.impact();
    
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'rocket_lunch_bot';
    const inviteUrl = `https://t.me/${botUsername}?start=invite_${user?.id || 'unknown'}`;
    const shareText = `🍽️ Присоединяйся к нашим обеденным голосованиям!\n\n` +
      `Выбираем еду вместе с командой через удобного бота.\n\n` +
      `Попробуй: ${inviteUrl}`;

    // Используем Telegram WebApp share API
    if (telegram.openTelegramLink) {
      const shareLink = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(shareText)}`;
      telegram.openTelegramLink(shareLink);
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
  
  // 7. Показать победителя (детально)
  const handleShowWinner = () => {
    // TODO: Открыть модалку с деталями победителя + конфетти
    console.log('Show winner');
    setShowConfetti(true);
  };
  
  // 8. Повторить завершенное голосование
  const handleRepeatThisPoll = async () => {
    // TODO: Взять текущее завершенное голосование
    console.log('Repeat this poll');
  };
  
  // 9. Оставить отзыв
  const handleLeaveFeedback = () => {
    // TODO: Открыть форму отзыва
    console.log('Leave feedback');
  };
  
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
  
  // 11. Показать статистику пользователя
  const handleShowUserStats = () => {
    haptic.impact();
    navigate('/user/stats');
  };

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
      setIsLoading(true);
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
            });
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
      setIsLoading(false);
      console.log('🔄 [handleRepeatYesterday] Функция завершена');
    }
  };
  
  /**
   * Получение конфигурации Quick Actions для текущего сценария (упрощенно)
   */
  const getScenarioConfig = (): ScenarioConfig => {
    const scenario = getCurrentScenario();
    const userHasVoted = activePoll ? checkIfUserVoted(activePoll.id) : false;
    const timeRemaining = activePoll?.endTime ? formatRelativeTime(activePoll.endTime) : '';
    
    // Сценарий 1: Есть активное голосование
    if (scenario === 'has-active-poll') {
      return {
        // Убираем Hero Action - голосование уже показывается в ActivePollWidget
        hero: null,
        secondary: [
          {
            id: 'stats',
            title: 'Статистика',
            description: 'Текущая',
            icon: <BarChart3 className="size-6" aria-label="Статистика" />,
            gradient: 'lavender',
            onClick: handleShowResults
          },
          {
            id: 'invite',
            title: 'Пригласить',
            description: 'Поделиться',
            icon: <Share2 className="size-6" aria-label="Поделиться" />,
            gradient: 'mint',
            onClick: handleInviteFriend
          }
        ],
        layout: '2x50%'
      };
    }
    
    // Сценарий 3: Нет активного голосования (по умолчанию)
    // Hero Action НЕ показывается - кнопка создания уже есть в пустом состоянии
    const secondaryActions: any[] = [];

    // Кнопка "Повторить вчерашнее" - только для админов
    if (user?.isAdmin) {
      secondaryActions.push({
        id: 'repeat-yesterday',
        title: 'Повторить вчерашнее',
        description: 'Создать копию',
        icon: <RotateCcw className="size-5" aria-label="Повторить" />,
        gradient: 'mint',
        onClick: handleRepeatYesterday
      });
    }

    // Остальные кнопки для всех
    secondaryActions.push(
      {
        id: 'my-stats',
        title: 'Моя статистика',
        description: 'История выборов',
        icon: <User className="size-5" aria-label="Профиль" />,
        gradient: 'lavender',
        onClick: handleShowUserStats
      },
      {
        id: 'top-dish',
        title: 'Топ блюдо',
        description: 'Самое популярное',
        icon: <Star className="size-5" aria-label="Популярное" />,
        gradient: 'butter',
        onClick: handleShowTopDish
      }
    );

    // Если не админ, показываем кнопку "Пригласить"
    if (!user?.isAdmin) {
      secondaryActions.push({
        id: 'invite',
        title: 'Пригласить',
        description: 'Друга',
        icon: <Share2 className="size-5" aria-label="Пригласить" />,
        gradient: 'coral',
        onClick: handleInviteFriend
      });
    }

    return {
      hero: null,  // ← Скрываем Hero Action
      secondary: secondaryActions,
      layout: '3x33%'
    };
  };
  
  // Получаем текущую конфигурацию Quick Actions v2.0
  const quickActionsConfig = getScenarioConfig();
  
  // DEBUG: Логирование состояния (вынесено в useEffect для избежания warning)
  useEffect(() => {
    console.log('🔍 [HomePage] Состояние:', {
      activePoll: !!activePoll,
      isLoading,
      hasHeroAction: !!quickActionsConfig.hero
    });
  }, [activePoll, isLoading, quickActionsConfig.hero]);
  
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
          <GlassCard intensity="low" className="overflow-hidden">
            <div 
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${gradientColors.from}, ${gradientColors.to})`,
                opacity: 0.4
              }}
            />
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
                  <Avatar 
                    className="size-10 cursor-pointer ring-2 ring-primary/20"
                    onClick={() => navigate('/profile')}
                  >
                    <AvatarImage src={user?.photoUrl} alt={user?.firstName} />
                    <AvatarFallback className={getAvatarColor(user?.firstName || 'U')}>
                      {getInitials(user?.firstName || 'User')}
                    </AvatarFallback>
                  </Avatar>
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
              <GlassCard intensity="medium" className="p-6">
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
          ) : (
            <motion.div
              key="no-poll"
              variants={itemVariants}
              initial="hidden"
              animate="show"
            >
              <GlassCard intensity="low" className="text-center py-8">
                <GlassCardContent className="space-y-6">
                  {/* Иконка + заголовок */}
                  <div>
                    <div className="inline-flex items-center justify-center size-16 rounded-full bg-muted mb-4">
                      <Clock className="size-8 text-muted-foreground" aria-label="Время" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Нет активных голосований
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Ожидайте запуска голосования от администратора
                    </p>
                  </div>

                  {/* Большая кнопка создания */}
                  <Button
                    size="lg"
                    onClick={() => {
                      console.log('🔵 [HomePage] Кнопка "Создать голосование" нажата');
                      haptic.impact();
                      setIsCreatingPoll(true);
                      console.log('✅ [HomePage] Открыта форма создания');
                    }}
                    className={cn(
                      'w-full h-14 text-base font-bold rounded-xl',
                      'bg-gradient-to-r from-lavender-500 to-lavender-600',
                      'hover:from-lavender-600 hover:to-lavender-700',
                      'dark:from-lavender-600 dark:to-lavender-700',
                      'text-white',
                      'shadow-md hover:shadow-lg',
                      'transition-all duration-200',
                      'flex items-center justify-center gap-2'
                    )}
                  >
                    <Vote size={22} strokeWidth={2.5} aria-label="Создать голосование" />
                    <span>Создать голосование</span>
                  </Button>

                  {/* Вторичная кнопка - история */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/vote/history')}
                  >
                    <History className="size-4 mr-2" aria-label="История" />
                    История голосований
                  </Button>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Actions v2.0 - Гибридный подход */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-peach-500" aria-label="Быстрые действия" />
            <h2 className="text-lg font-semibold text-foreground">
              Быстрые действия
            </h2>
          </div>
          
          {/* Hero Action - показывается только при активном голосовании */}
          {quickActionsConfig.hero && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 25,
                delay: 0.2 
              }}
            >
              <GlassCard 
                intensity="high" 
                hover={!quickActionsConfig.hero.disabled}
              className={cn(
                "relative overflow-hidden",
                quickActionsConfig.hero.disabled && "opacity-60 cursor-not-allowed"
              )}
            >
              {/* Gradient overlay */}
              <div className={cn(
                "absolute inset-0 -z-10",
                quickActionsConfig.hero.buttonVariant === 'peach' && "bg-gradient-to-br from-peach-500/20 to-coral-500/20",
                quickActionsConfig.hero.buttonVariant === 'mint' && "bg-gradient-to-br from-mint-500/20 to-mint-600/20",
                quickActionsConfig.hero.buttonVariant === 'lavender' && "bg-gradient-to-br from-lavender-500/20 to-lavender-600/20",
                quickActionsConfig.hero.buttonVariant === 'coral' && "bg-gradient-to-br from-coral-500/20 to-coral-600/20",
                quickActionsConfig.hero.buttonVariant === 'butter' && "bg-gradient-to-br from-butter-500/20 to-butter-600/20",
              )} />
              
              {/* Shimmer effect */}
              {quickActionsConfig.hero.showShimmer && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer pointer-events-none" />
              )}
              
              <GlassCardContent className="relative py-4 px-4 space-y-3">
                {/* Badge */}
                {quickActionsConfig.hero.badge && (
                  <Badge 
                    className={cn(
                      "absolute top-3 right-3",
                      quickActionsConfig.hero.badge.variant === 'live' && "animate-pulse bg-red-500 text-white"
                    )}
                  >
                    {quickActionsConfig.hero.badge.text}
                  </Badge>
                )}
                
                {/* Icon or Image */}
                <div className="flex justify-center">
                  {quickActionsConfig.hero.imageUrl ? (
                    <img 
                      src={quickActionsConfig.hero.imageUrl} 
                      alt={quickActionsConfig.hero.title}
                      className="size-20 rounded-xl object-cover ring-2 ring-white/20" 
                    />
                  ) : (
                    <div className={cn(
                      "size-12 rounded-xl flex items-center justify-center",
                      "bg-gradient-to-br",
                      quickActionsConfig.hero.buttonVariant === 'peach' && "from-peach-500 to-coral-500",
                      quickActionsConfig.hero.buttonVariant === 'mint' && "from-mint-500 to-mint-600",
                      quickActionsConfig.hero.buttonVariant === 'lavender' && "from-lavender-500 to-lavender-600",
                      quickActionsConfig.hero.buttonVariant === 'coral' && "from-coral-500 to-coral-600",
                      quickActionsConfig.hero.buttonVariant === 'butter' && "from-butter-500 to-butter-600",
                    )}>
                      {quickActionsConfig.hero.icon}
                    </div>
                  )}
                </div>
                
                {/* Title + Description */}
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-foreground">
                    {quickActionsConfig.hero.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {quickActionsConfig.hero.description}
                  </p>
                </div>
                
                {/* Statistics/Progress (если есть) */}
                {quickActionsConfig.hero.statistics && (
                  <div className="space-y-2">
                    <Progress value={quickActionsConfig.hero.statistics.percentage} className="h-2" />
                    <p className="text-xs text-center text-muted-foreground">
                      {quickActionsConfig.hero.statistics.label || 
                        `👥 ${quickActionsConfig.hero.statistics.voteCount} голосов (${quickActionsConfig.hero.statistics.percentage}%)`
                      }
                    </p>
                  </div>
                )}
                
                {/* Primary Button */}
                <Button 
                  variant={quickActionsConfig.hero.buttonVariant}
                  size="default" 
                  className="w-full h-11" 
                  shimmer={quickActionsConfig.hero.showShimmer}
                  onClick={quickActionsConfig.hero.onClick}
                  disabled={quickActionsConfig.hero.disabled}
                  aria-label={quickActionsConfig.hero.buttonText}
                >
                  {quickActionsConfig.hero.buttonText}
                  <ArrowRight className="size-5 ml-2" aria-hidden="true" />
                </Button>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
          )}
          
          {/* Secondary Actions */}
          <div className={cn(
            "grid gap-3",
            quickActionsConfig.layout === '2x50%' && "grid-cols-2",
            quickActionsConfig.layout === '3x33%' && "grid-cols-3",
          )}>
            {quickActionsConfig.secondary.map((action) => (
              <motion.div
                key={action.id}
                variants={itemVariants}
                whileHover={{ scale: action.disabled ? 1 : 1.02 }}
                whileTap={{ scale: action.disabled ? 1 : 0.98 }}
                onClick={action.disabled ? undefined : action.onClick}
                className={cn(
                  "cursor-pointer",
                  action.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <GlassCard 
                  intensity="medium" 
                  hover={!action.disabled}
                  className="h-full"
                >
                  <GlassCardContent className={cn(
                    "text-center",
                    quickActionsConfig.layout === '2x50%' ? "py-4 px-3 space-y-3" : "py-3 px-2 space-y-2"
                  )}>
                    {/* Icon */}
                    <div className="flex justify-center">
                      <div className={cn(
                        "rounded-xl flex items-center justify-center",
                        "bg-gradient-to-br",
                        quickActionsConfig.layout === '2x50%' ? "size-12" : "size-10 rounded-lg",
                        action.gradient === 'peach' && "from-peach-500 to-coral-500",
                        action.gradient === 'mint' && "from-mint-500 to-mint-600",
                        action.gradient === 'lavender' && "from-lavender-500 to-lavender-600",
                        action.gradient === 'coral' && "from-coral-500 to-coral-600",
                        action.gradient === 'butter' && "from-butter-500 to-butter-600",
                      )}>
                        {React.cloneElement(action.icon as React.ReactElement, { 
                          className: cn(
                            "text-white",
                            quickActionsConfig.layout === '2x50%' ? "size-6" : "size-5"
                          )
                        })}
                      </div>
                    </div>
                    
                    {/* Text */}
                    <div>
                      <h4 className={cn(
                        "font-semibold text-foreground",
                        quickActionsConfig.layout === '2x50%' ? "text-sm mb-1" : "text-xs"
                      )}>
                        {action.title}
                      </h4>
                      {quickActionsConfig.layout === '2x50%' && (
                        <p className="text-xs text-muted-foreground">
                          {action.description}
                        </p>
                      )}
                    </div>
                  </GlassCardContent>
                </GlassCard>
              </motion.div>
            ))}
          </div>
          
          {/* Tertiary Action (если есть) */}
          {quickActionsConfig.tertiary && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={quickActionsConfig.tertiary.onClick}
              className="w-full py-3 px-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
            >
              {React.cloneElement(quickActionsConfig.tertiary.icon as React.ReactElement, { 
                className: "size-4 text-muted-foreground" 
              })}
              <span className="text-sm text-muted-foreground">
                {quickActionsConfig.tertiary.text}
              </span>
            </motion.button>
          )}
        </motion.div>


      </motion.div>

      {/* Top Dish Modal */}
      <TopDishModal
        isOpen={isTopDishModalOpen}
        onClose={() => setIsTopDishModalOpen(false)}
        topDish={topDishData}
      />

    </>
  );
};
