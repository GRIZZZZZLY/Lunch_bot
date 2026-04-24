import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Варианты анимаций для страниц
 */
const pageTransitions = {
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
  children: ReactNode;
  variant?: keyof typeof pageTransitions;
  className?: string;
}

/**
 * Компонент для анимированных страниц
 */
export const AnimatedPage = ({
  children,
  variant = 'fade',
  className = '',
}: AnimatedPageProps) => {
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
export const PageTransition = ({
  children,
  mode = 'wait',
}: {
  children: ReactNode;
  mode?: 'wait' | 'sync' | 'popLayout';
}) => <AnimatePresence mode={mode}>{children}</AnimatePresence>;

/**
 * Stagger анимация для списков
 */
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    },
};

/**
 * Компонент для stagger анимации списков
 */
export const StaggerList = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <motion.div
    variants={staggerContainer}
    initial="hidden"
    animate="show"
    className={className}
  >
    {children}
  </motion.div>
);

/**
 * Компонент для элементов stagger списка
 */
export const StaggerItem = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <motion.div variants={staggerItem} className={className}>
    {children}
  </motion.div>
);

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
