import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Users,
  Trophy,
  Vote,
  Utensils,
  Sparkles,
  Calendar,
  ChefHat,
  Flame,
  Award,
  Star,
  Info,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';

// New shadcn/ui components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { PastelCard, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/pastel-card';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  Tooltip as UITooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '../components/ui/tooltip';
// import { MediumWaveGradient } from '../components/background'; // REMOVED: убрали оранжевый градиент
import { ParallaxLayer } from '../components/effects';

// REMOVED: Gamification stats components (folder deleted)
import {
  LunchDnaCard,
  Leaderboard,
  BudgetInsightsWidget,
} from '../components/stats';

// Budget components
import { BudgetWidgetCompact } from '../components/budget';

// Insights components (moved from HomePage)
import { InsightsCard } from '../components/insights/InsightsCard';
import { RecommendationsCard } from '../components/stats/RecommendationsCard';
import {
  generatePersonalInsights,
  getQuickStats,
  getFavoriteDishes,
  getRotatingRecommendations,
  getStoredVoteHistory,
} from '../services/insights.service';
import { buildLunchDna } from '../services/lunch-dna.service';

// Old components (for polls list)
import { PollCard } from '../components/polls/PollCard';
import { PollResults } from '../components/polls/PollResults';

// Hooks & Services
import { useTelegram } from '../hooks/useTelegram';
import { useConfetti } from '../hooks/useConfetti';
import { useHaptic } from '../hooks/useHaptic';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../store/useAppStore';
import { pollsService, Poll, PollStats, PopularItem } from '../services/polls.service';
import { menuService, type MenuItem } from '../services/menu.service';
import { cn } from '../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

// Chart colors - Theme-aware palette
// UPDATED: Unified with project's peach/coral brand colors
const CHART_COLORS = {
  // 🍑 PRIMARY - Peach (light) / Lavender (dark)
  primary: {
    light: ['#ff6b6b', '#ff8787', '#ffa3a3', '#ffbfbf', '#ffd9d9'], // Peach shades
    dark: ['#A78BFA', '#C4B5FD', '#9F7AEA', '#B794F6', '#D4C5FF'],  // Lavender shades (kept for consistency)
  },
  // 🌿 SECONDARY - Mint Green (complementary for both themes)
  secondary: {
    light: ['#5CAE87', '#7BC4A3', '#86C9A8', '#9ED6B9', '#B6E3CD'],
    dark: ['#86C9A8', '#9ED6B9', '#7BC4A3', '#B6E3CD', '#C5E6D5'],
  },
  // 🪸 ACCENT - Coral (replaces yellow/gold)
  accent: {
    light: ['#ff9999', '#ffb3b3', '#ffc9c9', '#ffd9d9', '#ffecec'],
    dark: ['#ffb3b3', '#ffc9c9', '#ff9999', '#ffecec', '#fff5f5'],
  },
  // 🔴 ERROR - Coral/Red (kept same)
  error: {
    light: ['#FF5A4A', '#FF7B6E', '#FF9B92', '#FFC9C3', '#FFE4E1'],
    dark: ['#FF9B92', '#FFC9C3', '#FF7B6E', '#FFE4E1', '#FFF1F0'],
  },
};

type ViewMode = 'overview' | 'results';

/**
 * StatsPage v2.1 - Mobile-Optimized Analytics Hub
 * UX improvements: compact hero, carousel charts, expandable lists
 */
