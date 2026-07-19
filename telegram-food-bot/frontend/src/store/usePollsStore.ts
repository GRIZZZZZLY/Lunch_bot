import { create } from 'zustand';
import { pollsService } from '../services/polls.service';

interface PollsState {
  // Active polls count для badge
  activeCount: number;
  lastUpdate: number | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  updateActiveCount: () => Promise<void>;
  reset: () => void;
}

/**
 * Polls Store - централизованное управление счетчиками активных голосований
 * 
 * Используется для:
 * - Badge на иконке Vote в BottomNavigation
 * - Отображение количества активных голосований
 * 
 * Auto-update: каждые 30 секунд (настраивается)
 */
export const usePollsStore = create<PollsState>((set, get) => ({
  activeCount: 0,
  lastUpdate: null,
  isLoading: false,
  error: null,
  
  updateActiveCount: async () => {
    // Prevent multiple simultaneous requests
    if (get().isLoading) {
      console.log('[PollsStore] Update already in progress, skipping...');
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      console.log('[PollsStore] Fetching active polls count...');
      const response = await pollsService.getActivePolls();
      
      if (response.success && response.data) {
        const count = response.data.length;
        console.log('[PollsStore] Active polls count:', count);
        
        set({
          activeCount: count,
          lastUpdate: Date.now(),
          isLoading: false,
          error: null,
        });
      } else {
        console.warn('[PollsStore] Failed to fetch active polls:', response.error);
        set({
          isLoading: false,
          error: response.error || 'Failed to fetch active polls',
        });
      }
    } catch (error) {
      console.error('[PollsStore] Error fetching active polls:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
  
  reset: () => {
    console.log('[PollsStore] Resetting state');
    set({
      activeCount: 0,
      lastUpdate: null,
      isLoading: false,
      error: null,
    });
  },
}));

// Auto-update механизм (опционально, можно включить/выключить)
let autoUpdateInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Запустить автоматическое обновление счетчика
 * @param intervalMs - интервал обновления в миллисекундах (по умолчанию 30 секунд)
 */
export const startPollsAutoUpdate = (intervalMs: number = 60000) => {
  if (autoUpdateInterval) {
    console.log('[PollsStore] Auto-update already running');
    return;
  }
  
  console.log('[PollsStore] Starting auto-update with interval:', intervalMs);
  
  // Initial update
  void usePollsStore.getState().updateActiveCount();
  
  // Periodic updates
  autoUpdateInterval = setInterval(() => {
    void usePollsStore.getState().updateActiveCount();
  }, intervalMs);
};

/**
 * Остановить автоматическое обновление
 */
export const stopPollsAutoUpdate = () => {
  if (autoUpdateInterval) {
    console.log('[PollsStore] Stopping auto-update');
    clearInterval(autoUpdateInterval);
    autoUpdateInterval = null;
  }
};

/**
 * Хук для удобного доступа к active count
 */
export const useActivePollsCount = () => {
  const activeCount = usePollsStore((state) => state.activeCount);
  const isLoading = usePollsStore((state) => state.isLoading);
  const updateActiveCount = usePollsStore((state) => state.updateActiveCount);
  
  return {
    activeCount,
    isLoading,
    updateActiveCount,
  };
};
