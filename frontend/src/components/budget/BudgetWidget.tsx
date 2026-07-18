import React, { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { useBudgetWidget } from '../../hooks/useBudgetWidget';
import { Badge } from '../ui/badge';
import { UrgentDebtView } from './UrgentDebtView';
import { WaitingConfirmationView } from './WaitingConfirmationView';
import { SuccessMessageView } from './SuccessMessageView';
import { ResponsibleView } from './ResponsibleView';
import { OverviewView } from './OverviewView';
import { Wallet, AlertCircle, CheckCircle2, Crown, ChevronRight, X } from 'lucide-react';
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
    title: 'Твой долг',
    eyebrow: 'Требует оплаты',
    badge: { text: 'Новое', variant: 'destructive' as const },
  },
  'waiting-confirmation': {
    icon: <CheckCircle2 className={ICON_SIZES.md} />,
    title: 'Ожидание подтверждения',
    eyebrow: 'Платёж отмечен',
    badge: null,
  },
  'success-message': {
    icon: <CheckCircle2 className={`${ICON_SIZES.md} text-pastel-sage-500`} />,
    title: 'Оплата подтверждена',
    eyebrow: 'Готово',
    badge: null,
  },
  'overview': {
    icon: <Wallet className={ICON_SIZES.md} />,
    title: 'Финансы',
    eyebrow: 'Сводка',
    badge: null,
  },
  'responsible-view': {
    icon: <Crown className={`${ICON_SIZES.md} text-primary`} />,
    title: 'Ты ответственный',
    eyebrow: 'Расчёт по заказу',
    badge: { text: 'Активно', variant: 'default' as const },
  },
  'hidden': {
    icon: null,
    title: '',
    eyebrow: '',
    badge: null,
  },
};

type BudgetScenario = keyof typeof scenarioStyles;

interface BudgetDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: BudgetScenario;
  isDark: boolean;
  style: (typeof scenarioStyles)[BudgetScenario];
  iconShellClassName: string;
  children: React.ReactNode;
}

