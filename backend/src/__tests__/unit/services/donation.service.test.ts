/**
 * Донаты через Telegram Stars. Счёт, pre-checkout, подтверждение и повторный
 * webhook проверяет integration/api/donations.redis.test.ts на настоящей БД.
 * Здесь остались чистые функции (сумма, курс) и ветки подтверждения, до
 * которых эндпоинтом не дотянуться: гонки обновления и сбои после него.
 */
import {
  donationService,
  validateAmountStars,
  starsToRub,
} from '../../../services/donation.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const api = { sendMessage: jest.fn() };

const CHARGE = 'tg_charge_abc123';

/** Платёж, каким он приходит от Telegram. */
function payment(over: Record<string, unknown> = {}) {
  return {
    invoicePayload: 'donation:don-1',
    telegramUserId: 555,
    currency: 'XTR',
    totalAmount: 25,
    telegramChargeId: CHARGE,
    ...over,
  };
}

/** Запись доната в БД, каким её видит проверка соответствия. */
function donation(over: Record<string, unknown> = {}) {
  return {
    id: 'don-1',
    userId: 7,
    method: 'STARS',
    status: 'PENDING',
    amountStars: 25,
    externalId: null,
    user: { telegramId: 555n },
    ...over,
  };
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  envBackup = { ...process.env };

  asMock(getBotInstance).mockReturnValue({ api });
  api.sendMessage.mockResolvedValue({ message_id: 1 });

  asMock(prismaMock.donation.findUnique).mockResolvedValue(null);
  asMock(prismaMock.donation.updateMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.user.findUnique).mockResolvedValue({
    id: 7,
    telegramId: 555n,
  });
});

afterEach(() => {
  process.env = envBackup;
});

describe('validateAmountStars', () => {
  it.each([
    [25.4, 25],
    [25.5, 26],
  ])('дробная сумма %p округляется до %p', (amount, expected) => {
    expect(validateAmountStars(amount)).toBe(expected);
  });
});

describe('starsToRub', () => {
  it('по умолчанию курс 1.5 звезды за рубль', () => {
    expect(starsToRub(30)).toBe(20);
  });

  it('курс берётся из переменной окружения', () => {
    process.env.STARS_RATE = '2';

    expect(starsToRub(30)).toBe(15);
  });

  it.each(['0', '-1', 'abc', ''])(
    'некорректный курс %p откатывается к 1.5',
    raw => {
      process.env.STARS_RATE = raw;

      expect(starsToRub(30)).toBe(20);
    }
  );

  it('минимальный донат не превращается в ноль рублей', () => {
    expect(starsToRub(1)).toBe(1);
  });
});

describe('confirmStarsPayment', () => {
  function confirmed(over: Record<string, unknown> = {}) {
    return donation({ status: 'CONFIRMED', externalId: CHARGE, ...over });
  }

  it('гонка с другим charge — ошибка, а не тихое подтверждение', async () => {
    asMock(prismaMock.donation.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(donation())
      .mockResolvedValue(confirmed({ externalId: 'other_charge' }));
    asMock(prismaMock.donation.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      donationService.confirmStarsPayment(payment())
    ).rejects.toThrow('could not be confirmed atomically');
  });

  it('не обновилось и записи нет — ошибка', async () => {
    asMock(prismaMock.donation.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(donation())
      .mockResolvedValue(null);
    asMock(prismaMock.donation.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      donationService.confirmStarsPayment(payment())
    ).rejects.toThrow('could not be confirmed atomically');
  });

  it('исчезнувшая после обновления запись не бросает', async () => {
    asMock(prismaMock.donation.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(donation())
      .mockResolvedValue(null);

    await expect(
      donationService.confirmStarsPayment(payment())
    ).resolves.toBeUndefined();
  });

  it.each([
    ['пустой', ''],
    ['слишком длинный', 'x'.repeat(257)],
  ])('идентификатор платежа %s отклоняется', async (_name, charge) => {
    await expect(
      donationService.confirmStarsPayment(payment({ telegramChargeId: charge }))
    ).rejects.toThrow('Invalid Telegram payment charge identifier');
    expect(asMock(prismaMock.donation.findUnique)).not.toHaveBeenCalled();
  });

  it('без бота благодарность просто не отправляется', async () => {
    asMock(prismaMock.donation.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(donation())
      .mockResolvedValue(donation({ status: 'CONFIRMED' }));
    asMock(getBotInstance).mockReturnValue(null);

    await expect(
      donationService.confirmStarsPayment(payment())
    ).resolves.toBeUndefined();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('удалённому пользователю благодарность не отправляется', async () => {
    asMock(prismaMock.donation.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(donation())
      .mockResolvedValue(donation({ status: 'CONFIRMED' }));
    asMock(prismaMock.user.findUnique).mockResolvedValue(null);

    await expect(
      donationService.confirmStarsPayment(payment())
    ).resolves.toBeUndefined();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });
});
