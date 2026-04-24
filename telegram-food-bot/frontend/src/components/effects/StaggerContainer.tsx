import { motion } from 'framer-motion';

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number; // Задержка между элементами в секундах
  initialDelay?: number; // Начальная задержка перед всей анимацией
}

/**
 * Stagger Container Component
 * 
 * Контейнер для последовательной анимации дочерних элементов
 * Создаёт эффект "волны" при появлении списка элементов
 * 
 * @example
 * <StaggerContainer staggerDelay={0.1}>
 *   {items.map(item => (
 *     <motion.div key={item.id} variants={staggerChildVariants}>
 *       {item.content}
 *     </motion.div>
 *   ))}
 * </StaggerContainer>
 */
export const StaggerContainer = ({
  children,
  className = '',
  staggerDelay = 0.1,
  initialDelay = 0,
}: StaggerContainerProps) => {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            delayChildren: initialDelay,
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
};

export const staggerChildVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export const staggerChildFadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const staggerChildScaleVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export const staggerChildSlideVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0 },
};

