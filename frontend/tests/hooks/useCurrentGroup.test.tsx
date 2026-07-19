import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentGroup } from '../../src/hooks/useCurrentGroup';
import { useAppStore } from '../../src/store/useAppStore';
import type { UserGroup } from '../../src/types/auth.types';

const { useUserGroupsMock } = vi.hoisted(() => ({
  useUserGroupsMock: vi.fn(),
}));

vi.mock('../../src/hooks/queries/useUserQueries', () => ({
  useUserGroups: useUserGroupsMock,
}));

const group = (id: number): UserGroup => ({
  id,
  title: `Group ${id}`,
  role: 'MEMBER',
  isActive: true,
});

describe('useCurrentGroup', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useAppStore.getState().reset();
    useUserGroupsMock.mockReset();
  });

  it('selects the first available group when no current group is saved', async () => {
    useUserGroupsMock.mockReturnValue({
      data: [group(1), group(2)],
      isSuccess: true,
    });

    const { result } = renderHook(() => useCurrentGroup());

    await waitFor(() => {
      expect(result.current.currentGroupId).toBe(1);
    });
    expect(result.current.currentGroup?.title).toBe('Group 1');
  });

  it('clears stale current group when the loaded group list is empty', async () => {
    useAppStore.getState().setCurrentGroupId(99);
    useUserGroupsMock.mockReturnValue({
      data: [],
      isSuccess: true,
    });

    const { result } = renderHook(() => useCurrentGroup());

    await waitFor(() => {
      expect(result.current.currentGroupId).toBeNull();
    });
    expect(result.current.currentGroup).toBeNull();
  });
});
