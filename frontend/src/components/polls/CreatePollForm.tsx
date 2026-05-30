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

import React, { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Check,
  Shuffle,
  X,
  ChevronLeft,
  Users,
} from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PastelCard, CardContent } from '../ui/pastel-card';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';
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

      if (menuResponse.success && menuResponse.data) {
        setMenuItems(menuResponse.data);
        // UX FIX: не выбираем все блюда заранее (Paradox of Choice)
        // Админ может нажать «Случайно» или выбрать вручную
      } else {
        console.error('[CreatePollForm] Failed to load menu:', menuResponse.error);
      }

      if (groupsResponse.success && groupsResponse.data) {
        setGroups(groupsResponse.data);
      }
    } catch (err) {
      console.error('[CreatePollForm] Error loading data:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const DURATION_PRESETS = [
    { label: '15м', value: 15 },
    { label: '30м', value: 30 },
    { label: '1ч', value: 60 },
    { label: '2ч', value: 120 },
  ];

  const canAdvance = (): boolean => selectedGroupId !== null;

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

      // Автоматически добавляем «Еда с собой» к выбранным блюдам
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
    haptic.impact();

    // Случайный выбор от 3 до 6 блюд (или меньше, если блюд мало)
    const maxCount = Math.min(6, menuItems.length);
    const minCount = Math.min(3, menuItems.length);
    const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;

    const shuffled = [...menuItems].sort(() => Math.random() - 0.5);
    const randomItems = shuffled.slice(0, count);
    const newSelection = new Set(randomItems.map(item => item.id));

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
  const visibleItems = menuItems;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const canManagePolls = !!user?.isAdmin || adminGroups.length > 0;

  if (!canManagePolls) {
    return (
      <div className="p-6 text-center">
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
      <div className="p-6 text-center">
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

  // Section label — мелкий uppercase muted заголовок секции
  const sectionLabel = (text: string) => (
    <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {text}
    </p>
  );

  const accentText = isDark ? 'text-lavender-400' : 'text-peach-600';
  const rowSeparator = isDark ? 'border-white/[0.04]' : 'border-black/[0.05]';

  return (
    <div>
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-9 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5 px-6 pt-3">
        <div className={cn(
          'flex-1 h-1 rounded-full transition-colors',
          isDark ? 'bg-lavender-500' : 'bg-peach-500'
        )} />
        <div className={cn(
          'flex-1 h-1 rounded-full transition-colors',
          step === 2
            ? isDark ? 'bg-lavender-500' : 'bg-peach-500'
            : 'bg-muted'
        )} />
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-xl font-bold text-foreground">Создать голосование</h2>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="px-6 pb-8 space-y-6">
              {/* Группа */}
              {adminGroups.length > 0 && (
                <div className="space-y-2">
                  {sectionLabel('Группа')}
                  <div className="space-y-1.5">
                    {adminGroups.map((group) => {
                      const isSelected = selectedGroupId === group.id;
                      return (
                        <button
                          key={group.id}
                          onClick={() => { setSelectedGroupId(group.id); haptic.selection(); }}
                          className={cn(
                            'w-full flex items-center gap-3 py-2.5 transition-colors text-left',
                          )}
                        >
                          <div className={cn(
                            'flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0',
                            isDark ? 'bg-lavender-500/12' : 'bg-peach-500/10'
                          )}>
                            <Users className={cn(ICON_SIZES.sm, isDark ? 'text-lavender-400' : 'text-peach-600')} />
                          </div>
                          <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">
                            {group.title}
                          </span>
                          {isSelected
                            ? <CheckCircle2 className={cn('w-5 h-5 flex-shrink-0', isDark ? 'text-lavender-400' : 'text-peach-500')} />
                            : <Circle className="w-5 h-5 flex-shrink-0 text-muted-foreground/30" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Длительность */}
              <div className={cn('space-y-3 pt-5 border-t', rowSeparator)}>
                <div className="flex items-center justify-between">
                  {sectionLabel('Длительность')}
                  <motion.span
                    key={duration}
                    initial={{ scale: 1.15 }}
                    animate={{ scale: 1 }}
                    className={cn('text-sm font-bold', accentText)}
                  >
                    {formatDuration(duration)}
                  </motion.span>
                </div>

                {/* Пресеты */}
                <div className="flex gap-2">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => { setDuration(preset.value); haptic.selection(); }}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-sm font-medium transition-all border',
                        duration === preset.value
                          ? isDark
                            ? 'border-lavender-500/40 bg-lavender-500/15 text-lavender-400'
                            : 'border-peach-500/35 bg-peach-500/10 text-peach-700'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Слайдер */}
                <input
                  type="range"
                  min={5}
                  max={240}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full adaptive-slider"
                  style={{
                    '--slider-progress': `${Math.min(100, Math.max(0, ((duration - 5) / 235) * 100))}%`,
                  } as CSSProperties}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5 мин</span>
                  <span>4 часа</span>
                </div>
              </div>

              {/* Тип голоса */}
              <div className={cn('space-y-3 pt-5 border-t', rowSeparator)}>
                {sectionLabel('Тип голоса')}
                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setIsMultiSelect(false); haptic.selection(); }}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all',
                      !isMultiSelect
                        ? isDark ? 'border-lavender-500/40 bg-lavender-500/15' : 'border-peach-500/35 bg-peach-500/10'
                        : 'border-border bg-background hover:border-muted-foreground/30'
                    )}
                  >
                    <Circle className={cn('w-4 h-4',
                      !isMultiSelect
                        ? isDark ? 'text-lavender-400' : 'text-peach-600'
                        : 'text-muted-foreground'
                    )} />
                    <span className="text-sm font-medium">Одно блюдо</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setIsMultiSelect(true); haptic.selection(); }}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all',
                      isMultiSelect
                        ? isDark ? 'border-lavender-500/40 bg-lavender-500/15' : 'border-peach-500/35 bg-peach-500/10'
                        : 'border-border bg-background hover:border-muted-foreground/30'
                    )}
                  >
                    <CheckCircle2 className={cn('w-4 h-4',
                      isMultiSelect
                        ? isDark ? 'text-lavender-400' : 'text-peach-600'
                        : 'text-muted-foreground'
                    )} />
                    <span className="text-sm font-medium">Несколько</span>
                  </motion.button>
                </div>
              </div>

              {/* Кнопка Далее */}
              <motion.button
                whileTap={{ scale: canAdvance() ? 0.97 : 1 }}
                onClick={() => { if (canAdvance()) { haptic.impact(); setStep(2); } }}
                disabled={!canAdvance()}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-base transition-all shadow-lg',
                  canAdvance()
                    ? isDark
                      ? 'bg-gradient-to-r from-lavender-500 to-lavender-600 text-white shadow-lavender-500/30'
                      : 'bg-gradient-to-r from-peach-500 to-coral-500 text-white shadow-peach-500/30'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                )}
              >
                <span>Далее · Выбрать блюда →</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </button>
              <h2 className="text-lg font-bold text-foreground">Выберите блюда</h2>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="px-6 pb-8 space-y-4">
              <PastelCard variant="default">
                <CardContent className="pt-6">
                  {/* Счётчик + действия */}
                  <div className="flex items-center justify-between mb-3">
                    <motion.p
                      key={selectedItems.size}
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                      className="text-sm text-gray-600 dark:text-gray-400"
                    >
                      Выбрано <span className={cn("font-bold", isDark ? "text-lavender-500" : "text-peach-500")}>
                        {selectedItems.size} {selectedItems.size === 1 ? 'блюдо' : selectedItems.size < 5 ? 'блюда' : 'блюд'}
                      </span>
                    </motion.p>
                    <div className="flex gap-3">
                      <button
                        onClick={toggleAll}
                        className={cn("text-sm font-medium", isDark ? "text-lavender-400" : "text-peach-600")}
                      >
                        {selectedItems.size === menuItems.length ? 'Снять всё' : 'Выбрать всё'}
                      </button>
                      <button
                        onClick={selectRandom}
                        className={cn("text-sm font-medium flex items-center gap-1", isDark ? "text-lavender-400" : "text-peach-600")}
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        Случайно
                      </button>
                    </div>
                  </div>

                  {/* Прогресс выбора */}
                  <Progress
                    value={(selectedItems.size / menuItems.length) * 100}
                    className={cn(
                      "h-2 mb-4",
                      isDark
                        ? "[&>div]:bg-gradient-to-r [&>div]:from-lavender-400 [&>div]:to-lavender-600"
                        : "[&>div]:bg-gradient-to-r [&>div]:from-peach-400 [&>div]:to-coral-500"
                    )}
                  />

                  {/* Подсказка */}
                  <AnimatePresence>
                    {selectedItems.size < 2 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle className={cn(ICON_SIZES.sm, "text-gray-500 flex-shrink-0 mt-0.5")} />
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            Выберите минимум 2 блюда
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Список блюд */}
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
                                <CheckCircle2 className={cn(ICON_SIZES.md, isDark ? "text-lavender-500" : "text-peach-500")} />
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
                                <p className="text-sm font-semibold whitespace-nowrap">{item.price} ₽</p>
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
                </CardContent>
              </PastelCard>

              {/* Ошибка */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-300 dark:border-red-700"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className={cn(ICON_SIZES.md, "text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5")} />
                      <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Запустить */}
              <motion.button
                whileTap={{ scale: canCreatePoll() ? 0.95 : 1 }}
                onClick={handleCreate}
                disabled={!canCreatePoll() || creating}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg",
                  canCreatePoll() && !creating
                    ? isDark
                      ? "bg-gradient-to-r from-lavender-500 to-lavender-600 text-white shadow-lavender-500/30"
                      : "bg-gradient-to-r from-peach-500 to-coral-500 text-white shadow-peach-500/30"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
