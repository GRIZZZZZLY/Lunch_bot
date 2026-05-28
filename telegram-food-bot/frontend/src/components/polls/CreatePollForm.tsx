/**
 * CreatePollForm - Форма создания голосования с glassmorphism дизайном
 * 
 * Оптимизирована для mobile:
 * - Glassmorphism & time-based градиенты
 * - Smart presets & live preview
 * - Enhanced визуализация блюд
 * - Progress indicators
 * - Haptic feedback
 */

import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Users,
  CheckCircle2,
  Circle,
  AlertCircle,
  Check,
  Shuffle,
  X,
  ChevronLeft,
} from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PastelCard, CardContent } from '../ui/pastel-card';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';
import { TYPOGRAPHY_H3, TYPOGRAPHY_SMALL } from '@/lib/typography';
import { useAuth } from '@/hooks/useAuth';
import { useHaptic } from '@/hooks/useHaptic';
import { menuService, MenuItem } from '@/services/menu.service';
import { userService, Group } from '@/services/user.service';
import { pollsService } from '@/services/polls.service';
import { ICON_SIZES } from '@/lib/design-tokens';

interface CreatePollFormProps {
  onSuccess?: (pollId: number) => void;
  onCancel?: () => void;
}

export const CreatePollForm: React.FC<CreatePollFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const haptic = useHaptic();
  
  // Определяем тему: проверяем CSS класс 'dark' на документе
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  // Следим за изменениями темы через MutationObserver
  useEffect(() => {
    const updateTheme = () => {
      const newIsDark = document.documentElement.classList.contains('dark');
      setIsDark(newIsDark);
      console.log('🎨 [CreatePollForm] Theme changed:', newIsDark ? 'dark' : 'light');
    };

    // Обновляем сразу
    updateTheme();

    // Наблюдаем за изменениями класса на html
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // State
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [duration, setDuration] = useState(30);
  const [isMultiSelect, setIsMultiSelect] = useState(true); // Множественный выбор по умолчанию
  const maxSelections = 3; // Макс. 3 блюда
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [menuResponse, groupsResponse] = await Promise.all([
        menuService.getActiveItems(),
        userService.getUserGroups(),
      ]);

      console.log('[CreatePollForm] 🔍 Menu response:', {
        success: menuResponse.success,
        dataLength: menuResponse.data?.length || 0,
        data: menuResponse.data,
        error: menuResponse.error
      });

      if (menuResponse.success && menuResponse.data) {
        setMenuItems(menuResponse.data);
        // ✅ UX FIX: Don't pre-select all items (Paradox of Choice)
        // Admin can use "🎲 Случайные 5" or select manually
        // Was: setSelectedItems(new Set(menuResponse.data.map(item => item.id)));
        console.log('[CreatePollForm] ✅ Menu items loaded:', menuResponse.data.length);
      } else {
        console.error('[CreatePollForm] ❌ Failed to load menu:', menuResponse.error);
      }

      console.log('[CreatePollForm] 🔍 Groups response:', {
        success: groupsResponse.success,
        dataLength: groupsResponse.data?.length || 0,
      });

      if (groupsResponse.success && groupsResponse.data) {
        setGroups(groupsResponse.data);
      }
    } catch (err) {
      console.error('[CreatePollForm] ❌ Error loading data:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const adminGroups = useMemo(() => {
    if (user?.isAdmin) {
      return groups;
    }

    return groups.filter(group => group.role === 'ADMIN' || group.role === 'CREATOR');
  }, [groups, user?.isAdmin]);

  useEffect(() => {
    if (selectedGroupId && adminGroups.some(group => group.id === selectedGroupId)) {
      return;
    }

    if (adminGroups.length > 0) {
      setSelectedGroupId(adminGroups[0].id);
    } else {
      setSelectedGroupId(null);
    }
  }, [adminGroups, selectedGroupId]);

  const canCreatePoll = (): boolean => {
    return (
      selectedGroupId !== null &&
      selectedItems.size >= 2 &&
      duration >= 1 &&
      duration <= 1440
    );
  };

  const handleCreate = async () => {
    if (!canCreatePoll()) {
      setError('Заполните все поля корректно');
      haptic.error();
      return;
    }

    try {
      setCreating(true);
      setError(null);

      // Автоматически добавляем "Еда с собой" к выбранным блюдам
      const takeawayItem = menuItems.find(item => item.name === 'Еда с собой');
      const finalSelectedItems = Array.from(selectedItems);
      if (takeawayItem && !finalSelectedItems.includes(takeawayItem.id)) {
        finalSelectedItems.push(takeawayItem.id);
      }

      const response = await pollsService.createPollFromWebApp({
        groupId: selectedGroupId!,
        duration,
        selectedMenuItems: finalSelectedItems,
        title: 'Голосование за обед',
        isMultiSelect,
        maxSelections: isMultiSelect ? maxSelections : 1,
      });

      if (response.success && response.data) {
        haptic.success();
        onSuccess?.(response.data.pollId);
      } else {
        throw new Error(response.error || 'Failed to create poll');
      }
    } catch (err: unknown) {
      console.error('Error creating poll:', err);
      
      let errorMessage = 'Ошибка создания голосования';
      
      // Проверяем разные типы ошибок
      const errorObj = err as { error?: string; message?: string; code?: string };
      const errorText = errorObj?.error || errorObj?.message || '';
      
      if (errorText.includes('already has an active poll') || errorText.includes('Group already has active poll')) {
        errorMessage = 'В этой группе уже есть активное голосование. Дождитесь его завершения.';
      } else if (errorText.includes('Not enough items') || errorText.includes('NOT_ENOUGH_ITEMS')) {
        errorMessage = 'Выберите минимум 2 блюда';
      } else if (errorText.includes('Network error') || errorObj?.code === 'NETWORK_ERROR') {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
      } else if (errorText.includes('Access denied') || errorObj?.code === 'ACCESS_DENIED') {
        errorMessage = 'Недостаточно прав для создания голосования';
      } else if (errorObj?.code === 'INVALID_GROUP') {
        errorMessage = 'Выберите группу';
      } else if (errorText) {
        errorMessage = `Ошибка: ${errorText}`;
      }
      
      setError(errorMessage);
      haptic.error();
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

  const selectRandom = () => {
    console.log('[CreatePollForm] 🎲 selectRandom clicked', { 
      totalItems: menuItems.length,
      currentSelected: selectedItems.size 
    });
    
    haptic.impact();
    
    // Случайный выбор от 3 до 6 блюд (или меньше если блюд мало)
    const maxCount = Math.min(6, menuItems.length);
    const minCount = Math.min(3, menuItems.length);
    const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
    
    console.log('[CreatePollForm] 🎲 Selecting random items', { count, maxCount, minCount });
    
    const shuffled = [...menuItems].sort(() => Math.random() - 0.5);
    const randomItems = shuffled.slice(0, count);
    const newSelection = new Set(randomItems.map(item => item.id));
    
    console.log('[CreatePollForm] ✅ Random items selected', { 
      selectedIds: Array.from(newSelection),
      selectedNames: randomItems.map(i => i.name)
    });
    
    setSelectedItems(newSelection);
  };

  // Format duration для live preview
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} мин`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}ч ${mins}м` : `${hours} час${hours > 1 ? 'а' : ''}`;
    }
  };

  // Все блюда без фильтрации
  const visibleItems = compact && !showAllItems 
    ? menuItems.slice(0, 5) 
    : menuItems;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 bg-white dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const canManagePolls = !!user?.isAdmin || adminGroups.length > 0;

  if (!canManagePolls) {
    return (
      <div className="p-6 text-center bg-white dark:bg-gray-900">
        <AlertCircle className={`${ICON_SIZES['2xl']} mx-auto mb-4 text-yellow-500`} />
        <p className="text-gray-600 dark:text-gray-400">
          Только администраторы групп могут запускать голосования
        </p>
      </div>
    );
  }

  // Check if no menu items
  if (menuItems.length === 0) {
    return (
      <div className="p-6 text-center bg-white dark:bg-gray-900">
        <AlertCircle className={cn(
          ICON_SIZES['2xl'],
          "mx-auto mb-4",
          isDark ? "text-lavender-500" : "text-peach-500"
        )} />
        <p className="text-gray-900 dark:text-white font-semibold mb-2">
          Меню пустое
        </p>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Добавьте блюда в меню перед созданием голосования
        </p>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Закрыть
          </button>
        )}
      </div>
    );
  }

  const hasMore = compact && menuItems.length > 5;

  return (
    <div className="relative space-y-0">
      {/* Custom Tabs for Single vs Recurring - Adaptive Theme */}
      <div className="pt-6 px-6">
        <div className="grid w-full grid-cols-2 gap-2 p-2 bg-muted/50 rounded-xl">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setActiveTab('single');
              haptic.selection();
            }}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all font-medium',
              activeTab === 'single'
                ? isDark
                  ? 'bg-gradient-to-r from-lavender-500 to-lavender-600 text-white shadow-lg'
                  : 'bg-gradient-to-r from-peach-500 to-coral-500 text-white shadow-lg'
                : 'bg-transparent text-muted-foreground hover:bg-muted'
            )}
          >
            <Zap className={ICON_SIZES.sm} />
            <span>Разовое</span>
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setActiveTab('recurring');
              haptic.selection();
            }}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all font-medium',
              activeTab === 'recurring'
                ? isDark
                  ? 'bg-gradient-to-r from-lavender-500 to-lavender-600 text-white shadow-lg'
                  : 'bg-gradient-to-r from-peach-500 to-coral-500 text-white shadow-lg'
                : 'bg-transparent text-muted-foreground hover:bg-muted'
            )}
          >
            <RotateCcw className={ICON_SIZES.sm} />
            <span>Автоматическое</span>
          </motion.button>
        </div>
      </div>

      {/* Single Poll Form */}
      <AnimatePresence mode="wait">
        {activeTab === 'single' && (
          <motion.div
            key="single"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
          <div className="p-6 pt-4 space-y-5">
      {/* 🎨 Group Selection - Pastel Card */}
      {adminGroups.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <PastelCard variant="default" className={cn(
            "border-l-4",
            isDark ? "border-lavender-500" : "border-peach-500"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800">
                  <Users className={`${ICON_SIZES.md} text-gray-600 dark:text-gray-400`} />
                </div>
                <div>
                  <h3 className={cn(TYPOGRAPHY_H3.className, "text-gray-900 dark:text-white")}>
                    Группа
                  </h3>
                  <p className={cn(TYPOGRAPHY_SMALL.className, "text-gray-400 dark:text-gray-400")}>
                    Где запустить голосование
                  </p>
                </div>
              </div>
              
              {/* Группы как радио-кнопки */}
              <div className="space-y-2">
                {adminGroups.map((group, index) => (
                  <motion.button
                    key={group.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + index * 0.05 }}
                    onClick={() => {
                      setSelectedGroupId(group.id);
                    }}
                    className={cn(
                      "w-full p-3 rounded-2xl border-2 transition-all duration-200 ease-out",
                      selectedGroupId === group.id
                        ? isDark
                          ? "border-lavender-500 bg-lavender-500/5"
                          : "border-peach-500 bg-peach-50"
                        : isDark
                          ? "border-border hover:border-lavender-300"
                          : "border-border hover:border-peach-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {group.title}
                      </span>
                      {selectedGroupId === group.id && (
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                        >
                          <CheckCircle2 className={isDark ? "text-lavender-500" : "text-peach-500"} size={20} />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </PastelCard>
        </motion.div>
      )}

      {/* 🎨 Duration - Smart Presets */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <PastelCard variant="default" className={cn(
          "border-l-4",
          isDark ? "border-lavender-500" : "border-peach-500"
        )}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2.5 rounded-xl",
                  isDark ? "bg-lavender-500/20" : "bg-peach-500/20"
                )}>
                  <Clock className={cn(
                    ICON_SIZES.md,
                    isDark ? "text-lavender-500" : "text-peach-500"
                  )} />
                </div>
                <div>
                  <h3 className={cn(TYPOGRAPHY_H3.className, "text-gray-900 dark:text-white")}>Длительность голосования</h3>
                </div>
              </div>
              
              {/* Live countdown preview */}
              <motion.div 
                key={duration}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className={cn(
                  "px-3 py-1.5 rounded-lg",
                  isDark 
                    ? "bg-lavender-500/10 text-lavender-400"
                    : "bg-peach-50 text-peach-700"
                )}
              >
                <span className="text-sm font-bold">
                  {formatDuration(duration)}
                </span>
              </motion.div>
            </div>

            {/* Slider для выбора времени */}
            <div>
              <input
                type="range"
                min={5}
                max={240}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full adaptive-slider"
                style={{
                  '--slider-progress': `${Math.min(
                    100,
                    Math.max(0, ((duration - 5) / 235) * 100)
                  )}%`,
                } as CSSProperties}
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-400 mt-1">
                <span>5 мин</span>
                <span>4 часа</span>
              </div>
            </div>
          </CardContent>
        </PastelCard>
      </motion.div>

      {/* 🎨 Vote Type Selection - Single vs Multiple */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <PastelCard variant="default" className={cn(
          "border-l-4",
          isDark ? "border-lavender-500" : "border-peach-500"
        )}>
          <CardContent className="pt-6">
            <h3 className={cn(TYPOGRAPHY_H3.className, "text-gray-900 dark:text-white mb-3")}>
              Тип голосования
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setIsMultiSelect(false);
                  haptic.selection();
                }}
                className={cn(
                  'p-3 rounded-xl border-2 transition-all text-center',
                  !isMultiSelect
                    ? isDark
                      ? 'border-lavender-500 bg-lavender-500/5'
                      : 'border-peach-500 bg-peach-50'
                    : 'border-border bg-background hover:border-muted-foreground/30'
                )}
              >
                <Circle className={cn(
                  'mx-auto mb-1.5',
                  ICON_SIZES.md,
                  !isMultiSelect
                    ? isDark ? 'text-lavender-500' : 'text-peach-500'
                    : 'text-muted-foreground'
                )} />
                <span className="text-sm font-medium block">Одно блюдо</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setIsMultiSelect(true);
                  haptic.selection();
                }}
                className={cn(
                  'p-3 rounded-xl border-2 transition-all text-center',
                  isMultiSelect
                    ? isDark
                      ? 'border-lavender-500 bg-lavender-500/5'
                      : 'border-peach-500 bg-peach-50'
                    : 'border-border bg-background hover:border-muted-foreground/30'
                )}
              >
                <CheckCircle2 className={cn(
                  'mx-auto mb-1.5',
                  ICON_SIZES.md,
                  isMultiSelect
                    ? isDark ? 'text-lavender-500' : 'text-peach-500'
                    : 'text-muted-foreground'
                )} />
                <span className="text-sm font-medium block">Несколько блюд</span>
                <span className="text-xs text-muted-foreground">(до {maxSelections} шт)</span>
              </motion.button>
            </div>
          </CardContent>
        </PastelCard>
      </motion.div>

      {/* 🎨 Menu Items Selection - Enhanced */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <PastelCard variant="default">
          <CardContent className="pt-6">
            {/* Header с статистикой */}
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Блюда в голосовании
              </h3>
              <div className="flex items-center justify-between mb-3">
                <motion.p 
                  key={selectedItems.size}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-sm text-gray-600 dark:text-gray-400"
                >
                  Выбрано <span className={cn(
                    "font-bold",
                    isDark ? "text-lavender-500" : "text-peach-500"
                  )}>
                    {selectedItems.size} {selectedItems.size === 1 ? 'блюдо' : selectedItems.size < 5 ? 'блюда' : 'блюд'}
                  </span>
                </motion.p>
              </div>
              
              {/* Progress bar визуализация */}
              <Progress 
                value={(selectedItems.size / menuItems.length) * 100}
                className={cn(
                  "h-2",
                  isDark 
                    ? "[&>div]:bg-gradient-to-r [&>div]:from-lavender-400 [&>div]:to-lavender-600"
                    : "[&>div]:bg-gradient-to-r [&>div]:from-peach-400 [&>div]:to-coral-500"
                )}
              />
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 mb-4">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={toggleAll}
                className={cn(
                  "px-4 py-3 rounded-lg text-sm font-medium border-2 transition-all flex items-center gap-2",
                  isDark
                    ? "border-lavender-500/30 text-lavender-400 hover:bg-lavender-500/10"
                    : "border-peach-500/30 text-peach-600 hover:bg-peach-50"
                )}
              >
                <X className={ICON_SIZES.sm} />
                <span>{selectedItems.size === menuItems.length ? 'Снять всё' : 'Выбрать всё'}</span>
              </motion.button>
              
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={selectRandom}
                className={cn(
                  "px-4 py-3 rounded-lg text-sm font-medium border-2 transition-all flex items-center gap-2",
                  isDark
                    ? "border-lavender-500/30 text-lavender-400 hover:bg-lavender-500/10"
                    : "border-peach-500/30 text-peach-600 hover:bg-peach-50"
                )}
              >
                <Shuffle className={ICON_SIZES.sm} />
                <span>Случайный выбор</span>
              </motion.button>
            </div>

            {/* Validation hint */}
            <AnimatePresence>
              {selectedItems.size < 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className={cn(ICON_SIZES.sm, "text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5")} />
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      💡 Выберите минимум 2 блюда для голосования
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

        {/* Items List */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {visibleItems.map((item) => {
            const isSelected = selectedItems.has(item.id);
            
            return (
              <motion.button
                key={item.id}
                layout
                onClick={() => toggleItem(item.id)}
                className={cn(
                  "w-full text-left p-3 rounded-2xl border-2 transition-all",
                  isSelected
                    ? isDark
                      ? "border-lavender-500 bg-lavender-500/5"
                      : "border-peach-500 bg-peach-50"
                    : "border-border bg-background"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {isSelected ? (
                      <CheckCircle2 className={cn(
                        ICON_SIZES.md,
                        isDark ? "text-lavender-500" : "text-peach-500"
                      )} />
                    ) : (
                      <Circle className={`${ICON_SIZES.md} text-muted-foreground/30`} />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {item.name}
                    </h4>
                  </div>

                  {item.price && (
                    <div className={cn(
                      "flex-shrink-0 px-2 py-1 rounded-md",
                      isDark ? "bg-lavender-900/20 text-lavender-400" : "bg-peach-50 text-peach-700"
                    )}>
                      <p className="text-sm font-semibold whitespace-nowrap">
                        {item.price} ₽
                      </p>
                    </div>
                  )}

                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className={`${ICON_SIZES['2xl']} object-cover rounded-lg`}
                    />
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

            {/* Show More Button */}
            {hasMore && (
              <button
                onClick={() => {
                  setShowAllItems(!showAllItems);
                }}
                className={cn(
                  "w-full mt-3 py-2 text-sm font-medium flex items-center justify-center gap-1 hover:underline transition-colors",
                  isDark ? "text-lavender-500" : "text-peach-500"
                )}
              >
                {showAllItems ? (
                  <>
                    <span>Показать меньше</span>
                    <ChevronUp className={ICON_SIZES.sm} />
                  </>
                ) : (
                  <>
                    <span>Показать все ({menuItems.length - 5} еще)</span>
                    <ChevronDown className={ICON_SIZES.sm} />
                  </>
                )}
              </button>
            )}
          </CardContent>
        </PastelCard>
      </motion.div>

        {/* Error Alert - показывается перед кнопками */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-300 dark:border-red-700 shadow-lg"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className={cn(ICON_SIZES.md, "text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5")} />
                <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <motion.button
            whileTap={{ scale: canCreatePoll() ? 0.95 : 1 }}
            onClick={handleCreate}
            disabled={!canCreatePoll() || creating}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg",
              canCreatePoll() && !creating
                ? isDark
                  ? "bg-gradient-to-r from-lavender-500 to-lavender-600 text-white shadow-lavender-500/30 hover:shadow-lavender-500/50"
                  : "bg-gradient-to-r from-peach-500 to-coral-500 text-white shadow-peach-500/30 hover:shadow-peach-500/50"
                : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            )}
          >
            {creating ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Запуск голосования...</span>
              </>
            ) : (
              <>
                <Check className={ICON_SIZES.md} />
                <span>Запустить голосование</span>
              </>
            )}
          </motion.button>
        </div>
          </div>
          </motion.div>
        )}

        {/* Recurring Poll Form */}
        {activeTab === 'recurring' && (
          <motion.div
            key="recurring"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <RecurringPollForm
              menuItems={menuItems}
              selectedGroupId={selectedGroupId}
              onSuccess={() => {
                haptic.success();
                onSuccess?.(0); // No pollId for recurring schedules
              }}
              onCancel={onCancel}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
