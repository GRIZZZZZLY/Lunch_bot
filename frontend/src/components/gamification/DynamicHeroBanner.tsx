/**
 * DynamicHeroBanner - Динамический баннер с геймификацией
 * 
 * Показывает разный контент для администратора и обычного пользователя
 * когда нет активного голосования
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Users,
  Flame,
  Star,
  Trophy,
  TrendingUp,
  Utensils,
  Crown,
  Medal,
  Sparkles,
  Check,
  ChevronDown,
  RefreshCw,
  Settings,
  Zap,
  RotateCcw,
  Coins,
} from 'lucide-react';

import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Skeleton } from '../ui/skeleton';
import { GlassCard, GlassCardContent } from '../ui/glass-card';
import { Progress } from '../ui/progress';

import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import { gamificationService } from '@/services/gamification.service';
import { useHaptic } from '@/hooks/useHaptic';
import type { User } from '@/hooks/useAuth';

import type { UserStats, GroupStats, QuestReward, UserRanking } from '@/types/gamification.types';

interface DynamicHeroBannerProps {
  user: User | null;
  onCreatePoll: () => void;
  onRepeatYesterday?: () => void;
  isRepeatLoading?: boolean;
  className?: string;
}

export const DynamicHeroBanner: React.FC<DynamicHeroBannerProps> = ({
  user,
  onCreatePoll,
  onRepeatYesterday,
  isRepeatLoading = false,
  className
}) => {
  const navigate = useNavigate();
  const haptic = useHaptic();
  
  // State
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [groupStats, setGroupStats] = useState<GroupStats | null>(null);
  const [todayRewards, setTodayRewards] = useState<QuestReward[]>([]);
  const [userRanking, setUserRanking] = useState<UserRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllCategories, setShowAllCategories] = useState(false);
  
  // Load data
  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);
  
  const loadData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      if (user.isAdmin) {
        // Для админа загружаем статистику группы
        const stats = await gamificationService.getGroupStats(user.id); // TODO: Использовать реальный groupId
        setGroupStats(stats);
      } else {
        // Для пользователя загружаем личную статистику
        const [stats, rewards, ranking] = await Promise.all([
          gamificationService.getUserStats(user.id),
          gamificationService.getTodayRewards(user.id),
          gamificationService.getUserRanking(user.id, 1) // TODO: Использовать реальный groupId
        ]);
        
        setUserStats(stats);
        setTodayRewards(rewards);
        setUserRanking(ranking);
      }
    } catch (error) {
      console.error('Failed to load gamification data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRefresh = () => {
    haptic.light();
    loadData();
  };
  
  // Если пользователь не загружен
  if (!user) {
    return (
      <GlassCard intensity="solid" className={className}>
        <GlassCardContent className="p-6 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-12 flex-1" />
            <Skeleton className="h-12 flex-1" />
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }
  
  if (loading) {
    return (
      <GlassCard intensity="solid" className={className}>
        <GlassCardContent className="p-6 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-12 flex-1" />
            <Skeleton className="h-12 flex-1" />
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }
  
  return (
    <GlassCard intensity="solid" className={cn("overflow-hidden", className)}>
      {user.isAdmin ? (
        <AdminBanner
          groupStats={groupStats!}
          onCreatePoll={onCreatePoll}
          onRepeatYesterday={onRepeatYesterday}
          isRepeatLoading={isRepeatLoading}
          onRefresh={handleRefresh}
          showAllCategories={showAllCategories}
          setShowAllCategories={setShowAllCategories}
        />
      ) : (
        <UserBanner
          user={user}
          userStats={userStats!}
          todayRewards={todayRewards}
          userRanking={userRanking!}
          onRefresh={handleRefresh}
        />
      )}
    </GlassCard>
  );
};

/**
 * Вариант для Администратора
 */
interface AdminBannerProps {
  groupStats: GroupStats;
  onCreatePoll: () => void;
  onRepeatYesterday?: () => void;
  isRepeatLoading: boolean;
  onRefresh: () => void;
  showAllCategories: boolean;
  setShowAllCategories: (show: boolean) => void;
}

