import { useState } from 'react';
import { motion } from 'framer-motion';
import { MenuItem } from '../../services/menu.service';
import { MenuRow } from './MenuRow';
import { Button } from '../common/Button';
import { Skeleton } from '../common/LoadingSpinner';
import { useTelegram } from '../../hooks/useTelegram';

export interface MenuListProps {
  items: MenuItem[];
  loading?: boolean;
  error?: string | null;
  onEdit?: (item: MenuItem) => void;
  onDelete?: (id: number) => void;
  onToggleStatus?: (id: number) => void;
  onAdd?: () => void;
  showActions?: boolean;
}

/**
 * Компонент списка блюд
 */
export const MenuList = ({
  items,
  loading = false,
  error = null,
  onEdit,
  onDelete,
  onToggleStatus,
  onAdd,
  showActions = false,
}: MenuListProps) => {
  const { hapticFeedback } = useTelegram();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = (id: number) => {
    if (!onDelete) return;
    
    setDeletingId(id);
    onDelete(id);
    // Сбрасываем состояние загрузки через некоторое время
    setTimeout(() => setDeletingId(null), 2000);
  };

  const handleToggleStatus = (item: MenuItem) => {
    if (!onToggleStatus) return;
    
    hapticFeedback.impactOccurred('light');
    onToggleStatus(item.id);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton count={5} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">😔</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Ошибка загрузки
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">🍽️</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Меню пустое
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Добавь первое блюдо в меню
        </p>
        {showActions && onAdd && (
          <Button onClick={onAdd}>
            Добавить блюдо
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item, itemIndex) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: Math.min(itemIndex * 0.03, 0.3),
            duration: 0.24,
            ease: 'easeOut',
          }}
        >
          <MenuRow
            item={item}
            onEdit={onEdit}
            onDelete={onDelete ? () => handleDelete(item.id) : undefined}
            onToggle={onToggleStatus ? () => handleToggleStatus(item) : undefined}
            showActions={showActions}
            loading={deletingId === item.id}
          />
        </motion.div>
      ))}
    </div>
  );
};
