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
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardDescription, GlassCardContent } from '../components/ui/glass-card';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { MediumWaveGradient } from '../components/background';

// Stats components
import { CustomTooltip, CountUp } from '../components/stats';

// Old components (for polls list)
import { PollCard } from '../components/polls/PollCard';
import { PollResults } from '../components/polls/PollResults';

// Hooks & Services
import { useTelegram } from '../hooks/useTelegram';
import { useHaptic } from '../hooks/useHaptic';
import { usePolls, useUI, useMenu } from '../store/useAppStore';
import { pollsService, Poll, PollStats, PopularItem } from '../services/polls.service';
import { menuService } from '../services/menu.service';
import { cn } from '../lib/utils';

// Chart colors (mint/lavender/butter/peach/coral palette)
const CHART_COLORS = {
  mint: ['#10b981', '#6ee7b7', '#34d399', '#059669', '#047857'],
  lavender: ['#a78bfa', '#c4b5fd', '#8b5cf6', '#7c3aed', '#6d28d9'],
  butter: ['#fbbf24', '#fcd34d', '#f59e0b', '#d97706', '#b45309'],
  peach: ['#fb923c', '#fdba74', '#f97316', '#ea580c', '#c2410c'],
  coral: ['#f87171', '#fca5a5', '#ef4444', '#dc2626', '#b91c1c'],
};

type ViewMode = 'overview' | 'results';

/**
 * StatsPage v2.1 - Mobile-Optimized Analytics Hub
 * UX improvements: compact hero, carousel charts, expandable lists
 */
