import React from 'react';
import { motion } from 'framer-motion';

export type NavIconType = 'home' | 'vote' | 'menu' | 'stats' | 'profile';

interface AnimatedNavIconProps {
  icon: React.FC<{ className?: string }>;
  isActive: boolean;
  type: NavIconType;
  className?: string;
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
}) => {
  // Специфичные анимации для каждого типа
  const animations: Record<NavIconType, any> = {
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
    type: 'tween',
    duration: 0.6,
    ease: 'easeInOut',
  };

  // Дополнительная анимация для активной иконки (пульсация при активации)
  const glowAnimation = isActive ? {
    filter: [
      'drop-shadow(0 0 0px currentColor)',
      'drop-shadow(0 0 6px currentColor)',
      'drop-shadow(0 0 0px currentColor)',
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
