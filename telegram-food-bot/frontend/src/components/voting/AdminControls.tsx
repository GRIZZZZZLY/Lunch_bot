import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  StopCircle, 
  Clock,
  Crown,
  Settings
} from 'lucide-react';
import { PollWithDetails } from '../../services/polls.service';
import { cn } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface AdminControlsProps {
  poll: PollWithDetails;
  onComplete: (mode: 'single' | 'multi') => void;
  onExtend: (minutes: number) => void;
}

/**
 * AdminControls - Компактная панель управления голосованием для админов
 * 
 * Быстрые действия:
 * - Завершить голосование (Multi-Winner по умолчанию)
 * - ⚙️ Выбрать режим завершения (опционально)
 * - Продлить время на +15 мин
 */
export const AdminControls: React.FC<AdminControlsProps> = ({
  poll,
  onComplete,
  onExtend,
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'single' | 'multi'>('multi');

  // Быстрое завершение (multi по умолчанию)
  const handleQuickComplete = async () => {
    if (!confirm('Завершить голосование с распределением по группам?')) return;
    
    setLoading('complete');
    try {
      await onComplete('multi');
    } finally {
      setLoading(null);
    }
  };

  // Завершение с выбранным режимом
  const handleCompleteWithMode = async () => {
    setShowModeSelector(false);
    
    setLoading('complete');
    try {
      await onComplete(selectedMode);
    } finally {
      setLoading(null);
    }
  };

  const handleSettingsClick = () => {
    setShowModeSelector(!showModeSelector);
  };

  const handleExtend = async () => {
    setLoading('extend');
    try {
      await onExtend(15); // +15 минут
    } finally {
      setLoading(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2 flex-wrap">
        {/* Компактная иконка админа */}
        <Crown className={`${ICON_SIZES.sm} text-gold-500`} />
        
        {/* Hint: Multi-Winner по умолчанию */}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          🍽 Распределение
        </span>
        
        {/* Завершить (Multi-Winner по умолчанию) */}
        <button
          onClick={handleQuickComplete}
          disabled={loading !== null}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
            "bg-gradient-to-r from-coral-500 to-coral-600",
            "hover:from-coral-600 hover:to-coral-700",
            "text-white text-sm font-medium",
            "transition-all hover:shadow-md",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <StopCircle size={14} />
          Завершить
        </button>

        {/* Кнопка настроек (выбор режима) */}
        <button
          onClick={handleSettingsClick}
          disabled={loading !== null}
          className={cn(
            "inline-flex items-center justify-center p-1.5 rounded-lg",
            "bg-gray-200 dark:bg-gray-700",
            "hover:bg-gray-300 dark:hover:bg-gray-600",
            "transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title="Выбрать режим завершения"
        >
          <Settings size={14} />
        </button>

        {/* Продлить на +15 мин */}
        <button
          onClick={handleExtend}
          disabled={loading !== null}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
            "bg-gradient-to-r from-mint-500 to-mint-600",
            "hover:from-mint-600 hover:to-mint-700",
            "text-white text-sm font-medium",
            "transition-all hover:shadow-md",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Clock size={14} />
          +15 мин
        </button>

        {/* Loading indicator */}
        {loading && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
            ...
          </span>
        )}
      </div>

      {/* Mode Selector Modal */}
      <AnimatePresence>
        {showModeSelector && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-glass rounded-lg border border-white/10 p-4 overflow-hidden"
          >
            <h4 className="text-sm font-semibold mb-3">Выберите режим завершения:</h4>
            
            <div className="space-y-2">
              {/* Multi-Winner Option */}
              <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-white/5">
                <input
                  type="radio"
                  name="completion-mode"
                  value="multi"
                  checked={selectedMode === 'multi'}
                  onChange={(e) => setSelectedMode(e.target.value as 'multi')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="font-medium text-sm">🍽 Распределение по группам</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Показать кто какое блюдо заказывает (рекомендуется)
                  </p>
                </div>
              </label>

              {/* Single-Winner Option */}
              <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-white/5">
                <input
                  type="radio"
                  name="completion-mode"
                  value="single"
                  checked={selectedMode === 'single'}
                  onChange={(e) => setSelectedMode(e.target.value as 'single')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="font-medium text-sm">🏆 Один победитель</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Классический режим с выбором победителя
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCompleteWithMode}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-coral-500 to-coral-600 text-white rounded-lg font-medium hover:shadow-md transition-all"
              >
                Завершить
              </button>
              <button
                onClick={() => setShowModeSelector(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              >
                Отмена
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