const AdminBanner: React.FC<AdminBannerProps> = ({
  groupStats,
  onCreatePoll,
  onRepeatYesterday,
  isRepeatLoading,
  onRefresh,
  showAllCategories,
  setShowAllCategories
}) => {
  const navigate = useNavigate();
  const haptic = useHaptic();
  
  const categories = [
    {
      key: 'GASTRO',
      name: 'Гастрономия',
      icon: Utensils,
      color: 'peach',
      percentage: groupStats.avgGastroRating,
      topUser: groupStats.topGastro
    },
    {
      key: 'RESPONSIBLE',
      name: 'Ответственность',
      icon: Target,
      color: 'lavender',
      percentage: groupStats.avgResponsibleRating,
      topUser: groupStats.topResponsible
    },
    {
      key: 'SOCIAL',
      name: 'Социальность',
      icon: Users,
      color: 'mint',
      percentage: groupStats.avgSocialRating,
      topUser: groupStats.topSocial
    },
    {
      key: 'EXPLORER',
      name: 'Открытия',
      icon: Star,
      color: 'butter',
      percentage: groupStats.avgExplorerRating,
      topUser: groupStats.topExplorer
    }
  ];
  
  const visibleCategories = showAllCategories ? categories : categories.slice(0, 2);
  
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lavender-500 to-lavender-600 flex items-center justify-center">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Командный Прогресс Группы
            </h3>
            <p className="text-xs text-muted-foreground">
              Обновлено {new Date(groupStats.lastUpdated).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={onRefresh}
                className="w-8 h-8 rounded-lg hover:bg-muted transition-colors flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Обновить данные</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => navigate('/settings')}
                className="w-8 h-8 rounded-lg hover:bg-muted transition-colors flex items-center justify-center"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Настройки</TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      {/* Body */}
      <div className="flex flex-col md:flex-row">
        {/* Левая колонка: Краткая сводка */}
        <div className="flex flex-row md:flex-col justify-around md:justify-center items-center p-4 md:w-[30%] border-b md:border-b-0 md:border-r border-border/50 bg-muted/30 gap-4 md:gap-3">
          {/* Участники */}
          <div className="flex flex-col md:flex-row items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <div className="text-center md:text-left">
              <div className="text-2xl font-bold">{groupStats.totalMembers}</div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">участников</div>
            </div>
          </div>
          
          {/* Серия */}
          <div className="flex flex-col md:flex-row items-center gap-2">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [1, 0.8, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            >
              <Flame className="w-5 h-5 text-orange-500" />
            </motion.div>
            <div className="text-center md:text-left">
              <div className="text-2xl font-bold">{groupStats.groupStreak}</div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">дней подряд</div>
            </div>
          </div>
          
          {/* Средний уровень */}
          <div className="flex flex-col md:flex-row items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            <div className="text-center md:text-left">
              <div className="text-2xl font-bold">Lvl {groupStats.averageLevel}</div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">средний</div>
            </div>
          </div>
        </div>
        
        {/* Правая колонка: Многомерный рейтинг */}
        <div className="p-4 md:w-[70%] space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">
            Многомерный Рейтинг Группы
          </h4>
          
          <div className="space-y-3">
            <AnimatePresence mode="wait">
              {visibleCategories.map((category, index) => (
                <CategoryProgress
                  key={category.key}
                  category={category}
                  index={index}
                />
              ))}
            </AnimatePresence>
          </div>
          
          {/* Кнопка показать все */}
          {categories.length > 2 && (
            <button
              onClick={() => {
                haptic.light();
                setShowAllCategories(!showAllCategories);
              }}
              className="text-xs text-primary hover:underline flex items-center gap-1 ml-6 mt-2"
            >
              <ChevronDown 
                className={cn(
                  "w-3 h-3 transition-transform",
                  showAllCategories && "rotate-180"
                )} 
              />
              {showAllCategories ? 'Скрыть' : `Показать все категории (${categories.length})`}
            </button>
          )}
        </div>
      </div>
      
      {/* Footer: Действия */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-t border-border/50 bg-background">
        <Button
          size="lg"
          variant="lavender"
          shimmer
          onClick={() => {
            haptic.impact();
            onCreatePoll();
          }}
          className="flex-1 h-12"
        >
          <Zap className="w-5 h-5 mr-2" />
          Создать голосование
        </Button>
        
        {onRepeatYesterday && (
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              haptic.impact();
              onRepeatYesterday();
            }}
            disabled={isRepeatLoading}
            className="flex-1 h-12"
          >
            {isRepeatLoading ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Создание...
              </>
            ) : (
              <>
                <RotateCcw className="w-5 h-5 mr-2" />
                Повторить вчерашнее
              </>
            )}
          </Button>
        )}
      </div>
    </>
  );
};

