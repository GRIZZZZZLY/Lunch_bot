/**
 * Донаты через Telegram Stars. Здесь ходят чужие деньги, а подтверждение
 * платежа приходит извне, поэтому проверяется не «работает ли сценарий», а то,
 * что нельзя сделать:
 *
 *  - подтвердить донат счётом от другого пользователя или на другую сумму;
 *  - зачесть один платёж Telegram дважды (повторный webhook — норма, а не сбой);
 *  - привязать один charge к разным донатам;
 *  - оставить в базе PENDING-запись, если счёт так и не выписался.
 *
 * Переход в CONFIRMED сделан одним updateMany с условиями на пользователя,
 * метод, сумму и статус: это единственное место, где решается, оплачено или
 * нет, и он обязан быть атомарным.
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

const { logger } = jest.requireMock('../../../utils/logger');

const api = {
  createInvoiceLink: jest.fn(),
  sendMessage: jest.fn(),
};

const NOW = new Date('2026-08-03T12:00:00.000Z');
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
  jest.useFakeTimers().setSystemTime(NOW);
  envBackup = { ...process.env };

  asMock(getBotInstance).mockReturnValue({ api });
  api.createInvoiceLink.mockResolvedValue('https://t.me/invoice/xyz');
  api.sendMessage.mockResolvedValue({ message_id: 1 });

  asMock(prismaMock.donation.findUnique).mockResolvedValue(null);
  asMock(prismaMock.donation.create).mockResolvedValue({ id: 'don-1' });
  asMock(prismaMock.donation.update).mockResolvedValue({ id: 'don-1' });
  asMock(prismaMock.donation.updateMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.user.findUnique).mockResolvedValue({
    id: 7,
    telegramId: 555n,
  });
});

afterEach(() => {
  jest.useRealTimers();
  process.env = envBackup;
});

describe('validateAmountStars', () => {
  it('целое значение в допустимых границах проходит', () => {
    expect(validateAmountStars(25)).toBe(25);
  });

  it('дробная сумма округляется', () => {
    expect(validateAmountStars(25.4)).toBe(25);
  });

  it.each([1, 1000])('граница %p допустима', amount => {
    expect(validateAmountStars(amount)).toBe(amount);
  });

  it.each([0, -5, 1001, 100000])('сумма %p отклоняется', amount => {
    expect(() => validateAmountStars(amount)).toThrow(
      'amountStars must be between 1 and 1000'
    );
  });

  it.each([['строка', '25'], ['null', null], ['NaN', Number.NaN], ['Infinity', Infinity]])(
    '%s суммой не считается',
    (_name, value) => {
      expect(() => validateAmountStars(value)).toThrow(
        'amountStars must be a number'
      );
    }
  );

  it('0.4 округляется в ноль и отклоняется, а не проходит как 0', () => {
    expect(() => validateAmountStars(0.4)).toThrow('must be between');
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

describe('createStarsInvoice', () => {
  it('создаётся pending-запись и ссылка на оплату', async () => {
    const result = await donationService.createStarsInvoice(7, 25);

    expect(result).toEqual({
      invoiceUrl: 'https://t.me/invoice/xyz',
      donationId: 'don-1',
      amountStars: 25,
    });
    expect(asMock(prismaMock.donation.create)).toHaveBeenCalledWith({
      data: {
        userId: 7,
        amountRub: 17,
        amountStars: 25,
        method: 'STARS',
        status: 'PENDING',
      },
    });
  });

  it('в payload счёта лежит id доната — по нему платёж и находят', async () => {
    await donationService.createStarsInvoice(7, 25);

    expect(api.createInvoiceLink).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'donation:don-1',
      '',
      'XTR',
      [{ label: 'Поддержка 25 ⭐', amount: 25 }]
    );
  });

  it('некорректная сумма до БД не доходит', async () => {
    await expect(donationService.createStarsInvoice(7, 0)).rejects.toThrow(
      'must be between'
    );

    expect(asMock(prismaMock.donation.create)).not.toHaveBeenCalled();
  });

  it('без бота счёт не создаётся и запись не появляется', async () => {
    asMock(getBotInstance).mockReturnValue(null);

    await expect(donationService.createStarsInvoice(7, 25)).rejects.toThrow(
      'Bot instance not initialized'
    );
    expect(asMock(prismaMock.donation.create)).not.toHaveBeenCalled();
  });

  it('если счёт не выписался, запись помечается FAILED, а не остаётся PENDING', async () => {
    api.createInvoiceLink.mockRejectedValue(new Error('telegram down'));

    await expect(donationService.createStarsInvoice(7, 25)).rejects.toThrow(
      'telegram down'
    );
    expect(asMock(prismaMock.donation.update)).toHaveBeenCalledWith({
      where: { id: 'don-1' },
      data: { status: 'FAILED' },
    });
  });
});

describe('validateStarsPreCheckout', () => {
  async function check(over: Record<string, unknown> = {}) {
    return donationService.validateStarsPreCheckout(payment(over));
  }

  it('совпадающий счёт подтверждается', async () => {
    asMock(prismaMock.donation.findUnique).mockResolvedValue(donation());

    await expect(check()).resolves.toEqual({ ok: true });
  });

  it.each([
    ['чужая валюта', { currency: 'RUB' }],
    ['payload не про донат', { invoicePayload: 'order:1' }],
    ['payload с недопустимыми символами', { invoicePayload: 'donation:../../etc' }],
    ['нулевая сумма', { totalAmount: 0 }],
    ['дробная сумма', { totalAmount: 25.5 }],
    ['дробный id пользователя', { telegramUserId: 1.5 }],
  ])('%s отклоняется до обращения к БД', async (_name, over) => {
    const result = await check(over);

    expect(result).toEqual({
      ok: false,
      error: 'Некорректные параметры платежа',
    });
    expect(asMock(prismaMock.donation.findUnique)).not.toHaveBeenCalled();
  });

  it('несуществующий донат отклоняется', async () => {
    const result = await check();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Счёт устарел или не соответствует платежу');
  });

  it.each([
    ['уже подтверждённый', { status: 'CONFIRMED' }],
    ['просроченный', { status: 'EXPIRED' }],
    ['другой способ оплаты', { method: 'SBP_MANUAL' }],
    ['другая сумма', { amountStars: 50 }],
    ['чужой пользователь', { user: { telegramId: 999n } }],
  ])('%s донат платежу не соответствует', async (_name, over) => {
    asMock(prismaMock.donation.findUnique).mockResolvedValue(donation(over));

    await expect(check()).resolves.toMatchObject({ ok: false });
  });
});

describe('confirmStarsPayment', () => {
  function confirmed(over: Record<string, unknown> = {}) {
    return donation({ status: 'CONFIRMED', externalId: CHARGE, ...over });
  }

  it('оплата переводит донат в CONFIRMED одним атомарным условием', async () => {
    asMock(prismaMock.donation.findUnique)
      .mockResolvedValueOnce(null) // поиск владельца charge
      .mockResolvedValueOnce(donation()) // проверка соответствия
      .mockResolvedValue(donation({ status: 'CONFIRMED' }));

    await donationService.confirmStarsPayment(payment());

    expect(asMock(prismaMock.donation.updateMany)).toHaveBeenCalledWith({
      where: {
        id: 'don-1',
        user: { telegramId: 555n },
        method: 'STARS',
        status: 'PENDING',
        amountStars: 25,
      },
      data: {
        status: 'CONFIRMED',
        externalId: CHARGE,
        confirmedAt: NOW,
      },
    });
  });

  it('благодарность уходит один раз — тому, кто выиграл обновление', async () => {
    asMock(prismaMock.donation.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(donation())
      .mockResolvedValue(donation({ status: 'CONFIRMED' }));

    await donationService.confirmStarsPayment(payment());

    expect(api.sendMessage).toHaveBeenCalledWith(
      555,
      expect.stringContaining('Спасибо за поддержку')
    );
  });

  it('повторный webhook с тем же charge ничего не меняет', async () => {
    asMock(prismaMock.donation.findUnique).mockResolvedValue({ id: 'don-1' });

    await donationService.confirmStarsPayment(payment());

    expect(asMock(prismaMock.donation.updateMany)).not.toHaveBeenCalled();
    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Donation payment already confirmed'
    );
  });

  it('один charge нельзя привязать к другому донату', async () => {
    asMock(prismaMock.donation.findUnique).mockResolvedValue({ id: 'don-2' });

    await expect(
      donationService.confirmStarsPayment(payment())
    ).rejects.toThrow('Telegram charge is already assigned');
    expect(asMock(prismaMock.donation.updateMany)).not.toHaveBeenCalled();
  });

  it('платёж, не совпавший с донатом, не подтверждается', async () => {
    asMock(prismaMock.donation.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(donation({ amountStars: 50 }));

    await expect(
      donationService.confirmStarsPayment(payment())
    ).rejects.toThrow('Successful payment does not match the donation');
    expect(asMock(prismaMock.donation.updateMany)).not.toHaveBeenCalled();
  });

  it('гонка: тот же платёж уже подтверждён — вторая попытка молчит', async () => {
    asMock(prismaMock.donation.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(donation())
      .mockResolvedValue(confirmed());
    asMock(prismaMock.donation.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      donationService.confirmStarsPayment(payment())
    ).resolves.toBeUndefined();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

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

  it('исчезнувшая после обновления запись логируется, но не бросает', async () => {
    asMock(prismaMock.donation.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(donation())
      .mockResolvedValue(null);

    await expect(
      donationService.confirmStarsPayment(payment())
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Donation disappeared after confirm',
      { donationId: 'don-1' }
    );
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

  it('payload не про донат отклоняется', async () => {
    await expect(
      donationService.confirmStarsPayment(
        payment({ invoicePayload: 'subscription:1' })
      )
    ).rejects.toThrow('Successful payment does not match the donation');
  });

  it('сбой благодарности донат не отменяет', async () => {
    asMock(prismaMock.donation.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(donation())
      .mockResolvedValue(donation({ status: 'CONFIRMED' }));
    api.sendMessage.mockRejectedValue(new Error('bot blocked by user'));

    await expect(
      donationService.confirmStarsPayment(payment())
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to send thank-you DM',
      expect.objectContaining({ donationId: 'don-1' })
    );
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
