/**
 * Проверки доступа к голосованиям, общие для всех handler'ов `/api/polls`.
 *
 * Раньше это были две локальные функции в контроллере, возвращавшие `boolean`,
 * и на каждый вызов приходилось `if (!hasAccess) return;` — две строки, в
 * которых легко забыть `return` и продолжить исполнение после ответа. Здесь они
 * бросают ошибку с готовым статусом (`api/http.errors.ts`), поэтому в handler'е
 * остаётся одна строка.
 *
 * Ключевое правило, и оно не косметическое: права проверяются по группе САМОГО
 * ресурса, а не по `groupId` из запроса. Подмена параметра иначе давала доступ
 * к чужой группе — ровно та утечка, которую закрыл `9829d5c8`.
 *
 * Задача 04 переносит авторизацию в middleware маршрута; когда это случится,
 * этот файл станет её внутренностями или исчезнет. До тех пор он — единственное
 * место, где живут эти правила для голосований.
 */
import type { Request } from 'express';

import type { User } from '../../types/database.types';
import { GroupService } from '../../services/group.service';
import { PollNotFoundError } from '../../services/poll.errors';
import { requireAuthUserOrThrow } from '../middleware/require-auth-user';
import { AccessDeniedError } from '../http.errors';
import { PollQueryService } from '../../services/poll-query.service';

/** Участник группы — иначе 401 или 403. */
export async function assertGroupMember(
  req: Request,
  groupId: number
): Promise<User> {
  const user = requireAuthUserOrThrow(req);

  if (!(await GroupService.isUserGroupMember(user.id, groupId))) {
    throw new AccessDeniedError();
  }

  return user;
}

/** Администратор группы — иначе 401 или 403. */
export async function assertGroupAdmin(
  req: Request,
  groupId: number
): Promise<User> {
  const user = requireAuthUserOrThrow(req);

  if (!(await GroupService.isUserGroupAdmin(user.id, groupId))) {
    throw new AccessDeniedError();
  }

  return user;
}

/**
 * Группы, которые человек имеет право видеть.
 *
 * `undefined` означало «фильтра нет, видно всё» и выдавалось по глобальному
 * флагу администратора. Понятия глобального администратора больше нет: выборка
 * всегда сужена до групп самого человека.
 */
export async function accessibleGroupIds(req: Request): Promise<number[]> {
  const user = requireAuthUserOrThrow(req);

  const memberships = await GroupService.getGroupsForUser(user.id, true);
  return Array.from(new Set(memberships.map(member => member.groupId)));
}

/**
 * Область выборки для эндпоинтов «моё или одной группы»: либо конкретная
 * группа (после проверки членства), либо все группы человека.
 */
export async function groupScope(
  req: Request,
  groupId?: number
): Promise<number | number[]> {
  if (groupId === undefined) return accessibleGroupIds(req);

  await assertGroupMember(req, groupId);
  return groupId;
}

/**
 * Голосование существует и человек в его группе.
 *
 * Аутентификация — первой, до чтения из БД: анонимный запрос не должен
 * узнавать, существует ли голосование.
 */
export async function assertPollMember(
  req: Request,
  pollId: number
): Promise<{ user: User; groupId: number }> {
  const user = requireAuthUserOrThrow(req);

  const groupId = await PollQueryService.getPollGroupId(pollId);
  if (!groupId) throw new PollNotFoundError();

  if (!(await GroupService.isUserGroupMember(user.id, groupId))) {
    throw new AccessDeniedError();
  }

  return { user, groupId };
}

/** То же для действий администратора: завершить, отменить, рулетка. */
export async function assertPollAdmin(
  req: Request,
  pollId: number
): Promise<{ user: User; groupId: number }> {
  const user = requireAuthUserOrThrow(req);

  const groupId = await PollQueryService.getPollGroupId(pollId);
  if (!groupId) throw new PollNotFoundError();

  if (!(await GroupService.isUserGroupAdmin(user.id, groupId))) {
    throw new AccessDeniedError();
  }

  return { user, groupId };
}
