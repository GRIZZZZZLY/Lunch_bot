import { MenuSuggestionService } from '../../../services/menu-suggestion.service';
import { prisma } from '../../../database/client';
import { notificationService } from '../../../services/notification.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    menuSuggestion: { findUnique: jest.fn(), update: jest.fn() },
    menuItem: { create: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('../../../services/notification.service', () => ({
  notificationService: { send: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const suggestion = (overrides?: Record<string, unknown>) => ({
  id: 10,
  name: 'Soup',
  description: 'Hot',
  price: 250,
  imageUrl: null,
  suggestedBy: 3,
  status: 'PENDING',
  groupId: 1,
  ...overrides,
});

/* Раньше здесь стоял TODO: endpoint работал, статус менялся, а автор
   предложения не узнавал о судьбе своего блюда вообще никак. */
describe('MenuSuggestionService: автор узнаёт решение по своему предложению', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (notificationService.send as jest.Mock).mockResolvedValue({ success: true });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ telegramId: BigInt(555) });
    (prisma.menuSuggestion.findUnique as jest.Mock).mockResolvedValue(suggestion());
    (prisma.menuItem.create as jest.Mock).mockResolvedValue({ id: 77 });
    (prisma.menuSuggestion.update as jest.Mock).mockResolvedValue(
      suggestion({ status: 'APPROVED' })
    );
  });

  /* Решение уже записано в базу — недоставленное сообщение не должно
     превращать успешный запрос в ошибку. */
  it('сбой доставки не роняет одобрение', async () => {
    (notificationService.send as jest.Mock).mockRejectedValue(new Error('bot blocked by user'));

    await expect(MenuSuggestionService.approveSuggestion(10, 7, 1)).resolves.toMatchObject({
      menuItem: { id: 77 },
    });
  });

  /* Название блюда — пользовательский ввод. С Markdown блюдо вида
     `Плов *акция*` даёт от Telegram 400 «can't parse entities», send() эту
     ошибку глотает, и автор молча не узнаёт решение. */
  it('parse_mode не запрашивается — ввод пользователя не может сломать разбор', async () => {
    (prisma.menuSuggestion.findUnique as jest.Mock).mockResolvedValue(
      suggestion({ name: 'Плов *акция* _1_' })
    );

    await MenuSuggestionService.approveSuggestion(10, 7, 1);

    const payload = (notificationService.send as jest.Mock).mock.calls[0][0];
    expect(payload.userId).toBe(555);
    expect(payload.parseMode).toBeUndefined();
    expect(payload.message).toContain('Плов *акция* _1_');
  });

  it('у автора нет telegramId — молча пропускаем', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(MenuSuggestionService.approveSuggestion(10, 7, 1)).resolves.toBeDefined();
    expect(notificationService.send).not.toHaveBeenCalled();
  });
});
