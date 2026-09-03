import { Request, Response } from 'express';

import {
  GroupStoreService,
  GroupStoreError,
} from '../../services/group-store.service';
import { logger } from '../../utils/logger';
import { serializeBigInt as serializeData } from '../../utils/serialize';
import { respondIfInvalidInput } from '../middleware/validate';
import {
  groupStoreItemParams,
  groupStoreListParams,
  renameGroupStoreBody,
} from '../schemas/group-store';

/**
 * Единственная точка ответа об ошибке. Разбор входа зовётся ВНУТРИ `try` по той
 * же причине, что и в store-run.controller: Express 4 не подхватывает отказ
 * промиса из async-handler'а, и запрос остался бы вообще без ответа.
 */
function sendGroupStoreError(req: Request, res: Response, err: unknown): void {
  if (respondIfInvalidInput(req, res, err)) return;

  if (err instanceof GroupStoreError) {
    const status =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'FORBIDDEN'
        ? 403
        : err.code === 'STORE_EXISTS'
        ? 409
        : 400;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  logger.error('[GroupStoreController] Unexpected error:', err);
  res.status(500).json({ error: 'Internal server error' });
}

export class GroupStoreController {
  /** GET /api/groups/:groupId/stores */
  async list(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { groupId } = groupStoreListParams.get(req);
      const stores = await GroupStoreService.listForGroup(groupId, user.id);
      res.json({ success: true, data: serializeData(stores) });
    } catch (err) {
      sendGroupStoreError(req, res, err);
    }
  }

  /** PATCH /api/groups/:groupId/stores/:id */
  async rename(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { id } = groupStoreItemParams.get(req);
      const { name } = renameGroupStoreBody.get(req);
      const store = await GroupStoreService.rename(id, user.id, name);
      res.json({ success: true, data: serializeData(store) });
    } catch (err) {
      sendGroupStoreError(req, res, err);
    }
  }

  /** DELETE /api/groups/:groupId/stores/:id — скрытие, не удаление. */
  async archive(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { id } = groupStoreItemParams.get(req);
      await GroupStoreService.archive(id, user.id);
      res.json({ success: true });
    } catch (err) {
      sendGroupStoreError(req, res, err);
    }
  }
}

export const groupStoreController = new GroupStoreController();
