import { useAppStore } from '@/store/useAppStore';

export function useAuth() {
  const user = useAppStore((s) => s.user);
  const status = useAppStore((s) => s.authStatus);
  const error = useAppStore((s) => s.authError);

  return {
    user,
    status,
    error,
    isAuthenticated: status === 'authenticated' && !!user,
    isLoading: status === 'authenticating' || status === 'idle',
  };
}
