import { Request, Response } from 'express';
import { donationService } from '../../services/donation.service';
import { logger } from '../../utils/logger';

class DonationController {
  /**
   * POST /api/donations/stars
   * body: { amountRub: number }
   */
  async createStarsInvoice(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
          code: 'NOT_AUTHENTICATED',
        });
      }

      const { amountStars } = req.body ?? {};

      const result = await donationService.createStarsInvoice(
        user.id,
        Number(amountStars)
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      const message = error?.message || 'Failed to create Stars invoice';
      const isValidation =
        message.includes('amountStars') || message.includes('between');

      logger.error('❌ [DonationController] createStarsInvoice failed', {
        error: message,
      });

      return res.status(isValidation ? 400 : 500).json({
        success: false,
        error: message,
        code: isValidation ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
      });
    }
  }
}

export const donationController = new DonationController();
