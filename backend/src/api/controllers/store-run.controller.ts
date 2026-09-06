import { Request, Response } from 'express';
import { StoreRunService, StoreRunError } from '../../services/store-run.service';
import { notificationService } from '../../services/notification.service';
import { storeRunNotificationService } from '../../services/store-run-notification.service';
import { StoreRunBudgetService } from '../../services/store-run-budget.service';
import { logger } from '../../utils/logger';
import { serializeBigInt as serializeData } from '../../utils/serialize';
import { respondIfInvalidInput } from '../middleware/validate';
import {
  addStoreRunItemsBody,
  createStoreRunBody,
  setStoreRunItemPriceBody,
  storeRunGroupQuery,
  storeRunIdParam,
  storeRunItemParams,
  updateStoreRunItemBody,
} from '../schemas/store-run';

/**
 * Единственная точка, откуда handler'ы этого контроллера отвечают об ошибке.
 *
 * Принимает `req` не ради логов: без него нельзя отличить провал разбора входа
 * от сбоя сервиса, и невалидное тело уходило бы клиенту как
 * `500 Internal server error`. Разбор вызывается ВНУТРИ `try` намеренно —
 * вынести его наружу нельзя, Express 4 не подхватывает отказ промиса из
 * async-handler'а и запрос остался бы без ответа вообще.
 */
