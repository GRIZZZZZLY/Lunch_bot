import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { devtools, persist } from 'zustand/middleware';
import type { User } from '../types/auth.types';
import type { MenuItem } from '../services/menu.service';

export interface Poll {
  id: number;
  groupId: number;
  title?: string;
  description?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  duration: number;
  startedAt: string;
  endedAt?: string;
  endTime?: string;
  messageId?: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    votes: number;
  };
}

export interface PollResult {
  id: number;
  pollId: number;
  winnerItemId?: number;
  responsibleId?: number;
  totalVotes: number;
  isRouletteRun: boolean;
  createdAt: string;
  winnerItem?: MenuItem;
  responsible?: User;
}

export interface Vote {
  id: number;
  pollId: number;
  userId: number;
  menuItemId: number;
  createdAt: string;
  user: User;
  menuItem: MenuItem;
}

export interface AppState {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  
  // Menu state
  menuItems: MenuItem[];
  selectedCategory: string | null;
  menuLoading: boolean;
  
  // Poll state
  currentPoll: Poll | null;
  polls: Poll[];
  votes: Vote[];
  pollResults: PollResult[];
  pollsLoading: boolean;
  
  // Group state
  currentGroupId: number | null;

  // UI state
  loading: boolean;
  error: string | null;
  theme: 'light' | 'dark';
  
  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    timestamp: number;
  }>;
}

export interface AppActions {
  // Auth actions
  setUser: (user: User | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  
  // Menu actions
  setMenuItems: (items: MenuItem[]) => void;
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (id: number, updates: Partial<MenuItem>) => void;
  removeMenuItem: (id: number) => void;
  setSelectedCategory: (category: string | null) => void;
  setMenuLoading: (loading: boolean) => void;
  
  // Poll actions
  setCurrentPoll: (poll: Poll | null) => void;
  setPolls: (polls: Poll[]) => void;
  addPoll: (poll: Poll) => void;
  updatePoll: (id: number, updates: Partial<Poll>) => void;
  setVotes: (votes: Vote[]) => void;
  addVote: (vote: Vote) => void;
  updateVote: (pollId: number, userId: number, menuItemId: number) => void;
  setPollResults: (results: PollResult[]) => void;
  addPollResult: (result: PollResult) => void;
  setPollsLoading: (loading: boolean) => void;
  
  // Group actions
  setCurrentGroupId: (id: number | null) => void;

  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  
  // Notification actions
  addNotification: (notification: Omit<AppState['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Combined actions
  reset: () => void;
}

export interface UISlice {
  loading: boolean;
  error: string | null;
  theme: 'light' | 'dark';
  notifications: AppState['notifications'];
  setLoading: AppActions['setLoading'];
  setError: AppActions['setError'];
  setTheme: AppActions['setTheme'];
  addNotification: AppActions['addNotification'];
  removeNotification: AppActions['removeNotification'];
  clearNotifications: AppActions['clearNotifications'];
}

const initialState: AppState = {
  // Auth
  user: null,
  isAuthenticated: false,
  
  // Menu
  menuItems: [],
  selectedCategory: null,
  menuLoading: false,
  
  // Poll
  currentPoll: null,
  polls: [],
  votes: [],
  pollResults: [],
  pollsLoading: false,
  
  // Group
  currentGroupId: null,

  // UI
  loading: false,
  error: null,
  theme: 'light',
  
  // Notifications
  notifications: [],
};

export const useAppStore = create<AppState & AppActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        // Auth actions
        setUser: (user) => set({ user }),
        setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
        
        // Menu actions
        setMenuItems: (menuItems) => set({ menuItems }),
        addMenuItem: (item) => set((state) => ({ 
          menuItems: [...state.menuItems, item] 
        })),
        updateMenuItem: (id, updates) => set((state) => ({ 
          menuItems: state.menuItems.map(item => 
            item.id === id ? { ...item, ...updates } : item
          ) 
        })),
        removeMenuItem: (id) => set((state) => ({ 
          menuItems: state.menuItems.filter(item => item.id !== id) 
        })),
        setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
        setMenuLoading: (menuLoading) => set({ menuLoading }),
        
        // Poll actions
        setCurrentPoll: (currentPoll) => set({ currentPoll }),
        setPolls: (polls) => set({ polls }),
        addPoll: (poll) => set((state) => ({ 
          polls: [poll, ...state.polls] 
        })),
        updatePoll: (id, updates) => set((state) => {
          const updatedPolls = state.polls.map(poll => 
            poll.id === id ? { ...poll, ...updates } : poll
          );
          const updatedCurrentPoll = state.currentPoll?.id === id 
            ? { ...state.currentPoll, ...updates } 
            : state.currentPoll;
          return { 
            polls: updatedPolls, 
            currentPoll: updatedCurrentPoll 
          };
        }),
        setVotes: (votes) => set({ votes }),
        addVote: (vote) => set((state) => {
          // Удаляем предыдущий голос пользователя в этом голосовании, если есть
          const filteredVotes = state.votes.filter(v => 
            !(v.pollId === vote.pollId && v.userId === vote.userId)
          );
          return { votes: [...filteredVotes, vote] };
        }),
        updateVote: (pollId, userId, menuItemId) => set((state) => ({
          votes: state.votes.map(vote =>
            vote.pollId === pollId && vote.userId === userId
              ? { ...vote, menuItemId }
              : vote
          )
        })),
        setPollResults: (pollResults) => set({ pollResults }),
        addPollResult: (result) => set((state) => ({ 
          pollResults: [result, ...state.pollResults] 
        })),
        setPollsLoading: (pollsLoading) => set({ pollsLoading }),
        
        // Group actions
        setCurrentGroupId: (currentGroupId) => set({ currentGroupId }),

        // UI actions
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error }),
        setTheme: (theme) =>
          set((state) => (state.theme === theme ? state : { theme })),
        
