import { BudgetWidget } from '@/components/budget/BudgetWidget';
import { CalculatorModal } from '@/components/budget/CalculatorModal';
import { useBudgetWidget } from '@/hooks/useBudgetWidget';

export function BudgetDemoPage() {
  const {
    data,
    callbacks,
    calcOpen,
    closeCalculator,
    creditsTotal,
    creditsParticipants,
  } = useBudgetWidget();

  return (
    <>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BudgetWidget data={data} callbacks={callbacks} />
      </div>

      <CalculatorModal
        open={calcOpen}
        defaultTotal={creditsTotal}
        participants={creditsParticipants}
        onClose={closeCalculator}
        onSubmit={closeCalculator}
      />
    </>
  );
}
