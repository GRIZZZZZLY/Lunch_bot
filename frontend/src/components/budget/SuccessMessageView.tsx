import { useEffect, useState, lazy, Suspense } from 'react';
import { Transaction } from '../../services/budget.service';
import { Sparkles } from 'lucide-react';
import { m } from 'framer-motion';
import { useWindowSize } from '@/hooks/useWindowSize';

// Lazy load react-confetti
const Confetti = lazy(() => import('react-confetti'));

interface SuccessMessageViewProps {
  debt: Transaction;
}

/**
 * Сценарий 3: Оплата подтверждена - показываем 3 секунды с конфетти
 */
export const SuccessMessageView = ({ debt }: SuccessMessageViewProps) => {
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 2500);
    
    return () => clearTimeout(timer);
  }, []);

  if (!debt) {
    console.error('[SuccessMessageView] ❌ debt is undefined!');
    return null;
  }

  const userName = [debt.toUser?.firstName, debt.toUser?.lastName]
    .filter(Boolean)
    .join(' ');
  
  return (
    <div className="relative">
      {/* Конфетти */}
      {showConfetti && (
        <Suspense fallback={null}>
          <Confetti
            width={width}
            height={height}
            recycle={false}
            numberOfPieces={200}
            gravity={0.3}
          />
        </Suspense>
      )}
      
      {/* Контент */}
      <div className="text-center py-6">
        <m.div
          initial={{ opacity: 0, scale: 0.95, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mb-4 inline-flex size-20 items-center justify-center rounded-full bg-mint-100 dark:bg-mint-900/30"
        >
          <Sparkles className="size-10 text-mint-600 dark:text-mint-400" />
        </m.div>
        
        <h3 className="text-2xl font-bold mb-2">
          СПАСИБО!
        </h3>
        
        <p className="text-lg font-semibold text-mint-500 dark:text-mint-300 mb-1">
          {userName || 'Ответственный'} получил(а) {debt.amount ?? 0}₽
        </p>
        
        <p className="text-sm text-muted-foreground">
          {debt.menuItem?.name || 'Заказ'}
        </p>
        
        <p className="text-xs text-muted-foreground mt-4 opacity-60">
          (Исчезнет через несколько секунд...)
        </p>
      </div>
    </div>
  );
};
