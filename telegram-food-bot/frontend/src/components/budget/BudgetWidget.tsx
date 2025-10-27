import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBudgetWidget } from '../../hooks/useBudgetWidget';
import { GlassCard } from '../ui/glass-card';
import { Badge } from '../ui/badge';
import { UrgentDebtView } from './UrgentDebtView';
import { WaitingConfirmationView } from './WaitingConfirmationView';
import { SuccessMessageView } from './SuccessMessageView';
import { ResponsibleView } from './ResponsibleView';
import { OverviewView } from './OverviewView';
import { Wallet, AlertCircle, CheckCircle2, Crown, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Стили для разных сценариев
 */
const scenarioStyles = {
  'urgent-debt': {
    icon: <AlertCircle className="size-5" />,
    title: 'Ваш долг',
    badge: { text: 'Новое', variant: 'destructive' as const },
  },
  'waiting-confirmation': {
    icon: <CheckCircle2 className="size-5" />,
    title: 'Ожидание подтверждения',
    badge: null,
  },
  'success-message': {
    icon: <CheckCircle2 className="size-5 text-mint-500" />,
    title: 'Оплата подтверждена',
    badge: null,
  },
  'overview': {
    icon: <Wallet className="size-5" />,
    title: 'Финансы',
    badge: null,
  },
  'responsible-view': {
    icon: <Crown className="size-5 text-peach-500" />,
    title: 'Вы ответственный',
    badge: { text: 'Активно', variant: 'default' as const },
  },
  'hidden': {
    icon: null,
    title: '',
    badge: null,
  },
};

/**
 * Error Boundary для перехвата ошибок виджета
 */
class BudgetWidgetErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[BudgetWidget] ❌ Error caught by boundary:', {
      error: error?.message || 'Unknown error',
      errorInfo,
      stack: error?.stack,
    });
    
    // Дополнительно логируем для отладки production краша
    try {
      console.error('[BudgetWidget] ❌ Detailed error info:', {
        errorName: error?.name,
        errorMessage: error?.message,
        errorToString: String(error),
        componentStack: errorInfo?.componentStack,
      });
    } catch (e) {
      console.error('[BudgetWidget] ❌ Failed to log error details:', e);
    }
  }

  render() {
    if (this.state.hasError) {
      // Graceful degradation - скрываем виджет при ошибке
      console.warn('[BudgetWidget] ⚠️ Widget hidden due to error');
      return null;
    }

    return this.props.children;
  }
}

/**
 * Адаптивный виджет бюджет-трекера
 * Меняется в зависимости от контекста (6 сценариев)
 */
