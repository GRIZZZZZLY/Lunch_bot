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
import { GradientButton } from '../components/ui/gradient-button';
import { ThemeToggle } from '../components/ui/theme-toggle';

// Old components (for poll functionality)
import { BottomSheet, useBottomSheet } from '../components/common/BottomSheet';
import { CreatePollForm, SimplePollCard } from '../components/polls';

// Hooks & Services
import { useTelegram } from '../hooks/useTelegram';
import { useAuth } from '../hooks/useAuth';
import { useHaptic } from '../hooks/useHaptic';
import { useMenu, useAppStore } from '../store/useAppStore';
import { pollsService, PollWithDetails } from '../services/polls.service';
import { cn, formatRelativeTime, getInitials, getAvatarColor } from '../lib/utils';

/**
 * HomePage - Полностью переработанная главная страница
 * Современный дизайн с glassmorphism, градиентами и анимациями
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { colorScheme } = useTelegram();
  const { user } = useAuth();
  const haptic = useHaptic();
  const { menuItems } = useMenu();
  const theme = useAppStore((state) => state.theme);
  
  const isDark = theme === 'dark';
  const { isOpen: isPollSheetOpen, open: openPollSheet, close: closePollSheet } = useBottomSheet();
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [activePolls, setActivePolls] = useState<PollWithDetails[]>([]);
  const [activePoll, setActivePoll] = useState<PollWithDetails | null>(null);
  
  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setIsLoading(true);
    await loadActivePolls();
    setIsLoading(false);
  };
  
  const loadActivePolls = async () => {
    try {
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

  // Handle poll creation
  const handlePollCreated = (pollId: number) => {
    closePollSheet();
    haptic.success();
    loadActivePolls();
  };

  const handlePollClosed = () => {
    loadActivePolls();
  };

  const handleCreatePollClick = () => {
    haptic.medium();
    openPollSheet();
  };
  
  // Quick actions data
  const quickActions = [
    {
      id: 'voting',
      title: 'Голосование',
      description: 'Проголосовать за обед',
      icon: <Vote className="size-6" />,
      gradient: 'peach',
      path: '/voting',
      badge: activePoll ? 'Активно' : null,
    },
    {
      id: 'menu',
      title: 'Меню',
      description: 'Посмотреть блюда',
      icon: <Utensils className="size-6" />,
      gradient: 'mint',
      path: '/menu',
      badge: `${menuItems.filter(i => i.isActive).length}`,
    },
    {
      id: 'stats',
      title: 'Статистика',
      description: 'Аналитика',
      icon: <BarChart3 className="size-6" />,
      gradient: 'lavender',
      path: '/stats',
    },
    {
      id: 'history',
      title: 'История',
      description: 'Прошлые голосования',
      icon: <History className="size-6" />,
      gradient: 'coral',
      path: '/history',
    },
  ];
  
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
      {/* Gradient Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full bg-gradient-to-br from-peach-300/20 to-transparent dark:from-peach-500/10 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full rounded-full bg-gradient-to-tr from-lavender-300/20 to-transparent dark:from-lavender-500/10 blur-3xl" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6 pb-24"
      >
        {/* Header Section */}
        <motion.div variants={itemVariants} className="flex items-start justify-between pt-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-peach-600 to-coral-600 dark:from-peach-300 dark:to-coral-300 bg-clip-text text-transparent">
              Привет, {user?.firstName || 'Гость'}!
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Время выбрать что поесть 🍽️
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeToggle variant="ghost" size="icon" />
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
              <GlassCard intensity="high" hover className="overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-peach-400/30 to-transparent dark:from-peach-500/20 blur-2xl" />
                <GlassCardContent className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default" className="bg-peach-500 text-white">
                          🗳️ Активно
                        </Badge>
                        <Badge variant="outline">
                          {activePoll.voteCount} голосов
                        </Badge>
                      </div>
                      <h2 className="text-2xl font-bold text-foreground mb-1">
                        {activePoll.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Завершится через {formatRelativeTime(activePoll.endTime)}
                      </p>
                    </div>
                    <Sparkles className="size-8 text-peach-500 animate-pulse" />
                  </div>
                  
                  <GradientButton
                    variant="peach"
                    size="lg"
                    className="w-full"
                    shimmer
                    onClick={() => navigate('/voting')}
                  >
                    Голосовать
                    <ArrowRight className="size-5 ml-2" />
                  </GradientButton>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          ) : user?.isAdmin ? (
            <motion.div
              key="create-poll"
              variants={itemVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={handleCreatePollClick}
              className="cursor-pointer"
            >
              <GlassCard intensity="medium" hover className="overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-lavender-400/30 to-transparent dark:from-lavender-500/20 blur-2xl" />
                <GlassCardContent className="relative text-center py-8">
                  <div className="inline-flex items-center justify-center size-16 rounded-full bg-gradient-to-br from-lavender-500 to-lavender-600 mb-4 shadow-lg">
                    <Vote className="size-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    Запустить голосование
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Создайте новое голосование для вашей группы
                  </p>
                  <GradientButton variant="lavender" size="lg">
                    Создать
                    <ArrowRight className="size-5 ml-2" />
                  </GradientButton>
                </GlassCardContent>
              </GlassCard>
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

        {/* Quick Actions Grid */}
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Быстрые действия
            </h2>
            <ChefHat className="size-5 text-peach-500" />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <motion.div
                    variants={itemVariants}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      haptic.medium();
                      navigate(action.path);
                    }}
                    className="cursor-pointer"
                  >
                    <GlassCard intensity="low" hover className="h-full">
                      <GlassCardContent className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className={cn(
                            "inline-flex items-center justify-center size-12 rounded-xl",
                            "bg-gradient-to-br",
                            action.gradient === 'peach' && "from-peach-500 to-coral-500",
                            action.gradient === 'mint' && "from-mint-500 to-mint-600",
                            action.gradient === 'lavender' && "from-lavender-500 to-lavender-600",
                            action.gradient === 'coral' && "from-coral-500 to-coral-600",
                          )}>
                            {React.cloneElement(action.icon, { className: "size-6 text-white" })}
                          </div>
                          {action.badge && (
                            <Badge variant="secondary" className="text-xs">
                              {action.badge}
                            </Badge>
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground text-sm mb-0.5">
                            {action.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {action.description}
                          </p>
                        </div>
                      </GlassCardContent>
                    </GlassCard>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{action.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </motion.div>

        {/* Info Card */}
        <motion.div variants={itemVariants}>
          <GlassCard intensity="low" className="overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-butter-400/30 to-transparent dark:from-butter-500/20 blur-2xl" />
            <GlassCardContent className="relative">
              <div className="flex items-start gap-3">
                <div className="text-3xl">🍽️</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">
                    Время обеда!
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Выберите что-нибудь вкусное из нашего меню
                  </p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      </motion.div>

      {/* Create Poll Bottom Sheet */}
      <BottomSheet
        isOpen={isPollSheetOpen}
        onClose={closePollSheet}
        title="Запустить голосование"
        snapPoints={[85]}
        showHandle
        enableSwipeDown
        enableBackdrop={true}
      >
        <CreatePollForm 
          onSuccess={handlePollCreated}
          onCancel={closePollSheet}
        />
      </BottomSheet>
    </>
  );
};
