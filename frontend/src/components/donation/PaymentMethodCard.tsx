import { motion } from 'framer-motion';
import { Star, CreditCard, Bitcoin, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PaymentMethod } from '../../types/donation.types';
import { PastelCard, CardContent } from '../ui/pastel-card';
import { ICON_SIZES } from '@/lib/design-tokens';

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
      return <Star className={cn(ICON_SIZES.lg, "text-butter-500")} />;
    case 'sbp':
      return <CreditCard className={cn(ICON_SIZES.lg, "text-mint-500")} />;
    case 'crypto':
      return <Bitcoin className={cn(ICON_SIZES.lg, "text-coral-500")} />;
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
      <PastelCard
        variant={
          method === 'stars' ? 'peach' :
          method === 'sbp' ? 'sage' :
          'lavender'
        }
        className={cn(
          'cursor-pointer transition-all relative overflow-hidden',
          !enabled && 'opacity-50 cursor-not-allowed',
          selected && 'ring-2 ring-pastel-peach-500'
        )}
        onClick={enabled ? onClick : undefined}
      >
        <CardContent className="p-4 pt-4 relative">
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
              <ChevronRight className={ICON_SIZES.md}
              />
            )}
          </div>

          {/* Coming Soon Badge */}
          {!enabled && (
            <div className="absolute top-2 right-2 bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
              Скоро
            </div>
          )}
        </CardContent>
      </PastelCard>
    </motion.div>
  );
};
