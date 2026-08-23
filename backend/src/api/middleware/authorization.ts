import type { Request, Response, NextFunction } from 'express';
import { CategoryOrderService } from '../../services/category-order.service';
import { GroupService } from '../../services/group.service';
import { OrderCalculationService } from '../../services/order-calculation.service';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';
import { PollQueryService } from '../../services/poll-query.service';

/**
 * Авторизация ресурсов опроса и категорийного заказа.
 *
 * До этого модуля правило доступа существовало в трёх вариантах — на маршруте
 * (`requireGroupAdmin`), в `poll.controller` (`requireGroupMember`) и в
 * `category-order.controller` (`canAccessPoll`, причём с прямым обращением к
 * Prisma из HTTP-слоя). Правила обновлялись по одному, а расхождение между
 * ними и есть типовая причина утечки данных между группами.
 *
 * Что здесь НЕ делается, и это осознанно:
 *
 * - **Коды и тела ответов не меняются.** Они умышленно повторяют то, что
 *   отдавали снятые проверки в контроллерах: `403 FORBIDDEN` с тем же текстом.
 *   Приведение форм отказа к одному виду — предмет задачи 03, у неё словарь
 *   кодов, а фронт ветвится по `code`.
 * - **Аутентификацию эти middleware не делают.** Все они читают `req.user` и
 *   обязаны стоять ПОСЛЕ `telegramAuthMiddleware`. Отсутствие пользователя
 *   здесь означает ошибку сборки цепочки, поэтому отвечается 401 и пишется в
 *   лог как предупреждение — молча пропускать нельзя.
 */

/** Ответ «нет доступа» ровно в той форме, что отдавали снятые проверки. */
function denyForbidden(res: Response, error: string): void {
  res.status(403).json({
    success: false,
    error,
    code: 'FORBIDDEN',
  });
}

function denyUnauthenticated(res: Response, where: string): void {
  logger.warn(`${where}: middleware авторизации вызван без аутентификации`);
  res.status(401).json({
    success: false,
    error: 'Unauthorized',
    code: 'UNAUTHORIZED',
  });
}

