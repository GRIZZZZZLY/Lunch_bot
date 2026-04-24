import { Calculator, Users, ChevronRight } from 'lucide-react';
import { CategoryOrder } from '@/services/category-order.service';
import { GlassCard } from '@/components/ui/glass-card';
import { ICON_SIZES } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface CompactResponsibleBannerProps {
  categoryOrder: CategoryOrder;
  onOpenCalculator: () => void;
  title?: string;
  note?: string;
  buttonLabel?: string;
}

/**
 * Compact banner for responsible user
 * Shows category, participant count, and button to open calculator modal
 */
export function CompactResponsibleBanner({
  categoryOrder,
  onOpenCalculator,
  title,
  note,
  buttonLabel,
}: CompactResponsibleBannerProps) {
  const resolvedTitle =
    title || `Вы ответственный за ${categoryOrder.category}`;
  const resolvedButtonLabel = buttonLabel || 'Заполнить заказ';

  return (
    <GlassCard 
      intensity="high" 
      className="border-primary/32 shadow-[0_12px_24px_rgba(216,106,44,0.10)]"
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Icon + Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/12 ring-1 ring-primary/10 flex items-center justify-center">
              <Calculator className={cn(ICON_SIZES.md, "text-primary")} />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {resolvedTitle}
              </h3>
              <div className="flex items-center gap-1 mt-0.5">
                <Users className={cn(ICON_SIZES.xs, "text-muted-foreground")} />
                <span className="text-xs text-foreground/72 dark:text-muted-foreground">
                  {categoryOrder.participantCount} {
                    categoryOrder.participantCount === 1 ? 'участник' :
                    categoryOrder.participantCount < 5 ? 'участника' :
                    'участников'
                  }
                </span>
              </div>
              {note && (
                <div className="mt-1 text-xs text-foreground/72 dark:text-muted-foreground">
                  {note}
                </div>
              )}
            </div>
          </div>

          {/* Right: Button */}
          <button
            onClick={onOpenCalculator}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors shadow-md"
          >
            <span>{resolvedButtonLabel}</span>
            <ChevronRight className={ICON_SIZES.sm} />
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
