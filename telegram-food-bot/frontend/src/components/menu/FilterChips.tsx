import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTelegram } from '@/hooks/useTelegram';

interface FilterChipsProps {
  categories: string[];
  categoryCounts: Record<string, number>;
  selectedCategory: string | null;
  onCategorySelect: (category: string | null) => void;
}

/**
 * Горизонтальный скролл чипсов для фильтрации категорий
 */
export function FilterChips({
  categories,
  categoryCounts,
  selectedCategory,
  onCategorySelect
}: FilterChipsProps) {
  const { hapticFeedback } = useTelegram();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Автоскролл к выбранной категории
  useEffect(() => {
    if (selectedCategory && scrollContainerRef.current) {
      const activeChip = scrollContainerRef.current.querySelector('[data-active="true"]');
      if (activeChip) {
        activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedCategory]);

  const handleCategoryClick = (category: string | null) => {
    hapticFeedback?.impactOccurred('light');
    onCategorySelect(category);
  };

  const getCategoryIcon = (category: string): string => {
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
  };

  const totalCount = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="relative">
      {/* Горизонтальный скролл */}
      <div
        ref={scrollContainerRef}
        role="radiogroup"
        aria-label="Категории меню"
        className="flex gap-2 overflow-x-auto overflow-y-hidden pb-2 scrollbar-hide scroll-smooth"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Chip "Все" */}
        <motion.button
          role="radio"
          aria-checked={!selectedCategory}
          onClick={() => handleCategoryClick(null)}
          data-active={!selectedCategory}
          whileTap={{ scale: 0.95 }}
          className={`
            flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full font-medium text-sm
            transition-all duration-200 min-h-[44px]
            ${!selectedCategory
              ? 'bg-mint-500 text-white shadow-lg shadow-mint-500/30'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }
          `}
        >
          <span aria-hidden="true">🍽️</span>
          <span>Все</span>
          <span className="text-xs opacity-75">({totalCount})</span>
        </motion.button>

        {/* Chips категорий */}
        {categories.map((category) => {
          const count = categoryCounts[category] || 0;
          const isActive = selectedCategory === category;

          return (
            <motion.button
              key={category}
              role="radio"
              aria-checked={isActive}
              onClick={() => handleCategoryClick(category)}
              data-active={isActive}
              whileTap={{ scale: 0.95 }}
              className={`
                flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full font-medium text-sm
                transition-all duration-200 min-h-[44px]
                ${isActive
                  ? 'bg-mint-500 text-white shadow-lg shadow-mint-500/30'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }
              `}
            >
              <span aria-hidden="true">{getCategoryIcon(category)}</span>
              <span className="whitespace-nowrap">{category}</span>
              <span className="text-xs opacity-75">({count})</span>
            </motion.button>
          );
        })}
      </div>

      {/* Gradient overlay для индикации скролла */}
      <div className="absolute top-0 right-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
    </div>
  );
}

// Hide scrollbar CSS
const style = document.createElement('style');
style.textContent = `
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;
document.head.appendChild(style);
