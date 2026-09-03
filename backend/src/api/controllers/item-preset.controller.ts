import { Request, Response } from 'express';

import {
  UserItemPresetService,
  UserItemPresetError,
} from '../../services/user-item-preset.service';
import { logger } from '../../utils/logger';
import { serializeBigInt as serializeData } from '../../utils/serialize';
import { respondIfInvalidInput } from '../middleware/validate';
import {
  itemPresetIdParam,
  itemPresetListQuery,
  updateItemPresetBody,
} from '../schemas/item-preset';

function sendPresetError(req: Request, res: Response, err: unknown): void {
  if (respondIfInvalidInput(req, res, err)) return;

  if (err instanceof UserItemPresetError) {
    res
      .status(err.code === 'NOT_FOUND' ? 404 : 400)
      .json({ error: err.message, code: err.code });
    return;
  }
  logger.error('[ItemPresetController] Unexpected error:', err);
  res.status(500).json({ error: 'Internal server error' });
}

/**
 * Личный список товаров. Групповой принадлежности у него нет, поэтому проверок
 * членства тут не будет: владение определяется `req.user`, и сервис отвечает
 * `NOT_FOUND` на чужой id, не подтверждая его существование.
 */
export class ItemPresetController {
  /** GET /api/user/item-presets */
  async list(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { storeId } = itemPresetListQuery.get(req);
      /* Проверка типа, а не приведение: схема query собрана через passthrough,
         и её вывод для отдельного поля шире, чем `number | undefined`. */
      const presets = await UserItemPresetService.listForUser(
        user.id,
        typeof storeId === 'number' ? storeId : null,
      );
      res.json({ success: true, data: serializeData(presets) });
    } catch (err) {
      sendPresetError(req, res, err);
    }
  }

  /** PATCH /api/user/item-presets/:id */
  async update(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { id } = itemPresetIdParam.get(req);
      const body = updateItemPresetBody.get(req);
      const preset = await UserItemPresetService.update(id, user.id, {
        name: body.name,
        quantity: body.quantity,
        notes: body.notes,
        pinned: body.pinned,
      });
      res.json({ success: true, data: serializeData(preset) });
    } catch (err) {
      sendPresetError(req, res, err);
    }
  }

  /** DELETE /api/user/item-presets/:id */
  async remove(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const { id } = itemPresetIdParam.get(req);
      await UserItemPresetService.remove(id, user.id);
      res.json({ success: true });
    } catch (err) {
      sendPresetError(req, res, err);
    }
  }
}

export const itemPresetController = new ItemPresetController();
