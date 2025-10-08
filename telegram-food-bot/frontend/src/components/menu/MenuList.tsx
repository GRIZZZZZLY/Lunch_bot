import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MenuItem } from '../../services/menu.service';
import { MenuItemCard } from './MenuItemCard';
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
  selectedCategory?: string | null;
}

/**
 * Компонент списка блюд
 */
export const MenuList: React.FC<MenuListProps> = ({
  items,
  loading = false,
  error = null,
  onEdit,
  onDelete,
  onToggleStatus,
  onAdd,
  showActions = false,
  selectedCategory = null,
}) => {
  const { hapticFeedback } = useTelegram();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Фильтруем элементы по категории
  const filteredItems = selectedCategory 
    ? items.filter(item => item.category === selectedCategory)
    : items;

  // Группируем по категориям для отображения
  const itemsByCategory = filteredItems.reduce((groups, item) => {
    const category = item.category || 'Без категории';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {} as { [key: string]: MenuItem[] });

  const categories = Object.keys(itemsByCategory).sort();

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

  const formatPrice = (price?: number) => {
    if (!price) return '';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
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

  if (filteredItems.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">🍽️</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {selectedCategory ? `Нет блюд в категории "${selectedCategory}"` : 'Меню пустое'}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {selectedCategory ? 'Попробуйте выбрать другую категорию' : 'Добавьте первое блюдо в меню'}
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
    <div className="space-y-8 overflow-hidden">
      {categories.map((categoryName, categoryIndex) => (
        <motion.div
          key={categoryName}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: categoryIndex * 0.1, duration: 0.4 }}
          className="space-y-4 overflow-hidden"
        >
          {/* Category Header */}
          {categories.length > 1 && (
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>{categoryName}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {itemsByCategory[categoryName].length} блюд
                </span>
              </h3>
            </div>
          )}
          
          {/* Grid Layout - адаптивный */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {itemsByCategory[categoryName].map((item, itemIndex) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  delay: (categoryIndex * 0.1) + (itemIndex * 0.05), 
                  duration: 0.3,
                  type: 'spring',
                  stiffness: 300,
                  damping: 25
                }}
              >
                <MenuItemCard
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
        </motion.div>
      ))}
    </div>
  );
};
