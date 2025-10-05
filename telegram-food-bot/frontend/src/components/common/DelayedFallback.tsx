import React, { useState, useEffect } from 'react';

export interface DelayedFallbackProps {
  /**
   * Задержка в миллисекундах перед показом fallback
   * По умолчанию 200ms - оптимально для UX
   */
  delay?: number;
  
  /**
   * Контент для показа после задержки (обычно loader)
   */
  children: React.ReactNode;
}

/**
 * Компонент, показывающий fallback только после задержки
 * 
 * Предотвращает мерцание loader при быстрой загрузке.
 * Если контент загружается быстрее чем delay - fallback не показывается.
 * 
 * @example
 * <Suspense fallback={
 *   <DelayedFallback delay={200}>
 *     <PageLoader />
 *   </DelayedFallback>
 * }>
 *   <Routes />
 * </Suspense>
 */
export const DelayedFallback: React.FC<DelayedFallbackProps> = ({ 
  delay = 200, 
  children 
}) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  // Не показываем ничего пока не истекла задержка
  if (!show) {
    return null;
  }

  return <>{children}</>;
};
