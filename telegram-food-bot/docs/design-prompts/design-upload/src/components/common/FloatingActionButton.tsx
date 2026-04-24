import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';
import { cn } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface FloatingActionButtonProps {
  onClick: () => void;
  className?: string;
  tooltipText?: string;
}

/**
 * Floating Action Button (FAB) - Обратная связь
 * 
 * Круглая кнопка, всегда видна справа внизу.
 * Открывает модальное окно обратной связи.
 */
export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ 
  onClick,
  className,
  tooltipText = "Обратная связь"
}) => {
  const haptic = useHaptic();

  const handleClick = () => {
    haptic.impact();
    onClick();
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
      onClick={handleClick}
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)' }}
      className={cn(
        'fixed right-4 z-40',
        'size-16 rounded-full',
        'bg-lavender-500',
        'shadow-2xl shadow-lavender-500/25',
        'flex items-center justify-center',
        'cursor-pointer',
        'transition-all duration-200',
        'hover:shadow-lavender-500/35',
        'border-2 border-white/20',
        className
      )}
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
      aria-label={tooltipText}
    >
      <MessageCircle className={`${ICON_SIZES.lg} text-white drop-shadow-md`} strokeWidth={2.5} />
    </motion.button>
        </TooltipTrigger>
        <TooltipContent side="left" className="font-medium">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
