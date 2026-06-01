import { useAuth } from './useAuth';
import { useCurrentGroup } from './useCurrentGroup';

export function useIsGroupAdmin(): boolean {
  const { user } = useAuth();
  const { currentGroup } = useCurrentGroup();
  if (user?.isAdmin) return true; // global super-admin
  return currentGroup?.role === 'ADMIN' || currentGroup?.role === 'CREATOR';
}
