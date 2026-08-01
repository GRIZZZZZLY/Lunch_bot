/* Roving tabindex для горизонтальных наборов (tablist, radiogroup).
   Стрелки двигают фокус, активация остаётся за Enter/Space: выбор здесь
   часто дёргает сеть (смена группы перезапрашивает меню), и «выбор следует
   за фокусом» рассылал бы лишние запросы при простом проходе стрелками.
   В набор ведёт одна остановка табуляции — активный элемент. */
import { useCallback, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

export interface RovingItemProps {
  ref: (el: HTMLElement | null) => void;
  tabIndex: 0 | -1;
  onKeyDown: (event: ReactKeyboardEvent) => void;
  onFocus: () => void;
}

/**
 * @param count число элементов набора
 * @param activeIndex индекс выбранного элемента; -1, если выбора нет
 */
export function useRovingFocus(count: number, activeIndex: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const tabbable = activeIndex >= 0 ? activeIndex : Math.min(focusIndex, Math.max(count - 1, 0));

  const getItemProps = useCallback(
    (index: number): RovingItemProps => ({
      ref: (el) => {
        refs.current[index] = el;
      },
      tabIndex: index === tabbable ? 0 : -1,
      onFocus: () => setFocusIndex(index),
      onKeyDown: (event) => {
        const step =
          event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              ? -1
              : 0;
        const jump = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null;
        if (step === 0 && jump === null) return;
        event.preventDefault();
        const next = jump ?? (index + step + count) % count;
        setFocusIndex(next);
        refs.current[next]?.focus();
      },
    }),
    [count, tabbable],
  );

  return { getItemProps };
}
