import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Send, 
  CheckCircle2,
  Loader2 
} from 'lucide-react';
import { CategoryOrder, OrderItem, SaveOrderItemData, categoryOrderService } from '@/services/category-order.service';
import { useOrderCalculation } from '@/hooks/useOrderCalculation';
import { useCategoryOrder } from '@/hooks/useCategoryOrders';
import { OrderItemForm } from './OrderItemForm';
import { ICON_SIZES } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface CategoryOrderCalculatorProps {
  categoryOrder: CategoryOrder;
  canEdit?: boolean;
}

interface OrderTotalsProps {
  itemsTotal: number;
  additionalTotal: number;
  additionalPerPerson: number;
  grandTotal: number;
}

const OrderTotals = ({
  itemsTotal,
  additionalTotal,
  additionalPerPerson,
  grandTotal,
}: OrderTotalsProps) => (
  <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-coral-500/5 dark:from-lavender-500/12 dark:to-primary/6 border border-border/60 p-4">
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted-foreground space-y-0.5 tabular-nums">
        <div>
          Блюда <span className="font-semibold text-foreground">{itemsTotal.toFixed(0)} ₽</span>
          {additionalTotal > 0 && (
            <span> · доп <span className="font-semibold text-foreground">{additionalTotal.toFixed(0)} ₽</span></span>
          )}
        </div>
        {additionalPerPerson > 0 && (
          <div>{additionalPerPerson.toFixed(0)} ₽/чел доп. расходы</div>
        )}
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Итого</div>
        <div className="text-2xl font-extrabold tracking-tight text-primary dark:text-lavender-400 tabular-nums">
          {grandTotal.toFixed(0)} ₽
        </div>
      </div>
    </div>
  </div>
);

interface OrderParticipantsProps {
  participants: Array<{ userId: number; userName: string; orderItem?: OrderItem }>;
  isLoading: boolean;
  canEdit: boolean;
  onAutoSave: (data: SaveOrderItemData) => void;
}

const OrderParticipants = ({ participants, isLoading, canEdit, onAutoSave }: OrderParticipantsProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className={cn(ICON_SIZES.lg, 'animate-spin text-muted-foreground')} />
      </div>
    );
  }

  if (participants.length === 0) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Нет участников для заполнения</div>;
  }

  return (
    <div className="space-y-2">
      {participants.map((participant, index) => (
        <OrderItemForm
          key={`${participant.userId}:${participant.orderItem?.updatedAt ?? 'new'}`}
          userId={participant.userId}
          userName={participant.userName}
          existingItem={participant.orderItem}
          onAutoSave={onAutoSave}
          isEditable={canEdit}
          isLast={index === participants.length - 1}
        />
      ))}
    </div>
  );
};

