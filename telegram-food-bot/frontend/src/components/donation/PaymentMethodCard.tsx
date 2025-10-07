import { motion } from 'framer-motion';
import { Star, CreditCard, Bitcoin, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PaymentMethod } from '../../types/donation.types';
import { GlassCard, GlassCardContent } from '../ui/glass-card';

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
      return <Star size={24} className="text-butter-500" />;
    case 'sbp':
      return <CreditCard size={24} className="text-mint-500" />;
    case 'crypto':
      return <Bitcoin size={24} className="text-coral-500" />;
  }
};

const getMethodColor = (method: PaymentMethod) => {
  switch (method) {
    case 'stars':
      return 'from-butter-500/20 to-butter-600/20';
    case 'sbp':
      return 'from-mint-500/20 to-mint-600/20';
    case 'crypto':
      return 'from-coral-500/20 to-coral-600/20';
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
    <motion.div
      whileHover={enabled ? { scale: 1.02 } : {}}
      whileTap={enabled ? { scale: 0.98 } : {}}
    >
      <GlassCard
        intensity={selected ? "medium" : "low"}
        hover={enabled}
        className={cn(
          'cursor-pointer transition-all relative overflow-hidden',
          !enabled && 'opacity-50 cursor-not-allowed',
          selected && 'ring-2 ring-peach-500'
        )}
        onClick={enabled ? onClick : undefined}
      >
        <div className={cn(
          "absolute inset-0",
          selected && "bg-gradient-to-r " + getMethodColor(method)
        )} />
        <GlassCardContent className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className={cn(
                'p-2 rounded-lg',
                selected
                  ? 'bg-background/80'
                  : 'bg-muted/50'
              )}>
                {getMethodIcon(method)}
              </div>

              {/* Text */}
              <div className="text-left">
                <div className="font-semibold text-foreground">
                  {name}
                </div>
                <div className="text-sm text-muted-foreground">
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
                  selected ? 'text-foreground' : 'text-muted-foreground'
                )}
              />
            )}
          </div>

          {/* Coming Soon Badge */}
          {!enabled && (
            <div className="absolute top-2 right-2 bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
              Скоро
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
};
