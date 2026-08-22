import { MenuSuggestionService } from '../menu-suggestion.service';
import { prisma } from '../../database/client';
import { GroupAccessError, GroupService } from '../group.service';
import { notificationService } from '../notification.service';
import { logger } from '../../utils/logger';

jest.mock('../../database/client', () => ({
  prisma: {
    menuSuggestion: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    menuItem: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../notification.service', () => ({
  notificationService: { send: jest.fn().mockResolvedValue({ success: true }) },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const createSuggestion = (overrides?: Record<string, unknown>) => ({
  id: 10,
  name: 'Soup',
  description: 'Hot',
  price: 250,
  imageUrl: 'https://example.com/soup.jpg',
  suggestedBy: 3,
  reviewedBy: null,
  reviewedAt: null,
  rejectionReason: null,
  createdMenuItemId: null,
  status: 'PENDING',
  groupId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('MenuSuggestionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(GroupService, 'assertMember').mockResolvedValue();
  });

  it('creates a suggestion inside the selected group', async () => {
    const suggestion = createSuggestion({ groupId: 2 });
    (prisma.menuSuggestion.create as jest.Mock).mockResolvedValue(suggestion);

    await MenuSuggestionService.createSuggestion({
      name: 'Soup',
      description: 'Hot',
      price: 250,
      imageUrl: 'https://example.com/soup.jpg',
      suggestedBy: 3,
      groupId: 2,
    });

    expect(prisma.menuSuggestion.create).toHaveBeenCalledWith({
      data: {
        name: 'Soup',
        description: 'Hot',
        price: 250,
        imageUrl: 'https://example.com/soup.jpg',
        suggestedBy: 3,
        groupId: 2,
        status: 'PENDING',
      },
      include: {
        suggester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });
  });

  it('does not approve a suggestion from another selected group', async () => {
    (prisma.menuSuggestion.findUnique as jest.Mock).mockResolvedValue(
      createSuggestion({ groupId: 1, status: 'PENDING' })
    );

    await expect(
      (MenuSuggestionService.approveSuggestion as any)(10, 7, 2)
    ).rejects.toBeInstanceOf(GroupAccessError);

    expect(prisma.menuItem.create).not.toHaveBeenCalled();
    expect(prisma.menuSuggestion.update).not.toHaveBeenCalled();
  });

  it('does not reject a suggestion from another selected group', async () => {
    (prisma.menuSuggestion.findUnique as jest.Mock).mockResolvedValue(
      createSuggestion({ groupId: 1, status: 'PENDING' })
    );

    await expect(
      (MenuSuggestionService.rejectSuggestion as any)(10, 7, 'No', 2)
    ).rejects.toBeInstanceOf(GroupAccessError);

    expect(prisma.menuSuggestion.update).not.toHaveBeenCalled();
  });

  it('does not delete a suggestion from another selected group', async () => {
    (prisma.menuSuggestion.findUnique as jest.Mock).mockResolvedValue(
      createSuggestion({ groupId: 1, status: 'REJECTED' })
    );

    await expect(
      (MenuSuggestionService.deleteSuggestion as any)(10, 3, 2)
    ).rejects.toBeInstanceOf(GroupAccessError);

    expect(prisma.menuSuggestion.delete).not.toHaveBeenCalled();
  });

  /* Регрессия. Кнопка «Удалить» показывалась автору его же предложения на
     рассмотрении, а операцию не пропускали сразу два замка: админская мидлвара
     на маршруте и запрет на статус PENDING здесь. Сработать она не могла ни
     разу, и молчала при этом — отказ сервера интерфейс не показывал. */
  it('автор отзывает своё предложение, пока оно на рассмотрении', async () => {
    (prisma.menuSuggestion.findUnique as jest.Mock).mockResolvedValue(
      createSuggestion({ groupId: 1, status: 'PENDING', suggestedBy: 3 })
    );
    const asAdmin = jest.spyOn(GroupService, 'isUserGroupAdmin');

    await (MenuSuggestionService.deleteSuggestion as any)(10, 3, 1);

    expect(prisma.menuSuggestion.delete).toHaveBeenCalledWith({ where: { id: 10 } });
    // Автору права модератора не нужны — их даже не спрашивают.
    expect(asAdmin).not.toHaveBeenCalled();
  });

  it('чужое предложение посторонний не удаляет', async () => {
    (prisma.menuSuggestion.findUnique as jest.Mock).mockResolvedValue(
      createSuggestion({ groupId: 1, status: 'PENDING', suggestedBy: 3 })
    );
    jest.spyOn(GroupService, 'isUserGroupAdmin').mockResolvedValue(false);

    await expect(
      (MenuSuggestionService.deleteSuggestion as any)(10, 99, 1)
    ).rejects.toBeInstanceOf(GroupAccessError);

    expect(prisma.menuSuggestion.delete).not.toHaveBeenCalled();
  });

  it('админ группы не удаляет ожидающее — сначала отклонить, чтобы осталась причина', async () => {
    (prisma.menuSuggestion.findUnique as jest.Mock).mockResolvedValue(
      createSuggestion({ groupId: 1, status: 'PENDING', suggestedBy: 3 })
    );
    jest.spyOn(GroupService, 'isUserGroupAdmin').mockResolvedValue(true);

    await expect(
      (MenuSuggestionService.deleteSuggestion as any)(10, 7, 1)
    ).rejects.toThrow('Cannot delete pending suggestion. Reject it first.');

    expect(prisma.menuSuggestion.delete).not.toHaveBeenCalled();
  });

  it('админ группы убирает уже разобранное', async () => {
    (prisma.menuSuggestion.findUnique as jest.Mock).mockResolvedValue(
      createSuggestion({ groupId: 1, status: 'REJECTED', suggestedBy: 3 })
    );
    jest.spyOn(GroupService, 'isUserGroupAdmin').mockResolvedValue(true);

    await (MenuSuggestionService.deleteSuggestion as any)(10, 7, 1);

    expect(prisma.menuSuggestion.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  it('counts suggestion stats inside the selected group', async () => {
    (prisma.menuSuggestion.count as jest.Mock)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const stats = await (MenuSuggestionService.getStats as any)(2);

    expect(stats).toEqual({
      total: 4,
      pending: 2,
      approved: 1,
      rejected: 1,
      approvalRate: 25,
    });
    expect(prisma.menuSuggestion.count).toHaveBeenNthCalledWith(1, {
      where: { groupId: 2 },
    });
    expect(prisma.menuSuggestion.count).toHaveBeenNthCalledWith(2, {
      where: { status: 'PENDING', groupId: 2 },
    });
  });

  it('counts pending suggestions inside the selected group', async () => {
    (prisma.menuSuggestion.count as jest.Mock).mockResolvedValue(3);

    const count = await (MenuSuggestionService.getPendingCount as any)(2);

    expect(count).toBe(3);
    expect(prisma.menuSuggestion.count).toHaveBeenCalledWith({
      where: { status: 'PENDING', groupId: 2 },
    });
  });
  /**
   * Раньше здесь стоял TODO: endpoint работал, статус менялся, а автор
   * предложения не узнавал о судьбе своего блюда вообще никак.
   */
  describe('автор узнаёт решение по своему предложению', () => {
    const suggester = { id: 3, firstName: 'Игорь' };

    beforeEach(() => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        telegramId: BigInt(555),
      });
      (prisma.menuSuggestion.findUnique as jest.Mock).mockResolvedValue(
        createSuggestion()
      );
      (prisma.menuItem.create as jest.Mock).mockResolvedValue({ id: 77 });
      (prisma.menuSuggestion.update as jest.Mock).mockResolvedValue(
        createSuggestion({ status: 'APPROVED', suggester })
      );
    });

    it('одобрение приходит автору с названием блюда', async () => {
      await (MenuSuggestionService.approveSuggestion as any)(10, 7, 1);

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 555,
          message: expect.stringContaining('Твоё блюдо «Soup» добавлено в меню!'),
        })
      );
    });

    it('отказ приходит автору с причиной', async () => {
      (prisma.menuSuggestion.update as jest.Mock).mockResolvedValue(
        createSuggestion({ status: 'REJECTED', suggester })
      );

      await (MenuSuggestionService.rejectSuggestion as any)(
        10,
        7,
        'Уже есть похожее',
        1
      );

      const { message } = (notificationService.send as jest.Mock).mock
        .calls[0][0];
      expect(message).toContain('Блюдо «Soup» не добавили в меню.');
      expect(message).toContain('Причина: Уже есть похожее');
    });

    it('без причины отказ всё равно объясняет, что делать', async () => {
      (prisma.menuSuggestion.update as jest.Mock).mockResolvedValue(
        createSuggestion({ status: 'REJECTED', suggester })
      );

      await (MenuSuggestionService.rejectSuggestion as any)(10, 7, undefined, 1);

      expect(
        (notificationService.send as jest.Mock).mock.calls[0][0].message
      ).toContain('Причину администратор не указал');
    });

    /* Решение уже записано в базу — недоставленное сообщение не должно
       превращать успешный запрос в ошибку. */
    it('сбой доставки не роняет одобрение', async () => {
      (notificationService.send as jest.Mock).mockRejectedValue(
        new Error('bot blocked by user')
      );

      await expect(
        (MenuSuggestionService.approveSuggestion as any)(10, 7, 1)
      ).resolves.toMatchObject({ menuItem: { id: 77 } });
    });

    /* Название блюда и причина отказа — пользовательский ввод. С Markdown
       блюдо вида `Плов *акция*` даёт от Telegram 400 «can't parse entities»,
       send() эту ошибку глотает, и автор молча не узнаёт решение. */
    it('parse_mode не запрашивается — ввод пользователя не может сломать разбор', async () => {
      (prisma.menuSuggestion.findUnique as jest.Mock).mockResolvedValue(
        createSuggestion({ name: 'Плов *акция* _1_' })
      );
      (prisma.menuSuggestion.update as jest.Mock).mockResolvedValue(
        createSuggestion({ status: 'APPROVED', suggester })
      );

      await (MenuSuggestionService.approveSuggestion as any)(10, 7, 1);

      const payload = (notificationService.send as jest.Mock).mock.calls[0][0];
      expect(payload.parseMode).toBeUndefined();
      expect(payload.message).toContain('Плов *акция* _1_');
    });

    it('недоставленное решение попадает в лог, а не теряется', async () => {
      (notificationService.send as jest.Mock).mockResolvedValue({
        success: false,
        error: 'bot was blocked by the user',
      });

      await (MenuSuggestionService.approveSuggestion as any)(10, 7, 1);

      expect(logger.warn).toHaveBeenCalledWith(
        'Suggestion decision was not delivered to the author',
        expect.objectContaining({ error: 'bot was blocked by the user' })
      );
    });

    it('у автора нет telegramId — молча пропускаем', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await (MenuSuggestionService.approveSuggestion as any)(10, 7, 1);

      expect(notificationService.send).not.toHaveBeenCalled();
    });
  });
});