export function CategoryOrderCalculator({
  categoryOrder,
  canEdit = true,
}: CategoryOrderCalculatorProps) {
  const [deliveryCost, setDeliveryCost] = useState(
    categoryOrder.deliveryCost ? categoryOrder.deliveryCost.toString() : ''
  );
  const [serviceFee, setServiceFee] = useState(
    categoryOrder.serviceFee ? categoryOrder.serviceFee.toString() : ''
  );
  const [tip, setTip] = useState(categoryOrder.tip ? categoryOrder.tip.toString() : '');
  
  const updateCostsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const {
    orderItems,
    pendingSaves,
    isLoading,
    isFinalizing,
    autoSave,
    updateCosts,
    updateCostsAsync,
    finalizeCalculation,
    isUpdatingCosts,
  } = useOrderCalculation({ categoryOrderId: categoryOrder.id });

  // Refetch category order for updated totals
  const { data: updatedCategoryOrder } = useCategoryOrder(categoryOrder.id);
  const currentOrder = updatedCategoryOrder || categoryOrder;

  // Fetch participants (users who voted for this category)
  const { data: participantsResponse, isLoading: participantsLoading } = useQuery({
    queryKey: ['participants', categoryOrder.id],
    queryFn: async () => {
      const response = await categoryOrderService.getParticipants(categoryOrder.id);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch participants');
      }
      return response.data;
    },
    staleTime: 30000, // 30 seconds
  });

  // Get participants who need orders filled
  const participants = useMemo(() => {
    const resolvedParticipants = participantsResponse || [];
    if (resolvedParticipants.length === 0) {
      // No participants data yet - show loading or placeholder
      return [];
    }

    // Build map of existing order items by userId
    const orderItemsMap = new Map(
      orderItems?.map((item) => [item.userId, item]) || []
    );

    // Create participant list from real participants
    return resolvedParticipants.map((participant) => {
      const orderItem = orderItemsMap.get(participant.id);
      return {
        userId: participant.id,
        userName: participant.firstName,
        orderItem,
      };
    });
  }, [participantsResponse, orderItems]);

  // Calculate totals
  const totals = useMemo(() => {
    const itemsTotal = Number(currentOrder.totalItemsAmount) || 0;
    const delivery = parseFloat(deliveryCost) || 0;
    const service = parseFloat(serviceFee) || 0;
    const tipAmount = parseFloat(tip) || 0;
    const additionalTotal = delivery + service + tipAmount;
    const grandTotal = itemsTotal + additionalTotal;
    const perPerson = currentOrder.participantCount > 0 
      ? (delivery + service + tipAmount) / currentOrder.participantCount 
      : 0;

    return {
      itemsTotal,
      delivery,
      service,
      tip: tipAmount,
      additionalTotal,
      grandTotal,
      additionalPerPerson: perPerson,
    };
  }, [currentOrder.totalItemsAmount, currentOrder.participantCount, deliveryCost, serviceFee, tip]);

  const getCurrentCosts = () => ({
    deliveryCost: totals.delivery,
    serviceFee: totals.service,
    tip: totals.tip,
  });

  // Handle costs update with debounce
  const handleUpdateCosts = () => {
    if (!canEdit) {
      return;
    }

    // Clear existing timeout
    if (updateCostsTimeoutRef.current) {
      clearTimeout(updateCostsTimeoutRef.current);
    }
    
    // Set new timeout - only update after 800ms of no changes
    updateCostsTimeoutRef.current = setTimeout(() => {
      updateCostsTimeoutRef.current = undefined;
      updateCosts(getCurrentCosts());
    }, 800);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateCostsTimeoutRef.current) {
        clearTimeout(updateCostsTimeoutRef.current);
      }
    };
  }, []);

  // Client-side validation: check if all required fields are filled
  const allFieldsFilled = useMemo(() => {
    if (participants.length === 0) return false;
    
    return participants.every((participant) => {
      const orderItem = participant.orderItem;
      
      // If orderItem exists, check its validity
      if (orderItem) {
        return (
          orderItem.itemName.trim().length > 0 &&
          Number(orderItem.price) > 0
        );
      }
      
      // If no orderItem yet, check if save is pending
      return pendingSaves.has(participant.userId);
    });
  }, [participants, pendingSaves]);

  const hasPendingSaves = pendingSaves.size > 0;
  const canFinalize =
    canEdit &&
    allFieldsFilled &&
    !isFinalizing &&
    currentOrder.calculationStatus !== 'COMPLETED';

  const handleFinalize = async () => {
    if (!canFinalize) {
      return;
    }

    if (updateCostsTimeoutRef.current) {
      clearTimeout(updateCostsTimeoutRef.current);
      updateCostsTimeoutRef.current = undefined;
    }

    try {
      await updateCostsAsync(getCurrentCosts());
      finalizeCalculation();
    } catch {
      // updateCostsAsync already reports the error through the mutation handler.
    }
  };

  return (
    <div className="space-y-4">

      <OrderParticipants
        participants={participants}
        isLoading={isLoading || participantsLoading}
        canEdit={canEdit}
        onAutoSave={autoSave}
      />

      {/* Additional Costs - чипы */}
      <div>
        <p className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Доп. расходы
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor="delivery" className="text-xs text-muted-foreground mb-1 block">
              Доставка (₽)
            </Label>
            <Input
              id="delivery"
              type="number"
              step="0.01"
              min="0"
              value={deliveryCost}
              onChange={(e) => setDeliveryCost(e.target.value)}
              placeholder="0"
              onBlur={handleUpdateCosts}
              disabled={isUpdatingCosts || !canEdit}
              className="h-9 text-sm"
            />
          </div>

          <div>
            <Label htmlFor="service" className="text-xs text-muted-foreground mb-1 block">
              Сервис (₽)
            </Label>
            <Input
              id="service"
              type="number"
              step="0.01"
              min="0"
              value={serviceFee}
              onChange={(e) => setServiceFee(e.target.value)}
              placeholder="0"
              onBlur={handleUpdateCosts}
              disabled={isUpdatingCosts || !canEdit}
              className="h-9 text-sm"
            />
          </div>

          <div>
            <Label htmlFor="tip" className="text-xs text-muted-foreground mb-1 block">
              Чаевые (₽)
            </Label>
            <Input
              id="tip"
              type="number"
              step="0.01"
              min="0"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              placeholder="0"
              onBlur={handleUpdateCosts}
              disabled={isUpdatingCosts || !canEdit}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      <OrderTotals {...totals} />

      {/* Finalize Button - Compact */}
      <div>
        <Button
          onClick={handleFinalize}
          disabled={!canFinalize}
          className="w-full"
          size="default"
        >
          {isFinalizing ? (
            <>
              <Loader2 className={cn(ICON_SIZES.sm, "mr-2 animate-spin")} />
              Отправка...
            </>
          ) : currentOrder.calculationStatus === 'COMPLETED' ? (
            <>
              <CheckCircle2 className={cn(ICON_SIZES.sm, "mr-2")} />
              Расчёт завершён
            </>
          ) : (
            <>
              <Send className={cn(ICON_SIZES.sm, "mr-2")} />
              Отправить суммы
            </>
          )}
        </Button>
        
        {/* Hint for unfilled fields */}
        {currentOrder.calculationStatus !== 'COMPLETED' &&
          (!allFieldsFilled || !canEdit) && (
            <div className="text-xs text-center text-muted-foreground mt-2">
              {!canEdit
                ? 'Только ответственный может редактировать расчёт'
                : 'Заполни все обязательные поля: Позиция и Цена'}
            </div>
          )}
        {hasPendingSaves && currentOrder.calculationStatus !== 'COMPLETED' && (
          <div className="text-xs text-center text-muted-foreground mt-1">
            Сохранение данных...
          </div>
        )}
      </div>
    </div>
  );
}
