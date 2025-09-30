import React, { useState } from 'react';
import { MenuItem } from '../../services/menu.service';
import { Button } from '../common/Button';
import { Skeleton } from '../common/LoadingSpinner';
import { SwipeableCard, SwipeAction } from '../common/SwipeableCard';
import { ImageCarousel } from '../common/ImageCarousel';
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
  const { hapticFeedback, showConfirm } = useTelegram();
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

  const handleDelete = (item: MenuItem) => {
    if (!onDelete) return;

    hapticFeedback.impactOccurred('medium');
    
    showConfirm(
      `Удалить блюдо "${item.name}"?`,
      (confirmed) => {
        if (confirmed) {
          setDeletingId(item.id);
          onDelete(item.id);
          // Сбрасываем состояние загрузки через некоторое время
          setTimeout(() => setDeletingId(null), 2000);
        }
      }
    );
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
    <div className="space-y-6">
      {showActions && onAdd && (
        <div className="flex justify-end mb-4">
          <Button onClick={onAdd}>
            + Добавить блюдо
          </Button>
        </div>
      )}

      {categories.map(categoryName => (
        <div key={categoryName} className="space-y-3">
          {categories.length > 1 && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              {categoryName} ({itemsByCategory[categoryName].length})
            </h3>
          )}
          
          {itemsByCategory[categoryName].map(item => (
            <MenuItemCard
              key={item.id}
              item={item}
              onEdit={onEdit}
              onDelete={() => handleDelete(item)}
              onToggleStatus={() => handleToggleStatus(item)}
              showActions={showActions}
              isDeleting={deletingId === item.id}
              formatPrice={formatPrice}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Карточка отдельного блюда
 */
const MenuItemCard: React.FC<{
  item: MenuItem;
  onEdit?: (item: MenuItem) => void;
  onDelete?: () => void;
  onToggleStatus?: () => void;
  showActions: boolean;
  isDeleting: boolean;
  formatPrice: (price?: number) => string;
}> = ({
  item,
  onEdit,
  onDelete,
  onToggleStatus,
  showActions,
  isDeleting,
  formatPrice,
}) => {
  // Определяем действия для жестов
  const leftActions: SwipeAction[] = onEdit ? [
    {
      id: 'edit',
      label: 'Изменить',
      icon: '✏️',
      color: '#ffffff',
      bgColor: '#3B82F6',
      action: () => onEdit(item),
    }
  ] : [];

  const rightActions: SwipeAction[] = [];
  
  if (onToggleStatus) {
    rightActions.push({
      id: 'toggle',
      label: item.isActive ? 'Скрыть' : 'Показать',
      icon: item.isActive ? '⏸️' : '▶️',
      color: '#ffffff',
      bgColor: item.isActive ? '#F59E0B' : '#10B981',
      action: () => onToggleStatus(),
    });
  }

  if (onDelete) {
    rightActions.push({
      id: 'delete',
      label: 'Удалить',
      icon: '🗑️',
      color: '#ffffff',
      bgColor: '#EF4444',
      action: () => onDelete(),
    });
  }

  const cardContent = (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${
      !item.isActive ? 'opacity-60' : ''
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-semibold text-gray-900 dark:text-white truncate">
              {item.name}
            </h4>
            {!item.isActive && (
              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                Неактивно
              </span>
            )}
          </div>
          
          {item.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
              {item.description}
            </p>
          )}
          
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-500">
            <div className="flex items-center space-x-4">
              {item.price && (
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatPrice(item.price)}
                </span>
              )}
              {item.category && (
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-1 rounded text-xs">
                  {item.category}
                </span>
              )}
            </div>
            <span className="text-xs">
              {new Date(item.createdAt).toLocaleDateString('ru-RU')}
            </span>
          </div>
        </div>

        {/* Изображения или карусель */}
        {(item.images?.length || item.imageUrl) && (
          <div className="ml-4 flex-shrink-0">
            {item.images && item.images.length > 1 ? (
              <ImageCarousel
                images={item.images}
                alt={item.name}
                className="w-20 h-20"
                showDots={true}
                showArrows={false}
                autoPlay={false}
              />
            ) : (
              <img
                src={item.images?.[0] || item.imageUrl}
                alt={item.name}
                className="w-20 h-20 object-cover rounded-lg hover:scale-110 transition-transform duration-200"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
        )}
      </div>

      {showActions && (
        <div className="flex items-center justify-end space-x-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          {onToggleStatus && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleStatus}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {item.isActive ? '⏸️' : '▶️'}
              {item.isActive ? 'Деактивировать' : 'Активировать'}
            </Button>
          )}
          
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(item)}
              className="text-gray-600 hover:text-gray-700 dark:text-gray-400"
            >
              ✏️ Редактировать
            </Button>
          )}
          
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              loading={isDeleting}
              className="text-red-600 hover:text-red-700 dark:text-red-400"
            >
              🗑️ Удалить
            </Button>
          )}
        </div>
      )}
    </div>
  );

  // Возвращаем SwipeableCard только если есть действия и включены showActions
  if (showActions && (leftActions.length > 0 || rightActions.length > 0)) {
    return (
      <SwipeableCard
        leftActions={leftActions}
        rightActions={rightActions}
        className="animate-fade-in-up"
        swipeThreshold={60}
      >
        {cardContent}
      </SwipeableCard>
    );
  }

  // Иначе возвращаем обычную карточку
  return cardContent;
};
