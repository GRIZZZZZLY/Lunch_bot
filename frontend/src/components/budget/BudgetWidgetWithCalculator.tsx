import { useState } from 'react';
import { useActivePolls } from '@/hooks/usePolls';
import {
  useUserCategoryOrder,
  useParticipantCategoryOrders,
  useCategoryOrder,
  useCategoryOrders,
} from '@/hooks/useCategoryOrders';
import { CompactResponsibleBanner } from './CompactResponsibleBanner';
import { WaitingCalculationView } from './WaitingCalculationView';
import { BudgetWidget } from './BudgetWidget';
import { useOrderCalculation } from '@/hooks/useOrderCalculation';
import { categoryOrderService, CategoryOrder } from '@/services/category-order.service';
import { useAuth } from '@/hooks/useAuth';
import { GlassCard } from '@/components/ui/glass-card';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/useAppStore';
import { useSSE } from '@/hooks/useSSE';

const isResolvedSelection = (selectionStatus: CategoryOrder['selectionStatus']) =>
  selectionStatus === 'SELECTED_AUTO' ||
  selectionStatus === 'SELECTED_VOLUNTEER' ||
  selectionStatus === 'SELECTED_ROULETTE';

const isSelectionInProgress = (selectionStatus: CategoryOrder['selectionStatus']) =>
  selectionStatus === 'PENDING' || selectionStatus === 'VOLUNTEER_OPEN';

/**
 * Enhanced BudgetWidget that handles CategoryOrder calculator display
 * Shows compact banner with button if user is responsible for a CategoryOrder
 * Shows waiting view if user is participant in CategoryOrder
 * Otherwise shows regular BudgetWidget
 */
export function BudgetWidgetWithCalculator({
  pollId,
  onOpenCalculator,
}: {
  pollId?: number | null;
  onOpenCalculator?: (categoryOrder: CategoryOrder) => void;
}) {
  const { data: activePolls, isLoading: pollsLoading } = useActivePolls();
  const activePoll = activePolls?.[0];
  const effectivePollId = pollId ?? activePoll?.id;
  const { user } = useAuth();

  // Real-time updates for responsible selection and category-order progress.
  useSSE({
    pollId: effectivePollId ?? undefined,
    enabled: !!effectivePollId,
  });
  
  // Check if user is responsible for any category in active poll
  const { isResponsible, categoryOrder: userCategoryOrder, isLoading: responsibleLoading } = 
    useIsResponsibleForAnyCategory(effectivePollId);

  // Check if user is a participant in any category
  const { data: participantOrders, isLoading: participantLoading } = 
    useParticipantCategoryOrders(effectivePollId);

  const { data: allCategoryOrders, isLoading: allOrdersLoading } = useCategoryOrders(
    effectivePollId,
    { enabled: !!effectivePollId && !!user?.isAdmin }
  );

  const isLoading =
    pollsLoading || responsibleLoading || participantLoading || allOrdersLoading;

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/96 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-pulse rounded-full bg-primary/15" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  // Priority 1: User is responsible and calculation not completed - Show compact banner
  if (
    isResponsible && 
    userCategoryOrder && 
    isResolvedSelection(userCategoryOrder.selectionStatus) &&
    userCategoryOrder.calculationStatus !== 'COMPLETED'
  ) {
    return (
      <CompactResponsibleBanner 
        categoryOrder={userCategoryOrder}
        onOpenCalculator={() => onOpenCalculator?.(userCategoryOrder)}
      />
    );
  }

  // Priority 2: Admin view for non-responsible users
  if (user?.isAdmin && allCategoryOrders && allCategoryOrders.length > 0) {
    const pendingOrders = allCategoryOrders.filter(
      (order) => order.calculationStatus !== 'COMPLETED'
    );

    if (pendingOrders.length > 0) {
      const adminOrder = pendingOrders[0];

      if (isSelectionInProgress(adminOrder.selectionStatus)) {
        return (
          <SelectionInProgressCard
            pollId={effectivePollId || null}
            categoryOrderId={adminOrder.id}
            category={adminOrder.category}
            participantCount={adminOrder.participantCount}
            note='Ожидаем выбора ответственного в Telegram'
            canVolunteer={false}
          />
        );
      }

      const responsibleName = adminOrder.responsibleUser?.firstName;
      const note = responsibleName
        ? `Только просмотр · Ответственный: ${responsibleName}`
        : 'Только просмотр';

      return (
        <CompactResponsibleBanner
          categoryOrder={adminOrder}
          onOpenCalculator={() => onOpenCalculator?.(adminOrder)}
          title={`Админ-доступ к расчёту: ${adminOrder.category}`}
          note={note}
          buttonLabel="Посмотреть заказ"
        />
      );
    }
  }

  // Priority 3: User is participant and calculation in progress
  if (participantOrders && participantOrders.length > 0) {
    // Find first non-completed category order where user is participant
    const pendingOrder = participantOrders.find(
      (order) => order.calculationStatus !== 'COMPLETED'
    );

    if (pendingOrder) {
      if (isSelectionInProgress(pendingOrder.selectionStatus)) {
        return (
          <SelectionInProgressCard
            pollId={effectivePollId || null}
            categoryOrderId={pendingOrder.id}
            category={pendingOrder.category}
            participantCount={pendingOrder.participantCount}
            note='Выбор ответственного еще идет. Можно вызваться через Mini App.'
            canVolunteer={true}
          />
        );
      }

      // Fetch progress for this order
      return <WaitingCalculationViewWrapper categoryOrderId={pendingOrder.id} />;
    }
  }

  // Priority 3: Regular budget widget (old flow or completed calculations)
  return <BudgetWidget />;
}

