/**
 * Два маленьких контроллера, у каждого своя внешняя зависимость:
 * аватарки проксируются из Telegram (сеть), донаты уходят в Stars-инвойс.
 * Проверяем, что недоступность внешней стороны превращается в осмысленный код,
 * а не в необработанное исключение.
 */
import { EventEmitter } from 'events';
import https from 'https';

import { getAvatarByFileId } from '../../../api/controllers/avatar.controller';
import { donationController } from '../../../api/controllers/donation.controller';
import { getBotInstance } from '../../../bot/bot-instance';
import { donationService } from '../../../services/donation.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(),
}));

jest.mock('../../../services/donation.service', () => ({
  donationService: { createStarsInvoice: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const botInstance = asMock(getBotInstance);
const createStarsInvoice = asMock(donationService.createStarsInvoice);

describe('GET /api/avatar/:fileId', () => {
  let getFile: jest.Mock;
  let httpsGet: jest.SpyInstance;
  /** Поддельный ответ Telegram: EventEmitter с pipe, как у IncomingMessage. */
  let telegramResponse: EventEmitter & {
    statusCode?: number;
    headers: Record<string, string>;
    pipe: jest.Mock;
  };
  let requestEmitter: EventEmitter;

  beforeEach(() => {
    jest.clearAllMocks();

    getFile = jest.fn().mockResolvedValue({ file_path: 'photos/a.jpg' });
    botInstance.mockReturnValue({ api: { getFile }, token: 'bot-token' });

    telegramResponse = Object.assign(new EventEmitter(), {
      statusCode: 200,
      headers: { 'content-type': 'image/png' },
      pipe: jest.fn(),
    });
    requestEmitter = new EventEmitter();

    httpsGet = jest
      .spyOn(https, 'get')
      .mockImplementation(((
        _url: string,
        callback: (response: unknown) => void
      ) => {
        callback(telegramResponse);
        return requestEmitter;
      }) as unknown as typeof https.get);
  });

  afterEach(() => {
    httpsGet.mockRestore();
  });

  it('отдаёт файл потоком с кэшированием на 30 дней', async () => {
    const res = mockResponse();

    await getAvatarByFileId(mockRequest({ params: { fileId: 'abc' } }), res);

    expect(getFile).toHaveBeenCalledWith('abc');
    expect(httpsGet).toHaveBeenCalledWith(
      'https://api.telegram.org/file/botbot-token/photos/a.jpg',
      expect.any(Function)
    );
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toBe('public, max-age=2592000');
    expect(telegramResponse.pipe).toHaveBeenCalledWith(res);
  });

  it('без content-type подставляется image/jpeg', async () => {
    telegramResponse.headers = {};
    const res = mockResponse();

    await getAvatarByFileId(mockRequest({ params: { fileId: 'abc' } }), res);

    expect(res.headers['content-type']).toBe('image/jpeg');
  });

  it('без fileId — 400', async () => {
    const res = mockResponse();

    await getAvatarByFileId(mockRequest({ params: {} }), res);

    expect(res.statusCode).toBe(400);
    expect(getFile).not.toHaveBeenCalled();
  });

  it('бот не поднят — 503', async () => {
    botInstance.mockReturnValue(null);
    const res = mockResponse();

    await getAvatarByFileId(mockRequest({ params: { fileId: 'abc' } }), res);

    expect(res.statusCode).toBe(503);
  });

  it('Telegram не вернул путь файла — 404', async () => {
    getFile.mockResolvedValue({});
    const res = mockResponse();

    await getAvatarByFileId(mockRequest({ params: { fileId: 'abc' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('Telegram ответил не 200 — тот же код наружу', async () => {
    telegramResponse.statusCode = 403;
    const res = mockResponse();

    await getAvatarByFileId(mockRequest({ params: { fileId: 'abc' } }), res);

    expect(res.statusCode).toBe(403);
    expect(telegramResponse.pipe).not.toHaveBeenCalled();
  });

  it('ответ без статуса трактуется как 500', async () => {
    telegramResponse.statusCode = undefined;
    const res = mockResponse();

    await getAvatarByFileId(mockRequest({ params: { fileId: 'abc' } }), res);

    expect(res.statusCode).toBe(500);
  });

  it('сетевая ошибка загрузки — 500', async () => {
    const res = mockResponse();

    await getAvatarByFileId(mockRequest({ params: { fileId: 'abc' } }), res);
    requestEmitter.emit('error', new Error('ECONNRESET'));

    expect(res.statusCode).toBe(500);
  });

  it('падение getFile — 500', async () => {
    getFile.mockRejectedValue(new Error('bad file id'));
    const res = mockResponse();

    await getAvatarByFileId(mockRequest({ params: { fileId: 'abc' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/donations/stars', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createStarsInvoice.mockResolvedValue({ invoiceLink: 'https://t.me/invoice' });
  });

  it('создаёт инвойс на указанное число звёзд', async () => {
    const res = mockResponse();

    await donationController.createStarsInvoice(
      mockRequest({ user: { id: 1 }, body: { amountStars: 50 } }),
      res
    );

    expect(createStarsInvoice).toHaveBeenCalledWith(1, 50);
    expect(res.body).toMatchObject({
      success: true,
      data: { invoiceLink: 'https://t.me/invoice' },
    });
  });

  it('строковое число приводится', async () => {
    await donationController.createStarsInvoice(
      mockRequest({ user: { id: 1 }, body: { amountStars: '50' } }),
      mockResponse()
    );

    expect(createStarsInvoice).toHaveBeenCalledWith(1, 50);
  });

  it('без тела запроса сервис получает NaN и сам решает', async () => {
    await donationController.createStarsInvoice(
      mockRequest({ user: { id: 1 } }),
      mockResponse()
    );

    expect(createStarsInvoice).toHaveBeenCalledWith(1, NaN);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await donationController.createStarsInvoice(
      mockRequest({ body: { amountStars: 50 } }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(createStarsInvoice).not.toHaveBeenCalled();
  });

  it.each([
    'amountStars must be an integer',
    'amountStars must be between 1 and 2500',
  ])('ошибка валидации «%s» — 400', async message => {
    createStarsInvoice.mockRejectedValue(new Error(message));
    const res = mockResponse();

    await donationController.createStarsInvoice(
      mockRequest({ user: { id: 1 }, body: { amountStars: 0 } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('прочая ошибка — 500', async () => {
    createStarsInvoice.mockRejectedValue(new Error('telegram down'));
    const res = mockResponse();

    await donationController.createStarsInvoice(
      mockRequest({ user: { id: 1 }, body: { amountStars: 50 } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('ошибка без текста получает понятное сообщение', async () => {
    createStarsInvoice.mockRejectedValue({});
    const res = mockResponse();

    await donationController.createStarsInvoice(
      mockRequest({ user: { id: 1 }, body: { amountStars: 50 } }),
      res
    );

    expect(res.body).toMatchObject({ error: 'Failed to create Stars invoice' });
  });
});
