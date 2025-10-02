import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Header } from '../components/layout/Layout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useUI } from '../store/useAppStore';
import { pollsService } from '../services/polls.service';
import { menuService, MenuItem } from '../services/menu.service';
import { userService, Group } from '../services/user.service';

/**
 * Страница управления голосованиями
 */
export const PollManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mainButton, backButton } = useTelegram();
  const { addNotification } = useUI();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [title, setTitle] = useState('Голосование за обед');
  const [duration, setDuration] = useState(30);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Загрузка меню и групп
  useEffect(() => {
    loadMenuItems();
    loadGroups();
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
  }, [selectedGroupId, selectedItems, duration, title]);

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
      const response = await userService.getUserGroups();
      
      if (response.success && response.data) {
        setGroups(response.data);
        // Выбираем первую группу по умолчанию
        if (response.data.length > 0 && !selectedGroupId) {
          setSelectedGroupId(response.data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка загрузки групп',
      });
    }
  };

  const canCreatePoll = (): boolean => {
    return (
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
      console.error('Error creating poll:', error);
      
      let errorMessage = 'Ошибка создания голосования';
      if (error.message?.includes('already has an active poll')) {
        errorMessage = 'В этой группе уже есть активное голосование';
      } else if (error.message?.includes('Not enough items')) {
        errorMessage = 'Выберите минимум 2 блюда';
      }
      
      addNotification({
        type: 'error',
        message: errorMessage,
      });
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
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!user?.isAdmin) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-telegram-hint-color mb-4">
            Только администраторы могут запускать голосования
          </p>
          <Button onClick={() => navigate('/')}>
            На главную
          </Button>
        </div>
      </Layout>
    );
  }

  const allSelected = selectedItems.size === menuItems.length;
  const someSelected = selectedItems.size > 0 && selectedItems.size < menuItems.length;

  return (
    <Layout>
      <Header />

      <div className="space-y-6">
        {/* Заголовок */}
        <div>
          <h1 className="text-2xl font-bold text-telegram-text-color mb-2">
            Создать голосование
          </h1>
          <p className="text-telegram-hint-color">
            Настройте параметры и выберите блюда для голосования
          </p>
        </div>

        {/* Основные настройки */}
        <div className="bg-telegram-secondary-bg-color rounded-2xl p-6 border border-telegram-secondary-bg-color/50 space-y-4">
          {/* Выбор группы */}
          {groups.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-telegram-text-color mb-2">
                Группа
              </label>
              <select
                value={selectedGroupId || ''}
                onChange={(e) => setSelectedGroupId(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border-2 border-telegram-secondary-bg-color bg-telegram-bg-color text-telegram-text-color focus:outline-none focus:border-telegram-button-color transition-colors"
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
            <label className="block text-sm font-medium text-telegram-text-color mb-2">
              Название голосования
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Голосование за обед"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-telegram-text-color mb-2">
              Длительность (минуты)
            </label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
              min={1}
              max={1440}
            />
            <p className="text-xs text-telegram-hint-color mt-1">
              От 1 до 1440 минут (24 часа)
            </p>
          </div>

          {/* Превью времени */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setDuration(15)}
              className={`p-3 rounded-xl border-2 transition-all ${
                duration === 15
                  ? 'border-telegram-button-color bg-telegram-button-color/10'
                  : 'border-telegram-secondary-bg-color/50 hover:border-telegram-button-color/50'
              }`}
            >
              <div className="text-lg font-bold">15</div>
              <div className="text-xs text-telegram-hint-color">минут</div>
            </button>
            <button
              onClick={() => setDuration(30)}
              className={`p-3 rounded-xl border-2 transition-all ${
                duration === 30
                  ? 'border-telegram-button-color bg-telegram-button-color/10'
                  : 'border-telegram-secondary-bg-color/50 hover:border-telegram-button-color/50'
              }`}
            >
              <div className="text-lg font-bold">30</div>
              <div className="text-xs text-telegram-hint-color">минут</div>
            </button>
            <button
              onClick={() => setDuration(60)}
              className={`p-3 rounded-xl border-2 transition-all ${
                duration === 60
                  ? 'border-telegram-button-color bg-telegram-button-color/10'
                  : 'border-telegram-secondary-bg-color/50 hover:border-telegram-button-color/50'
              }`}
            >
              <div className="text-lg font-bold">60</div>
              <div className="text-xs text-telegram-hint-color">минут</div>
            </button>
          </div>
        </div>

        {/* Выбор блюд */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-telegram-text-color">
              Блюда ({selectedItems.size} из {menuItems.length})
            </h2>
            <button
              onClick={toggleAll}
              className="text-sm text-telegram-button-color hover:underline"
            >
              {allSelected ? 'Снять все' : 'Выбрать все'}
            </button>
          </div>

          {selectedItems.size < 2 && (
            <div className="mb-4 p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
              <p className="text-yellow-600 dark:text-yellow-400 text-sm">
                ⚠️ Выберите минимум 2 блюда для голосования
              </p>
            </div>
          )}

          {menuItems.length === 0 ? (
            <div className="text-center py-8 bg-telegram-secondary-bg-color rounded-xl">
              <p className="text-telegram-hint-color mb-4">
                В меню пока нет блюд
              </p>
              <Button onClick={() => navigate('/menu')}>
                Добавить блюда
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {menuItems.map((item) => {
                const isSelected = selectedItems.has(item.id);

                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-telegram-button-color bg-telegram-button-color/10'
                        : 'border-telegram-secondary-bg-color bg-telegram-secondary-bg-color hover:border-telegram-button-color/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'border-telegram-button-color bg-telegram-button-color'
                            : 'border-telegram-hint-color'
                        }`}>
                          {isSelected && (
                            <span className="text-white text-xs">✓</span>
                          )}
                        </div>

                        <div className="flex-1">
                          <h3 className="font-semibold text-telegram-text-color">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="text-sm text-telegram-hint-color mt-1">
                              {item.description}
                            </p>
                          )}
                          {item.price && (
                            <p className="text-sm font-medium text-telegram-button-color mt-1">
                              {item.price} ₽
                            </p>
                          )}
                        </div>
                      </div>

                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg ml-4"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Превью */}
        {canCreatePoll() && (
          <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
            <p className="text-green-600 dark:text-green-400 text-sm font-medium mb-2">
              ✅ Готово к запуску
            </p>
            <p className="text-telegram-hint-color text-sm">
              Голосование "{title}" будет отправлено в группу на {duration} минут с {selectedItems.size} блюдами
            </p>
          </div>
        )}

        {/* Кнопка для desktop */}
        <div className="pb-safe">
          <Button
            onClick={handleCreatePoll}
            disabled={!canCreatePoll() || creating}
            loading={creating}
            fullWidth
            size="lg"
          >
            {creating ? 'Запуск...' : 'Запустить голосование'}
          </Button>
        </div>
      </div>
    </Layout>
  );
};
