import { Bot } from 'grammy';
import { BotContext } from '../../types/bot.types';
import { donationService } from '../../services/donation.service';
import { logger } from '../../utils/logger';

/**
 * Регистрирует обработчики Telegram Bot Payments (Stars и т.п.).
 * Должно вызываться из createBot() ДО регистрации общих message-handler'ов.
 */
export function registerPaymentHandlers(bot: Bot<BotContext>): void {
  // Telegram требует ответить на pre_checkout_query в течение 10 сек.
  // Для донатов всегда отвечаем ok=true (нечего проверять, payload — наш).
  bot.on('pre_checkout_query', async (ctx) => {
    try {
      await ctx.answerPreCheckoutQuery(true);
      logger.info('✅ pre_checkout_query answered ok', {
        invoicePayload: ctx.preCheckoutQuery.invoice_payload,
        userId: ctx.from?.id,
      });
    } catch (error) {
      logger.error('❌ Failed to answer pre_checkout_query', { error });
    }
  });

  // Успешный платёж — подтверждаем донат, если payload наш.
  bot.on(':successful_payment', async (ctx) => {
    try {
      const payment = ctx.message?.successful_payment;
      if (!payment) return;

      logger.info('💳 successful_payment received', {
        currency: payment.currency,
        totalAmount: payment.total_amount,
        invoicePayload: payment.invoice_payload,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
      });

      if (payment.invoice_payload?.startsWith('donation:')) {
        await donationService.confirmStarsPayment(
          payment.invoice_payload,
          payment.telegram_payment_charge_id
        );
      }
    } catch (error) {
      logger.error('❌ Failed to handle successful_payment', { error });
    }
  });
}
