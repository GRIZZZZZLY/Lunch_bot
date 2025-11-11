/**
 * VirtualList - Оптимизированный список с виртуализацией
 * 
 * Performance benefits:
 * - Рендерит только видимые элементы (не 1000, а ~10-15)
 * - Уменьшает DOM nodes на 90-95%
 * - Плавная прокрутка даже на слабых устройствах
 * - Меньше memory usage
 * 
 * Use cases:
 * - Длинный список меню (100+ items)
 * - История голосований
 * - Список пользователей
 */

import { FC, ReactElement } from 'react';
// @ts-ignore - types issue with react-window
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { useWindowSize } from 'react-use';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactElement;
  className?: string;
  overscanCount?: number; // Сколько элементов загружать за границами viewport
  emptyState?: ReactElement;
}

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  className = '',
  overscanCount = 3,
  emptyState,
}: VirtualListProps<T>) {
  const { height } = useWindowSize();

  // Если список пустой
  if (items.length === 0) {
    return emptyState || (
      <div className="flex items-center justify-center p-8 text-gray-400 dark:text-gray-400">
        Нет элементов
      </div>
    );
  }

  // Высота списка: viewport - header - bottom navigation
  const listHeight = height - 120; // 60px header + 60px bottom nav

  // Row renderer
  const Row = ({ index, style }: ListChildComponentProps) => {
    const item = items[index];
    return (
      <div style={style} className={className}>
        {renderItem(item, index)}
      </div>
    );
  };

  return (
    <FixedSizeList
      height={listHeight}
      itemCount={items.length}
      itemSize={itemHeight}
      width="100%"
      overscanCount={overscanCount}
      className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
    >
      {Row}
    </FixedSizeList>
  );
}

/**
 * VirtualGrid - Виртуализированная сетка (2-3 колонки)
 * Для карточек меню в grid layout
 */
interface VirtualGridProps<T> {
  items: T[];
  itemHeight: number;
  columns: number;
  renderItem: (item: T, index: number) => ReactElement;
  gap?: number;
}

export function VirtualGrid<T>({
  items,
  itemHeight,
  columns,
  renderItem,
  gap = 16,
}: VirtualGridProps<T>) {
  const { height } = useWindowSize();

  // Группируем items по рядам
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }

  const listHeight = height - 120;
  const rowHeight = itemHeight + gap;

  const Row = ({ index, style }: ListChildComponentProps) => {
    const row = rows[index];
    return (
      <div 
        className="grid gap-4 px-4"
        style={{
          ...style,
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: `${gap}px`,
        }}
      >
        {row.map((item, colIndex) => (
          <div key={index * columns + colIndex}>
            {renderItem(item, index * columns + colIndex)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <FixedSizeList
      height={listHeight}
      itemCount={rows.length}
      itemSize={rowHeight}
      width="100%"
      overscanCount={2}
    >
      {Row}
    </FixedSizeList>
  );
}

// Hook для определения размера окна
