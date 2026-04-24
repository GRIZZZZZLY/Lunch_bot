import React from 'react';
import type { ReactNode } from 'react';
import { motion, MotionProps } from 'framer-motion';

/**
 * Hover анимации
 */
/**
 * Компонент кнопки с анимацией
 */
export const AnimatedButton = ({
  children,
  onClick,
  className = '',
  disabled = false,
  ...motionProps
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
} & Partial<MotionProps>) => {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={className}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.15 }}
      {...motionProps}
    >
      {children}
    </motion.button>
  );
};

/**
 * Компонент карточки с анимацией
 */
export const AnimatedCard = ({
  children,
  onClick,
  className = '',
  ...motionProps
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
} & Partial<MotionProps>) => {
  return (
    <motion.div
      onClick={onClick}
      className={className}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
};

/**
 * Shake анимация (для ошибок)
 */
const shakeAnimation = {
  x: [0, -10, 10, -10, 10, 0],
  transition: { duration: 0.5 },
};

export const ShakeOnError = ({
  children,
  error = false,
  className = '',
}: {
  children: ReactNode;
  error?: boolean;
  className?: string;
}) => {
  return (
    <motion.div
      animate={error ? shakeAnimation : {}}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Pulse анимация
 */
export const PulseAnimation = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <motion.div
      animate={{
        scale: [1, 1.05, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Bounce анимация
 */
export const BounceAnimation: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <motion.div
      animate={{
        y: [0, -10, 0],
      }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Spin анимация
 */
export const SpinAnimation: React.FC<{
  children: React.ReactNode;
  className?: string;
  duration?: number;
}> = ({ children, className = '', duration = 2 }) => {
  return (
    <motion.div
      animate={{
        rotate: 360,
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'linear',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Fade In Up анимация
 */
export const FadeInUp: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Slide In Right анимация
 */
export const SlideInRight: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Scale In анимация
 */
export const ScaleIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Collapse анимация (для выпадающих панелей)
 */
export const Collapse: React.FC<{
  children: React.ReactNode;
  isOpen: boolean;
  className?: string;
}> = ({ children, isOpen, className = '' }) => {
  return (
    <motion.div
      initial={false}
      animate={{
        height: isOpen ? 'auto' : 0,
        opacity: isOpen ? 1 : 0,
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`overflow-hidden ${className}`}
    >
      {children}
    </motion.div>
  );
};

/**
 * Пример использования:
 * 
 * // Кнопка с анимацией:
 * <AnimatedButton onClick={handleClick}>
 *   Нажми меня
 * </AnimatedButton>
 * 
 * // Карточка с hover эффектом:
 * <AnimatedCard onClick={handleClick}>
 *   <CardContent />
 * </AnimatedCard>
 * 
 * // Shake при ошибке:
 * <ShakeOnError error={hasError}>
 *   <Input />
 * </ShakeOnError>
 * 
 * // Fade in с задержкой:
 * <FadeInUp delay={0.2}>
 *   <Content />
 * </FadeInUp>
 * 
 * // Collapse панель:
 * <Collapse isOpen={isExpanded}>
 *   <Details />
 * </Collapse>
 */
