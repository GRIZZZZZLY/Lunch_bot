import React, { useEffect, useState } from 'react';
import { ShoppingBag, Store, Users, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCreateStoreRun } from '@/hooks/queries/useStoreRunQueries';
import { useUserGroups } from '@/hooks/queries/useUserQueries';
import { useTelegram } from '@/hooks/useTelegram';

const STORE_PRESETS = ['КБ', 'Пятёрочка', 'Вкусвилл', 'Другой'] as const;
type StorePreset = (typeof STORE_PRESETS)[number];

const TIMER_PRESETS = [5, 10, 15] as const;
const TIMER_MIN = 3;
const TIMER_MAX = 30;

export interface CreateStoreRunSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number | null;
  onCreated?: (storeRunId: number) => void;
}

export const CreateStoreRunSheet: React.FC<CreateStoreRunSheetProps> = ({
  open,
  onOpenChange,
  groupId,
  onCreated,
}) => {
  const [preset, setPreset] = useState<StorePreset>('КБ');
  const [customName, setCustomName] = useState('');
  const [minutes, setMinutes] = useState<number>(10);
  const [error, setError] = useState<string | null>(null);

  const { data: groups = [] } = useUserGroups();
  const activeGroups = groups.filter((g) => g.isActive);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(groupId);

  // Дефолт = переданная группа из шапки, если валидна; иначе первая доступная.
  useEffect(() => {
    const valid =
      selectedGroupId != null && activeGroups.some((g) => g.id === selectedGroupId);
    if (!valid) {
      setSelectedGroupId(groupId ?? activeGroups[0]?.id ?? null);
    }
  }, [groupId, activeGroups, selectedGroupId]);

  const { mutateAsync, isPending } = useCreateStoreRun();
  const { hapticFeedback } = useTelegram();

  const resolvedName = preset === 'Другой' ? customName.trim() : preset;
  const canSubmit =
    !!selectedGroupId && resolvedName.length > 0 && resolvedName.length <= 100 && !isPending;

  const handleSubmit = async () => {
    if (!selectedGroupId) {
      setError('Не нашли группу. Добавь бота в групповой чат.');
      return;
    }
    if (!resolvedName) {
      setError('Укажи название магазина');
      return;
    }
    setError(null);
    try {
      hapticFeedback?.impactOccurred?.('medium');
      const response = await mutateAsync({
        groupId: selectedGroupId,
        storeName: resolvedName,
        collectMinutes: minutes,
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Не удалось создать забег');
      }
      hapticFeedback?.notificationOccurred?.('success');
      onOpenChange(false);
      onCreated?.(response.data.id);
      // Reset for next open
      setPreset('КБ');
      setCustomName('');
      setMinutes(10);
    } catch (err) {
      hapticFeedback?.notificationOccurred?.('error');
      const apiErr = err as { error?: string; code?: string };
      if (apiErr?.code === 'BOT_NOT_IN_GROUP') {
        setError('Бот не в этой группе. Добавь его в нужный групповой чат и попробуй снова.');
      } else if (apiErr?.error) {
        setError(apiErr.error);
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка создания');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-mint-500" />
            Иду в магазин
          </DialogTitle>
          <DialogDescription>
            Коллегам придёт уведомление в личку с возможностью закинуть свой заказ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Группа (только при нескольких группах) */}
          {activeGroups.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Группа</label>
              <div className="space-y-1">
                {activeGroups.map((group) => {
                  const isSelected = selectedGroupId === group.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        hapticFeedback?.selectionChanged?.();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint-500/12">
                        <Users className="h-4 w-4 text-mint-600 dark:text-mint-400" />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {group.title}
                      </span>
                      {isSelected ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-mint-500" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-muted-foreground/30" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Store preset */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Магазин</label>
            <div className="flex flex-wrap gap-2">
              {STORE_PRESETS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setPreset(opt);
                    hapticFeedback?.selectionChanged?.();
                  }}
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm font-medium transition-all',
                    preset === opt
                      ? 'border-primary bg-primary/12 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/40',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            {preset === 'Другой' && (
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Например, Азбука Вкуса"
                maxLength={100}
                className="mt-1 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
            )}
          </div>

          {/* Timer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Сбор заказов</label>
              <span className="text-sm font-semibold text-primary">{minutes} мин</span>
            </div>
            <input
              type="range"
              min={TIMER_MIN}
              max={TIMER_MAX}
              step={1}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex gap-2">
              {TIMER_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setMinutes(p);
                    hapticFeedback?.selectionChanged?.();
                  }}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                    minutes === p
                      ? 'border-primary bg-primary/12 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/40',
                  )}
                >
                  {p} мин
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {!groupId && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Сначала добавь бота в групповой чат коллег, иначе некому получать уведомления.
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Отмена
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isPending ? 'Создаём…' : (
              <>
                <Store className="mr-1.5 h-4 w-4" />
                Поехали
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
