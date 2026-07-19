import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { GlassHeroCard } from '../components/glass/GlassCard';
// import { MediumWaveGradient } from '../components/background'; // REMOVED: убрали оранжевый градиент
import { useTimeBasedGradient } from '../hooks/useTimeBasedGradient';
import { useTelegram } from '../hooks/useTelegram';
import { useUI } from '../store/useAppStore';
import { pollsService, MultiWinnerResultData } from '../services/polls.service';
import { MultiWinnerResults } from '../components/voting/MultiWinnerResults';
import { SingleWinnerResults } from '../components/voting/SingleWinnerResults';
import { ICON_SIZES } from '@/lib/design-tokens';

/**
 * Страница отображения результатов голосования
 * Автоматически определяет тип (single-winner или multi-winner) и рендерит соответствующий компонент
 */
export const PollResultsPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const { backButton, colorScheme } = useTelegram();
  const { addNotification } = useUI();

  const isDark = colorScheme === 'dark';
  const { from, to, textColor } = useTimeBasedGradient(isDark);

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [resultType, setResultType] = useState<'single' | 'multi'>('single');
  const [multiWinnerData, setMultiWinnerData] = useState<MultiWinnerResultData | null>(null);

  const loadResults = useCallback(async () => {
    try {
      setLoading(true);

      if (!pollId) {
        throw new Error('Poll ID is missing');
      }

      const response = await pollsService.getPollResults(parseInt(pollId));

      if (!response.success || !response.data) {
        throw new Error('Results not found');
      }

      const pollResult = response.data.result;
      setResult(pollResult);
      setBreakdown(response.data.breakdown);

      // Определяем тип результата
      try {
        const rouletteData = (pollResult as any).rouletteData ? JSON.parse((pollResult as any).rouletteData) : null;

        if (rouletteData && rouletteData.mode === 'multi-winner' && rouletteData.version === 1) {
          setResultType('multi');
          setMultiWinnerData(rouletteData);
        } else {
          setResultType('single');
        }
      } catch (parseError) {
        console.error('Error parsing rouletteData:', parseError);
        setResultType('single');
      }

    } catch (error) {
      console.error('Error loading results:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка загрузки результатов',
      });
    } finally {
      setLoading(false);
    }
  }, [addNotification, pollId]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  useEffect(() => {
    const handleBack = () => navigate('/');
    backButton.onClick(handleBack);
    backButton.show();

    return () => {
      backButton.offClick?.(handleBack);
      backButton.hide();
    };
  }, [backButton, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen relative">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Результаты не найдены
          </p>
          <button type="button"
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-peach-500 to-coral-500 text-white rounded-xl hover:shadow-lg transition-all"
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  const totalVotes = result.totalVotes || 0;

  return (
    <>
      {/* Background removed - using neutral bg-background from Layout */}

      <div className="min-h-screen pb-24">
        {/* Hero Card */}
        <m.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <GlassHeroCard
            gradient={{ from, to }}
            value={totalVotes.toString()}
            label="Результаты голосования"
            sublabel={resultType === 'multi' ? 'Распределение по группам' : 'Single Winner'}
            textColor={textColor}
            icon={<TrendingUp className={ICON_SIZES.lg} />}
          />
        </m.div>

        {/* Back Button (альтернативный вариант) */}
        <m.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className={ICON_SIZES.md} />
          <span>На главную</span>
        </m.button>

        {/* Results Component */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {resultType === 'multi' && multiWinnerData ? (
            <MultiWinnerResults resultData={multiWinnerData} />
          ) : (
            <SingleWinnerResults result={result} breakdown={breakdown} />
          )}
        </m.div>
      </div>
    </>
  );
};
