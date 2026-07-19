import { MenuSuggestionService } from '../menu-suggestion.service';
import { prisma } from '../../database/client';
import { GroupAccessError } from '../group.service';

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
  },
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
      (MenuSuggestionService.deleteSuggestion as any)(10, 2)
    ).rejects.toBeInstanceOf(GroupAccessError);

    expect(prisma.menuSuggestion.delete).not.toHaveBeenCalled();
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
});
