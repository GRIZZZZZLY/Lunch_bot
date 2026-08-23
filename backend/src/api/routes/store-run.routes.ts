import { Router } from 'express';
import { storeRunController } from '../controllers/store-run.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { writeLimiter } from '../middleware/rate-limiter';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
import {
  addStoreRunItemsBody,
  createStoreRunBody,
  setStoreRunItemPriceBody,
  storeRunIdParam,
  storeRunItemParams,
  updateStoreRunItemBody,
} from '../schemas/store-run';

const router = Router();

router.use(telegramAuthMiddleware);

// G0-8: критично для createStoreRun (двойной тап = два забега) и settle.
const storeRunIdempotency = createIdempotencyMiddleware({
  scope: 'storeRun',
  required: true,
});

// Reads
router.get('/active', (req, res) => storeRunController.getActiveForUser(req, res));
router.get('/:id', storeRunIdParam.middleware, (req, res) =>
  storeRunController.getStoreRun(req, res),
);

// Writes (rate-limited + idempotency на критичных переходах состояния)
router.post('/', writeLimiter, storeRunIdempotency, createStoreRunBody.middleware, (req, res) =>
  storeRunController.createStoreRun(req, res),
);
router.post(
  '/:id/items',
  storeRunIdParam.middleware,
  writeLimiter,
  storeRunIdempotency,
  addStoreRunItemsBody.middleware,
  (req, res) => storeRunController.addItems(req, res),
);
router.patch(
  '/:id/items/:itemId',
  storeRunItemParams.middleware,
  writeLimiter,
  updateStoreRunItemBody.middleware,
  (req, res) => storeRunController.updateItem(req, res),
);
router.delete('/:id/items/:itemId', storeRunItemParams.middleware, writeLimiter, (req, res) =>
  storeRunController.deleteItem(req, res),
);
router.post(
  '/:id/items/:itemId/price',
  storeRunItemParams.middleware,
  writeLimiter,
  storeRunIdempotency,
  setStoreRunItemPriceBody.middleware,
  (req, res) => storeRunController.setItemPrice(req, res),
);
router.post(
  '/:id/start-shopping',
  storeRunIdParam.middleware,
  writeLimiter,
  storeRunIdempotency,
  (req, res) => storeRunController.startShopping(req, res),
);
router.post(
  '/:id/settle',
  storeRunIdParam.middleware,
  writeLimiter,
  storeRunIdempotency,
  (req, res) => storeRunController.settle(req, res),
);
router.post(
  '/:id/cancel',
  storeRunIdParam.middleware,
  writeLimiter,
  storeRunIdempotency,
  (req, res) => storeRunController.cancel(req, res),
);

export default router;
