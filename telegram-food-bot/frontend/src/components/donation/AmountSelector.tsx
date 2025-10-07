import { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit3 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DonationAmount, PaymentMethod } from '../../types/donation.types';

interface AmountSelectorProps {
  amounts: DonationAmount[];
  method: PaymentMethod;
  selectedAmount: number;
  onAmountChange: (amount: number) => void;
}

const getCurrencySymbol = (method: PaymentMethod): string => {
  switch (method) {
    case 'stars':
      return '⭐';
    case 'sbp':
      return '₽';
    case 'crypto':
      return '$';
    default:
      return '';
  }
};

export const AmountSelector = ({
  amounts,
  method,
  selectedAmount,
  onAmountChange
}: AmountSelectorProps) => {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const handleCustomClick = () => {
    setIsCustom(true);
    setCustomValue('');
  };

  const handleCustomChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    setCustomValue(value);
    if (numValue > 0) {
      onAmountChange(numValue);
    }
  };

  const handlePresetClick = (amount: number) => {
    setIsCustom(false);
    setCustomValue('');
    onAmountChange(amount);
  };

  const symbol = getCurrencySymbol(method);

  return (
    <div className="space-y-3">
      {/* Preset Amounts */}
      <div className="grid grid-cols-3 gap-3">
        {amounts.map((amount) => (
          <motion.button
            key={amount.value}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handlePresetClick(amount.value)}
            className={cn(
              'relative px-4 py-3 rounded-xl font-semibold transition-all',
              selectedAmount === amount.value && !isCustom
                ? 'bg-gradient-to-r from-peach-500 to-coral-500 text-white shadow-lg shadow-peach-500/30'
                : 'bg-muted/50 text-foreground hover:bg-muted'
            )}
          >
            {amount.popular && (
              <div className="absolute -top-2 -right-2 bg-coral-500 text-white text-xs px-2 py-0.5 rounded-full">
                🔥
              </div>
            )}
            <div className="text-lg">
              {amount.value}
              {symbol}
            </div>
            {amount.label && (
              <div className="text-xs opacity-70 mt-1">{amount.label}</div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Custom Amount */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleCustomClick}
        className={cn(
          'w-full px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
          isCustom
            ? 'bg-gradient-to-r from-lavender-500 to-lavender-600 text-white shadow-lg shadow-lavender-500/30'
            : 'bg-muted/50 text-foreground hover:bg-muted'
        )}
      >
        <Edit3 size={16} />
        Своя сумма
      </motion.button>

      {/* Custom Input */}
      {isCustom && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="pt-2"
        >
          <div className="relative">
            <input
              type="number"
              min="1"
              value={customValue}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder={`Введите сумму`}
              className="w-full px-4 py-3 rounded-xl border-2 border-peach-300 dark:border-peach-600 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-peach-500 text-center text-lg font-semibold"
              autoFocus
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
              {symbol}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
