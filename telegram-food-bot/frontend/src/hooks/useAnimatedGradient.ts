import { useState, useEffect, useMemo } from 'react';
import { TimeOfDay } from './useTimeBasedGradient';
import {
  GradientVariant,
  AnimationSpeed,
  IntensityLevel,
  AnimatedGradientConfig,
  GradientColors,
  getTimeOfDayColors,
  getGradientByVariant,
  getAnimatedGradientStyles,
  ANIMATION_CLASSES,
} from '@/lib/animatedGradients';

interface UseAnimatedGradientOptions {
  variant?: GradientVariant;
  speed?: AnimationSpeed;
  intensity?: IntensityLevel;
  timeOfDay?: TimeOfDay | 'auto';
  theme?: 'light' | 'dark' | 'auto';
  customColors?: GradientColors;
  enabled?: boolean;
}

interface UseAnimatedGradientReturn {
  gradient: string;
  animationClass: string;
  styles: React.CSSProperties;
  colors: GradientColors;
  currentTimeOfDay: TimeOfDay;
  isEnabled: boolean;
}

/**
 * Определяет время суток на основе текущего часа
 */
function getCurrentTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 11) {
    return 'morning';
  } else if (hour >= 11 && hour < 16) {
    return 'afternoon';
  } else if (hour >= 16 && hour < 22) {
    return 'evening';
  } else {
    return 'night';
  }
}

/**
 * Hook для управления анимированным градиентом
 * 
 * @param options - опции конфигурации градиента
 * @returns объект с CSS градиентом, стилями и утилитами
 * 
 * @example
 * ```tsx
 * const { gradient, animationClass, styles } = useAnimatedGradient({
 *   variant: 'diagonal',
 *   speed: 'medium',
 *   intensity: 'subtle',
 *   timeOfDay: 'auto'
 * });
 * 
 * return (
 *   <div 
 *     className={animationClass}
 *     style={{
 *       background: gradient,
 *       ...styles
 *     }}
 *   />
 * );
 * ```
 */
export function useAnimatedGradient(
  options: UseAnimatedGradientOptions = {}
): UseAnimatedGradientReturn {
  const {
    variant = 'diagonal',
    speed = 'slow',
    intensity = 'subtle',
    timeOfDay = 'auto',
    theme = 'auto',
    customColors,
    enabled = true,
  } = options;

  // Определяем текущее время суток
  const [currentTimeOfDay, setCurrentTimeOfDay] = useState<TimeOfDay>(() => {
    if (timeOfDay === 'auto') {
      return getCurrentTimeOfDay();
    }
    return timeOfDay;
  });

  // Определяем тему (light/dark)
  const [isDark, setIsDark] = useState(() => {
    if (theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme === 'dark';
  });

  // Проверяем prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Обновляем время суток
  useEffect(() => {
    if (timeOfDay !== 'auto') return;

    const updateTimeOfDay = () => {
      setCurrentTimeOfDay(getCurrentTimeOfDay());
    };

    // Обновляем каждую минуту
    const interval = setInterval(updateTimeOfDay, 60000);

    return () => clearInterval(interval);
  }, [timeOfDay]);

  // Слушаем изменение темы
  useEffect(() => {
    if (theme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Слушаем prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Получаем цветовую палитру
  const colors = useMemo<GradientColors>(() => {
    if (customColors) {
      return customColors;
    }
    return getTimeOfDayColors(currentTimeOfDay, isDark);
  }, [currentTimeOfDay, isDark, customColors]);

  // Генерируем градиент
  const gradient = useMemo(() => {
    return getGradientByVariant(variant, colors);
  }, [variant, colors]);

  // Получаем класс анимации
  const animationClass = useMemo(() => {
    // Если prefers-reduced-motion, не применяем анимацию
    if (prefersReducedMotion || !enabled) {
      return '';
    }
    return ANIMATION_CLASSES[variant];
  }, [variant, prefersReducedMotion, enabled]);

  // Генерируем стили
  const styles = useMemo(() => {
    const config: AnimatedGradientConfig = {
      variant,
      speed: prefersReducedMotion ? 'slow' : speed,
      intensity,
      timeOfDay: currentTimeOfDay,
      theme: isDark ? 'dark' : 'light',
      colors,
    };

    const baseStyles = getAnimatedGradientStyles(config);

    // Добавляем оптимизацию для GPU
    return {
      ...baseStyles,
      willChange: enabled && !prefersReducedMotion ? 'background-position' : 'auto',
      transform: 'translateZ(0)',
      backfaceVisibility: 'hidden' as const,
    };
  }, [variant, speed, intensity, currentTimeOfDay, isDark, colors, prefersReducedMotion, enabled]);

  return {
    gradient,
    animationClass,
    styles,
    colors,
    currentTimeOfDay,
    isEnabled: enabled && !prefersReducedMotion,
  };
}

/**
 * Hook для получения CSS переменных анимированного градиента
 * 
 * @example
 * ```tsx
 * const cssVars = useAnimatedGradientVars({
 *   variant: 'mesh',
 *   intensity: 'medium'
 * });
 * 
 * return <div style={cssVars}>Content</div>;
 * ```
 */
export function useAnimatedGradientVars(
  options: UseAnimatedGradientOptions = {}
): React.CSSProperties {
  const { gradient, styles, colors } = useAnimatedGradient(options);

  return {
    '--gradient-background': gradient,
    '--gradient-primary-0': colors.primary[0] || 'transparent',
    '--gradient-primary-1': colors.primary[1] || 'transparent',
    '--gradient-primary-2': colors.primary[2] || 'transparent',
    '--gradient-primary-3': colors.primary[3] || 'transparent',
    ...styles,
  } as React.CSSProperties;
}
