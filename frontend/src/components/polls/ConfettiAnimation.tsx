import React, { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import { useWindowSize } from '../../hooks/useWindowSize';

interface ConfettiAnimationProps {
  duration?: number; // Длительность в миллисекундах
  onComplete?: () => void;
}

/**
 * Компонент анимации конфетти при завершении голосования
 */
export const ConfettiAnimation: React.FC<ConfettiAnimationProps> = ({
  duration = 3000,
  onComplete,
}) => {
  const [isActive, setIsActive] = useState(true);
  const { width, height } = useWindowSize();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsActive(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!isActive) return null;

  return (
    <Confetti
      width={width}
      height={height}
      numberOfPieces={200}
      recycle={false}
      colors={[
        '#FFD700', // Золотой
        '#4CAF50', // Зелёный
        '#2196F3', // Синий
        '#FF9800', // Оранжевый
        '#E91E63', // Розовый
        '#9C27B0', // Фиолетовый
      ]}
      gravity={0.3}
      wind={0.01}
      tweenDuration={duration}
    />
  );
};
