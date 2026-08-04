import { describe, expect, it } from 'vitest';
import { getAdminGroups, isGroupAdmin, isGroupAdminRole } from '../permissions';
import type { UserGroup } from '@/services/user.service';

/* Права выводятся ИСКЛЮЧИТЕЛЬНО из роли в конкретной группе. Тесты на
   isGlobalAdmin удалены вместе с функцией: глобального администратора больше
   нет ни в базе, ни в ответе сервера, ни в проверках доступа. */

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
  it('решает роль в этой группе, и только она', () => {
    expect(isGroupAdmin(group({ role: 'ADMIN' }))).toBe(true);
    expect(isGroupAdmin(group({ role: 'CREATOR' }))).toBe(true);
    expect(isGroupAdmin(group({ role: 'MEMBER' }))).toBe(false);
  });

  it('без группы прав нет', () => {
    expect(isGroupAdmin(null)).toBe(false);
    expect(isGroupAdmin(undefined)).toBe(false);
  });
});

describe('getAdminGroups', () => {
  const groups = [
    group({ id: 1, role: 'ADMIN' }),
    group({ id: 2, role: 'MEMBER' }),
    group({ id: 3, role: 'CREATOR', isActive: false }),
    group({ id: 4, role: 'creator' }),
  ];

  it('только активные группы с ролью ADMIN или CREATOR', () => {
    expect(getAdminGroups(groups).map(g => g.id)).toEqual([1, 4]);
  });

  it('неактивная группа исключается даже с ролью CREATOR', () => {
    expect(getAdminGroups(groups).some(g => g.id === 3)).toBe(false);
  });

  it('участник без роли администратора не получает ничего', () => {
    expect(getAdminGroups([group({ id: 5, role: 'MEMBER' })])).toEqual([]);
  });
});
