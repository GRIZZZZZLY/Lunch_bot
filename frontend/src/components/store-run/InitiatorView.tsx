import React, { useMemo, useState } from 'react';
import { Clock, ShoppingCart, CheckCircle2, XCircle, Package, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  useCancelStoreRun,
  useSetItemPrice,
  useSettleStoreRun,
  useStartShopping,
} from '@/hooks/queries/useStoreRunQueries';
import { useCountdownTimer } from '@/hooks/useCountdownTimer';
import { useTelegram } from '@/hooks/useTelegram';
import type { StoreRunWithRelations, StoreItem } from '@/services/store-run.service';

export interface InitiatorViewProps {
  run: StoreRunWithRelations;
  onRunDone?: () => void;
}

export const InitiatorView: React.FC<InitiatorViewProps> = ({ run, onRunDone }) => {
  const timer = useCountdownTimer(run.collectUntil);
  const { hapticFeedback } = useTelegram();

  const { mutateAsync: startShopping, isPending: starting } = useStartShopping(run.id);
  const { mutateAsync: cancel, isPending: cancelling } = useCancelStoreRun(run.id);
  const { mutateAsync: settle, isPending: settling } = useSettleStoreRun(run.id);

  const isCollecting = run.status === 'COLLECTING' && !timer.isExpired;
  const isShopping = run.status === 'SHOPPING' || (run.status === 'COLLECTING' && timer.isExpired);
  const isSettled = run.status === 'SETTLED';
  const isCancelled = run.status === 'CANCELLED';

  // Group items by participant
  const groupedByUser = useMemo(() => {
    const map = new Map<number, { userName: string; items: StoreItem[] }>();
    for (const it of run.items) {
      const name = it.user?.firstName ?? `User ${it.userId}`;
      if (!map.has(it.userId)) {
        map.set(it.userId, { userName: name, items: [] });
      }
      map.get(it.userId)!.items.push(it);
    }
    return Array.from(map.entries());
  }, [run.items]);

  const handleStartShopping = async () => {
    hapticFeedback?.impactOccurred?.('medium');
    await startShopping();
  };

  const handleCancel = async () => {
    if (run.items.length > 0) {
      if (!window.confirm('У участников уже есть заказы. Точно отменить?')) return;
    }
    hapticFeedback?.impactOccurred?.('heavy');
    await cancel();
    onRunDone?.();
  };

  const handleSettle = async () => {
    hapticFeedback?.impactOccurred?.('medium');
    const response = await settle();
    if (response.success) {
      hapticFeedback?.notificationOccurred?.('success');
      onRunDone?.();
    }
  };

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {isCollecting && (
        <div className="rounded-xl border border-primary/28 bg-primary/8 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Clock className="h-4 w-4" />
              Сбор до {timer.formattedTime}
            </div>
            <span className="text-xs text-foreground/70">
              {run.items.length} позиций от {groupedByUser.length} чел.
            </span>
          </div>
        </div>
      )}
      {isShopping && (
        <div className="rounded-xl border border-amber-500/28 bg-amber-500/8 px-4 py-3">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            🛍 Ты в магазине — проставь цены на позиции.
          </p>
        </div>
      )}
      {isSettled && (
        <div className="rounded-xl border border-mint-500/28 bg-mint-500/8 px-4 py-3">
          <p className="text-sm font-medium text-mint-700 dark:text-mint-300">
            ✅ Забег завершён. Долги уйдут в BudgetWidget.
          </p>
        </div>
      )}
      {isCancelled && (
        <div className="rounded-xl border border-destructive/28 bg-destructive/8 px-4 py-3">
          <p className="text-sm font-medium text-destructive">Забег отменён.</p>
        </div>
      )}

      {/* Items list */}
      {run.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Пока никто ничего не заказал.
        </p>
      ) : (
        <div className="space-y-4">
          {groupedByUser.map(([userId, entry]) => (
            <div key={userId} className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">{entry.userName}</h4>
              <ul className="space-y-2">
                {entry.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    runId={run.id}
                    editable={isShopping}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {isCollecting && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={cancelling}
            className="sm:flex-1"
          >
            <Ban className="mr-1.5 h-4 w-4" />
            Отменить
          </Button>
          <Button
            onClick={handleStartShopping}
            disabled={starting}
            className="sm:flex-1"
          >
            <Package className="mr-1.5 h-4 w-4" />
            {starting ? 'Переключаем…' : 'Я в магазине'}
          </Button>
        </div>
      )}

      {isShopping && (
        <Button
          onClick={handleSettle}
          disabled={settling}
          className="w-full"
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          {settling ? 'Завершаем…' : 'Завершить и создать долги'}
        </Button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------

interface ItemRowProps {
  item: StoreItem;
  runId: number;
  editable: boolean;
}

const ItemRow: React.FC<ItemRowProps> = ({ item, runId, editable }) => {
  const { mutateAsync: setPrice, isPending } = useSetItemPrice(runId);
  const { hapticFeedback } = useTelegram();
  const [priceInput, setPriceInput] = useState<string>(
    item.price != null ? String(Number(item.price)) : '',
  );

  const save = async (status: 'BOUGHT' | 'NOT_FOUND') => {
    try {
      const priceValue =
        status === 'BOUGHT' ? Number(priceInput.replace(',', '.')) : null;
      if (status === 'BOUGHT' && (!Number.isFinite(priceValue!) || priceValue! < 0)) {
        hapticFeedback?.notificationOccurred?.('error');
        return;
      }
      await setPrice({ itemId: item.id, payload: { price: priceValue, status } });
      hapticFeedback?.notificationOccurred?.('success');
    } catch {
      hapticFeedback?.notificationOccurred?.('error');
    }
  };

  return (
    <li
      className={cn(
        'rounded-xl border bg-card px-3 py-2.5',
        item.status === 'BOUGHT' && 'border-mint-500/30',
        item.status === 'NOT_FOUND' && 'border-destructive/30',
        item.status === 'REQUESTED' && 'border-border',
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
            {item.quantity > 1 && (
              <span className="text-xs text-muted-foreground">× {item.quantity}</span>
            )}
          </div>
          {item.notes && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.notes}</p>
          )}
        </div>

        {!editable ? (
          <div className="flex items-center gap-2">
            {item.status === 'BOUGHT' && (
              <span className="text-sm font-semibold text-primary">
                {item.price != null ? `${Number(item.price).toFixed(0)} ₽` : '—'}
              </span>
            )}
            {item.status === 'BOUGHT' && (
              <CheckCircle2 className="h-4 w-4 text-mint-600 dark:text-mint-400" />
            )}
            {item.status === 'NOT_FOUND' && <XCircle className="h-4 w-4 text-destructive" />}
            {item.status === 'REQUESTED' && (
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="₽"
              className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={isPending}
            />
            <button
              type="button"
              onClick={() => save('BOUGHT')}
              disabled={isPending || !priceInput.trim()}
              className="rounded-lg p-1.5 text-mint-600 transition-colors hover:bg-mint-500/10 disabled:opacity-40 dark:text-mint-400"
              aria-label="Куплено"
              title="Куплено"
            >
              <CheckCircle2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => save('NOT_FOUND')}
              disabled={isPending}
              className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
              aria-label="Не нашёл"
              title="Не нашёл"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
};
