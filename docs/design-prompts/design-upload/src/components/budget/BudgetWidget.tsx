import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBudgetWidget } from '../../hooks/useBudgetWidget';
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
import { GlassCard } from '../ui/glass-card';

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
    icon: <Crown className={`${ICON_SIZES.md} text-primary`} />,
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
        <div className="rounded-2xl border border-coral-500/20 bg-card/96 p-4 shadow-sm">
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
    totalDebts,
    totalCredits,
    isLoading,
  } = useBudgetWidget();

  const queryClient = useQueryClient();
  const haptic = useHaptic();
  
  // Определение темы через CSS класс
  const [isDark, setIsDark] = React.useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  React.useEffect(() => {
    const updateTheme = () => {
      const newIsDark = document.documentElement.classList.contains('dark');
      setIsDark(newIsDark);
    };

    updateTheme();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Hover state для анимации границы
  const [isHovered, setIsHovered] = useState(false);
  
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

  // Динамический badge с цветами по типу (долги/кредиты)
  const getDynamicBadge = () => {
    // Приоритет: показываем badge для долгов если есть
    if (totalDebts > 0) {
      return { text: `${totalDebts}₽`, variant: 'danger' as const };
    }
    // Если долгов нет, но есть кредиты
    if (totalCredits > 0) {
      return { text: `+${totalCredits}₽`, variant: 'success' as const };
    }
    // Если всё оплачено
    if (displayScenario === 'success-message') {
      return { text: 'Оплачено', variant: 'success' as const };
    }
    // Дефолтный badge из scenarioStyles
    return style.badge;
  };

  const dynamicBadge = getDynamicBadge();
  const isOverview = displayScenario === 'overview';

  const getSummaryChipText = () => {
    if (totalDebts > 0) {
      return `${totalDebts}₽ к оплате`;
    }

    if (totalCredits > 0) {
      return `+${totalCredits}₽ ожидается`;
    }

    return 'Без долгов';
  };

  const getIconShellClassName = () => {
    if (isOverview) {
      return isDark
        ? 'bg-peach-500/12 text-peach-300 ring-1 ring-peach-400/14'
        : 'bg-peach-500/12 text-primary ring-1 ring-peach-500/12';
    }

    if (displayScenario === 'urgent-debt') {
      return 'bg-rose-500/12 text-rose-600 dark:text-rose-300 ring-1 ring-rose-500/14';
    }

    if (displayScenario === 'waiting-confirmation') {
      return 'bg-lavender-500/12 text-lavender-600 dark:text-lavender-300 ring-1 ring-lavender-500/14';
    }

    if (displayScenario === 'success-message') {
      return 'bg-mint-500/12 text-mint-700 dark:text-mint-300 ring-1 ring-mint-500/14';
    }

    return 'bg-primary/12 text-primary ring-1 ring-primary/12';
  };

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
  
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/96 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full bg-primary/15 animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <GlassCard
        intensity={displayScenario === 'overview' && !isDark ? 'solid' : 'high'}
        style={{
          borderLeftWidth: isHovered ? '8px' : '6px',
          transition: 'border-left-width 0.2s ease'
        }}
        data-testid='budget-widget-card'
        className={cn(
          'relative overflow-hidden rounded-[28px] transition-all duration-200',
          "border-t border-r border-b border-border",
          displayScenario === 'overview' && !isDark && 'border-peach-500/32 bg-[linear-gradient(135deg,rgba(255,252,246,0.99),rgba(247,238,226,1))] shadow-[0_18px_34px_rgba(189,121,55,0.14)]',
          // Левая граница - цветная для важных сценариев, адаптивная для обычного
          "border-l-4",
          displayScenario === 'urgent-debt' && 'border-l-rose-500',
          displayScenario === 'waiting-confirmation' && 'border-l-lavender-500',
          displayScenario === 'success-message' && 'border-l-mint-500',
          displayScenario === 'responsible-view' && 'border-l-primary',
           displayScenario === 'overview' && (isDark ? 'border-l-lavender-500 shadow-[0_12px_26px_rgba(139,92,246,0.16)]' : 'border-l-peach-500')
        )}
      >
        {/* Animated gradient overlay */}
        <div className={cn(
          "absolute inset-0 pointer-events-none",
          "bg-gradient-to-br",
          displayScenario === 'urgent-debt' && "from-rose-500/10 to-red-500/10",
          displayScenario === 'waiting-confirmation' && "from-lavender-500/10 to-primary/6",
          displayScenario === 'success-message' && "from-mint-500/10 to-primary/6",
          displayScenario === 'responsible-view' && "from-primary/14 to-coral-500/8",
          displayScenario === 'overview' && (isDark 
            ? "from-lavender-500/12 to-primary/6" 
            : "from-peach-500/16 to-coral-500/10")
        )} />

        {/* Content with z-index */}
        <div className="relative z-10">
        {/* Header - компактный горизонтальный layout */}
        <button
          onClick={toggleExpanded}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3.5",
            "transition-all duration-200 group",
            // Адаптивный hover для обычного состояния
            displayScenario === 'overview' && (
              isDark
                ? "hover:bg-lavender-500/5"
                : "hover:bg-peach-500/5"
            ),
            // Цветной hover для важных сценариев
            displayScenario === 'urgent-debt' && "hover:bg-rose-500/5",
            displayScenario === 'waiting-confirmation' && "hover:bg-lavender-500/5",
            displayScenario === 'success-message' && "hover:bg-mint-500/5",
            displayScenario === 'responsible-view' && "hover:bg-primary/6"
          )}
        >
          {/* Левая часть - компактный горизонтальный layout */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              data-testid='budget-widget-icon-shell'
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-2xl',
                getIconShellClassName()
              )}
            >
              {style.icon}
            </div>
            <div className={cn('flex-1 min-w-0', isOverview ? 'text-left' : 'flex items-center gap-2')}>
              <span className={cn(
                'font-semibold whitespace-nowrap tracking-tight text-foreground',
                isOverview ? 'block text-base' : 'text-sm'
              )}>
                {style.title}
                {!isOverview && ':'}
              </span>
              {!isExpanded && (
                <span className={cn(
                  'text-foreground/82 dark:text-muted-foreground truncate',
                  isOverview ? 'mt-0.5 block text-sm' : 'text-xs'
                )}>
                  {getSummary()}
                </span>
              )}
            </div>
          </div>
          
          {/* Правая часть - badge + chevron */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isOverview && !isExpanded && (
              <div
                data-testid='budget-widget-summary-chip'
                className='hidden rounded-full border border-peach-500/24 bg-white/75 px-3 py-1 text-xs font-medium text-foreground/78 shadow-sm sm:block dark:border-peach-500/18 dark:bg-white/5 dark:text-foreground/76'
              >
                {getSummaryChipText()}
              </div>
            )}
            {dynamicBadge && (
              <Badge variant={dynamicBadge.variant} className="text-xs px-2.5 py-1 rounded-full shadow-md font-semibold border-mint-500/25 bg-mint-500/14 text-mint-800 dark:text-mint-300">
                {dynamicBadge.text}
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
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </GlassCard>
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
