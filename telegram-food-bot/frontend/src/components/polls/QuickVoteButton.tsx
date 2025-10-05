import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MenuItem } from '../../services/menu.service';

interface QuickVoteButtonProps {
  item: MenuItem;
  isSelected: boolean;
  onSelect: () => void;
  votePercentage?: number;
  disabled?: boolean;
}

export const QuickVoteButton: React.FC<QuickVoteButtonProps> = ({
  item,
  isSelected,
  onSelect,
  votePercentage,
  disabled = false,
}) => {
  return (
    <motion.button
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={cn(
        'relative w-full p-4 rounded-xl transition-all duration-200',
        'border-2 overflow-hidden',
        isSelected
          ? 'border-primary-food-500 bg-primary-food-50 dark:bg-primary-food-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
        !disabled && 'hover:shadow-md active:shadow-sm',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      {/* Progress bar */}
      {votePercentage !== undefined && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${votePercentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 bg-primary-food-100 dark:bg-primary-food-900/30"
        />
      )}

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl">
              🍽️
            </div>
          )}
          
          <div className="flex-1 text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {item.name}
            </h3>
            {item.price && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ₽{item.price}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {votePercentage !== undefined && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {votePercentage}%
            </span>
          )}
          {isSelected ? (
            <CheckCircle2
              size={24}
              className="text-primary-food-500 flex-shrink-0"
            />
          ) : (
            <Circle
              size={24}
              className="text-gray-400 dark:text-gray-600 flex-shrink-0"
            />
          )}
        </div>
      </div>
    </motion.button>
  );
};
