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
      {/* Image with Glass Overlay */}
      {item.imageUrl && (
        <div className="relative h-48 w-full overflow-hidden">
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
          
          {/* Price Badge with Glass Effect */}
          {item.price && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="absolute top-3 right-3"
            >
              <div className={cn(
                'px-3 py-1.5 rounded-full backdrop-blur-md font-bold text-lg shadow-lg',
                getGlassTailwindClasses('heavy', isDark ? 'dark' : 'light'),
                'text-primary-food-700 dark:text-peach-300'
              )}>
                {formatPrice(item.price)}
              </div>
            </motion.div>
          )}
          
          {/* Status Badge */}
          {!item.isActive && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-3 left-3"
            >
              <GlassBadge
                label="Неактивно"
                variant="default"
                glassVariant="heavy"
                theme={isDark ? 'dark' : 'light'}
              />
            </motion.div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white text-xl mb-2 line-clamp-1">
              {item.name}
            </h3>
            
            {/* Category Badge */}
            {item.category && (
              <div className="flex items-center gap-2">
                <GlassBadge
                  label={item.category}
                  icon={Tag}
                  variant="food"
                  glassVariant="light"
                  theme={isDark ? 'dark' : 'light'}
                />
                {item.isActive && (
                  <GlassBadge
                    label="Активно"
                    icon={Sparkles}
                    variant="success"
                    glassVariant="light"
                    theme={isDark ? 'dark' : 'light'}
                  />
                )}
              </div>
            )}
          </div>

          {/* Price (если нет изображения) */}
          {item.price && !item.imageUrl && (
            <div className="ml-3 flex-shrink-0">
              <span className="text-2xl font-bold text-primary-food-700 dark:text-peach-300">
                {formatPrice(item.price)}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {item.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {item.description}
          </p>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700 gap-2">
          <div className="flex items-center space-x-2">
            <motion.button
              onClick={handleEdit}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-1 text-xs font-medium px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-bluegray-400/20 dark:hover:bg-bluegray-400/30 dark:text-bluegray-300 transition-colors disabled:opacity-50"
            >
              <Edit2 size={14} />
              <span>Изменить</span>
            </motion.button>
            
            <motion.button
              onClick={handleDeleteClick}
              disabled={loading || deleting}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-1 text-xs font-medium px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-error-soft-400/20 dark:hover:bg-error-soft-400/30 dark:text-error-soft-300 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              <span>Удалить</span>
            </motion.button>
          </div>

          {/* Toggle Active/Inactive */}
          <motion.button
            onClick={handleToggle}
            disabled={loading || isToggling}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
              flex items-center space-x-1 text-xs font-medium px-3 py-2 rounded-lg transition-colors
              ${item.isActive
                ? 'bg-green-50 hover:bg-green-100 text-green-600 dark:bg-success-soft-400/20 dark:hover:bg-success-soft-400/30 dark:text-success-soft-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-bluegray-600/30 dark:hover:bg-bluegray-600/40 dark:text-bluegray-400'
              }
              ${isToggling ? 'opacity-50' : ''}
              disabled:opacity-50
            `}
          >
            {isToggling ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
            ) : (
              <>
                {item.isActive ? (
                  <>
                    <CheckCircle size={14} />
                    <span>Активно</span>
                  </>
                ) : (
                  <>
                    <XCircle size={14} />
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
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-food-200 border-t-primary-food-500" />
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