        // Notification actions
        addNotification: (notification) => {
          const id = Date.now().toString();
          const timestamp = Date.now();
          const newNotification = { ...notification, id, timestamp };
          
          set((state) => ({
            notifications: [...state.notifications, newNotification]
          }));
          
          // Auto-remove after 5 seconds
          setTimeout(() => {
            get().removeNotification(id);
          }, 5000);
        },
        removeNotification: (id) => set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id)
        })),
        clearNotifications: () => set({ notifications: [] }),
        
        // Combined actions
        reset: () => set(initialState),
      }),
      {
        name: 'telegram-food-bot-store',
        partialize: (state) => ({
          // Сохраняем только необходимые данные
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          theme: state.theme,
          menuItems: state.menuItems,
          selectedCategory: state.selectedCategory,
          currentGroupId: state.currentGroupId,
        }),
      }
    ),
    {
      name: 'telegram-food-bot',
    }
  )
);

// Селекторы для удобства
export const useAuth = () =>
  useAppStore(
    useShallow(
    (state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      setUser: state.setUser,
      setAuthenticated: state.setAuthenticated,
    })
    )
  );

export const useMenu = () =>
  useAppStore(
    useShallow(
    (state) => ({
      menuItems: state.menuItems,
      selectedCategory: state.selectedCategory,
      menuLoading: state.menuLoading,
      setMenuItems: state.setMenuItems,
      addMenuItem: state.addMenuItem,
      updateMenuItem: state.updateMenuItem,
      removeMenuItem: state.removeMenuItem,
      setSelectedCategory: state.setSelectedCategory,
      setMenuLoading: state.setMenuLoading,
    })
    )
  );

export const usePolls = () =>
  useAppStore(
    useShallow(
    (state) => ({
      currentPoll: state.currentPoll,
      polls: state.polls,
      votes: state.votes,
      pollResults: state.pollResults,
      pollsLoading: state.pollsLoading,
      setCurrentPoll: state.setCurrentPoll,
      setPolls: state.setPolls,
      addPoll: state.addPoll,
      updatePoll: state.updatePoll,
      setVotes: state.setVotes,
      addVote: state.addVote,
      updateVote: state.updateVote,
      setPollResults: state.setPollResults,
      addPollResult: state.addPollResult,
      setPollsLoading: state.setPollsLoading,
    })
    )
  );

export const useUI = (): UISlice =>
  useAppStore(
    useShallow(
    (state) => ({
      loading: state.loading,
      error: state.error,
      theme: state.theme,
      notifications: state.notifications,
      setLoading: state.setLoading,
      setError: state.setError,
      setTheme: state.setTheme,
      addNotification: state.addNotification,
      removeNotification: state.removeNotification,
      clearNotifications: state.clearNotifications,
    })
    )
  );
