import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHaptic } from '../../hooks/useHaptic';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: number[]; // в процентах от высоты экрана [30, 60, 90]
  initialSnap?: number; // индекс начальной позиции в snapPoints
  title?: string;
  showHandle?: boolean;
  enableBackdrop?: boolean;
  enableSwipeDown?: boolean;
  className?: string;
}

/**
 * BottomSheet - выдвигающаяся панель снизу с поддержкой snap points
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  snapPoints = [50, 90],
  initialSnap = 0,
  title,
  showHandle = true,
  enableBackdrop = true,
  enableSwipeDown = true,
  className = '',
}) => {
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const haptic = useHaptic();

  const currentHeight = snapPoints[currentSnap];

  // Блокируем скролл body при открытии
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);



  // ESC для закрытия
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableSwipeDown) return;
    
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !enableSwipeDown) return;

    const newY = e.touches[0].clientY;
    setCurrentY(newY);

    // Предотвращаем скролл при свайпе
    if (newY > startY) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging || !enableSwipeDown) return;

    setIsDragging(false);
    
    const deltaY = currentY - startY;
    const threshold = 50;

    if (deltaY > threshold) {
      // Свайп вниз
      if (currentSnap > 0) {
        // Переход к меньшему snap point
        setCurrentSnap(currentSnap - 1);
        haptic.selection();
      } else {
        // Закрытие если уже минимальный snap
        onClose();
        haptic.medium();
      }
    } else if (deltaY < -threshold) {
      // Свайп вверх
      if (currentSnap < snapPoints.length - 1) {
        setCurrentSnap(currentSnap + 1);
        haptic.selection();
      }
    }
  };

  const handleBackdropClick = () => {
    if (enableBackdrop) {
      onClose();
      haptic.light();
    }
  };

  if (!isOpen) return null;

  const translateY = isDragging ? 
    Math.max(0, currentY - startY) : 0;

  const sheetContent = (
    <div className="fixed inset-0 z-50 flex items-end animate-fade-in">
      {/* Backdrop */}
      {enableBackdrop && (
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleBackdropClick}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`relative w-full bg-telegram-secondary-bg-color rounded-t-3xl shadow-2xl transition-all duration-300 ${className}`}
        style={{
          height: `${currentHeight}%`,
          transform: `translateY(${translateY}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        {showHandle && (
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-telegram-hint-color/30 rounded-full" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="px-6 py-4 border-b border-telegram-hint-color/10">
            <h3 className="text-xl font-semibold text-telegram-text-color text-center">
              {title}
            </h3>
          </div>
        )}

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{
            height: title ? 'calc(100% - 80px)' : showHandle ? 'calc(100% - 32px)' : '100%',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(sheetContent, document.body);
};

/**
 * Хук для управления BottomSheet
 */
export const useBottomSheet = () => {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(!isOpen);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
};

/**
 * Предустановленные BottomSheet компоненты
 */
export const FilterBottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ isOpen, onClose, children }) => (
  <BottomSheet
    isOpen={isOpen}
    onClose={onClose}
    title="Фильтры"
    snapPoints={[40, 80]}
    showHandle
  >
    {children}
  </BottomSheet>
);

export const ActionBottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ isOpen, onClose, children }) => (
  <BottomSheet
    isOpen={isOpen}
    onClose={onClose}
    snapPoints={[30]}
    showHandle
    enableSwipeDown
  >
    <div className="p-6">
      {children}
    </div>
  </BottomSheet>
);

/**
 * Пример использования:
 * 
 * const { isOpen, open, close } = useBottomSheet();
 * 
 * return (
 *   <>
 *     <Button onClick={open}>Открыть фильтры</Button>
 *     
 *     <BottomSheet
 *       isOpen={isOpen}
 *       onClose={close}
 *       title="Фильтры"
 *       snapPoints={[30, 60, 90]}
 *       initialSnap={1}
 *     >
 *       <div className="p-6">
 *         <FilterContent />
 *       </div>
 *     </BottomSheet>
 *   </>
 * );
 */