const BudgetWidgetContent: React.FC = () => {
  const {
    scenario,
    currentDebt,
    otherDebts,
    credits,
    isResponsible,
    totalDebts,
    totalCredits,
    isLoading,
  } = useBudgetWidget();

  const queryClient = useQueryClient();
  
  // Debug logging
  useEffect(() => {
    console.log('🔵 [BudgetWidget] Render:', {
      scenario,
      isLoading,
      debtsCount: otherDebts.length,
      creditsCount: credits.length,
      totalDebts,
      totalCredits,
      currentDebt: currentDebt?.id,
      otherDebts: otherDebts.map(d => ({ id: d.id, amount: d.amount, menuItem: d.menuItem?.name })),
      credits: credits.map(c => ({ id: c.id, amount: c.amount, fromUser: c.fromUser.firstName })),
    });
  }, [scenario, isLoading, otherDebts, credits, totalDebts, totalCredits, currentDebt]);
  
  // Auto-hide для success-message через 3 секунды
  useEffect(() => {
    if (scenario === 'success-message') {
      const timer = setTimeout(() => {
        // Invalidate queries чтобы обновить данные и перейти к следующему состоянию
        queryClient.invalidateQueries({ queryKey: ['budget'] });
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [scenario, queryClient]);
  
  // DEBUG MODE - показываем информацию для отладки
  const DEBUG_MODE = false;
  
  // Скрываем виджет если нет данных
  if (scenario === 'hidden' || isLoading) {
    if (DEBUG_MODE) {
      return (
        <GlassCard intensity="solid" className="p-4">
          <div className="text-xs space-y-2 font-mono">
            <div className="font-bold text-red-500">🔍 DEBUG: Widget Hidden</div>
            <div>Scenario: {scenario}</div>
            <div>Loading: {isLoading ? 'YES' : 'NO'}</div>
            <div>Debts count: {otherDebts.length}</div>
            <div>Credits count: {credits.length}</div>
            <div>Total debts: {totalDebts}₽</div>
            <div>Total credits: {totalCredits}₽</div>
          </div>
        </GlassCard>
      );
    }
    return null;
  }
  
  const style = scenarioStyles[scenario];
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={scenario}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 25,
          duration: 0.3 
        }}
      >
        <GlassCard
          intensity="solid"
          className="overflow-hidden"
        >
          {/* DEBUG INFO */}
          {DEBUG_MODE && (
            <div className="bg-yellow-100 dark:bg-yellow-900/20 p-2 text-xs font-mono space-y-1 max-h-96 overflow-y-auto">
              <div className="font-bold">🔍 DEBUG INFO:</div>
              <div>Scenario: {scenario}</div>
              <div>Debts: {otherDebts.length} items, Total: {totalDebts}₽</div>
              <div>Credits: {credits.length} items, Total: {totalCredits}₽</div>
              {currentDebt && <div>Current debt: #{currentDebt.id}, {currentDebt.amount}₽</div>}
              <div>Is Responsible: {isResponsible ? 'YES' : 'NO'}</div>
              
              {/* Детальная информация о долгах */}
              {otherDebts.length > 0 && (
                <div className="mt-2 pt-2 border-t border-yellow-300">
                  <div className="font-bold">📋 Debts Details:</div>
                  {otherDebts.map((debt, idx) => (
                    <div key={debt.id} className="ml-2 mt-1 pl-2 border-l-2 border-yellow-400">
                      <div>#{idx + 1}: ID={debt.id}, Amount={debt.amount}₽</div>
                      <div>Item: {debt.menuItem?.name || 'N/A'}</div>
                      <div>To: {debt.toUser?.firstName || 'Unknown'} (ID: {debt.toUserId})</div>
                      <div>From: {debt.fromUser?.firstName || 'Unknown'} (ID: {debt.fromUserId})</div>
                      <div>Status: {debt.status}</div>
                      <div>PollId: {debt.pollId}</div>
                      <div>Created: {new Date(debt.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Детальная информация о кредитах */}
              {credits.length > 0 && (
                <div className="mt-2 pt-2 border-t border-yellow-300">
                  <div className="font-bold">💰 Credits Details:</div>
                  {credits.map((credit, idx) => (
                    <div key={credit.id} className="ml-2 mt-1 pl-2 border-l-2 border-yellow-400">
                      <div>#{idx + 1}: ID={credit.id}, Amount={credit.amount}₽</div>
                      <div>From: {credit.fromUser?.firstName || 'Unknown'} (ID: {credit.fromUserId})</div>
                      <div>Status: {credit.status}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Header - увеличенный padding */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              {style.icon}
              <h3 className="font-semibold text-foreground">
                {style.title}
              </h3>
            </div>
            {style.badge && (
              <Badge variant={style.badge.variant}>
                {style.badge.text}
              </Badge>
            )}
          </div>
          
          {/* Content - увеличенный padding для лучшей читаемости */}
          <div className="px-5 pb-5">
            {/* Добавляем дополнительные проверки для предотвращения крашей */}
            {scenario === 'urgent-debt' && currentDebt && (
              <UrgentDebtView 
                debt={currentDebt}
                otherDebts={otherDebts || []}
                credits={credits || []}
              />
            )}
            
            {scenario === 'waiting-confirmation' && currentDebt && (
              <WaitingConfirmationView
                debt={currentDebt}
                otherDebts={otherDebts || []}
                credits={credits || []}
              />
            )}
            
            {scenario === 'success-message' && currentDebt && (
              <SuccessMessageView debt={currentDebt} />
            )}
            
            {scenario === 'responsible-view' && credits && credits.length > 0 && (
              <ResponsibleView
                credits={credits}
                otherDebts={otherDebts || []}
              />
            )}
            
            {scenario === 'overview' && (
              <OverviewView
                debts={otherDebts || []}
                credits={credits || []}
                totalDebts={totalDebts || 0}
                totalCredits={totalCredits || 0}
              />
            )}
          </div>
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Экспортируемый компонент с Error Boundary
 */
export const BudgetWidget: React.FC = () => {
  return (
    <BudgetWidgetErrorBoundary>
      <BudgetWidgetContent />
    </BudgetWidgetErrorBoundary>
  );
};
