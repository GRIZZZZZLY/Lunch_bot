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
      'relative w-full overflow-hidden rounded-[22px] border bg-card p-4 transition-all',
      'border-primary/30 hover:border-primary/50',
      'shadow-[0_10px_24px_-12px_rgba(216,106,44,0.40)] hover:shadow-[0_14px_30px_-12px_rgba(216,106,44,0.50)]',
    )}>
      {/* Тонированный радиальный градиент */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(216,106,44,0.12),transparent_60%)]" />

      <div className="relative z-10 flex items-center justify-between gap-4">
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/14 text-primary ring-1 ring-primary/12">
            <Calculator className={ICON_SIZES.md} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              Ответственный
            </p>
            <h3 className="text-[15px] font-bold tracking-tight text-foreground truncate">
              {resolvedTitle}
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
              <Users className={cn(ICON_SIZES.xs, 'text-muted-foreground')} />
              <span className="text-xs text-muted-foreground tabular-nums">
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
          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-coral-500 text-white text-sm font-semibold transition-all hover:brightness-105 active:scale-95 shadow-[0_8px_18px_-8px_rgba(216,106,44,0.6)]"
        >
          <span>{resolvedButtonLabel}</span>
          <ChevronRight className={ICON_SIZES.sm} />
        </button>
      </div>
    </div>
  );
}