export const StatsPage: React.FC = () => {
  const { backButton, colorScheme } = useTelegram();
  const addNotification = useAppStore((state) => state.addNotification);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const haptic = useHaptic();
  const confetti = useConfetti();

  const isDark = colorScheme === 'dark';
  const { user } = useAuth();

  // Personal insights data (moved from HomePage)
  const personalInsights = useMemo(
    () => generatePersonalInsights(user?.id || 0),
    [user?.id]
  );
  const quickStats = useMemo(
    () => getQuickStats(user?.id || 0),
    [user?.id]
  );
  const favoriteDishes = useMemo(
    () => getFavoriteDishes(user?.id || 0, 5),
    [user?.id]
  );
  const recommendations = useMemo(
    () => getRotatingRecommendations(user?.id || 0),
    [user?.id]
  );

  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [stats, setStats] = useState<PollStats | null>(null);
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [activeTab, setActiveTab] = useState<'personal' | 'group' | 'global' | 'insights'>('personal');
  const [activeChartSlide, setActiveChartSlide] = useState(0);

  const lunchDnaProfile = useMemo(
    () => buildLunchDna({
      voteHistory: getStoredVoteHistory(user?.id || 0),
      popularItems,
      totalPolls: stats?.totalPolls || 0,
    }),
    [user?.id, popularItems, stats?.totalPolls]
  );

  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (viewMode === 'results') {
      backButton.onClick(() => {
        setViewMode('overview');
        setSelectedPoll(null);
      });
      backButton.show();
    } else {
      backButton.hide();
    }

    return () => {
      backButton.hide();
    };
  }, [viewMode, backButton]);

  const loadData = async () => {
    try {
      setPollsLoading(true);

      const [pollsResponse, statsResponse, popularResponse, menuResponse] = await Promise.all([
        pollsService.getAllPolls(),
        pollsService.getPollStats(),
        pollsService.getPopularItems(10),
        menuService.getAllItems(),
      ]);

      if (pollsResponse.success && pollsResponse.data) {
        // Backend возвращает { polls: [], total, limit, offset, hasNext }
        // Извлекаем только массив polls
        const pollsData = Array.isArray(pollsResponse.data) 
          ? pollsResponse.data 
          : (pollsResponse.data as any).polls || [];
        console.log('[StatsPage] Polls data:', {
          isArray: Array.isArray(pollsResponse.data),
          pollsLength: pollsData.length,
          rawData: pollsResponse.data
        });
        setPolls(pollsData);
      }

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

      if (popularResponse.success && popularResponse.data) {
        setPopularItems(popularResponse.data);
      }

      if (menuResponse.success && menuResponse.data) {
        setMenuItems(menuResponse.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка загрузки статистики',
      });
    } finally {
      setPollsLoading(false);
    }
  };

  const handleViewPollResults = (poll: Poll) => {
    setSelectedPoll(poll);
    setViewMode('results');
    haptic.light();
  };

  // Get theme-aware colors
  const getThemeColors = (type: 'primary' | 'secondary' | 'accent' | 'error') => {
    return isDark ? CHART_COLORS[type].dark : CHART_COLORS[type].light;
  };

  // Activity data для LineChart
  const activityData = useMemo(() => {
    return [
      { date: 'Пн', votes: 45 },
      { date: 'Вт', votes: 52 },
      { date: 'Ср', votes: 38 },
      { date: 'Чт', votes: 61 },
      { date: 'Пт', votes: 73 },
      { date: 'Сб', votes: 29 },
      { date: 'Вс', votes: 34 },
    ];
  }, []);

  // Sorted polls
  const sortedPolls = useMemo(() => {
    // Защита: проверяем что polls - это массив
    if (!Array.isArray(polls)) {
      console.warn('[StatsPage] polls is not an array:', polls);
      return [];
    }
    return pollsService.sortPolls(polls, 'date', 'desc');
  }, [polls]);

  const groupedPolls = useMemo(() => {
    return pollsService.groupPollsByStatus(sortedPolls);
  }, [sortedPolls]);

  // Menu stats
  const menuStats = useMemo(() => {
    if (!menuItems || menuItems.length === 0) {
      return {
        total: 0,
        active: 0,
        averagePrice: 0,
      };
    }

    const active = menuItems.filter((item) => item.isActive).length;
    const totalPrice = menuItems.reduce((sum, item) => sum + (item.price || 0), 0);
    const averagePrice = menuItems.length > 0 ? totalPrice / menuItems.length : 0;

    return {
      total: menuItems.length,
      active,
      averagePrice,
    };
  }, [menuItems]);

  // Max votes для progress bars
  const maxVotes = useMemo(() => {
    if (popularItems.length === 0) return 100;
    return Math.max(...popularItems.map((item) => item.voteCount));
  }, [popularItems]);

  // Handle carousel scroll
  const handleCarouselScroll = () => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const slideWidth = carouselRef.current.offsetWidth * 0.85;
    const newSlide = Math.round(scrollLeft / slideWidth);
    setActiveChartSlide(newSlide);
  };

  // Если просмотр результатов голосования
  if (viewMode === 'results' && selectedPoll) {
    return <PollResults poll={selectedPoll} onBack={() => setViewMode('overview')} />;
  }

  return (
    <>
      {/* Animated gradient background - full page with parallax */}
      {/* Background removed - using neutral bg-background from Layout */}
      
      {/* Compact Header - Sticky */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-11 px-4">
          <div className="flex items-center gap-2">
            <BarChart3 className={`${ICON_SIZES.md} text-primary`} />
            <h1 className="text-lg font-semibold text-foreground">Статистика</h1>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="space-y-4 pb-24 px-4 pt-4">
        {/* Tabs Navigation - Moved to top */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Tabs
            value={activeTab}
            onValueChange={(value: any) => {
              setActiveTab(value);
              haptic.light();
            }}
            className="w-full"
          >
            <TabsList className="grid h-12 w-full grid-cols-4 gap-2 bg-transparent border-0 p-0 rounded-none">
              <TabsTrigger
                value="personal"
                className={cn(
                  'flex !h-full flex-col gap-0.5 py-1.5 text-xs rounded-xl',
                  // Inactive — плоская кнопка с лёгким фоном
                  'bg-muted/40 dark:bg-card/60',
                  'border border-border/40 dark:border-white/[0.06]',
                  'text-muted-foreground',
                  // Active — градиент + акцентная обводка
                  'data-[state=active]:bg-gradient-to-br',
                  'data-[state=active]:from-primary/40 data-[state=active]:via-primary/22 data-[state=active]:to-primary/10',
                  'data-[state=active]:!bg-transparent',
                  'data-[state=active]:text-primary',
                  'data-[state=active]:border-primary/50 dark:data-[state=active]:border-primary/50',
                  'data-[state=active]:shadow-sm',
                  'transition-all duration-200'
                )}
              >
                <Users className={ICON_SIZES.sm} />
                <span className="font-medium">Моё</span>
              </TabsTrigger>
              <TabsTrigger
                value="group"
                className={cn(
                  'flex !h-full flex-col gap-0.5 py-1.5 text-xs rounded-xl',
                  // Inactive — плоская кнопка с лёгким фоном
                  'bg-muted/40 dark:bg-card/60',
                  'border border-border/40 dark:border-white/[0.06]',
                  'text-muted-foreground',
                  // Active — градиент + акцентная обводка
                  'data-[state=active]:bg-gradient-to-br',
                  'data-[state=active]:from-primary/40 data-[state=active]:via-primary/22 data-[state=active]:to-primary/10',
                  'data-[state=active]:!bg-transparent',
                  'data-[state=active]:text-primary',
                  'data-[state=active]:border-primary/50 dark:data-[state=active]:border-primary/50',
                  'data-[state=active]:shadow-sm',
                  'transition-all duration-200'
                )}
              >
                <TrendingUp className={ICON_SIZES.sm} />
                <span className="font-medium">Группа</span>
              </TabsTrigger>
              <TabsTrigger
                value="global"
                className={cn(
                  'flex !h-full flex-col gap-0.5 py-1.5 text-xs rounded-xl',
                  // Inactive — плоская кнопка с лёгким фоном
                  'bg-muted/40 dark:bg-card/60',
                  'border border-border/40 dark:border-white/[0.06]',
                  'text-muted-foreground',
                  // Active — градиент + акцентная обводка
                  'data-[state=active]:bg-gradient-to-br',
                  'data-[state=active]:from-primary/40 data-[state=active]:via-primary/22 data-[state=active]:to-primary/10',
                  'data-[state=active]:!bg-transparent',
                  'data-[state=active]:text-primary',
                  'data-[state=active]:border-primary/50 dark:data-[state=active]:border-primary/50',
                  'data-[state=active]:shadow-sm',
                  'transition-all duration-200'
                )}
              >
                <BarChart3 className={ICON_SIZES.sm} />
                <span className="font-medium">Глобально</span>
              </TabsTrigger>
              <TabsTrigger
                value="insights"
                className={cn(
                  'flex !h-full flex-col gap-0.5 py-1.5 text-xs rounded-xl',
                  // Inactive — плоская кнопка с лёгким фоном
                  'bg-muted/40 dark:bg-card/60',
                  'border border-border/40 dark:border-white/[0.06]',
                  'text-muted-foreground',
                  // Active — градиент + акцентная обводка
                  'data-[state=active]:bg-gradient-to-br',
                  'data-[state=active]:from-primary/40 data-[state=active]:via-primary/22 data-[state=active]:to-primary/10',
                  'data-[state=active]:!bg-transparent',
                  'data-[state=active]:text-primary',
                  'data-[state=active]:border-primary/50 dark:data-[state=active]:border-primary/50',
                  'data-[state=active]:shadow-sm',
                  'transition-all duration-200'
                )}
              >
                <Lightbulb className={ICON_SIZES.sm} />
                <span className="font-medium">Инсайты</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab: Моё (Personal) */}
            <TabsContent value="personal" className="mt-4 space-y-4">
              <AnimatePresence mode="wait">
                {pollsLoading ? (
                  <Skeleton className="h-[420px] rounded-xl" />
                ) : (
                  <LunchDnaCard profile={lunchDnaProfile} />
                )}
              </AnimatePresence>

              {/* Budget Widget Compact (Sprint 2.4) */}
              <AnimatePresence mode="wait">
                {pollsLoading ? (
                  <Skeleton className="h-[200px] rounded-xl" />
                ) : (
                  <BudgetWidgetCompact />
                )}
              </AnimatePresence>
            </TabsContent>

            {/* Tab: Группа (Group) - объединенный контент */}
            <TabsContent value="group" className="mt-4 space-y-4">
              {/* Compact Hero Stats Card */}
              {pollsLoading ? (
                <Skeleton className="h-[90px] rounded-xl" />
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <PastelCard variant="default" className="relative overflow-hidden">

                    <CardContent className="relative p-4">
                      {/* Compact layout */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-1 mb-0.5">
                            <p className="text-xs text-muted-foreground">Всего голосов</p>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className={`${ICON_SIZES.xs} text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-help`} />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[200px]">
                                  <p className="text-xs">Общее количество голосов во всех завершенных голосованиях</p>
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <div className="text-3xl font-semibold text-foreground">
                            {stats?.totalVotes || 0}
                          </div>
                        </div>

                        {/* Mini stats grid */}
                        <div className="grid grid-cols-2 gap-3 text-right">
                          <div>
                            <p className="text-xs text-muted-foreground">Активных</p>
                            <p className="text-lg font-semibold text-mint-600 dark:text-mint-400">{stats?.activePolls || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Всего</p>
                            <p className="text-lg font-semibold text-primary">{stats?.totalPolls || 0}</p>
                          </div>
                        </div>
                      </div>

                      {/* Progress bar instead of sparkline */}
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <div className="relative h-2 rounded-full bg-muted/30 overflow-hidden cursor-help">
                              <motion.div
                                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                                initial={{ width: 0 }}
                                animate={{
                                  width: stats?.totalPolls
                                    ? `${Math.min((stats.activePolls / stats.totalPolls) * 100, 100)}%`
                                    : '0%',
                                }}
                                transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[220px]">
                            <p className="text-xs">
                              Активные голосования: {stats?.activePolls || 0} из {stats?.totalPolls || 0}
                            </p>
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.totalPolls
                          ? `${Math.round((stats.activePolls / stats.totalPolls) * 100)}% активных голосований`
                          : 'Нет данных'}
                      </p>
                    </CardContent>
                  </PastelCard>
                </motion.div>
              )}
                {/* Leaderboard - Top 10 users (Sprint 3.2) */}
                <AnimatePresence mode="wait">
                  {pollsLoading ? (
                    <Skeleton className="h-[600px] rounded-xl" />
                  ) : (
                    <Leaderboard isDark={isDark} onUserClick={(user) => {
                      // Запускаем confetti для топ-3
                      if (user.position === 1) {
                        confetti.fireworks(); // Фейерверк для первого места
                      } else if (user.position === 2) {
                        confetti.cannon(); // Пушка для второго
                      } else if (user.position === 3) {
                        confetti.stars(); // Звёзды для третьего
                      } else {
                        confetti.mini(); // Мини-конфетти для остальных
                      }
                    }} />
                  )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  {pollsLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-[320px] rounded-xl" />
                      <Skeleton className="h-[280px] rounded-xl" />
                    </div>
                  ) : (
                    <>
                    {/* Horizontal Carousel для графиков */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                    >
                      <div
                        ref={carouselRef}
                        onScroll={handleCarouselScroll}
                        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
                      >
                        {/* Chart 2: LineChart */}
                        <div className="min-w-[85vw] snap-center">
                          <PastelCard variant="default">
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <Flame className={`${ICON_SIZES.sm} text-primary`} />
                                  Динамика активности
                                </CardTitle>
                                <TooltipProvider>
                                  <UITooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className={`${ICON_SIZES.sm} text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-help`} />
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-[240px]">
                                      <p className="text-xs">Количество голосов пользователей за последние 7 дней. График помогает увидеть пики активности.</p>
                                    </TooltipContent>
                                  </UITooltip>
                                </TooltipProvider>
                              </div>
                              <CardDescription>Последние 7 дней</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={activityData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                  <defs>
                                     <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                       <stop offset="0%" stopColor="#D86A2C" />
                                       <stop offset="100%" stopColor="#8B5CF6" />
                                     </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} opacity={0.5} />
                                  <XAxis dataKey="date" fontSize={11} />
                                  <YAxis fontSize={11} />
                                  <Tooltip />
                                  <Line
                                    type="monotone"
                                    dataKey="votes"
                                    stroke="url(#lineGradient)"
                                    strokeWidth={3}
                                    dot={{ fill: isDark ? '#A78BFA' : '#ff6b6b', r: 4 }}
                                    activeDot={{ r: 6 }}
                                    animationDuration={800}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </PastelCard>
                        </div>
                      </div>

                      {/* Dots indicator */}
                      <div className="flex justify-center gap-2 mt-3">
                        {[0, 1].map((i) => (
                          <motion.div
                            key={i}
                            className={cn(
                              'h-1.5 rounded-full transition-all duration-300',
                               activeChartSlide === i ? 'bg-primary w-6' : 'bg-muted-foreground/30 w-1.5'
                            )}
                            onClick={() => {
                              if (carouselRef.current) {
                                const slideWidth = carouselRef.current.offsetWidth * 0.85 + 12; // width + gap
                                carouselRef.current.scrollTo({ left: i * slideWidth, behavior: 'smooth' });
                              }
                              haptic.light();
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>

                    {/* Expandable List - Топ-5 блюд */}
                    {popularItems.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.4 }}
                      >
                        <PastelCard variant="default">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Trophy className={`${ICON_SIZES.sm} text-accent`} />
                                Топ-5 популярных блюд
                              </CardTitle>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className={`${ICON_SIZES.sm} text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-help`} />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[220px]">
                                    <p className="text-xs">Самые популярные блюда по количеству полученных голосов во всех голосованиях</p>
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <CardDescription>По количеству голосов</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {popularItems.slice(0, 5).map((item, index) => {
                              const medals = ['🥇', '🥈', '🥉'];
                              const percentage = (item.voteCount / maxVotes) * 100;

                              return (
                                <motion.div
                                  key={item.id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.5 + index * 0.05, duration: 0.3 }}
                                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                                  onClick={() => haptic.light()}
                                >
                                  {/* Medal / Number */}
                                  <div
                                    className={cn(
                                      'size-8 rounded-full flex items-center justify-center font-bold flex-shrink-0',
                                       index < 3
                                         ? 'bg-primary/12 text-primary text-lg'
                                         : 'bg-muted/50 text-muted-foreground text-sm'
                                    )}
                                  >
                                    {index < 3 ? medals[index] : index + 1}
                                  </div>

                                  {/* Name */}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.winCount} побед</p>
                                  </div>

                                  {/* Progress bar + count */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="w-16 h-2 rounded-full bg-muted/50 overflow-hidden">
                                      <motion.div
                                        className="h-full rounded-full bg-primary"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ delay: 0.6 + index * 0.05, duration: 0.6, ease: 'easeOut' }}
                                      />
                                    </div>
                                    <span className="text-sm font-semibold min-w-[2.5ch] text-right">{item.voteCount}</span>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </CardContent>
                        </PastelCard>
                      </motion.div>
                    )}
                  </>
                )}
              </AnimatePresence>
            </TabsContent>

            {/* Tab: Глобально (Global) - старый контент Polls + Menu */}
            <TabsContent value="global" className="mt-4 space-y-4">
              {pollsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 rounded-lg" />
                  <Skeleton className="h-24 rounded-lg" />
                  <Skeleton className="h-24 rounded-lg" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Активные голосования */}
                  {groupedPolls.active.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                    >
                      <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                        <span className="size-2 bg-secondary rounded-full animate-pulse" />
                        Активные ({groupedPolls.active.length})
                      </h3>
                      <div className="space-y-3">
                        {groupedPolls.active.map((poll) => (
                          <PollCard key={poll.id} poll={poll} onViewResults={handleViewPollResults} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Завершённые голосования */}
                  {groupedPolls.completed.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.4 }}
                    >
                      <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                        <Calendar className={`${ICON_SIZES.sm} text-muted-foreground`} />
                        История ({groupedPolls.completed.length})
                      </h3>
                      <div className="space-y-3">
                        {groupedPolls.completed.slice(0, 10).map((poll) => (
                          <PollCard key={poll.id} poll={poll} onViewResults={handleViewPollResults} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Пустое состояние */}
                  {sortedPolls.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-12"
                    >
                      <Vote size={64} className="mx-auto mb-4 text-muted-foreground/30" />
                      <h3 className="text-lg font-semibold mb-2">Нет голосований</h3>
                      <p className="text-sm text-muted-foreground">Голосования появятся здесь после их создания</p>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Menu Stats Section (moved from old tab) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="grid grid-cols-2 gap-3"
              >
                {/* Всего блюд */}
                <PastelCard variant="default">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-secondary/20">
                        <Utensils className={`${ICON_SIZES.sm} text-secondary`} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{menuStats.total}</p>
                    <p className="text-xs text-muted-foreground">Всего блюд</p>
                  </CardContent>
                </PastelCard>

                {/* Активных */}
                <PastelCard variant="default">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-primary/20">
                        <Sparkles className={`${ICON_SIZES.sm} text-primary`} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{menuStats.active}</p>
                    <p className="text-xs text-muted-foreground">Активных</p>
                  </CardContent>
                </PastelCard>

                {/* Средняя цена */}
                <PastelCard variant="default">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-primary/20">
                        <Trophy className={`${ICON_SIZES.sm} text-primary`} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{(menuStats?.averagePrice ?? 0).toFixed(0)} ₽</p>
                    <p className="text-xs text-muted-foreground">Средняя цена</p>
                  </CardContent>
                </PastelCard>
              </motion.div>

            </TabsContent>

            {/* Tab: Инсайты (Insights) - Sprint 5 */}
            <TabsContent value="insights" className="mt-4 space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* Quick Stats Cards (2 columns) */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Favorite Dishes Card */}
                    <PastelCard variant="default" className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={cn(
                            'p-1.5 rounded-lg bg-gradient-to-br',
                            isDark
                              ? 'from-lavender-500/20 to-purple-500/20'
                              : 'from-peach-500/20 to-coral-500/20'
                          )}>
                            <ChefHat className={`${ICON_SIZES.sm} text-primary`} />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">Любимые</span>
                        </div>
                        {favoriteDishes.length > 0 ? (
                          <div className="space-y-1.5">
                            {favoriteDishes.slice(0, 3).map((dish, i) => (
                              <div key={dish.name} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                                <span className="text-xs font-medium truncate flex-1">{dish.name}</span>
                                <span className="text-xs text-muted-foreground">{dish.count}x</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Проголосуй, чтобы увидеть
                          </p>
                        )}
                      </CardContent>
                    </PastelCard>

                    {/* Stats Card */}
                    <PastelCard variant="default" className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={cn(
                            'p-1.5 rounded-lg bg-gradient-to-br',
                            isDark
                              ? 'from-mint-500/20 to-emerald-500/20'
                              : 'from-mint-500/20 to-green-500/20'
                          )}>
                            <TrendingUp className={`${ICON_SIZES.sm} text-secondary`} />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">Статистика</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Голосований</span>
                            <span className="text-sm font-bold">{quickStats.totalVotes}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Уникальных блюд</span>
                            <span className="text-sm font-bold">{quickStats.uniqueDishes}</span>
                          </div>
                          {quickStats.topDish && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Топ блюдо</span>
                              <span className="text-xs font-medium truncate max-w-[80px]">{quickStats.topDish}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </PastelCard>
                  </div>

                  {/* Personal Insights (moved from HomePage) */}
                  <InsightsCard insights={personalInsights} />

                  {/* Rotating Recommendations */}
                  <RecommendationsCard recommendations={recommendations} />

                  {/* Budget Insights Widget */}
                  <BudgetInsightsWidget />
                </motion.div>
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </>
  );
};
