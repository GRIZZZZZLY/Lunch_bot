import React, { useState, useRef, useEffect } from 'react';
import { useTelegram } from '../../hooks/useTelegram';

export type SortOption = {
  value: string;
  label: string;
  icon?: string;
};

interface SortSelectorProps {
  options: SortOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Компонент выбора сортировки с выпадающим меню
 */
export const SortSelector: React.FC<SortSelectorProps> = ({
  options,
  value,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { hapticFeedback } = useTelegram();

  const selectedOption = options.find(option => option.value === value);

  // Закрытие dropdown при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    hapticFeedback.selectionChanged();
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    hapticFeedback.selectionChanged();
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Кнопка выбора */}
      <button
        onClick={handleToggle}
        className={`
          flex items-center justify-between w-full px-4 py-3
          bg-telegram-secondary-bg-color text-telegram-text-color
          rounded-xl border border-transparent
          hover:border-telegram-button-color/20
          transition-all duration-200
          ${isOpen ? 'border-telegram-button-color shadow-lg' : ''}
        `}
      >
        <div className="flex items-center">
          {selectedOption?.icon && (
            <span className="mr-2 text-lg">{selectedOption.icon}</span>
          )}
          <span className="text-sm font-medium">{selectedOption?.label}</span>
        </div>
        
        <svg
          className={`w-5 h-5 text-telegram-hint-color transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Выпадающее меню */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50
                        bg-telegram-bg-color border border-telegram-secondary-bg-color
                        rounded-xl shadow-xl overflow-hidden">
          {options.map((option, index) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`
                w-full flex items-center px-4 py-3 text-left
                hover:bg-telegram-secondary-bg-color
                transition-colors duration-150
                ${value === option.value ? 'bg-telegram-button-color/10 text-telegram-button-color' : 'text-telegram-text-color'}
                ${index !== options.length - 1 ? 'border-b border-telegram-secondary-bg-color/50' : ''}
              `}
            >
              {option.icon && (
                <span className="mr-3 text-lg">{option.icon}</span>
              )}
              <span className="text-sm font-medium">{option.label}</span>
              
              {/* Индикатор выбранного */}
              {value === option.value && (
                <svg
                  className="ml-auto w-5 h-5 text-telegram-button-color"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SortSelector;
