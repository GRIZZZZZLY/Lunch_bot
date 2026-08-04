/* Единый критерий административных прав: роль ADMIN или CREATOR в конкретной
   группе, и ничего кроме.

   Глобального администратора больше нет. Прежний `isGlobalAdmin` читал
   User.isAdmin — колонку, которую сервер больше не присылает и не спрашивает ни
   в одной проверке доступа. Пока она существовала, на одном ресурсе жили две
   системы прав: интерфейс рисовал кнопки по глобальному флагу, а сервер
   отвечал по роли в группе. Расхождение давало не ошибку, а пустой список или
   403 на собственной очереди модерации. */
import type { UserGroup } from '@/services/user.service';

export function isGroupAdminRole(role: string | null | undefined): boolean {
  const r = (role ?? '').toUpperCase();
  return r === 'ADMIN' || r === 'CREATOR';
}

export function isGroupAdmin(
  group: Pick<UserGroup, 'role'> | null | undefined
): boolean {
  return isGroupAdminRole(group?.role);
}

/** Активные группы, в которых пользователь может выполнять админ-действия. */
export function getAdminGroups(groups: UserGroup[]): UserGroup[] {
  return groups.filter(g => g.isActive && isGroupAdminRole(g.role));
}
