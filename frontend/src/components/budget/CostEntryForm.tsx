import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetService } from '../../services/budget.service';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Card } from '../ui/card';
import { DollarSign, TruckIcon, Percent, Heart, Info } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';
import { toast } from 'sonner';
import { ICON_SIZES } from '@/lib/design-tokens';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface CostEntryFormProps {
  pollId: number;
  onSuccess?: () => void;
  initialValues?: {
    deliveryCost: number;
    serviceFee: number;
    tip: number;
    notes?: string;
  };
}

/**
 * Форма для ввода стоимости доставки, комиссий и чаевых
 * Доступна только ответственному лицу
 */
export const CostEntryForm = ({
  pollId,
  onSuccess,
  initialValues,
}: CostEntryFormProps) => {
  const haptic = useHaptic();
  const queryClient = useQueryClient();

  const [deliveryCost, setDeliveryCost] = useState<string>(
    initialValues?.deliveryCost?.toString() || '0'
  );
  const [serviceFee, setServiceFee] = useState<string>(
    initialValues?.serviceFee?.toString() || '0'
  );
  const [tip, setTip] = useState<string>(initialValues?.tip?.toString() || '0');
  const [notes, setNotes] = useState<string>(initialValues?.notes || '');

  const setOrderCostsMutation = useMutation({
    mutationFn: (costs: {
      deliveryCost: number;
      serviceFee: number;
      tip: number;
      notes?: string;
    }) => budgetService.setOrderCosts(pollId, costs),
    onSuccess: () => {
      haptic.success();
      toast.success('Расходы сохранены!', {
        description: 'Суммы пересчитаны для всех участников',
      });
      queryClient.invalidateQueries({ queryKey: ['budget'] });
      queryClient.invalidateQueries({ queryKey: ['pollCostBreakdown', pollId] });
      onSuccess?.();
    },
    onError: (error: unknown) => {
      haptic.error();
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Не удалось сохранить расходы';
      toast.error('Ошибка', { description: errorMessage });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    haptic.impact();

    const deliveryCostNum = parseFloat(deliveryCost) || 0;
    const serviceFeeNum = parseFloat(serviceFee) || 0;
    const tipNum = parseFloat(tip) || 0;

    if (deliveryCostNum < 0 || serviceFeeNum < 0 || tipNum < 0) {
      haptic.error();
      toast.error('Суммы не могут быть отрицательными');
      return;
    }

    setOrderCostsMutation.mutate({
      deliveryCost: deliveryCostNum,
      serviceFee: serviceFeeNum,
      tip: tipNum,
      notes: notes.trim() || undefined,
    });
  };

  const totalAdditional = (parseFloat(deliveryCost) || 0) + (parseFloat(serviceFee) || 0) + (parseFloat(tip) || 0);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className={`${ICON_SIZES.md} text-primary`} />
        <h3 className="text-lg font-semibold">Дополнительные расходы</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className={`${ICON_SIZES.sm} text-muted-foreground`} />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-sm">
                Введи дополнительные расходы. Они будут равномерно распределены между всеми участниками.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Delivery Cost */}
        <div className="space-y-2">
          <label htmlFor="deliveryCost" className="flex items-center gap-2 text-sm font-medium">
            <TruckIcon className={`${ICON_SIZES.sm} text-muted-foreground`} />
            Доставка
          </label>
          <div className="relative">
            <Input
              id="deliveryCost"
              type="number"
              min="0"
              step="0.01"
              value={deliveryCost}
              onChange={(e) => setDeliveryCost(e.target.value)}
              placeholder="0.00"
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              ₽
            </span>
          </div>
        </div>

        {/* Service Fee */}
        <div className="space-y-2">
          <label htmlFor="serviceFee" className="flex items-center gap-2 text-sm font-medium">
            <Percent className={`${ICON_SIZES.sm} text-muted-foreground`} />
            Комиссия сервиса
          </label>
          <div className="relative">
            <Input
              id="serviceFee"
              type="number"
              min="0"
              step="0.01"
              value={serviceFee}
              onChange={(e) => setServiceFee(e.target.value)}
              placeholder="0.00"
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              ₽
            </span>
          </div>
        </div>

        {/* Tip */}
        <div className="space-y-2">
          <label htmlFor="tip" className="flex items-center gap-2 text-sm font-medium">
            <Heart className={`${ICON_SIZES.sm} text-muted-foreground`} />
            Чаевые (опционально)
          </label>
          <div className="relative">
            <Input
              id="tip"
              type="number"
              min="0"
              step="0.01"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              placeholder="0.00"
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              ₽
            </span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label htmlFor="notes" className="text-sm font-medium">
            Заметки (опционально)
          </label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Например: Заказывали из Яндекс.Еда, промокод не сработал"
            rows={3}
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground text-right">
            {notes.length}/200
          </p>
        </div>

        {/* Total Additional */}
        {totalAdditional > 0 && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Всего дополнительно:</span>
              <span className="text-lg font-bold">{totalAdditional.toFixed(2)} ₽</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={setOrderCostsMutation.isPending}
        >
          {setOrderCostsMutation.isPending ? 'Сохранение...' : 'Сохранить расходы'}
        </Button>
      </form>
    </Card>
  );
};
