import React, { useState, useEffect, useRef } from 'react';
import { useTelegram } from '../../hooks/useTelegram';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  showClearButton?: boolean;
}

/**
 * Улучшенный компонент поиска с debounce и анимациями
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Поиск...',
  className = '',
  debounceMs = 300,
  showClearButton = true,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const { hapticFeedback } = useTelegram();

  // Debounce для поиска
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onChange(localValue);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [localValue, onChange, debounceMs]);

  // Синхронизация с внешним value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    hapticFeedback.selectionChanged();
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setIsFocused(true);
    hapticFeedback.selectionChanged();
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Иконка поиска */}
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg
          className={`h-5 w-5 transition-colors duration-200 ${
            isFocused || localValue
              ? 'text-telegram-button-color'
              : 'text-telegram-hint-color'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Поле ввода */}
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`
          w-full pl-10 pr-${showClearButton && localValue ? '10' : '4'}
          py-3 rounded-xl border transition-all duration-200
          bg-telegram-bg-color text-telegram-text-color
          placeholder-telegram-hint-color
          ${
            isFocused
              ? 'border-telegram-button-color shadow-lg shadow-telegram-button-color/20'
              : 'border-telegram-secondary-bg-color'
          }
          focus:outline-none focus:ring-2 focus:ring-telegram-button-color/30
        `}
      />

      {/* Кнопка очистки */}
      {showClearButton && localValue && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center
                     text-telegram-hint-color hover:text-telegram-text-color
                     transition-colors duration-200"
          aria-label="Очистить поиск"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* Индикатор загрузки при поиске */}
      {localValue !== value && (
        <div className="absolute inset-y-0 right-8 flex items-center">
          <div className="animate-spin h-4 w-4 border-2 border-telegram-button-color 
                         border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
};

export default SearchInput;
