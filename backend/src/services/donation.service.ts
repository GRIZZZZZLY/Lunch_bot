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
const STARS_CURRENCY = 'XTR';

interface StarsPaymentData {
  invoicePayload: string;
  telegramUserId: number;
  currency: string;
  totalAmount: number;
}

interface PreCheckoutValidation {
  ok: boolean;
  error?: string;
}

function extractDonationId(invoicePayload: string): string | null {
  const match = /^donation:([A-Za-z0-9_-]{1,128})$/.exec(invoicePayload);
  return match?.[1] ?? null;
}

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
  async validateStarsPreCheckout(
    payment: StarsPaymentData
  ): Promise<PreCheckoutValidation> {
    const donationId = extractDonationId(payment.invoicePayload);
    if (
      !donationId ||
      payment.currency !== STARS_CURRENCY ||
      !Number.isSafeInteger(payment.telegramUserId) ||
      !Number.isSafeInteger(payment.totalAmount) ||
      payment.totalAmount < MIN_AMOUNT_STARS
    ) {
      return { ok: false, error: 'Некорректные параметры платежа' };
    }

    const donation = await prisma.donation.findUnique({
      where: { id: donationId },
      select: {
        method: true,
        status: true,
        amountStars: true,
        user: { select: { telegramId: true } },
      },
    });

    const matches =
      donation?.method === 'STARS' &&
      donation.status === 'PENDING' &&
      donation.amountStars === payment.totalAmount &&
      donation.user.telegramId === BigInt(payment.telegramUserId);

    return matches
      ? { ok: true }
      : { ok: false, error: 'Счёт устарел или не соответствует платежу' };
  }

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
    payment: StarsPaymentData & { telegramChargeId: string }
  ): Promise<void> {
    if (
      !payment.telegramChargeId ||
      payment.telegramChargeId.length > 256
    ) {
      throw new Error('Invalid Telegram payment charge identifier');
    }

    const donationId = extractDonationId(payment.invoicePayload);
    if (!donationId) {
      throw new Error('Successful payment does not match the donation');
    }

    const chargeOwner = await prisma.donation.findUnique({
      where: { externalId: payment.telegramChargeId },
      select: { id: true },
    });
    if (chargeOwner) {
      if (chargeOwner.id === donationId) {
        logger.info('Donation payment already confirmed');
        return;
      }
      throw new Error('Telegram charge is already assigned');
    }

    const validation = await this.validateStarsPreCheckout(payment);
    if (!validation.ok) {
      throw new Error('Successful payment does not match the donation');
    }

    const updateResult = await prisma.donation.updateMany({
      where: {
        id: donationId,
        user: { telegramId: BigInt(payment.telegramUserId) },
        method: 'STARS',
        status: 'PENDING',
        amountStars: payment.totalAmount,
      },
      data: {
        status: 'CONFIRMED',
        externalId: payment.telegramChargeId,
        confirmedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      const existing = await prisma.donation.findUnique({
        where: { id: donationId },
        select: {
          status: true,
          externalId: true,
          amountStars: true,
          user: { select: { telegramId: true } },
        },
      });
      const isSameConfirmedPayment =
        existing?.status === 'CONFIRMED' &&
        existing.externalId === payment.telegramChargeId &&
        existing.amountStars === payment.totalAmount &&
        existing.user.telegramId === BigInt(payment.telegramUserId);
      if (isSameConfirmedPayment) {
        logger.info('Donation payment already confirmed');
        return;
      }

      throw new Error('Donation payment could not be confirmed atomically');
    }

    const donation = await prisma.donation.findUnique({ where: { id: donationId } });
    if (!donation) {
      // Should not happen — we just updated it. Log for forensics.
      logger.error('Donation disappeared after confirm', { donationId });
      return;
    }

    logger.info('Stars donation confirmed', {
      donationId,
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
          `💖 Спасибо за поддержку — ${donation.amountStars} ⭐! Это помогает развивать Rocket Lunch.`
        );
      }
    } catch (err) {
      // Не критично — донат уже подтверждён
      logger.warn('Failed to send thank-you DM', { donationId, err });
    }
  }
}

export const donationService = new DonationService();
