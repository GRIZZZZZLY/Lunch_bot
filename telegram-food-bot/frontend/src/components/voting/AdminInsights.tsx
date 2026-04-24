import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Users, 
  Clock,
  AlertCircle,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { PollWithDetails, Vote } from '../../services/polls.service';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '../ui/glass-card';
import { cn } from '../../lib/utils';
import { ICON_SIZES } from '../../lib/design-tokens';

interface AdminInsightsProps {
  poll: PollWithDetails;
  totalMembers?: number;
}

/**
 * AdminInsights - Аналитика и insights для админов
 * 
 * Показывает:
 * - Кто уже проголосовал (список)
 * - Кто еще не проголосовал
 * - Скорость голосования
 * - Тренды и паттерны
 */
export const AdminInsights = ({
  poll,
  totalMembers = 15, // default значение
}: AdminInsightsProps) => {
  // Подсчет метрик
  const votedCount = poll._count?.votes || poll.votes?.length || 0;
  const notVotedCount = totalMembers - votedCount;
  const participationRate = Math.round((votedCount / totalMembers) * 100);
  
  // Время с начала голосования
  const startTime = new Date(poll.createdAt);
  const now = new Date();
  const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / 1000 / 60);
  
  // Скорость голосования (голосов в минуту)
  const votingSpeed = elapsedMinutes > 0 ? (votedCount / elapsedMinutes).toFixed(2) : '0';
  
  // Список проголосовавших (берем первых 10 для отображения)
  const voters = poll.votes?.slice(0, 10) || [];
  
  // Оценка участия
  const getParticipationStatus = () => {
    if (participationRate >= 80) return { text: 'Отличное', color: 'text-mint-600 dark:text-mint-400', bg: 'bg-mint-50 dark:bg-mint-900/10' };
    if (participationRate >= 60) return { text: 'Хорошее', color: 'text-peach-600 dark:text-peach-400', bg: 'bg-peach-50 dark:bg-peach-900/10' };
    if (participationRate >= 40) return { text: 'Среднее', color: 'text-butter-600 dark:text-butter-400', bg: 'bg-butter-50 dark:bg-butter-900/10' };
    return { text: 'Низкое', color: 'text-coral-600 dark:text-coral-400', bg: 'bg-coral-50 dark:bg-coral-900/10' };
  };
  
  const participationStatus = getParticipationStatus();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-4"
    >
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Участие */}
        <GlassCard className="border border-lavender-200 dark:border-lavender-800">
          <GlassCardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className={`${ICON_SIZES.md} text-lavender-500`} />
              <span className="text-xs text-gray-600 dark:text-gray-400">Участие</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {participationRate}%
            </div>
            <div className={cn("text-xs mt-1 px-2 py-0.5 rounded inline-block", participationStatus.bg, participationStatus.color)}>
              {participationStatus.text}
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Скорость */}
        <GlassCard className="border border-mint-200 dark:border-mint-800">
          <GlassCardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className={`${ICON_SIZES.md} text-mint-500`} />
              <span className="text-xs text-gray-600 dark:text-gray-400">Скорость</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {votingSpeed}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              голосов/мин
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Проголосовали */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`${ICON_SIZES.md} text-mint-500`} />
              Проголосовали
            </div>
            <span className="text-sm font-normal text-mint-600 dark:text-mint-400">
              {votedCount} из {totalMembers}
            </span>
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          {voters.length > 0 ? (
            <div className="space-y-2">
              {voters.map((vote: Vote) => (
                <div 
                  key={vote.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="flex items-center gap-2">
                    <div className={`${ICON_SIZES.xl} rounded-full bg-gradient-to-br from-mint-400 to-mint-500 flex items-center justify-center text-white text-xs font-bold`}>
                      {vote.user?.firstName?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {vote.user?.firstName || 'Unknown'} {vote.user?.lastName || ''}
                      </div>
                      {vote.user?.username && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          @{vote.user.username}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-mint-600 dark:text-mint-400">
                    {vote.menuItem?.name || 'Выбор'}
                  </div>
                </div>
              ))}
              
              {poll.votes && poll.votes.length > 10 && (
                <div className="text-center text-sm text-gray-600 dark:text-gray-400 pt-2">
                  + еще {poll.votes.length - 10} человек
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              Пока никто не проголосовал
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Непроголосовавшие */}
      {notVotedCount > 0 && (
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className={`${ICON_SIZES.md} text-butter-500`} />
                Еще не проголосовали
              </div>
              <span className="text-sm font-normal text-butter-600 dark:text-butter-400">
                {notVotedCount} человек
              </span>
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="p-3 rounded-lg bg-butter-50 dark:bg-butter-900/10">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {notVotedCount === 1 
                  ? '1 человек еще не проголосовал' 
                  : `${notVotedCount} человек еще не проголосовали`}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Можете отправить им напоминание
              </p>
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Insights */}
      <GlassCard className="border border-gold-200 dark:border-gold-800">
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <TrendingUp className={`${ICON_SIZES.md} text-gold-500`} />
            Insights
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-2 text-sm">
            {/* Время с начала */}
            <div className="flex items-start gap-2">
              <Clock className={`${ICON_SIZES.sm} text-gray-400 flex-shrink-0 mt-0.5`} />
              <div>
                <span className="text-gray-900 dark:text-white font-medium">Прошло:</span>{' '}
                <span className="text-gray-600 dark:text-gray-400">{elapsedMinutes} мин с начала</span>
              </div>
            </div>

            {/* Средняя скорость */}
            <div className="flex items-start gap-2">
              <Activity className={`${ICON_SIZES.sm} text-gray-400 flex-shrink-0 mt-0.5`} />
              <div>
                <span className="text-gray-900 dark:text-white font-medium">Скорость:</span>{' '}
                <span className="text-gray-600 dark:text-gray-400">
                  {parseFloat(votingSpeed) >= 0.5 ? 'Активная' : 'Медленная'}
                </span>
              </div>
            </div>

            {/* Прогноз участия */}
            {elapsedMinutes > 5 && (
              <div className="flex items-start gap-2">
                <TrendingUp className={`${ICON_SIZES.sm} text-gray-400 flex-shrink-0 mt-0.5`} />
                <div>
                  <span className="text-gray-900 dark:text-white font-medium">Прогноз:</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">
                    {participationRate >= 50 
                      ? 'Хорошее участие ожидается' 
                      : 'Стоит напомнить пользователям'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
};