const BudgetDetailsModal = ({
  isOpen,
  onClose,
  scenario,
  isDark,
  style,
  iconShellClassName,
  children,
}: BudgetDetailsModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[55]"
        />
        <m.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
        >
          <div className="w-full sm:max-w-md max-h-[92dvh] pointer-events-auto">
            <div className="relative overflow-hidden rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl flex flex-col max-h-[92dvh]">
              <div className={cn(
                'absolute inset-0 pointer-events-none bg-gradient-to-br',
                scenario === 'urgent-debt' && 'from-rose-500/10 to-transparent',
                scenario === 'responsible-view' && (isDark ? 'from-lavender-500/12 to-transparent' : 'from-peach-500/14 to-transparent'),
                scenario === 'success-message' && 'from-mint-500/10 to-transparent',
                scenario === 'waiting-confirmation' && 'from-lavender-500/10 to-transparent',
                scenario === 'overview' && (isDark ? 'from-lavender-500/10 to-transparent' : 'from-peach-500/12 to-transparent'),
              )} />
              <div className="relative z-10 flex items-center gap-3 px-5 py-4 border-b border-border/60">
                <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', iconShellClassName)}>
                  {style.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{style.eyebrow}</p>
                  <h2 className="text-lg font-bold tracking-tight text-foreground truncate">{style.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl bg-muted/60 hover:bg-muted transition-colors text-muted-foreground"
                  aria-label="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative z-10 px-5 py-5 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
                {children}
              </div>
            </div>
          </div>
        </m.div>
      </>
    )}
  </AnimatePresence>
);

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
      console.warn('[BudgetWidget] ⚠️ Widget fallback due to error');
      return (
        <div className="rounded-2xl border border-coral-500/20 bg-card/96 p-4 shadow-sm">
          <div className="text-sm font-semibold text-foreground">Финансы</div>
          <div className="text-xs text-muted-foreground mt-1">
            Не удалось загрузить детали. Обнови страницу.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Адаптивный виджет бюджет-трекера.
 * На главной — компактный триггер. По тапу открывается модалка с деталями сценария.
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

  // Модалка с деталями
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Auto-hide для success-message через 3 секунды
  useEffect(() => {
    if (scenario === 'success-message') {
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['budget'] });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [scenario, queryClient]);

  const openModal = () => {
    haptic.light();
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  // Определяем отображаемый стиль
  const displayScenario = scenario === 'hidden' ? 'overview' : scenario;
  const style = scenarioStyles[displayScenario];

  // Динамический badge с цветами по типу (долги/кредиты)
  const getDynamicBadge = () => {
    if (totalDebts > 0) {
      return { text: `${totalDebts}₽`, variant: 'danger' as const };
    }
    if (totalCredits > 0) {
      return { text: `+${totalCredits}₽`, variant: 'success' as const };
    }
    if (displayScenario === 'success-message') {
      return { text: 'Оплачено', variant: 'success' as const };
    }
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

  // Краткая сводка для триггера
  const getSummary = () => {
    if (totalDebts > 0 && totalCredits > 0) {
      return `Долг: ${totalDebts}₽ · Тебе должны: ${totalCredits}₽`;
    }
    if (totalDebts > 0) {
      return `Твой долг: ${totalDebts}₽`;
    }
    if (totalCredits > 0) {
      return `Тебе должны: ${totalCredits}₽`;
    }
    return 'Нет активных долгов';
  };

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

  // Рендер контента сценария (используется внутри модалки)
  const renderScenarioContent = () => {
    if (scenario === 'urgent-debt' && currentDebt) {
      return (
        <UrgentDebtView
          debt={currentDebt}
          otherDebts={otherDebts || []}
          credits={credits || []}
        />
      );
    }
    if (scenario === 'waiting-confirmation' && currentDebt) {
      return (
        <WaitingConfirmationView
          debt={currentDebt}
          otherDebts={otherDebts || []}
          credits={credits || []}
        />
      );
    }
    if (scenario === 'success-message' && currentDebt) {
      return <SuccessMessageView debt={currentDebt} />;
    }
    if (scenario === 'responsible-view' && credits && credits.length > 0) {
      return <ResponsibleView credits={credits} otherDebts={otherDebts || []} />;
    }
    return <OverviewView debts={otherDebts || []} credits={credits || []} />;
  };

  return (
    <>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <GlassCard
          intensity={displayScenario === 'overview' && !isDark ? 'solid' : 'high'}
          data-testid='budget-widget-card'
          className={cn(
            'relative overflow-hidden rounded-[28px] transition-all duration-200',
            'border border-border',
            displayScenario === 'overview' && !isDark && 'border-peach-500/32 bg-[linear-gradient(135deg,rgba(255,252,246,0.99),rgba(247,238,226,1))] shadow-[0_18px_34px_rgba(189,121,55,0.14)]',
            displayScenario === 'urgent-debt' && 'border-rose-500/28 shadow-[0_8px_20px_rgba(244,63,94,0.10)]',
            displayScenario === 'waiting-confirmation' && 'border-lavender-500/28 shadow-[0_8px_20px_rgba(139,92,246,0.10)]',
            displayScenario === 'success-message' && 'border-mint-500/28 shadow-[0_8px_20px_rgba(52,211,153,0.10)]',
            displayScenario === 'responsible-view' && 'border-primary/28 shadow-[0_8px_20px_rgba(216,106,44,0.10)]',
            displayScenario === 'overview' && isDark && 'border-lavender-500/20 shadow-[0_12px_26px_rgba(139,92,246,0.10)]',
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

          {/* Триггер: вся карточка тапается и открывает модалку */}
          <button type="button"
            onClick={openModal}
            className={cn(
              "relative z-10 w-full flex items-center justify-between px-4 py-3.5",
              "transition-all duration-200 group",
              displayScenario === 'overview' && (
                isDark ? "hover:bg-lavender-500/5" : "hover:bg-peach-500/5"
              ),
              displayScenario === 'urgent-debt' && "hover:bg-rose-500/5",
              displayScenario === 'waiting-confirmation' && "hover:bg-lavender-500/5",
              displayScenario === 'success-message' && "hover:bg-mint-500/5",
              displayScenario === 'responsible-view' && "hover:bg-primary/6"
            )}
          >
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
              <div className="flex-1 min-w-0 text-left">
                <span className={cn(
                  'block font-semibold whitespace-nowrap tracking-tight text-foreground',
                  isOverview ? 'text-base' : 'text-sm'
                )}>
                  {style.title}
                </span>
                <span className={cn(
                  'block truncate text-foreground/82 dark:text-muted-foreground tabular-nums',
                  isOverview ? 'mt-0.5 text-sm' : 'text-xs'
                )}>
                  {getSummary()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isOverview && (
                <div
                  data-testid='budget-widget-summary-chip'
                  className='hidden rounded-full border border-peach-500/24 bg-white/75 px-3 py-1 text-xs font-medium text-foreground/78 shadow-sm sm:block dark:border-peach-500/18 dark:bg-white/5 dark:text-foreground/76 tabular-nums'
                >
                  {getSummaryChipText()}
                </div>
              )}
              {dynamicBadge && (
                <Badge variant={dynamicBadge.variant} className="text-xs px-2.5 py-1 rounded-full shadow-md font-semibold border-mint-500/25 bg-mint-500/14 text-mint-800 dark:text-mint-300 tabular-nums">
                  {dynamicBadge.text}
                </Badge>
              )}
              <ChevronRight className={cn(ICON_SIZES.sm, "text-muted-foreground transition-transform group-hover:translate-x-0.5")} />
            </div>
          </button>
        </GlassCard>
      </m.div>

      <BudgetDetailsModal
        isOpen={isModalOpen}
        onClose={closeModal}
        scenario={displayScenario}
        isDark={isDark}
        style={style}
        iconShellClassName={getIconShellClassName()}
      >
        {renderScenarioContent()}
      </BudgetDetailsModal>
    </>
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
