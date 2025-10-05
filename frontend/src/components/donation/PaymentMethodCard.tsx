import { motion } from 'framer-motion';
import { Star, CreditCard, Bitcoin, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PaymentMethod } from '../../types/donation.types';

interface PaymentMethodCardProps {
  method: PaymentMethod;
  name: string;
  description: string;
  selected: boolean;
  enabled: boolean;
  onClick: () => void;
}

const getMethodIcon = (method: PaymentMethod) => {
  switch (method) {
    case 'stars':
      return <Star size={24} className="text-yellow-500" />;
    case 'sbp':
      return <CreditCard size={24} className="text-blue-500" />;
    case 'crypto':
      return <Bitcoin size={24} className="text-orange-500" />;
  }
};

const getMethodColor = (method: PaymentMethod) => {
  switch (method) {
    case 'stars':
      return 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-700';
    case 'sbp':
      return 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700';
    case 'crypto':
      return 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700';
  }
};

export const PaymentMethodCard = ({
  method,
  name,
  description,
  selected,
  enabled,
  onClick
}: PaymentMethodCardProps) => {
  return (
    <motion.button
      whileHover={enabled ? { scale: 1.02 } : {}}
      whileTap={enabled ? { scale: 0.98 } : {}}
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      className={cn(
        'w-full p-4 rounded-xl border-2 transition-all relative',
        'flex items-center justify-between',
        enabled
          ? 'cursor-pointer'
          : 'cursor-not-allowed opacity-50',
        selected
          ? 'bg-gradient-to-r ' + getMethodColor(method) + ' shadow-lg'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={cn(
          'p-2 rounded-lg',
          selected
            ? 'bg-white dark:bg-gray-800'
            : 'bg-gray-100 dark:bg-gray-700'
        )}>
          {getMethodIcon(method)}
        </div>

        {/* Text */}
        <div className="text-left">
          <div className="font-semibold text-gray-900 dark:text-white">
            {name}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </div>
        </div>
      </div>

      {/* Arrow */}
      {enabled && (
        <ChevronRight
          size={20}
          className={cn(
            'transition-transform',
            selected ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'
          )}
        />
      )}

      {/* Coming Soon Badge */}
      {!enabled && (
        <div className="absolute top-2 right-2 bg-gray-500 text-white text-xs px-2 py-1 rounded-full">
          Скоро
        </div>
      )}
    </motion.button>
  );
};
