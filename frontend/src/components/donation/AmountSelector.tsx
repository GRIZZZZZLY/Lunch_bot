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
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card text-foreground border border-border/70 hover:bg-muted/45'
            )}
          >
            {amount.popular && (
              <div className="absolute -top-2 -right-2 rounded-full bg-lavender-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                Популярно
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
              ? 'bg-lavender-500 text-white shadow-sm'
              : 'bg-card text-foreground border border-border/70 hover:bg-muted/45'
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
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
