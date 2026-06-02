import type { UserGroup } from '../types/auth.types';

/**
 * Группы, где текущий пользователь — админ группы (ADMIN или CREATOR).
 * Используется для мультивыбора при создании блюда: чужие группы не показываем.
 * Глобальный User.isAdmin здесь НЕ учитывается — доступ к группе только по роли.
 */
export function getAdminGroups(groups: UserGroup[]): UserGroup[] {
  return groups.filter((group) => group.role === 'ADMIN' || group.role === 'CREATOR');
}