/** Числовой параметр маршрута; `null`, если он отсутствует или испорчен. */
function numericParam(req: Request, key: string): number | null {
  const raw = getParam(req.params, key);
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Участник группы, которой принадлежит `:pollId`.
 *
 * Заменяет `category-order.controller.canAccessPoll`, где то же правило было
 * написано двумя запросами Prisma. Теперь оно собрано из уже существующих
 * `PollQueryService.getPollGroupId` и `GroupService.isUserGroupMember` — а значит
 * проверка на `isActive` у членства ровно одна на весь проект.
 */
export async function requirePollAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      denyUnauthenticated(res, 'requirePollAccess');
      return;
    }

    /* Код именно `INVALID_POLL_ID`, а не общий `INVALID_ID`: так отвечал
       контроллер до переноса, а фронт ветвится по `code`. */
    const pollId = numericParam(req, 'pollId');
    if (pollId === null) {
      res.status(400).json({
        success: false,
        error: 'Invalid pollId',
        code: 'INVALID_POLL_ID',
      });
      return;
    }

    const groupId = await PollQueryService.getPollGroupId(pollId);
    if (groupId === null) {
      /* Опроса нет. Отвечаем 403, а не 404, намеренно: 404 сообщал бы
         постороннему, что такого опроса не существует, то есть позволял бы
         перебором узнавать существующие id чужих групп. */
      denyForbidden(res, 'Access denied');
      return;
    }

    if (!(await GroupService.isUserGroupMember(user.id, groupId))) {
      denyForbidden(res, 'Access denied');
      return;
    }

    next();
  } catch (error) {
    logger.error('requirePollAccess error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Участник группы опроса, которому принадлежит категорийный заказ `:id`.
 *
 * Отличается от `requirePollAccess` только тем, откуда берётся опрос: там он в
 * `:pollId`, здесь выводится из категории. Отдельная функция, а не параметр:
 * два разных источника id в одном middleware — это ровно то место, где
 * следующая правка добавит третий и перестанет быть понятно, что проверяется.
 */
export async function requireCategoryOrderPollAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      denyUnauthenticated(res, 'requireCategoryOrderPollAccess');
      return;
    }

    const categoryOrderId = numericParam(req, 'id');
    if (categoryOrderId === null) {
      res.status(400).json({
        success: false,
        error: 'Invalid category order ID',
        code: 'INVALID_ID',
      });
      return;
    }

    const categoryOrder =
      await CategoryOrderService.getCategoryOrder(categoryOrderId);
    if (!categoryOrder) {
      res.status(404).json({
        success: false,
        error: 'Category order not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    const groupId = await PollQueryService.getPollGroupId(categoryOrder.pollId);
    if (groupId === null || !(await GroupService.isUserGroupMember(user.id, groupId))) {
      denyForbidden(res, 'Access denied');
      return;
    }

    next();
  } catch (error) {
    logger.error('requireCategoryOrderPollAccess error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Администратор группы, В КОТОРОЙ состоит пользователь `:userId`.
 *
 * Тоже исправление утечки, а не переезд. На маршруте статистики стоял
 * `requireGroupAdmin`, а он проверяет админство в группе из query и не
 * связывает её ни с ресурсом, ни с целевым пользователем. Комментарий на
 * маршруте гласил «статистика чужого человека — данные его группы», но
 * принадлежность человека к этой группе не проверял никто: администратор любой
 * группы получал статистику ЛЮБОГО пользователя, прислав свой `groupId`.
 *
 * Источники `groupId` те же, что у `requireGroupAdmin`, и в том же порядке:
 * `params` → `query` → `body`. Порядок зафиксирован здесь намеренно — у
 * разных эндпоинтов параметр приходит по-разному, и без записанного приоритета
 * следующая правка добавит четвёртый вариант.
 */
export async function requireGroupAdminOverUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actor = req.user;
    if (!actor) {
      denyUnauthenticated(res, 'requireGroupAdminOverUser');
      return;
    }

    const targetUserId = numericParam(req, 'userId');
    if (targetUserId === null) {
      res.status(400).json({
        success: false,
        error: 'Invalid user ID',
        code: 'INVALID_USER_ID',
      });
      return;
    }

    const rawGroupId =
      req.params?.groupId ?? req.query?.groupId ?? req.body?.groupId;
    const groupId =
      typeof rawGroupId === 'string' ? parseInt(rawGroupId, 10) : rawGroupId;

    if (typeof groupId !== 'number' || !Number.isFinite(groupId) || groupId <= 0) {
      res.status(400).json({
        success: false,
        error: 'groupId is required',
        code: 'MISSING_GROUP_ID',
      });
      return;
    }

    const [isAdmin, targetIsMember] = await Promise.all([
      GroupService.isUserGroupAdmin(actor.id, groupId),
      GroupService.isUserGroupMember(targetUserId, groupId),
    ]);

    if (!isAdmin || !targetIsMember) {
      /* Один и тот же отказ на «я не админ» и «он не в моей группе»
         намеренно: разные ответы позволяли бы перебором выяснять, кто состоит
         в чужой группе. */
      denyForbidden(res, 'Group admin access required');
      return;
    }

    next();
  } catch (error) {
    logger.error('requireGroupAdminOverUser error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Администратор группы, которой принадлежит ПОЗИЦИЯ `:id`.
 *
 * Заменяет `requireGroupAdmin` на маршруте истории правок, и это исправление
 * настоящей утечки, а не переезд проверки. `requireGroupAdmin` берёт `groupId`
 * из query/params/body запроса и НИКАК не связывает его с ресурсом, поэтому
 * администратор группы A мог прислать
 * `GET /api/order-items/<позиция группы B>/edit-history?groupId=A`,
 * пройти проверку (он действительно админ A) и получить историю правок чужой
 * группы: `OrderCalculationService.getEditHistory` фильтрует только по
 * `orderItemId`.
 *
 * Здесь группа выводится ИЗ САМОЙ ПОЗИЦИИ: позиция → категорийный заказ →
 * опрос → группа. Подделать её запросом нельзя.
 */
export async function requireOrderItemGroupAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      denyUnauthenticated(res, 'requireOrderItemGroupAdmin');
      return;
    }

    const orderItemId = numericParam(req, 'id');
    if (orderItemId === null) {
      res.status(400).json({
        success: false,
        error: 'Invalid order item ID',
        code: 'INVALID_ID',
      });
      return;
    }

    const categoryOrderId =
      await OrderCalculationService.getCategoryOrderIdForItem(orderItemId);
    if (categoryOrderId === null) {
      denyForbidden(res, 'Access denied');
      return;
    }

    const categoryOrder =
      await CategoryOrderService.getCategoryOrder(categoryOrderId);
    const groupId =
      categoryOrder && (await PollQueryService.getPollGroupId(categoryOrder.pollId));

    if (!groupId || !(await GroupService.isUserGroupAdmin(user.id, groupId))) {
      denyForbidden(res, 'Group admin access required');
      return;
    }

    next();
  } catch (error) {
    logger.error('requireOrderItemGroupAdmin error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Ответственный за категорийный заказ `:id`.
 *
 * Ровно то правило, что стояло шестью копиями в `category-order.controller`
 * как `responsibleUserId !== user.id`.
 */
export function requireCategoryOrderResponsible(
  /**
   * Текст отказа. Параметр существует не для гибкости, а чтобы НЕ МЕНЯТЬ тела
   * ответов: до переноса три маршрута отвечали разными сообщениями
   * («…can update costs», «…can finalize calculation», «…can edit order
   * items»), а два — общим «Access denied». Свести их к одному — задача 03,
   * у неё словарь кодов; задача 04 обязана сохранить контракт.
   */
  deniedMessage = 'Access denied'
) {
  /* Имя функции сохранено намеренно: тест на проводку маршрутов
     (`__tests__/unit/routes/category-order-authorization.test.ts`) читает
     цепочку по именам обработчиков, и анонимная фабрика сделала бы её
     непроверяемой. */
  return async function requireCategoryOrderResponsible(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        denyUnauthenticated(res, 'requireCategoryOrderResponsible');
        return;
      }

      const categoryOrderId = numericParam(req, 'id');
      if (categoryOrderId === null) {
        res.status(400).json({
          success: false,
          error: 'Invalid category order ID',
          code: 'INVALID_ID',
        });
        return;
      }

      const responsibleUserId =
        await CategoryOrderService.getResponsibleUserId(categoryOrderId);

      if (responsibleUserId === null) {
        /* Тот же 404, что отдавали снятые проверки: отсутствие категории и
           отсутствие ответственного различались там не всегда, но 404 в этой
           ветке был, и менять его — предмет задачи 03. */
        res.status(404).json({
          success: false,
          error: 'Category order not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      if (responsibleUserId !== user.id) {
        denyForbidden(res, deniedMessage);
        return;
      }

      next();
    } catch (error) {
      logger.error('requireCategoryOrderResponsible error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  };
}

/**
 * Ответственный ИЛИ участник категорийного заказа `:id`.
 *
 * Это правило стояло в контроллере ДВУМЯ разными записями —
 * `responsibleUserId !== user.id && !isParticipant` и
 * `!isResponsible && !isParticipant`. Одно правило, две записи: достаточно
 * поправить одну, чтобы они разошлись.
 */
export async function requireCategoryOrderParticipant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      denyUnauthenticated(res, 'requireCategoryOrderParticipant');
      return;
    }

    const categoryOrderId = numericParam(req, 'id');
    if (categoryOrderId === null) {
      res.status(400).json({
        success: false,
        error: 'Invalid category order ID',
        code: 'INVALID_ID',
      });
      return;
    }

    const [categoryOrder, participantIds] = await Promise.all([
      CategoryOrderService.getCategoryOrder(categoryOrderId),
      CategoryOrderService.getParticipants(categoryOrderId),
    ]);

    /* 404, а не 403, если категории нет: ровно так отвечал контроллер до
       переноса. Задача 04 не меняет коды ответов — это предмет задачи 03. */
    if (!categoryOrder) {
      res.status(404).json({
        success: false,
        error: 'Category order not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (
      categoryOrder.responsibleUserId !== user.id &&
      !participantIds.includes(user.id)
    ) {
      denyForbidden(res, 'Access denied');
      return;
    }

    next();
  } catch (error) {
    logger.error('requireCategoryOrderParticipant error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}