export const StatsPage: React.FC = () => {
  const { backButton, colorScheme } = useTelegram();
  const { addNotification } = useUI();
  const { menuItems, setMenuItems } = useMenu();
  const haptic = useHaptic();

  const isDark = colorScheme === 'dark';

  const {
    polls,
    pollsLoading,
    setPolls,
    setPollsLoading,
  } = usePolls();

  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [stats, setStats] = useState<PollStats | null>(null);
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'polls' | 'menu'>('overview');
  const [activeChartSlide, setActiveChartSlide] = useState(0);

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
        setPolls(pollsResponse.data);
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

  // Category data для PieChart
  const categoryData = useMemo(() => {
    if (!menuItems || menuItems.length === 0) {
      return [
        { name: 'Супы', value: 8, color: CHART_COLORS.mint[0] },
        { name: 'Салаты', value: 5, color: CHART_COLORS.lavender[0] },
        { name: 'Горячее', value: 12, color: CHART_COLORS.butter[0] },
        { name: 'Десерты', value: 4, color: CHART_COLORS.peach[0] },
        { name: 'Напитки', value: 3, color: CHART_COLORS.coral[0] },
      ];
    }

    const categoryCounts: Record<string, number> = {};
    menuItems.forEach((item) => {
      const category = item.category || 'Другое';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    const colors = [
      CHART_COLORS.mint[0],
      CHART_COLORS.lavender[0],
      CHART_COLORS.butter[0],
      CHART_COLORS.peach[0],
      CHART_COLORS.coral[0],
    ];

    return Object.entries(categoryCounts)
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [menuItems]);

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
        categories: 0,
        averagePrice: 0,
      };
    }

    const active = menuItems.filter((item) => item.isActive).length;
    const categories = new Set(menuItems.map((item) => item.category).filter(Boolean)).size;
    const totalPrice = menuItems.reduce((sum, item) => sum + (item.price || 0), 0);
    const averagePrice = menuItems.length > 0 ? totalPrice / menuItems.length : 0;

    return {
      total: menuItems.length,
      active,
      categories,
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
      {/* Animated gradient background - full page */}
      <MediumWaveGradient />
      
      {/* Compact Header - Sticky */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-11 px-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-lavender-500" />
            <h1 className="text-lg font-semibold">Статистика</h1>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="space-y-4 pb-24 px-4 pt-4">
        {/* Compact Hero Stats Card - 90px */}
        {pollsLoading ? (
          <Skeleton className="h-[90px] rounded-xl" />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <GlassCard intensity="medium" hover className="relative overflow-hidden">
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-lavender-500/20 to-mint-500/20" />

              <GlassCardContent className="relative p-4">
                {/* Compact layout */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Всего голосов</p>
                    <div className="text-3xl font-bold bg-gradient-to-r from-lavender-600 to-mint-600 bg-clip-text text-transparent">
                      <CountUp end={stats?.totalVotes || 0} duration={1.5} />
                    </div>
                  </div>

                  {/* Mini stats grid */}
                  <div className="grid grid-cols-2 gap-3 text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">Активных</p>
                      <p className="text-lg font-bold text-mint-600 dark:text-mint-400">{stats?.activePolls || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Всего</p>
                      <p className="text-lg font-bold text-lavender-600 dark:text-lavender-400">{stats?.totalPolls || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Progress bar instead of sparkline */}
                <div className="relative h-2 rounded-full bg-muted/30 overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-lavender-500 to-mint-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: stats?.totalPolls
                        ? `${Math.min((stats.activePolls / stats.totalPolls) * 100, 100)}%`
                        : '0%',
                    }}
                    transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.totalPolls
                    ? `${Math.round((stats.activePolls / stats.totalPolls) * 100)}% активных голосований`
                    : 'Нет данных'}
                </p>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}

        {/* Tabs Navigation - 56px (двустрочные) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Tabs
            value={activeTab}
            onValueChange={(value: any) => {
              setActiveTab(value);
              haptic.light();
            }}
          >
            <TabsList className="w-full grid grid-cols-3 h-14 bg-muted/50 backdrop-blur-sm">
              <TabsTrigger
                value="overview"
                className={cn(
                  'flex flex-col gap-1 py-2',
                  'data-[state=active]:bg-gradient-to-r data-[state=active]:from-lavender-500 data-[state=active]:to-mint-500',
                  'data-[state=active]:text-white data-[state=active]:shadow-md',
                  'transition-all duration-200'
                )}
              >
                <TrendingUp className="size-5" />
                <span className="text-xs font-medium">Обзор</span>
              </TabsTrigger>
              <TabsTrigger
                value="polls"
                className={cn(
                  'flex flex-col gap-1 py-2',
                  'data-[state=active]:bg-gradient-to-r data-[state=active]:from-lavender-500 data-[state=active]:to-mint-500',
                  'data-[state=active]:text-white data-[state=active]:shadow-md',
                  'transition-all duration-200'
                )}
              >
                <Vote className="size-5" />
                <span className="text-xs font-medium">Голоса</span>
              </TabsTrigger>
              <TabsTrigger
                value="menu"
                className={cn(
                  'flex flex-col gap-1 py-2',
                  'data-[state=active]:bg-gradient-to-r data-[state=active]:from-lavender-500 data-[state=active]:to-mint-500',
                  'data-[state=active]:text-white data-[state=active]:shadow-md',
                  'transition-all duration-200'
                )}
              >
                <Utensils className="size-5" />
                <span className="text-xs font-medium">Меню</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab: Обзор */}
            <TabsContent value="overview" className="mt-4 space-y-4">
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
                        {/* Chart 1: PieChart */}
                        <div className="min-w-[85vw] snap-center">
                          <GlassCard intensity="low">
                            <GlassCardHeader>
                              <GlassCardTitle className="text-base flex items-center gap-2">
                                <ChefHat className="size-4 text-mint-500" />
                                Категории блюд
                              </GlassCardTitle>
                              <GlassCardDescription>Топ-5 в меню</GlassCardDescription>
                            </GlassCardHeader>
                            <GlassCardContent>
                              <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                  <Pie
                                    data={categoryData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={75}
                                    paddingAngle={5}
                                    animationDuration={800}
                                    label={false}
                                  >
                                    {categoryData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip content={<CustomTooltip formatter={(value) => `${value} блюд`} />} />
                                </PieChart>
                              </ResponsiveContainer>

                              {/* Touch-friendly Legend */}
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                {categoryData.map((cat, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                                    onClick={() => haptic.light()}
                                  >
                                    <div className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{cat.name}</p>
                                      <p className="text-xs text-muted-foreground">{cat.value} блюд</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </GlassCardContent>
                          </GlassCard>
                        </div>

                        {/* Chart 2: LineChart */}
                        <div className="min-w-[85vw] snap-center">
                          <GlassCard intensity="low">
                            <GlassCardHeader>
                              <GlassCardTitle className="text-base flex items-center gap-2">
                                <Flame className="size-4 text-lavender-500" />
                                Динамика активности
                              </GlassCardTitle>
                              <GlassCardDescription>Последние 7 дней</GlassCardDescription>
                            </GlassCardHeader>
                            <GlassCardContent>
                              <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={activityData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                  <defs>
                                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                      <stop offset="0%" stopColor="#a78bfa" />
                                      <stop offset="100%" stopColor="#6ee7b7" />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} opacity={0.5} />
                                  <XAxis dataKey="date" fontSize={11} />
                                  <YAxis fontSize={11} />
                                  <Tooltip content={<CustomTooltip formatter={(value) => `${value} голосов`} />} />
                                  <Line
                                    type="monotone"
                                    dataKey="votes"
                                    stroke="url(#lineGradient)"
                                    strokeWidth={3}
                                    dot={{ fill: '#a78bfa', r: 4 }}
                                    activeDot={{ r: 6 }}
                                    animationDuration={800}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </GlassCardContent>
                          </GlassCard>
                        </div>
                      </div>

                      {/* Dots indicator */}
                      <div className="flex justify-center gap-2 mt-3">
                        {[0, 1].map((i) => (
                          <motion.div
                            key={i}
                            className={cn(
                              'h-1.5 rounded-full transition-all duration-300',
                              activeChartSlide === i ? 'bg-lavender-500 w-6' : 'bg-muted-foreground/30 w-1.5'
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
                        <GlassCard intensity="low">
                          <GlassCardHeader>
                            <GlassCardTitle className="text-base flex items-center gap-2">
                              <Trophy className="size-4 text-mint-500" />
                              Топ-5 популярных блюд
                            </GlassCardTitle>
                            <GlassCardDescription>По количеству голосов</GlassCardDescription>
                          </GlassCardHeader>
                          <GlassCardContent className="space-y-2">
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
                                        ? 'bg-gradient-to-br from-mint-500/20 to-mint-600/20 text-lg'
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
                                        className="h-full bg-gradient-to-r from-mint-500 to-mint-600 rounded-full"
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
                          </GlassCardContent>
                        </GlassCard>
                      </motion.div>
                    )}
                  </>
                )}
              </AnimatePresence>
            </TabsContent>

            {/* Tab: Голосования */}
            <TabsContent value="polls" className="mt-4 space-y-4">
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
                        <span className="size-2 bg-mint-500 rounded-full animate-pulse" />
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
                        <Calendar className="size-4 text-muted-foreground" />
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
            </TabsContent>

            {/* Tab: Меню */}
            <TabsContent value="menu" className="mt-4 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="grid grid-cols-2 gap-3"
              >
                {/* Всего блюд */}
                <GlassCard intensity="low" hover>
                  <GlassCardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-mint-500/20">
                        <Utensils className="size-4 text-mint-600 dark:text-mint-400" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{menuStats.total}</p>
                    <p className="text-xs text-muted-foreground">Всего блюд</p>
                  </GlassCardContent>
                </GlassCard>

                {/* Активных */}
                <GlassCard intensity="low" hover>
                  <GlassCardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-lavender-500/20">
                        <Sparkles className="size-4 text-lavender-600 dark:text-lavender-400" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{menuStats.active}</p>
                    <p className="text-xs text-muted-foreground">Активных</p>
                  </GlassCardContent>
                </GlassCard>

                {/* Категорий */}
                <GlassCard intensity="low" hover>
                  <GlassCardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-butter-500/20">
                        <ChefHat className="size-4 text-butter-600 dark:text-butter-400" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{menuStats.categories}</p>
                    <p className="text-xs text-muted-foreground">Категорий</p>
                  </GlassCardContent>
                </GlassCard>

                {/* Средняя цена */}
                <GlassCard intensity="low" hover>
                  <GlassCardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-peach-500/20">
                        <Trophy className="size-4 text-peach-600 dark:text-peach-400" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{menuStats.averagePrice.toFixed(0)} ₽</p>
                    <p className="text-xs text-muted-foreground">Средняя цена</p>
                  </GlassCardContent>
                </GlassCard>
              </motion.div>

              {/* Category breakdown */}
              {categoryData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                >
                  <GlassCard intensity="low">
                    <GlassCardHeader>
                      <GlassCardTitle className="text-base">Блюда по категориям</GlassCardTitle>
                    </GlassCardHeader>
                    <GlassCardContent className="space-y-3">
                      {categoryData.map((category) => (
                        <div
                          key={category.name}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => haptic.light()}
                        >
                          <div className="flex items-center gap-2">
                            <div className="size-3 rounded-full" style={{ backgroundColor: category.color }} />
                            <span className="text-sm font-medium">{category.name}</span>
                          </div>
                          <Badge variant="secondary">{category.value}</Badge>
                        </div>
                      ))}
                    </GlassCardContent>
                  </GlassCard>
                </motion.div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </>
  );
};
