import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/ui/button';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle, GlassCardDescription } from '../components/ui/glass-card';
import { MediumWaveGradient } from '../components/background';
import { Badge } from '../components/ui/badge';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { 
  CheckCircle2, 
  Circle, 
  Clock,
  Users,
  Send,
  AlertCircle,
  CheckCircle,
  Vote,
  Utensils
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
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
  const { addNotification } = useUI();

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

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <>
      {/* Animated gradient background */}
      <MediumWaveGradient />

      {/* Main content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6 min-h-screen pb-36"
      >
        {/* Hero Card */}
        <motion.div variants={itemVariants}>
          <GlassCard intensity="high" className="relative overflow-hidden">
            {/* Gradient overlay */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-lavender-500/20 to-mint-500/20" />
            
            <GlassCardContent className="py-6 px-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-xl bg-gradient-to-br from-lavender-500 to-lavender-600 flex items-center justify-center shadow-lg">
                    <Vote size={24} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      Создать голосование
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Выберите блюда и настройте параметры
                    </p>
                  </div>
                </div>
                <ThemeToggle />
              </div>
              
              {/* Статистика */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-lavender-600 dark:text-lavender-400">
                    {selectedItems.size}
                  </div>
                  <div className="text-xs text-muted-foreground">Блюд</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-mint-600 dark:text-mint-400">
                    {duration}
                  </div>
                  <div className="text-xs text-muted-foreground">Минут</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-peach-600 dark:text-peach-400">
                    {groups.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Групп</div>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>

        {/* Предупреждение об активном голосовании */}
        {existingPoll && (
          <motion.div variants={itemVariants}>
            <GlassCard intensity="medium" className="border-l-4 border-yellow-500">
              <GlassCardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" size={20} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">
                      ⏰ Активное голосование
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      В выбранной группе уже идет голосование. Дождитесь его завершения или завершите вручную.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/vote/${existingPoll.id}`)}
                    >
                      Перейти к голосованию →
                    </Button>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}

        {/* Основные настройки */}
        <motion.div variants={itemVariants}>
          <GlassCard intensity="medium" hover>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <Users className="text-lavender-500" size={20} />
                Настройки голосования
              </GlassCardTitle>
              <GlassCardDescription>
                Выберите группу, название и длительность
              </GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              {/* Выбор группы */}
              {groups.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Группа
                  </label>
                  <select
                    value={selectedGroupId || ''}
                    onChange={(e) => setSelectedGroupId(parseInt(e.target.value))}
                    className="w-full px-4 py-3 rounded-lg border-2 border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-lavender-500 focus:border-lavender-500 transition-all"
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

              {/* Название */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Название голосования
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Голосование за обед"
                  maxLength={100}
                  className="w-full px-4 py-3 rounded-lg border-2 border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-lavender-500 focus:border-lavender-500 transition-all"
                />
              </div>

              {/* Длительность */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Длительность (минут)
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                  min={1}
                  max={1440}
                  className="w-full px-4 py-3 rounded-lg border-2 border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-lavender-500 focus:border-lavender-500 transition-all"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  От 1 до 1440 минут (24 часа)
                </p>
              </div>

              {/* Быстрый выбор времени */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 15, label: '15 мин' },
                  { value: 30, label: '30 мин' },
                  { value: 60, label: '1 час' },
                ].map((option) => (
                  <motion.button
                    key={option.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setDuration(option.value)}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all",
                      duration === option.value
                        ? "border-lavender-500 bg-lavender-50 dark:bg-lavender-500/10"
                        : "border-border hover:border-lavender-300"
                    )}
                  >
                    <div className={cn(
                      "text-lg font-bold",
                      duration === option.value 
                        ? "text-lavender-700 dark:text-lavender-400" 
                        : "text-foreground"
                    )}>
                      {option.value}
                    </div>
                    <div className="text-xs text-muted-foreground">{option.label}</div>
                  </motion.button>
                ))}
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>

        {/* Выбор блюд */}
        <motion.div variants={itemVariants}>
          <GlassCard intensity="medium" hover>
            <GlassCardHeader>
              <div className="flex items-center justify-between">
                <GlassCardTitle className="flex items-center gap-2">
                  <Utensils className="text-mint-500" size={20} />
                  Блюда ({selectedItems.size} из {menuItems.length})
                </GlassCardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleAll}
                  className="text-lavender-600 hover:text-lavender-700"
                >
                  {allSelected ? 'Снять все' : 'Выбрать все'}
                </Button>
              </div>
              {selectedItems.size < 2 && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm font-medium">
                    Выберите минимум 2 блюда
                  </p>
                </div>
              )}
            </GlassCardHeader>
            <GlassCardContent>
              {menuItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    В меню пока нет блюд
                  </p>
                  <Button variant="lavender" onClick={() => navigate('/menu')}>
                    Добавить блюда
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {menuItems.map((item, index) => {
                    const isSelected = selectedItems.has(item.id);

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.3 }}
                      >
                        <GlassCard
                          intensity="low"
                          hover
                          className={cn(
                            "cursor-pointer transition-all",
                            isSelected && "ring-2 ring-lavender-500 bg-lavender-500/5"
                          )}
                          onClick={() => toggleItem(item.id)}
                        >
                          <GlassCardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {/* Иконка чекбокса */}
                              <div className="size-10 rounded-lg bg-gradient-to-br from-lavender-500 to-lavender-600 flex items-center justify-center flex-shrink-0">
                                {isSelected ? (
                                  <CheckCircle2 className="text-white" size={20} />
                                ) : (
                                  <Circle className="text-white/50" size={20} />
                                )}
                              </div>

                              {/* Контент */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground">
                                  {item.name}
                                </h3>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                                {item.price && (
                                  <Badge variant="outline" className="mt-2">
                                    {item.price} ₽
                                  </Badge>
                                )}
                              </div>

                              {/* Картинка */}
                              {item.imageUrl && (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                                />
                              )}
                            </div>
                          </GlassCardContent>
                        </GlassCard>
                      </motion.div>
                );
              })}
            </div>
          )}
            </GlassCardContent>
          </GlassCard>
        </motion.div>

      </motion.div>

      {/* Фиксированная кнопка создания */}
      <div 
        className="fixed bottom-20 left-0 right-0 px-4 pb-4 pointer-events-none z-50"
        style={{ position: 'fixed', bottom: '80px' }}
      >
        <div className="max-w-2xl mx-auto">
          <Button
            variant="lavender"
            size="lg"
            className="w-full pointer-events-auto shadow-xl"
            onClick={handleCreatePoll}
            disabled={!canCreatePoll() || creating}
          >
          {creating ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Vote size={20} />
              </motion.div>
              <span>Создаю...</span>
            </>
          ) : (
            <>
              <Vote size={20} />
              <span>Запустить голосование</span>
            </>
          )}
          </Button>
        </div>
      </div>
    </>
  );
};
