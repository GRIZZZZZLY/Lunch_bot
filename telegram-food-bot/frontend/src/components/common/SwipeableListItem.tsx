import React, { useRef, useState, useEffect } from 'react';
import { useHaptic } from '../../hooks/useHaptic';

interface SwipeAction {
  icon: string | React.ReactNode;
  label: string;
  color: 'red' | 'blue' | 'green' | 'orange' | 'purple';
  onClick: () => void | Promise<void>;
}

interface SwipeableListItemProps {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  threshold?: number;
  disabled?: boolean;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

const colorClasses = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
};

/**
 * Свайпаемый элемент списка с действиями
 * Swipe left для правого действия, swipe right для левого
 */
export const SwipeableListItem: React.FC<SwipeableListItemProps> = ({
  children,
  leftAction,
  rightAction,
  threshold = 80,
  disabled = false,
  onSwipeStart,
  onSwipeEnd,
}) => {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [actionTriggered, setActionTriggered] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const haptic = useHaptic();

  const triggerThreshold = threshold;
  const actionWidth = 80;

  useEffect(() => {
    if (disabled) {
      setOffset(0);
      setIsDragging(false);
    }
  }, [disabled]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    setIsDragging(true);
    onSwipeStart?.();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || disabled) return;

    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;

    // Ограничиваем свайп
    const maxOffset = actionWidth * 1.5;
    const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, diff));

    setOffset(clampedOffset);

    // Haptic feedback при достижении threshold
    if (Math.abs(clampedOffset) >= triggerThreshold && !actionTriggered) {
      if (clampedOffset > 0 && leftAction) {
        haptic.medium();
        setActionTriggered('left');
      } else if (clampedOffset < 0 && rightAction) {
        haptic.medium();
        setActionTriggered('right');
      }
    } else if (Math.abs(clampedOffset) < triggerThreshold) {
      setActionTriggered(null);
    }
  };

  const handleTouchEnd = async () => {
    if (!isDragging || disabled) return;

    setIsDragging(false);
    onSwipeEnd?.();

    // Проверяем достигнут ли порог для действия
    if (offset > triggerThreshold && leftAction) {
      haptic.success();
      setOffset(0);
      await leftAction.onClick();
    } else if (offset < -triggerThreshold && rightAction) {
      haptic.success();
      setOffset(0);
      await rightAction.onClick();
    } else {
      // Возврат в исходное положение
      setOffset(0);
    }

    setActionTriggered(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    
    startX.current = e.clientX;
    currentX.current = startX.current;
    setIsDragging(true);
    onSwipeStart?.();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || disabled) return;

    currentX.current = e.clientX;
    const diff = currentX.current - startX.current;

    const maxOffset = actionWidth * 1.5;
    const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, diff));

    setOffset(clampedOffset);

    if (Math.abs(clampedOffset) >= triggerThreshold && !actionTriggered) {
      if (clampedOffset > 0 && leftAction) {
        setActionTriggered('left');
      } else if (clampedOffset < 0 && rightAction) {
        setActionTriggered('right');
      }
    } else if (Math.abs(clampedOffset) < triggerThreshold) {
      setActionTriggered(null);
    }
  };

  const handleMouseUp = async () => {
    if (!isDragging || disabled) return;

    setIsDragging(false);
    onSwipeEnd?.();

    if (offset > triggerThreshold && leftAction) {
      setOffset(0);
      await leftAction.onClick();
    } else if (offset < -triggerThreshold && rightAction) {
      setOffset(0);
      await rightAction.onClick();
    } else {
      setOffset(0);
    }

    setActionTriggered(null);
  };

  // Блокируем scroll при свайпе
  useEffect(() => {
    if (isDragging) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isDragging]);

  const leftVisible = offset > 0 && leftAction;
  const rightVisible = offset < 0 && rightAction;
  const leftOpacity = leftVisible ? Math.min(Math.abs(offset) / actionWidth, 1) : 0;
  const rightOpacity = rightVisible ? Math.min(Math.abs(offset) / actionWidth, 1) : 0;

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Left action */}
      {leftAction && (
        <div
          className={`absolute left-0 top-0 bottom-0 flex items-center justify-center ${
            colorClasses[leftAction.color]
          } transition-opacity`}
          style={{
            width: `${actionWidth}px`,
            opacity: leftOpacity,
          }}
        >
          <div className="flex flex-col items-center text-white">
            <div className="text-2xl mb-1">
              {typeof leftAction.icon === 'string' ? leftAction.icon : leftAction.icon}
            </div>
            <div className="text-xs font-medium">{leftAction.label}</div>
          </div>
        </div>
      )}

      {/* Right action */}
      {rightAction && (
        <div
          className={`absolute right-0 top-0 bottom-0 flex items-center justify-center ${
            colorClasses[rightAction.color]
          } transition-opacity`}
          style={{
            width: `${actionWidth}px`,
            opacity: rightOpacity,
          }}
        >
          <div className="flex flex-col items-center text-white">
            <div className="text-2xl mb-1">
              {typeof rightAction.icon === 'string' ? rightAction.icon : rightAction.icon}
            </div>
            <div className="text-xs font-medium">{rightAction.label}</div>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className={`relative bg-telegram-bg-color transition-transform ${
          isDragging ? '' : 'duration-300'
        } ${actionTriggered ? 'scale-95' : ''}`}
        style={{
          transform: `translateX(${offset}px)`,
          touchAction: 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * Пример использования:
 * 
 * <SwipeableListItem
 *   leftAction={{
 *     icon: '⭐',
 *     label: 'Избранное',
 *     color: 'orange',
 *     onClick: () => handleAddToFavorites(item.id)
 *   }}
 *   rightAction={{
 *     icon: '🗑️',
 *     label: 'Удалить',
 *     color: 'red',
 *     onClick: () => handleDelete(item.id)
 *   }}
 * >
 *   <MenuItemCard item={item} />
 * </SwipeableListItem>
 */
