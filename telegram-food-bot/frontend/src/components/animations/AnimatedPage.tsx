import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Варианты анимаций для страниц
 */
export const pageTransitions = {
  // Fade - простое затухание
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },

  // Slide Up - выезжает снизу
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
  },

  // Slide Down - выезжает сверху
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
  },

  // Scale - масштабирование
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
  },

  // Slide Right - слайд вправо
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
  },

  // Slide Left - слайд влево
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
  },
};

interface AnimatedPageProps {
  children: React.ReactNode;
  variant?: keyof typeof pageTransitions;
  className?: string;
}

/**
 * Компонент для анимированных страниц
 */
export const AnimatedPage: React.FC<AnimatedPageProps> = ({
  children,
  variant = 'fade',
  className = '',
}) => {
  const transition = pageTransitions[variant];

  return (
    <motion.div
      initial={transition.initial}
      animate={transition.animate}
      exit={transition.exit}
      transition={transition.transition}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Обёртка для AnimatePresence
 */
export const PageTransition: React.FC<{
  children: React.ReactNode;
  mode?: 'wait' | 'sync' | 'popLayout';
}> = ({ children, mode = 'wait' }) => {
  return <AnimatePresence mode={mode}>{children}</AnimatePresence>;
};

/**
 * Stagger анимация для списков
 */
export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as any,
    },
  },
};

/**
 * Компонент для stagger анимации списков
 */
export const StaggerList: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Компонент для элементов stagger списка
 */
export const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
};

/**
 * Пример использования:
 * 
 * // Анимированная страница:
 * <AnimatedPage variant="slideUp">
 *   <h1>Моя страница</h1>
 * </AnimatedPage>
 * 
 * // Stagger список:
 * <StaggerList>
 *   {items.map(item => (
 *     <StaggerItem key={item.id}>
 *       <Card {...item} />
 *     </StaggerItem>
 *   ))}
 * </StaggerList>
 * 
 * // С AnimatePresence для переходов:
 * <PageTransition>
 *   <AnimatedPage key={location.pathname} variant="slideUp">
 *     <Routes>...</Routes>
 *   </AnimatedPage>
 * </PageTransition>
 */
