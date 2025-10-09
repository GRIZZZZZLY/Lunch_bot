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

// Old components (for poll functionality)
import { SimplePollCard } from '../components/polls';
import { ActivePollActions } from '../components/voting/ActivePollActions';

// Hooks & Services
import { useTelegram } from '../hooks/useTelegram';
import { useAuth } from '../hooks/useAuth';
import { useHaptic } from '../hooks/useHaptic';
import { useMenu, useAppStore } from '../store/useAppStore';
import { pollsService, PollWithDetails } from '../services/polls.service';
import { cn, formatRelativeTime, getInitials, getAvatarColor } from '../lib/utils';
import { useTimeBasedGradient } from '../hooks/useTimeBasedGradient';

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
  hero: HeroAction;
  secondary: SecondaryAction[];
  tertiary?: TertiaryAction;
  layout: '2x50%' | '3x33%';
}

/**
 * HomePage - Полностью переработанная главная страница
 * Современный дизайн с glassmorphism, градиентами и анимациями
 */
export const HomePage: React.FC = () => {
  console.log('🎨 [HomePage] Component render started');
  
  const navigate = useNavigate();
  const { colorScheme } = useTelegram();
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
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [activePolls, setActivePolls] = useState<PollWithDetails[]>([]);
  const [activePoll, setActivePoll] = useState<PollWithDetails | null>(null);
  
  // Quick Actions v2.0 State
  const [currentScenario, setCurrentScenario] = useState<ScenarioType>('no-active-poll');
  const [hasVoted, setHasVoted] = useState(false);
  const [lastPoll, setLastPoll] = useState<PollWithDetails | null>(null);
  const [popularDish, setPopularDish] = useState<any>(null);
  const [randomDish, setRandomDish] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Модалки (оставлены для будущего функционала)
  const [isRandomModalOpen, setIsRandomModalOpen] = useState(false);
  const [isPopularModalOpen, setIsPopularModalOpen] = useState(false);
  
  // Load data on mount
  useEffect(() => {
    console.log('🚀 [HomePage] Component mounted');
    loadData();
  }, []);
  
  const loadData = async () => {
    console.log('📱 [HomePage] Loading data...');
    setIsLoading(true);
    await loadActivePolls();
    setIsLoading(false);
    console.log('✅ [HomePage] Data loaded');
  };
  
  const loadActivePolls = async () => {
    try {
      console.log('🔄 [HomePage] Fetching active polls...');
      const response = await pollsService.getActivePolls();
      
      if (response.success && response.data) {
        setActivePolls(response.data);
        
        if (response.data.length > 0) {
          const firstPoll = response.data[0];
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
          setActivePoll(null);
        }
      } else {
        setActivePoll(null);
        setActivePolls([]);
      }
    } catch (error) {
      console.error('Error loading active polls:', error);
      setActivePoll(null);
      setActivePolls([]);
    }
  };

  // Auto-refresh
  useEffect(() => {
    if (!activePoll) return;
    
    const refreshInterval = setInterval(() => {
      loadActivePolls();
    }, 10000);

    return () => clearInterval(refreshInterval);
  }, [activePoll]);

  const handlePollClosed = () => {
    loadActivePolls();
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
    const hasActivePoll = !!activePoll && activePoll.status === 'active';
    return hasActivePoll ? 'has-active-poll' : 'no-active-poll';
  };
  
  /**
   * Handler функции для Quick Actions
   */
  
  // 1. Перейти к голосованиям
  const handleGoToVoting = () => {
    if (activePoll?.id) {
      console.log('🔘 [HomePage] Direct navigation to poll:', activePoll.id);
      navigate(`/vote/${activePoll.id}`);
    } else {
      console.log('🔘 [HomePage] Navigation via VoteRouter (no poll ID)');
      navigate('/vote');
    }
  };
  
  // 2. Случайный выбор
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
    // TODO: Telegram share API
    console.log('Invite friend');
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
  const handleShowTopDish = () => {
    // TODO: Загрузить статистику и показать модалку
    console.log('Show top dish');
    alert('Страница в разработке 🚧');
  };
  
  // 11. Показать статистику пользователя
  const handleShowUserStats = () => {
    // TODO: Создать страницу статистики пользователя
    console.log('Show user stats');
    alert('Страница в разработке 🚧');
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
        hero: {
          title: activePoll?.title || 'Текущее голосование',
          description: `Осталось ${timeRemaining}`,
          icon: <Vote className="size-10 text-white" />,
          buttonText: userHasVoted ? 'Посмотреть результаты' : 'Проголосовать',
          buttonVariant: 'peach',
          showShimmer: !userHasVoted,
          badge: {
            text: userHasVoted ? '✓ Проголосовали' : '⏰ Активно',
            variant: userHasVoted ? 'default' : 'live'
          },
          onClick: () => {
            console.log('🔘 [HomePage] Hero vote button clicked, poll ID:', activePoll?.id);
            navigate(`/vote/${activePoll?.id}`);
            console.log('✅ [HomePage] Navigate to /vote/' + activePoll?.id);
          }
        },
        secondary: [
          {
            id: 'stats',
            title: 'Статистика',
            description: 'Текущая',
            icon: <BarChart3 className="size-6" />,
            gradient: 'lavender',
            onClick: handleShowResults
          },
          {
            id: 'invite',
            title: 'Пригласить',
            description: 'Поделиться',
            icon: <Share2 className="size-6" />,
            gradient: 'mint',
            onClick: handleInviteFriend
          }
        ],
        layout: '2x50%'
      };
    }
    
    // Сценарий 3: Нет активного голосования (по умолчанию)
    return {
      hero: {
        title: 'Голосования',
        description: 'Создавайте и участвуйте в голосованиях',
        icon: <Vote className="size-10 text-white" />,
        buttonText: 'Перейти к голосованиям',
        buttonVariant: 'peach',
        showShimmer: true,
        onClick: handleGoToVoting,
      },
      secondary: [
        {
          id: 'my-stats',
          title: 'Моя статистика',
          description: 'История выборов',
          icon: <User className="size-5" />,
          gradient: 'lavender',
          onClick: handleShowUserStats
        },
        {
          id: 'top-dish',
          title: 'Топ блюдо',
          description: 'Самое популярное',
          icon: <Star className="size-5" />,
          gradient: 'butter',
          onClick: handleShowTopDish
        },
        {
          id: 'invite',
          title: 'Пригласить',
          description: 'Друга',
          icon: <Share2 className="size-5" />,
          gradient: 'mint',
          onClick: handleInviteFriend
        }
      ],
      layout: '3x33%'
    };
  };
  
  // Получаем текущую конфигурацию Quick Actions v2.0
  const quickActionsConfig = getScenarioConfig();
  
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
          ) : activePoll ? (
            <motion.div
              key="active-poll"
              variants={itemVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <ActivePollActions
                pollId={activePoll.id}
                pollTitle={activePoll.title}
                timeRemaining={formatRelativeTime(activePoll.endTime)}
                voteCount={activePoll.voteCount}
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
                <GlassCardContent>
                  <div className="inline-flex items-center justify-center size-16 rounded-full bg-muted mb-4">
                    <Clock className="size-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Нет активных голосований
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Ожидайте запуска голосования от администратора
                  </p>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Actions v2.0 - Показывать только когда НЕТ активного голосования */}
        {!activePoll && (
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="size-5 text-peach-500" />
              <h2 className="text-lg font-semibold text-foreground">
                Быстрые действия
              </h2>
            </div>
          
          {/* Hero Action */}
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
              
              <GlassCardContent className="relative py-6 px-5 space-y-4">
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
                      "size-16 rounded-xl flex items-center justify-center",
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
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-foreground">
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
                  size="lg" 
                  className="w-full" 
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
        )}


      </motion.div>


    </>
  );
};
