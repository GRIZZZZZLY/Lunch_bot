import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTelegram } from '../../hooks/useTelegram';

export interface SwipeAction {
  id: string;
  label: string;
  icon: ReactNode;
  color: string;
  bgColor: string;
  action: () => void;
}

export interface SwipeableCardProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  onSwipe?: (direction: 'left' | 'right', action?: SwipeAction) => void;
  swipeThreshold?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Карточка с поддержкой жестов смахивания для мобильных устройств
 */
export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  leftActions = [],
  rightActions = [],
  onSwipe,
  swipeThreshold = 80,
  className = '',
  disabled = false,
}) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const { hapticFeedback } = useTelegram();

  const maxSwipeDistance = 120;
  const actionTriggerDistance = 100;

  // Определение активного действия
  const getActiveAction = useCallback((distance: number): SwipeAction | null => {
    if (Math.abs(distance) < swipeThreshold) return null;
    
    if (distance > 0 && leftActions.length > 0) {
      return leftActions[0];
    } else if (distance < 0 && rightActions.length > 0) {
      return rightActions[0];
    }
    
    return null;
  }, [swipeThreshold, leftActions, rightActions]);

  // Обработка начала касания
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    
    const touch = e.touches[0];
    setStartX(touch.clientX);
    setIsDragging(true);
    hapticFeedback.selectionChanged();
  };

  // Обработка движения касания
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || disabled) return;

    const touch = e.touches[0];
    
    const newDragX = touch.clientX - startX;
    const clampedDragX = Math.max(Math.min(newDragX, maxSwipeDistance), -maxSwipeDistance);
    setDragX(clampedDragX);

    // Haptic feedback при достижении порога
    const activeAction = getActiveAction(clampedDragX);
    if (activeAction && Math.abs(clampedDragX) >= actionTriggerDistance) {
      hapticFeedback.impactOccurred('medium');
    }
  };

  // Обработка окончания касания
  const handleTouchEnd = () => {
    if (!isDragging || disabled) return;

    const activeAction = getActiveAction(dragX);
    const shouldTrigger = Math.abs(dragX) >= actionTriggerDistance;

    if (shouldTrigger && activeAction) {
      hapticFeedback.impactOccurred('heavy');
      onSwipe?.(dragX > 0 ? 'left' : 'right', activeAction);
      activeAction.action();
    }

    // Анимация возврата
    setIsDragging(false);
    setDragX(0);
    setStartX(0);
  };

  // Обработка событий мыши для десктопа
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    
    setStartX(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || disabled) return;

    const newDragX = e.clientX - startX;
    const clampedDragX = Math.max(Math.min(newDragX, maxSwipeDistance), -maxSwipeDistance);
    setDragX(clampedDragX);
  }, [isDragging, disabled, startX, maxSwipeDistance]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || disabled) return;

    const activeAction = getActiveAction(dragX);
    const shouldTrigger = Math.abs(dragX) >= actionTriggerDistance;

    if (shouldTrigger && activeAction) {
      onSwipe?.(dragX > 0 ? 'left' : 'right', activeAction);
      activeAction.action();
    }

    setIsDragging(false);
    setDragX(0);
    setStartX(0);
  }, [isDragging, disabled, dragX, actionTriggerDistance, getActiveAction, onSwipe]);

  // Подписка на события мыши
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const activeAction = getActiveAction(dragX);
  const actionOpacity = Math.min(Math.abs(dragX) / actionTriggerDistance, 1);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Левые действия */}
      {leftActions.length > 0 && (
        <div 
          className="absolute left-0 top-0 bottom-0 flex items-center justify-start pl-4 z-10"
          style={{
            width: `${Math.max(0, dragX)}px`,
            opacity: dragX > 0 ? actionOpacity : 0,
            backgroundColor: activeAction && dragX > 0 ? activeAction.bgColor : 'transparent',
          }}
        >
          {leftActions.map((action) => (
            <div 
              key={action.id}
              className={`flex flex-col items-center justify-center min-w-16 h-full text-white`}
              style={{ color: action.color }}
            >
              <div className="text-xl mb-1">{action.icon}</div>
              <span className="text-xs font-medium">{action.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Правые действия */}
      {rightActions.length > 0 && (
        <div 
          className="absolute right-0 top-0 bottom-0 flex items-center justify-end pr-4 z-10"
          style={{
            width: `${Math.max(0, -dragX)}px`,
            opacity: dragX < 0 ? actionOpacity : 0,
            backgroundColor: activeAction && dragX < 0 ? activeAction.bgColor : 'transparent',
          }}
        >
          {rightActions.map((action) => (
            <div 
              key={action.id}
              className={`flex flex-col items-center justify-center min-w-16 h-full text-white`}
              style={{ color: action.color }}
            >
              <div className="text-xl mb-1">{action.icon}</div>
              <span className="text-xs font-medium">{action.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Основной контент */}
      <div
        ref={cardRef}
        className={`relative z-20 transition-transform ${isDragging ? 'duration-0' : 'duration-300 ease-out'}`}
        style={{
          transform: `translateX(${dragX}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {children}
      </div>
    </div>
  );
};