/**
 * Wrapper component to fetch progress data for WaitingCalculationView
 */
function WaitingCalculationViewWrapper({ categoryOrderId }: { categoryOrderId: number }) {
  const { progress } = useOrderCalculation({ categoryOrderId });
  const { data: categoryOrder } = useCategoryOrder(categoryOrderId);

  if (!categoryOrder || !progress) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/96 p-4 shadow-sm">
        <div className="flex items-center justify-center py-4">
          <div className="text-sm text-muted-foreground">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/14 bg-card/98 shadow-sm">
      <div className="p-4">
        <WaitingCalculationView categoryOrder={categoryOrder} progress={progress} />
      </div>
    </div>
  );
}

/**
 * Re-export the check hook for convenience
 */
function useIsResponsibleForAnyCategory(pollId: number | null | undefined) {
  const userCategoryOrder = useUserCategoryOrder(pollId);
  
  return {
    isResponsible: !!userCategoryOrder.data,
    categoryOrder: userCategoryOrder.data,
    isLoading: userCategoryOrder.isLoading,
    error: userCategoryOrder.error,
  };
}

function SelectionInProgressCard({
  pollId,
  categoryOrderId,
  category,
  participantCount,
  note,
  canVolunteer,
}: {
  pollId: number | null;
  categoryOrderId: number;
  category: string;
  participantCount: number;
  note: string;
  canVolunteer: boolean;
}) {
  const [isVolunteering, setIsVolunteering] = useState(false);
  const queryClient = useQueryClient();
  const addNotification = useAppStore(state => state.addNotification);

  const handleVolunteer = async () => {
    if (isVolunteering) return;

    try {
      setIsVolunteering(true);
      const response = await categoryOrderService.volunteerForCategory(categoryOrderId);

      if (!response.success) {
        addNotification({
          type: 'error',
          message: response.error || 'Не удалось стать ответственным',
        });
        return;
      }

      addNotification({
        type: 'success',
        message: 'Готово! Проверяем назначение ответственного...',
      });

      await queryClient.invalidateQueries({ queryKey: ['categoryOrders'] });
      await queryClient.invalidateQueries({ queryKey: ['categoryOrder', categoryOrderId] });
      if (pollId) {
        await queryClient.invalidateQueries({ queryKey: ['categoryOrders', 'my', pollId] });
      }
    } finally {
      setIsVolunteering(false);
    }
  };

  return (
    <GlassCard intensity='high' className='border-butter-500/28 bg-butter-500/6 dark:bg-butter-500/7'>
      <div className='p-4'>
        <div className='flex items-start gap-3'>
          <div className='mt-0.5 rounded-full bg-butter-500/14 p-2 text-butter-700 dark:text-butter-400'>
            <Clock className='h-4 w-4' />
          </div>
          <div className='flex-1'>
            <h3 className='text-sm font-semibold text-foreground'>
              Идет выбор ответственного
            </h3>
            <p className='mt-1 text-sm text-muted-foreground'>
              Категория: <span className='font-medium text-foreground'>{category}</span> · {participantCount} участников
            </p>
            <p className='mt-2 text-xs text-muted-foreground'>{note}</p>
            {canVolunteer && (
              <div className='mt-3'>
                <Button
                  onClick={handleVolunteer}
                  disabled={isVolunteering}
                  size='sm'
                  className='w-full'
                >
                  {isVolunteering ? 'Отправляем...' : '🙋 Я оформлю'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
