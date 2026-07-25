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

function createCtx(messageText: string = WELCOME_GREETING) {
  return {
    chat: { id: -1001234567, title: 'Test Group', type: 'supergroup' },
    callbackQuery: {
      from: { id: 999, username: 'eater', first_name: 'Ann', last_name: 'Smith', is_bot: false },
      message: { text: messageText },
    },
    answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
    editMessageText: jest.fn().mockResolvedValue(undefined),
  } as any;
}

describe('handleOptInButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGroupService.upsertGroup.mockResolvedValue({ id: 7 } as any);
    mockedUserService.upsertUser.mockResolvedValue({ id: 42 } as any);
    mockedGroupService.addMemberToGroup.mockResolvedValue({} as any);
    (prisma.groupMember.update as jest.Mock).mockResolvedValue({} as any);
  });

  it('registers clicker, adds to group, sets participatesInPolls, answers with toast', async () => {
    const ctx = createCtx();

    await handleOptInButton(ctx);

    expect(mockedUserService.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ telegramId: '999', firstName: 'Ann' })
    );
    expect(mockedGroupService.addMemberToGroup).toHaveBeenCalledWith(7, 42);
    expect(prisma.groupMember.update).toHaveBeenCalledWith({
      where: {
        groupId_userId: { groupId: 7, userId: 42 },
      },
      data: { participatesInPolls: true },
    });
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('списке') })
    );
  });

  it('appends the clicker name to the message and re-sends the keyboard', async () => {
    const ctx = createCtx();

    await handleOptInButton(ctx);

    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    const [text, extra] = ctx.editMessageText.mock.calls[0];
    expect(text).toContain('Ann');
    expect(text).toContain('Обедают:');
    expect(extra).toEqual(
      expect.objectContaining({ reply_markup: expect.objectContaining({ inline_keyboard: expect.any(Array) }) })
    );
  });

  it('does not duplicate a name already in the list, answers "already in list"', async () => {
    const ctx = createCtx(`${WELCOME_GREETING}\n\n🍽 Обедают: Ann`);

    await handleOptInButton(ctx);

    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('уже') })
    );
  });

  it('ignores non-group chats', async () => {
    const ctx = createCtx();
    ctx.chat.type = 'private';

    await handleOptInButton(ctx);

    expect(mockedUserService.upsertUser).not.toHaveBeenCalled();
    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});
