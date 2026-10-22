/**
 * Аватарки. Два свойства, которые ломаются молча:
 *
 * 1. В базе лежит стабильный маркер `tg://avatar/<fileId>`, а клиенту уходит
 *    ПОДПИСАННАЯ ссылка с коротким сроком. Если отдать маркер как есть, <img>
 *    получит 401 от auth-middleware; если сохранить подпись в базу — она
 *    протухнет и картинки исчезнут через час.
 * 2. Кэш живёт 7 дней. Ошибка тут либо долбит Telegram на каждый рендер списка,
 *    либо показывает аватарку, которую человек сменил месяц назад.
 */
import { AvatarService } from '../../../services/avatar.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { signAvatarUrl } from '../../../utils/avatar-url-signer';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/avatar-url-signer', () => ({
  signAvatarUrl: jest.fn((fileId: string) => `/api/avatar/${fileId}?exp=1&sig=x`),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const botInstance = asMock(getBotInstance);
const sign = asMock(signAvatarUrl);

const NOW = new Date('2026-08-03T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

let getUserProfilePhotos: jest.Mock;
let getFile: jest.Mock;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  getUserProfilePhotos = jest.fn().mockResolvedValue({
    photos: [[{ file_id: 'small' }, { file_id: 'large' }]],
  });
  getFile = jest.fn().mockResolvedValue({ file_path: 'photos/a.jpg' });
  botInstance.mockReturnValue({ api: { getUserProfilePhotos, getFile } });

  asMock(prismaMock.user.update).mockResolvedValue({ id: 1 });
  sign.mockImplementation(
    (fileId: string) => `/api/avatar/${fileId}?exp=1&sig=x`
  );
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getUserAvatar', () => {
  it('кэш старше семи дней обновляется', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      avatarUrl: 'tg://avatar/old',
      avatarUpdatedAt: new Date(NOW.getTime() - 8 * DAY),
    } as never);

    await AvatarService.getUserAvatar(BigInt(555));

    expect(getUserProfilePhotos).toHaveBeenCalled();
  });

  it('внешняя ссылка отдаётся как есть, без подписи', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      avatarUrl: 'https://cdn.example/avatar.png',
      avatarUpdatedAt: NOW,
    } as never);

    const url = await AvatarService.getUserAvatar(BigInt(555));

    expect(url).toBe('https://cdn.example/avatar.png');
    expect(sign).not.toHaveBeenCalled();
  });

  it('пустой fileId в маркере трактуется как отсутствие аватарки', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      avatarUrl: 'tg://avatar/',
      avatarUpdatedAt: NOW,
    } as never);

    await expect(AvatarService.getUserAvatar(BigInt(555))).resolves.toBeNull();
  });

  it('пустой набор размеров тоже даёт null', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      avatarUrl: null,
      avatarUpdatedAt: null,
    } as never);
    getUserProfilePhotos.mockResolvedValue({ photos: [[]] });

    await expect(AvatarService.getUserAvatar(BigInt(555))).resolves.toBeNull();
  });

  it('файл без пути — null', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      avatarUrl: null,
      avatarUpdatedAt: null,
    } as never);
    getFile.mockResolvedValue({});

    await expect(AvatarService.getUserAvatar(BigInt(555))).resolves.toBeNull();
  });

  it('без поднятого бота обновление не ломает ответ', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      avatarUrl: null,
      avatarUpdatedAt: null,
    } as never);
    botInstance.mockReturnValue(null);

    await expect(AvatarService.getUserAvatar(BigInt(555))).resolves.toBeNull();
  });

  it.each([
    ['USER_ID_INVALID', { error_code: 400, description: 'USER_ID_INVALID' }],
    [
      'user not found',
      { error_code: 400, description: 'Bad Request: user not found' },
    ],
    ['прочая ошибка', { error_code: 500, description: 'Internal' }],
  ])('ошибка Telegram (%s) не роняет запрос', async (_label, error) => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      avatarUrl: null,
      avatarUpdatedAt: null,
    } as never);
    getUserProfilePhotos.mockRejectedValue(error);

    await expect(AvatarService.getUserAvatar(BigInt(555))).resolves.toBeNull();
  });

  it('падение записи кэша не выбрасывается наружу', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      avatarUrl: null,
      avatarUpdatedAt: null,
    } as never);
    asMock(prismaMock.user.update).mockRejectedValue(new Error('db down'));

    await expect(AvatarService.getUserAvatar(BigInt(555))).resolves.toBeNull();
  });

  it('ошибка чтения из базы — null', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('db down'));

    await expect(AvatarService.getUserAvatar(BigInt(555))).resolves.toBeNull();
  });
});

describe('getUserAvatarsBatch', () => {
  it('пустой список не идёт в базу', async () => {
    const results = await AvatarService.getUserAvatarsBatch([]);

    expect(results.size).toBe(0);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('устаревший кэш обновляется, остальные не страдают', async () => {
    asMock(prismaMock.user.findMany).mockResolvedValue([
      {
        id: 1,
        telegramId: BigInt(555),
        avatarUrl: 'tg://avatar/fresh',
        avatarUpdatedAt: NOW,
      },
      {
        id: 2,
        telegramId: BigInt(777),
        avatarUrl: null,
        avatarUpdatedAt: null,
      },
    ] as never);

    const results = await AvatarService.getUserAvatarsBatch([
      BigInt(555),
      BigInt(777),
    ]);

    expect(results.get('555')).toBe('/api/avatar/fresh?exp=1&sig=x');
    expect(results.get('777')).toBe('/api/avatar/large?exp=1&sig=x');
    expect(getUserProfilePhotos).toHaveBeenCalledTimes(1);
  });

  it('падение по одному пользователю не отменяет остальных', async () => {
    asMock(prismaMock.user.findMany).mockResolvedValue([
      { id: 1, telegramId: BigInt(555), avatarUrl: null, avatarUpdatedAt: null },
      { id: 2, telegramId: BigInt(777), avatarUrl: null, avatarUpdatedAt: null },
    ] as never);
    asMock(prismaMock.user.update)
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ id: 2 });

    const results = await AvatarService.getUserAvatarsBatch([
      BigInt(555),
      BigInt(777),
    ]);

    expect(results.size).toBe(1);
  });

  it('ошибка выборки даёт пустую карту, а не исключение', async () => {
    asMock(prismaMock.user.findMany).mockRejectedValue(new Error('db down'));

    await expect(
      AvatarService.getUserAvatarsBatch([BigInt(555)])
    ).resolves.toEqual(new Map());
  });
});
