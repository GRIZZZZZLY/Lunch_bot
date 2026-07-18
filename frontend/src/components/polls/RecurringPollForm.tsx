/**
 * RecurringPollForm - Форма настройки автоматических голосований (Variant B)
 *
 * Features:
 * - Выбор дней недели
 * - Время запуска
 * - Длительность голосования
 * - Выбор блюд (опционально)
 * - Превью следующего запуска
 */

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  Circle,
  AlertCircle,
  Utensils,
  Check,
  Shuffle,
  Loader,
  Info,
  Sparkles,
} from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useHaptic';
import { MenuItem } from '@/services/menu.service';
import { recurringPollService, RecurringPoll } from '@/services/recurring-poll.service';
import { ICON_SIZES } from '@/lib/design-tokens';

const sectionLabel = (text: string) => (
  <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
    {text}
  </p>
);


interface RecurringPollFormProps {
  menuItems: MenuItem[];
  selectedGroupId: number | null;
  onSuccess?: () => void;
  onCancel?: () => void;
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

const parseNumberList = (
  value: number[] | string | null | undefined,
  fallback: number[] = []
): number[] => {
  if (Array.isArray(value)) {
    return value.reduce<number[]>((numbers, item) => {
      const number = Number(item);
      if (Number.isFinite(number)) numbers.push(number);
      return numbers;
    }, []);
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const numbers = parsed.reduce<number[]>((result, item) => {
        const number = Number(item);
        if (Number.isFinite(number)) result.push(number);
        return result;
      }, []);
      return numbers.length > 0 ? numbers : fallback;
    }
  } catch {
    const singleValue = Number(value);
    return Number.isFinite(singleValue) ? [singleValue] : fallback;
  }

  const singleValue = Number(value);
  return Number.isFinite(singleValue) ? [singleValue] : fallback;
};

