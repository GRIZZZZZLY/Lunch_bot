import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAnimatedGradient } from '@/hooks/useAnimatedGradient';
import { GradientVariant, AnimationSpeed, IntensityLevel, GradientColors } from '@/lib/animatedGradients';
import { TimeOfDay } from '@/hooks/useTimeBasedGradient';

export interface AnimatedGradientBackgroundProps {
  /**
   * Вариант градиента
   * @default 'diagonal'
   */
  variant?: GradientVariant;
  
  /**
   * Скорость анимации
   * @default 'slow'
   */
  speed?: AnimationSpeed;
  
  /**
   * Интенсивность градиента
   * @default 'subtle'
   */
  intensity?: IntensityLevel;
  
  /**
   * Время суток для цветовой палитры
   * @default 'auto'
   */
  timeOfDay?: TimeOfDay | 'auto';
  
  /**
   * Тема (light/dark)
   * @default 'auto'
   */
  theme?: 'light' | 'dark' | 'auto';
  
  /**
   * Кастомная цветовая палитра
   */
  customColors?: GradientColors;
  
  /**
   * Добавить затемняющий overlay для улучшения читаемости
   * @default false
   */
  overlay?: boolean;
  
  /**
   * Прозрачность overlay (0-1)
   * @default 0.05
   */
  overlayOpacity?: number;
  
  /**
   * Включить/выключить анимацию
   * @default true
   */
  enabled?: boolean;
  
  /**
   * Дополнительные CSS классы
   */
  className?: string;
  
  /**
   * Inline стили
   */
  style?: React.CSSProperties;
  
  /**
   * z-index для позиционирования
   * @default -10
   */
  zIndex?: number;
  
  /**
   * Использовать framer-motion для дополнительной анимации появления
   * @default true
   */
  animate?: boolean;
}

/**
 * AnimatedGradientBackground - Анимированный градиентный фон
 * 
 * Создаёт плавный анимированный градиентный фон с поддержкой
 * различных вариантов, скоростей и интенсивности.
 * 
 * @component
 * @example
 * ```tsx
 * // Базовое использование
 * <AnimatedGradientBackground
 *   variant="diagonal"
 *   speed="slow"
 *   intensity="subtle"
 * />
 * 
 * // С настройкой времени суток
 * <AnimatedGradientBackground
 *   variant="wave"
 *   speed="medium"
 *   intensity="medium"
 *   timeOfDay="evening"
 *   overlay
 * />
 * 
 * // Mesh градиент с кастомными цветами
 * <AnimatedGradientBackground
 *   variant="mesh"
 *   speed="fast"
 *   intensity="vibrant"
 *   customColors={{
 *     primary: ['rgba(255, 0, 0, 0.3)', 'rgba(0, 255, 0, 0.3)'],
 *     secondary: ['rgba(0, 0, 255, 0.2)']
 *   }}
 * />
 * ```
 */
export const AnimatedGradientBackground = React.forwardRef<
  HTMLDivElement,
  AnimatedGradientBackgroundProps
>(
  (
    {
      variant = 'diagonal',
      speed = 'slow',
      intensity = 'subtle',
      timeOfDay = 'auto',
      theme = 'auto',
      customColors,
      overlay = false,
      overlayOpacity = 0.05,
      enabled = true,
      className,
      style,
      zIndex = -10,
      animate = true,
    },
    ref
  ) => {
    const { gradient, animationClass, styles, isEnabled } = useAnimatedGradient({
      variant,
      speed,
      intensity,
      timeOfDay,
      theme,
      customColors,
      enabled,
    });

    const combinedStyles: React.CSSProperties = {
      background: gradient,
      ...styles,
      ...style,
      zIndex,
    };

    const baseClasses = cn(
      'inset-0',
      'pointer-events-none',
      'transition-opacity duration-1000',
      animationClass,
      className
    );

    // Используем motion.div если включена анимация появления
    if (animate) {
      return (
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={{ opacity: isEnabled ? 1 : 0.5 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          className={baseClasses}
          style={combinedStyles}
        >
          {/* Overlay для улучшения читаемости контента */}
          {overlay && (
            <div
              className="absolute inset-0 bg-black transition-opacity duration-500"
              style={{ opacity: overlayOpacity }}
            />
          )}
        </motion.div>
      );
    }

    // Обычный div без motion анимации
    return (
      <div ref={ref} className={baseClasses} style={combinedStyles}>
        {/* Overlay для улучшения читаемости контента */}
        {overlay && (
          <div
            className="absolute inset-0 bg-black transition-opacity duration-500"
            style={{ opacity: overlayOpacity }}
          />
        )}
      </div>
    );
  }
);

AnimatedGradientBackground.displayName = 'AnimatedGradientBackground';
