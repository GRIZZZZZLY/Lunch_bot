import { memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { MenuItem } from '../../services/menu.service';
import { ConfirmModal } from '../common/ConfirmModal';
import { PastelCard } from '../ui/pastel-card';
import { useTelegram } from '@/hooks/useTelegram';
import { Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface MenuItemCardProps {
  item: MenuItem;
  onEdit?: (item: MenuItem) => void;
  onDelete?: (id: number) => void;
  onToggle?: (id: number) => void;
  showActions?: boolean;
  loading?: boolean;
}

// P1.3.4: Memoize для оптимизации виртуализации
export const MenuItemCard = memo(({
  item,
  onEdit,
  onDelete,
  onToggle,
  showActions = true,
  loading = false
}: MenuItemCardProps) => {
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
    } catch {
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
      <PastelCard
        variant="default"
        className={cn(
          'relative overflow-hidden p-0 transition-transform hover:-translate-y-0.5',
          !item.isActive && 'opacity-60',
          loading && 'pointer-events-none'
        )}
      >
      {/* Image - Compact Square 250x250 */}
      {item.imageUrl && (
        <div className="relative aspect-square w-full overflow-hidden rounded-t-xl">
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
          
          {/* Soft image overlay */}
          <div 
            className={cn(
              'absolute inset-0 bg-gradient-to-t',
              isDark 
                ? 'from-black/70 via-black/25 to-transparent' 
                : 'from-white/75 via-white/20 to-transparent'
            )}
          />
          
          {/* Price Badge - Compact */}
          {item.price && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="absolute bottom-2 right-2"
            >
              <div className="rounded-lg bg-card/92 px-3 py-1.5 text-lg font-semibold text-foreground shadow-md backdrop-blur-md">
                {formatPrice(item.price)}
              </div>
            </motion.div>
          )}
          
          {/* Status Badge - Top left - Compact */}
          {!item.isActive && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-2 left-2"
            >
              <div className="px-2 py-1 rounded-md backdrop-blur-md bg-black/60 text-white text-xs font-medium flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="hidden sm:inline">Неактивно</span>
              </div>
            </motion.div>
          )}
          
        </div>
      )}

      {/* Content - Compact */}
      <div className="p-3 space-y-2 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-base leading-tight line-clamp-1">
              {item.name}
            </h3>
            
            {/* Status indicator (if no image) */}
            {!item.imageUrl && item.isActive && (
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center gap-1 text-xs text-mint-600 dark:text-mint-400">
                  <span className="size-1.5 rounded-full bg-mint-500" />
                  Активно
                </span>
              </div>
            )}
          </div>

          {/* Price (если нет изображения) */}
          {item.price && !item.imageUrl && (
            <div className="ml-3 flex-shrink-0">
              <span className="text-2xl font-bold tabular-nums" style={{ color: 'hsl(var(--primary-text))' }}>
                {formatPrice(item.price)}
              </span>
            </div>
          )}
        </div>

        {/* Description - Compact 2 lines */}
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-snug flex-1">
            {item.description}
          </p>
        )}

        {/* Actions - Compact & Touch-friendly (44x44px) */}
        {showActions && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-border mt-auto">
            {/* Edit Button */}
            <motion.button
              onClick={handleEdit}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 flex items-center justify-center gap-1 text-xs font-medium min-h-[44px] px-2 rounded-lg bg-lavender-500/10 hover:bg-lavender-500/15 text-lavender-600 dark:text-lavender-400 transition-colors disabled:opacity-50"
            >
              <Edit2 className={ICON_SIZES.sm} />
              <span className="hidden sm:inline">Изм.</span>
            </motion.button>
            
            {/* Delete Button */}
            <motion.button
              onClick={handleDeleteClick}
              disabled={loading || deleting}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 flex items-center justify-center gap-1 text-xs font-medium min-h-[44px] px-2 rounded-lg bg-coral-500/10 hover:bg-coral-500/15 text-coral-600 dark:text-coral-400 transition-colors disabled:opacity-50"
            >
              <Trash2 className={ICON_SIZES.sm} />
              <span className="hidden sm:inline">Удал.</span>
            </motion.button>

            {/* Toggle Active/Inactive */}
            <motion.button
              onClick={handleToggle}
              disabled={loading || isToggling}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                flex-1 flex items-center justify-center gap-1 text-xs font-medium min-h-[44px] px-2 rounded-lg transition-colors
                ${item.isActive
                  ? 'bg-primary/10 hover:bg-primary/15 text-primary'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }
                ${isToggling ? 'opacity-50' : ''}
                disabled:opacity-50
              `}
            >
              {isToggling ? (
                <div className={`${ICON_SIZES.sm} animate-spin rounded-full  border-2 border-current border-t-transparent`} />
              ) : (
                <>
                  {item.isActive ? (
                    <>
                      <CheckCircle className={ICON_SIZES.sm} />
                      <span className="hidden sm:inline">Акт.</span>
                    </>
                  ) : (
                    <>
                      <XCircle className={ICON_SIZES.sm} />
                      <span className="hidden sm:inline">Неакт.</span>
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
          <div className={`${ICON_SIZES.xl} animate-spin rounded-full  border-4 border-peach-200 border-t-peach-500 dark:border-peach-500/20 dark:border-t-peach-500`} />
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
    </PastelCard>
    </div>
  );
}, (prevProps, nextProps) => {
  // P1.3.4: Custom comparison для оптимизации виртуализации
  // Перерендериваем только если изменились критичные поля
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.isActive === nextProps.item.isActive &&
    prevProps.item.price === nextProps.item.price &&
    prevProps.loading === nextProps.loading &&
    prevProps.showActions === nextProps.showActions
  );
});

MenuItemCard.displayName = 'MenuItemCard';

