import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';

/**
 * Компонент индикатора прогресса навигации
 * Показывает тонкую полосу вверху экрана при переходе между страницами
 * 
 * Использует только useLocation (совместим с BrowserRouter)
 */
export const NavigationProgress: React.FC = () => {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevPathRef = useRef(location.pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Отслеживаем изменение location
  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      // Начинаем анимацию
      setIsNavigating(true);
      setProgress(0);
      
      // Очищаем предыдущие таймеры
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      
      // Анимация прогресса
      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev < 70) return prev + 15;
          if (prev < 90) return prev + 5;
          return prev;
        });
      }, 50);
      
      // Завершаем через короткое время (страница уже загружена)
      timerRef.current = setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProgress(100);
        
        // Скрываем после завершения
        setTimeout(() => {
          setIsNavigating(false);
          setProgress(0);
        }, 200);
      }, 300);
      
      prevPathRef.current = location.pathname;
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {isNavigating && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          className="fixed top-0 left-0 right-0 z-[9999] h-1"
          role="progressbar"
          aria-label="Загрузка страницы"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <m.div
            className="h-full w-full origin-left bg-gradient-to-r from-orange-500 via-purple-500 to-orange-500 dark:from-purple-400 dark:via-pink-500 dark:to-purple-400"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress / 100 }}
            transition={{ 
              duration: 0.15, 
              ease: progress === 100 ? 'easeOut' : 'linear' 
            }}
            style={{
              boxShadow: '0 0 10px rgba(249, 115, 22, 0.5), 0 0 5px rgba(249, 115, 22, 0.3)',
            }}
          />
        </m.div>
      )}
    </AnimatePresence>
  );
};

export default NavigationProgress;
