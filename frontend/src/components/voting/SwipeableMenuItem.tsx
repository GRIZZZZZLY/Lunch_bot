/**
 * Swipeable Menu Item Component
 * P2 Task: Swipe gestures для быстрого голосования
 * 
 * Swipe right → vote
 * Swipe left → view details
 */

import { useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Check, Info } from 'lucide-react';
import { MenuItem } from '@/services/menu.service';
import { useHaptic } from '@/hooks/useHaptic';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface SwipeableMenuItemProps {
  item: MenuItem;
  onVote: (itemId: number) => void;
  onViewDetails?: (item: MenuItem) => void;
  isSelected?: boolean;
  disabled?: boolean;
}

/**
 * Menu Item с swipe gestures
 * 
 * @example
 * ```tsx
 * <SwipeableMenuItem
 *   item={menuItem}
 *   onVote={handleVote}
 *   isSelected={selectedId === menuItem.id}
 * />
 * ```
 */
export const SwipeableMenuItem = ({
  item,
  onVote,
  onViewDetails,
  isSelected = false,
  disabled = false,
}: SwipeableMenuItemProps) => {
  const [dragX, setDragX] = useState(0);
  const [actionTriggered, setActionTriggered] = useState<'vote' | 'details' | null>(null);
  const haptic = useHaptic();

  const SWIPE_THRESHOLD = 100; // px
  const MAX_SWIPE = 150; // максимальное смещение

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const offset = info.offset.x;

    if (Math.abs(offset) > SWIPE_THRESHOLD) {
      if (offset > 0) {
        // Swipe right → VOTE
        setActionTriggered('vote');
        haptic.success();
        
        setTimeout(() => {
          onVote(item.id);
          setActionTriggered(null);
        }, 200);
      } else if (offset < 0 && onViewDetails) {
        // Swipe left → DETAILS
        setActionTriggered('details');
        haptic.light();
        
        setTimeout(() => {
          onViewDetails(item);
          setActionTriggered(null);
        }, 200);
      }
    }

    setDragX(0);
  };

  const handleDrag = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const offset = info.offset.x;
    
    // Haptic feedback при достижении threshold
    if (Math.abs(offset) > SWIPE_THRESHOLD && dragX < SWIPE_THRESHOLD) {
      haptic.selection();
    }
    
    setDragX(Math.abs(offset));
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Background indicators */}
      <div className="absolute inset-0 flex items-center justify-between px-6">
        {/* Vote indicator (right) */}
        <motion.div
          className={cn(
            "flex items-center gap-2 text-green-500",
            actionTriggered === 'vote' && "scale-110"
          )}
          initial={{ opacity: 0, x: -20 }}
          animate={{
            opacity: dragX > SWIPE_THRESHOLD && dragX > 0 ? 1 : 0,
            x: dragX > SWIPE_THRESHOLD && dragX > 0 ? 0 : -20,
          }}
          transition={{ duration: 0.2 }}
        >
          <Check className={ICON_SIZES.lg} />
          <span className="font-semibold">Голосовать</span>
        </motion.div>

        {/* Details indicator (left) */}
        {onViewDetails && (
          <motion.div
            className={cn(
              "flex items-center gap-2 text-blue-500",
              actionTriggered === 'details' && "scale-110"
            )}
            initial={{ opacity: 0, x: 20 }}
            animate={{
              opacity: dragX > SWIPE_THRESHOLD && dragX < 0 ? 1 : 0,
              x: dragX > SWIPE_THRESHOLD && dragX < 0 ? 0 : 20,
            }}
            transition={{ duration: 0.2 }}
          >
            <span className="font-semibold">Подробнее</span>
            <Info className={ICON_SIZES.lg} />
          </motion.div>
        )}
      </div>

      {/* Draggable content */}
      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ left: -MAX_SWIPE, right: MAX_SWIPE }}
        dragElastic={0.1}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className={cn(
          "relative z-10 cursor-grab active:cursor-grabbing",
          "bg-card/95 backdrop-blur-md border border-border/50 rounded-xl p-4",
          "transition-shadow duration-200",
          isSelected && "ring-2 ring-primary shadow-lg shadow-primary/20",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
      >
        {/* Menu Item content */}
        <div className="flex items-center gap-4">
          {/* Image */}
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-16 w-16 rounded-lg object-cover"
            />
          )}

          {/* Info */}
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{item.name}</h3>
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {item.description}
              </p>
            )}
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm font-medium text-primary">
                {item.price} ₽
              </span>
            </div>
          </div>

          {/* Selected indicator */}
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary"
            >
              <Check className={cn(ICON_SIZES.md, "text-primary-foreground")} />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Swipe hint (показываем один раз) */}
      {!disabled && dragX === 0 && (
        <motion.div
          className="absolute bottom-2 right-2 text-xs text-muted-foreground/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 2, delay: 0.5 }}
        >
          👆 Свайпните для голосования
        </motion.div>
      )}
    </div>
  );
};

/**
 * List of swipeable menu items
 */
export const SwipeableMenuList: React.FC<{
  items: MenuItem[];
  onVote: (itemId: number) => void;
  selectedId?: number;
  disabled?: boolean;
}> = ({ items, onVote, selectedId, disabled }) => {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <SwipeableMenuItem
          key={item.id}
          item={item}
          onVote={onVote}
          isSelected={selectedId === item.id}
          disabled={disabled}
        />
      ))}
    </div>
  );
};
