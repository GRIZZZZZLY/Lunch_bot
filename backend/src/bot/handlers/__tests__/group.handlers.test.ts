import { handleOptInButton, WELCOME_GREETING } from '../group.handlers';
import { UserService } from '../../../services/user.service';
import { GroupService } from '../../../services/group.service';
import { prisma } from '../../../database/client';

jest.mock('../../../services/user.service');
jest.mock('../../../services/group.service');
jest.mock('../../../database/client', () => ({
  prisma: {
    groupMember: {
      update: jest.fn(),
    },
  },
}));
jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockedUserService = UserService as jest.Mocked<typeof UserService>;
const mockedGroupService = GroupService as jest.Mocked<typeof GroupService>;

describe('handleOptInButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGroupService.upsertGroup.mockResolvedValue({ id: 7 } as never);
    mockedUserService.upsertUser.mockResolvedValue({ id: 42 } as never);
    mockedGroupService.addMemberToGroup.mockResolvedValue({});
    (prisma.groupMember.update as jest.Mock).mockResolvedValue({});
  });

  it('does not duplicate a name already in the list', async () => {
    const ctx = {
      chat: { id: -1001234567, title: 'Test Group', type: 'supergroup' },
      callbackQuery: {
        from: { id: 999, username: 'eater', first_name: 'Ann', last_name: 'Smith', is_bot: false },
        message: { text: `${WELCOME_GREETING}\n\n🍽 Обедают: Ann` },
      },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      editMessageText: jest.fn().mockResolvedValue(undefined),
    } as unknown as Parameters<typeof handleOptInButton>[0] & { editMessageText: jest.Mock; answerCallbackQuery: jest.Mock };

    await handleOptInButton(ctx);

    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});
