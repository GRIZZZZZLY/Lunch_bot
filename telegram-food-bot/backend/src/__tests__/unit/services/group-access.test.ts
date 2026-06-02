import { GroupService, GroupAccessError } from '../../../services/group.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    groupMember: { findFirst: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const getChatMember = jest.fn();
jest.mock('../../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(() => ({ api: { getChatMember } })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../../../database/client');

describe('GroupService authz primitives', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('assertMember', () => {
    it('passes for an active member', async () => {
      prisma.groupMember.findFirst.mockResolvedValue({ id: 1 });
      await expect(GroupService.assertMember(7, 42)).resolves.toBeUndefined();
    });

    it('throws GroupAccessError(NOT_MEMBER) for a non-member', async () => {
      prisma.groupMember.findFirst.mockResolvedValue(null);
      await expect(GroupService.assertMember(7, 42)).rejects.toMatchObject({
        name: 'GroupAccessError',
        code: 'NOT_MEMBER',
      });
    });
  });

  describe('assertAdmin', () => {
    it('passes for a group admin', async () => {
      prisma.groupMember.findFirst.mockResolvedValue({ id: 1 });
      await expect(GroupService.assertAdmin(7, 42)).resolves.toBeUndefined();
    });

    it('throws GroupAccessError(NOT_ADMIN) for a non-admin', async () => {
      prisma.groupMember.findFirst.mockResolvedValue(null);
      await expect(GroupService.assertAdmin(7, 42)).rejects.toMatchObject({
        name: 'GroupAccessError',
        code: 'NOT_ADMIN',
      });
    });
  });

  describe('verifyTelegramMembership', () => {
    it('returns true when Telegram status is member/admin/creator', async () => {
      getChatMember.mockResolvedValue({ status: 'member' });
      await expect(GroupService.verifyTelegramMembership(100n, 200n)).resolves.toBe(true);
    });

    it('returns false (fail closed) when status is left', async () => {
      getChatMember.mockResolvedValue({ status: 'left' });
      await expect(GroupService.verifyTelegramMembership(100n, 200n)).resolves.toBe(false);
    });

    it('returns false (fail closed) when getChatMember throws', async () => {
      getChatMember.mockRejectedValue(new Error('Bad Request: user not found'));
      await expect(GroupService.verifyTelegramMembership(100n, 200n)).resolves.toBe(false);
    });
  });

  describe('addMemberFromStartParam', () => {
    const group = { id: 42, telegramId: 100n };
    const user = { id: 7, telegramId: 200n };

    it('adds membership when Telegram verifies the user', async () => {
      getChatMember.mockResolvedValue({ status: 'member' });
      prisma.groupMember.findUnique.mockResolvedValue(null);
      prisma.groupMember.upsert.mockResolvedValue({ id: 1, groupId: 42, userId: 7 });

      const result = await GroupService.addMemberFromStartParam(group, user);

      expect(result).toBe(true);
      expect(prisma.groupMember.upsert).toHaveBeenCalledTimes(1);
    });

    it('does NOT add membership when Telegram says the user is not in the group', async () => {
      getChatMember.mockResolvedValue({ status: 'left' });

      const result = await GroupService.addMemberFromStartParam(group, user);

      expect(result).toBe(false);
      expect(prisma.groupMember.upsert).not.toHaveBeenCalled();
    });
  });
});
