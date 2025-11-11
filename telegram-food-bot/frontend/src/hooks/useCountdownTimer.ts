import { useState, useEffect, useCallback } from 'react';

interface CountdownResult {
  /** Оставшееся время в миллисекундах */
  remainingMs: number;
  /** Оставшееся время в секундах (округлённое) */
  remainingSeconds: number;
  /** Отформатированная строка времени (например "15:30" или "2:45") */
  formattedTime: string;
  /** Истекло ли время */
  isExpired: boolean;
  /** Осталось меньше минуты */
  isLastMinute: boolean;
  /** Прогресс от 0 до 1 */
  progress: number;
}

/**
 * Хук для обратного отсчёта времени до указанной даты
 * 
 * @param endTime - Время окончания (Date | string | number)
 * @param options - Опции обновления
 * @returns Данные обратного отсчёта
 * 
 * @example
 * ```tsx
 * const { formattedTime, isExpired, isLastMinute } = useCountdownTimer(poll.endTime);
 * 
 * return (
 *   <div className={isLastMinute ? 'text-red-500' : 'text-gray-500'}>
 *     {isExpired ? 'Завершено' : formattedTime}
 *   </div>
 * );
 * ```
 */
export function useCountdownTimer(
  endTime: Date | string | number,
  options: {
    /** Интервал обновления в миллисекундах (по умолчанию 1000) */
    updateInterval?: number;
    /** Callback при истечении времени */
    onExpire?: () => void;
  } = {}
): CountdownResult {
  const { updateInterval = 1000, onExpire } = options;

  // Преобразуем endTime в timestamp с валидацией
  const endTimestamp = typeof endTime === 'number'
    ? endTime
    : new Date(endTime).getTime();

  // Debug: проверяем валидность даты
  if (isNaN(endTimestamp)) {
    console.error('[useCountdownTimer] Invalid endTime:', endTime);
  }

  // Вычисляем начальное оставшееся время
  const calculateRemaining = useCallback(() => {
    const now = Date.now();
    const remaining = Math.max(0, endTimestamp - now);
    return remaining;
  }, [endTimestamp]);

  const [remainingMs, setRemainingMs] = useState(calculateRemaining);

  // Форматируем время в строку "MM:SS" или "HH:MM:SS"
  const formatTime = useCallback((ms: number): string => {
    if (ms <= 0) return '00:00';

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Вычисляем производные значения
  const remainingSeconds = Math.floor(remainingMs / 1000);
  const formattedTime = formatTime(remainingMs);
  const isExpired = remainingMs <= 0;
  const isLastMinute = remainingMs > 0 && remainingMs <= 60000; // 60 секунд

  // Вычисляем прогресс (от начала голосования до конца)
  // Примечание: для точного progress нужно знать startTime, но пока вернём упрощённый вариант
  const progress = isExpired ? 0 : 1 - (remainingMs / (30 * 60 * 1000)); // Предполагаем 30 минут

  // Обновляем таймер
  useEffect(() => {
    if (isExpired) {
      // Если время истекло, вызываем callback один раз
      if (onExpire) {
        onExpire();
      }
      return;
    }

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingMs(remaining);

      // Проверяем истечение времени после обновления
      if (remaining <= 0 && onExpire) {
        onExpire();
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [isExpired, calculateRemaining, updateInterval, onExpire]);

  return {
    remainingMs,
    remainingSeconds,
    formattedTime,
    isExpired,
    isLastMinute,
    progress,
  };
}
