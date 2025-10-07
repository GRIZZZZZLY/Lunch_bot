import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { MenuItem } from '../../services/menu.service';
import { ConfirmModal } from '../common/ConfirmModal';
import { GlassCard, GlassBadge } from '@/components/glass';
import { useTelegram } from '@/hooks/useTelegram';
import { Edit2, Trash2, CheckCircle, XCircle, Tag, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGlassTailwindClasses } from '@/lib/glassmorphism';

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
  const { hapticFeedback, colorScheme } = useTelegram();
  const [isToggling, setIsToggling] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const isDark = colorScheme === 'dark';

  const handleEdit = () => {
    hapticFeedback?.selectionChanged();
    onEdit?.(item);
  };

  const handleDeleteClick = () => {
    hapticFeedback?.impactOccurred('medium');
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete) return;
    
    setDeleting(true);
    try {
      hapticFeedback?.notificationOccurred('warning');
      await onDelete(item.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Ошибка удаления:', error);
    } finally {
      setDeleting(false);
    }
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
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <GlassCard
        variant="medium"
        theme={isDark ? 'dark' : 'light'}
        hover
        className={cn(
          'relative overflow-hidden p-0',
          !item.isActive && 'opacity-60',
          loading && 'pointer-events-none'
        )}
      >
      {/* Image with Glass Overlay - 180px (Golden ratio) */}
      {item.imageUrl && (
        <div className="relative h-45 w-full overflow-hidden">
          <motion.img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
            animate={{
              scale: isHovered ? 1.05 : 1,
            }}
            transition={{ duration: 0.3 }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          
          {/* Gradient Overlay */}
          <div 
            className={cn(
              'absolute inset-0 bg-gradient-to-t',
              isDark 
                ? 'from-gray-900/90 via-gray-900/50 to-transparent' 
                : 'from-white/90 via-white/50 to-transparent'
            )}
          />
          
          {/* Price Badge - Larger and more prominent */}
          {item.price && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="absolute bottom-3 right-3"
            >
              <div className="px-4 py-2 rounded-xl backdrop-blur-md font-bold text-xl shadow-lg bg-white/90 dark:bg-black/60 text-foreground">
                {formatPrice(item.price)}
              </div>
            </motion.div>
          )}
          
          {/* Status Badge - Top left */}
          {!item.isActive && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-3 left-3"
            >
              <div className="px-3 py-1.5 rounded-lg backdrop-blur-md bg-black/60 text-white text-sm font-medium flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                Неактивно
              </div>
            </motion.div>
          )}
          
          {/* Category Badge - Top right */}
          {item.category && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-3 right-3"
            >
              <div className="px-3 py-1.5 rounded-lg backdrop-blur-md bg-black/60 text-white text-sm font-medium">
                {getCategoryIcon(item.category)} {item.category}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Content - More compact */}
      <div className="p-4 space-y-2.5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-xl mb-1.5 line-clamp-1">
              {item.name}
            </h3>
            
            {/* Status indicator (if no image) */}
            {!item.imageUrl && (
              <div className="flex items-center gap-2 mb-2">
                {item.category && (
                  <span className="text-sm text-muted-foreground">
                    {getCategoryIcon(item.category)} {item.category}
                  </span>
                )}
                {item.isActive && (
                  <span className="flex items-center gap-1 text-xs text-mint-500">
                    <span className="size-1.5 rounded-full bg-mint-500" />
                    Активно
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Price (если нет изображения) */}
          {item.price && !item.imageUrl && (
            <div className="ml-3 flex-shrink-0">
              <span className="text-2xl font-bold text-mint-500">
                {formatPrice(item.price)}
              </span>
            </div>
          )}
        </div>

        {/* Description - More compact */}
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Actions - Touch-friendly buttons (44x44px minimum) */}
        {showActions && (
          <div className="flex items-center justify-between pt-3 border-t border-border gap-2">
            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleEdit}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 text-xs font-medium min-h-11 px-4 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 transition-colors disabled:opacity-50"
              >
                <Edit2 className="size-4" />
                <span>Изменить</span>
              </motion.button>
              
              <motion.button
                onClick={handleDeleteClick}
                disabled={loading || deleting}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 text-xs font-medium min-h-11 px-4 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                <span>Удалить</span>
              </motion.button>
            </div>

            {/* Toggle Active/Inactive - Touch-friendly */}
            <motion.button
              onClick={handleToggle}
              disabled={loading || isToggling}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                flex items-center gap-1.5 text-xs font-medium min-h-11 px-4 rounded-lg transition-colors
                ${item.isActive
                  ? 'bg-mint-50 hover:bg-mint-100 text-mint-600 dark:bg-mint-500/10 dark:hover:bg-mint-500/20 dark:text-mint-400'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }
                ${isToggling ? 'opacity-50' : ''}
                disabled:opacity-50
              `}
            >
              {isToggling ? (
                <div className="animate-spin rounded-full size-4 border-2 border-current border-t-transparent" />
              ) : (
                <>
                  {item.isActive ? (
                    <>
                      <CheckCircle className="size-4" />
                      <span>Активно</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-4" />
                      <span>Неактивно</span>
                    </>
                  )}
                </>
              )}
            </motion.button>
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
          <div className="animate-spin rounded-full size-8 border-4 border-mint-200 border-t-mint-500 dark:border-mint-500/20 dark:border-t-mint-500" />
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {showDeleteConfirm && createPortal(
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteConfirm}
          title="Удалить блюдо?"
          description={`Вы уверены, что хотите удалить блюдо "${item.name}"? Это действие нельзя отменить.`}
          confirmText="Удалить"
          cancelText="Отмена"
          variant="danger"
          loading={deleting}
        />,
        document.body
      )}
    </GlassCard>
    </div>
  );
}

/**
 * Helper: Get category icon
 */
function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'первые блюда': '🍲',
    'вторые блюда': '🍖',
    'салаты': '🥗',
    'десерты': '🍰',
    'напитки': '🥤',
    'закуски': '🥨',
    'супы': '🍜',
    'мясо': '🥩',
    'рыба': '🐟',
    'овощи': '🥬',
    'паста': '🍝',
    'пицца': '🍕',
    'бургеры': '🍔',
    'азиатская': '🍜',
    'итальянская': '🍝',
    'японская': '🍣',
    'default': '🍽️'
  };

  const lowerCategory = category.toLowerCase();
  return icons[lowerCategory] || icons.default;
}
