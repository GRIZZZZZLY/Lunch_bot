import { Request, Response } from 'express';
import { z } from 'zod';
import { StoreRunService, StoreRunError } from '../../services/store-run.service';
import { notificationService } from '../../services/notification.service';
import { StoreRunBudgetService } from '../../services/store-run-budget.service';
import { logger } from '../../utils/logger';
import { serializeBigInt as serializeData } from '../../utils/serialize';

const CreateStoreRunSchema = z.object({
  groupId: z.number().int().positive(),
  storeName: z.string().min(1).max(100),
  collectMinutes: z.number().int().min(3).max(30),
});

const AddItemsSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        quantity: z.number().int().min(1).max(99).optional(),
        notes: z.string().max(500).nullish(),
      }),
    )
    .min(1)
    .max(20),
});

const UpdateItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(500).nullish(),
});

const SetPriceSchema = z.object({
  price: z.number().min(0).max(100000).nullable(),
  status: z.enum(['BOUGHT', 'NOT_FOUND']),
});

function getIdParam(req: Request, key: string): number | null {
  const raw = req.params[key];
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function sendStoreRunError(res: Response, err: unknown): void {
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
    const parsed = CreateStoreRunSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
      return;
    }
    try {
      const canPost = await notificationService.botCanPostToGroup(parsed.data.groupId);
      if (!canPost) {
        throw new StoreRunError(
          'BOT_NOT_IN_GROUP',
          'Бот не состоит в этой группе. Добавь его в нужный групповой чат и попробуй снова.',
        );
      }

      const run = await StoreRunService.createStoreRun({
        initiatorId: user.id,
        groupId: parsed.data.groupId,
        storeName: parsed.data.storeName,
        collectMinutes: parsed.data.collectMinutes,
      });

      // Fire-and-forget DM broadcast to group members.
      // Logged with aggregate results so silent failures (e.g. user has not
      // started the bot privately yet) are visible in server logs.
      notificationService
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
      notificationService
        .postStoreRunToGroup(run.id)
        .catch((err: unknown) =>
          logger.error('Failed to post store run to group', { storeRunId: run.id, err }),
        );

      res.status(201).json({ success: true, data: serializeData(run) });
    } catch (err) {
      sendStoreRunError(res, err);
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
      const runs = await StoreRunService.getActiveStoreRunsForUser(user.id);
      res.json({ success: true, data: serializeData(runs) });
    } catch (err) {
      sendStoreRunError(res, err);
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
    const id = getIdParam(req, 'id');
    if (!id) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    try {
      const run = await StoreRunService.getStoreRunById(id, user.id);
      if (!run) {
        res.status(404).json({ error: 'Store run not found' });
        return;
      }
      res.json({ success: true, data: serializeData(run) });
    } catch (err) {
      sendStoreRunError(res, err);
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
    const id = getIdParam(req, 'id');
    if (!id) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const parsed = AddItemsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
      return;
    }
    try {
      const items = await StoreRunService.addItemsBulk(id, user.id, parsed.data.items);
      res.status(201).json({ success: true, data: serializeData(items) });
    } catch (err) {
      sendStoreRunError(res, err);
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
    const itemId = getIdParam(req, 'itemId');
    if (!itemId) {
      res.status(400).json({ error: 'Invalid itemId' });
      return;
    }
    const parsed = UpdateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
      return;
    }
    try {
      const item = await StoreRunService.updateItem(itemId, user.id, parsed.data);
      res.json({ success: true, data: serializeData(item) });
    } catch (err) {
      sendStoreRunError(res, err);
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
    const itemId = getIdParam(req, 'itemId');
    if (!itemId) {
      res.status(400).json({ error: 'Invalid itemId' });
      return;
    }
    try {
      await StoreRunService.deleteItem(itemId, user.id);
      res.status(204).end();
    } catch (err) {
      sendStoreRunError(res, err);
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
    const itemId = getIdParam(req, 'itemId');
    if (!itemId) {
      res.status(400).json({ error: 'Invalid itemId' });
      return;
    }
    const parsed = SetPriceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
      return;
    }
    try {
      const item = await StoreRunService.setItemPrice(
        itemId,
        user.id,
        parsed.data.price,
        parsed.data.status,
      );
      res.json({ success: true, data: serializeData(item) });
    } catch (err) {
      sendStoreRunError(res, err);
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
    const id = getIdParam(req, 'id');
    if (!id) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    try {
      const run = await StoreRunService.startShopping(id, user.id);

      notificationService
        .notifyShoppingStarted(id)
        .catch((err: unknown) =>
          logger.error('Failed to notify shopping started', { storeRunId: id, err }),
        );

      res.json({ success: true, data: serializeData(run) });
    } catch (err) {
      sendStoreRunError(res, err);
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
    const id = getIdParam(req, 'id');
    if (!id) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    try {
      const run = await StoreRunService.settle(id, user.id);

      // Fire-and-forget: разослать должникам суммы/реквизиты, инициатору — сводку.
      StoreRunBudgetService.notifyStoreRunSettled(id).catch((err: unknown) =>
        logger.error('Failed to notify store run settled', { storeRunId: id, err }),
      );

      // Fire-and-forget: участникам без долга — «завершён», группе — правка поста.
      notificationService
        .notifyStoreRunParticipantsNoDebt(id)
        .catch((err: unknown) =>
          logger.error('Failed to notify no-debt participants', { storeRunId: id, err }),
        );
      notificationService
        .markStoreRunGroupCompleted(id)
        .catch((err: unknown) =>
          logger.error('Failed to mark store run group completed', { storeRunId: id, err }),
        );

      res.json({ success: true, data: serializeData(run) });
    } catch (err) {
      sendStoreRunError(res, err);
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
    const id = getIdParam(req, 'id');
    if (!id) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    try {
      const run = await StoreRunService.cancelStoreRun(id, user.id);

      // Fire-and-forget: убрать групповой пост и личные приглашения отменённого забега.
      notificationService
        .deleteStoreRunMessages(id)
        .catch((err: unknown) =>
          logger.error('Failed to delete store run messages on cancel', { storeRunId: id, err }),
        );

      res.json({ success: true, data: serializeData(run) });
    } catch (err) {
      sendStoreRunError(res, err);
    }
  }
}

export const storeRunController = new StoreRunController();
