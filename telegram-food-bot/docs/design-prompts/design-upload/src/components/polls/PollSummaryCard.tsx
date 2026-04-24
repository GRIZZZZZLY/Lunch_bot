import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { PastelCard, CardContent } from '../ui/pastel-card';
import { Button } from '../ui/button';
import { ConfettiAnimation } from './ConfettiAnimation';
import { WinnerCard } from './WinnerCard';
import { PollStatsBar } from './PollStatsBar';
import { ParticipantsList } from './ParticipantsList';
import { cn } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface PollSummaryData {
  pollId: number;
  winner: {
    dishName: string;
    dishImage?: string;
    voteCount: number;
    price: number;
  };
  stats: {
    participantCount: number;
    totalMembers: number;
    endedAt: string;
    duration: number;
  };
  responsiblePerson?: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
  };
  participants: Array<{
    id: number;
    firstName: string;
    lastName?: string;
    photoUrl?: string;
    dishName: string;
    dishPrice: number;
    dishEmoji?: string;
  }>;
  currentUserId?: number;
  userParticipated: boolean;
}

interface PollSummaryCardProps {
  data: PollSummaryData;
  className?: string;
}

/**
 * Сводка завершённого голосования
 * Показывается с конфетти при первом просмотре
 */
export const PollSummaryCard: React.FC<PollSummaryCardProps> = ({
  data,
  className,
}) => {
  const navigate = useNavigate();
  const [showConfetti, setShowConfetti] = useState(false);

  // Показываем конфетти только при первой загрузке
  useEffect(() => {
    const confettiKey = `poll_${data.pollId}_confetti_shown`;
    const hasShownConfetti = sessionStorage.getItem(confettiKey);
    
    if (!hasShownConfetti) {
      setShowConfetti(true);
      sessionStorage.setItem(confettiKey, 'true');
    }
  }, [data.pollId]);

  const handleViewDetails = () => {
    navigate(`/poll/${data.pollId}/results`);
  };

  return (
    <>
      {/* Конфетти анимация */}
      {showConfetti && <ConfettiAnimation duration={3000} />}

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className={cn('space-y-6', className)}
      >
        <PastelCard variant="sage" className="overflow-hidden">
          <CardContent className="p-6 pt-6 space-y-6">
            {/* Заголовок */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className={`${ICON_SIZES.lg} text-yellow-500`} />
                <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                  ГОЛОСОВАНИЕ ЗАВЕРШЕНО!
                </h2>
                <Sparkles className={`${ICON_SIZES.lg} text-yellow-500`} />
              </div>
            </motion.div>

            {/* Карточка победителя */}
            <WinnerCard
              dishName={data.winner.dishName}
              dishImage={data.winner.dishImage}
              voteCount={data.winner.voteCount}
              price={data.winner.price}
            />

            {/* Статистика */}
            <PollStatsBar
              participantCount={data.stats.participantCount}
              totalMembers={data.stats.totalMembers}
              endedAt={data.stats.endedAt}
              duration={data.stats.duration}
              responsiblePerson={data.responsiblePerson}
            />

            {/* Список участников */}
            {data.participants.length > 0 && (
              <ParticipantsList
                participants={data.participants}
                currentUserId={data.currentUserId}
                userParticipated={data.userParticipated}
              />
            )}

            {/* Сообщение и CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700"
            >
              {/* Сообщение */}
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {data.userParticipated ? '🍽️ Приятного аппетита!' : '😢 Вы не участвовали в голосовании :('}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {data.userParticipated 
                    ? 'Голосование на сегодня завершено. Приходите завтра за новым! 🌅'
                    : 'Не пропустите следующее голосование завтра! 📢'
                  }
                </p>
              </div>

              {/* Кнопка подробных результатов */}
              <Button
                onClick={handleViewDetails}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                size="lg"
              >
                <span>Подробные результаты</span>
                <ArrowRight className={`${ICON_SIZES.sm} ml-2`} />
              </Button>
            </motion.div>
          </CardContent>
        </PastelCard>
      </motion.div>
    </>
  );
};
