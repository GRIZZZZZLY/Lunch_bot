import { Calculator, Users, ChevronRight } from 'lucide-react';
import { CategoryOrder } from '@/services/category-order.service';
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
    <div className={cn(
      'w-full rounded-2xl border bg-card p-4 transition-all',
      'border-primary/28 hover:border-primary/45',
      'shadow-[0_8px_20px_rgba(216,106,44,0.08)] hover:shadow-[0_12px_26px_rgba(216,106,44,0.14)]',
    )}>
      <div className="flex items-center justify-between gap-4">
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="rounded-xl bg-primary/12 p-2.5 ring-1 ring-primary/10 flex-shrink-0">
            <Calculator className={cn(ICON_SIZES.md, 'text-primary')} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {resolvedTitle}
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
              <Users className={cn(ICON_SIZES.xs, 'text-muted-foreground')} />
              <span className="text-xs text-muted-foreground">
                {categoryOrder.participantCount}{' '}
                {categoryOrder.participantCount === 1
                  ? 'участник'
                  : categoryOrder.participantCount < 5
                    ? 'участника'
                    : 'участников'}
              </span>
            </div>
            {note && (
              <div className="mt-1 text-xs text-muted-foreground">{note}</div>
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
  );
}
