import { Bot } from 'grammy';
import { registerPaymentHandlers } from '../../../bot/handlers/payments.handlers';
import { donationService } from '../../../services/donation.service';
import { BotContext } from '../../../types/bot.types';

jest.mock('../../../services/donation.service', () => ({
  donationService: {
    confirmStarsPayment: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

type RegisteredHandler = (ctx: unknown) => Promise<void>;

describe('payment handlers', () => {
  const handlers = new Map<string, RegisteredHandler>();
  const bot: { on: jest.Mock<void, [string, RegisteredHandler]> } = {
    on: jest.fn((eventName: string, handler: RegisteredHandler): void => {
      handlers.set(eventName, handler);
    }),
  };

  beforeEach(() => {
    handlers.clear();
    jest.clearAllMocks();
    registerPaymentHandlers(bot as unknown as Bot<BotContext>);
  });

  it('answers Telegram pre-checkout queries successfully', async () => {
    const answerPreCheckoutQuery = jest.fn().mockResolvedValue(undefined);
    const handler = handlers.get('pre_checkout_query');

    await handler?.({
      answerPreCheckoutQuery,
      from: { id: 500 },
      preCheckoutQuery: { invoice_payload: 'donation:don-1' },
    });

    expect(answerPreCheckoutQuery).toHaveBeenCalledWith(true);
  });

  it('confirms donation payloads from successful Stars payments', async () => {
    const handler = handlers.get(':successful_payment');

    await handler?.({
      message: {
        successful_payment: {
          currency: 'XTR',
          invoice_payload: 'donation:don-1',
          telegram_payment_charge_id: 'charge-1',
          total_amount: 25,
        },
      },
    });

    expect(donationService.confirmStarsPayment).toHaveBeenCalledWith(
      'donation:don-1',
      'charge-1'
    );
  });

  it('ignores successful payments that are not donation payloads', async () => {
    const handler = handlers.get(':successful_payment');

    await handler?.({
      message: {
        successful_payment: {
          currency: 'XTR',
          invoice_payload: 'other:payload',
          telegram_payment_charge_id: 'charge-2',
          total_amount: 25,
        },
      },
    });

    expect(donationService.confirmStarsPayment).not.toHaveBeenCalled();
  });
});
