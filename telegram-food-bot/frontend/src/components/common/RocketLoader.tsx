import React from 'react';
import { motion } from 'framer-motion';
import { Rocket } from 'lucide-react';

export interface RocketLoaderProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Компонент загрузки с анимированной ракетой
 */
export const RocketLoader: React.FC<RocketLoaderProps> = ({
  text = 'Летим',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      {/* Анимированная ракета - строго вертикальная анимация */}
      <motion.div
        animate={{
          y: [0, -20, 0], // Движение только вверх-вниз (строго вертикально)
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative"
      >
        {/* Ракета с легким scale для живости */}
        <motion.div
          animate={{
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Rocket 
            className={`${sizeClasses[size]} text-primary-food-600 dark:text-primary-food-400`}
            strokeWidth={2}
            style={{ transform: 'rotate(-45deg)' }} // Поворачиваем иконку вертикально
          />
        </motion.div>

        {/* Огонь/trail под ракетой */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 top-full"
          animate={{
            opacity: [0.4, 0.8, 0.4],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="w-2 h-6 bg-gradient-to-b from-orange-400 via-orange-500 to-transparent rounded-full blur-sm" />
        </motion.div>
      </motion.div>

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
