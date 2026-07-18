/* Единый критерий административных прав.
   Глобальный User.isAdmin даёт права везде; роль ADMIN/CREATOR в группе — права
   в этой группе. Страницы, где список групп не загружен, используют
   isGlobalAdmin; переход на per-group критерий — вместе с явным group context
   (фаза 5 плана миграции). */
import type { User } from '@/types/models';
import type { UserGroup } from '@/services/user.service';

type UserLike = Pick<User, 'isAdmin'> | null | undefined;

export function isGlobalAdmin(user: UserLike): boolean {
  return !!user?.isAdmin;
}

export function isGroupAdminRole(role: string | null | undefined): boolean {
  const r = (role ?? '').toUpperCase();
  return r === 'ADMIN' || r === 'CREATOR';
}

export function isGroupAdmin(user: UserLike, group: Pick<UserGroup, 'role'> | null | undefined): boolean {
  return isGlobalAdmin(user) || isGroupAdminRole(group?.role);
}

/** Активные группы, в которых пользователь может выполнять админ-действия. */
export function getAdminGroups(user: UserLike, groups: UserGroup[]): UserGroup[] {
  const active = groups.filter((g) => g.isActive);
  if (isGlobalAdmin(user)) return active;
  return active.filter((g) => isGroupAdminRole(g.role));
}
