import { describe, expect, it } from 'vitest';
import { getAdminGroups, isGlobalAdmin, isGroupAdmin, isGroupAdminRole } from '../permissions';
import type { UserGroup } from '@/services/user.service';

function group(overrides: Partial<UserGroup>): UserGroup {
  return {
    id: 1,
    title: 'Группа',
    telegramId: '-100',
    type: 'group',
    isActive: true,
    role: 'MEMBER',
    ...overrides,
  };
}

describe('isGlobalAdmin', () => {
  it('true только при явном флаге', () => {
    expect(isGlobalAdmin({ isAdmin: true })).toBe(true);
    expect(isGlobalAdmin({ isAdmin: false })).toBe(false);
    expect(isGlobalAdmin(null)).toBe(false);
    expect(isGlobalAdmin(undefined)).toBe(false);
  });
});

describe('isGroupAdminRole', () => {
  it('ADMIN и CREATOR в любом регистре', () => {
    expect(isGroupAdminRole('ADMIN')).toBe(true);
    expect(isGroupAdminRole('creator')).toBe(true);
    expect(isGroupAdminRole('MEMBER')).toBe(false);
    expect(isGroupAdminRole(null)).toBe(false);
    expect(isGroupAdminRole(undefined)).toBe(false);
  });
});

describe('isGroupAdmin', () => {
  it('глобальный админ — админ в любой группе', () => {
    expect(isGroupAdmin({ isAdmin: true }, group({ role: 'MEMBER' }))).toBe(true);
  });
  it('роль в группе даёт права без глобального флага', () => {
    expect(isGroupAdmin({ isAdmin: false }, group({ role: 'ADMIN' }))).toBe(true);
    expect(isGroupAdmin({ isAdmin: false }, group({ role: 'MEMBER' }))).toBe(false);
  });
});

describe('getAdminGroups', () => {
  const groups = [
    group({ id: 1, role: 'ADMIN' }),
    group({ id: 2, role: 'MEMBER' }),
    group({ id: 3, role: 'CREATOR', isActive: false }),
    group({ id: 4, role: 'creator' }),
  ];

  it('глобальному админу — все активные группы', () => {
    expect(getAdminGroups({ isAdmin: true }, groups).map((g) => g.id)).toEqual([1, 2, 4]);
  });

  it('обычному пользователю — только активные с ролью ADMIN/CREATOR', () => {
    expect(getAdminGroups({ isAdmin: false }, groups).map((g) => g.id)).toEqual([1, 4]);
  });

  it('неактивные группы исключаются даже с ролью', () => {
    expect(getAdminGroups({ isAdmin: false }, groups).some((g) => g.id === 3)).toBe(false);
  });
});
