import type { Request, Response } from 'express';
import type { User } from '../../types/database.types';
import { UnauthorizedError } from '../http.errors';

/**
 * Достать пользователя из запроса или ответить 401.
 *
 * Зачем это существует. `req.user` необязателен по типу, потому что
 * `telegramAuthMiddleware` навешивается ПОМАРШРУТНО, а не на весь `/api`. До
 * этого хелпера контроллеры читали `(req as any).user` — 86 приведений в
 * 20 файлах, — и приведение снимало ровно ту проверку, которая нужна: на
 * маршруте, где middleware забыли, обращение к `user.id` даёт 500 вместо 401,
 * причём в логах это выглядит как «сломался контроллер», а не «нет доступа».
 *
 * Возвращает `null`, если ответ уже отправлен, — вызывающему остаётся только
 * выйти. Именно такой контракт был у локального `getAuthUser` в
 * poll.controller.ts; здесь он один на всех.
 *
 * Задача 04 переносит авторизацию (проверку прав на группу) в middleware.
 * Аутентификация — этот файл — её предпосылка, и они не одно и то же:
 * «кто ты» решается здесь, «можно ли тебе» — там.
 */
/**
 * То же самое, но ошибкой, а не ответом.
 *
 * Нужен там, где handler переведён на `next(err)`: ответ формирует
 * `error-handler`, а `if (!user) return;` после каждого вызова — это две строки
 * на handler и ещё одно место, где легко забыть `return`. Статус и код те же
 * (401 `UNAUTHORIZED`), потому что на код опирается переавторизация на фронте.
 */
export function requireAuthUserOrThrow(req: Request): User {
  const user = req.user;

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

export function requireAuthUser(req: Request, res: Response): User | null {
  const user = req.user;

  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  return user;
}
