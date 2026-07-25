import { Router } from 'express';
import { donationController } from '../controllers/donation.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { writeLimiter } from '../middleware/rate-limiter';
import { createIdempotencyMiddleware } from '../middleware/idempotency';

const router = Router();

router.use(telegramAuthMiddleware);

const donationIdempotency = createIdempotencyMiddleware({
  scope: 'donation',
  required: true,
});

router.post('/stars', writeLimiter, donationIdempotency, (req, res) =>
  donationController.createStarsInvoice(req, res)
);

export default router;
