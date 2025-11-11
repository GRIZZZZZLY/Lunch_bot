/**
 * RecurringPollForm - Форма настройки автоматических голосований
 * 
 * Features:
 * - Выбор дней недели
 * - Время запуска
 * - Длительность голосования
 * - Выбор блюд (опционально)
 * - Превью следующего запуска
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Calendar,
  CheckCircle2,
  Circle,
  AlertCircle,
  Utensils,
  Check,
  Shuffle,
  Loader,
  RotateCcw,
  Info,
  Sparkles,
} from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PastelCard, CardContent } from '../ui/pastel-card';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useHaptic';
import { MenuItem } from '@/services/menu.service';
import { Group } from '@/services/user.service';
import { recurringPollService, RecurringPoll } from '@/services/recurring-poll.service';
import { ICON_SIZES } from '@/lib/design-tokens';

interface RecurringPollFormProps {
  groups: Group[];
  menuItems: MenuItem[];
  selectedGroupId: number | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Пн', fullLabel: 'Понедельник' },
  { value: 2, label: 'Вт', fullLabel: 'Вторник' },
  { value: 3, label: 'Ср', fullLabel: 'Среда' },
  { value: 4, label: 'Чт', fullLabel: 'Четверг' },
  { value: 5, label: 'Пт', fullLabel: 'Пятница' },
  { value: 6, label: 'Сб', fullLabel: 'Суббота' },
  { value: 0, label: 'Вс', fullLabel: 'Воскресенье' },
];

export const RecurringPollForm: React.FC<RecurringPollFormProps> = ({
  groups,
  menuItems,
  selectedGroupId,
  onSuccess,
  onCancel,
  compact = true,
}) => {
  const haptic = useHaptic();

  // State
  const [existingSchedule, setExistingSchedule] = useState<RecurringPoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5])); // Mon-Fri по умолчанию
  const [timeOfDay, setTimeOfDay] = useState('11:00');
  const [duration, setDuration] = useState(30);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [useAllItems, setUseAllItems] = useState(true);

  // Load existing schedule
  useEffect(() => {
    loadSchedule();
  }, [selectedGroupId]);

  const loadSchedule = async () => {
    if (!selectedGroupId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await recurringPollService.getGroupSchedule(selectedGroupId);

      if (response.success && response.data) {
        const schedule = response.data;
        setExistingSchedule(schedule);
        setSelectedDays(new Set(Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek.map(Number) : [Number(schedule.daysOfWeek)]));
        setTimeOfDay(schedule.timeOfDay);
        setDuration(schedule.duration);

        if (schedule.selectedMenuItemIds) {
          setSelectedItems(new Set(Array.isArray(schedule.selectedMenuItemIds) ? schedule.selectedMenuItemIds.map(Number) : [Number(schedule.selectedMenuItemIds)]));
          setUseAllItems(false);
        } else {
          setSelectedItems(new Set(menuItems.map(item => item.id)));
          setUseAllItems(true);
        }
      } else {
        // Нет расписания - используем defaults
        setExistingSchedule(null);
        setSelectedItems(new Set(menuItems.map(item => item.id)));
        setUseAllItems(true);
      }
    } catch (err) {
      console.error('[RecurringPollForm] Error loading schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const canSaveSchedule = (): boolean => {
    return (
      selectedGroupId !== null &&
      selectedDays.size > 0 &&
      timeOfDay.length > 0 &&
      duration >= 5 &&
      duration <= 180 &&
      (useAllItems || selectedItems.size >= 2)
    );
  };

  const handleSave = async () => {
    if (!canSaveSchedule() || !selectedGroupId) {
      setError('Заполните все поля корректно');
      haptic.error();
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const data = {
        groupId: selectedGroupId,
        daysOfWeek: Array.from(selectedDays),
        timeOfDay,
        duration,
        selectedMenuItemIds: useAllItems ? null : Array.from(selectedItems),
      };

      let response;
      if (existingSchedule) {
        // Update existing
        response = await recurringPollService.updateSchedule(
          existingSchedule.id,
          selectedGroupId,
          data
        );
      } else {
        // Create new
        response = await recurringPollService.createSchedule(data);
      }

      if (response.success) {
        haptic.success();
        onSuccess?.();
      } else {
        throw new Error(response.error || 'Failed to save schedule');
      }
    } catch (err: any) {
      console.error('[RecurringPollForm] Error saving schedule:', err);

      let errorMessage = 'Ошибка сохранения расписания';

      const errorText = err.error || err.message || '';

      if (errorText.includes('already has a recurring poll')) {
        errorMessage = 'У этой группы уже есть расписание. Обновите существующее.';
      } else if (errorText.includes('Invalid time format')) {
        errorMessage = 'Неверный формат времени. Используйте HH:MM';
      } else if (errorText.includes('Duration must be')) {
        errorMessage = 'Длительность должна быть от 5 до 180 минут';
      } else if (errorText.includes('Access denied')) {
        errorMessage = 'Недостаточно прав. Требуется роль администратора.';
      } else if (errorText) {
        errorMessage = `Ошибка: ${errorText}`;
      }

      setError(errorMessage);
      haptic.error();
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    const newDays = new Set(selectedDays);
    if (newDays.has(day)) {
      if (newDays.size > 1) {
        // Оставляем минимум 1 день
        newDays.delete(day);
      }
    } else {
      newDays.add(day);
    }
    setSelectedDays(newDays);
    haptic.impact();
  };

  const toggleItem = (itemId: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      if (newSelected.size > 2 || useAllItems) {
        newSelected.delete(itemId);
      }
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    setUseAllItems(false);
  };

  const selectAllItems = () => {
    setSelectedItems(new Set(menuItems.map(item => item.id)));
    setUseAllItems(true);
    haptic.impact();
  };

  const selectRandomItems = () => {
    haptic.impact();
    const maxCount = Math.min(6, menuItems.length);
    const minCount = Math.min(3, menuItems.length);
    const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;

    const shuffled = [...menuItems].sort(() => Math.random() - 0.5);
    const randomItems = shuffled.slice(0, count);
    setSelectedItems(new Set(randomItems.map(item => item.id)));
    setUseAllItems(false);
  };

  // Quick presets
  const selectWeekdays = () => {
    setSelectedDays(new Set([1, 2, 3, 4, 5]));
    haptic.impact();
  };

  const selectWeekend = () => {
    setSelectedDays(new Set([6, 0]));
    haptic.impact();
  };

  const selectEveryDay = () => {
    setSelectedDays(new Set([0, 1, 2, 3, 4, 5, 6]));
    haptic.impact();
  };

  // Preview next run
  const getNextRunPreview = (): string => {
    const daysArray = Array.from(selectedDays).sort();
    const now = new Date();
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    // Находим ближайший день
    let nextDate = new Date(now);
    nextDate.setHours(hours, minutes, 0, 0);

    // Если сегодняшнее время уже прошло, начинаем с завтра
    if (nextDate <= now) {
      nextDate.setDate(nextDate.getDate() + 1);
    }

    // Ищем ближайший день из selectedDays
    for (let i = 0; i < 7; i++) {
      const dayOfWeek = nextDate.getDay();
      if (daysArray.includes(dayOfWeek)) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);

        if (nextDate.toDateString() === tomorrow.toDateString()) {
          return `Завтра в ${timeOfDay}`;
        } else if (nextDate.toDateString() === now.toDateString()) {
          return `Сегодня в ${timeOfDay}`;
        } else {
          const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
          return `${dayNames[dayOfWeek]} в ${timeOfDay}`;
        }
      }
      nextDate.setDate(nextDate.getDate() + 1);
    }

    return 'Не запланировано';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!selectedGroupId) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className={`${ICON_SIZES['2xl']} mx-auto mb-4 text-yellow-500`} />
        <p className="text-gray-600 dark:text-gray-400">
          Сначала выберите группу
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Preview Banner */}
      <PastelCard variant="lavender" className="border-pastel-lavender-400">
        <CardContent className="p-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Sparkles className={`${ICON_SIZES.md} text-purple-500`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Следующее голосование:
              </p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {getNextRunPreview()}
              </p>
            </div>
          </div>
        </CardContent>
      </PastelCard>

      {/* Days of Week */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Calendar className={ICON_SIZES.sm} />
            Дни недели
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectWeekdays}
              className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Пн-Пт
            </button>
            <button
              type="button"
              onClick={selectEveryDay}
              className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Все дни
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {DAYS_OF_WEEK.map(day => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={cn(
                'aspect-square rounded-xl font-medium text-sm transition-all',
                'flex items-center justify-center',
                selectedDays.has(day.value)
                  ? 'bg-purple-500 text-white shadow-lg scale-105'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              )}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time of Day */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Clock className={ICON_SIZES.sm} />
          Время запуска
        </label>
        <input
          type="time"
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Duration */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <RotateCcw className={ICON_SIZES.sm} />
            Длительность
          </label>
          <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
            {duration} мин
          </span>
        </div>
        <input
          type="range"
          min="5"
          max="180"
          step="5"
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-400">
          <span>5 мин</span>
          <span>180 мин</span>
        </div>
      </div>

      {/* Menu Items Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Utensils className={ICON_SIZES.sm} />
            Блюда в меню ({useAllItems ? 'все' : selectedItems.size})
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAllItems}
              className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Все
            </button>
            <button
              type="button"
              onClick={selectRandomItems}
              className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-1"
            >
              <Shuffle className={ICON_SIZES.xs} />
              Случайно
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
          {menuItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleItem(item.id)}
              className={cn(
                'p-3 rounded-xl text-left transition-all flex items-center gap-3',
                selectedItems.has(item.id)
                  ? 'bg-purple-500/10 border border-purple-500/30'
                  : 'bg-gray-100 dark:bg-gray-800 border border-transparent'
              )}
            >
              {selectedItems.has(item.id) ? (
                <CheckCircle2 className={`${ICON_SIZES.md} text-purple-500 flex-shrink-0`} />
              ) : (
                <Circle className={`${ICON_SIZES.md} text-gray-400 flex-shrink-0`} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.name}
                </p>
                {item.price && (
                  <p className="text-xs text-muted-foreground">
                    {item.price} ₽
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <PastelCard variant="sky" className="border-pastel-sky-400">
        <CardContent className="p-4 pt-4">
          <div className="flex gap-3">
            <Info className={`${ICON_SIZES.md} text-blue-500 flex-shrink-0 mt-0.5`} />
            <div className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
              <p>
                <strong>Автоматический запуск:</strong> Голосования будут создаваться в выбранные дни и время.
              </p>
              <p>
                Если голосование уже активно, автозапуск будет пропущен.
              </p>
            </div>
          </div>
        </CardContent>
      </PastelCard>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/20"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className={`${ICON_SIZES.md} text-red-500 flex-shrink-0`} />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSaveSchedule() || saving}
          className="flex-1 py-3 rounded-xl font-medium bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader className={`${ICON_SIZES.md} animate-spin`} />
              Сохранение...
            </>
          ) : (
            <>
              <Check className={ICON_SIZES.md} />
              {existingSchedule ? 'Обновить расписание' : 'Создать расписание'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
