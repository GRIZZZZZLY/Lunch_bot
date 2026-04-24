import { create } from 'zustand';
import type { User } from '@/types/models';

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

export const useAppStore = create<AppState>((set) => ({
  user: null,
  authStatus: 'idle',
  authError: null,
  currentGroupId: null,

  setUser: (user) => set({ user }),
  setAuthStatus: (authStatus) => set({ authStatus }),
  setAuthError: (authError) => set({ authError }),
  setCurrentGroupId: (currentGroupId) => set({ currentGroupId }),
  reset: () =>
    set({
      user: null,
      authStatus: 'idle',
      authError: null,
      currentGroupId: null,
    }),
}));
