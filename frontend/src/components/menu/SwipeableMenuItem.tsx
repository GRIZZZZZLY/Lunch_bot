import { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { MenuItem } from '../../services/menu.service';
import { MenuItemCard } from './MenuItemCard';
import { Edit2, Trash2 } from 'lucide-react';
import { useTelegram } from '@/hooks/useTelegram';
import { ICON_SIZES } from '@/lib/design-tokens';

interface SwipeableMenuItemProps {
  item: MenuItem;
  onEdit?: (item: MenuItem) => void;
  onDelete?: (id: number) => void;
  onToggle?: (id: number) => void;
  loading?: boolean;
}

const SWIPE_THRESHOLD = 80; // Minimum swipe distance to trigger action
const MAX_SWIPE = 120; // Maximum visible swipe distance

/**
 * SwipeableMenuItem - Обёртка для MenuItemCard с swipe actions
 * - Свайп влево → кнопка удаления (красный фон)
 * - Свайп вправо → кнопка редактирования (синий фон)
 * - Тап по центру → переключение активности
 */
export function SwipeableMenuItem({
  item,
  onEdit,
  onDelete,
  onToggle,
  loading = false
}: SwipeableMenuItemProps) {
  const { hapticFeedback } = useTelegram();
  const [isSwipedLeft, setIsSwipedLeft] = useState(false);
  const [isSwipedRight, setIsSwipedRight] = useState(false);

  const x = useMotionValue(0);
  const opacity = useTransform(x, [-MAX_SWIPE, 0, MAX_SWIPE], [0.8, 1, 0.8]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeDistance = info.offset.x;

    // Swipe left (show delete)
    if (swipeDistance < -SWIPE_THRESHOLD) {
      x.set(-MAX_SWIPE);
      setIsSwipedLeft(true);
      setIsSwipedRight(false);
      hapticFeedback?.impactOccurred('light');
    }
    // Swipe right (show edit)
    else if (swipeDistance > SWIPE_THRESHOLD) {
      x.set(MAX_SWIPE);
      setIsSwipedRight(true);
      setIsSwipedLeft(false);
      hapticFeedback?.impactOccurred('light');
    }
    // Return to center
    else {
      x.set(0);
      setIsSwipedLeft(false);
      setIsSwipedRight(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      hapticFeedback?.notificationOccurred('warning');
      onDelete(item.id);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      hapticFeedback?.selectionChanged();
      onEdit(item);
    }
  };

  const handleToggle = async () => {
    if (onToggle && !isSwipedLeft && !isSwipedRight) {
      hapticFeedback?.impactOccurred('light');
      await onToggle(item.id);
    }
  };

  const resetSwipe = () => {
    x.set(0);
    setIsSwipedLeft(false);
    setIsSwipedRight(false);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Left action (Delete) - Red background */}
      {isSwipedLeft && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-gradient-to-l from-red-500 to-red-600 flex items-center justify-end pr-6 z-0"
        >
          <button
            onClick={handleDelete}
            className="flex flex-col items-center gap-1 text-white"
          >
            <Trash2 className={ICON_SIZES.lg} />
            <span className="text-xs font-medium">Удалить</span>
          </button>
        </motion.div>
      )}

      {/* Right action (Edit) - Blue background */}
      {isSwipedRight && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-start pl-6 z-0"
        >
          <button
            onClick={handleEdit}
            className="flex flex-col items-center gap-1 text-white"
          >
            <Edit2 className={ICON_SIZES.lg} />
            <span className="text-xs font-medium">Изменить</span>
          </button>
        </motion.div>
      )}

      {/* Draggable card wrapper */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -MAX_SWIPE, right: MAX_SWIPE }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ x, opacity }}
        className="relative z-10"
        onClick={handleToggle}
      >
        <MenuItemCard
          item={item}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
          showActions={false} // Hide action buttons - swipe handles them
          loading={loading}
        />
      </motion.div>

      {/* Close swipe overlay on tap outside */}
      {(isSwipedLeft || isSwipedRight) && (
        <div
          onClick={resetSwipe}
          className="fixed inset-0 z-[5]"
          style={{ pointerEvents: 'auto' }}
        />
      )}
    </div>
  );
}
