import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

/**
 * Хук для работы с тактильными откликами Telegram
 */
export const useHaptic = () => {
  const haptic = useRef(window.Telegram?.WebApp?.HapticFeedback);

  /**
   * Лёгкий отклик (например, при наведении)
   */
  const light = () => {
    haptic.current?.impactOccurred('light');
  };

  /**
   * Средний отклик (например, при нажатии кнопки)
   */
  const medium = () => {
    haptic.current?.impactOccurred('medium');
  };

  /**
   * Сильный отклик (например, при важном действии)
   */
  const heavy = () => {
    haptic.current?.impactOccurred('heavy');
  };

  /**
   * Мягкий отклик
   */
  const soft = () => {
    haptic.current?.impactOccurred('soft');
  };

  /**
   * Жёсткий отклик
   */
  const rigid = () => {
    haptic.current?.impactOccurred('rigid');
  };

  /**
   * Отклик при изменении выбора
   */
  const selection = () => {
    haptic.current?.selectionChanged();
  };

  /**
   * Уведомление об успехе
   */
  const success = () => {
    haptic.current?.notificationOccurred('success');
  };

  /**
   * Уведомление об ошибке
   */
  const error = () => {
    haptic.current?.notificationOccurred('error');
  };

  /**
   * Уведомление-предупреждение
   */
  const warning = () => {
    haptic.current?.notificationOccurred('warning');
  };

  return {
    light,
    medium,
    heavy,
    soft,
    rigid,
    selection,
    success,
    error,
    warning,
  };
};

/**
 * Хук для автоматических тактильных откликов при взаимодействии
 */
export const useAutoHaptic = (
  enabled: boolean = true,
  type: 'light' | 'medium' | 'heavy' = 'medium'
) => {
  const haptic = useHaptic();

  useEffect(() => {
    if (!enabled) return;

    const handleClick = () => {
      switch (type) {
        case 'light':
          haptic.light();
          break;
        case 'medium':
          haptic.medium();
          break;
        case 'heavy':
          haptic.heavy();
          break;
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [enabled, type]);

  return haptic;
};
