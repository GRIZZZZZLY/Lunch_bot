import React from 'react';
import { motion } from 'framer-motion';

export interface SpinnerLoaderProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Компонент загрузки с оранжевым спиннером
 */
export const SpinnerLoader: React.FC<SpinnerLoaderProps> = ({
  text = 'Загрузка...',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 border-2',
    md: 'w-12 h-12 border-3',
    lg: 'w-16 h-16 border-4',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      {/* Оранжевый спиннер */}
      <div
        className={`${sizeClasses[size]} rounded-full border-coral-200 border-t-coral-500 dark:border-peach-500/20 dark:border-t-peach-500 animate-spin`}
      />

      {/* Пульсирующий текст */}
      {text && (
        <motion.p
          animate={{
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={`${textSizeClasses[size]} font-medium text-gray-900 dark:text-white`}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};
