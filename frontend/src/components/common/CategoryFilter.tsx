import React from 'react';
import { useTelegram } from '../../hooks/useTelegram';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  itemCounts?: Record<string, number>;
  className?: string;
}

/**
 * Компонент фильтра по категориям с визуальными индикаторами
 */
export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
  itemCounts = {},
  className = '',
}) => {
  const { hapticFeedback } = useTelegram();

  const handleCategoryClick = (category: string | null) => {
    onCategoryChange(category);
    hapticFeedback.selectionChanged();
  };

  const totalItems = Object.values(itemCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className={`${className}`}>
      <div className="flex flex-wrap gap-2 p-2">
        {/* Кнопка "Все" */}
        <button
          onClick={() => handleCategoryClick(null)}
          className={`
            flex items-center px-4 py-2 rounded-full text-sm font-medium
            transition-all duration-200 transform hover:scale-105
            ${
              selectedCategory === null
                ? 'bg-telegram-button-color text-telegram-button-text-color shadow-lg'
                : 'bg-telegram-secondary-bg-color text-telegram-text-color hover:bg-telegram-button-color/10'
            }
          `}
        >
          <span>Все</span>
          {totalItems > 0 && (
            <span className={`
              ml-2 px-2 py-1 rounded-full text-xs
              ${
                selectedCategory === null
                  ? 'bg-telegram-button-text-color/20 text-telegram-button-text-color'
                  : 'bg-telegram-hint-color/20 text-telegram-hint-color'
              }
            `}>
              {totalItems}
            </span>
          )}
        </button>

        {/* Кнопки категорий */}
        {categories.map((category) => {
          const count = itemCounts[category] || 0;
          const isSelected = selectedCategory === category;

          return (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className={`
                flex items-center px-4 py-2 rounded-full text-sm font-medium
                transition-all duration-200 transform hover:scale-105
                ${
                  isSelected
                    ? 'bg-telegram-button-color text-telegram-button-text-color shadow-lg'
                    : 'bg-telegram-secondary-bg-color text-telegram-text-color hover:bg-telegram-button-color/10'
                }
                ${count === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={count === 0}
            >
              {/* Иконка категории */}
              <span className="mr-2">{getCategoryIcon(category)}</span>
              
              <span className="capitalize">{category}</span>
              
              {/* Счетчик элементов */}
              {count > 0 && (
                <span className={`
                  ml-2 px-2 py-1 rounded-full text-xs
                  ${
                    isSelected
                      ? 'bg-telegram-button-text-color/20 text-telegram-button-text-color'
                      : 'bg-telegram-hint-color/20 text-telegram-hint-color'
                  }
                `}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Активный фильтр индикатор */}
      {selectedCategory && (
        <div className="px-4 py-2 bg-telegram-button-color/10 border-l-4 border-telegram-button-color">
          <div className="flex items-center justify-between">
            <span className="text-sm text-telegram-text-color">
              Показано: <span className="font-semibold">{selectedCategory}</span>
              {itemCounts[selectedCategory] && (
                <span className="text-telegram-hint-color ml-1">
                  ({itemCounts[selectedCategory]} блюд)
                </span>
              )}
            </span>
            
            <button
              onClick={() => handleCategoryClick(null)}
              className="text-telegram-button-color hover:text-telegram-button-color/80
                         transition-colors duration-200 text-sm"
            >
              Сбросить
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Получение иконки для категории
 */
function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'первые блюда': '🍲',
    'вторые блюда': '🍖',
    'салаты': '🥗',
    'десерты': '🍰',
    'напитки': '🥤',
    'закуски': '🥨',
    'супы': '🍜',
    'мясо': '🥩',
    'рыба': '🐟',
    'овощи': '🥬',
    'паста': '🍝',
    'пицца': '🍕',
    'бургеры': '🍔',
    'азиатская': '🍜',
    'итальянская': '🍝',
    'японская': '🍣',
    'default': '🍽️'
  };

  const lowerCategory = category.toLowerCase();
  return icons[lowerCategory] || icons.default;
}

export default CategoryFilter;
