import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useUserGroups } from './queries/useUserQueries';
import type { UserGroup } from '../types/auth.types';

export function useCurrentGroup(): {
  currentGroupId: number | null;
  groups: UserGroup[];
  currentGroup: UserGroup | null;
} {
  const currentGroupId = useAppStore((s) => s.currentGroupId);
  const setCurrentGroupId = useAppStore((s) => s.setCurrentGroupId);
  const { data: groups = [], isSuccess } = useUserGroups();

  useEffect(() => {
    if (groups.length === 0) {
      if (isSuccess && currentGroupId !== null) {
        setCurrentGroupId(null);
      }
      return;
    }

    const valid = currentGroupId != null && groups.some((g) => g.id === currentGroupId);
    if (!valid) setCurrentGroupId(groups[0].id);
  }, [groups, isSuccess, currentGroupId, setCurrentGroupId]);

  const currentGroup = groups.find((g) => g.id === currentGroupId) ?? null;
  return { currentGroupId, groups, currentGroup };
}
