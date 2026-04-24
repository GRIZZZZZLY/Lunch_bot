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
      style={{ bottom: 'var(--fab-bottom, calc(64px + env(safe-area-inset-bottom, 0px) + 12px))' }}
      className={cn(
        'fixed right-4 z-30',
        'size-14 rounded-[18px]',
        'bg-primary',
        'shadow-[0_8px_24px_hsl(var(--primary)/0.35)]',
        'flex items-center justify-center',
        'cursor-pointer',
        'transition-all duration-150',
        'ring-1 ring-white/10',
        className
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={tooltipText}
    >
      <MessageCircle className={`${ICON_SIZES.md} text-primary-foreground`} strokeWidth={2.5} />
    </motion.button>
        </TooltipTrigger>
        <TooltipContent side="left" className="font-medium">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
