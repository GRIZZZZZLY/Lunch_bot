import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Award, 
  Calendar, 
  PieChart, 
  Heart,
  Target,
  Zap,
  Trophy
} from 'lucide-react';
import { PastelCard, CardContent, CardHeader, CardTitle } from '../components/ui/pastel-card';
import { GlassCard } from '../components/ui/glass-card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
// import { MediumWaveGradient } from '../components/background'; // REMOVED: убрали оранжевый градиент
import { useTelegram } from '../hooks/useTelegram';
import { useAuth } from '../hooks/useAuth';
import { pollsService } from '../services/polls.service';
import { cn } from '../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

export const UserStatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { backButton, colorScheme } = useTelegram();
  const { user } = useAuth();
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [favoriteItems, setFavoriteItems] = useState<any[]>([]);

  useEffect(() => {
    backButton.onClick(() => navigate('/'));
    backButton.show();

    loadUserStats();

    return () => {
      backButton.hide();
    };
  }, []);

  const loadUserStats = async () => {
    try {
      setLoading(true);
      console.log('📊 [UserStatsPage] Loading user stats...');
      const response = await pollsService.getUserParticipationStats();
      
      console.log('📥 [UserStatsPage] Response:', JSON.stringify({
        success: response.success,
        hasData: !!response.data,
        data: response.data,
        error: response.error
      }, null, 2));
      
      if (response.success && response.data) {
        setStats(response.data);
        setFavoriteItems(response.data.favoriteItems || []);
      } else {
        console.error('❌ [UserStatsPage] Failed to load stats:', response.error);
      }
    } catch (error) {
      console.error('❌ [UserStatsPage] Error loading user stats:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  const participationRate = stats?.participationRate || 0;
  const totalVotes = stats?.totalVotes || 0;
  const totalPolls = stats?.totalPolls || 0;

  return (
    <>
      {/* Background removed - using neutral bg-background from Layout */}

      <div className="space-y-6 relative pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Award className="text-lavender-500" size={28} />
            Моя статистика
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ваши предпочтения и активность в голосованиях
          </p>
        </motion.div>

        {/* Main Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4"
        >
          {/* Total Votes */}
          <GlassCard intensity="medium" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-peach-50 dark:bg-peach-900/20">
                <Zap className={`${ICON_SIZES.md} text-peach-500`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {totalVotes}
                </div>
                <div className="text-xs text-muted-foreground">
                  Голосов
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Total Polls */}
          <GlassCard intensity="medium" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-mint-50 dark:bg-mint-900/20">
                <Calendar className={`${ICON_SIZES.md} text-mint-500`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {totalPolls}
                </div>
                <div className="text-xs text-muted-foreground">
                  Голосований
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Participation Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard intensity="medium" className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-lavender-50 dark:bg-lavender-900/20">
                <Target className={`${ICON_SIZES.md} text-lavender-500`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">
                  Активность участия
                </h3>
                <div className="space-y-2">
                  <Progress value={participationRate} className="h-3" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {participationRate}% от всех голосований
                    </span>
                    <Badge variant={participationRate >= 80 ? 'default' : 'secondary'}>
                      {participationRate >= 80 ? '🔥 Активный' : '⚡ Участник'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Favorite Items */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Heart className={`${ICON_SIZES.md} text-peach-500`} />
            Любимые блюда
          </h2>

          <div className="space-y-3">
            {favoriteItems.length === 0 ? (
              <GlassCard intensity="medium" className="p-6">
                <div className="text-center text-muted-foreground">
                  <PieChart className={cn(ICON_SIZES.xl, "mx-auto mb-2 opacity-50")} />
                  <p className="text-sm">
                    Пока нет данных о любимых блюдах
                  </p>
                </div>
              </GlassCard>
            ) : (
              favoriteItems.map((item, index) => (
                <motion.div
                  key={item.itemId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <GlassCard intensity="medium" className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Rank badge */}
                        <div className={cn(
                          "flex items-center justify-center size-8 rounded-full font-bold text-sm",
                          index === 0 && "bg-gradient-to-br from-butter-500 to-butter-600 text-white",
                          index === 1 && "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700",
                          index === 2 && "bg-gradient-to-br from-orange-400 to-orange-500 text-white",
                          index > 2 && "bg-muted text-muted-foreground"
                        )}>
                          {index === 0 && <Trophy className={ICON_SIZES.sm} />}
                          {index !== 0 && (index + 1)}
                        </div>

                        {/* Item info */}
                        <div>
                          <p className="font-medium text-foreground">
                            {item.itemName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.voteCount} {item.voteCount === 1 ? 'голос' : 'голосов'}
                          </p>
                        </div>
                      </div>

                      {/* Percentage */}
                      <Badge variant="default" className="bg-gradient-to-r from-peach-500 to-peach-600 text-white">
                        {item.percentage}%
                      </Badge>
                    </div>
                  </GlassCard>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Achievements (placeholder for future) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <GlassCard intensity="medium" className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-butter-50 dark:bg-butter-900/20">
                <Trophy className={`${ICON_SIZES.md} text-butter-500`} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  Достижения
                </h3>
                <p className="text-sm text-muted-foreground">
                  Система достижений появится в следующем обновлении! 🎮
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </>
  );
};
