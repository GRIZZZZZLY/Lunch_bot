import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  useAddStoreItems,
  useDeleteStoreItem,
} from '@/hooks/queries/useStoreRunQueries';
import { useCountdownTimer } from '@/hooks/useCountdownTimer';
import { useTelegram } from '@/hooks/useTelegram';
import type { StoreRunWithRelations } from '@/services/store-run.service';

export interface ParticipantViewProps {
  run: StoreRunWithRelations;
  currentUserId: number;
}

export const ParticipantView: React.FC<ParticipantViewProps> = ({ run, currentUserId }) => {
  const myItems = run.items.filter((item) => item.userId === currentUserId);
  const timer = useCountdownTimer(run.collectUntil);
  const { hapticFeedback } = useTelegram();

  const { mutateAsync: addItems, isPending: adding } = useAddStoreItems(run.id);
  const { mutateAsync: deleteItem } = useDeleteStoreItem(run.id);

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isCollecting = run.status === 'COLLECTING' && !timer.isExpired;
  const isShopping = run.status === 'SHOPPING' || (run.status === 'COLLECTING' && timer.isExpired);
  const isSettled = run.status === 'SETTLED';

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Укажи название');
      return;
    }
    setError(null);
    try {
      const response = await addItems([{ name: trimmed, quantity, notes: notes.trim() || null }]);
      if (!response.success) throw new Error(response.error || 'Не удалось добавить');
      hapticFeedback?.notificationOccurred?.('success');
      setName('');
      setQuantity(1);
      setNotes('');
    } catch (err) {
      hapticFeedback?.notificationOccurred?.('error');
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const handleDelete = async (itemId: number) => {
    hapticFeedback?.impactOccurred?.('light');
    await deleteItem(itemId);
  };

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {isCollecting && (
        <div className="rounded-xl border border-primary/28 bg-primary/8 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Clock className="h-4 w-4" />
            Сбор до {timer.formattedTime}
          </div>
          <p className="mt-1 text-xs text-foreground/70">
            {run.initiator.firstName} собирает заказ в «{run.storeName}»
          </p>
        </div>
      )}
      {isShopping && (
        <div className="rounded-xl border border-amber-500/28 bg-amber-500/8 px-4 py-3">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            🛍 {run.initiator.firstName} в магазине. Жди цены.
          </p>
        </div>
      )}
      {isSettled && (
        <div className="rounded-xl border border-mint-500/28 bg-mint-500/8 px-4 py-3">
          <p className="text-sm font-medium text-mint-700 dark:text-mint-300">
            ✅ Забег завершён. Долги в разделе бюджета на главной.
          </p>
        </div>
      )}

      {/* My items */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Мой заказ</h3>
        {myItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Пока пусто — добавь что тебе взять.
          </p>
        ) : (
          <ul className="space-y-2">
            {myItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {item.name}
                    </span>
                    {item.quantity > 1 && (
                      <span className="text-xs text-muted-foreground">× {item.quantity}</span>
                    )}
                    {item.status === 'BOUGHT' && (
                      <CheckCircle2 className="h-4 w-4 text-mint-600 dark:text-mint-400" />
                    )}
                    {item.status === 'NOT_FOUND' && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  {item.notes && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.notes}</p>
                  )}
                  {item.price != null && item.status === 'BOUGHT' && (
                    <p className="mt-0.5 text-xs font-semibold text-primary">
                      {Number(item.price).toFixed(0)} ₽
                    </p>
                  )}
                </div>
                {isCollecting && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add form */}
      {isCollecting && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название (напр. Red Bull 0.5)"
            maxLength={200}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Заметка (опционально)"
              maxLength={500}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            onClick={handleAdd}
            disabled={adding || !name.trim()}
            className={cn('w-full')}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {adding ? 'Добавляем…' : 'Добавить'}
          </Button>
        </div>
      )}
    </div>
  );
};
