import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

interface ParallaxLayerProps {
  children: React.ReactNode;
  speed?: number; // Скорость параллакса (-1 до 1, где 0 = нет эффекта)
  className?: string;
  offset?: number; // Начальное смещение
  disabled?: boolean;
}

/**
 * Parallax Layer Component
 * 
 * Создаёт эффект параллакса при скролле
 * Слои с разной скоростью создают глубину
 * 
 * @example
 * <ParallaxLayer speed={-0.3}>
 *   <div>Медленный фон</div>
 * </ParallaxLayer>
 * <ParallaxLayer speed={0.3}>
 *   <div>Быстрый передний план</div>
 * </ParallaxLayer>
 */
export const ParallaxLayer: React.FC<ParallaxLayerProps> = ({
  children,
  speed = 0.5,
  className = '',
  offset = 0,
  disabled = false,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Применяем spring для плавности
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
  });

  // Трансформируем scroll в движение Y
  const y = useTransform(
    smoothProgress,
    [0, 1],
    [offset, offset + speed * 200] // 200px диапазон движения
  );

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ y }}
    >
      {children}
    </motion.div>
  );
};
