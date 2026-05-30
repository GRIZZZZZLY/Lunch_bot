import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { CategoryOrder } from '@/services/category-order.service';
import { CategoryOrderCalculator } from './CategoryOrderCalculator';
import { useAuth } from '@/hooks/useAuth';
import { GlassCard } from '@/components/ui/glass-card';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryOrder: CategoryOrder | null;
}

/**
 * Calculator Modal - Opens CategoryOrderCalculator in a centered modal
 * Similar to CreatePollForm modal pattern
 */
export function CalculatorModal({
  isOpen,
  onClose,
  categoryOrder,
}: CalculatorModalProps) {
  const { user } = useAuth();

  if (!categoryOrder) {
    return null;
  }

  const isResponsible = user?.id === categoryOrder.responsibleUserId;
  const canView = isResponsible || !!user?.isAdmin;

  if (!canView) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[55]"
          />

          {/* Center Modal with Glass Effect */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-2xl max-h-[85vh] pointer-events-auto">
              <GlassCard intensity="solid" className="overflow-hidden relative shadow-2xl">
                {/* Close button - absolute positioned */}
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-muted/80 transition-colors"
                  aria-label="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Title */}
                <div className="px-4 pt-4 pb-3 border-b border-border">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Расчёт заказа
                  </p>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {categoryOrder.category}
                  </h2>
                </div>

                {/* Calculator Content - scrollable */}
                <div className="max-h-[calc(85vh-60px)] overflow-y-auto p-4">
                  <CategoryOrderCalculator
                    categoryOrder={categoryOrder}
                    canEdit={isResponsible}
                  />
                </div>
              </GlassCard>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
