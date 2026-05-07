import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { getBotInstance } from '../bot/bot-instance';

export type DonationMethod = 'STARS' | 'WALLET' | 'SBP_MANUAL';
export type DonationStatus =
  | 'PENDING'
  | 'PENDING_MANUAL'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED';

const MIN_AMOUNT_STARS = 1;
const MAX_AMOUNT_STARS = 1000;

function getStarsRate(): number {
  // Сколько Stars в 1 ₽ (для derived amountRub в БД, аналитика)
  const raw = process.env.STARS_RATE;
  const parsed = raw ? Number(raw) : 1.5;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1.5;
  }
  return parsed;
}

export function starsToRub(amountStars: number): number {
  return Math.max(1, Math.round(amountStars / getStarsRate()));
}

export function validateAmountStars(amountStars: unknown): number {
  if (typeof amountStars !== 'number' || !Number.isFinite(amountStars)) {
    throw new Error('amountStars must be a number');
  }
  const rounded = Math.round(amountStars);
  if (rounded < MIN_AMOUNT_STARS || rounded > MAX_AMOUNT_STARS) {
    throw new Error(
      `amountStars must be between ${MIN_AMOUNT_STARS} and ${MAX_AMOUNT_STARS}`
    );
  }
  return rounded;
}

class DonationService {
  /**
   * Создать инвойс Telegram Stars и pending-запись Donation.
   * Возвращает ссылку, которую фронт открывает через Telegram.WebApp.openInvoice.
   */
  async createStarsInvoice(
    userId: number,
    amountStarsInput: number
  ): Promise<{ invoiceUrl: string; donationId: string; amountStars: number }> {
    const amountStars = validateAmountStars(amountStarsInput);
    const amountRub = starsToRub(amountStars);

    const bot = getBotInstance();
    if (!bot) {
      throw new Error('Bot instance not initialized');
    }

    const donation = await prisma.donation.create({
      data: {
        userId,
        amountRub,
        amountStars,
        method: 'STARS',
        status: 'PENDING',
      },
    });

    try {
      const invoiceUrl = await bot.api.createInvoiceLink(
        'Поддержка проекта',
        `Спасибо за поддержку Rocket Lunch! ${amountStars} ⭐`,
        `donation:${donation.id}`,
        '', // provider_token must be empty for XTR
        'XTR',
        [{ label: `Поддержка ${amountStars} ⭐`, amount: amountStars }]
      );

      logger.info('💖 Stars invoice created', {
        donationId: donation.id,
        userId,
        amountStars,
        amountRubDerived: amountRub,
      });

      return { invoiceUrl, donationId: donation.id, amountStars };
    } catch (error) {
      // Откатываем pending-запись если invoice не создался
      await prisma.donation.update({
        where: { id: donation.id },
        data: { status: 'FAILED' },
      });
      logger.error('❌ Failed to create Stars invoice', {
        donationId: donation.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Подтвердить Stars-донат после прихода successful_payment.
   * Идемпотентно — повторный вызов с тем же chargeId не дублирует обновление.
   */
  async confirmStarsPayment(
    invoicePayload: string,
    telegramChargeId: string
  ): Promise<void> {
    const match = /^donation:(.+)$/.exec(invoicePayload);
    if (!match) {
      logger.warn('successful_payment with non-donation payload', {
        invoicePayload,
      });
      return;
    }
    const donationId = match[1];

    // Atomic conditional update — guarantees only ONE caller flips PENDING → CONFIRMED
    // even if Telegram redelivers successful_payment (or two workers race).
    // updateMany returns count of rows actually updated (0 if already CONFIRMED).
    const updateResult = await prisma.donation.updateMany({
      where: {
        id: donationId,
        status: { not: 'CONFIRMED' },
      },
      data: {
        status: 'CONFIRMED',
        externalId: telegramChargeId,
        confirmedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      // Donation either doesn't exist or is already CONFIRMED — no side effects.
      const exists = await prisma.donation.findUnique({
        where: { id: donationId },
        select: { id: true, status: true },
      });
      if (!exists) {
        logger.error('Donation not found for confirmation', { donationId });
      } else {
        logger.info('Donation already confirmed (idempotent)', { donationId });
      }
      return;
    }

    const donation = await prisma.donation.findUnique({ where: { id: donationId } });
    if (!donation) {
      // Should not happen — we just updated it. Log for forensics.
      logger.error('Donation disappeared after confirm', { donationId });
      return;
    }

    logger.info('✅ Stars donation confirmed', {
      donationId,
      telegramChargeId,
      userId: donation.userId,
      amountStars: donation.amountStars,
    });

    // Thank-you DM fires exactly once — the only caller that won the atomic update.
    try {
      const user = await prisma.user.findUnique({
        where: { id: donation.userId },
      });
      const bot = getBotInstance();
      if (user && bot) {
        await bot.api.sendMessage(
          Number(user.telegramId),
          `💖 Спасибо за поддержку проекта на ${donation.amountStars} ⭐! Ваш донат поможет развитию Rocket Lunch.`
        );
      }
    } catch (err) {
      // Не критично — донат уже подтверждён
      logger.warn('Failed to send thank-you DM', { donationId, err });
    }
  }
}

export const donationService = new DonationService();
