import { Request, Response } from 'express';
import { CategoryOrderService } from '../../services/category-order.service';
import { OrderCalculationService } from '../../services/order-calculation.service';
import { MultiCategoryResponsibleService } from '../../services/multi-category-responsible.service';
import { UserService } from '../../services/user.service';
import { CategoryOrderNotFoundError } from '../../services/category-order.errors';
import { requireAuthUserOrThrow } from '../middleware/require-auth-user';
import { AccessDeniedError, HttpError } from '../http.errors';
import {
  categoryOrderIdParam,
  categoryOrderPollIdParam,
  saveOrderItemBody,
  updateCostsBody,
} from '../schemas/category-order';
import { serializeBigInt } from '../../utils/serialize';

/**
 * HTTP-адаптер категорийных заказов: разобрать запрос → вызвать сервис →
 * отдать ответ. Ничего третьего здесь быть не должно, и вот что убрано.
 *
 * **Ни одного `catch`.** Их было 12, и все делали одно и то же:
 * `respondIfInvalidInput` → `logger.error` → `next(err)`. Все три шага уже
 * делает `error-handler`: он распознаёт `RequestValidationError` (400 со своим
 * кодом и полем `errors[]`), `BaseError` (свой статус и код), известные ошибки
 * Prisma (409/404) и пишет запрос в журнал. Express 5 передаёт отказ
 * асинхронного обработчика в цепочку ошибок сам, поэтому `next` этим
 * обработчикам больше не нужен. То же решение и по той же причине, что в
 * `poll.controller.ts` (задача 05).
 *
 * **Ни одной повторной проверки доступа.** Семь handler'ов начинались с
 * `getResponsibleUserId(...)` и отвечали 404, если ответственного нет. На
 * маршруте перед ними стоит `requireCategoryOrderResponsible`, который делает
 * РОВНО ТОТ ЖЕ запрос и отвечает тем же 404 (`api/middleware/authorization.ts`).
 * То есть это был второй запрос к базе на каждое обращение и второе место, где
 * записано одно правило. Гарантию, что guard действительно стоит в цепочке,
 * даёт `__tests__/unit/routes/category-order-authorization.test.ts` — тест на
 * проводку, а не совпадение проверок в двух местах.
 *
 * `serializeBigInt` остаётся здесь: `telegramId` — BigInt в Prisma, и это
 * забота транспорта, а не сервиса.
 */
export class CategoryOrderController {
  /**
   * Участник категории? Единственная проверка доступа, оставшаяся в
   * контроллере, и остаётся она осознанно: в `saveOrderItem` она задаётся
   * не про ВЫЗЫВАЮЩЕГО, а про пользователя из ТЕЛА запроса — «позицию можно
   * создать только участнику категории». В middleware разобранного тела ещё
   * нет, и перенос превратил бы проверку в её отсутствие.
   *
   * Пустой список участников закрывает доступ ВСЕМ, включая ответственного, —
   * и это верно: категория без голосов не должна принимать позиции. Закреплено
   * тестом, потому что из `.includes()` это не читается.
   *
   * Авторизация вызывающего живёт на маршруте: см.
   * `api/middleware/authorization.ts` и матрицу `tech_debt/04-auth-matrix.md`.
   */
  private static async requireCategoryParticipant(
    categoryOrderId: number,
    userId: number
  ): Promise<void> {
    const participantUserIds =
      await CategoryOrderService.getParticipants(categoryOrderId);

    if (!participantUserIds.includes(userId)) {
      throw new AccessDeniedError(
        'Order items can only be created for category participants'
      );
    }
  }

