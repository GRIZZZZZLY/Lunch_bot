import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number; // Интенсивность наклона (0-1)
  glare?: boolean; // Показывать эффект блеска
  scale?: number; // Масштаб при hover
  disabled?: boolean; // Отключить эффект
}

/**
 * 3D Tilt Card Component
 * 
 * Карточка с эффектом 3D-наклона при движении мыши
 * Добавляет wow-фактор для важных элементов
 * 
 * @example
 * <TiltCard intensity={0.5} glare scale={1.05}>
 *   <div className="p-6 bg-gradient-to-br from-blue-500 to-purple-600">
 *     Content
 *   </div>
 * </TiltCard>
 */
export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
  intensity = 0.3,
  glare = true,
  scale = 1.02,
  disabled = false,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Motion values для отслеживания позиции мыши
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  // Spring конфигурация для плавности
  const springConfig = { stiffness: 150, damping: 20 };
  const rotateX = useSpring(useTransform(y, [0, 1], [intensity * 20, -intensity * 20]), springConfig);
  const rotateY = useSpring(useTransform(x, [0, 1], [-intensity * 20, intensity * 20]), springConfig);

  // Эффект блеска
  const glareX = useTransform(x, [0, 1], ['0%', '100%']);
  const glareY = useTransform(y, [0, 1], ['0%', '100%']);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Нормализуем координаты от 0 до 1
    const normalizedX = (event.clientX - rect.left) / rect.width;
    const normalizedY = (event.clientY - rect.top) / rect.height;

    x.set(normalizedX);
    y.set(normalizedY);
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    
    x.set(0.5);
    y.set(0.5);
  };

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={`relative ${className}`}
      style={{
        transformStyle: 'preserve-3d',
        rotateX,
        rotateY,
      }}
      whileHover={{ scale }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Контент карточки */}
      <div
        style={{
          transform: 'translateZ(20px)',
          transformStyle: 'preserve-3d',
        }}
      >
        {children}
      </div>

      {/* Эффект блеска */}
      {glare && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden"
          style={{
            background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.2) 0%, transparent 50%)`,
            transform: 'translateZ(30px)',
          }}
        />
      )}
    </motion.div>
  );
};
