import { describe, it, expect } from 'vitest';
import { getAdminGroups } from '../../src/lib/groups';
import type { UserGroup } from '../../src/types/auth.types';

const g = (id: number, role: UserGroup['role']): UserGroup => ({
  id,
  title: `G${id}`,
  role,
  isActive: true,
});

describe('getAdminGroups', () => {
  it('keeps only ADMIN and CREATOR groups', () => {
    const groups = [g(1, 'CREATOR'), g(2, 'ADMIN'), g(3, 'MEMBER')];
    expect(getAdminGroups(groups).map((x) => x.id)).toEqual([1, 2]);
  });

  it('returns empty when the user admins nothing', () => {
    expect(getAdminGroups([g(1, 'MEMBER')])).toEqual([]);
  });

  it('handles empty input', () => {
    expect(getAdminGroups([])).toEqual([]);
  });
});
