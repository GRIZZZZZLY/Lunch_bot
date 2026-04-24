import React from 'react';
import { motion } from 'framer-motion';
import { useHaptic } from '../../hooks/useHaptic';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  itemCounts?: Record<string, number>;
  className?: string;
}

/**
 * Компонент фильтра по категориям в премиальном стиле
 */
export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
  itemCounts = {},
  className = '',
}) => {
  const haptic = useHaptic();

  const handleCategoryClick = (category: string | null) => {
    onCategoryChange(category);
    haptic.light();
  };

  const totalItems = Object.values(itemCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className={`${className}`}>
      <div className="flex flex-wrap gap-2">
        {/* Кнопка "Все" */}
        <motion.button
          onClick={() => handleCategoryClick(null)}
          className={`
            flex items-center px-4 py-2.5 rounded-xl text-sm font-medium
            transition-all duration-200
            ${
              selectedCategory === null
                ? 'bg-primary-food-700 text-white shadow-md shadow-primary-food-700/30'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-primary-food-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }
          `}
        >
          <span>Все</span>
          {totalItems > 0 && (
            <span className={`
              ml-2 px-2 py-0.5 rounded-full text-xs font-semibold
              ${
                selectedCategory === null
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }
            `}>
              {totalItems}
            </span>
          )}
        </motion.button>

        {/* Кнопки категорий */}
        {categories.map((category, index) => {
          const count = itemCounts[category] || 0;
          const isSelected = selectedCategory === category;

          return (
            <motion.button
              key={category}
              onClick={() => handleCategoryClick(category)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              className={`
                flex items-center px-4 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200
                ${
                  isSelected
                    ? 'bg-primary-food-700 text-white shadow-md shadow-primary-food-700/30'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-primary-food-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }
                ${count === 0 ? 'opacity-40 cursor-not-allowed' : ''}
              `}
              disabled={count === 0}
            >
              {/* Иконка категории */}
              <span className="mr-2 text-base">{getCategoryIcon(category)}</span>
              
              <span className="capitalize">{category}</span>
              
              {/* Счетчик элементов */}
              {count > 0 && (
                <span className={`
                  ml-2 px-2 py-0.5 rounded-full text-xs font-semibold
                  ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }
                `}>
                  {count}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
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
