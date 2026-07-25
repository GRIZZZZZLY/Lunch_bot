import { Bot } from 'grammy';
import { BotContext } from '../../types/bot.types';
import { donationService } from '../../services/donation.service';
import { logger } from '../../utils/logger';

/**
 * Регистрирует обработчики Telegram Bot Payments (Stars и т.п.).
 * Должно вызываться из createBot() ДО регистрации общих message-handler'ов.
 */
export function registerPaymentHandlers(bot: Bot<BotContext>): void {
  // Telegram требует ответить на pre_checkout_query в течение 10 секунд.
  bot.on('pre_checkout_query', async (ctx) => {
    try {
      const query = ctx.preCheckoutQuery;
      const validation = await donationService.validateStarsPreCheckout({
        invoicePayload: query.invoice_payload,
        telegramUserId: ctx.from.id,
        currency: query.currency,
        totalAmount: query.total_amount,
      });

      if (validation.ok) {
        await ctx.answerPreCheckoutQuery(true);
      } else {
        await ctx.answerPreCheckoutQuery(false, {
          error_message:
            validation.error ?? 'Не удалось проверить платёж',
        });
      }
      logger.info('Pre-checkout query processed', { accepted: validation.ok });
    } catch (error) {
      logger.error('Failed to validate pre-checkout query', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      try {
        await ctx.answerPreCheckoutQuery(false, {
          error_message: 'Не удалось проверить платёж. Попробуйте снова.',
        });
      } catch {
        logger.error('Failed to reject pre-checkout query');
      }
    }
  });

  // Успешный платёж — подтверждаем донат, если payload наш.
  bot.on(':successful_payment', async (ctx) => {
    try {
      const payment = ctx.message?.successful_payment;
      const telegramUserId = ctx.from?.id;
      if (!payment || !telegramUserId) {
        logger.error('Successful payment has no authenticated sender');
        return;
      }

      logger.info('Successful payment received', {
        currency: payment.currency,
        totalAmount: payment.total_amount,
      });

      if (payment.invoice_payload?.startsWith('donation:')) {
        await donationService.confirmStarsPayment({
          invoicePayload: payment.invoice_payload,
          telegramChargeId: payment.telegram_payment_charge_id,
          telegramUserId,
          currency: payment.currency,
          totalAmount: payment.total_amount,
        });
      }
    } catch (error) {
      logger.error('Failed to handle successful payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // В webhook-режиме ошибка должна дойти до HTTP-обработчика, чтобы
      // Telegram повторил доставку и подтверждение платежа не потерялось.
      throw error;
    }
  });
}
