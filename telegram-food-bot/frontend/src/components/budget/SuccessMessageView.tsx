import React, { useEffect } from 'react';
import { Transaction } from '../../services/budget.service';
import { Sparkles } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from '../../hooks/useWindowSize';

interface SuccessMessageViewProps {
  debt: Transaction;
}

/**
 * Сценарий 3: Оплата подтверждена - показываем 3 секунды с конфетти
 */
export const SuccessMessageView: React.FC<SuccessMessageViewProps> = ({ debt }) => {
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = React.useState(true);
  
  // CRITICAL: Защита от undefined значений
  if (!debt) {
    console.error('[SuccessMessageView] ❌ debt is undefined!');
    return null;
  }
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 2500);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="relative">
      {/* Конфетти */}
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}
      
      {/* Контент */}
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center size-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4 animate-bounce">
          <Sparkles className="size-10 text-green-600 dark:text-green-400" />
        </div>
        
        <h3 className="text-2xl font-bold mb-2">
          ✨ СПАСИБО! ✨
        </h3>
        
        <p className="text-lg font-semibold text-green-600 dark:text-green-400 mb-1">
          ✅ {debt.toUser.firstName} получил(а) {debt.amount}₽
        </p>
        
        <p className="text-sm text-muted-foreground">
          🍽️ {debt.menuItem?.name || 'Заказ'}
        </p>
        
        <p className="text-xs text-muted-foreground mt-4 opacity-60">
          (Исчезнет через несколько секунд...)
        </p>
      </div>
    </div>
  );
};
