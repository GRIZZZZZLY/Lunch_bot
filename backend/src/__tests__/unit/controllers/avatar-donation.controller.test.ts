/**
 * Аватарки проксируются из Telegram (сеть). Проверяем, что файл уходит
 * потоком, а недоступность Telegram превращается в осмысленный код,
 * а не в необработанное исключение.
 */
import { EventEmitter } from 'events';
import https from 'https';

import { getAvatarByFileId } from '../../../api/controllers/avatar.controller';
import { getBotInstance } from '../../../bot/bot-instance';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const botInstance = asMock(getBotInstance);

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

  it('отдаёт файл потоком с публичным кэшированием', async () => {
    const res = mockResponse();

    await getAvatarByFileId(mockRequest({ params: { fileId: 'abc' } }), res);

    expect(getFile).toHaveBeenCalledWith('abc');
    expect(httpsGet).toHaveBeenCalledWith(
      'https://api.telegram.org/file/botbot-token/photos/a.jpg',
      expect.any(Function)
    );
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toMatch(/^public, max-age=\d+$/);
    expect(telegramResponse.pipe).toHaveBeenCalledWith(res);
  });

  it('без content-type подставляется image/jpeg', async () => {
    telegramResponse.headers = {};
    const res = mockResponse();

    await getAvatarByFileId(mockRequest({ params: { fileId: 'abc' } }), res);

    expect(res.headers['content-type']).toBe('image/jpeg');
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
