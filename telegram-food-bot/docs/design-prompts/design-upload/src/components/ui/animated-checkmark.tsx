/**
 * AnimatedCheckmark - Анимированная галочка успеха
 * 
 * Используется для подтверждения действий:
 * - После голосования
 * - После оплаты
 * - После сохранения настроек
 * 
 * Анимация: галочка "рисуется" с bounce эффектом
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AnimatedCheckmarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'success' | 'primary' | 'mint';
  withCircle?: boolean;
  animate?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

const iconSizes = {
  sm: 14,
  md: 24,
  lg: 40,
  xl: 60,
};

const colorClasses = {
  success: 'bg-green-500 text-white',
  primary: 'bg-orange-500 text-white',
  mint: 'bg-mint-500 text-white',
};

/**
 * Компонент анимированной галочки
 */
export const AnimatedCheckmark: React.FC<AnimatedCheckmarkProps> = ({
  size = 'md',
  color = 'success',
  withCircle = true,
  animate = true,
  className,
}) => {
  if (!animate) {
    // Статичная версия без анимации
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full',
          withCircle && colorClasses[color],
          sizeClasses[size],
          className
        )}
      >
        <Check size={iconSizes[size]} strokeWidth={3} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ 
        scale: 1, 
        rotate: 0,
      }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 15,
        duration: 0.6,
      }}
      className={cn(
        'flex items-center justify-center rounded-full',
        withCircle && colorClasses[color],
        sizeClasses[size],
        className
      )}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          delay: 0.1,
          type: 'spring',
          stiffness: 300,
          damping: 20,
        }}
      >
        <Check size={iconSizes[size]} strokeWidth={3} />
      </motion.div>
    </motion.div>
  );
};

/**
 * Компонент с галочкой и текстом
 */
export interface AnimatedCheckmarkWithTextProps extends AnimatedCheckmarkProps {
  title: string;
  message?: string;
  onComplete?: () => void;
}

export const AnimatedCheckmarkWithText: React.FC<AnimatedCheckmarkWithTextProps> = ({
  title,
  message,
  onComplete,
  ...checkmarkProps
}) => {
  React.useEffect(() => {
    if (onComplete) {
      const timer = setTimeout(onComplete, 2000);
      return () => clearTimeout(timer);
    }
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-4 text-center"
    >
      <AnimatedCheckmark {...checkmarkProps} />
      
      <div className="space-y-1">
        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xl font-semibold text-foreground"
        >
          {title}
        </motion.h3>
        
        {message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-sm text-muted-foreground"
          >
            {message}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Компонент inline галочки (для кнопок и карточек)
 */
export const InlineCheckmark: React.FC<{
  visible: boolean;
  size?: number;
  className?: string;
}> = ({ visible, size = 20, className }) => {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ scale: 0, rotate: -90 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0, rotate: 90 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
      className={cn('inline-flex', className)}
    >
      <Check size={size} strokeWidth={3} className="text-green-500" />
    </motion.div>
  );
};