const useRecurringPollFormController = ({
  menuItems,
  selectedGroupId,
  onSuccess,
  onCancel,
}: RecurringPollFormProps) => {
  const haptic = useHaptic();

  // Определяем тему: проверяем CSS класс 'dark' на документе
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  // Следим за изменениями темы через MutationObserver
  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    updateTheme();

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
  const [existingSchedule, setExistingSchedule] = useState<RecurringPoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedDays, setSelectedDays] = useState<Set<number>>(
    () => new Set([1, 2, 3, 4, 5])
  ); // Mon-Fri по умолчанию
  const [timeOfDay, setTimeOfDay] = useState('11:00');
  const [duration, setDuration] = useState(30);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(() => new Set());
  const [useAllItems, setUseAllItems] = useState(true);

  // Load existing schedule
  const loadSchedule = useCallback(async () => {
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
        setSelectedDays(new Set(parseNumberList(schedule.daysOfWeek, [1, 2, 3, 4, 5])));
        setTimeOfDay(schedule.timeOfDay);
        setDuration(schedule.duration);

        if (schedule.selectedMenuItemIds) {
          setSelectedItems(new Set(parseNumberList(schedule.selectedMenuItemIds)));
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
  }, [menuItems, selectedGroupId]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

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
      setError('Заполни все поля корректно');
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
    } catch (err: unknown) {
      console.error('[RecurringPollForm] Error saving schedule:', err);

      let errorMessage = 'Ошибка сохранения расписания';

      const errorObj = err as { error?: string; message?: string };
      const errorText = errorObj?.error || errorObj?.message || '';

      if (errorText.includes('already has a recurring poll')) {
        errorMessage = 'У этой группы уже есть расписание. Обнови существующее.';
      } else if (errorText.includes('Invalid time format')) {
        errorMessage = 'Неверный формат времени. Используй HH:MM';
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

    // Частичный Фишер-Йейтс: перемешиваем только первые count позиций
    const pool = [...menuItems];
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const randomItems = pool.slice(0, count);
    setSelectedItems(new Set(randomItems.map(item => item.id)));
    setUseAllItems(false);
  };

  // Quick presets
  const selectWeekdays = () => {
    setSelectedDays(new Set([1, 2, 3, 4, 5]));
    haptic.impact();
  };

  const selectEveryDay = () => {
    setSelectedDays(new Set([0, 1, 2, 3, 4, 5, 6]));
    haptic.impact();
  };

  // Preview next run
  const getNextRunPreview = (): string => {
    const now = new Date();
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    // Находим ближайший день
    const nextDate = new Date(now);
    nextDate.setHours(hours, minutes, 0, 0);

    // Если сегодняшнее время уже прошло, начинаем с завтра
    if (nextDate <= now) {
      nextDate.setDate(nextDate.getDate() + 1);
    }

    // Ищем ближайший день из selectedDays
    for (let i = 0; i < 7; i++) {
      const dayOfWeek = nextDate.getDay();
      if (selectedDays.has(dayOfWeek)) {
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

  // Helpers (Variant B)
  const accentText = isDark ? 'text-lavender-400' : 'text-peach-600';
  const rowSeparator = isDark ? 'border-white/[0.04]' : 'border-black/[0.05]';
  const chipClass =
    'px-2.5 py-1 text-xs font-medium rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors';
  const selectedTile = isDark
    ? 'border-lavender-500/40 bg-lavender-500/12'
    : 'border-peach-500/35 bg-peach-500/10';

  return { haptic, isDark, setIsDark, existingSchedule, setExistingSchedule, loading, setLoading, saving, setSaving, error, setError, selectedDays, setSelectedDays, timeOfDay, setTimeOfDay, duration, setDuration, selectedItems, setSelectedItems, useAllItems, setUseAllItems, loadSchedule, canSaveSchedule, handleSave, toggleDay, toggleItem, selectAllItems, selectRandomItems, selectWeekdays, selectEveryDay, getNextRunPreview, accentText, rowSeparator, chipClass, selectedTile };
};

export const RecurringPollForm = ({
  menuItems,
  selectedGroupId,
  onSuccess,
  onCancel,
}: RecurringPollFormProps) => {
  const { haptic, isDark, setIsDark, existingSchedule, setExistingSchedule, loading, setLoading, saving, setSaving, error, setError, selectedDays, setSelectedDays, timeOfDay, setTimeOfDay, duration, setDuration, selectedItems, setSelectedItems, useAllItems, setUseAllItems, loadSchedule, canSaveSchedule, handleSave, toggleDay, toggleItem, selectAllItems, selectRandomItems, selectWeekdays, selectEveryDay, getNextRunPreview, accentText, rowSeparator, chipClass, selectedTile } = useRecurringPollFormController({ menuItems, selectedGroupId, onSuccess, onCancel });
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
        <p className="text-muted-foreground">Сначала выбери группу</p>
      </div>
    );
  }

  return (
    <div className="px-6 pt-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] space-y-6">
      {/* Превью следующего запуска */}
      <div className="rounded-2xl border border-border/60 p-4 bg-gradient-to-br from-primary/10 to-coral-500/5 dark:from-lavender-500/12 dark:to-primary/6">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-2xl',
            isDark ? 'bg-lavender-500/14 text-lavender-400' : 'bg-peach-500/14 text-peach-600'
          )}>
            <Sparkles className={ICON_SIZES.md} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Следующий запуск
            </p>
            <p className={cn('text-lg font-extrabold tracking-tight tabular-nums', accentText)}>
              {getNextRunPreview()}
            </p>
          </div>
        </div>
      </div>

      {/* Дни недели */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className={cn(ICON_SIZES.xs, 'text-muted-foreground')} />
            {sectionLabel('Дни недели')}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={selectWeekdays} className={chipClass}>Пн-Пт</button>
            <button type="button" onClick={selectEveryDay} className={chipClass}>Все дни</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {DAYS_OF_WEEK.map(day => (
            <m.button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              whileTap={{ scale: 0.9 }}
              animate={selectedDays.has(day.value) ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.2 }}
              className={cn(
                'aspect-square rounded-xl font-semibold text-sm transition-all',
                'flex items-center justify-center',
                selectedDays.has(day.value)
                  ? isDark
                    ? 'bg-gradient-to-br from-lavender-500 to-lavender-600 text-white shadow-lg shadow-lavender-500/25'
                    : 'bg-gradient-to-br from-peach-500 to-coral-500 text-white shadow-lg shadow-peach-500/25'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {day.label}
            </m.button>
          ))}
        </div>
      </div>

      {/* Время запуска */}
      <div className={cn('space-y-3 pt-5 border-t', rowSeparator)}>
        {sectionLabel('Время запуска')}
        <input
          aria-label="Время запуска голосования"
          type="time"
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value)}
          className={cn(
            'w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground tabular-nums',
            'focus:outline-none focus:ring-2 transition-colors',
            isDark ? 'focus:ring-lavender-500/40' : 'focus:ring-peach-500/40'
          )}
        />
      </div>

      {/* Длительность */}
      <div className={cn('space-y-3 pt-5 border-t', rowSeparator)}>
        <div className="flex items-center justify-between">
          {sectionLabel('Длительность')}
          <span className={cn('text-sm font-bold tabular-nums', accentText)}>
            {duration} мин
          </span>
        </div>
        <input
          aria-label="Длительность голосования в минутах"
          type="range"
          min="5"
          max="180"
          step="5"
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value))}
          className="w-full adaptive-slider"
          style={{
            '--slider-progress': `${Math.min(
              100,
              Math.max(0, ((duration - 5) / 175) * 100)
            )}%`,
          } as CSSProperties}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>5 мин</span>
          <span>180 мин</span>
        </div>
      </div>

      {/* Блюда в меню */}
      <div className={cn('space-y-3 pt-5 border-t', rowSeparator)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Utensils className={cn(ICON_SIZES.xs, 'text-muted-foreground')} />
            {sectionLabel(`Блюда (${useAllItems ? 'все' : selectedItems.size})`)}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={selectAllItems} className={chipClass}>Все</button>
            <button type="button" onClick={selectRandomItems} className={cn(chipClass, 'flex items-center gap-1')}>
              <Shuffle className={ICON_SIZES.xs} />
              Случайно
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
          {menuItems.map(item => {
            const isSelected = selectedItems.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleItem(item.id)}
                className={cn(
                  'p-3 rounded-2xl text-left transition-all flex items-center gap-3 border',
                  isSelected ? selectedTile : 'bg-background border-border'
                )}
              >
                {isSelected ? (
                  <CheckCircle2 className={cn(ICON_SIZES.md, 'flex-shrink-0', accentText)} />
                ) : (
                  <Circle className={`${ICON_SIZES.md} text-muted-foreground/30 flex-shrink-0`} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.name}
                  </p>
                  {item.price && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {item.price} ₽
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Инфо */}
      <div className="flex gap-3 rounded-2xl bg-muted/40 p-3.5">
        <Info className={cn(ICON_SIZES.sm, 'flex-shrink-0 mt-0.5', accentText)} />
        <div className="text-xs text-muted-foreground space-y-1 leading-relaxed">
          <p>
            <strong className="text-foreground">Автозапуск:</strong> голосования создаются в выбранные дни и время.
          </p>
          <p>Если голосование уже активно — автозапуск пропускается.</p>
        </div>
      </div>

      {/* Ошибка */}
      <AnimatePresence>
        {error && (
          <m.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-coral-500/10 border border-coral-500/25"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className={`${ICON_SIZES.md} text-coral-500 flex-shrink-0`} />
              <p className="text-sm text-coral-600 dark:text-coral-400">{error}</p>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Действия */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-3.5 rounded-xl font-semibold bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
        )}
        <m.button
          type="button"
          whileTap={{ scale: canSaveSchedule() && !saving ? 0.97 : 1 }}
          onClick={handleSave}
          disabled={!canSaveSchedule() || saving}
          className={cn(
            'flex-1 py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-lg',
            canSaveSchedule() && !saving
              ? isDark
                ? 'bg-gradient-to-r from-lavender-500 to-lavender-600 shadow-lavender-500/30'
                : 'bg-gradient-to-r from-peach-500 to-coral-500 shadow-peach-500/30'
              : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed shadow-none'
          )}
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
        </m.button>
      </div>
    </div>
  );
};
