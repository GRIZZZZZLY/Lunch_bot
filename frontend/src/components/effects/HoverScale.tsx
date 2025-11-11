import React from 'react';
import { motion, MotionProps } from 'framer-motion';

interface HoverScaleProps extends MotionProps {
  children: React.ReactNode;
  scale?: number; // Масштаб при hover
  tapScale?: number; // Масштаб при нажатии
  className?: string;
  disabled?: boolean;
}

/**
 * Hover Scale Component
 * 
 * Добавляет плавный эффект масштабирования при hover и tap
 * Идеально для кнопок, карточек и интерактивных элементов
 * 
 * @example
 * <HoverScale scale={1.05} tapScale={0.95}>
 *   <button>Click me</button>
 * </HoverScale>
 */
export const HoverScale: React.FC<HoverScaleProps> = ({
  children,
  scale = 1.05,
  tapScale = 0.98,
  className = '',
  disabled = false,
  ...motionProps
}) => {
  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      whileHover={{ scale }}
      whileTap={{ scale: tapScale }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
};