function sendStoreRunError(req: Request, res: Response, err: unknown): void {
  if (respondIfInvalidInput(req, res, err)) return;

  if (err instanceof StoreRunError) {
    const status =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'FORBIDDEN'
        ? 403
        : err.code === 'WRONG_STATUS' ||
          err.code === 'ACTIVE_RUN_EXISTS' ||
          err.code === 'BOT_NOT_IN_GROUP'
        ? 409
        : 400;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  logger.error('[StoreRunController] Unexpected error:', err);
  res.status(500).json({ error: 'Internal server error' });
}

export class StoreRunController {
  /**
   * POST /api/store-runs
   */
  async createStoreRun(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const body = createStoreRunBody.get(req);

      const canPost = await notificationService.botCanPostToGroup(body.groupId);
      if (!canPost) {
        throw new StoreRunError(
          'BOT_NOT_IN_GROUP',
          'Бот не состоит в этой группе. Добавь его в нужный групповой чат и попробуй снова.',
        );
      }

      const run = await StoreRunService.createStoreRun({
        initiatorId: user.id,
        groupId: body.groupId,
        storeId: body.storeId,
        storeName: body.storeName,
        collectMinutes: body.collectMinutes,
      });

      // Fire-and-forget DM broadcast to group members.
      // Logged with aggregate results so silent failures (e.g. user has not
      // started the bot privately yet) are visible in server logs.
      storeRunNotificationService
        .notifyGroupMembersAboutStoreRun(run.id)
        .then((results) => {
          const successful = results.filter((r) => r.success).length;
          if (results.length > 0 && successful === 0) {
            logger.warn('Store run created but no DMs were delivered', {
              storeRunId: run.id,
              attempted: results.length,
            });
          }
        })
        .catch((err: unknown) =>
          logger.error('Failed to notify group about store run', { storeRunId: run.id, err }),
        );

      // Fire-and-forget group announcement. Reaches members who never opened the
      // bot privately (the DM broadcast above can't deliver to them).
      storeRunNotificationService
        .postStoreRunToGroup(run.id)
        .catch((err: unknown) =>
          logger.error('Failed to post store run to group', { storeRunId: run.id, err }),
        );

      res.status(201).json({ success: true, data: serializeData(run) });
    } catch (err) {
      sendStoreRunError(req, res, err);
    }
  }

  /**
   * GET /api/store-runs/active
   */
  async getActiveForUser(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { groupId } = storeRunGroupQuery.get(req);
      const runs = await StoreRunService.getActiveStoreRunsForUser(
        user.id,
        groupId
      );
      res.json({ success: true, data: serializeData(runs) });
    } catch (err) {
      sendStoreRunError(req, res, err);
    }
  }

  /**
   * GET /api/store-runs/:id
   */
  async getStoreRun(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { id } = storeRunIdParam.get(req);
      const run = await StoreRunService.getStoreRunById(id, user.id);
      if (!run) {
        res.status(404).json({ error: 'Store run not found' });
        return;
      }
      res.json({ success: true, data: serializeData(run) });
    } catch (err) {
      sendStoreRunError(req, res, err);
    }
  }

  /**
   * POST /api/store-runs/:id/items
   */
  async addItems(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { id } = storeRunIdParam.get(req);
      const { items } = addStoreRunItemsBody.get(req);
      const saved = await StoreRunService.addItemsBulk(id, user.id, items);
      res.status(201).json({ success: true, data: serializeData(saved) });
    } catch (err) {
      sendStoreRunError(req, res, err);
    }
  }

  /**
   * PATCH /api/store-runs/:id/items/:itemId
   */
  async updateItem(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { itemId } = storeRunItemParams.get(req);
      const patch = updateStoreRunItemBody.get(req);
      const item = await StoreRunService.updateItem(itemId, user.id, patch);
      res.json({ success: true, data: serializeData(item) });
    } catch (err) {
      sendStoreRunError(req, res, err);
    }
  }

  /**
   * DELETE /api/store-runs/:id/items/:itemId
   */
  async deleteItem(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { itemId } = storeRunItemParams.get(req);
      await StoreRunService.deleteItem(itemId, user.id);
      res.status(204).end();
    } catch (err) {
      sendStoreRunError(req, res, err);
    }
  }

  /**
   * POST /api/store-runs/:id/items/:itemId/price
   * Initiator-only: set price and BOUGHT/NOT_FOUND status.
   */
  async setItemPrice(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { itemId } = storeRunItemParams.get(req);
      const { price, status } = setStoreRunItemPriceBody.get(req);
      const item = await StoreRunService.setItemPrice(itemId, user.id, price, status);
      res.json({ success: true, data: serializeData(item) });
    } catch (err) {
      sendStoreRunError(req, res, err);
    }
  }

  /**
   * POST /api/store-runs/:id/start-shopping
   */
  async startShopping(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { id } = storeRunIdParam.get(req);
      const run = await StoreRunService.startShopping(id, user.id);

      storeRunNotificationService
        .notifyShoppingStarted(id)
        .catch((err: unknown) =>
          logger.error('Failed to notify shopping started', { storeRunId: id, err }),
        );

      res.json({ success: true, data: serializeData(run) });
    } catch (err) {
      sendStoreRunError(req, res, err);
    }
  }

  /**
   * POST /api/store-runs/:id/settle
   */
  async settle(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { id } = storeRunIdParam.get(req);
      const run = await StoreRunService.settle(id, user.id);

      // Fire-and-forget: разослать должникам суммы/реквизиты, инициатору — сводку.
      StoreRunBudgetService.notifyStoreRunSettled(id).catch((err: unknown) =>
        logger.error('Failed to notify store run settled', { storeRunId: id, err }),
      );

      // Fire-and-forget: участникам без долга — «завершён», группе — правка поста.
      storeRunNotificationService
        .notifyStoreRunParticipantsNoDebt(id)
        .catch((err: unknown) =>
          logger.error('Failed to notify no-debt participants', { storeRunId: id, err }),
        );
      storeRunNotificationService
        .markStoreRunGroupCompleted(id)
        .catch((err: unknown) =>
          logger.error('Failed to mark store run group completed', { storeRunId: id, err }),
        );

      res.json({ success: true, data: serializeData(run) });
    } catch (err) {
      sendStoreRunError(req, res, err);
    }
  }

  /**
   * POST /api/store-runs/:id/cancel
   */
  async cancel(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { id } = storeRunIdParam.get(req);
      const run = await StoreRunService.cancelStoreRun(id, user.id);

      // Fire-and-forget: убрать групповой пост и личные приглашения отменённого забега.
      storeRunNotificationService
        .deleteStoreRunMessages(id)
        .catch((err: unknown) =>
          logger.error('Failed to delete store run messages on cancel', { storeRunId: id, err }),
        );

      res.json({ success: true, data: serializeData(run) });
    } catch (err) {
      sendStoreRunError(req, res, err);
    }
  }
}

export const storeRunController = new StoreRunController();
