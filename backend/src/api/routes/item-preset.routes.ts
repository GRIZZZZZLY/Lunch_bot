import { Router } from 'express';

import { itemPresetController } from '../controllers/item-preset.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { writeLimiter } from '../middleware/rate-limiter';
import {
  itemPresetIdParam,
  itemPresetListQuery,
  updateItemPresetBody,
} from '../schemas/item-preset';

/**
 * Личный список товаров. `POST` отсутствует по той же причине, что и у
 * магазинов: пресеты копятся из обычной работы с забегом, а не заводятся руками.
 */
const router = Router();

router.use(telegramAuthMiddleware);

router.get('/', itemPresetListQuery.middleware, (req, res) =>
  itemPresetController.list(req, res),
);

router.patch(
  '/:id',
  itemPresetIdParam.middleware,
  writeLimiter,
  updateItemPresetBody.middleware,
  (req, res) => itemPresetController.update(req, res),
);

router.delete('/:id', itemPresetIdParam.middleware, writeLimiter, (req, res) =>
  itemPresetController.remove(req, res),
);

export default router;
