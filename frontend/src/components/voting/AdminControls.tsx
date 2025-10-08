import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  StopCircle, 
  Clock, 
  Plus, 
  RefreshCw,
  Settings,
  Send,
  Crown
} from 'lucide-react';
import { PollWithDetails } from '../../services/polls.service';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '../ui/glass-card';
import { cn } from '../../lib/utils';

interface AdminControlsProps {
  poll: PollWithDetails;
  onComplete: () => void;
  onExtend: (minutes: number) => void;
  onAddItem?: () => void;
  onRestart?: () => void;
  onNotifyUsers?: () => void;
}

/**
 * AdminControls - Панель управления голосованием для админов
 * 
 * Быстрые действия:
 * - Завершить голосование досрочно
 * - Продлить время на +15 мин
 * - Добавить блюдо в процессе (опционально)
 * - Перезапустить голосование (опционально)
 * - Уведомить непроголосовавших (опционально)
 */
export const AdminControls: React.FC<AdminControlsProps> = ({
  poll,
  onComplete,
  onExtend,
  onAddItem,
  onRestart,
  onNotifyUsers,
}) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleComplete = async () => {
    if (!confirm('Завершить голосование досрочно?')) return;
    
    setLoading('complete');
    try {
      await onComplete();
    } finally {
      setLoading(null);
    }
  };

  const handleExtend = async () => {
    setLoading('extend');
    try {
      await onExtend(15); // +15 минут
    } finally {
      setLoading(null);
    }
  };

  const handleAddItem = async () => {
    if (!onAddItem) return;
    setLoading('addItem');
    try {
      await onAddItem();
    } finally {
      setLoading(null);
    }
  };

  const handleRestart = async () => {
    if (!onRestart) return;
    if (!confirm('Перезапустить голосование? Все текущие голоса будут сброшены.')) return;
    
    setLoading('restart');
    try {
      await onRestart();
    } finally {
      setLoading(null);
    }
  };

  const handleNotify = async () => {
    if (!onNotifyUsers) return;
    setLoading('notify');
    try {
      await onNotifyUsers();
    } finally {
      setLoading(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Admin Badge */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-lavender-500/10 to-gold-400/10 border border-lavender-300 dark:border-lavender-700">
        <Crown className="text-gold-500" size={20} />
        <span className="text-sm font-semibold text-lavender-700 dark:text-lavender-300">
          Режим администратора
        </span>
      </div>

      {/* Quick Actions */}
      <GlassCard className="border-2 border-lavender-200 dark:border-lavender-800">
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <Settings className="text-lavender-500" size={20} />
            Управление голосованием
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="grid grid-cols-2 gap-3">
            {/* Завершить досрочно */}
            <button
              onClick={handleComplete}
              disabled={loading !== null}
              className={cn(
                "p-4 rounded-xl border-2 transition-all",
                "bg-gradient-to-br from-coral-50 to-coral-100 dark:from-coral-900/10 dark:to-coral-800/10",
                "border-coral-300 dark:border-coral-700",
                "hover:shadow-lg hover:scale-105",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <StopCircle className="text-coral-500 mb-2" size={24} />
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Завершить
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Досрочно
              </div>
            </button>

            {/* Продлить на +15 мин */}
            <button
              onClick={handleExtend}
              disabled={loading !== null}
              className={cn(
                "p-4 rounded-xl border-2 transition-all",
                "bg-gradient-to-br from-mint-50 to-mint-100 dark:from-mint-900/10 dark:to-mint-800/10",
                "border-mint-300 dark:border-mint-700",
                "hover:shadow-lg hover:scale-105",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <Clock className="text-mint-500 mb-2" size={24} />
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                +15 минут
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Продлить
              </div>
            </button>

            {/* Добавить блюдо (если функция передана) */}
            {onAddItem && (
              <button
                onClick={handleAddItem}
                disabled={loading !== null}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all",
                  "bg-gradient-to-br from-peach-50 to-peach-100 dark:from-peach-900/10 dark:to-peach-800/10",
                  "border-peach-300 dark:border-peach-700",
                  "hover:shadow-lg hover:scale-105",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <Plus className="text-peach-500 mb-2" size={24} />
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Добавить
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Блюдо
                </div>
              </button>
            )}

            {/* Перезапустить (если функция передана) */}
            {onRestart && (
              <button
                onClick={handleRestart}
                disabled={loading !== null}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all",
                  "bg-gradient-to-br from-lavender-50 to-lavender-100 dark:from-lavender-900/10 dark:to-lavender-800/10",
                  "border-lavender-300 dark:border-lavender-700",
                  "hover:shadow-lg hover:scale-105",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <RefreshCw className="text-lavender-500 mb-2" size={24} />
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Перезапуск
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Сброс
                </div>
              </button>
            )}
          </div>

          {/* Уведомить пользователей */}
          {onNotifyUsers && (
            <button
              onClick={handleNotify}
              disabled={loading !== null}
              className={cn(
                "w-full mt-3 py-3 px-4 rounded-xl",
                "bg-gradient-to-r from-lavender-500 to-lavender-600",
                "hover:from-lavender-600 hover:to-lavender-700",
                "text-white font-medium text-sm",
                "flex items-center justify-center gap-2",
                "transition-all hover:shadow-lg",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <Send size={16} />
              Напомнить непроголосовавшим
            </button>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="mt-3 text-center text-sm text-gray-600 dark:text-gray-400">
              Обработка...
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Info hint */}
      <div className="px-4 py-2 rounded-lg bg-gold-50 dark:bg-gold-900/10 border border-gold-200 dark:border-gold-800">
        <p className="text-xs text-gold-700 dark:text-gold-400">
          💡 Эти действия доступны только администраторам
        </p>
      </div>
    </motion.div>
  );
};
