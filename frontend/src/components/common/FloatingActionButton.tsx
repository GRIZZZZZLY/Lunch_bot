import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';
import { cn } from '../../lib/utils';

interface FloatingActionButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * Floating Action Button (FAB) - Обратная связь
 * 
 * Круглая кнопка, всегда видна справа внизу.
 * Открывает модальное окно обратной связи.
 */
export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ 
  onClick,
  className 
}) => {
  const haptic = useHaptic();

  const handleClick = () => {
    haptic.impact();
    onClick();
  };

  return (
    <motion.button
      onClick={handleClick}
      className={cn(
        'fixed bottom-20 right-4 z-40',
        'size-16 rounded-full',
        'bg-gradient-to-br from-coral-500 to-coral-600',
        'shadow-2xl',
        'flex items-center justify-center',
        'cursor-pointer',
        'transition-all duration-200',
        'hover:shadow-coral-500/50',
        className
      )}
      style={{
        boxShadow: '0 10px 40px rgba(239, 68, 68, 0.3)',
      }}
      whileHover={{ 
        scale: 1.1,
      }}
      whileTap={{ 
        scale: 0.95 
      }}
      animate={{
        scale: [1, 1.05, 1],
      }}
      transition={{
        scale: {
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }}
      aria-label="Обратная связь"
    >
      <MessageCircle className="size-6 text-white" />
    </motion.button>
  );
};
