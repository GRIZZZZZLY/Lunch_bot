import { Router } from 'express';

import { groupStoreController } from '../controllers/group-store.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { writeLimiter } from '../middleware/rate-limiter';
import {
  groupStoreItemParams,
  groupStoreListParams,
  renameGroupStoreBody,
} from '../schemas/group-store';

/**
 * Справочник магазинов группы. `POST` здесь нет намеренно: запись рождается при
 * создании забега, а отдельная кнопка «завести магазин» ввела бы пустой пункт,
 * которым никто не пользовался.
 */
const router = Router();

router.use(telegramAuthMiddleware);

router.get('/:groupId/stores', groupStoreListParams.middleware, (req, res) =>
  groupStoreController.list(req, res),
);

router.patch(
  '/:groupId/stores/:id',
  groupStoreItemParams.middleware,
  writeLimiter,
  renameGroupStoreBody.middleware,
  (req, res) => groupStoreController.rename(req, res),
);

router.delete(
  '/:groupId/stores/:id',
  groupStoreItemParams.middleware,
  writeLimiter,
  (req, res) => groupStoreController.archive(req, res),
);

export default router;
