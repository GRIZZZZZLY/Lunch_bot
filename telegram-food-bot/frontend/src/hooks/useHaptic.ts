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
 * 
 * ОПТИМИЗИРОВАНО: Только важные действия
 * - success: Успешные операции (голосование, создание)
 * - error: Ошибки
 * - warning: Предупреждения
 * - impact: Критичные действия (удаление, завершение)
 * 
 * НЕ используйте haptic для:
 * - Обычной навигации
 * - Кликов по карточкам
 * - Hover эффектов
 * - Прокрутки
 */
export const useHaptic = () => {
  const haptic = useRef(window.Telegram?.WebApp?.HapticFeedback);

  /**
   * Уведомление об успехе (зеленая галочка)
   * Использовать для: успешное голосование, создание, сохранение
   */
  const success = () => {
    haptic.current?.notificationOccurred('success');
  };

  /**
   * Уведомление об ошибке (красный крестик)
   * Использовать для: ошибки API, валидация формы
   */
  const error = () => {
    haptic.current?.notificationOccurred('error');
  };

  /**
   * Уведомление-предупреждение (желтый треугольник)
   * Использовать для: предупреждения, подтверждения
   */
  const warning = () => {
    haptic.current?.notificationOccurred('warning');
  };

  /**
   * Сильный тактильный отклик
   * Использовать для: критичные действия (удаление, завершение голосования)
   */
  const impact = () => {
    haptic.current?.impactOccurred('heavy');
  };

  return {
    success,
    error,
    warning,
    impact,
  };
};

/**
 * @deprecated useAutoHaptic удален - используйте haptic только для важных действий
 * 
 * Автоматический haptic на каждом клике раздражает пользователей.
 * Вместо этого вызывайте haptic методы вручную только для критичных событий.
 */
