import React from 'react';

/**
 * DarkBlueBackground - Темно-синий однородный фон
 * 
 * Используется как единый фон для всех страниц приложения
 * 
 * Цвета:
 * - Light mode: #2563eb (яркий синий)
 * - Dark mode: #1e3a8a (насыщенный темно-синий)
 * 
 * @example
 * <DarkBlueBackground />
 */
export const DarkBlueBackground: React.FC = () => {
  return (
    <div 
      className="fixed inset-0 z-0 bg-[#2563eb] dark:bg-[#1e3a8a]"
      aria-hidden="true"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1
      }}
    />
  );
};
