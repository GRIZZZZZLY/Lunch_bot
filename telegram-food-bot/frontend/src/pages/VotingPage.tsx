import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '../components/layout/Layout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { GlassHeroCard } from '../components/glass';
import { MediumWaveGradient } from '../components/background';
import { useTimeBasedGradient } from '../hooks/useTimeBasedGradient';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Users,
  Vote as VoteIcon,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Send
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useUI } from '../store/useAppStore';
import { pollsService, PollWithDetails, Vote } from '../services/polls.service';
import { menuService, MenuItem } from '../services/menu.service';
import { cn } from '../lib/utils';
import { FirstTimeVotingTutorial } from '../components/voting/FirstTimeVotingTutorial';
import { VotersAvatars } from '../components/voting/VotersAvatars';

/**
 * Страница голосования
 */
export const VotingPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mainButton, backButton, colorScheme, hapticFeedback } = useTelegram();
  const { addNotification } = useUI();
  
  const isDark = colorScheme === 'dark';
  const { from, to, textColor, label } = useTimeBasedGradient(isDark);

  const [poll, setPoll] = useState<PollWithDetails | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [userVote, setUserVote] = useState<Vote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Загрузка данных
  useEffect(() => {
    loadPollData(false); // Первая загрузка - с loading
  }, [pollId]);

  // Отмечаем что анимации показаны после первой загрузки
  useEffect(() => {
    if (!loading && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [loading]);

  // Автообновление данных каждые 10 секунд (Real-time updates)
  useEffect(() => {
    if (!poll || poll.status !== 'ACTIVE') return;

    const refreshInterval = setInterval(() => {
      // Тихое обновление БЕЗ перерисовки анимаций
      loadPollData(true); // silent mode
    }, 10000); // 10 секунд

    return () => clearInterval(refreshInterval);
  }, [poll?.status]);

  // Проверка первого посещения для показа туториала
  useEffect(() => {
    const hasSeenVotingTutorial = localStorage.getItem('hasSeenVotingTutorial');
    if (!hasSeenVotingTutorial && !loading && poll && poll.status === 'ACTIVE') {
      // Показываем туториал с небольшой задержкой после загрузки
      const timer = setTimeout(() => {
        setShowTutorial(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, poll]);

  // Обновление таймера
  useEffect(() => {
    if (!poll?.endTime) return;

    const timer = setInterval(() => {
      const remaining = pollsService.formatTimeRemaining(poll.endTime!);
      setTimeRemaining(remaining);
      
      if (remaining === 'Завершено') {
        clearInterval(timer);
        addNotification({
          type: 'info',
          message: 'Голосование завершено',
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [poll]);

  // Настройка Telegram кнопок
  useEffect(() => {
    if (!poll || poll.status !== 'ACTIVE') {
      mainButton.hide();
    } else if (selectedItemId && selectedItemId !== userVote?.menuItemId) {
      mainButton.setText('Проголосовать');
      mainButton.onClick(handleVote);
      mainButton.show();
    } else {
      mainButton.hide();
    }

    backButton.onClick(() => navigate('/'));
    backButton.show();

    return () => {
      mainButton.hide();
      backButton.hide();
    };
  }, [selectedItemId, userVote, poll]);

  const loadPollData = async (silent: boolean = false) => {
    try {
      // Только при первой загрузке показываем loader
      if (!silent) {
        setLoading(true);
      }

      if (!pollId) {
        throw new Error('Poll ID is missing');
      }

      // Загружаем данные голосования
      const pollResponse = await pollsService.getPollById(parseInt(pollId));
      
      if (!pollResponse.success || !pollResponse.data) {
        throw new Error('Poll not found');
      }

      const pollData = pollResponse.data;
      
      // Принудительное обновление через создание нового объекта
      setPoll({ ...pollData });

      // Проверяем голос пользователя
      if (user) {
        const existingVote = pollData.votes?.find(v => v.userId === user.id);
        if (existingVote) {
          setUserVote(existingVote);
          setSelectedItemId(existingVote.menuItemId);
        }
      }

      // Загружаем меню (можно фильтровать только блюда из голосования)
      const menuResponse = await menuService.getActiveItems();
      if (menuResponse.success && menuResponse.data) {
        // Принудительное обновление через создание нового массива
        setMenuItems([...menuResponse.data]);
      }

    } catch (error) {
      console.error('Error loading poll data:', error);
      // Только при первой загрузке показываем ошибку и редирект
      if (!silent) {
        addNotification({
          type: 'error',
          message: 'Ошибка загрузки голосования',
        });
        navigate('/');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleVote = async () => {
    if (!selectedItemId || !pollId) return;

    try {
      setSubmitting(true);
      
      // Haptic feedback при отправке голоса
      hapticFeedback.impactOccurred('light');

      const response = await pollsService.voteForItem(parseInt(pollId), selectedItemId);

      if (response.success && response.data) {
        // Оптимистичное обновление: сразу обновляем локальное состояние
        setUserVote(response.data);
        
        // Успешное голосование - haptic success
        hapticFeedback.notificationOccurred('success');
        
        addNotification({
          type: 'success',
          message: userVote ? 'Голос изменён' : 'Голос принят',
        });

        // Принудительно обновляем UI
        setRefreshKey(prev => prev + 1);
        
        // Обновляем данные с сервера
        // Используем небольшую задержку для плавности
        setTimeout(async () => {
          await loadPollData(true);
          // Еще раз обновляем UI после загрузки
          setRefreshKey(prev => prev + 1);
        }, 100);
      } else {
        // Ошибка - haptic error
        hapticFeedback.notificationOccurred('error');
        throw new Error(response.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
      hapticFeedback.notificationOccurred('error');
      addNotification({
        type: 'error',
        message: 'Ошибка при голосовании',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectItem = (itemId: number) => {
    if (poll?.status === 'ACTIVE') {
      // Haptic feedback при выборе блюда
      hapticFeedback.selectionChanged();
      setSelectedItemId(itemId);
    }
  };

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('hasSeenVotingTutorial', 'true');
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </>
    );
  }

  if (!poll) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <AlertCircle size={48} className="text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">Голосование не найдено</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-primary-food-700 text-white dark:bg-peach-500 dark:text-slate-900 rounded-lg font-medium"
          >
            На главную
          </motion.button>
        </motion.div>
      </>
    );
  }

  const isActive = poll.status === 'ACTIVE';
  const hasVoted = !!userVote;

  return (
    <>
      {/* Hero Card */}
      <motion.div
        initial={!hasAnimated ? { opacity: 0, y: -20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <GlassHeroCard
          gradient={{ from, to }}
          value={(poll._count?.votes || 0).toString()}
          label={`${poll.title || 'Голосование'} · ${label}`}
          sublabel={isActive ? `${timeRemaining} · Активно` : 'Завершено'}
          textColor={textColor}
          icon={<VoteIcon size={24} />}
        />
      </motion.div>

      <div className="space-y-6">
        {/* Статистика */}
        <motion.div
          key={`stats-${refreshKey}`}
          initial={!hasAnimated ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: !hasAnimated ? 0.2 : 0, duration: 0.4 }}
          className="grid grid-cols-2 gap-3"
        >
          <div key={`votes-${poll._count?.votes || 0}`} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-2">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-bluegray-500/20">
                <Users size={18} className="text-blue-500 dark:text-bluegray-300" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {poll._count?.votes || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Голосов
            </p>
          </div>
          
          {isActive && poll.endTime && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <div className="p-2 rounded-lg bg-primary-food-50 dark:bg-peach-500/20">
                  <Clock size={18} className="text-primary-food-500 dark:text-peach-300" />
                </div>
              </div>
              <p className="text-2xl font-bold text-primary-food-700 dark:text-peach-300 mb-1">
                {timeRemaining}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Осталось
              </p>
            </div>
          )}
        </motion.div>

        {/* Статус голоса пользователя */}
        {hasVoted && (
          <motion.div
            key={`vote-status-${userVote?.menuItemId || 0}-${refreshKey}`}
            initial={!hasAnimated ? { opacity: 0, scale: 0.95 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: !hasAnimated ? 0.3 : 0, duration: 0.3 }}
            className="p-4 bg-green-50 dark:bg-success-soft-500/20 rounded-xl border-l-4 border-green-500 dark:border-success-soft-400 shadow-sm"
          >
            <div className="flex items-start gap-2">
              <CheckCircle size={18} className="text-green-600 dark:text-success-soft-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-success-soft-300">
                  Вы проголосовали за: <span className="font-semibold">{userVote.menuItem.name}</span>
                </p>
                {isActive && (
                  <p className="text-xs text-green-600 dark:text-success-soft-300 mt-1">
                    Вы можете изменить свой выбор до окончания голосования
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Список блюд */}
        <motion.div
          initial={!hasAnimated ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: !hasAnimated ? 0.4 : 0, duration: 0.4 }}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Выберите блюдо:
          </h2>

          {menuItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Нет доступных блюд
            </div>
          ) : (
            <div key={refreshKey} className="space-y-3">
              {menuItems.map((item, index) => {
                const isSelected = selectedItemId === item.id;
                const isUserChoice = userVote?.menuItemId === item.id;
                const itemVotes = poll.votes?.filter(v => v.menuItemId === item.id) || [];
                const voteCount = itemVotes.length;
                const voters = itemVotes.map(v => v.user);

                return (
                  <motion.button
                    key={item.id}
                    initial={!hasAnimated ? { opacity: 0, x: -20 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: !hasAnimated ? 0.5 + index * 0.05 : 0, duration: 0.3 }}
                    onClick={() => handleSelectItem(item.id)}
                    disabled={!isActive || submitting}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border-2 transition-all relative shadow-sm",
                      isSelected
                        ? 'border-primary-food-500 bg-primary-food-50 dark:bg-peach-500/20 dark:border-peach-400'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-food-300 dark:hover:border-peach-500',
                      !isActive || submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {/* Checkbox Icon */}
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckCircle2 className="size-6 text-primary-food-500 dark:text-peach-400" />
                            ) : isUserChoice ? (
                              <CheckCircle2 className="size-6 text-green-500 dark:text-success-soft-300" />
                            ) : (
                              <Circle className="size-6 text-gray-300 dark:text-gray-600" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {item.name}
                            </h3>
                          </div>
                        </div>
                        
                        {item.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-4 mt-2">
                          <div className="flex items-center gap-3">
                            {item.price && (
                              <span className="text-sm font-semibold text-primary-food-700 dark:text-peach-300">
                                {item.price} ₽
                              </span>
                            )}
                            {voteCount > 0 && (
                              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                <Users size={12} />
                                {voteCount}
                              </span>
                            )}
                          </div>

                          {/* Social Proof: Аватары проголосовавших */}
                          {voters.length > 0 && (
                            <VotersAvatars voters={voters} maxDisplay={3} size="sm" />
                          )}
                        </div>
                      </div>

                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-20 h-20 object-cover rounded-lg ml-4 flex-shrink-0"
                        />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Информация */}
        {!isActive && (
          <motion.div
            initial={!hasAnimated ? { opacity: 0, scale: 0.95 } : false}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800 shadow-sm"
          >
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                Голосование завершено. Результаты будут отправлены в личные сообщения.
              </p>
            </div>
          </motion.div>
        )}

        {/* Отступ снизу для FAB */}
        <div className="h-24"></div>
      </div>

      {/* Floating Action Button */}
      {isActive && selectedItemId && selectedItemId !== userVote?.menuItemId && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
          whileHover={{ scale: !submitting ? 1.05 : 1 }}
          whileTap={{ scale: !submitting ? 0.95 : 1 }}
          onClick={handleVote}
          disabled={submitting}
          className={`
            fixed bottom-20 right-6 z-50
            flex items-center justify-center space-x-2
            px-6 py-4 rounded-full
            text-base font-semibold
            transition-all duration-300
            ${!submitting
              ? 'bg-primary-food-700 hover:bg-primary-food-800 text-white dark:bg-peach-500 dark:hover:bg-peach-600 dark:text-slate-900 shadow-2xl shadow-primary-food-700/40 dark:shadow-peach-500/40'
              : 'bg-primary-food-400 text-white dark:bg-peach-400 dark:text-slate-900 shadow-lg cursor-wait'
            }
          `}
        >
          {submitting ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Отправка...</span>
            </>
          ) : (
            <>
              <Send size={20} />
              <span>Проголосовать</span>
            </>
          )}
        </motion.button>
      )}

      {/* First Time Voting Tutorial */}
      <FirstTimeVotingTutorial 
        isOpen={showTutorial} 
        onClose={handleCloseTutorial} 
      />
    </>
  );
};