  /**
   * GET /api/polls/:pollId/category-orders
   * Get all CategoryOrders for a poll
   */
  static async getCategoryOrdersForPoll(
    req: Request,
    res: Response
  ): Promise<void> {
    requireAuthUserOrThrow(req);
    const { pollId } = categoryOrderPollIdParam.get(req);

    const categoryOrders =
      await CategoryOrderService.getCategoryOrdersForPoll(pollId);

    res.json({
      success: true,
      data: serializeBigInt(categoryOrders),
      count: categoryOrders.length,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/polls/:pollId/category-orders/my
   * Get CategoryOrders for poll where current user is participant
   */
  static async getMyCategoryOrdersForPoll(
    req: Request,
    res: Response
  ): Promise<void> {
    const user = requireAuthUserOrThrow(req);
    const { pollId } = categoryOrderPollIdParam.get(req);

    const categoryOrders =
      await CategoryOrderService.getCategoryOrdersForPoll(pollId);

    // Один запрос голосов на все категории вместо getParticipants на каждую
    const participantsByCategory =
      await CategoryOrderService.getParticipantsByCategoriesForPoll(
        pollId,
        categoryOrders.map(order => order.category)
      );

    const myCategoryOrders = categoryOrders.filter(
      order => participantsByCategory.get(order.category)?.has(user.id) ?? false
    );

    res.json({
      success: true,
      data: serializeBigInt(myCategoryOrders),
      count: myCategoryOrders.length,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/category-orders/:id
   * Get a single CategoryOrder by ID
   */
  static async getCategoryOrder(req: Request, res: Response): Promise<void> {
    requireAuthUserOrThrow(req);
    const { id } = categoryOrderIdParam.get(req);

    const categoryOrder = await CategoryOrderService.getCategoryOrder(id);

    /* Сообщение передано явно: у класса по умолчанию «CategoryOrder not found»,
       а этот эндпоинт отдавал «Category order not found». Код (`NOT_FOUND`) и
       статус те же, но поле `error` читают логи и старые клиенты. */
    if (!categoryOrder) {
      throw new CategoryOrderNotFoundError('Category order not found');
    }

    res.json({
      success: true,
      data: serializeBigInt(categoryOrder),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /api/category-orders/:id/order-items
   * Save or update an OrderItem (autosave)
   */
  static async saveOrderItem(req: Request, res: Response): Promise<void> {
    const enteredBy = requireAuthUserOrThrow(req).id;

    const { id: categoryOrderId } = categoryOrderIdParam.get(req);
    /* Приведение и обрезка пробелов теперь в схеме: `userId` — целое
       положительное, `itemName` — непустая строка после trim, `price` —
       конечное положительное число. */
    const { userId, itemName, price, notes } = saveOrderItemBody.get(req);

    await CategoryOrderController.requireCategoryParticipant(
      categoryOrderId,
      userId
    );

    const orderItem = await OrderCalculationService.saveOrderItem({
      categoryOrderId,
      userId,
      itemName,
      price,
      notes: notes || undefined,
      enteredBy,
    });

    res.json({
      success: true,
      data: serializeBigInt(orderItem),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * DELETE /api/order-items/:id
   * Delete an OrderItem
   */
  static async deleteOrderItem(req: Request, res: Response): Promise<void> {
    const user = requireAuthUserOrThrow(req);
    const { id } = categoryOrderIdParam.get(req);

    /* Здесь `:id` — ПОЗИЦИЯ, а право на удаление принадлежит ответственному
       за ЗАКАЗ. Поэтому проверка доступа осталась в контроллере, а не уехала
       на маршрут: middleware по `:id` проверял бы не ту сущность. Это
       единственный handler файла, где проверка ответственного не дублирует
       маршрут, — потому и единственный, где она сохранена. */
    const categoryOrderIdForItem =
      await OrderCalculationService.getCategoryOrderIdForItem(id);

    /* Код `NOT_FOUND`, а не более точный `ITEM_NOT_FOUND`, потому что именно
       его отдавал этот эндпоинт: у обоих кодов на фронте СВОЙ текст, и смена
       кода — смена того, что читает человек. Сведение — решение задачи 03
       вместе с фронтом, а не побочный эффект этого рефакторинга. */
    if (categoryOrderIdForItem === null) {
      throw new HttpError('Order item not found', 404, 'NOT_FOUND');
    }

    const responsibleUserId = await CategoryOrderService.getResponsibleUserId(
      categoryOrderIdForItem
    );

    if (responsibleUserId === null) {
      throw new CategoryOrderNotFoundError('Category order not found');
    }

    if (responsibleUserId !== user.id) {
      throw new AccessDeniedError('Only responsible user can delete order items');
    }

    await OrderCalculationService.deleteOrderItem(id);

    res.json({
      success: true,
      message: 'Order item deleted',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/category-orders/:id/progress
   * Get calculation progress
   */
  static async getProgress(req: Request, res: Response): Promise<void> {
    requireAuthUserOrThrow(req);
    const { id: categoryOrderId } = categoryOrderIdParam.get(req);

    /* Здесь снятая проверка была не просто лишней, а неверной. Маршрут открыт
       УЧАСТНИКАМ (`requireCategoryOrderParticipant`), а handler отвечал 404
       «категории нет», если не выбран ОТВЕТСТВЕННЫЙ. У категории с двумя и
       более участниками ответственного нет до первого отклика
       (`selectionStatus: VOLUNTEER_OPEN`) — то есть участник видел «не
       найдено» вместо прогресса именно тогда, когда прогресс и нужен.
       Отсутствие самого заказа по-прежнему 404: его отдаёт сервис. */
    const progress = await OrderCalculationService.getProgress(categoryOrderId);

    res.json({
      success: true,
      data: progress,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/category-orders/:id/participants
   * Get participants (users who voted for this category)
   */
  static async getParticipants(req: Request, res: Response): Promise<void> {
    requireAuthUserOrThrow(req);
    const { id: categoryOrderId } = categoryOrderIdParam.get(req);

    const participantUserIds =
      await CategoryOrderService.getParticipants(categoryOrderId);

    /* Поля перечислены здесь, а не отданы целиком из сервиса, намеренно:
       `getUsersByIds` возвращает полную запись, включая telegramId, и
       `data: users` отдал бы её наружу. Форма ответа при этом ровно та же,
       что была у прежнего `select` в Prisma. */
    const participants = await UserService.getUsersByIds(participantUserIds);
    const users = participants.map(participant => ({
      id: participant.id,
      firstName: participant.firstName,
      lastName: participant.lastName,
      username: participant.username,
    }));

    res.json({
      success: true,
      data: users,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /api/category-orders/:id/finalize
   * Finalize calculation and create transactions
   *
   * Операция НЕОБРАТИМА: закрывает расчёт и создаёт долги. Идемпотентность
   * обеспечивает сервис (переход статуса условным `updateMany`), и она закрыта
   * тестами — здесь ничего повторно проверять нельзя, любая проверка «до»
   * была бы гонкой.
   *
   * Прежний `catch` этого handler'а отвечал `500 FINALIZATION_ERROR` на ЛЮБУЮ
   * ошибку расчёта. То есть «не у всех заполнены позиции» и «расчёт уже
   * закрыт» приходили ответственному как «Ошибка на сервере», и он повторял
   * попытку. Теперь статус и код несёт сама ошибка сервиса
   * (`services/category-order.errors.ts`): 409 с причиной вместо 500.
   */
  static async finalizeCalculation(req: Request, res: Response): Promise<void> {
    requireAuthUserOrThrow(req);
    const { id: categoryOrderId } = categoryOrderIdParam.get(req);

    const result =
      await OrderCalculationService.finalizeCalculation(categoryOrderId);

    res.json({
      success: true,
      data: result,
      message: 'Calculation finalized and transactions created',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /api/category-orders/:id/volunteer
   * Volunteer as responsible from Mini App
   */
  static async volunteerForCategory(
    req: Request,
    res: Response
  ): Promise<void> {
    const user = requireAuthUserOrThrow(req);
    const { id: categoryOrderId } = categoryOrderIdParam.get(req);

    /* `req.user` уже несёт telegramId, но перечитываем из базы: запись могли
       деактивировать между выдачей токена и этим запросом, а отклик на
       категорию — действие от имени человека. */
    const dbUser = await UserService.getUserById(user.id);

    if (!dbUser?.telegramId) {
      throw new HttpError('User not found', 404, 'USER_NOT_FOUND');
    }

    const selected =
      await MultiCategoryResponsibleService.handleVolunteerForCategory(
        categoryOrderId,
        dbUser.telegramId
      );
    if (!selected) {
      throw new HttpError(
        'Category is already assigned or user is not an eligible participant',
        409,
        'VOLUNTEER_NOT_AVAILABLE'
      );
    }

    const updatedOrder =
      await CategoryOrderService.getCategoryOrder(categoryOrderId);

    res.json({
      success: true,
      data: serializeBigInt(updatedOrder),
      message: 'Volunteer request processed',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * PUT /api/category-orders/:id/costs
   * Update additional costs (delivery, service, tip)
   */
  static async updateCosts(req: Request, res: Response): Promise<void> {
    requireAuthUserOrThrow(req);
    const { id: categoryOrderId } = categoryOrderIdParam.get(req);
    const costs = updateCostsBody.get(req);

    const categoryOrder = await CategoryOrderService.updateCosts(
      categoryOrderId,
      costs
    );

    res.json({
      success: true,
      data: serializeBigInt(categoryOrder),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/order-items/:id/edit-history
   * Get edit history for an OrderItem (admin only)
   */
  static async getEditHistory(req: Request, res: Response): Promise<void> {
    /* Право на историю правок проверяет `requireOrderItemGroupAdmin` на
       маршруте: это данные группы, и решает роль в ней, выведенная ИЗ САМОЙ
       ПОЗИЦИИ. Здесь остаётся только аутентификация.

       Отличие от прежнего кода одно: отсутствие пользователя даёт 401
       `UNAUTHORIZED`, а не 403 «Admin access required». 403 за отсутствие
       аутентификации был неверным и недостижимым (до контроллера стоят
       `telegramAuthMiddleware` и guard группы, оба отвечают 401 сами), но
       расхождение стоит назвать: это единственная смена кода ответа в файле. */
    requireAuthUserOrThrow(req);
    const { id: orderItemId } = categoryOrderIdParam.get(req);

    const history = await OrderCalculationService.getEditHistory(orderItemId);

    res.json({
      success: true,
      data: serializeBigInt(history),
      count: history.length,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/category-orders/:id/order-items
   * Get all OrderItems for a CategoryOrder
   */
  static async getOrderItems(req: Request, res: Response): Promise<void> {
    requireAuthUserOrThrow(req);
    const { id: categoryOrderId } = categoryOrderIdParam.get(req);

    const items = await OrderCalculationService.getOrderItems(categoryOrderId);

    res.json({
      success: true,
      data: serializeBigInt(items),
      count: items.length,
      timestamp: new Date().toISOString(),
    });
  }
}
