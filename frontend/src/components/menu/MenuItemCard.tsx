import { useState } from 'react';
import { MenuItem } from '../../services/menu.service';
import { useTelegram } from '@/hooks/useTelegram';

interface MenuItemCardProps {
  item: MenuItem;
  onEdit?: (item: MenuItem) => void;
  onDelete?: (id: number) => void;
  onToggle?: (id: number) => void;
  showActions?: boolean;
  loading?: boolean;
}

export function MenuItemCard({
  item,
  onEdit,
  onDelete,
  onToggle,
  showActions = true,
  loading = false
}: MenuItemCardProps) {
  const { hapticFeedback, showConfirm } = useTelegram();
  const [isToggling, setIsToggling] = useState(false);

  const handleEdit = () => {
    hapticFeedback?.selectionChanged();
    onEdit?.(item);
  };

  const handleDelete = () => {
    hapticFeedback?.impactOccurred('medium');
    
    showConfirm?.(
      `Удалить блюдо "${item.name}"?`,
      (confirmed) => {
        if (confirmed) {
          hapticFeedback?.notificationOccurred('warning');
          onDelete?.(item.id);
        }
      }
    );
  };

  const handleToggle = async () => {
    if (isToggling) return;
    
    setIsToggling(true);
    hapticFeedback?.impactOccurred('light');
    
    try {
      await onToggle?.(item.id);
      hapticFeedback?.notificationOccurred('success');
    } catch (error) {
      hapticFeedback?.notificationOccurred('error');
    } finally {
      setIsToggling(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return null;
    return `₽${price.toLocaleString('ru-RU')}`;
  };

  return (
    <div className={`card-hover ${!item.isActive ? 'opacity-60' : ''} ${loading ? 'pointer-events-none' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-tg-text truncate">
            {item.name}
            {!item.isActive && (
              <span className="ml-2 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                Неактивно
              </span>
            )}
          </h3>
          
          {item.category && (
            <div className="flex items-center mt-1">
              <span className="text-xs text-tg-hint bg-tg-secondary-bg px-2 py-0.5 rounded-full">
                {item.category}
              </span>
            </div>
          )}
        </div>

        {item.price && (
          <div className="ml-3 flex-shrink-0">
            <span className="text-lg font-bold text-tg-text">
              {formatPrice(item.price)}
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-sm text-tg-hint mb-3 line-clamp-2">
          {item.description}
        </p>
      )}

      {/* Image */}
      {item.imageUrl && (
        <div className="mb-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-32 object-cover"
            loading="lazy"
            onError={(e) => {
              // Hide broken images
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleEdit}
              disabled={loading}
              className="btn btn-secondary text-xs px-3 py-1"
            >
              ✏️ Изменить
            </button>
            
            <button
              onClick={handleDelete}
              disabled={loading}
              className="btn btn-error text-xs px-3 py-1"
            >
              🗑️ Удалить
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Toggle Active/Inactive */}
            <button
              onClick={handleToggle}
              disabled={loading || isToggling}
              className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                item.isActive
                  ? 'bg-success-100 text-success-600 hover:bg-success-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } ${isToggling ? 'opacity-50' : ''}`}
            >
              {isToggling ? (
                '⏳'
              ) : (
                <>
                  {item.isActive ? '✅ Активно' : '❌ Неактивно'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 rounded-xl flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-tg-button"></div>
        </div>
      )}
    </div>
  );
}
