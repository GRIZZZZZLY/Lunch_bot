import { create } from 'zustand';
import type { User } from '@/types/models';
import { writePreferredGroupId } from '@/lib/groupPreference';

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'error';

export interface AppState {
  user: User | null;
  authStatus: AuthStatus;
  authError: string | null;
  currentGroupId: string | null;

  setUser: (user: User | null) => void;
  setAuthStatus: (status: AuthStatus) => void;
  setAuthError: (error: string | null) => void;
  setCurrentGroupId: (groupId: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authStatus: 'idle',
  authError: null,
  currentGroupId: null,

  setUser: (user) => set({ user }),
  setAuthStatus: (authStatus) => set({ authStatus }),
  setAuthError: (authError) => set({ authError }),
  /* Выбор запоминается здесь, а не у переключателя: тогда он сохраняется при
     любом способе смены команды, а не только из того экрана, где сейчас есть
     список. Привязка к пользователю — в groupPreference. */
  setCurrentGroupId: (currentGroupId) => {
    set({ currentGroupId });
    const userId = get().user?.id;
    if (userId !== undefined && currentGroupId !== null) {
      writePreferredGroupId(userId, currentGroupId);
    }
  },
  /* Сохранённый выбор при сбросе НЕ стирается: это выход из сессии, а не
     отказ от команды. Следующий вход того же человека откроется там же. */
  reset: () =>
    set({
      user: null,
      authStatus: 'idle',
      authError: null,
      currentGroupId: null,
    }),
}));
