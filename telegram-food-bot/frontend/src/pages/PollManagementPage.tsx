import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '../components/layout/Layout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { GlassHeroCard } from '../components/glass';
import { SubtleDiagonalGradient } from '../components/background';
import { useTimeBasedGradient } from '../hooks/useTimeBasedGradient';
import { 
  CheckCircle2, 
  Circle, 
  Clock,
  Users,
  Send,
  AlertCircle,
  CheckCircle,
  Vote
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useUI } from '../store/useAppStore';
import { pollsService } from '../services/polls.service';
import { menuService, MenuItem } from '../services/menu.service';
import { userService, Group } from '../services/user.service';
import { cn } from '../lib/utils';

/**
 * Страница управления голосованиями
 */
export const PollManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mainButton, backButton, colorScheme } = useTelegram();
  const { addNotification } = useUI();
  
  const isDark = colorScheme === 'dark';
  const { from, to, textColor, label } = useTimeBasedGradient(isDark);

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [title, setTitle] = useState('Голосование за обед');
  const [duration, setDuration] = useState(30);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [existingPoll, setExistingPoll] = useState<any>(null);

  // Загрузка меню и групп
  useEffect(() => {
    console.log('🚀 [PollManagementPage] Initializing...');
    const initData = async () => {
      console.log('🔄 Loading menu items and groups...');
      await loadMenuItems();
      await loadGroups();
      console.log('✅ Initialization complete');
    };
    initData();
  }, []);

  // Настройка Telegram кнопок
  useEffect(() => {
    if (canCreatePoll()) {
      mainButton.setText('Запустить голосование');
      mainButton.onClick(handleCreatePoll);
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
  }, [selectedGroupId, selectedItems, duration, title, existingPoll]); // Добавили existingPoll

  // Проверяем активное голосование при смене группы
  const checkExistingPoll = async (groupId: number) => {
    try {
      console.log(`🔍 Checking active poll for group ${groupId}...`);
      const response = await pollsService.getActivePollInGroup(groupId);
      if (response.success && response.data) {
        console.log('⚠️ Active poll found:', response.data);
        setExistingPoll(response.data);
      } else {
        console.log('✅ No active poll - can create new one');
        setExistingPoll(null);
      }
    } catch (error) {
      console.error('❌ Error checking existing poll:', error);
      setExistingPoll(null);
    }
  };

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      const response = await menuService.getActiveItems();
      
      if (response.success && response.data) {
        setMenuItems(response.data);
        // По умолчанию выбираем все блюда
        setSelectedItems(new Set(response.data.map(item => item.id)));
      }
    } catch (error) {
      console.error('Error loading menu:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка загрузки меню',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      console.log('📋 Loading groups...');
      const response = await userService.getUserGroups();
      
      if (response.success && response.data) {
        console.log(`✅ Groups loaded: ${response.data.length} groups`);
        setGroups(response.data);
        // Выбираем первую группу по умолчанию
        if (response.data.length > 0 && !selectedGroupId) {
          const firstGroupId = response.data[0].id;
          console.log(`🎯 Setting first group as default: ${firstGroupId}`);
          setSelectedGroupId(firstGroupId);
          // Сразу проверяем активное голосование
          console.log(`🔄 Calling checkExistingPoll for group ${firstGroupId}...`);
          await checkExistingPoll(firstGroupId);
        } else {
          console.log(`⚠️ Skip default group selection (selectedGroupId: ${selectedGroupId}, groups: ${response.data.length})`);
        }
      }
    } catch (error) {
      console.error('❌ Error loading groups:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка загрузки групп',
      });
    }
  };

  // Загружаем активное голосование при смене группы
  useEffect(() => {
    console.log(`⚡ useEffect triggered, selectedGroupId: ${selectedGroupId}`);
    if (selectedGroupId) {
      console.log(`🔄 Calling checkExistingPoll from useEffect for group ${selectedGroupId}...`);
      checkExistingPoll(selectedGroupId);
    } else {
      console.log('⚠️ selectedGroupId is null, skipping checkExistingPoll');
    }
  }, [selectedGroupId]);

  const canCreatePoll = (): boolean => {
    return (
      !existingPoll && // Нет активного голосования
      selectedItems.size >= 2 &&
      duration >= 1 &&
      duration <= 1440 &&
      title.trim().length > 0
    );
  };

  const handleCreatePoll = async () => {
    if (!canCreatePoll()) {
      addNotification({
        type: 'error',
        message: 'Заполните все поля корректно',
      });
      return;
    }

    try {
      setCreating(true);

      // Проверяем выбрана ли группа
      if (!selectedGroupId) {
        addNotification({
          type: 'error',
          message: 'Выберите группу',
        });
        return;
      }

      const groupId = selectedGroupId;

      const response = await pollsService.createPollFromWebApp({
        groupId,
        duration,
        selectedMenuItems: Array.from(selectedItems),
        title: title.trim(),
      });

      if (response.success && response.data) {
        addNotification({
          type: 'success',
          message: `Голосование запущено в группе ${response.data.groupTitle}`,
        });

        // Перенаправляем на страницу голосования
        setTimeout(() => {
          navigate(`/vote/${response.data.pollId}`);
        }, 1500);
      } else {
        throw new Error(response.error || 'Failed to create poll');
      }
    } catch (error: any) {
      console.error('❌ Error creating poll:', JSON.stringify({
        success: error.success,
        error: error.error,
        code: error.code,
        status: error.status
      }, null, 2));
      
      let errorMessage = 'Ошибка создания голосования';
      
      // Проверяем код ошибки
      if (error.code === 'POLL_ALREADY_ACTIVE' || error.error?.includes('already has an active poll')) {
        errorMessage = '⏰ В этой группе уже есть активное голосование. Дождитесь его завершения или завершите вручную.';
      } else if (error.code === 'NOT_ENOUGH_ITEMS' || error.error?.includes('Not enough items')) {
        errorMessage = 'Выберите минимум 2 блюда для голосования';
      } else if (error.error) {
        // Показываем текст ошибки от сервера
        errorMessage = error.error;
      }
      
      addNotification({
        type: 'error',
        message: errorMessage,
      });
      
      // Обновляем проверку активного голосования
      if (selectedGroupId && error.code === 'POLL_ALREADY_ACTIVE') {
        checkExistingPoll(selectedGroupId);
      }
    } finally {
      setCreating(false);
    }
  };

  const toggleItem = (itemId: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const toggleAll = () => {
    if (selectedItems.size === menuItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(menuItems.map(item => item.id)));
    }
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

  if (!user?.isAdmin) {
    return (
      <>
        <div className="text-center py-12">
          <p className="text-telegram-hint-color mb-4">
            Только администраторы могут запускать голосования
          </p>
          <Button onClick={() => navigate('/')}>
            На главную
          </Button>
        </div>
      </>
    );
  }

  const allSelected = selectedItems.size === menuItems.length;
  const someSelected = selectedItems.size > 0 && selectedItems.size < menuItems.length;

  return (
    <>
      {/* Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <GlassHeroCard
          gradient={{ from, to }}
          value={selectedItems.size.toString()}
          label={`Блюд выбрано · ${label}`}
          sublabel={`${duration} минут · ${groups.find(g => g.id === selectedGroupId)?.title || 'Выберите группу'}`}
          textColor={textColor}
          icon={<Vote size={24} />}
        />
      </motion.div>

      <div className="space-y-6">

        {/* Предупреждение об активном голосовании */}
        {existingPoll && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 rounded-lg"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                  ⏰ Активное голосование
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-2">
                  В выбранной группе уже идет голосование. Дождитесь его завершения или завершите вручную через страницу голосования.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/vote/${existingPoll.id}`)}
                    className="border-yellow-400 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                  >
                    Перейти к голосованию →
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Основные настройки */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm space-y-5"
        >
          {/* Выбор группы */}
          {groups.length > 0 && (
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                <Users size={16} className="text-primary-food-500" />
                <span>Группа</span>
              </label>
              <select
                value={selectedGroupId || ''}
                onChange={(e) => setSelectedGroupId(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-food-500 focus:border-transparent transition-all"
              >
                <option value="">Выберите группу</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <Vote size={16} className="text-primary-food-500" />
              <span>Название голосования</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Голосование за обед"
              maxLength={100}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-food-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="poll-duration" className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <Clock size={16} className="text-primary-food-500" />
              <span>Длительность</span>
            </label>
            <input
              id="poll-duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
              min={1}
              max={1440}
              aria-describedby="duration-hint"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-food-500 focus:border-transparent transition-all"
            />
            <p id="duration-hint" className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              От 1 до 1440 минут (24 часа)
            </p>
          </div>

          {/* Быстрый выбор времени */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 15, label: '15 минут' },
              { value: 30, label: '30 минут' },
              { value: 60, label: '1 час' },
            ].map((option) => (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDuration(option.value)}
                className={`
                  p-3 rounded-lg border-2 transition-all
                  ${duration === option.value
                    ? 'border-primary-food-500 bg-primary-food-50 dark:bg-primary-food-900/20 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-food-300 dark:hover:border-primary-food-700'
                  }
                `}
              >
                <div className={`text-lg font-bold ${
                  duration === option.value 
                    ? 'text-primary-food-700 dark:text-primary-food-400' 
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {option.value}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">минут</div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Выбор блюд */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Блюда ({selectedItems.size} из {menuItems.length})
            </h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleAll}
              className="text-sm font-medium text-primary-food-700 dark:text-primary-food-400 hover:underline"
            >
              {allSelected ? 'Снять все' : 'Выбрать все'}
            </motion.button>
          </div>

          {selectedItems.size < 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-3.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
            >
              <div className="flex items-start space-x-2">
                <AlertCircle size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-700 dark:text-yellow-300 text-sm font-medium">
                  Выберите минимум 2 блюда для голосования
                </p>
              </div>
            </motion.div>
          )}

          {menuItems.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                В меню пока нет блюд
              </p>
              <Button onClick={() => navigate('/menu')}>
                Добавить блюда
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {menuItems.map((item, index) => {
                const isSelected = selectedItems.has(item.id);

                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.05, duration: 0.3 }}
                    onClick={() => toggleItem(item.id)}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border-2 transition-all shadow-sm",
                      isSelected
                        ? 'border-primary-food-500 bg-primary-food-50 dark:bg-primary-food-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-food-300 dark:hover:border-primary-food-700'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Checkbox Icon */}
                        <div className="mt-1 flex-shrink-0">
                          {isSelected ? (
                            <CheckCircle2 className="size-6 text-primary-food-500" />
                          ) : (
                            <Circle className="size-6 text-gray-300 dark:text-gray-600" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          {item.price && (
                            <p className="text-sm font-semibold text-primary-food-700 dark:text-primary-food-400 mt-1.5">
                              {item.price} ₽
                            </p>
                          )}
                        </div>
                      </div>

                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg ml-4 flex-shrink-0"
                        />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Превью готовности */}
        {canCreatePoll() && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800 shadow-sm"
          >
            <div className="flex items-start space-x-2">
              <CheckCircle size={18} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-700 dark:text-green-300 text-sm font-semibold mb-1">
                  Готово к запуску
                </p>
                <p className="text-green-600 dark:text-green-400 text-sm">
                  Голосование "{title}" будет отправлено в группу на {duration} минут с {selectedItems.size} блюдами
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Отступ снизу для FAB */}
        <div className="h-24"></div>
      </div>

      {/* Floating Action Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: canCreatePoll() && !creating ? 1.05 : 1 }}
        whileTap={{ scale: canCreatePoll() && !creating ? 0.95 : 1 }}
        onClick={handleCreatePoll}
        disabled={!canCreatePoll() || creating}
        className={`
          fixed bottom-20 right-6 z-50
          flex items-center justify-center space-x-2
          px-6 py-4 rounded-full
          text-base font-semibold
          transition-all duration-300
          ${canCreatePoll() && !creating
            ? 'bg-primary-food-700 hover:bg-primary-food-800 text-white shadow-2xl shadow-primary-food-700/40'
            : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed shadow-lg'
          }
        `}
      >
        {creating ? (
          <>
            <LoadingSpinner size="sm" />
            <span>Запуск...</span>
          </>
        ) : (
          <>
            <Send size={20} />
            <span>Запустить</span>
          </>
        )}
      </motion.button>
    </>
  );
};
