import { Router } from 'express';
import { donationController } from '../controllers/donation.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { writeLimiter } from '../middleware/rate-limiter';

const router = Router();

router.use(telegramAuthMiddleware);

router.post('/stars', writeLimiter, (req, res) =>
  donationController.createStarsInvoice(req, res)
);

export default router;
