/**
 * Undo/Redo Hook
 * P2 Task: Undo/Redo для критичных действий
 * 
 * Позволяет отменять и повторять действия
 */

import { useState, useCallback, useRef } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseUndoOptions<T> {
  maxHistorySize?: number;
  onUndo?: (state: T) => void;
  onRedo?: (state: T) => void;
}

/**
 * useUndo hook для undo/redo функционала
 * 
 * @example
 * ```tsx
 * const { state, setState, undo, redo, canUndo, canRedo } = useUndo({
 *   initialState: [],
 *   maxHistorySize: 20,
 * });
 * ```
 */
export function useUndo<T>(
  initialState: T,
  options: UseUndoOptions<T> = {}
) {
  const { maxHistorySize = 50, onUndo, onRedo } = options;

  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  /**
   * Set new state и добавляем в history
   */
  const setState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      setHistory((currentHistory) => {
        const newPresent = typeof newState === 'function'
          ? (newState as (prev: T) => T)(currentHistory.present)
          : newState;

        // Если state не изменился - не добавляем в history
        if (newPresent === currentHistory.present) {
          return currentHistory;
        }

        const newPast = [...currentHistory.past, currentHistory.present];

        // Ограничиваем размер history
        if (newPast.length > maxHistorySize) {
          newPast.shift();
        }

        return {
          past: newPast,
          present: newPresent,
          future: [], // clear future при новом изменении
        };
      });
    },
    [maxHistorySize]
  );

  /**
   * Отменить последнее изменение
   */
  const undo = useCallback(() => {
    if (!canUndo) return;

    setHistory((currentHistory) => {
      const previous = currentHistory.past[currentHistory.past.length - 1];
      const newPast = currentHistory.past.slice(0, -1);

      if (onUndo) {
        onUndo(previous);
      }

      return {
        past: newPast,
        present: previous,
        future: [currentHistory.present, ...currentHistory.future],
      };
    });
  }, [canUndo, onUndo]);

  /**
   * Повторить отмененное изменение
   */
  const redo = useCallback(() => {
    if (!canRedo) return;

    setHistory((currentHistory) => {
      const next = currentHistory.future[0];
      const newFuture = currentHistory.future.slice(1);

      if (onRedo) {
        onRedo(next);
      }

      return {
        past: [...currentHistory.past, currentHistory.present],
        present: next,
        future: newFuture,
      };
    });
  }, [canRedo, onRedo]);

  /**
   * Очистить всю history
   */
  const clear = useCallback(() => {
    setHistory({
      past: [],
      present: history.present,
      future: [],
    });
  }, [history.present]);

  /**
   * Reset к начальному состоянию
   */
  const reset = useCallback(() => {
    setHistory({
      past: [],
      present: initialState,
      future: [],
    });
  }, [initialState]);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    reset,
    history: {
      past: history.past.length,
      future: history.future.length,
    },
  };
}

/**
 * Hook для undo/redo с таймером автосохранения
 * Автоматически сохраняет state через определенное время
 * 
 * @example
 * ```tsx
 * const { state, setState, undo, redo } = useUndoWithAutoSave({
 *   initialState: [],
 *   autoSaveDelay: 2000, // 2 секунды
 * });
 * ```
 */
export function useUndoWithAutoSave<T>(
  initialState: T,
  options: UseUndoOptions<T> & { autoSaveDelay?: number } = {}
) {
  const { autoSaveDelay = 1000, ...undoOptions } = options;
  
  const undo = useUndo(initialState, undoOptions);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const pendingStateRef = useRef<T | null>(null);

  /**
   * Set state с debounce
   * Накапливает изменения и сохраняет через autoSaveDelay
   */
  const setStateDebounced = useCallback(
    (newState: T | ((prev: T) => T)) => {
      // Применяем изменение сразу (для UI)
      const nextState = typeof newState === 'function'
        ? (newState as (prev: T) => T)(undo.state)
        : newState;
      
      pendingStateRef.current = nextState;

      // Очищаем предыдущий таймер
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Сохраняем в history через delay
      timeoutRef.current = setTimeout(() => {
        if (pendingStateRef.current !== null) {
          undo.setState(pendingStateRef.current);
          pendingStateRef.current = null;
        }
      }, autoSaveDelay);
    },
    [undo, autoSaveDelay]
  );

  return {
    ...undo,
    setState: setStateDebounced,
  };
}

/**
 * Пример использования с MenuPage
 */
export function useMenuItemsWithUndo() {
  const {
    state: menuItems,
    setState: setMenuItems,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndo<unknown[]>([], {
    maxHistorySize: 20,
    onUndo: (state) => {
      console.log('Undo to state:', state.length, 'items');
    },
    onRedo: (state) => {
      console.log('Redo to state:', state.length, 'items');
    },
  });

  return {
    menuItems,
    setMenuItems,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
