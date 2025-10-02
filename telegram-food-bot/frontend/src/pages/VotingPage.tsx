import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Header } from '../components/layout/Layout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useUI } from '../store/useAppStore';
import { pollsService, PollWithDetails, Vote } from '../services/polls.service';
import { menuService, MenuItem } from '../services/menu.service';

/**
 * Страница голосования
 */
export const VotingPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mainButton, backButton } = useTelegram();
  const { addNotification } = useUI();

  const [poll, setPoll] = useState<PollWithDetails | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [userVote, setUserVote] = useState<Vote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Загрузка данных
  useEffect(() => {
    loadPollData();
  }, [pollId]);

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

  const loadPollData = async () => {
    try {
      setLoading(true);

      if (!pollId) {
        throw new Error('Poll ID is missing');
      }

      // Загружаем данные голосования
      const pollResponse = await pollsService.getPollById(parseInt(pollId));
      
      if (!pollResponse.success || !pollResponse.data) {
        throw new Error('Poll not found');
      }

      const pollData = pollResponse.data;
      setPoll(pollData);

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
        setMenuItems(menuResponse.data);
      }

    } catch (error) {
      console.error('Error loading poll data:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка загрузки голосования',
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    if (!selectedItemId || !pollId) return;

    try {
      setSubmitting(true);

      const response = await pollsService.voteForItem(parseInt(pollId), selectedItemId);

      if (response.success && response.data) {
        setUserVote(response.data);
        
        addNotification({
          type: 'success',
          message: userVote ? 'Голос изменён' : 'Голос принят',
        });

        // Обновляем данные
        await loadPollData();
      } else {
        throw new Error(response.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
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
      setSelectedItemId(itemId);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!poll) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-telegram-hint-color">Голосование не найдено</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            На главную
          </Button>
        </div>
      </Layout>
    );
  }

  const isActive = poll.status === 'ACTIVE';
  const hasVoted = !!userVote;

  return (
    <Layout>
      <Header />

      <div className="space-y-6">
        {/* Заголовок голосования */}
        <div className="bg-telegram-secondary-bg-color rounded-2xl p-6 border border-telegram-secondary-bg-color/50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-telegram-text-color mb-2">
                {poll.title || 'Голосование за обед'}
              </h1>
              {poll.description && (
                <p className="text-telegram-hint-color mb-4">{poll.description}</p>
              )}
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isActive 
                ? 'bg-green-500/20 text-green-500' 
                : 'bg-gray-500/20 text-gray-500'
            }`}>
              {isActive ? '🟢 Активно' : '⭕ Завершено'}
            </div>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-telegram-bg-color rounded-xl p-4">
              <div className="text-2xl font-bold text-telegram-button-color">
                {poll._count?.votes || 0}
              </div>
              <div className="text-sm text-telegram-hint-color">Голосов</div>
            </div>
            
            {isActive && poll.endTime && (
              <div className="bg-telegram-bg-color rounded-xl p-4">
                <div className="text-2xl font-bold text-orange-500">
                  {timeRemaining}
                </div>
                <div className="text-sm text-telegram-hint-color">Осталось</div>
              </div>
            )}
          </div>

          {/* Статус голоса пользователя */}
          {hasVoted && (
            <div className="mt-4 p-4 bg-telegram-button-color/10 rounded-xl border-l-4 border-telegram-button-color">
              <p className="text-sm text-telegram-text-color">
                ✅ Вы проголосовали за: <span className="font-semibold">{userVote.menuItem.name}</span>
              </p>
              {isActive && (
                <p className="text-xs text-telegram-hint-color mt-1">
                  Вы можете изменить свой выбор до окончания голосования
                </p>
              )}
            </div>
          )}
        </div>

        {/* Список блюд */}
        <div>
          <h2 className="text-lg font-semibold text-telegram-text-color mb-4">
            Выберите блюдо:
          </h2>

          {menuItems.length === 0 ? (
            <div className="text-center py-8 text-telegram-hint-color">
              Нет доступных блюд
            </div>
          ) : (
            <div className="space-y-3">
              {menuItems.map((item) => {
                const isSelected = selectedItemId === item.id;
                const isUserChoice = userVote?.menuItemId === item.id;
                const voteCount = poll.votes?.filter(v => v.menuItemId === item.id).length || 0;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item.id)}
                    disabled={!isActive || submitting}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-telegram-button-color bg-telegram-button-color/10'
                        : 'border-telegram-secondary-bg-color bg-telegram-secondary-bg-color hover:border-telegram-button-color/50'
                    } ${
                      !isActive || submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-telegram-text-color">
                            {item.name}
                          </h3>
                          {isSelected && <span className="text-telegram-button-color">✓</span>}
                          {isUserChoice && !isSelected && <span className="text-green-500">✓</span>}
                        </div>
                        
                        {item.description && (
                          <p className="text-sm text-telegram-hint-color mt-1">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 mt-2">
                          {item.price && (
                            <span className="text-sm font-medium text-telegram-button-color">
                              {item.price} ₽
                            </span>
                          )}
                          {voteCount > 0 && (
                            <span className="text-xs text-telegram-hint-color">
                              👥 {voteCount} {voteCount === 1 ? 'голос' : 'голосов'}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-20 h-20 object-cover rounded-lg ml-4"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Информация */}
        {!isActive && (
          <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
            <p className="text-yellow-600 dark:text-yellow-400 text-sm">
              ⚠️ Голосование завершено. Результаты будут отправлены в личные сообщения.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};
