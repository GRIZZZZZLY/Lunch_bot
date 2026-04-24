import { Router } from 'express';
import { storeRunController } from '../controllers/store-run.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { writeLimiter } from '../middleware/rate-limiter';

const router = Router();

router.use(telegramAuthMiddleware);

// Reads
router.get('/active', (req, res) => storeRunController.getActiveForUser(req, res));
router.get('/:id', (req, res) => storeRunController.getStoreRun(req, res));

// Writes (rate-limited)
router.post('/', writeLimiter, (req, res) => storeRunController.createStoreRun(req, res));
router.post('/:id/items', writeLimiter, (req, res) => storeRunController.addItems(req, res));
router.patch('/:id/items/:itemId', writeLimiter, (req, res) =>
  storeRunController.updateItem(req, res),
);
router.delete('/:id/items/:itemId', writeLimiter, (req, res) =>
  storeRunController.deleteItem(req, res),
);
router.post('/:id/items/:itemId/price', writeLimiter, (req, res) =>
  storeRunController.setItemPrice(req, res),
);
router.post('/:id/start-shopping', writeLimiter, (req, res) =>
  storeRunController.startShopping(req, res),
);
router.post('/:id/settle', writeLimiter, (req, res) => storeRunController.settle(req, res));
router.post('/:id/cancel', writeLimiter, (req, res) => storeRunController.cancel(req, res));

export default router;
