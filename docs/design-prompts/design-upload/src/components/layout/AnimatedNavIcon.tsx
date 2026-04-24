import React from 'react';
import { motion } from 'framer-motion';

export type NavIconType = 'home' | 'vote' | 'menu' | 'stats' | 'profile';

type AnimationValue = number | number[] | string | string[];
type AnimationMap = Record<NavIconType, Record<string, AnimationValue>>;

interface AnimatedNavIconProps {
  icon: React.FC<{ className?: string }>;
  isActive: boolean;
  type: NavIconType;
  className?: string;
  isDark?: boolean;
}

/**
 * AnimatedNavIcon - анимированная иконка для навигации
 * 
 * Каждый тип иконки имеет свою уникальную анимацию при активации:
 * - home: Scale bounce (дом "прыгает")
 * - vote: Bounce + wiggle (галочка "танцует")
 * - menu: Rotate 360 (тарелка "вращается")
 * - stats: ScaleY (столбцы "растут")
 * - profile: Scale + rotate wave (аватар "машет")
 */
export const AnimatedNavIcon: React.FC<AnimatedNavIconProps> = ({
  icon: Icon,
  isActive,
  type,
  className,
  isDark = false,
}) => {
  // Специфичные анимации для каждого типа
  const animations: AnimationMap = {
    home: {
      scale: isActive ? [1, 1.15, 1] : 1,
    },
    vote: {
      y: isActive ? [0, -3, 0] : 0,
      rotate: isActive ? [0, -5, 5, 0] : 0,
    },
    menu: {
      rotate: isActive ? 360 : 0,
      scale: isActive ? [1, 1.1, 1] : 1,
    },
    stats: {
      scaleY: isActive ? [0.9, 1.1, 1] : 1,
      transformOrigin: 'bottom',
    },
    profile: {
      scale: isActive ? [1, 1.15, 1] : 1,
      rotate: isActive ? [0, -8, 8, 0] : 0,
    },
  };

  // Transition настройки
  const transition = {
    type: 'tween' as const,
    duration: 0.6,
    ease: 'easeInOut' as const,
  };

  // Дополнительная анимация для активной иконки (пульсация при активации)
  // Темная тема: лавандовый glow
  // Светлая тема: оранжевый glow
  const glowAnimation = isActive ? {
    filter: isDark ? [
      'drop-shadow(0 0 0px rgb(167, 139, 250))',
      'drop-shadow(0 0 8px rgb(167, 139, 250))',
      'drop-shadow(0 0 0px rgb(167, 139, 250))',
    ] : [
      'drop-shadow(0 0 0px rgb(251, 146, 60))',
      'drop-shadow(0 0 8px rgb(251, 146, 60))',
      'drop-shadow(0 0 0px rgb(251, 146, 60))',
    ],
  } : {};

  return (
    <motion.div
      animate={{
        ...animations[type],
        ...glowAnimation,
      }}
      transition={transition}
      className="relative"
    >
      <Icon className={className} />
    </motion.div>
  );
};
