import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBudgetWidget } from '../../hooks/useBudgetWidget';
import { PastelCard } from '../ui/pastel-card';
import { Badge } from '../ui/badge';
import { UrgentDebtView } from './UrgentDebtView';
import { WaitingConfirmationView } from './WaitingConfirmationView';
import { SuccessMessageView } from './SuccessMessageView';
import { ResponsibleView } from './ResponsibleView';
import { OverviewView } from './OverviewView';
import { Wallet, AlertCircle, CheckCircle2, Crown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { ICON_SIZES } from '@/lib/design-tokens';
import { useHaptic } from '../../hooks/useHaptic';

/**
 * Стили для разных сценариев
 */
const scenarioStyles = {
  'urgent-debt': {
    icon: <AlertCircle className={ICON_SIZES.md} />,
    title: 'Ваш долг',
    badge: { text: 'Новое', variant: 'destructive' as const },
  },
  'waiting-confirmation': {
    icon: <CheckCircle2 className={ICON_SIZES.md} />,
    title: 'Ожидание подтверждения',
    badge: null,
  },
  'success-message': {
    icon: <CheckCircle2 className={`${ICON_SIZES.md} text-pastel-sage-500`} />,
    title: 'Оплата подтверждена',
    badge: null,
  },
  'overview': {
    icon: <Wallet className={ICON_SIZES.md} />,
    title: 'Финансы',
    badge: null,
  },
  'responsible-view': {
    icon: <Crown className={`${ICON_SIZES.md} text-pastel-peach-500`} />,
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
      // Graceful degradation - показываем компактный fallback
      console.warn('[BudgetWidget] ⚠️ Widget fallback due to error');
      return (
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-700 p-4">
          <div className="text-sm font-semibold text-foreground">Финансы</div>
          <div className="text-xs text-muted-foreground mt-1">
            Не удалось загрузить детали. Обновите страницу.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Адаптивный виджет бюджет-трекера
 * Всегда видимый, раскрываемый/сворачиваемый
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
  const haptic = useHaptic();
  
  // Состояние свёрнут/развёрнут (по умолчанию свёрнут если нет активных долгов)
  const [isExpanded, setIsExpanded] = useState(() => {
    // Автоматически разворачиваем если есть активные долги или кредиты
    return scenario !== 'hidden' && scenario !== 'overview';
  });

  // Автоматически разворачиваем при появлении срочных долгов
  useEffect(() => {
    if (scenario === 'urgent-debt' || scenario === 'responsible-view') {
      setIsExpanded(true);
    }
  }, [scenario]);
  
  // Auto-hide для success-message через 3 секунды
  useEffect(() => {
    if (scenario === 'success-message') {
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['budget'] });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [scenario, queryClient]);

  const toggleExpanded = () => {
    haptic.light();
    setIsExpanded(!isExpanded);
  };

  // Определяем отображаемый стиль
  const displayScenario = scenario === 'hidden' ? 'overview' : scenario;
  const style = scenarioStyles[displayScenario];

  // Краткая сводка для свёрнутого состояния
  const getSummary = () => {
    if (totalDebts > 0 && totalCredits > 0) {
      return `Долг: ${totalDebts}₽ · Вам должны: ${totalCredits}₽`;
    }
    if (totalDebts > 0) {
      return `Ваш долг: ${totalDebts}₽`;
    }
    if (totalCredits > 0) {
      return `Вам должны: ${totalCredits}₽`;
    }
    return 'Нет активных долгов';
  };

  // Определяем есть ли что показывать в развёрнутом виде
  const hasContent = scenario !== 'hidden' || otherDebts.length > 0 || credits.length > 0;
  
  if (isLoading) {
    return (
      <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={cn(
          "rounded-xl overflow-hidden transition-all duration-200",
          "bg-white dark:bg-gray-800 border-2",
          // Цветные обводки для разных сценариев
          displayScenario === 'urgent-debt' && 'border-rose-300 dark:border-rose-700',
          displayScenario === 'waiting-confirmation' && 'border-sky-300 dark:border-sky-700',
          displayScenario === 'success-message' && 'border-emerald-300 dark:border-emerald-700',
          displayScenario === 'responsible-view' && 'border-amber-300 dark:border-amber-700',
          displayScenario === 'overview' && 'border-gray-200 dark:border-gray-700'
        )}
      >
        {/* Header - всегда видимый, кликабельный */}
        <button
          onClick={toggleExpanded}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        >
          <div className="flex items-center gap-2">
            {style.icon}
            <div className="text-left">
              <h3 className="font-semibold text-sm text-foreground">
                {style.title}
              </h3>
              {!isExpanded && (
                <p className="text-xs text-muted-foreground">
                  {getSummary()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {style.badge && (
              <Badge variant={style.badge.variant} className="text-xs">
                {style.badge.text}
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className={cn(ICON_SIZES.sm, "text-muted-foreground")} />
            ) : (
              <ChevronDown className={cn(ICON_SIZES.sm, "text-muted-foreground")} />
            )}
          </div>
        </button>
        
        {/* Content - раскрываемый */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 py-4 border-t border-border/50">
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
                
                {(scenario === 'overview' || scenario === 'hidden') && (
                  <OverviewView
                    debts={otherDebts || []}
                    credits={credits || []}
                    totalDebts={totalDebts || 0}
                    totalCredits={totalCredits || 0}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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
