import { MenuController } from '../../../api/controllers/menu.controller';
import { GroupAccessError } from '../../../services/group.service';

const assertMember = jest.fn();
jest.mock('../../../services/group.service', () => ({
  GroupService: { assertMember: (...a: any[]) => assertMember(...a) },
  GroupAccessError: class GroupAccessError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'GroupAccessError';
    }
  },
}));

const getActiveMenuItems = jest.fn();
jest.mock('../../../services/menu.service', () => ({
  MenuService: { getActiveMenuItems: (...a: any[]) => getActiveMenuItems(...a) },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

function mockRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('MenuController.getActiveItems membership gate (F3)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 403 when the user is not a member of the requested group', async () => {
    assertMember.mockRejectedValue(new GroupAccessError('NOT_MEMBER', 'not a member'));
    const req: any = { query: { groupId: '42' }, body: {}, user: { id: 7 }, headers: {} };
    const res = mockRes();

    await MenuController.getActiveItems(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(getActiveMenuItems).not.toHaveBeenCalled();
  });

  it('returns the menu when the user IS a member', async () => {
    assertMember.mockResolvedValue(undefined);
    getActiveMenuItems.mockResolvedValue([{ id: 1, name: 'Pizza', price: null }]);
    const req: any = { query: { groupId: '42' }, body: {}, user: { id: 7 }, headers: {} };
    const res = mockRes();

    await MenuController.getActiveItems(req, res);

    expect(assertMember).toHaveBeenCalledWith(7, 42);
    expect(res.json).toHaveBeenCalled();
  });
});
