import { useState, useEffect } from 'react';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface GradientColors {
  from: string;
  to: string;
  textColor: string;
  timeOfDay: TimeOfDay;
  label: string;
}

const GRADIENTS = {
  morning: {
    light: {
      from: 'rgba(255, 237, 213, 0.7)', // #FFEDD5
      to: 'rgba(254, 215, 170, 0.7)',   // #FED7AA
    },
    dark: {
      from: 'rgba(255, 237, 213, 0.15)',
      to: 'rgba(254, 215, 170, 0.15)',
    },
    textColor: '#9A3412', // primary-food-800
    label: 'завтрака',
  },
  afternoon: {
    light: {
      from: 'rgba(134, 239, 172, 0.7)', // #86EFAC
      to: 'rgba(74, 222, 128, 0.7)',    // #4ADE80
    },
    dark: {
      from: 'rgba(134, 239, 172, 0.15)',
      to: 'rgba(74, 222, 128, 0.15)',
    },
    textColor: '#166534', // green-800
    label: 'обеда',
  },
  evening: {
    light: {
      from: 'rgba(191, 219, 254, 0.7)', // #BFDBFE
      to: 'rgba(147, 197, 253, 0.7)',   // #93C5FD
    },
    dark: {
      from: 'rgba(191, 219, 254, 0.15)',
      to: 'rgba(147, 197, 253, 0.15)',
    },
    textColor: '#1E40AF', // blue-800
    label: 'ужина',
  },
  night: {
    light: {
      from: 'rgba(196, 181, 253, 0.7)', // #C4B5FD
      to: 'rgba(167, 139, 250, 0.7)',   // #A78BFA
    },
    dark: {
      from: 'rgba(196, 181, 253, 0.15)',
      to: 'rgba(167, 139, 250, 0.15)',
    },
    textColor: '#5B21B6', // purple-800
    label: 'перекуса',
  },
} as const;

/**
 * Определяет время суток на основе текущего часа
 */
function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 11) {
    return 'morning';    // 6:00 - 11:00
  } else if (hour >= 11 && hour < 16) {
    return 'afternoon';  // 11:00 - 16:00
  } else if (hour >= 16 && hour < 22) {
    return 'evening';    // 16:00 - 22:00
  } else {
    return 'night';      // 22:00 - 6:00
  }
}

/**
 * Хук для получения адаптивного градиента в зависимости от времени суток
 * 
 * @param isDark - флаг тёмной темы
 * @param updateInterval - интервал обновления в миллисекундах (по умолчанию 60000 = 1 минута)
 * @returns объект с цветами градиента и дополнительной информацией
 * 
 * @example
 * ```tsx
 * const { gradient, textColor, timeOfDay, label } = useTimeBasedGradient(isDark);
 * 
 * <div style={{ background: gradient }}>
 *   <p style={{ color: textColor }}>Текущее время: {label}</p>
 * </div>
 * ```
 */
export function useTimeBasedGradient(
  isDark: boolean = false,
  updateInterval: number = 60000 // 1 минута
): GradientColors & { gradient: string } {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay());
  
  useEffect(() => {
    // Обновляем время суток при монтировании и по таймеру
    const updateTime = () => {
      const newTimeOfDay = getTimeOfDay();
      setTimeOfDay(newTimeOfDay);
    };
    
    // Проверяем сразу
    updateTime();
    
    // Устанавливаем интервал для периодической проверки
    const interval = setInterval(updateTime, updateInterval);
    
    return () => clearInterval(interval);
  }, [updateInterval]);
  
  const gradientConfig = GRADIENTS[timeOfDay];
  const colors = isDark ? gradientConfig.dark : gradientConfig.light;
  
  const gradient = `linear-gradient(135deg, ${colors.from}, ${colors.to})`;
  
  return {
    gradient,
    from: colors.from,
    to: colors.to,
    textColor: gradientConfig.textColor,
    timeOfDay,
    label: gradientConfig.label,
  };
}

/**
 * Хук для получения CSS-переменных времени суток
 * 
 * @example
 * ```tsx
 * const cssVars = useTimeBasedGradientVars(isDark);
 * 
 * <div style={cssVars}>
 *   // Используйте var(--gradient-from) и var(--gradient-to) в CSS
 * </div>
 * ```
 */
export function useTimeBasedGradientVars(isDark: boolean = false) {
  const { from, to, textColor } = useTimeBasedGradient(isDark);
  
  return {
    '--gradient-from': from,
    '--gradient-to': to,
    '--gradient-text': textColor,
  } as React.CSSProperties;
}

/**
 * Утилита для получения градиента по времени суток без хука
 * (полезно для server-side или статических компонентов)
 */
export function getTimeBasedGradientStatic(
  isDark: boolean = false,
  customTime?: TimeOfDay
): GradientColors & { gradient: string } {
  const timeOfDay = customTime || getTimeOfDay();
  const gradientConfig = GRADIENTS[timeOfDay];
  const colors = isDark ? gradientConfig.dark : gradientConfig.light;
  
  const gradient = `linear-gradient(135deg, ${colors.from}, ${colors.to})`;
  
  return {
    gradient,
    from: colors.from,
    to: colors.to,
    textColor: gradientConfig.textColor,
    timeOfDay,
    label: gradientConfig.label,
  };
}