/**
 * Компонент прогресса категории
 */
interface CategoryProgressProps {
  category: any;
  index: number;
}

const CategoryProgress: React.FC<CategoryProgressProps> = ({ category, index }) => {
  const Icon = category.icon;
  
  const colorClasses = {
    peach: {
      text: 'text-peach-500',
      bg: 'from-peach-500 to-peach-600'
    },
    lavender: {
      text: 'text-lavender-500',
      bg: 'from-lavender-500 to-lavender-600'
    },
    mint: {
      text: 'text-mint-500',
      bg: 'from-mint-500 to-mint-600'
    },
    butter: {
      text: 'text-butter-500',
      bg: 'from-butter-500 to-butter-600'
    }
  };
  
  const colors = colorClasses[category.color as keyof typeof colorClasses];
  
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ delay: index * 0.1 }}
          className="space-y-1 cursor-pointer hover:bg-muted/50 rounded-lg p-2 transition-all"
        >
          {/* Название и процент */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Icon className={cn("w-4 h-4", colors.text)} />
              <span className="font-medium">{category.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">{category.percentage}%</span>
          </div>
          
          {/* Прогресс-бар */}
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${category.percentage}%` }}
              transition={{ duration: 1, delay: index * 0.1, ease: 'easeOut' }}
              className={cn("absolute h-full rounded-full bg-gradient-to-r", colors.bg)}
            />
          </div>
          
          {/* Топ участник */}
          {category.topUser && (
            <div className="flex items-center gap-2 ml-6 mt-1">
              <Crown className="w-3 h-3 text-yellow-500" />
              <Avatar className="w-5 h-5">
                {category.topUser.photoUrl && (
                  <AvatarImage src={category.topUser.photoUrl} alt={category.topUser.firstName} />
                )}
                <AvatarFallback className="text-[8px]">
                  {getInitials(category.topUser.firstName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {category.topUser.firstName} {category.topUser.lastName?.[0]}. · Lvl {category.topUser.level} · {category.topUser.xp.toLocaleString()} XP
              </span>
            </div>
          )}
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="space-y-2">
          <h4 className="font-semibold flex items-center gap-2">
            <Icon className="w-4 h-4" />
            {category.name}
          </h4>
          <p className="text-xs text-muted-foreground">
            Рейтинг основан на активности группы в этой категории
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

/**
 * Вариант для Обычного Пользователя
 */
interface UserBannerProps {
  user: User;
  userStats: UserStats;
  todayRewards: QuestReward[];
  userRanking: UserRanking;
  onRefresh: () => void;
}

const UserBanner: React.FC<UserBannerProps> = ({
  user,
  userStats,
  todayRewards,
  userRanking,
  onRefresh
}) => {
  const navigate = useNavigate();
  const haptic = useHaptic();
  
  const levelProgress = gamificationService.calculateLevelProgress(userStats.totalXP);
  const xpToTop3 = 450; // Mock данные TODO: Рассчитывать реально
  
  return (
    <>
      {/* Header с рейтингом */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-10 h-10 ring-2 ring-primary/20">
              {user.photoUrl && <AvatarImage src={user.photoUrl} alt={user.firstName} />}
              <AvatarFallback className={getAvatarColor(user.firstName)}>
                {getInitials(user.firstName)}
              </AvatarFallback>
            </Avatar>
            {/* Уровень badge */}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-lavender-500 to-lavender-600 flex items-center justify-center text-[10px] font-bold text-white border-2 border-background">
              {levelProgress.currentLevel}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Твой Прогресс
            </h3>
            <p className="text-xs text-muted-foreground">
              Продолжай в том же духе! 💪
            </p>
          </div>
        </div>
        
        {/* Позиция в рейтинге */}
        <div className="text-right">
          <div className="flex items-center gap-2 text-lg font-bold">
            <span className="text-muted-foreground">#{userRanking.rank}</span>
            <span className="text-xs text-muted-foreground">из {userRanking.totalRank}</span>
            {userRanking.change !== 0 && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={cn(
                  "flex items-center gap-1",
                  userRanking.change > 0 ? "text-green-500" : "text-red-500"
                )}
              >
                <TrendingUp className={cn(
                  "w-4 h-4",
                  userRanking.change < 0 && "rotate-180"
                )} />
                <span className="text-sm">{Math.abs(userRanking.change)}</span>
              </motion.div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {userRanking.change > 0 ? 'места сегодня' : userRanking.change < 0 ? 'мест вниз' : 'без изменений'}
          </p>
        </div>
      </div>
      
      {/* Progress Section */}
      <div className="p-4 space-y-3 bg-gradient-to-br from-muted/30 to-transparent">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Уровень {levelProgress.currentLevel}</span>
            <span className="text-muted-foreground">
              {userStats.totalXP.toLocaleString()} / {levelProgress.nextLevelXP.toLocaleString()} XP
            </span>
          </div>
          
          {/* XP прогресс-бар */}
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${levelProgress.percentage}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="absolute h-full bg-gradient-to-r from-lavender-500 via-lavender-600 to-mint-500 rounded-full"
              style={{
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)'
              }}
            />
            {/* Процент внутри */}
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
              {levelProgress.percentage}%
            </div>
          </div>
        </div>
        
        {/* Метрики */}
        <div className="flex items-center justify-between text-sm">
          {/* Серия */}
          <div className="flex items-center gap-2">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [1, 0.8, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            >
              <Flame className="w-4 h-4 text-orange-500" />
            </motion.div>
            <span className="text-muted-foreground">
              Серия: <span className="font-bold text-foreground">{userStats.currentStreak} дн</span>
            </span>
          </div>
          
          {/* Разделитель */}
          <div className="w-px h-4 bg-border" />
          
          {/* До топ-3 */}
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-500" />
            <span className="text-muted-foreground">
              До топ-3: <span className="font-bold text-primary">{xpToTop3} XP</span>
            </span>
          </div>
        </div>
      </div>
      
      {/* Rewards List */}
      <div className="px-4 py-3 space-y-2 bg-muted/10">
        <div className="flex items-center gap-2 mb-2">
          <Coins className="w-4 h-4 text-yellow-500" />
          <h4 className="text-sm font-semibold text-foreground">
            Заработай сегодня:
          </h4>
        </div>
        
        <div className="space-y-1">
          {todayRewards.map((reward, index) => (
            <RewardItem key={reward.id} reward={reward} index={index} />
          ))}
        </div>
      </div>
      
      {/* Footer: Действия */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-t border-border/50 bg-background">
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            haptic.impact();
            navigate('/quests');
          }}
          className="flex-1 h-12 relative"
        >
          <Target className="w-5 h-5 mr-2" />
          <span>Мои квесты</span>
          <Badge
            variant="default"
            className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-500 to-blue-600"
          >
            2/5
          </Badge>
        </Button>
        
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            haptic.impact();
            navigate('/achievements');
          }}
          className="flex-1 h-12 relative"
        >
          <Trophy className="w-5 h-5 mr-2" />
          <span>Достижения</span>
          <Badge
            variant="secondary"
            className="absolute -top-2 -right-2"
          >
            12/45
          </Badge>
        </Button>
      </div>
    </>
  );
};

/**
 * Компонент награды
 */
interface RewardItemProps {
  reward: QuestReward;
  index: number;
}

const RewardItem: React.FC<RewardItemProps> = ({ reward, index }) => {
  const haptic = useHaptic();
  
  const colorClasses = {
    green: {
      bg: 'from-green-500 to-green-600',
      text: 'text-green-600 dark:text-green-400'
    },
    mint: {
      bg: 'from-mint-500 to-mint-600',
      text: 'text-mint-600 dark:text-mint-400'
    },
    orange: {
      bg: 'from-orange-500 to-orange-600',
      text: 'text-orange-600 dark:text-orange-400'
    },
    lavender: {
      bg: 'from-lavender-500 to-lavender-600',
      text: 'text-lavender-600 dark:text-lavender-400'
    },
    blue: {
      bg: 'from-blue-500 to-blue-600',
      text: 'text-blue-600 dark:text-blue-400'
    }
  };
  
  const colors = colorClasses[reward.color];
  
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.1 + index * 0.1 }}
      onClick={() => haptic.light()}
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer group",
        "hover:bg-muted/50"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br",
        colors.bg,
        reward.color === 'orange' && "animate-pulse"
      )}>
        <span className="text-lg">{reward.icon}</span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {reward.title}
        </div>
        {reward.description && (
          <div className="text-xs text-muted-foreground truncate">
            {reward.description}
          </div>
        )}
      </div>
      
      <div className={cn("flex items-center gap-1 text-sm font-bold", colors.text)}>
        <Sparkles className="w-4 h-4" />
        <span>+{reward.xpAmount} XP</span>
      </div>
    </motion.div>
  );
};
